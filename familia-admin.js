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
    const actions = $('admin-action');
    for(const option of actions.options){
      option.disabled = !person || (option.value==='create' ? person.exists : !person.exists) || (option.value==='suspend' && person.admin);
    }
    if(person && [...actions.options].find(option=>option.value===actions.value)?.disabled)actions.value=person.exists?'password':'create';
    const action = actions.value, needsPassword = ['create','password'].includes(action);
    $('admin-password-fields').hidden = !needsPassword;
    $('admin-password').required = !clientDisabled() && needsPassword;
    $('admin-password-confirm').required = $('admin-password').required;
    $('admin-state').textContent = person ? `${person.nome}: ${person.exists ? person.active ? 'acesso ativo' : 'acesso por ativar ou suspenso' : 'conta por criar'}.` : '';
    const password=$('admin-password').value, confirmation=$('admin-password-confirm').value;
    let hint='';
    if(needsPassword){
      if(!password)hint='Escreve a nova palavra-passe e repete-a no segundo campo.';
      else if(password.length<12)hint='A palavra-passe precisa de pelo menos 12 caracteres.';
      else if(new TextEncoder().encode(password).length>72)hint='A palavra-passe é demasiado longa. Usa até 72 bytes.';
      else if(!confirmation)hint='Repete a palavra-passe no segundo campo.';
      else if(password!==confirmation)hint='As duas palavras-passe ainda não são iguais.';
      else hint='As palavras-passe coincidem. Já podes guardar.';
    }
    $('admin-password-hint').textContent=hint;
    const validPassword=!needsPassword || (password.length>=12 && new TextEncoder().encode(password).length<=72 && password===confirmation);
    $('admin-save').textContent=busy?'A GUARDAR…':action==='create'?'CRIAR CONTA E GUARDAR':action==='password'?'GUARDAR PALAVRA-PASSE':action==='suspend'?'SUSPENDER ACESSO':'REATIVAR ACESSO';
    $('admin-save').disabled=busy || !person || !validPassword || [...actions.options].find(option=>option.value===action)?.disabled;
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
  $('admin-person').addEventListener('change', () => { clearPasswords(); $('admin-action').value=people.find(person=>person.nome===$('admin-person').value)?.exists?'password':'create'; $('admin-message').hidden = true; selection(); });
  $('admin-action').addEventListener('change', () => { clearPasswords(); $('admin-message').hidden = true; selection(); });
  for(const id of ['admin-password','admin-password-confirm'])for(const event of ['input','change'])$(id).addEventListener(event,selection);
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
