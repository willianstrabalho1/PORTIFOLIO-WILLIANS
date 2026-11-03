-- Panamby multiusuário — Execute no SQL Editor do seu projeto Supabase.
-- Requer Supabase Auth: contas criadas pelo administrador e autorizadas em crm_members.
-- Todos os MEMBROS AUTORIZADOS podem ler, inserir, atualizar e apagar registros.
-- Crie um PROJETO NOVO para executar este script.

create table if not exists public.crm_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now()
);
alter table public.crm_members enable row level security;
revoke all on public.crm_members from anon;
revoke all on public.crm_members from authenticated;
grant select on public.crm_members to authenticated;
drop policy if exists crm_members_read_self on public.crm_members;
create policy crm_members_read_self on public.crm_members
  for select to authenticated using (user_id = (select auth.uid()));

-- A função existe apenas para permitir que as políticas consultem a tabela protegida.
create or replace function public.is_crm_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.crm_members m where m.user_id = (select auth.uid()));
$$;
revoke all on function public.is_crm_member() from public, anon;
grant execute on function public.is_crm_member() to authenticated;

create table if not exists public.crm_records (
  kind text not null check(kind in ('clientes','vendas','followups','apuracaoLinhas','apuracaoMetas','pipelineStages')),
  record_id text not null,
  data jsonb not null check(jsonb_typeof(data)='object'),
  version integer not null default 1 check(version > 0),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  primary key (kind,record_id)
);
create index if not exists crm_records_changed_at_idx on public.crm_records (changed_at desc);
alter table public.crm_records enable row level security;
revoke all on public.crm_records from anon;
revoke all on public.crm_records from authenticated;
grant select,insert,update,delete on public.crm_records to authenticated;
drop policy if exists crm_records_read on public.crm_records;
drop policy if exists crm_records_add on public.crm_records;
drop policy if exists crm_records_update on public.crm_records;
drop policy if exists crm_records_delete on public.crm_records;
create policy crm_records_read on public.crm_records
  for select to authenticated using ((select public.is_crm_member()));
create policy crm_records_add on public.crm_records
  for insert to authenticated with check ((select public.is_crm_member()));
create policy crm_records_update on public.crm_records
  for update to authenticated using ((select public.is_crm_member()))
  with check ((select public.is_crm_member()));
create policy crm_records_delete on public.crm_records
  for delete to authenticated using ((select public.is_crm_member()));

create table if not exists public.crm_audit (
  audit_id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  actor uuid,
  operation text not null,
  kind text not null,
  record_id text not null,
  before_data jsonb,
  after_data jsonb
);
create index if not exists crm_audit_recent_idx on public.crm_audit(changed_at desc);
alter table public.crm_audit enable row level security;
revoke all on public.crm_audit from anon, authenticated;
grant select on public.crm_audit to authenticated;
drop policy if exists crm_audit_read on public.crm_audit;
create policy crm_audit_read on public.crm_audit
  for select to authenticated using ((select public.is_crm_member()));

create or replace function public.crm_log_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='DELETE' then
    insert into public.crm_audit(actor,operation,kind,record_id,before_data,after_data)
      values ((select auth.uid()),tg_op,old.kind,old.record_id,old.data,null);
    return old;
  elsif tg_op='INSERT' then
    insert into public.crm_audit(actor,operation,kind,record_id,before_data,after_data)
      values ((select auth.uid()),tg_op,new.kind,new.record_id,null,new.data);
  else
    insert into public.crm_audit(actor,operation,kind,record_id,before_data,after_data)
      values ((select auth.uid()),tg_op,new.kind,new.record_id,old.data,new.data);
  end if;
  return new;
end; $$;
revoke all on function public.crm_log_change() from public, anon, authenticated;
drop trigger if exists crm_audit_records on public.crm_records;
create trigger crm_audit_records after insert or update or delete on public.crm_records
  for each row execute function public.crm_log_change();

-- Cada atualização exige a versão anterior exata: conflitos são rejeitados
-- e a transação é revertida, em vez de sobrescrever uma edição concorrente.
create or replace function public.apply_crm_changes(p_changes jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  ch jsonb;
  k text;
  rid text;
  action text;
  expected integer;
  total integer := 0;
begin
  if not (select public.is_crm_member()) then
    raise exception 'Usuário sem autorização no CRM';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 100 then
    raise exception 'Lote inválido (máximo 100 registros)';
  end if;
  for ch in select value from jsonb_array_elements(p_changes) loop
    k := ch->>'kind';
    rid := ch->>'id';
    action := ch->>'op';
    expected := coalesce((ch->>'version')::integer,0);
    if k not in ('clientes','vendas','followups','apuracaoLinhas','apuracaoMetas','pipelineStages')
       or rid is null or length(rid) = 0 or length(rid) > 300 then
      raise exception 'Tipo ou ID inválido';
    end if;
    if action = 'insert' then
      if jsonb_typeof(ch->'data') <> 'object' then raise exception 'Registro inválido'; end if;
      insert into public.crm_records(kind,record_id,data,version,changed_by)
        values (k,rid,ch->'data',1,(select auth.uid()))
        on conflict do nothing;
      if not found then raise exception 'CONFLITO: registro %/% já existe. Atualize a página.',k,rid; end if;
    elsif action = 'update' then
      if jsonb_typeof(ch->'data') <> 'object' then raise exception 'Registro inválido'; end if;
      update public.crm_records
         set data=ch->'data',version=version+1,changed_at=now(),changed_by=(select auth.uid())
       where kind=k and record_id=rid and version=expected;
      if not found then raise exception 'CONFLITO: registro %/% alterado por outra pessoa. Atualize a página.',k,rid; end if;
    elsif action = 'delete' then
      delete from public.crm_records where kind=k and record_id=rid and version=expected;
      if not found then raise exception 'CONFLITO: registro %/% alterado ou removido por outra pessoa.',k,rid; end if;
    else
      raise exception 'Operação inválida';
    end if;
    total := total+1;
  end loop;
  return total;
end; $$;
revoke all on function public.apply_crm_changes(jsonb) from public, anon;
grant execute on function public.apply_crm_changes(jsonb) to authenticated;

-- Ativa notificações da tabela para o cliente conectado.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='crm_records'
  ) then
    alter publication supabase_realtime add table public.crm_records;
  end if;
end $$;

-- IMPORTANTE — depois de criar cada usuário em Authentication > Users,
-- copie o UUID dele e autorize pelo SQL Editor:
-- insert into public.crm_members(user_id) values ('COLE_UUID_USUARIO') on conflict do nothing;
