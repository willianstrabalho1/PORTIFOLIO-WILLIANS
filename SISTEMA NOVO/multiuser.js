/* Gestor Comercial Panamby — camada multiusuário Supabase.
   Compativel com o formato de dados do app.js V36.
   Credenciais secretas NUNCA devem estar aqui. */
(function () {
  'use strict';
  const FIELDS = ['clientes', 'vendas', 'followups', 'apuracaoLinhas', 'apuracaoMetas', 'pipelineStages'];
  const cfg = window.PANAMBY_SUPABASE || {};
  const EMPTY = () => Object.fromEntries(FIELDS.map(key => [key, []]));
  const copy = data => JSON.parse(JSON.stringify(data));
  let client, activeUser = null, currentRecords = new Map(), hooks = null;
  let tail = Promise.resolve(), activeWrites = 0, scheduledRefresh = false;
  let blocked = false, refreshTimer = null, channel = null, bar = null;
  let remoteEventExpected = false, started = false, importing = false;

  const keyFor = (kind, id) => kind + '\u001f' + String(id);
  function rowId(kind, item, index) {
    if (kind === 'pipelineStages') return String(item.clienteId || item.id || `linha-${index}`);
    if (kind === 'apuracaoLinhas' || kind === 'apuracaoMetas') return String(item.id || `linha-${String(index).padStart(8, '0')}`);
    return String(item.id || item.codigo || item.documento || `linha-${String(index).padStart(8, '0')}`);
  }
  function normalize(data) {
    const result = EMPTY();
    for (const field of FIELDS) result[field] = Array.isArray(data?.[field]) ? data[field] : [];
    return result;
  }
  function flatten(data) {
    const map = new Map();
    for (const kind of FIELDS) {
      normalize(data)[kind].forEach((item, index) => {
        const id = rowId(kind, item, index);
        const k = keyFor(kind, id);
        if (map.has(k)) throw new Error(`Identificador repetido em ${kind}: ${id}`);
        map.set(k, { kind, id, data: item });
      });
    }
    return map;
  }
  function hasAny(data) { return FIELDS.some(f => (data?.[f] || []).length); }
  function renderNotice(message, warning = false) {
    if (!bar) return;
    const status = bar.querySelector('#crm-cloud-status');
    if (status) { status.textContent = message; status.style.color = warning ? '#ffb7a6' : '#c8eadb'; }
  }
  function showGate(errorText = '') {
    return new Promise((resolve, reject) => {
      let gate = document.querySelector('#crm-auth-gate');
      if (!gate) {
        gate = document.createElement('div');
        gate.id = 'crm-auth-gate';
        document.body.appendChild(gate);
      }
      gate.innerHTML = `<div class="crm-login">
        <div class="crm-mark">📈</div><h2>Gestor Comercial Panamby</h2>
        <p>Acesso compartilhado: entre com sua conta autorizada.</p>
        <form id="crm-signin-form">
          <label>E-mail<input type="email" id="crm-email" autocomplete="username" required placeholder="seuemail@empresa.com"></label>
          <label>Senha<input type="password" id="crm-password" autocomplete="current-password" required minlength="6" placeholder="Sua senha"></label>
          <button type="submit" id="crm-signin">Entrar no sistema</button>
          <div id="crm-signin-error" role="alert"></div>
        </form>
        <small>Solicite a criação de sua conta ao responsável pelo sistema.</small>
      </div>`;
      const err = gate.querySelector('#crm-signin-error');
      err.textContent = errorText;
      gate.querySelector('form').addEventListener('submit', async event => {
        event.preventDefault();
        const button = gate.querySelector('#crm-signin');
        button.disabled = true; button.textContent = 'Entrando...'; err.textContent = '';
        try {
          const email = gate.querySelector('#crm-email').value.trim();
          const password = gate.querySelector('#crm-password').value;
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          const user = data?.user;
          if (!(await isAuthorized(user))) {
            await client.auth.signOut();
            throw new Error('Conta ainda não autorizada. Peça ao administrador para adicionar seu usuário.');
          }
          activeUser = user;
          gate.remove();
          resolve(user);
        } catch (e) {
          err.textContent = e.message || 'Não foi possível entrar.';
          button.disabled = false; button.textContent = 'Entrar no sistema';
        }
      });
    });
  }
  async function isAuthorized(user) {
    if (!user?.id) return false;
    const { data, error } = await client.from('crm_members').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return !!data;
  }
  async function ensureAuthorized() {
    if (!client) throw new Error('A biblioteca Supabase não carregou. Verifique a conexão com a internet.');
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (session?.user) {
      try {
        if (await isAuthorized(session.user)) { activeUser = session.user; return activeUser; }
      } catch (e) { console.warn('Falha na verificação de autorização:', e); }
      await client.auth.signOut();
    }
    return showGate();
  }
  async function fetchAll() {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from('crm_records')
        .select('kind,record_id,data,version').order('kind').order('record_id').range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) break;
    }
    const next = new Map(), state = EMPTY();
    for (const row of rows) {
      if (!FIELDS.includes(row.kind)) continue;
      next.set(keyFor(row.kind, row.record_id), { kind: row.kind, id: row.record_id, data: row.data, version: row.version });
      state[row.kind].push(row.data);
    }
    currentRecords = next;
    return state;
  }
  function isModalOpen() { return !!document.querySelector('.modal.open'); }
  function localIsDirty() {
    if (!hooks?.getCurrent) return false;
    try { return buildDiff(hooks.getCurrent()).length > 0; } catch (_) { return true; }
  }
  function refreshButton(show) {
    const el = bar?.querySelector('#crm-refresh-btn');
    if (el) { el.style.display = 'inline-flex'; el.textContent = show ? 'Atualizar alterações' : 'Atualizar'; }
  }
  async function refreshFromCloud(force = false) {
    if (!activeUser || !started) return;
    if (!force && (activeWrites || importing || blocked || isModalOpen() || localIsDirty())) {
      scheduledRefresh = true;
      refreshButton(true);
      renderNotice('Há atualizações no servidor. Clique em Atualizar.', true);
      return;
    }
    try {
      renderNotice('Sincronizando...');
      const fresh = await fetchAll();
      blocked = false; scheduledRefresh = false; refreshButton(false);
      hooks.onUpdate(fresh);
      renderNotice('Sincronizado • online');
    } catch (e) {
      renderNotice('Erro de sincronização: ' + e.message, true);
    }
  }
  function scheduleRefresh() {
    if (!started) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshFromCloud(false), 650);
  }
  function createBar() {
    if (bar) return;
    bar = document.createElement('section');
    bar.id = 'crm-cloud-bar';
    bar.innerHTML = `<div>☁️ <strong>Multiusuário</strong><div id="crm-cloud-status">Conectado</div></div>
      <small id="crm-cloud-email"></small>
      <div class="crm-cloud-actions">
        <button type="button" id="crm-refresh-btn">Atualizar</button>
        <button type="button" id="crm-import-btn" style="display:none">Importar base local</button>
        <button type="button" id="crm-logout-btn">Sair</button>
      </div>`;
    (document.querySelector('aside') || document.body).appendChild(bar);
    bar.querySelector('#crm-refresh-btn').addEventListener('click', async () => {
      if ((blocked || localIsDirty()) && !confirm('Existem alterações locais não sincronizadas. Faça um backup antes de descartá-las. Atualizar mesmo assim?')) return;
      await refreshFromCloud(true);
    });
    bar.querySelector('#crm-import-btn').addEventListener('click', importLegacy);
    bar.querySelector('#crm-logout-btn').addEventListener('click', async () => {
      if (activeWrites || importing || localIsDirty()) {
        alert('Há alterações ainda não enviadas. Aguarde a sincronização ou faça um backup antes de sair.');
        return;
      }
      await client.auth.signOut(); location.reload();
    });
    bar.querySelector('#crm-cloud-email').textContent = activeUser.email || '';
  }
  function buildDiff(state) {
    const local = flatten(state), ops = [];
    for (const [key, prev] of currentRecords) {
      if (!local.has(key)) ops.push({ op: 'delete', kind: prev.kind, id: prev.id, version: prev.version });
    }
    for (const [key, next] of local) {
      const prev = currentRecords.get(key);
      if (!prev) ops.push({ op: 'insert', kind: next.kind, id: next.id, data: next.data, version: 0 });
      else if (JSON.stringify(next.data) !== JSON.stringify(prev.data)) {
        ops.push({ op: 'update', kind: next.kind, id: next.id, data: next.data, version: prev.version });
      }
    }
    return ops;
  }
  async function uploadState(state) {
    if (blocked) throw new Error('Conflito pendente. Faça um backup e atualize os dados do servidor.');
    if (!activeUser) throw new Error('Sessão não autenticada');
    const changes = buildDiff(state);
    if (!changes.length) return true;
    if (changes.length > 150) renderNotice(`Enviando ${changes.length} registros...`);
    for (let i = 0; i < changes.length; i += 100) {
      const batch = changes.slice(i, i + 100);
      const { error } = await client.rpc('apply_crm_changes', { p_changes: batch });
      if (error) throw error;
      for (const change of batch) {
        const key = keyFor(change.kind, change.id);
        if (change.op === 'delete') currentRecords.delete(key);
        else currentRecords.set(key, { kind: change.kind, id: change.id, data: copy(change.data), version: change.version + 1 });
      }
      if (changes.length > 150) renderNotice(`Enviados ${Math.min(i + batch.length, changes.length)}/${changes.length} registros`);
    }
    renderNotice('Salvo • sincronizado');
    return true;
  }
  function alertSaveError(e) {
    if (blocked) return;
    blocked = true; scheduledRefresh = true; refreshButton(true);
    renderNotice('Conflito / falha ao salvar. Salve um backup antes de atualizar.', true);
    console.error('Falha no salvamento multiusuário:', e);
    alert(`Não foi possível salvar na nuvem: ${e.message}\n\nSeu navegador ainda mostra os dados locais. Use “Fazer backup” antes de atualizar a página. Nenhum outro usuário foi sobrescrito.`);
  }
  function persist(state) {
    if (!activeUser) return Promise.reject(new Error('Acesso não autenticado'));
    const snapshot = copy(normalize(state));
    activeWrites++;
    const task = tail.then(() => uploadState(snapshot));
    tail = task.catch(() => {});
    return task.catch(e => { alertSaveError(e); return false; }).finally(() => {
      activeWrites--;
      if (!activeWrites && (scheduledRefresh || remoteEventExpected) && !blocked) {
        remoteEventExpected = false; scheduleRefresh();
      }
    });
  }
  async function offerLegacyImport() {
    if (!hooks?.getLocal) return;
    try {
      const old = await hooks.getLocal();
      if (!hasAny(old)) return;
      if (!currentRecords.size) {
        const button = bar.querySelector('#crm-import-btn');
        button.style.display = 'inline-flex';
        renderNotice('Banco compartilhado vazio. Sua base antiga pode ser importada.');
      }
    } catch (e) { console.warn('Não foi possível localizar a antiga base local:', e); }
  }
  async function importLegacy() {
    if (importing || activeWrites) return;
    if (currentRecords.size) return alert('Importação inicial bloqueada: o banco compartilhado já tem dados. Faça uma exportação e planeje a migração para evitar substituir registros de outros usuários.');
    const old = await hooks.getLocal();
    if (!hasAny(old)) return alert('Nenhum dado local foi encontrado neste navegador.');
    if (!confirm('Enviar todos os dados que estavam salvos neste navegador para o banco compartilhado? Use apenas uma base inicial. Faça backup antes de confirmar.')) return;
    importing = true; bar.querySelector('#crm-import-btn').disabled = true;
    try {
      await uploadState(normalize(old));
      const fresh = await fetchAll();
      hooks.onUpdate(fresh);
      bar.querySelector('#crm-import-btn').style.display = 'none';
      renderNotice('Base importada com sucesso');
    } catch (e) {
      blocked = true;
      alert(`Importação interrompida: ${e.message}\nAlguns lotes podem ter sido enviados. Não repita sem conferir o banco. Os dados originais continuam no seu navegador.`);
      renderNotice('Importação interrompida. Verifique os dados.', true);
    } finally { importing = false; }
  }
  async function load() {
    const url = String(cfg.url || '').trim(), publicKey = String(cfg.publishableKey || '').trim();
    if (!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url) || !publicKey || publicKey.includes('COLE_')) {
      throw new Error('Configure url e publishableKey em supabase-config.js antes de publicar.');
    }
    if (!window.supabase?.createClient) throw new Error('Biblioteca Supabase indisponível. Confira sua internet e o script no index.html.');
    if (!client) {
      client = window.supabase.createClient(url, publicKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    await ensureAuthorized();
    const state = await fetchAll();
    createBar();
    started = true;
    if (channel) client.removeChannel(channel);
    channel = client.channel('panamby-crm-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_records' }, () => {
        if (activeWrites || importing) remoteEventExpected = true;
        else scheduleRefresh();
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') renderNotice('Atualização automática desconectada. Clique em Atualizar.', true);
      });
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && started) location.reload();
    });
    offerLegacyImport();
    return state;
  }
  window.CRMCloud = {
    setup(nextHooks) { hooks = nextHooks; },
    load, persist,
    get busy() { return activeWrites > 0 || importing; }
  };
})();
