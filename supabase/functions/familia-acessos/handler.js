// Só este módulo de servidor recebe a chave administrativa. Nunca registar pedidos.
const ORIGIN = 'https://nleitao286.github.io';
const NAMES = ['Nuno', 'Filipa', 'Martim', 'Madalena'];
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

export function readAccessConfig(adminId, value) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(adminId || '')) throw Error('config');
  const people = JSON.parse(value || 'null');
  if (!Array.isArray(people) || people.length !== NAMES.length) throw Error('config');
  const normalized = NAMES.map(nome => {
    const matches = people.filter(person => person?.nome === nome);
    if (matches.length !== 1) throw Error('config');
    const email = normalizeEmail(matches[0].email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Error('config');
    return { nome, email };
  });
  if (new Set(normalized.map(person => person.email)).size !== NAMES.length) throw Error('config');
  return { adminId, people: normalized };
}

export function createHandler({ client, config }) {
  return async request => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': ORIGIN, 'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    const respond = (status, body) => new Response(JSON.stringify(body), { status, headers });
    const origin = request.headers.get('origin');
    if (origin && origin !== ORIGIN) return respond(403, { error: 'Origem não autorizada.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond(405, { error: 'Método não permitido.' });
    if (!config || !client) return respond(503, { error: 'A gestão de acessos ainda não está configurada.' });
    try {
      const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') || '');
      if (!match) return respond(401, { error: 'Inicia sessão para continuar.' });
      // getUser valida o JWT no Auth. Nunca confiar no nome/e-mail/metadados do pedido.
      const { data: { user }, error: authError } = await client.auth.getUser(match[1]);
      if (authError || !user) return respond(401, { error: 'Sessão inválida ou expirada.' });
      if (user.id !== config.adminId || !user.email_confirmed_at || normalizeEmail(user.email) !== config.people[0].email) {
        return respond(403, { error: 'Só o administrador pode gerir os acessos.' });
      }
      const { data: member, error: memberError } = await client.from('familia_membros').select('nome').eq('user_id', user.id).maybeSingle();
      if (memberError) return respond(503, { error: 'Não foi possível verificar a autorização.' });
      if (!member || member.nome !== 'Nuno') return respond(403, { error: 'Acesso administrativo não autorizado.' });
      const raw = await request.text();
      if (raw.length > 4096) return respond(413, { error: 'Pedido demasiado longo.' });
      let body;
      try { body = JSON.parse(raw); } catch { return respond(400, { error: 'Pedido inválido.' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return respond(400, { error: 'Pedido inválido.' });
      const actions = ['list', 'create', 'password', 'suspend', 'activate'];
      if (!actions.includes(body.action)) return respond(400, { error: 'Operação inválida.' });
      const person = config.people.find(person => person.nome === body.nome);
      if (body.action !== 'list' && !person) return respond(400, { error: 'Pessoa não autorizada.' });
      if (body.action === 'suspend' && person.nome === 'Nuno') return respond(400, { error: 'O administrador não pode suspender o próprio acesso.' });
      if (['create', 'password'].includes(body.action)) {
        if (typeof body.password !== 'string' || body.password.length < 12 || new TextEncoder().encode(body.password).length > 72) {
          return respond(400, { error: 'Usa uma palavra-passe com pelo menos 12 caracteres e até 72 bytes.' });
        }
      }
      // O projeto tem poucas contas; paginação limitada e falha fechada, sem truncar resultados.
      const users = [];
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
        if (error) return respond(502, { error: 'Não foi possível consultar as contas.' });
        users.push(...data.users);
        if (data.users.length < 100) break;
        if (page === 10) return respond(503, { error: 'É necessária revisão administrativa da lista de contas.' });
      }
      const { data: members, error: membersError } = await client.from('familia_membros').select('user_id');
      if (membersError) return respond(502, { error: 'Não foi possível consultar os acessos.' });
      if (body.action === 'list') {
        return respond(200, { people: config.people.map(person => {
          const account = users.find(account => normalizeEmail(account.email) === person.email);
          return { ...person, exists: !!account, active: !!account && !!account.email_confirmed_at &&
            !(Date.parse(account.banned_until) > Date.now()) && members.some(member => member.user_id === account.id),
            admin: person.nome === 'Nuno' };
        }) });
      }
      let account = users.find(account => normalizeEmail(account.email) === person.email);
      // Não aceitar user_id/email/role fornecidos pelo navegador, nem alterar os de outra conta.
      if (person.nome === 'Nuno' && account?.id !== config.adminId) return respond(409, { error: 'A conta administrativa requer revisão no Supabase.' });
      if (body.action === 'create' && account) return respond(409, { error: 'A conta já existe. Usa a opção de definir palavra-passe.' });
      if (body.action !== 'create' && !account) return respond(404, { error: 'Cria primeiro a conta desta pessoa.' });
      const active = !!account && !!account.email_confirmed_at && !(Date.parse(account.banned_until) > Date.now()) && members.some(member => member.user_id === account.id);
      const { error: invitationError } = await client.rpc('familia_configurar_convite', {
        p_email: person.email, p_nome: person.nome, p_ativo: body.action !== 'suspend' && (body.action !== 'password' || active)
      });
      if (invitationError) return respond(502, { error: 'Não foi possível preparar a autorização. Verifica a migração de gestão de acessos no Supabase.' });
      if (body.action === 'create') {
        if (account) return respond(409, { error: 'A conta já existe. Usa a opção de definir palavra-passe.' });
        const { data, error } = await client.auth.admin.createUser({ email: person.email, password: body.password, email_confirm: true });
        if (error) return respond(502, { error: 'Não foi possível criar a conta. Verifica os requisitos da palavra-passe e atualiza a lista antes de repetir.' });
        account = data.user;
      } else if (!account) return respond(404, { error: 'Cria primeiro a conta desta pessoa.' });
      if (body.action === 'password') {
        const { error } = await client.auth.admin.updateUserById(account.id, { password: body.password });
        if (error) return respond(502, { error: 'Não foi possível definir a palavra-passe. Verifica os requisitos no Supabase.' });
        return respond(200, { message: 'Palavra-passe definida. O estado de acesso foi mantido.' });
      }
      if (body.action === 'suspend') {
        const { error: banError } = await client.auth.admin.updateUserById(account.id, { ban_duration: '876000h' });
        if (banError) return respond(502, { error: 'Não foi possível suspender a conta.' });
        const { error } = await client.from('familia_membros').delete().eq('user_id', account.id);
        if (error) return respond(502, { error: 'A conta foi bloqueada no Auth, mas falta revogar o acesso aos dados. Repete a suspensão ou revê no Supabase.' });
        return respond(200, { message: 'Acesso suspenso. Os dados foram preservados.' });
      }
      if (body.action === 'activate') {
        const { error } = await client.auth.admin.updateUserById(account.id, { ban_duration: 'none', email_confirm: true });
        if (error) return respond(502, { error: 'Não foi possível reativar a conta.' });
      }
      const { error } = await client.from('familia_membros').upsert({ user_id: account.id, nome: person.nome }, { onConflict: 'user_id' });
      if (error) {
        // Não apagar uma conta já criada. Bloquear Auth até o administrador conciliar.
        const { error: blockError } = await client.auth.admin.updateUserById(account.id, { ban_duration: '876000h' });
        return respond(502, { error: blockError ? 'A operação ficou incompleta. Revê imediatamente o estado da conta e as permissões no Supabase.' : 'A conta foi preservada e bloqueada porque não foi possível autorizar o acesso. Atualiza a lista e tenta reativar.' });
      }
      return respond(200, { message: body.action === 'create' ? 'Conta criada com acesso familiar.' : 'Acesso reativado.' });
    } catch {
      // Não devolver nem registar erros brutos do SDK: podem incluir dados privados.
      return respond(500, { error: 'Não foi possível concluir a operação. Atualiza a lista antes de repetir.' });
    }
  };
}
