# Panamby Multiusuário — pacote de integração para o site atual

## O que este pacote faz

Este pacote foi desenvolvido tomando como referência o código público da versão V36 do repositório:
`https://github.com/willianstrabalho1/gestao-pedidos-panamby`.

**Não é um novo site:** altera apenas a forma de guardar e atualizar os dados do `app.js` original, preservando dashboard, importação de Excel, clientes, vendas, pipeline e follow-ups.

* Cadastro/autenticação individual via Supabase Auth (e-mail/senha).
* Lista de contas autorizadas em `crm_members`.
* Todos os membros autorizados podem ler e editar todos os registros.
* Registros individuais no PostgreSQL, sem substituir a base inteira a cada mudança.
* Sincronização entre navegadores com Supabase Realtime.
* Controle de versões para recusar edições simultâneas conflitantes.
* Registro de auditoria no banco de dados (`crm_audit`).
* Assistente opcional para migrar **uma única base local** do IndexedDB para a nuvem.
* Bloqueio do antigo botão "Limpar tudo".

## 1. Faça um backup de sua base **antes de publicar**

No site que você usa atualmente (no SEU navegador principal), clique em **Excel / Backup > Fazer backup**. Guarde o JSON em local seguro. Os arquivos antigos no navegador não são migrados automaticamente. Não apague dados no navegador antes de conferir que tudo foi transferido.

## 2. Configure Supabase

1. Entre em `https://supabase.com` e crie sua conta/projeto.
2. Abra o projeto > **SQL Editor**. Cole o arquivo `supabase.sql` e execute tudo.
3. Em **Authentication > Providers / Sign In**, desative cadastros públicos ("Allow new users to sign up"), para que só os funcionários criados/convidados por você tenham acesso. Ajuste o e-mail de confirmação ou o envio de convites para a configuração de sua empresa.
4. Em **Project Settings > API** ou **Connect**, obtenha **Project URL** e uma **publishable key** (ou a `anon` key legada).
5. Abra `supabase-config.js` e substitua os dois valores `COLE_AQUI_...` pela URL e chave publicável. A chave publicável pode estar no site, pois a segurança está nas políticas de banco. **NUNCA coloque `service_role`, `sb_secret`, senha, chave secreta ou tokens privados no GitHub.**

## 3. Cadastre os usuários

1. Abra **Authentication > Users** no Supabase.
2. Crie ou convide cada funcionário usando um e-mail válido. A conta precisa ter e-mail/senha ativo para entrar (se convidar, o funcionário deve definir sua senha).
3. Copie o **UUID** de cada usuário criado.
4. Abra o SQL Editor e execute o comando abaixo para cada UUID:

```sql
insert into public.crm_members(user_id)
values ('UUID_DO_USUARIO')
on conflict do nothing;
```

Isso inclui também sua própria conta de administrador. Ter conta no Auth, sem estar em `crm_members`, NÃO dá acesso aos dados.

Para remover o acesso, execute `delete from public.crm_members where user_id = 'UUID_DO_USUARIO';` e também invalide/desative a conta no painel de Authentication. A remoção na lista bloqueia o acesso aos registros mesmo se a sessão estiver aberta (as políticas RLS conferem a autorização).

## 4. Prepare o seu repositório GitHub

1. No computador, baixe o repositório **Code > Download ZIP**, ou abra sua cópia local no VS Code.
2. Extraia os arquivos deste pacote **dentro da mesma pasta onde estão `index.html`, `app.js` e `style.css`**.
3. Abra o terminal no VS Code nessa pasta.
4. Execute `py aplicar_multiusuario.py` (Windows), ou `python aplicar_multiusuario.py`.
5. O script gera `app.js.antes-multiusuario.bak` e `index.html.antes-multiusuario.bak` como cópias de segurança. **Não publique os arquivos `.bak`, pois são cópias do código antigo e desnecessárias no site público.**
6. Verifique que `index.html` inclui `supabase-config.js`, a biblioteca Supabase, `multiuser.js` e `multiuser.css`.
7. Envie os arquivos `index.html`, `app.js`, `multiuser.js`, `multiuser.css` e `supabase-config.js` para a branch **main** do GitHub. Pode usar `git add index.html app.js multiuser.js multiuser.css supabase-config.js` seguido de commit e push. NÃO é necessário publicar `supabase.sql` e `aplicar_multiusuario.py`.
8. Aguarde o GitHub Pages publicar a alteração e abra seu site normal.

## 5. Transfira os dados antigos uma única vez

1. Acesse seu site atualizado no **mesmo navegador e computador que possui a base antiga salva no IndexedDB**.
2. Entre com a sua conta autorizada.
3. Se o banco compartilhado estiver vazio e houver base local antiga, aparecerá **Importar base local**.
4. Confirme após salvar um backup JSON.
5. Aguarde a confirmação de conclusão e confira os registros e valores.
6. Somente então entregue o endereço do site a outros funcionários.

**Importante:** importação de base local só aparece em navegador com dados anteriores. Não use as bases locais de outros colaboradores para importar novamente sem uma conferência: elas podem estar diferentes.

## 6. Teste com dois navegadores

1. Entre como usuário A no computador A.
2. Entre como usuário B em outro navegador/computador.
3. No A, altere uma negociação de um cliente.
4. Confira que a alteração aparece no B (sem exportar/importar planilha).
5. Edite **o mesmo** registro quase ao mesmo tempo em A e B: uma gravação deve ser recusada por conflito, sem apagar silenciosamente a outra.
6. Teste também as opções de importação de clientes, vendas, apuração, follow-ups e backup com uma base fictícia antes de usar dados reais.

## Cuidados importantes

* Este pacote foi preparado a partir da versão V36 pública, porém **não pôde ser aplicado diretamente na sua conta GitHub**, porque o repositório não está conectado com permissão de escrita nesta conversa. A instalação e os testes com um banco Supabase real ainda dependem dos passos acima.
* O script de integração confere os trechos do código V36 e **interrompe se não encontrar a versão esperada**, evitando modificar arquivos diferentes às cegas.
* Não faça sincronização de dados reais de clientes enquanto não confirmar as regras de acesso, o contrato de privacidade e a segurança das contas. O repositório pode continuar público, mas as informações comerciais devem estar apenas no banco protegido.
* A atualização ao vivo depende de internet. Se a operação na nuvem falhar, o salvamento NÃO é confirmado; faça backup antes de recarregar.
* Quando duas pessoas editarem o **mesmo** registro simultaneamente, o sistema bloqueia a segunda gravação. Guarde um backup da alteração local e atualize a base para resolver o conflito.
* Importações grandes são enviadas em lotes de 100 registros. Uma interrupção pode deixar uma importação parcialmente concluída; revise antes de tentar novamente.
* O botão de exclusão total foi desativado para evitar a perda da base compartilhada.
* O Supabase impõe limites de uso conforme o plano contratado. Verifique sua necessidade de capacidade, backup e custos antes de colocar toda a equipe.
* As alterações no banco são auditadas, mas ainda é importante habilitar backups regulares e seguir a LGPD.
