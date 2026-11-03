console.info("Gestor Comercial Panamby V36 DASHBOARD + PIPELINE SEPARADOS");
const DB_NAME="gestor_comercial_panamby_v33",STORE="app",DB_KEY="principal";
let db={clientes:[],vendas:[],followups:[],apuracaoLinhas:[],apuracaoMetas:[],pipelineStages:[]};

const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const today=()=>new Date().toISOString().slice(0,10);
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const norm=v=>String(v??"").trim().toUpperCase();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function normHeader(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").replace(/\s+/g," ").trim()}
function findCol(h,a){const hs=h.map(normHeader);for(const x of a){const n=normHeader(x),i=hs.findIndex(y=>y===n);if(i>=0)return i}for(const x of a){const n=normHeader(x),i=hs.findIndex(y=>y.includes(n)||n.includes(y));if(i>=0)return i}return-1}
function numBR(v){if(typeof v==="number")return v;let s=String(v??"").trim().replace(/R\$/gi,"").replace(/\s/g,"");if(!s)return 0;if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",",".");else if(s.includes(","))s=s.replace(",",".");return Number(s.replace(/[^0-9.-]/g,""))||0}
function excelDate(v){if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v);return d?`${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`:""}if(!v)return"";const s=String(v).trim(),m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;const d=new Date(s);return isNaN(d)?"":d.toISOString().slice(0,10)}
function brdate(v){if(!v)return"—";const d=new Date(v+"T12:00:00");return isNaN(d)?"—":d.toLocaleDateString("pt-BR")}
function setText(id,v){if($(id))$(id).textContent=v}
function setHTML(id,v){if($(id))$(id).innerHTML=v}
function region(uf){const m={SP:"Sudeste",RJ:"Sudeste",MG:"Sudeste",ES:"Sudeste",PR:"Sul",SC:"Sul",RS:"Sul",BA:"Nordeste",SE:"Nordeste",AL:"Nordeste",PE:"Nordeste",PB:"Nordeste",RN:"Nordeste",CE:"Nordeste",PI:"Nordeste",MA:"Nordeste",GO:"Centro-Oeste",MT:"Centro-Oeste",MS:"Centro-Oeste",DF:"Centro-Oeste",AM:"Norte",PA:"Norte",AC:"Norte",RO:"Norte",RR:"Norte",AP:"Norte",TO:"Norte"};return m[norm(uf)]||"Não informado"}
function inPeriod(d,s,e){return !!d&&(!s||d>=s)&&(!e||d<=e)}
function localizarCabecalho(raw,req,limit=60){for(let i=0;i<Math.min(raw.length,limit);i++){const rr=raw[i].map(normHeader);if(req.every(g=>g.some(a=>rr.some(v=>v===normHeader(a)||v.includes(normHeader(a))))))return i}return-1}
function normalizeDB(){for(const k of ["clientes","vendas","followups","apuracaoLinhas","apuracaoMetas","pipelineStages"])if(!Array.isArray(db[k]))db[k]=[]}

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function loadLocalDB(){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(STORE,"readonly").objectStore(STORE).get(DB_KEY);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
async function loadDB(){return window.CRMCloud.load()}
async function persistDB(){normalizeDB();return window.CRMCloud.persist(db)}
async function clearDB(){const d=await openDB();await new Promise((res,rej)=>{const t=d.transaction(STORE,"readwrite");t.objectStore(STORE).delete(DB_KEY);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
function save(){invalidatePipeline();render();persistDB()}
function getClient(id){return db.clientes.find(c=>c.id===id)}
function findClientCode(code){return db.clientes.find(c=>String(c.codigo)===String(code))}
function findClientRazao(r){const n=norm(r);return db.clientes.find(c=>norm(c.razao)===n)||db.clientes.find(c=>norm(c.razao).includes(n)||n.includes(norm(c.razao)))||null}
function reps(){return [...new Set([...db.clientes,...db.vendas].map(x=>x.representante).filter(Boolean))].sort()}

document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav,.tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab)?.classList.add("active");setText("pageTitle",b.textContent.replace(/^[^\s]+\s/,""))});
setText("todayLabel",new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}));

function fillSelectors(){
 const r=reps(),opts='<option value="">Todos</option>'+r.map(x=>`<option>${esc(x)}</option>`).join("");
 for(const id of ["dashRep","pipeRep"]){const e=$(id);if(e){const cur=e.value;e.innerHTML=opts;e.value=cur}}
 if($("followRep")){const cur=$("followRep").value;$("followRep").innerHTML='<option value="">Todos os representantes</option>'+r.map(x=>`<option>${esc(x)}</option>`).join("");$("followRep").value=cur}

}

let charts={};
function makeChart(id,type,labels,data,label){
 const el=$(id);if(!el||typeof Chart==="undefined")return;
 if(charts[id])charts[id].destroy();
 charts[id]=new Chart(el,{type,data:{labels,datasets:[{label,data,borderWidth:2,tension:.25}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==="pie"}},scales:type==="pie"?{}:{y:{beginAtZero:true}}}});
}

function renderDashboard(){
 const s=$("dashInicio").value,e=$("dashFim").value,rep=$("dashRep").value,reg=$("dashRegiao").value,metric=$("dashMetric").value;
 const arr=db.vendas.filter(v=>inPeriod(v.data,s,e)&&(!rep||norm(v.representante)===norm(rep))&&(!reg||region(v.uf||getClient(v.clienteId)?.uf)===reg));
 const sem=arr.reduce((a,v)=>a+Number(v.valorSemImpostos||0),0),liq=arr.reduce((a,v)=>a+Number(v.valorLiquido||0),0),tot=metric==="liq"?liq:sem;
 setText("kSem",money(sem));setText("kLiq",money(liq));setText("kQtd",arr.length);setText("kTicket",money(arr.length?tot/arr.length:0));
 const regs={},rps={},cls={},days={};
 arr.forEach(v=>{const val=metric==="liq"?Number(v.valorLiquido||0):Number(v.valorSemImpostos||0),rg=region(v.uf||getClient(v.clienteId)?.uf),rp=v.representante||"Sem representante",cl=v.cliente||getClient(v.clienteId)?.razao||"Cliente";regs[rg]=(regs[rg]||0)+val;rps[rp]=(rps[rp]||0)+val;cls[cl]=(cls[cl]||0)+val;days[v.data]=(days[v.data]||0)+val});
 const sr=Object.entries(regs).sort((a,b)=>b[1]-a[1]),sp=Object.entries(rps).sort((a,b)=>b[1]-a[1]),sc=Object.entries(cls).sort((a,b)=>b[1]-a[1]),sd=Object.keys(days).sort();
 setText("kRegiao",sr[0]?.[0]||"—");setText("kRegiaoVal",money(sr[0]?.[1]||0));setText("kRepLider",sp[0]?.[0]||"—");setText("kRepVal",money(sp[0]?.[1]||0));setText("kCli",Object.keys(cls).length);setText("kFollow",db.followups.filter(f=>!f.done).length);
 setText("tickSem",money(sem));setText("tickLiq",money(liq));setText("tickQtd",arr.length);setText("tickTicket",money(arr.length?tot/arr.length:0));setText("tickRegiao",sr[0]?.[0]||"—");setText("tickRep",sp[0]?.[0]||"—");setText("tickFollow",db.followups.filter(f=>!f.done).length);
 makeChart("chartEvolucao","line",sd.map(brdate),sd.map(k=>days[k]),"Valor");makeChart("chartRegiao","bar",sr.map(x=>x[0]),sr.map(x=>x[1]),"Valor");makeChart("chartRep","bar",sp.slice(0,12).map(x=>x[0]),sp.slice(0,12).map(x=>x[1]),"Valor");makeChart("chartPizza","pie",sr.map(x=>x[0]),sr.map(x=>x[1]),"Valor");
 setHTML("topClientes",sc.slice(0,10).map((x,i)=>`<div class="rankline"><span>${i+1}. ${esc(x[0])}</span><b>${money(x[1])}</b></div>`).join("")||'<p class="muted">Sem vendas no período.</p>');
 const metas=(db.apuracaoMetas||[]).map(x=>({...x,pct:Number(x.meta)?Number(x.vrAtingido)/Number(x.meta)*100:0,falta:Math.max(Number(x.meta||0)-Number(x.vrAtingido||0),0)})).sort((a,b)=>Number(b.vrAtingido)-Number(a.vrAtingido));
 setHTML("repRanking",metas.slice(0,10).map((x,i)=>`<div class="barrow"><div class="barlabel"><b>${i+1}. ${esc(x.razaoSocial||x.representante||"—")}</b><span>${x.pct.toFixed(1)}%</span></div><div class="muted">Vendido ${money(x.vrAtingido)} • Meta ${money(x.meta)} • Falta ${money(x.falta)}</div><div class="bartrack"><div class="barfill" style="width:${Math.min(x.pct,100)}%"></div></div></div>`).join("")||'<p class="muted">Importe APURAÇÃO DE VENDAS.xls.</p>');
}

