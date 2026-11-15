import { supabase } from './supabase-client.js?v=20261108-private1';
const $ = (id) => document.getElementById(id);
const msg = $('access-message');

async function authorize() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      msg.textContent = 'Inicia sessão para aceder à administração das viagens.';
      return;
    }
    const { data: member, error: memberError } = await supabase.from('familia_membros')
      .select('nome').eq('user_id', user.id).maybeSingle();
    if (memberError || !member) {
      msg.textContent = 'A conta não tem acesso familiar confirmado.';
      return;
    }
    // A Edge Function confirma os privilégios de administrador no servidor.
    const { data, error } = await supabase.functions.invoke('familia-acessos', { body: { action: 'list' } });
    if (error || !data || data.error || !Array.isArray(data.people)) {
      msg.textContent = 'Esta área é reservada ao administrador da família.';
      return;
    }
    document.documentElement.dataset.auth = 'ready';
  } catch {
    msg.textContent = 'Não foi possível confirmar as permissões. Verifica a ligação e volta a tentar.';
  }
}

const form = $('trip-form');
function val(id) { return $(id).value.trim(); }
function formatDate(iso) {
  if (!iso) return 'Não definido';
  const [y,m,d] = iso.split('-');
  return d + '/' + m + '/' + y;
}
function preview() {
  const title = val('trip-name');
  const dest = val('trip-destination');
  const start = val('trip-start');
  const end = val('trip-end');
  const deadline = val('trip-deadline');
  const limit = val('trip-limit');
  const errors = [];
  if (!title) errors.push('Indica o nome da viagem.');
  if (!dest) errors.push('Indica o destino.');
  if (!start || !end) errors.push('Indica as datas de início e de fim.');
  if (start && end && end < start) errors.push('A data de fim não pode ser anterior à data de início.');
  if (deadline && start && deadline > start) errors.push('O prazo de inscrição não pode ser posterior à data de início.');
  if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 1000)) errors.push('O número máximo deve ser um inteiro entre 1 e 1000.');
  $('trip-errors').hidden = errors.length === 0;
  $('trip-errors').textContent = errors.join('\n');
  $('trip-result').hidden = true;
  if (errors.length) return;
  const lines = [
    'Viagem: ' + title,
    'Destino: ' + dest,
    'Datas: ' + formatDate(start) + ' a ' + formatDate(end),
    'Estado: ' + (val('trip-status') === 'abertas' ? 'Inscrições abertas' : 'Rascunho'),
    'Prazo de inscrição: ' + formatDate(deadline),
    'Limite de participantes: ' + (limit || 'Sem limite'),
    'Descrição: ' + (val('trip-description') || 'Sem descrição'),
    'Inscrições: automáticas para os familiares; convidados geridos pelo administrador.'
  ];
  // textContent avoids HTML injection from user-entered fields.
  $('trip-preview').textContent = lines.join('\n');
  $('trip-result').hidden = false;
  $('trip-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
form.addEventListener('submit', event => { event.preventDefault(); preview(); });
form.addEventListener('reset', () => {
  $('trip-result').hidden = true;
  $('trip-errors').hidden = true;
  $('trip-errors').textContent = '';
});
authorize();
