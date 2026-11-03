# -*- coding: utf-8 -*-
"""Integra a camada multiusuário ao Gestor Comercial Panamby V36.

Coloque este arquivo e os demais do pacote na mesma pasta de app.js/index.html.
Execute: py aplicar_multiusuario.py (Windows) ou python aplicar_multiusuario.py.
Ele cria arquivos .antes-multiusuario.bak antes de modificar.
"""
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
APP = HERE / 'app.js'
HTML = HERE / 'index.html'
EXPECTED = ['multiuser.js', 'multiuser.css', 'supabase-config.js', 'supabase.sql']


def fail(message):
    print('\nERRO:', message)
    sys.exit(1)


def replace_once(text, old, new, description):
    count = text.count(old)
    if count != 1:
        fail(f'Não encontrei o trecho esperado ({description}). Ocorrências: {count}. Nenhum arquivo foi alterado. Confira a versão do app.js.')
    return text.replace(old, new, 1)


for name in EXPECTED:
    if not (HERE / name).is_file():
        fail(f'Arquivo ausente: {name}')
if not APP.is_file() or not HTML.is_file():
    fail('Coloque TODO o pacote dentro da pasta do repositório, junto com app.js e index.html.')

app = APP.read_text(encoding='utf-8')
html = HTML.read_text(encoding='utf-8')
if 'window.CRMCloud.load()' in app or 'src="multiuser.js"' in html:
    fail('A integração parece já estar instalada. Não aplique duas vezes.')

old_load = 'async function loadDB(){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(STORE,"readonly").objectStore(STORE).get(DB_KEY);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}'
new_load = '''async function loadLocalDB(){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(STORE,"readonly").objectStore(STORE).get(DB_KEY);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
async function loadDB(){return window.CRMCloud.load()}'''
app = replace_once(app, old_load, new_load, 'leitura IndexedDB')

old_persist = 'async function persistDB(){try{normalizeDB();const d=await openDB();await new Promise((res,rej)=>{const t=d.transaction(STORE,"readwrite");t.objectStore(STORE).put(db,DB_KEY);t.oncomplete=res;t.onerror=()=>rej(t.error)});return true}catch(e){alert("Erro ao salvar dados: "+e.message);return false}}'
new_persist = 'async function persistDB(){normalizeDB();return window.CRMCloud.persist(db)}'
app = replace_once(app, old_persist, new_persist, 'gravação IndexedDB')

old_init = 'async function iniciarApp(){try{const saved=await loadDB();if(saved){db=saved;normalizeDB()}const d=new Date(),first=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);$("dashInicio").value=first;$("dashFim").value=today();render();setInterval(checkNotifications,60000)}catch(e){console.error(e);alert("Erro ao iniciar: "+e.message)}}'
new_init = '''async function iniciarApp(){try{
window.CRMCloud.setup({
  getLocal:()=>loadLocalDB(),
  getCurrent:()=>db,
  onUpdate:fresh=>{db=fresh;normalizeDB();invalidatePipeline();render()}
});
const saved=await loadDB();
if(saved){db=saved;normalizeDB()}
const d=new Date(),first=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
$("dashInicio").value=first;$("dashFim").value=today();
render();setInterval(checkNotifications,60000)
}catch(e){console.error(e);alert("Erro ao iniciar o modo multiusuário: "+e.message)}}'''
app = replace_once(app, old_init, new_init, 'inicialização')

# A exclusão completa de uma base agora afeta TODOS os colaboradores.
# Impedimos o botão antigo (a base não é apagada acidentalmente).
old_clear = 'async function limparTudo(){if(!confirm("Apagar todos os dados desta versão?"))return;await clearDB();db={clientes:[],vendas:[],followups:[],apuracaoLinhas:[],apuracaoMetas:[],pipelineStages:[]};invalidatePipeline();render();alert("Sistema zerado.")}'
new_clear = 'async function limparTudo(){alert("A limpeza total foi desativada no modo multiusuário para proteger a base da equipe.")}'
app = replace_once(app, old_clear, new_clear, 'limpar tudo')

if '<script src="app.js"></script>' not in html:
    fail('index.html não possui a referência esperada ao app.js.')
html = html.replace('<script src="app.js"></script>', '''<script src="supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="multiuser.js"></script>
<script src="app.js"></script>''', 1)
if '<link rel="stylesheet" href="style.css">' not in html:
    fail('index.html não possui a referência esperada ao style.css.')
html = html.replace('<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="style.css">\n<link rel="stylesheet" href="multiuser.css">', 1)
html = html.replace('onclick="limparTudo()"', 'disabled title="Desativado para proteger o banco compartilhado"')

for path in (APP, HTML):
    backup = path.with_name(path.name + '.antes-multiusuario.bak')
    if backup.exists():
        fail(f'Backup já existe ({backup.name}). Pare e confira se a integração foi instalada antes.')

for path in (APP, HTML):
    path.with_name(path.name + '.antes-multiusuario.bak').write_bytes(path.read_bytes())
APP.write_text(app, encoding='utf-8')
HTML.write_text(html, encoding='utf-8')
print('\nOK! A integração multiusuário foi inserida em app.js e index.html.')
print('Backups anteriores mantidos como .antes-multiusuario.bak.')
print('PRÓXIMOS PASSOS: executar supabase.sql; preencher supabase-config.js; criar e autorizar usuários; publicar no GitHub.')
print('Leia o arquivo LEIA-ME.md antes de publicar para clientes reais.')
