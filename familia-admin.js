// A visibilidade do painel é conveniência; a função verifica sempre a autorização.
export function createAdminPanel(supabase) {
  const $ = id => document.getElementById(id);
  let version = 0, people = [], busy = false;
  function feedback(text, error = false) {
    $('admin-message').textContent = text;
    $('admin-message').dataset.kind = error ? 'error' : 'success';
    $('admin-message').hidden = false;
  }
  async function invoke(body) {
    const { data, error } = await supabase.functions.invoke('familia-acessos', { body });
    if (error) {
      let text = 'Não foi possível contactar a gestão de acessos. Verifica a ligação e a configuração no Supabase.';
      try { text = (await error.context.json()).error || text; } catch {}
      throw new Error(text);
    }
    if (!data || data.error) throw new Error(data?.error || 'Resposta administrativa inválida.');
    return data;
  }
  function selection() {
    const person = people.find(person => person.nome === $('admin-person').value);
    const action = $('admin-action').value;
    $('admin-password-fields').hidden = !['create', 'password'].includes(action);
    $('admin-password').required = !clientDisabled() && ['create', 'password'].includes(action);
    $('admin-password-confirm').required = $('admin-password').required;
    $('admin-state').textContent = person ? `${person.nome}: ${person.exists ? person.active ? 'acesso ativo' : 'acesso por ativar ou suspenso' : 'conta por criar'}.` : '';
    if (person?.admin && action === 'suspend') $('admin-state').textContent += ' O administrador não pode suspender o próprio acesso.';
    if (person && !person.exists && action !== 'create') $('admin-state').textContent += ' Seleciona «Criar conta e definir palavra-passe».';
    if (person?.exists && action === 'create') $('admin-state').textContent += ' A conta já existe; seleciona «Definir palavra-passe».';
    $('admin-save').disabled = busy || !person || (action === 'create' && person.exists) || (action !== 'create' && !person.exists) || (action === 'suspend' && person.admin);
  }
  function clientDisabled() { return $('admin-area').hidden; }
  function clearPasswords() { $('admin-password').value = ''; $('admin-password-confirm').value = ''; }
  function hide() {
    version++; people = []; $('admin-area').hidden = true;
    $('admin-person').replaceChildren(); $('admin-state').textContent = '';
    $('admin-message').hidden = true; clearPasswords();
  }
  async function load() {
    const current = ++version;
    try {
      const data = await invoke({ action: 'list' });
      if (current !== version) return;
      const selected = $('admin-person').value;
      people = data.people;
      $('admin-person').replaceChildren(...people.map(person => {
        const option = document.createElement('option'); option.value = person.nome;
        option.textContent = `${person.nome} — ${person.email}`; return option;
      }));
      if (people.some(person => person.nome === selected)) $('admin-person').value = selected;
      $('admin-area').hidden = false; selection();
    } catch { if (current === version) hide(); }
  }
  $('admin-person').addEventListener('change', () => { clearPasswords(); $('admin-message').hidden = true; selection(); });
  $('admin-action').addEventListener('change', () => { clearPasswords(); $('admin-message').hidden = true; selection(); });
  $('admin-refresh').addEventListener('click', async () => { if (busy) return; hide(); await load(); });
  $('admin-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || clientDisabled() || $('admin-save').disabled) return;
    const action = $('admin-action').value, nome = $('admin-person').value;
    const password = $('admin-password').value;
    if (['create', 'password'].includes(action) && (password.length < 12 || new TextEncoder().encode(password).length > 72 || password !== $('admin-password-confirm').value)) {
      feedback('Usa pelo menos 12 caracteres (até 72 bytes) e repete a mesma palavra-passe nos dois campos.', true); return;
    }
    if (action === 'suspend' && !window.confirm(`Suspender o acesso de ${nome}? Os dados serão preservados.`)) return;
    busy = true; $('admin-refresh').disabled = true; $('admin-person').disabled = true; $('admin-action').disabled = true; selection();
    const current = version;
    try {
      const data = await invoke({ action, nome, ...(['create', 'password'].includes(action) ? { password } : {}) });
      if (current !== version) return;
      clearPasswords(); await load(); feedback(data.message);
    } catch (error) { if (current === version) feedback(error.message, true); }
    finally { busy = false; $('admin-refresh').disabled = false; $('admin-person').disabled = false; $('admin-action').disabled = false; clearPasswords(); selection(); }
  });
  return { load, hide };
}
