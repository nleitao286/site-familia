"use strict";
(function(){
const topicConfig=[
 {id:"refeicoes",label:"Almoços e jantares",key:"familia-menu-v3",href:"menu.html"},
 {id:"viaturas",label:"Viaturas",key:"familia-viaturas-v1",href:"viaturas.html"},
 {id:"compras",label:"Compras",key:"familia-compras-v1",href:"compras.html"},
 {id:"compromissos",label:"Compromissos",key:"familia-compromissos-v1",href:"compromissos.html"}
];
const dirtyKey="familia-gh-dirty-v1",historyKey="familia-gh-backups-v2",snapshotKey="familia-gh-snapshot-v1";
const $=id=>document.getElementById(id);
const read=(key,defaultValue)=>{try{return JSON.parse(localStorage.getItem(key)||"null")||defaultValue}catch{return defaultValue}};
const history=()=>read(historyKey,{});
const snapshots=()=>read(snapshotKey,{});
function convertLegacy(raw){
 const old=JSON.parse(raw);
 if(!old||!old.sel||typeof old.sel!=="object")return null;
 const weeks={};const ideas={A:[],J:[]};
 const ini=String(old.inicio||"").slice(0,10);
 const d=/^\d{4}-\d\d-\d\d$/.test(ini)?new Date(ini+"T12:00:00"):new Date();
 d.setDate(d.getDate()-(d.getDay()+1)%7);
 const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 const w={};
 for(let i=0;i<7;i++){w[i]={A:{dish:old.sel[i+"A"]||"",salad:!!old.sel[i+"AS"]},J:{dish:old.sel[i+"J"]||"",salad:!!old.sel[i+"JS"]}}}
 weeks[date]=w;
 for(const type of ["A","J"]){ideas[type]=Array.isArray(old.ideas?.[type])?old.ideas[type].filter(x=>typeof x==="string"):[]}
 return {weeks,dishes:ideas};
}
function versions(t){
 const list=[],seen=new Set();
 function add(raw,source,at){
  if(!raw||seen.has(raw))return;
  try{let data=JSON.parse(raw);if(t.id==="refeicoes"){if(!data||!data.weeks||!data.dishes)throw Error("invalid")}else if(!Array.isArray(data))throw Error("invalid");
   seen.add(raw);list.push({raw,data,source,at:at||"",topic:t})
  }catch(e){}
 }
 add(localStorage.getItem(t.key),"Estado atual neste navegador");
 for(const v of history()[t.id]||[])add(v.data,v.reason||"Cópia automática",v.at);
 add(snapshots()[t.id],"Último estado descarregado do GitHub");
 if(t.id==="refeicoes"){
  const old=localStorage.getItem("menu-semana");
  if(old){try{const data=convertLegacy(old);if(data)add(JSON.stringify(data),"Menu antigo (versão original)")}catch(e){}}
 }
 return list;
}
function summary(data,t){
 if(t.id==="refeicoes")return (data?.dishes?.A?.length||0)+" pratos de almoço · "+(data?.dishes?.J?.length||0)+" pratos de jantar · "+Object.keys(data?.weeks||{}).length+" semanas";
 if(t.id==="compromissos")return data.length+" compromissos, "+data.reduce((s,x)=>s+(x.history?.length||0),0)+" registos no histórico";
 return data.length+" "+(t.id==="compras"?"artigos":"viaturas");
}
function restore(ver){
 if(!confirm("Restaurar esta versão de "+ver.topic.label+"? Isto substitui os dados atuais deste tema neste navegador e marca-os como não publicados no GitHub."))return;
 try{
  const current=localStorage.getItem(ver.topic.key);
  if(current&&current!==ver.raw){
   const all=history();const list=all[ver.topic.id]||(all[ver.topic.id]=[]);
   list.unshift({at:new Date().toISOString(),reason:"Antes de recuperar versão anterior",data:current});list.splice(10);localStorage.setItem(historyKey,JSON.stringify(all));
  }
  localStorage.setItem(ver.topic.key,ver.raw);
  const dirty=read(dirtyKey,{});dirty[ver.topic.id]=true;localStorage.setItem(dirtyKey,JSON.stringify(dirty));
  alert("Dados restaurados apenas neste navegador. Abre "+ver.topic.label+" e depois publica no GitHub através de Acesso de edição.");
  render();
 }catch(e){alert("Não foi possível restaurar dados neste navegador: "+e.message)}
}
function render(){
 const root=$("recovery-content");root.replaceChildren();
 let count=0;
 for(const topic of topicConfig){
  const group=document.createElement("section");group.className="item";
  const title=document.createElement("h3");title.textContent=topic.label;group.appendChild(title);
  const entries=versions(topic);count+=entries.length;
  if(!entries.length){const empty=document.createElement("p");empty.className="subtle";empty.textContent="Não foram encontradas cópias deste tema neste navegador.";group.appendChild(empty)}
  entries.forEach((ver,i)=>{
   const row=document.createElement("div");row.className="recovery-entry";
   const info=document.createElement("div");info.style.minWidth="0";
   const strong=document.createElement("strong");strong.textContent=ver.source;info.appendChild(strong);
   const p=document.createElement("p");p.className="subtle";p.textContent=summary(ver.data,topic)+(ver.at?" · "+new Date(ver.at).toLocaleString("pt-PT"):"");info.appendChild(p);
   row.appendChild(info);
   const actions=document.createElement("div");actions.className="toolbar";
   const restoreButton=document.createElement("button");restoreButton.className="small";restoreButton.textContent="RESTAURAR";restoreButton.addEventListener("click",()=>restore(ver));actions.appendChild(restoreButton);
   const view=document.createElement("details");const summaryEl=document.createElement("summary");summaryEl.textContent="Ver conteúdo";view.appendChild(summaryEl);
   const code=document.createElement("pre");code.className="recovery-code";code.textContent=JSON.stringify(ver.data,null,2);view.appendChild(code);actions.appendChild(view);
   row.appendChild(actions);group.appendChild(row);
  });
  root.appendChild(group);
 }
 if(!count){const e=document.createElement("div");e.className="notice";e.textContent="Não foram encontrados dados guardados neste navegador. Verifica o mesmo browser e telemóvel onde fizeste as alterações.";root.prepend(e)}
}
$("recovery-refresh").onclick=render;
$("recovery-download").onclick=()=>{
 const backup={format:"familia-local-recovery",exportedAt:new Date().toISOString(),topics:Object.fromEntries(topicConfig.map(t=>[t.id,versions(t).map(v=>({source:v.source,at:v.at,data:v.data}))]))};
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="recuperacao-familia-"+new Date().toISOString().slice(0,10)+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
render();
})();