function renderClientes(){
 const q=norm($("buscaCliente").value),dias=Number($("filtroDias").value||0);
 const arr=db.clientes.filter(c=>(!q||norm([c.codigo,c.razao,c.cnpj,c.cidade,c.uf,c.representante,c.tel1,c.tel2].join(" ")).includes(q))&&(!dias||Number(c.dias)>=dias)).slice(0,500);
 setHTML("clientesList",arr.map(c=>`<div class="client"><div class="toprow"><div><h3>${esc(c.codigo)} — ${esc(c.razao)}</h3><div class="muted">${esc(c.cidade)}/${esc(c.uf)} • ${esc(c.representante||"Sem representante")}</div></div><b>${Number(c.dias||0)} dias</b></div><div class="muted">Última compra: ${brdate(c.ultima)} • ${money(c.valor)}<br>☎ ${esc(c.tel1||"")} ${c.tel2?" | "+esc(c.tel2):""}</div><div class="actions"><button onclick="openFollow('${c.id}')">📞 Follow-up</button>${c.tel1||c.tel2?`<button class="whatsbtn" onclick="openWhats('${c.id}')">💬 WhatsApp</button>`:""}</div></div>`).join("")||'<div class="card muted">Nenhum cliente.</div>');
}







let pipelineCache=null,pipelineVersion=0,pipelineCacheVersion=-1,pipePage=0,pipeSearchTimer=null;
const PIPE_PAGE_SIZE=60;
function invalidatePipeline(){pipelineVersion++;pipelineCache=null}

function getStageRecord(clienteId){return (db.pipelineStages||[]).find(x=>x.clienteId===clienteId)||null}
function updateStageRecord(clienteId,patch){
 let x=getStageRecord(clienteId);
 if(!x){x={clienteId,stage:"Contato",updatedAt:new Date().toISOString()};db.pipelineStages.push(x)}
 Object.assign(x,patch,{updatedAt:new Date().toISOString()});invalidatePipeline();return x;
}
function getNegotiation(clienteId){
 const x=getStageRecord(clienteId)||{};
 return {valorNegociado:Number(x.valorNegociado||0),ordemCompra:x.ordemCompra||"",previsaoFechamento:x.previsaoFechamento||"",statusNegociacao:x.statusNegociacao||"Em negociação",observacaoNegociacao:x.observacaoNegociacao||""};
}
function nextFollowForClient(clienteId){
 return (db.followups||[]).filter(f=>f.clienteId===clienteId&&!f.done&&f.data).sort((a,b)=>`${a.data} ${a.hora||"09:00"}`.localeCompare(`${b.data} ${b.hora||"09:00"}`))[0]||null;
}
function stageMap(){return new Map((db.pipelineStages||[]).map(x=>[x.clienteId,x.stage]))}
function getStage(id){return stageMap().get(id)||"Contato"}
function setStage(id,stage){
 let x=db.pipelineStages.find(x=>x.clienteId===id);
 if(x){x.stage=stage;x.updatedAt=new Date().toISOString()}
 else db.pipelineStages.push({clienteId:id,stage,updatedAt:new Date().toISOString()});
 invalidatePipeline();
}
function pipelineBase(){
 if(pipelineCache&&pipelineCacheVersion===pipelineVersion)return pipelineCache;

 const sm=stageMap(),lastSale=new Map();

 for(const v of db.vendas){
   const key=v.clienteId || String(v.codigoCliente||"");
   const old=lastSale.get(key);
   if(!old||String(v.data||"")>String(old.data||""))lastSale.set(key,v);
 }

 pipelineCache=db.clientes.map(c=>{
   const s=sm.get(c.id)||"Contato";
   const v=lastSale.get(c.id)||lastSale.get(String(c.codigo||""));
   const n=getNegotiation(c.id);
   const f=nextFollowForClient(c.id);

   let valorPipeline=Number(c.valor||0);

   if(s==="Negociação"){
     valorPipeline=Number(n.valorNegociado||0);
   }else if(s==="Venda"){
     const valorVenda=Number(v?.valorSemImpostos||0);
     const valorNegociado=Number(n.valorNegociado||0);
     valorPipeline=valorVenda>0?valorVenda:(valorNegociado>0?valorNegociado:Number(c.valor||0));
   }

   return {
     ...c,
     stage:s,
     valorPipeline,
     neg:n,
     nextFollow:f,
     search:norm([
       c.codigo,c.razao,c.representante,c.cidade,c.uf,c.tel1,c.tel2,
       n.ordemCompra,n.statusNegociacao,n.observacaoNegociacao,f?.texto
     ].join(" "))
   };
 });

 pipelineCacheVersion=pipelineVersion;
 return pipelineCache;
}
function pipelineFiltered(){
 const rep=$("pipeRep").value,q=norm($("pipeBusca").value||""),sort=$("pipeSort").value;
 const arr=pipelineBase().filter(c=>(!rep||norm(c.representante)===norm(rep))&&(!q||c.search.includes(q)));
 const sorter=(a,b)=>sort==="valor"?b.valorPipeline-a.valorPipeline:sort==="nome"?String(a.razao).localeCompare(String(b.razao),"pt-BR"):sort==="ultima"?String(b.ultima||"").localeCompare(String(a.ultima||"")):Number(b.dias||0)-Number(a.dias||0);
 return arr.sort(sorter);
}

