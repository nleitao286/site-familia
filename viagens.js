import { supabase } from './supabase-client.js?v=20261108-private1';
const $ = id => document.getElementById(id);
let currentUser = null, isAdmin = false, active = false, busy = false;
function date(iso) {
  if (!iso) return 'Sem data';
  const [y,m,d] = iso.split('-'); return d+'/'+m+'/'+y;
}
function el(tag, text, className) {
  const node=document.createElement(tag);
  if (text !== undefined) node.textContent=text;
  if (className) node.className=className;
  return node;
}
function button(label, action, kind='outline') {
  const b=el('button',label,kind); b.type='button';
  b.addEventListener('click',action); return b;
}
function feedback(message) { $('trip-message').textContent=message; }
async function change(fn, success) {
  if (busy || !active) return;
  busy=true;
  feedback('A guardar no Supabase…');
  try {
    const {error}=await fn();
    if(error) throw error;
    await refresh();
    feedback(success);
  } catch(error) {
    feedback('Não foi possível guardar: '+(error.message||String(error)));
  } finally {busy=false;}
}
async function refresh() {
  if (!active) return;
  feedback('A consultar viagens…');
  const {data:trips,error}=await supabase.from('viagens')
    .select('id,titulo,destino,data_inicio,data_fim,estado,descricao,limite_participantes,prazo_inscricao')
    .order('data_inicio',{ascending:true});
  if(error) {feedback('Erro ao consultar viagens: '+error.message);return;}
  const {data:people,error:peopleError}=await supabase.from('viagem_participantes')
    .select('id,viagem_id,user_id,nome,nome_externo').order('criado_em',{ascending:true});
  if(peopleError){feedback('Erro ao consultar participantes: '+peopleError.message);return;}
  if(!active)return;
  const root=$('trip-list'); root.replaceChildren();
  if(!trips.length){feedback('Ainda não há viagens registadas.');return;}
  feedback(trips.length+(trips.length===1?' viagem registada.':' viagens registadas.'));
  for(const trip of trips){
    const attendees=people.filter(p=>p.viagem_id===trip.id);
    const mine=attendees.find(p=>p.user_id===currentUser.id);
    const count=attendees.length;
    const room=trip.limite_participantes===null || count<trip.limite_participantes;
    const withinDeadline=!trip.prazo_inscricao || new Date().toISOString().slice(0,10)<=trip.prazo_inscricao;
    const notStarted=new Date().toISOString().slice(0,10)<=trip.data_inicio;
    const open=trip.estado==='abertas' && withinDeadline && notStarted;
    const article=el('article',undefined,'trip-item');
    article.append(el('h3',trip.titulo));
    article.append(el('p',trip.destino+' · '+date(trip.data_inicio)+' a '+date(trip.data_fim)));
    article.append(el('p','Estado: '+({rascunho:'Em preparação',abertas:'Inscrições abertas',fechadas:'Inscrições fechadas',concluida:'Concluída',cancelada:'Cancelada'}[trip.estado]||trip.estado),'trip-status'));
    if(trip.descricao) article.append(el('p',trip.descricao));
    const panel=el('section',undefined,'trip-participants');
    panel.append(el('h4','Participantes ('+count+(trip.limite_participantes===null?'':' / '+trip.limite_participantes)+')'));
    if(attendees.length){
      const ul=el('ul');
      for(const person of attendees){
        const li=el('li');
        li.append(document.createTextNode((person.nome||person.nome_externo||'Participante')+(person.user_id===currentUser.id?' (tu)':'')+(person.user_id===null?' · convidado':' ')));
        if(person.user_id===null && isAdmin){
          li.append(button('REMOVER',()=>{if(confirm('Remover este convidado da viagem?'))change(()=>supabase.from('viagem_participantes').delete().eq('id',person.id),'Convidado removido.');}));
        }
        ul.append(li);
      }
      panel.append(ul);
    } else panel.append(el('p','Ainda não há participantes inscritos.'));
    if(open && !mine && room){
      panel.append(button('INSCREVER-ME',()=>change(()=>supabase.from('viagem_participantes').insert({viagem_id:trip.id,user_id:currentUser.id}),'Inscrição confirmada no Supabase.')));
    } else if(open && mine){
      panel.append(button('CANCELAR A MINHA INSCRIÇÃO',()=>{if(confirm('Cancelar a tua inscrição?'))change(()=>supabase.from('viagem_participantes').delete().eq('id',mine.id),'Inscrição cancelada.');}));
    } else if(!mine && !room) panel.append(el('small','A lotação está completa.'));
    else if(!open && !mine) panel.append(el('small','Inscrições indisponíveis neste momento.'));
    if(isAdmin){
      const adminActions=el('div',undefined,'trip-inline');
      if(trip.estado==='rascunho' || trip.estado==='fechadas'){
        adminActions.append(button('ABRIR INSCRIÇÕES',()=>change(()=>supabase.from('viagens').update({estado:'abertas'}).eq('id',trip.id),'Inscrições abertas.')));
      }else if(trip.estado==='abertas'){
        adminActions.append(button('FECHAR INSCRIÇÕES',()=>change(()=>supabase.from('viagens').update({estado:'fechadas'}).eq('id',trip.id),'Inscrições fechadas.')));
      }
      if(trip.estado!=='cancelada' && trip.estado!=='concluida'){
        const form=el('form',undefined,'trip-inline');
        const input=el('input');input.placeholder='Nome do convidado externo';input.maxLength=120;input.required=true;input.setAttribute('aria-label','Nome do convidado');
        const add=el('button','ADICIONAR CONVIDADO');add.type='submit';
        form.append(input,add);
        form.addEventListener('submit',event=>{
          event.preventDefault();
          const name=input.value.trim();
          if(!name) return;
          change(()=>supabase.from('viagem_participantes').insert({viagem_id:trip.id,nome_externo:name}),'Convidado adicionado.');
        });
        adminActions.append(form);
      }
      panel.append(adminActions);
    }
    article.append(panel);
    root.append(article);
  }
}
async function boot(){
  try{
    const {data:{user},error}=await supabase.auth.getUser();
    if(error||!user){$('access-message').textContent='Inicia sessão para consultar as viagens.';return;}
    const {data:member,error:memberError}=await supabase.from('familia_membros').select('nome').eq('user_id',user.id).maybeSingle();
    if(memberError||!member){$('access-message').textContent='Não foi possível confirmar o teu acesso familiar.';return;}
    currentUser=user;isAdmin=member.nome==='Nuno';active=true;
    document.documentElement.dataset.auth='ready';
    if(isAdmin)$('trip-create').hidden=false;
    await refresh();
  }catch{$('access-message').textContent='Não foi possível confirmar a sessão. Tenta novamente.';}
}
$('trip-refresh').addEventListener('click',refresh);
supabase.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT'){
    active=false;currentUser=null;isAdmin=false;document.documentElement.dataset.auth='pending';
    $('access-message').textContent='A sessão terminou. Inicia sessão novamente.';
  }
});
boot();
