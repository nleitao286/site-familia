"use strict";
/* Ligação aos ficheiros JSON do repositório GitHub.
   Apenas os dados são públicos. Um token individual de acesso é necessário para alterar os ficheiros.
   O token fica só em sessionStorage, nunca é enviado para o repositório. */
(function(){
const REPO="nleitao286/site-familia",BRANCH="main";
const API="https://api.github.com/repos/"+REPO;
const TABLE={
 "familia-menu-v3":"refeicoes",
 "familia-viaturas-v1":"viaturas",
 "familia-compras-v1":"compras",
 "familia-compromissos-v1":"compromissos"
};
const SESSION_KEY="familia-gh-session-token",DIRTY_KEY="familia-gh-dirty-v1",SNAPSHOT_KEY="familia-gh-snapshot-v1",HISTORY_KEY="familia-gh-backups-v2";
const names={refeicoes:"Refeições",viaturas:"Viaturas",compras:"Compras",compromissos:"Compromissos"};
function jsonGet(store,key,fallback){try{return JSON.parse(store.getItem(key)||"null")||fallback}catch{return fallback}}
function status(message){const el=document.getElementById("sync-status");if(el)el.textContent=message}
function encoded(content){const bytes=new TextEncoder().encode(content);let binary="";for(let i=0;i<bytes.length;i+=8192){binary+=String.fromCharCode(...bytes.subarray(i,i+8192))}return btoa(binary)}
function decoded(base64){const bin=atob(base64.replace(/\s/g,""));const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}
function isPopulated(topic,data){
 if(topic==="refeicoes")return !!(data?.dishes?.A?.length||data?.dishes?.J?.length||Object.values(data?.weeks||{}).some(w=>Object.values(w||{}).some(d=>d?.A?.dish||d?.J?.dish)));
 if(topic==="compromissos")return Array.isArray(data)&&data.some(t=>!String(t.id||"").startsWith("initial-")||t.due||t.history?.length||t.notes||t.person||t.completed);
 return Array.isArray(data)&&data.length>0;
}
const G={
 token:sessionStorage.getItem(SESSION_KEY)||"",
 sha:{},dirty:jsonGet(localStorage,DIRTY_KEY,{}),snapshots:jsonGet(localStorage,SNAPSHOT_KEY,{}),backups:jsonGet(localStorage,HISTORY_KEY,{}),errors:[],initialised:false,
 timers:{},saving:{},loaded:{},
 topics(){const p=document.body.dataset.page;if(p==="index")return Object.values(TABLE);return [({menu:"refeicoes",viaturas:"viaturas",compras:"compras",compromissos:"compromissos"})[p]].filter(Boolean)},
 getTopic(key){return TABLE[key]},
 backup(topic,raw,reason){
  if(typeof raw!=="string"||!raw||raw.length>130000)return;
  const list=this.backups[topic]||(this.backups[topic]=[]);
  if(list.length&&list[0].data===raw)return;
  list.unshift({at:new Date().toISOString(),reason,data:raw});
  if(list.length>10)list.length=10;
  try{localStorage.setItem(HISTORY_KEY,JSON.stringify(this.backups))}
  catch(e){console.warn("Sem espaço para guardar cópia local",e)}
 },
 headers(withAuth=true){const headers={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};if(withAuth&&this.token)headers.Authorization="Bearer "+this.token;return headers},
 async request(url,options={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
  try{const response=await fetch(url,{...options,signal:controller.signal,cache:"no-store"});
   let payload=null;try{payload=await response.json()}catch{}
   if(!response.ok){const e=new Error("GitHub "+response.status+": "+(payload?.message||response.statusText));e.code=response.status;throw e}
   return payload;
  }finally{clearTimeout(timer)}
 },
 async fetchOne(topic){
  const url=API+"/contents/dados/"+topic+".json?ref="+BRANCH;
  const payload=await this.request(url,{headers:this.headers()});
  if(typeof payload?.content!=="string"||!payload.sha)throw new Error("Resposta inválida do GitHub");
  const data=JSON.parse(decoded(payload.content));
  const valid=topic==="refeicoes"?!!(data&&typeof data.weeks==="object"&&data.dishes&&Array.isArray(data.dishes.A)&&Array.isArray(data.dishes.J)):Array.isArray(data);
  if(!valid)throw new Error("Formato JSON inválido: "+topic);
  return {data,sha:payload.sha};
 },
 async load(){
  const topics=this.topics();
  let ok=0;
  await Promise.all(topics.map(async topic=>{
   try{
    const remote=await this.fetchOne(topic);this.sha[topic]=remote.sha;this.loaded[topic]=true;ok++;
    const localKey=Object.keys(TABLE).find(k=>TABLE[k]===topic);
    const existing=localStorage.getItem(localKey);
    const current=existing?JSON.parse(existing):null;
    const prior=this.snapshots[topic];
    // Dados existentes de versões anteriores não são descartados sem aviso.
    if(existing&&!this.dirty[topic]&&(prior?existing!==prior:isPopulated(topic,current)&&JSON.stringify(current)!==JSON.stringify(remote.data))){
      this.dirty[topic]=true;this.saveDirty();
      this.backup(topic,existing,"Dados locais encontrados antes de consultar o GitHub");
    }
    if(!this.dirty[topic]){
      const data=JSON.stringify(remote.data);
      if(existing&&existing!==data)this.backup(topic,existing,"Antes de substituir com dados do GitHub");
      localStorage.setItem(localKey,data);
      this.snapshots[topic]=data;
      this.saveSnapshots();
    }else if(existing){
      this.backup(topic,existing,"Dados locais por publicar");
    }
   }catch(e){this.errors.push(topic+": "+e.message);console.warn("Não foi possível carregar "+topic,e)}
  }));
  this.initialised=true;
  this.attach();
  if(!ok)status("Sem ligação aos ficheiros GitHub. Os dados locais continuam disponíveis.");
  else this.render();
  if(this.token)for(const topic of topics){if(this.dirty[topic]&&this.loaded[topic])this.schedule(topic)}

 },
 saveDirty(){localStorage.setItem(DIRTY_KEY,JSON.stringify(this.dirty))},
 saveSnapshots(){localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(this.snapshots))},
 changed(key,data){
  const topic=this.getTopic(key);if(!topic)return;
  this.backup(topic,JSON.stringify(data),"Alteração local");
  this.dirty[topic]=true;this.saveDirty();this.render();
  if(this.token&&this.loaded[topic])this.schedule(topic);
 },
 schedule(topic){clearTimeout(this.timers[topic]);this.timers[topic]=setTimeout(()=>{this.flush(topic).catch(e=>console.warn(e))},750)},
 async flush(topic){
  if(!this.dirty[topic])return true;
  if(!this.token){status("Não foi gravado no GitHub. É necessário ligar uma conta GitHub autorizada.");return false}
  if(this.saving[topic])return false;
  if(!this.loaded[topic]){status("Sem versão remota confirmada. Recarrega antes de guardar.");return false}
  this.saving[topic]=true;
  const localKey=Object.keys(TABLE).find(k=>TABLE[k]===topic);
  const snapshot=localStorage.getItem(localKey);
  try{
   status("A guardar "+names[topic]+" no GitHub…");
   const latest=await this.fetchOne(topic);
   if(latest.sha!==this.sha[topic]){
     status("Conflito em "+names[topic]+": outra pessoa alterou o ficheiro. Faz uma cópia dos dados locais antes de recarregar.");
     return false;
   }
   const url=API+"/contents/dados/"+topic+".json";
   const body={message:"Atualizar dados da família: "+names[topic],content:encoded(JSON.stringify(JSON.parse(snapshot),null,2)+"\n"),sha:this.sha[topic],branch:BRANCH};
   const r=await this.request(url,{method:"PUT",headers:{...this.headers(),"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!r?.content?.sha)throw new Error("O GitHub não confirmou o novo ficheiro");
   this.sha[topic]=r.content.sha;
   this.snapshots[topic]=snapshot;this.saveSnapshots();
   if(localStorage.getItem(localKey)===snapshot){delete this.dirty[topic];this.saveDirty()}
   status("✓ GRAVADO NO GITHUB · "+names[topic]);return true;
  }catch(e){status("Erro ao guardar "+names[topic]+": "+e.message+". Os dados continuam neste navegador.");return false}
  finally{delete this.saving[topic];if(this.token&&this.dirty[topic]&&localStorage.getItem(localKey)!==snapshot)this.schedule(topic)}
 },
 async flushAll(){for(const topic of this.topics()){if(this.dirty[topic])await this.flush(topic)}this.render()},
 render(){
  const topics=this.topics();
  const pending=topics.filter(t=>this.dirty[t]);
  if(!this.initialised)return;
  const state=document.getElementById("sync-state");
  if(state)state.textContent=pending.length?"NÃO GRAVADO NO GITHUB":this.token?"EDIÇÃO LIGADA":"SEM ACESSO DE GRAVAÇÃO";
  const box=document.querySelector(".sync-panel");
  if(box)box.dataset.syncStatus=pending.length?"pending":this.token?"connected":"readonly";
  const disconnect=document.getElementById("sync-disconnect");
  if(disconnect)disconnect.hidden=!this.token;
  const publish=document.getElementById("sync-publish");
  if(publish)publish.hidden=!(this.token&&pending.length);
  const sync=document.getElementById("sync-connect");
  if(sync)sync.textContent=this.token?"VERIFICAR ACESSO":"LIGAR GITHUB";
  const statusEl=document.getElementById("sync-status");
  if(!statusEl)return;
  if(pending.length)statusEl.textContent="⚠ Alterações NÃO GRAVADAS no GitHub: "+pending.map(t=>names[t]).join(", ")+(this.token?". Clica em PUBLICAR ALTERAÇÕES ou confirma a gravação automática.":". São só uma cópia neste navegador. Liga uma conta autorizada e publica-as.");
  else if(this.errors.length)statusEl.textContent="⚠ Falha ao consultar ficheiros GitHub. A informação apresentada pode ser apenas local.";
  else statusEl.textContent=this.token?"Ligado. As alterações serão gravadas nos ficheiros JSON do GitHub.":"Dados consultados do GitHub. Para guardar alterações partilhadas, liga uma conta com acesso ao repositório.";
 },
 async connect(){
  const input=document.getElementById("sync-token");
  const token=input?.value?.trim()||this.token;
  if(!token){status("Insere um token GitHub com permissão Contents: Read and write para este repositório.");return}
  status("A verificar permissões no GitHub…");
  try{
   const info=await this.request(API,{headers:{...this.headers(false),Authorization:"Bearer "+token}});
   if(!info?.permissions?.push)throw new Error("Esta conta não tem permissão de escrita no repositório.");
   this.token=token;sessionStorage.setItem(SESSION_KEY,token);
   if(input)input.value="";
   this.render();status("Ligação autenticada. Podes publicar alterações locais. Só está guardado no GitHub quando aparecer a confirmação.");
   for(const topic of this.topics())if(this.dirty[topic]&&this.loaded[topic])this.schedule(topic);
  }catch(e){status("Não foi possível ligar: "+e.message)}
 },
 disconnect(){this.token="";sessionStorage.removeItem(SESSION_KEY);this.render();status("A edição GitHub foi desligada. Os dados continuam disponíveis para consulta.")},
 async reload(){
  const current=this.topics();
  if(current.some(t=>this.dirty[t])){
   if(!confirm("Há alterações locais por publicar. Recarregar irá descartá-las. Faz primeiro uma cópia na página inicial. Continuar?"))return;
  }
  const wasDirty={...this.dirty};
  for(const topic of current)delete this.dirty[topic];
  this.saveDirty();
  let failures=0;
  for(const topic of current){
   try{const r=await this.fetchOne(topic);this.sha[topic]=r.sha;this.loaded[topic]=true;
    const k=Object.keys(TABLE).find(k=>TABLE[k]===topic);const value=JSON.stringify(r.data);
    const existing=localStorage.getItem(k);if(existing&&existing!==value)this.backup(topic,existing,"Antes de atualização manual do GitHub");
    localStorage.setItem(k,value);this.snapshots[topic]=value;
   }catch(e){failures++;if(wasDirty[topic])this.dirty[topic]=true}
  }
  this.saveDirty();this.saveSnapshots();
  if(failures)status("Alguns ficheiros não foram descarregados. Dados locais preservados nesses temas.");
  else location.reload();
 },
 attach(){
  document.getElementById("sync-connect")?.addEventListener("click",()=>this.connect());
  document.getElementById("sync-disconnect")?.addEventListener("click",()=>this.disconnect());
  document.getElementById("sync-reload")?.addEventListener("click",()=>this.reload());
  document.getElementById("sync-publish")?.addEventListener("click",async()=>{if(!confirm("Publicar as alterações locais no GitHub? Confirma que são os dados que queres partilhar."))return;await this.flushAll()});
  const token=document.getElementById("sync-token");
  token?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();this.connect()}});
 }
};
window.GHSync=G;
})();