function openNegotiation(clienteId){
 const c=getClient(clienteId);if(!c)return alert("Cliente não encontrado.");
 const n=getNegotiation(clienteId);
 $("negClienteId").value=clienteId;
 $("negClienteResumo").innerHTML=`<b>${esc(c.codigo)} — ${esc(c.razao)}</b><br>${esc(c.representante||"")} • ${esc(c.cidade||"")}/${esc(c.uf||"")}`;
 $("negValor").value=n.valorNegociado||"";$("negOC").value=n.ordemCompra||"";$("negPrevisao").value=n.previsaoFechamento||"";$("negStatus").value=n.statusNegociacao||"Em negociação";$("negObs").value=n.observacaoNegociacao||"";
 $("negModal").classList.add("open");
}
function saveNegotiation(){
 const id=$("negClienteId").value;if(!id)return alert("Cliente não selecionado.");
 updateStageRecord(id,{stage:"Negociação",valorNegociado:Number($("negValor").value||0),ordemCompra:$("negOC").value.trim(),previsaoFechamento:$("negPrevisao").value,statusNegociacao:$("negStatus").value,observacaoNegociacao:$("negObs").value.trim()});
 closeModal("negModal");save();
}
function pipeCard(c){
 const followHtml=c.stage==="Follow-up"&&c.nextFollow
   ?`<div class="pipe-stage-box follow-box">
       <div><b>🔔 Próximo alerta / retorno</b></div>
       <div>${brdate(c.nextFollow.data)} às ${esc(c.nextFollow.hora||"09:00")}</div>
       <div class="pipe-small">${esc(c.nextFollow.tipo||"Ligação")} • ${esc(c.nextFollow.texto||"")}</div>
     </div>`
   :"";

 const negHtml=c.stage==="Negociação"
   ?`<div class="pipe-stage-box neg-box">
       <div class="pipe-neg-row"><span>💰 Valor negociado</span><b>${money(c.neg?.valorNegociado||0)}</b></div>
       <div class="pipe-neg-row"><span>📄 Ordem de compra</span><b>${esc(c.neg?.ordemCompra||"—")}</b></div>
       <div class="pipe-neg-row"><span>📅 Previsão</span><b>${brdate(c.neg?.previsaoFechamento)}</b></div>
       <div class="pipe-neg-row"><span>📌 Status</span><b>${esc(c.neg?.statusNegociacao||"Em negociação")}</b></div>
       ${c.neg?.observacaoNegociacao?`<div class="pipe-neg-obs">📝 ${esc(c.neg.observacaoNegociacao)}</div>`:""}
     </div>`
   :"";

 const saleValue=c.stage==="Venda"?getPipelineSaleValue(c):0;
 const saleHtml=c.stage==="Venda"
   ?`<div class="pipe-stage-box sale-box">
       <div class="pipe-neg-row"><span>💰 Valor fechado</span><b>${money(saleValue)}</b></div>
       <div class="pipe-neg-row"><span>📄 Ordem de compra</span><b>${esc(c.neg?.ordemCompra||"—")}</b></div>
       <div class="pipe-neg-row"><span>✅ Situação</span><b>Venda concluída</b></div>
     </div>`
   :"";

 return `<div class="pipe-card" data-cliente-id="${c.id}">
   <div class="pipe-card-top">
     <div class="pipe-title">
       <b>${esc(c.razao)}</b>
       <small>${esc(c.codigo)}</small>
     </div>
     <span class="pipe-value">${money(c.stage==="Venda"?saleValue:c.valorPipeline)}</span>
   </div>

   <div class="pipe-meta">
     <span>👔 ${esc(c.representante||"Sem representante")}</span>
     <span>📍 ${esc(c.cidade||"")}/${esc(c.uf||"")}</span>
   </div>

   <div class="pipe-highlight">
     <span class="${Number(c.dias)>=90?"late":Number(c.dias)>=30?"warn":""}">⏳ ${Number(c.dias||0)} dias</span>
     <span>🛒 ${brdate(c.ultima)}</span>
   </div>

   ${followHtml}${negHtml}${saleHtml}

   <div class="pipe-bottom">
     <button class="details-btn" onclick="togglePipeDetails(this)">Ver detalhes</button>
     <div class="pipe-actions">
       ${c.tel1||c.tel2?`<button class="pipe-icon whatsbtn" onclick="openWhats('${c.id}')" title="WhatsApp">💬</button>`:""}
       <button class="pipe-icon" onclick="openFollow('${c.id}')" title="Follow-up / retorno">📞</button>
       ${c.stage==="Negociação"?`<button class="pipe-icon negbtn" onclick="openNegotiation('${c.id}')" title="Editar negociação">✏️</button>`:""}
       ${c.stage==="Venda"&&Number(c.neg?.valorNegociado||0)>0?`<button class="pipe-icon negbtn" onclick="openNegotiation('${c.id}')" title="Ver negociação">📄</button>`:""}
     </div>
   </div>

   <div class="pipe-extra">
     Última compra: ${money(c.valor)}<br>
     Telefone: ${esc(c.tel1||c.tel2||"—")}<br>
     Etapa: ${esc(c.stage)}
   </div>
 </div>`;
}
function togglePipeDetails(btn){const c=btn.closest(".pipe-card");c.classList.toggle("show-extra");btn.textContent=c.classList.contains("show-extra")?"Ocultar":"Ver detalhes"}


function getPipelineSaleValue(cliente){
 if(!cliente)return 0;
 const negotiated=Number(getNegotiation(cliente.id)?.valorNegociado||0);
 if(negotiated>0)return negotiated;
 return Number(cliente.valorPipeline||cliente.valor||0);
}

function renderPipelineSalesSummary(groups){
 const follows=Array.isArray(groups?.["Follow-up"])?groups["Follow-up"]:[];
 const negs=Array.isArray(groups?.Negociação)?groups.Negociação:[];
 const vendas=Array.isArray(groups?.Venda)?groups.Venda:[];
 const total=vendas.reduce((sum,c)=>sum+getPipelineSaleValue(c),0);
 const trabalhados=follows.length+negs.length+vendas.length;
 const conversao=trabalhados?(vendas.length/trabalhados)*100:0;
 setText("pipelineSalesValue",money(total));
 setText("pipelineSalesCount",`${vendas.length} venda(s) concluída(s)`);
 setText("pipelineConversion",`${conversao.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}%`);
}

function renderNegotiationSummary(groups){
 const negs=Array.isArray(groups?.Negociação)?groups.Negociação:[];
 const vendasPipe=Array.isArray(groups?.Venda)?groups.Venda:[];
 const total=negs.reduce((sum,c)=>sum+Number(getNegotiation(c.id).valorNegociado||0),0);
 const qtd=negs.length, ticket=qtd?total/qtd:0;
 const porRepNeg={};
 negs.forEach(c=>{
   const rep=c.representante||"Sem representante";
   porRepNeg[rep]=(porRepNeg[rep]||0)+Number(getNegotiation(c.id).valorNegociado||0);
 });
 const repNeg=Object.entries(porRepNeg).sort((a,b)=>b[1]-a[1])[0];
 const porRepVendaPipe={};
 vendasPipe.forEach(c=>{
   const rep=c.representante||"Sem representante";
   porRepVendaPipe[rep]=(porRepVendaPipe[rep]||0)+getPipelineSaleValue(c);
 });
 const repVendaPipe=Object.entries(porRepVendaPipe).sort((a,b)=>b[1]-a[1])[0];
 setText("negTotalValor",money(total)); setText("negTotalQtd",qtd); setText("negTicketMedio",money(ticket));
 setText("negRepLider",repNeg?.[0]||"—"); setText("negRepLiderValor",money(repNeg?.[1]||0));
 setText("vendaRepLiderPipe",repVendaPipe?.[0]||"—"); setText("vendaRepLiderPipeValor",money(repVendaPipe?.[1]||0));
}

