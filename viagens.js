import { supabase } from './supabase-client.js?v=20261108-private1';
const $ = id => document.getElementById(id);
let active = false;
function date(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-'); return d+'/'+m+'/'+y;
}
async function refresh() {
  if (!active) return;
  $('trip-message').textContent = 'A consultar viagens…';
  const { data, error } = await supabase.from('viagens')
    .select('id,titulo,destino,data_inicio,data_fim,estado,descricao')
    .order('data_inicio',{ascending:true});
  if (!active) return;
  const root = $('trip-list'); root.replaceChildren();
  if (error) { $('trip-message').textContent = 'Erro ao consultar viagens. Verifica a ligação e tenta novamente.'; return; }
  if (!data.length) { $('trip-message').textContent = 'Ainda não há viagens registadas.'; return; }
  $('trip-message').textContent = data.length + (data.length===1?' viagem registada.':' viagens registadas.');
  for (const trip of data) {
    const article=document.createElement('article'); article.className='trip-item';
    const h=document.createElement('h3'); h.textContent=trip.titulo;
    const p=document.createElement('p');p.textContent=trip.destino+' · '+date(trip.data_inicio)+' a '+date(trip.data_fim)+' · '+(trip.estado==='rascunho'?'Em preparação':trip.estado);
    article.append(h,p);
    if(trip.descricao){const d=document.createElement('p');d.textContent=trip.descricao;article.append(d);}
    root.append(article);
  }
}
async function boot() {
  try {
    const {data:{user},error}=await supabase.auth.getUser();
    if(error||!user){$('access-message').textContent='Inicia sessão para consultar as viagens.';return;}
    const {data:member,error:memberError}=await supabase.from('familia_membros').select('nome').eq('user_id',user.id).maybeSingle();
    if(memberError||!member){$('access-message').textContent='Não foi possível confirmar o teu acesso familiar.';return;}
    active=true;document.documentElement.dataset.auth='ready';
    // A autorização de escrita continua a ser imposta pela RLS no servidor.
    if (member.nome === 'Nuno') $('trip-create').hidden = false;
    await refresh();
  }catch{$('access-message').textContent='Não foi possível confirmar a sessão. Tenta novamente.';}
}
$('trip-refresh').addEventListener('click',refresh);
supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){active=false;document.documentElement.dataset.auth='pending';$('access-message').textContent='A sessão terminou. Inicia sessão novamente.';}});
boot();
