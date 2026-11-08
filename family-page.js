import {supabase} from './supabase-client.js?v=20261108-private1';
import {FamilyStore, TOPICS, validate} from './family-store.js?v=20261108-private1';
const $ = id => document.getElementById(id);
const labels = {refeicoes:'Refeições',viaturas:'Viaturas',compras:'Compras',compromissos:'Compromissos'};
const pageTopics = {index:Object.values(TOPICS),menu:['refeicoes'],viaturas:['viaturas'],compras:['compras'],compromissos:['compromissos'],recuperar:Object.values(TOPICS)};
const page = document.body.dataset.page, topics = pageTopics[page];
let store, started = false, checking = false, revoked = false;
const timers = {}, editors = {};
function download(value, name='familia-copia-privada') {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function gate(message, redirect=false) {
  document.documentElement.dataset.familyAuth='pending';
  if ($('auth-message')) $('auth-message').textContent=message;
  if (redirect) {
    revoked=true;$('auth-copy').hidden=true;store?.deactivate();
    for (const timer of Object.values(timers)) clearTimeout(timer);
    location.replace('entrar.html?next='+encodeURIComponent(location.pathname.split('/').pop()||'index.html'));
  }
}
async function verify() {
  const {data:{user},error}=await supabase.auth.getUser();
  if (error && error.name!=='AuthSessionMissingError') throw Error('Não foi possível confirmar a sessão. Verifica a ligação e volta a tentar.');
  if (!user) {gate('Inicia sessão para consultar os dados.',true);return null;}
  const {data:member,error:memberError}=await supabase.from('familia_membros').select('nome').eq('user_id',user.id).maybeSingle();
  if (memberError) throw Error('Não foi possível confirmar o acesso familiar. Tenta novamente com ligação à Internet.');
  if (!member) {gate('Esta conta não tem acesso aos dados familiares.',true);return null;}
  return user;
}
function errorMessage(error) { $('sync-status').textContent=error.message||String(error); }
function render() {
  if (!store || revoked) return;
  const records=Object.entries(store.records);
  const dirty=records.filter(([,r])=>r.dirty), conflict=records.filter(([,r])=>r.conflict);
  const errors=records.map(([,r])=>r.storageError||r.error).filter(Boolean);
  const saving=Object.keys(store.saving).length;
  $('sync-state').textContent=saving?'A GUARDAR':conflict.length?'CONFLITO':dirty.length?'POR GUARDAR':'SUPABASE';
  $('sync-status').textContent=errors[0]||(saving?'A aguardar confirmação do Supabase…':conflict.length?'Existem versões diferentes. Compara-as abaixo; nenhuma foi apagada.':dirty.length?'Há alterações só neste navegador. Guarda-as ou descarrega uma cópia.':records.some(([,r])=>r.lastSavedAt)?'✓ Guardado no Supabase. Sem alterações por confirmar.':'Dados consultados e confirmados no Supabase.');
  $('sync-publish').hidden=!dirty.length;
  $('sync-publish').disabled=!!saving || dirty.every(([,r])=>r.conflict||r.storageError);
  const root=$('sync-reconcile');
  for (const [topic,record] of records) {
    let card=root.querySelector('[data-topic="'+topic+'"]');
    if (!record.conflict&&!record.legacy) {card?.remove();continue;}
    const signature=JSON.stringify([record.conflict,record.remote.version,record.legacy?.raw]);
    if (card?.dataset.signature===signature) continue;
    card?.remove(); card=document.createElement('section');card.className='panel';card.dataset.topic=topic;card.dataset.signature=signature;
    const title=document.createElement('h3');title.textContent=labels[topic]+' — comparar cópias';card.append(title);
    const note=document.createElement('p');note.textContent=record.legacy?'Foi encontrada uma cópia antiga neste navegador. Não será publicada automaticamente.':'A tua cópia e os dados partilhados são diferentes. Conservámos as duas versões.';card.append(note);
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='VER E CONCILIAR VERSÕES';details.append(summary);
    const remoteTitle=document.createElement('p');remoteTitle.textContent='Dados partilhados (versão '+record.remote.version+')';details.append(remoteTitle);
    const remote=document.createElement('pre');remote.className='recovery-code';remote.textContent=JSON.stringify(record.remote.data,null,2);details.append(remote);
    const choices=[{label:'Cópia atual',data:record.data},...(record.legacy?.data?[{label:'Cópia antiga deste navegador',data:record.legacy.data}]:[]),...record.candidates.map((x,i)=>({label:'Rascunho '+(i+1)+' · '+x.at,data:x.data}))];
    const select=document.createElement('select');select.setAttribute('aria-label','Cópia para comparar');choices.forEach((choice,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=choice.label;select.append(option)});if(record.legacy?.data)select.value='1';details.append(select);
    const textarea=document.createElement('textarea');textarea.rows=12;textarea.setAttribute('aria-label','Versão conciliada de '+labels[topic]);textarea.style.width='100%';textarea.value=editors[topic]||JSON.stringify(record.legacy?.data||record.data,null,2);textarea.oninput=()=>{editors[topic]=textarea.value};
    select.onchange=()=>{textarea.value=JSON.stringify(choices[Number(select.value)].data,null,2);editors[topic]=textarea.value};details.append(textarea);
    if (record.legacy?.invalid) {const invalid=document.createElement('pre');invalid.textContent=record.legacy.raw;invalid.className='recovery-code';details.append(invalid);}
    const warning=document.createElement('p');warning.textContent='A aplicação não junta conteúdos automaticamente. A versão conciliada deve incluir todas as alterações que queres conservar.';details.append(warning);
    const actions=document.createElement('div');actions.className='actions';
    const keep=document.createElement('button');keep.type='button';keep.textContent='USAR DADOS PARTILHADOS';keep.onclick=async()=>{if(!confirm('Conservar a cópia local no histórico e passar a usar os dados partilhados?'))return;try{await store.acceptRemote(topic);delete editors[topic];window.FamilyApp?.render()}catch(e){errorMessage(e)}};actions.append(keep);
    const merge=document.createElement('button');merge.type='button';merge.textContent='GUARDAR VERSÃO CONCILIADA';merge.onclick=async()=>{if(!confirm('Guardar esta versão como documento partilhado? Confirma que inclui todas as alterações que queres conservar das cópias apresentadas.'))return;try{await store.resolve(topic,JSON.parse(textarea.value),record.remote.version);delete editors[topic];await flush(topic);window.FamilyApp?.render()}catch(e){errorMessage(e)}};actions.append(merge);
    const copy=document.createElement('button');copy.type='button';copy.className='outline';copy.textContent='DESCARREGAR TODAS AS CÓPIAS';copy.onclick=()=>download(store.export());actions.append(copy);
    details.append(actions);card.append(details);root.append(card);
  }
}
async function flush(topic){const ok=await store.save(topic);if(!ok&&store.records[topic].error)await revalidate();return ok}
function schedule(topic) {
  clearTimeout(timers[topic]);timers[topic]=setTimeout(async()=>{
    const ok=await flush(topic);
    if (ok&&store.records[topic].dirty&&!store.records[topic].conflict&&!store.records[topic].storageError) schedule(topic);

  },750);
}
async function revalidate() {
  if(checking||revoked||!started)return;
  checking=true;gate('A confirmar a sessão…');
  try {const user=await verify();if(user&&user.id===store.userId)document.documentElement.dataset.familyAuth='ready';else if(user)gate('A conta mudou. Volta a entrar.',true);}
  catch(error){gate(error.message);}finally{checking=false;}
}
async function boot() {
  if(checking||revoked)return;checking=true;
  try {
    const user=await verify();if(!user)return;
    if (started) {document.documentElement.dataset.familyAuth='ready';return;}
    store=new FamilyStore({client:supabase,storage:localStorage,userId:user.id,notify:render});
    $('auth-copy').hidden=false;
    window.FamilySync={
      get:(key,fallback)=>store.get(key,fallback),
      changed:(key,data)=>{try{const ok=store.changed(key,data);if(ok&&!store.records[TOPICS[key]].conflict)schedule(TOPICS[key]);return ok}catch(error){errorMessage(error);return false}},
      restore:(topic,data)=>store.restore(topic,data),records:store.records,
      import:data=>{for(const [topic,value] of Object.entries(data))validate(topic,value);for(const [topic,value] of Object.entries(data))store.restore(topic,value);render()},
      export:()=>store.export(),importPack:pack=>store.importPack(pack),authorised:true
    };
    await Promise.all(topics.map(topic=>store.load(topic)));
    if(revoked||!store.active)return;
    $('sync-publish').onclick=async()=>{for(const topic of topics)await flush(topic);render()};
    $('sync-reload').onclick=async()=>{try{await revalidate();if(revoked||document.documentElement.dataset.familyAuth!=='ready')return;for(const topic of topics)await store.refresh(topic);window.FamilyApp?.render()}catch(error){errorMessage(error)}};
    $('sync-copy').onclick=()=>download(store.export());
    $('sync-logout').onclick=async()=>{const {error}=await supabase.auth.signOut({scope:'local'});if(error){errorMessage(Error('Não foi possível terminar a sessão.'));return;}gate('Sessão terminada.',true)};
    const script=document.createElement('script');script.src=(page==='recuperar'?'recovery.js':'app.js')+'?v=20261108-private1';
    await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Não foi possível carregar a aplicação.'));document.body.append(script)});
    started=true;render();document.documentElement.dataset.familyAuth='ready';
  } catch(error){gate(error.message);} finally{checking=false;}
}
$('auth-retry').onclick=()=>started?revalidate():boot();
$('auth-copy').onclick=()=>{if(store)download(store.export());};
supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')gate('Sessão terminada.',true)});
window.addEventListener('pageshow',event=>{if(event.persisted)revalidate()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')revalidate()});
window.addEventListener('beforeunload',event=>{if(store&&Object.values(store.records).some(r=>r.dirty)){event.preventDefault();event.returnValue=''}});
boot();