function renderPipeline(){
 const arr=pipelineFiltered(),groups={Contato:[], "Follow-up":[],Negociação:[],Venda:[]};
 arr.forEach(c=>groups[c.stage]?.push(c));
 const max=Math.max(1,Math.ceil(groups.Contato.length/PIPE_PAGE_SIZE));if(pipePage>=max)pipePage=max-1;
 const visibleContact=groups.Contato.slice(pipePage*PIPE_PAGE_SIZE,(pipePage+1)*PIPE_PAGE_SIZE);
 setHTML("pipeContato",visibleContact.map(pipeCard).join("")||'<div class="muted">Sem clientes</div>');
 setHTML("pipeFollow",groups["Follow-up"].slice(0,60).map(pipeCard).join("")||'<div class="muted">Sem clientes</div>');
 setHTML("pipeNegociacao",groups.Negociação.slice(0,60).map(pipeCard).join("")||'<div class="muted">Sem clientes</div>');
 setHTML("pipeVenda",groups.Venda.slice(0,60).map(pipeCard).join("")||'<div class="muted">Sem clientes</div>');
 setText("countContato",groups.Contato.length);setText("countFollow",groups["Follow-up"].length);setText("countNegociacao",groups.Negociação.length);setText("countVenda",groups.Venda.length);
 setText("pipeQtd",arr.length);setText("pipeFollowQtd",groups["Follow-up"].length);setText("pipeNegQtd",groups.Negociação.length);setText("pipeVendaQtd",groups.Venda.length);setText("pipePageInfo",`Página ${pipePage+1} de ${max} • ${groups.Contato.length.toLocaleString("pt-BR")} em Contato`);
 renderNegotiationSummary(groups);
 renderPipelineSalesSummary(groups);
 initPipelineDrag();
}
function prevPipelinePage(){if(pipePage>0){pipePage--;renderPipeline()}}
function nextPipelinePage(){const max=Math.max(1,Math.ceil(pipelineFiltered().filter(c=>c.stage==="Contato").length/PIPE_PAGE_SIZE));if(pipePage<max-1){pipePage++;renderPipeline()}}
function schedulePipeline(){clearTimeout(pipeSearchTimer);pipeSearchTimer=setTimeout(()=>{pipePage=0;renderPipeline()},250)}

let drag=null;
function initPipelineDrag(){
 const board=document.querySelector(".pipeline-board");if(!board||board.dataset.ready==="1")return;board.dataset.ready="1";
 board.addEventListener("pointerdown",e=>{if(e.target.closest("button,input,select,textarea,a"))return;const card=e.target.closest(".pipe-card");if(!card)return;drag={id:card.dataset.clienteId,card,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false,ghost:null,target:null};card.setPointerCapture?.(e.pointerId)});
 board.addEventListener("pointermove",e=>{if(!drag||drag.pointerId!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.active&&Math.hypot(dx,dy)<7)return;if(!drag.active){drag.active=true;drag.card.classList.add("dragging-real");const g=drag.card.cloneNode(true);g.classList.add("pipe-ghost");g.style.width=drag.card.getBoundingClientRect().width+"px";document.body.appendChild(g);drag.ghost=g}e.preventDefault();drag.ghost.style.left=e.clientX+12+"px";drag.ghost.style.top=e.clientY+12+"px";drag.ghost.style.display="none";const el=document.elementFromPoint(e.clientX,e.clientY);drag.ghost.style.display="block";const col=el?.closest?.(".pipe-column");document.querySelectorAll(".pipe-column").forEach(x=>x.classList.remove("drag-over"));if(col){col.classList.add("drag-over");drag.target=col}else drag.target=null});
 const finish=e=>{if(!drag)return;const d=drag;drag=null;d.card?.classList.remove("dragging-real");d.ghost?.remove();document.querySelectorAll(".pipe-column").forEach(x=>x.classList.remove("drag-over"));if(!d.active||!d.target)return;const stage=d.target.dataset.stage;if(stage==="Venda"){updateStageRecord(d.id,{stage:"Venda",dataFechamento:today()});save();return}if(stage==="Negociação"){setStage(d.id,"Negociação");save();openNegotiation(d.id);return}setStage(d.id,stage);if(stage==="Follow-up")openFollow(d.id);save()};
 board.addEventListener("pointerup",finish);board.addEventListener("pointercancel",finish);
}


let activityTypeFilter="";
let activityPeriodFilter="open";
function startOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
function activityDateTime(f){return new Date(`${f.data}T${f.hora||"09:00"}:00`)}
function dateOnlyStr(d){return d.toISOString().slice(0,10)}
function mondayOf(d){const x=startOfDay(d),day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return x}
function inActivityPeriod(f,period){
 const dt=startOfDay(activityDateTime(f)),now=startOfDay(new Date()),tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);
 const ws=mondayOf(now),we=new Date(ws);we.setDate(we.getDate()+7);const nws=new Date(we),nwe=new Date(nws);nwe.setDate(nwe.getDate()+7);
 if(period==="all")return true;if(period==="open")return !f.done;if(period==="overdue")return !f.done&&dt<now;
 if(period==="today")return dt.getTime()===now.getTime();if(period==="tomorrow")return dt.getTime()===tomorrow.getTime();
 if(period==="week")return dt>=ws&&dt<we;if(period==="nextweek")return dt>=nws&&dt<nwe;return true;
}
function setActivityTypeFilter(btn,type){activityTypeFilter=type;document.querySelectorAll(".act-type").forEach(x=>x.classList.remove("active"));btn.classList.add("active");followPage=0;renderFollow()}
function setActivityPeriod(btn,period){activityPeriodFilter=period;document.querySelectorAll(".period-tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");followPage=0;renderFollow()}
function openActivityNew(){
 const rep=$("followRep")?.value||"",q=norm($("followClienteBusca")?.value||"");
 const c=(db.clientes||[]).find(x=>(!rep||norm(x.representante)===norm(rep))&&(!q||norm([x.codigo,x.razao,x.cidade,x.uf,x.tel1,x.tel2].join(" ")).includes(q)));
 if(!c)return alert("Selecione um representante ou pesquise um cliente para criar a atividade.");
 openFollowV26(c.id);
}

function onAssuntoChange(){
 const sel=$("fAssunto");
 const wrap=$("fTextoWrap");
 const txt=$("fTexto");
 if(!sel||!wrap||!txt)return;
 const custom=sel.value==="__OUTRO__";
 wrap.classList.toggle("show-custom",custom);
 if(!custom)txt.value=sel.value||"";
 else if(txt.value==="__OUTRO__")txt.value="";
}
function setFollowSubject(value){
 const sel=$("fAssunto"),txt=$("fTexto"),wrap=$("fTextoWrap");
 if(!sel||!txt||!wrap)return;
 const options=[...sel.options].map(o=>o.value);
 if(value && options.includes(value) && value!=="__OUTRO__"){
   sel.value=value;
   txt.value=value;
   wrap.classList.remove("show-custom");
 }else if(value){
   sel.value="__OUTRO__";
   txt.value=value;
   wrap.classList.add("show-custom");
 }else{
   sel.value="";
   txt.value="";
   wrap.classList.remove("show-custom");
 }
}
function getFollowSubject(){
 const sel=$("fAssunto"),txt=$("fTexto");
 if(!sel)return (txt?.value||"").trim();
 if(sel.value==="__OUTRO__")return (txt?.value||"").trim();
 return sel.value.trim();
}

function openFollowV26(id,activityId=""){
 const c=getClient(id);if(!c)return;
 const f=activityId?db.followups.find(x=>x.id===activityId):null;

 $("fId").value=f?.id||"";
 $("fClienteId").value=c.id;
 $("fClienteResumo").innerHTML=`<b>${esc(c.codigo)} — ${esc(c.razao)}</b><br>${esc(c.representante||"")} • ${esc(c.cidade||"")}/${esc(c.uf||"")}<br>☎ ${esc(c.tel1||c.tel2||"Sem telefone")}`;
 setText("followModalTitle",f?"✏️ Editar follow-up":"📞 Nova conversa / follow-up");

 $("fTipo").value=f?.tipo||"Ligação";
 $("fInicioData").value=f?.inicioData||f?.dataCriacao||today();

 if(f){
   $("fData").value=f.data||today();
 }else{
   const d=new Date();
   d.setDate(d.getDate()+2);
   $("fData").value=d.toISOString().slice(0,10);
 }

 $("fHora").value=f?.hora||"09:00";
 setFollowSubject(f?.texto||"");
 $("fPrioridade").value=f?.prioridade||"Normal";
 $("fResultado").value=f?.resultado||"";
 $("fStatusNovo").value=f?.done?"concluido":"pendente";
 $("followModal").classList.add("open");
}
function saveFollowV26(){
 const id=$("fClienteId").value;
 const inicioData=$("fInicioData").value;
 const data=$("fData").value;
 const hora=$("fHora").value||"09:00";
 const texto=getFollowSubject();

 if(!id||!inicioData||!data||!texto)
   return alert("Preencha cliente, data da conversa, data do alerta e assunto.");

 const editId=$("fId").value;
 const payload={
   clienteId:id,
   tipo:$("fTipo").value||"Ligação",
   inicioData,
   data,
   hora,
   texto,
   prioridade:$("fPrioridade").value||"Normal",
   resultado:$("fResultado").value||"",
   done:$("fStatusNovo").value==="concluido",
   notified:false,
   origem:"Manual"
 };

 if(editId){
   const idx=db.followups.findIndex(x=>x.id===editId);
   if(idx>=0)db.followups[idx]={...db.followups[idx],...payload};
 }else{
   db.followups.push({id:uid(),criadoEm:new Date().toISOString(),...payload});
 }

 setStage(id,"Follow-up");
 closeModal("followModal");
 save();
}

function scheduleNextReturn(activityId){
 const old=db.followups.find(x=>x.id===activityId);if(!old)return;
 const c=getClient(old.clienteId);if(!c)return;

 $("fId").value="";
 $("fClienteId").value=c.id;
 $("fClienteResumo").innerHTML=`<b>${esc(c.codigo)} — ${esc(c.razao)}</b><br>${esc(c.representante||"")} • ${esc(c.cidade||"")}/${esc(c.uf||"")}<br>☎ ${esc(c.tel1||c.tel2||"Sem telefone")}`;
 setText("followModalTitle","🔁 Agendar próximo retorno");

 $("fTipo").value=old.tipo||"Ligação";
 $("fInicioData").value=today();

 const d=new Date();
 d.setDate(d.getDate()+2);
 $("fData").value=d.toISOString().slice(0,10);

 $("fHora").value=old.hora||"09:00";
 setFollowSubject(old.texto||"Retornar contato");
 $("fPrioridade").value=old.prioridade||"Normal";
 $("fResultado").value="";
 $("fStatusNovo").value="pendente";
 $("followModal").classList.add("open");
}
function deleteFollow(id){const f=db.followups.find(x=>x.id===id);if(!f||!confirm("Excluir esta atividade?"))return;db.followups=db.followups.filter(x=>x.id!==id);save()}

const FOLLOW_PAGE_SIZE=40;let followPage=0;

function followFilteredClients(){
 const rep=$("followRep")?.value||"",q=norm($("followClienteBusca")?.value||"");
 return db.clientes.filter(c=>(!rep||norm(c.representante)===norm(rep))&&(!q||norm([c.codigo,c.razao,c.cidade,c.uf,c.tel1,c.tel2].join(" ")).includes(q)));
}

function pipelineStageLabel(stage){
 return stage==="Venda"?"Venda concluída":stage||"Contato";
}
function pipelineStageClass(stage){
 return stage==="Venda"?"sale":stage==="Negociação"?"neg":stage==="Follow-up"?"follow":"contact";
}
function changeActivityStage(clienteId,stage){
 if(stage==="Venda"){
   updateStageRecord(clienteId,{stage:"Venda",dataFechamento:today()});
 }else{
   setStage(clienteId,stage);
 }
 save();
}

function followDue(f){
 if(!f || f.done)return false;
 if(!f.data)return false;

 const hora=f.hora||"09:00";
 const dt=new Date(`${f.data}T${hora}:00`);

 if(isNaN(dt.getTime()))return false;

 return dt<=new Date();
}

function activityFiltered(){
 const rep=$("followRep")?.value||"",
       q=norm($("followClienteBusca")?.value||""),
       priority=$("activityPriority")?.value||"",
       status=$("statusFollow")?.value||"",
       stageFilter=$("activityStage")?.value||"";

 return db.followups.filter(f=>{
   const c=getClient(f.clienteId);
   if(!c)return false;

   const stage=getStage(c.id);

   if(rep&&norm(c.representante)!==norm(rep))return false;
   if(stageFilter&&stage!==stageFilter)return false;
   if(q&&!norm([c.codigo,c.razao,c.cidade,c.uf,c.tel1,c.tel2,f.texto,f.tipo,f.resultado,pipelineStageLabel(stage)].join(" ")).includes(q))return false;
   if(activityTypeFilter&&f.tipo!==activityTypeFilter)return false;
   if(priority&&f.prioridade!==priority)return false;
   if(status==="pendente"&&f.done)return false;
   if(status==="concluido"&&!f.done)return false;
   if(!inActivityPeriod(f,activityPeriodFilter))return false;
   return true;
 });
}
function renderFollow(){
 const clientes=followFilteredClients();
 const acts=activityFiltered().sort((a,b)=>a.done!==b.done?(a.done?1:-1):`${a.data} ${a.hora||"09:00"}`.localeCompare(`${b.data} ${b.hora||"09:00"}`));

 const pages=Math.max(1,Math.ceil(acts.length/FOLLOW_PAGE_SIZE));
 if(followPage>=pages)followPage=pages-1;
 if(followPage<0)followPage=0;

 const pg=acts.slice(followPage*FOLLOW_PAGE_SIZE,(followPage+1)*FOLLOW_PAGE_SIZE);
 const now=startOfDay(new Date()),todayStr=dateOnlyStr(now);

 setText("fQtdPend",db.followups.filter(f=>!f.done).length);
 setText("fQtdVenc",db.followups.filter(f=>!f.done&&startOfDay(activityDateTime(f))<now).length);
 setText("fQtdHoje",db.followups.filter(f=>f.data===todayStr&&!f.done).length);
 setText("fQtdConcl",db.followups.filter(f=>f.done).length);
 setText("fQtdStageFollow",db.clientes.filter(c=>getStage(c.id)==="Follow-up").length);
 setText("fQtdStageNeg",db.clientes.filter(c=>getStage(c.id)==="Negociação").length);
 setText("followPageInfo",`Página ${followPage+1} de ${pages} • ${acts.length} atividade(s)`);

 setHTML("activityBody",pg.map(f=>{
   const c=getClient(f.clienteId),
         due=followDue(f),
         status=f.done?"Concluído":due?"Vencido":"Agendado",
         sc=f.done?"ok":due?"no":"near",
         icon=f.tipo==="WhatsApp"?"💬":f.tipo==="E-mail"?"📧":f.tipo==="Reunião"?"🤝":f.tipo==="Tarefa"?"📋":"📞",
         stage=getStage(f.clienteId),
         inicio=f.inicioData||f.dataCriacao||f.data;

   return `<tr class="${due&&!f.done?"activity-overdue":""}">
     <td><input class="activity-check" type="checkbox" ${f.done?"checked":""} onchange="toggleFollow('${f.id}')"></td>
     <td><span class="activity-type-pill">${icon} ${esc(f.tipo||"Ligação")}</span></td>
     <td><b>${esc(f.texto)}</b></td>
     <td><div class="table-main">${esc(c?.razao||"Cliente")}</div><div class="table-sub">${esc(c?.codigo||"")}</div></td>
     <td>${esc(c?.representante||"—")}</td>
     <td>
       <select class="stage-select stage-${pipelineStageClass(stage)}" onchange="changeActivityStage('${f.clienteId}',this.value)">
         <option ${stage==="Contato"?"selected":""}>Contato</option>
         <option ${stage==="Follow-up"?"selected":""}>Follow-up</option>
         <option ${stage==="Negociação"?"selected":""}>Negociação</option>
         <option value="Venda" ${stage==="Venda"?"selected":""}>Venda concluída</option>
       </select>
     </td>
     <td><span class="priority ${norm(f.prioridade)==="URGENTE"?"urgent":norm(f.prioridade)==="IMPORTANTE"?"important":"normal"}">${esc(f.prioridade||"Normal")}</span></td>
     <td>${esc(f.resultado||"—")}</td>
     <td>${esc(c?.tel1||c?.tel2||"—")}</td>
     <td>${esc(c?.cidade||"")}${c?.uf?"/"+esc(c.uf):""}</td>
     <td>
       <div class="return-cell ${due&&!f.done?"return-due":""}">
         <span class="conversation-date">💬 Conversa: <b>${brdate(inicio)}</b></span>
         <span class="alert-date">🔔 Alerta: <b>${brdate(f.data)} às ${esc(f.hora||"09:00")}</b></span>
       </div>
     </td>
     <td><span class="pill ${sc}">${status}</span></td>
     <td>
       <div class="row-actions">
         ${c&&(c.tel1||c.tel2)?`<button class="mini-btn whatsbtn" onclick="openWhats('${c.id}')">💬</button>`:""}
         <button class="mini-btn" onclick="openFollowV26('${f.clienteId}','${f.id}')">✏️</button>
         <button class="mini-btn returnbtn" onclick="scheduleNextReturn('${f.id}')" title="Agendar próximo retorno">🔁</button>
         ${stage==="Negociação"?`<button class="mini-btn negbtn" onclick="openNegotiation('${f.clienteId}')">🤝</button>`:""}
         <button class="mini-btn deletebtn" onclick="deleteFollow('${f.id}')">🗑️</button>
       </div>
     </td>
   </tr>`;
 }).join("")||'<tr><td colspan="13" class="empty-row">Nenhuma atividade encontrada.</td></tr>');
}

function prevFollowPage(){if(followPage>0){followPage--;renderFollow()}}
function nextFollowPage(){const max=Math.max(0,Math.ceil(activityFiltered().length/FOLLOW_PAGE_SIZE)-1);if(followPage<max){followPage++;renderFollow()}}


function cleanPhone(v){let n=String(v||"").replace(/\D/g,"");if(!n)return"";if(n.startsWith("55")&&n.length>=12)return n;if(n.length===10||n.length===11)return"55"+n;return n}
function openWhats(id){const c=getClient(id),phones=[c?.tel1,c?.tel2].filter(Boolean);if(!phones.length)return alert("Cliente sem telefone.");$("wClienteId").value=id;$("wClienteNome").innerHTML=`<b>${esc(c.codigo)} — ${esc(c.razao)}</b>`;$("wTelefone").innerHTML=phones.map((p,i)=>`<option value="${cleanPhone(p)}">Telefone ${i+1}: ${esc(p)}</option>`).join("");$("wModelo").value="follow";aplicarModeloWhats();$("whatsModal").classList.add("open")}
function aplicarModeloWhats(){const m={follow:"Olá! Tudo bem? Estou entrando em contato para dar continuidade ao nosso atendimento comercial. Posso te ajudar em algo hoje?",parado:"Olá! Tudo bem? Percebi que faz um tempo desde a última compra. Posso ajudar com alguma reposição?",catalogo:"Olá! Tudo bem? Temos novidades no catálogo. Posso te enviar?",personalizada:""};$("wMsg").value=m[$("wModelo").value]||""}
function abrirWhatsApp(){window.open(`https://wa.me/${$("wTelefone").value}?text=${encodeURIComponent($("wMsg").value)}`,"_blank")}

function renderApuracao(){
 const q=norm($("buscaApuracao").value),sup=$("filtroSupervisor").value,at=$("filtroAtingido").value;
 const arr=db.apuracaoLinhas.map(x=>({...x,pct:Number(x.meta)?Number(x.vrAtingido)/Number(x.meta)*100:0,falta:Math.max(Number(x.meta||0)-Number(x.vrAtingido||0),0)})).filter(x=>(!q||norm([x.representante,x.razaoSocial,x.supervisor].join(" ")).includes(q))&&(!sup||x.supervisor===sup)&&(!at||x.atingido===at));
 const mt=db.apuracaoMetas.reduce((s,x)=>s+Number(x.meta||0),0),va=db.apuracaoMetas.reduce((s,x)=>s+Number(x.vrAtingido||0),0),qtd=db.apuracaoMetas.filter(x=>Number(x.meta)>0&&Number(x.vrAtingido)>=Number(x.meta)).length;
 setText("aMetaTotal",money(mt));setText("aAtingidoTotal",money(va));setText("aFaltaTotal",money(Math.max(mt-va,0)));setText("aQtdMeta",qtd);setText("aPctMeta",(db.apuracaoMetas.length?qtd/db.apuracaoMetas.length*100:0).toFixed(1)+"%");
 const sm=new Map();db.apuracaoMetas.forEach(x=>{const n=x.supervisor||"Sem supervisor";if(!sm.has(n))sm.set(n,{supervisor:n,reps:0,meta:0,atingido:0});const s=sm.get(n);s.reps++;s.meta+=Number(x.meta||0);s.atingido+=Number(x.vrAtingido||0)});
 const sups=[...sm.values()].map(s=>({...s,falta:Math.max(s.meta-s.atingido,0),pct:s.meta?s.atingido/s.meta*100:0})).filter(s=>!sup||s.supervisor===sup).sort((a,b)=>b.pct-a.pct);
 setHTML("supervisorBody",sups.map(s=>`<tr><td><b>${esc(s.supervisor)}</b></td><td>${s.reps}</td><td>${money(s.meta)}</td><td>${money(s.atingido)}</td><td>${money(s.falta)}</td><td>${s.pct.toFixed(1)}%</td><td><span class="pill ${s.pct>=100?"ok":s.pct>=80?"near":"no"}">${s.pct>=100?"Meta atingida":s.pct>=80?"Próximo":"Abaixo"}</span></td></tr>`).join("")||'<tr><td colspan="7">Sem dados.</td></tr>');
 const tm=sups.reduce((s,x)=>s+x.meta,0),ta=sups.reduce((s,x)=>s+x.atingido,0),tr=sups.reduce((s,x)=>s+x.reps,0);setHTML("supervisorFoot",`<tr><td>TOTAL</td><td>${tr}</td><td>${money(tm)}</td><td>${money(ta)}</td><td>${money(Math.max(tm-ta,0))}</td><td>${(tm?ta/tm*100:0).toFixed(1)}%</td><td></td></tr>`);
 setHTML("apuracaoBody",arr.map(x=>`<tr><td class="${x.atingido==="Sim"?"status-ok":"status-no"}">${esc(x.atingido)}</td><td><b>${esc(x.razaoSocial||x.representante||"—")}</b></td><td>${esc(x.representante||"—")}</td><td>${money(x.meta)}</td><td>${money(x.vrAtingido)}</td><td>${money(x.falta)}</td><td>${x.pct.toFixed(1)}%</td><td>${esc(x.supervisor||"—")}</td></tr>`).join("")||'<tr><td colspan="8">Importe APURAÇÃO DE VENDAS.xls.</td></tr>');
}
function refreshSup(){const e=$("filtroSupervisor"),cur=e.value,s=[...new Set(db.apuracaoLinhas.map(x=>x.supervisor).filter(Boolean))].sort();e.innerHTML='<option value="">Todos os supervisores</option>'+s.map(x=>`<option>${esc(x)}</option>`).join("");e.value=cur}

async function importClientes(){
 const f=$("clientesFile").files[0];if(!f)return alert("Selecione TODOS OS CLIENTES.xls.");
 const r=new FileReader();r.onload=async e=>{try{
   const wb=XLSX.read(e.target.result,{type:"array",cellDates:true,raw:true}),total=wb.SheetNames.find(s=>normHeader(s)==="TOTAL"),sheets=total?[total]:wb.SheetNames,map=new Map(),old=new Map(db.clientes.map(c=>[String(c.codigo),c]));let lidos=0;
   for(const sn of sheets){const raw=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:"",raw:true}),h=localizarCabecalho(raw,[["CODIGO CLIENTE"],["RAZAO CLIENTE"]]);if(h<0)continue;const hd=raw[h],cCod=findCol(hd,["CODIGO CLIENTE"]),cRaz=findCol(hd,["RAZAO CLIENTE","RAZÃO CLIENTE"]),cCnpj=findCol(hd,["CNPJ"]),cRep=findCol(hd,["REPRESENTANTE"]),cCid=findCol(hd,["CIDADE"]),cUf=findCol(hd,["UF"]),cUlt=findCol(hd,["ULTIMA COMPRA","ÚLTIMA COMPRA"]),cDias=findCol(hd,["DIAS SEM COMPRAR"]),cVal=findCol(hd,["VALOR ULTIMA COMPRA","VALOR ÚLTIMA COMPRA"]),cTel1=findCol(hd,["TELEFONE 1"]),cTel2=findCol(hd,["TELEFONE 2"]);
     for(let i=h+1;i<raw.length;i++){const row=raw[i],codigo=String(row[cCod]??"").trim(),razao=String(row[cRaz]??"").trim();if(!codigo||!razao)continue;const prev=old.get(codigo);map.set(codigo,{id:prev?.id||("CLI-"+codigo),codigo,razao,cnpj:cCnpj>=0?String(row[cCnpj]??"").trim():"",representante:cRep>=0?String(row[cRep]??"").trim():"",cidade:cCid>=0?String(row[cCid]??"").trim():"",uf:cUf>=0?String(row[cUf]??"").trim():"",ultima:cUlt>=0?excelDate(row[cUlt]):"",dias:cDias>=0?numBR(row[cDias]):0,valor:cVal>=0?numBR(row[cVal]):0,tel1:cTel1>=0?String(row[cTel1]??"").trim():"",tel2:cTel2>=0?String(row[cTel2]??"").trim():""});lidos++}}
   if(!confirm("Importar esta planilha substituirá a lista de CLIENTES para toda a equipe. Deseja continuar?"))return;
   db.clientes=[...map.values()];db.pipelineStages=db.pipelineStages.filter(x=>db.clientes.some(c=>c.id===x.clienteId));invalidatePipeline();if(!await persistDB())return;render();setHTML("clientesMsg",`✅ <b>${db.clientes.length.toLocaleString("pt-BR")}</b> clientes importados.`);
 }catch(err){console.error(err);alert("Erro ao importar clientes: "+err.message)}};r.readAsArrayBuffer(f);
}

async function importVendas(){
 const f=$("vendasFile").files[0];if(!f)return alert("Selecione DIGITAÇÃO DE ORDEM.xls.");
 const r=new FileReader();r.onload=async e=>{try{
   const wb=XLSX.read(e.target.result,{type:"array",cellDates:true,raw:true}),map=new Map();let count=0;
   for(const sn of wb.SheetNames){const raw=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:"",raw:true}),h=localizarCabecalho(raw,[["ORDEM"],["RAZAO SOCIAL"],["VR TOTAL (S/IMPOSTOS)"]]);if(h<0)continue;const hd=raw[h],cOrd=findCol(hd,["ORDEM"]),cRaz=findCol(hd,["RAZAO SOCIAL","RAZÃO SOCIAL"]),cDig=findCol(hd,["DIGITACAO","DIGITAÇÃO"]),cSem=findCol(hd,["VR TOTAL (S/IMPOSTOS)"]),cLiq=findCol(hd,["VR TOTAL (LIQUIDO)","VR TOTAL (LÍQUIDO)"]),cRep=findCol(hd,["REPRESENTANTE"]),cUf=findCol(hd,["UF"]);
     for(let i=h+1;i<raw.length;i++){const row=raw[i],doc=String(row[cOrd]??"").trim(),razao=String(row[cRaz]??"").trim();if(!doc||!razao)continue;const c=findClientRazao(razao);map.set(doc,{id:"VEN-"+doc,clienteId:c?.id||"",codigoCliente:c?.codigo||"",cliente:razao,representante:(cRep>=0?String(row[cRep]??"").trim():"")||c?.representante||"",data:cDig>=0?excelDate(row[cDig]):"",documento:doc,valorSemImpostos:cSem>=0?numBR(row[cSem]):0,valorLiquido:cLiq>=0?numBR(row[cLiq]):0,cidade:c?.cidade||"",uf:(cUf>=0?String(row[cUf]??"").trim():"")||c?.uf||"",origem:"DIGITAÇÃO DE ORDEM"});count++}}
   if(!confirm("Importar esta planilha substituirá a lista de VENDAS para toda a equipe. Deseja continuar?"))return;
   db.vendas=[...map.values()];invalidatePipeline();if(!await persistDB())return;render();setHTML("vendasMsg",`✅ <b>${db.vendas.length}</b> vendas importadas.<br>Sem impostos: <b>${money(db.vendas.reduce((s,v)=>s+Number(v.valorSemImpostos||0),0))}</b> • Líquido: <b>${money(db.vendas.reduce((s,v)=>s+Number(v.valorLiquido||0),0))}</b>`);
 }catch(err){console.error(err);alert("Erro ao importar vendas: "+err.message)}};r.readAsArrayBuffer(f);
}

async function importApuracao(){
 const f=$("apuracaoFile").files[0];if(!f)return alert("Selecione APURAÇÃO DE VENDAS.xls.");
 const r=new FileReader();r.onload=async e=>{try{
   const wb=XLSX.read(e.target.result,{type:"array",raw:true}),linhas=[];
   for(const sn of wb.SheetNames){const raw=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:"",raw:true}),h=localizarCabecalho(raw,[["ATINGIDO"],["REPRESENTANTE"],["RAZAO SOCIAL"],["META"],["VR ATINGIDO"],["NOME DO SUPERVISOR"]]);if(h<0)continue;const hd=raw[h],cAt=findCol(hd,["ATINGIDO"]),cRep=findCol(hd,["REPRESENTANTE"]),cRaz=findCol(hd,["RAZAO SOCIAL","RAZÃO SOCIAL"]),cMeta=findCol(hd,["META"]),cVr=findCol(hd,["VR ATINGIDO"]),cSup=findCol(hd,["NOME DO SUPERVISOR"]);
     for(let i=h+1;i<raw.length;i++){const row=raw[i],rep=String(row[cRep]??"").trim(),raz=String(row[cRaz]??"").trim();if(!rep&&!raz)continue;const meta=numBR(row[cMeta]),vr=numBR(row[cVr]),atRaw=String(row[cAt]??"").trim();linhas.push({atingido:/^SIM$/i.test(atRaw)||(meta>0&&vr>=meta)?"Sim":"Não",representante:rep,razaoSocial:raz,meta,vrAtingido:vr,supervisor:String(row[cSup]??"").trim()})}}
   if(!confirm("Importar esta planilha substituirá a APURAÇÃO DE METAS de toda a equipe. Deseja continuar?"))return;
   db.apuracaoLinhas=linhas;const m=new Map();linhas.forEach(x=>{const k=norm(x.representante||x.razaoSocial);if(!k)return;if(!m.has(k))m.set(k,{...x});else{const a=m.get(k);a.meta=Math.max(Number(a.meta||0),Number(x.meta||0));a.vrAtingido=Math.max(Number(a.vrAtingido||0),Number(x.vrAtingido||0));if(!a.razaoSocial)a.razaoSocial=x.razaoSocial;if(!a.supervisor)a.supervisor=x.supervisor;a.atingido=a.meta>0&&a.vrAtingido>=a.meta?"Sim":"Não"}});db.apuracaoMetas=[...m.values()];if(!await persistDB())return;render();setHTML("apuracaoMsg",`✅ <b>${linhas.length}</b> linhas • <b>${db.apuracaoMetas.length}</b> representantes.`);
 }catch(err){console.error(err);alert("Erro ao importar apuração: "+err.message)}};r.readAsArrayBuffer(f);
}

function backupDados(){const blob=new Blob([JSON.stringify({versao:"V24",data:new Date().toISOString(),dados:db},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Backup_Gestor_Comercial_V24_${today()}.json`;a.click()}
async function restaurarBackup(e){
 const f=e.target.files[0];if(!f)return;
 const r=new FileReader();r.onload=async x=>{
   try {
     const p=JSON.parse(x.target.result);
     if(await window.CRMCloud.importBackup(p.dados||p))alert("Backup inicial enviado para o banco compartilhado.");
   }catch(err){alert("Não foi possível importar o backup: "+err.message)}
   finally { e.target.value="" }
 };r.readAsText(f);
}
function exportExcel(){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(db.clientes),"Clientes");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(db.vendas),"Vendas");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(db.followups),"Follow-ups");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(db.apuracaoLinhas),"Apuração");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(db.pipelineStages),"Pipeline");XLSX.writeFile(wb,"Gestor_Comercial_Panamby_V24.xlsx")}
async function limparTudo(){alert("A limpeza total foi desativada no modo multiusuário para proteger a base da equipe.")}


let alarmAudioUnlocked=false,alarmAudioCtx=null,alarmToastActivityId="";
function unlockAlarmSound(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return false;if(!alarmAudioCtx)alarmAudioCtx=new A();if(alarmAudioCtx.state==="suspended")alarmAudioCtx.resume();alarmAudioUnlocked=true;return true}catch(e){return false}}
function playAlarmSound(){if(!alarmAudioUnlocked||!alarmAudioCtx)return;try{const ctx=alarmAudioCtx,now=ctx.currentTime;[0,.28,.56].forEach((d,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=i===1?880:660;g.gain.setValueAtTime(.0001,now+d);g.gain.exponentialRampToValueAtTime(.22,now+d+.02);g.gain.exponentialRampToValueAtTime(.0001,now+d+.18);o.connect(g);g.connect(ctx.destination);o.start(now+d);o.stop(now+d+.2)})}catch(e){}}
function showAlarmToast(f,c){
 alarmToastActivityId=f.id;const t=$("alarmToast"),b=$("alarmToastBody");if(!t||!b)return;
 b.innerHTML=`<b>${esc(c?.razao||"Cliente")}</b><br>${esc(f.tipo||"Follow-up")} • ${esc(f.texto||"")}<br><span>📅 ${brdate(f.data)} às ${esc(f.hora||"09:00")}</span>`;
 const btn=$("alarmToastOpenBtn");if(btn)btn.onclick=()=>{closeAlarmToast();document.querySelector('[data-tab="followups"]')?.click();$("followClienteBusca").value=c?.razao||c?.codigo||"";followPage=0;renderFollow()};
 t.classList.add("show");playAlarmSound();
}
function closeAlarmToast(){$("alarmToast")?.classList.remove("show");alarmToastActivityId=""}
async function enableNotifications(){
 unlockAlarmSound();
 if(!("Notification"in window)){alert("Som de alerta ativado. Este navegador não oferece notificações do sistema.");return}
 const p=await Notification.requestPermission();
 if(p==="granted")alert("Alertas ativados. O sistema avisará na tela e tentará tocar um som no horário do retorno.");
 else alert("Som ativado, mas a permissão de notificações do navegador não foi concedida.");
}
function checkNotifications(){
 let changed=false,now=new Date();
 db.followups.filter(f=>!f.done&&!f.notified).forEach(f=>{
  const dt=new Date(`${f.data}T${f.hora||"09:00"}:00`);if(isNaN(dt)||dt>now)return;
  const c=getClient(f.clienteId);showAlarmToast(f,c);
  if("Notification"in window&&Notification.permission==="granted"){try{new Notification("Alerta de retorno do follow-up",{body:`${c?.razao||"Cliente"} — ${f.texto} — ${f.hora||"09:00"}`,tag:`follow-${f.id}`})}catch(e){}}
  f.notified=true;changed=true;
 });
 if(changed)persistDB();
}
function closeModal(id){$(id)?.classList.remove("open")}

function bind(id,event,fn){const e=$(id);if(e)e[event]=fn}
["buscaCliente","filtroDias"].forEach(id=>bind(id,"oninput",renderClientes));
["dashInicio","dashFim","dashRep","dashRegiao","dashMetric"].forEach(id=>bind(id,"onchange",renderDashboard));
bind("pipeRep","onchange",()=>{pipePage=0;renderPipeline()});bind("pipeSort","onchange",()=>{pipePage=0;renderPipeline()});bind("pipeBusca","oninput",schedulePipeline);
["followClienteBusca","statusFollow","activityPriority","activityStage"].forEach(id=>bind(id,"oninput",()=>{followPage=0;renderFollow()}));bind("followRep","onchange",()=>{followPage=0;renderFollow()});
["buscaApuracao","filtroSupervisor","filtroAtingido"].forEach(id=>bind(id,"oninput",renderApuracao));

function render(){fillSelectors();refreshSup();renderClientes();renderPipeline();renderFollow();renderApuracao();renderDashboard();checkNotifications()}
async function iniciarApp(){try{
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
}catch(e){console.error(e);alert("Erro ao iniciar o modo multiusuário: "+e.message)}}
iniciarApp();

function openFollow(id,activityId=""){return openFollowV26(id,activityId)}
function saveFollow(){return saveFollowV26()}

if($("activityStage"))$("activityStage").onchange=()=>{followPage=0;renderFollow()};

document.addEventListener("click",()=>{if(!alarmAudioUnlocked)unlockAlarmSound()},{once:true});
