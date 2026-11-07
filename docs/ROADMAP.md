# SITE-FAMILIA — Plano de trabalho para Codex

**Objetivo:** site familiar privado com persistência no Supabase, funcional em Chrome, Safari e computador. Priorizar a integridade dos dados; não considerar trabalho concluído sem teste real.

## P0 — Autenticação e segurança (bloqueadores)

Tarefa #1: [diagnóstico, alterações do cliente e validação pendente](AUTH-LOGIN.md). Em 7/11/2026, o teste HTTP de retorno já aponta para GitHub Pages; manter os itens abertos até confirmar Dashboard e login real no iPhone.

- [ ] **Corrigir redirects de autenticação.** No Supabase Auth URL Configuration configurar Site URL `https://nleitao286.github.io/site-familia/` e Redirect URL exata `https://nleitao286.github.io/site-familia/entrar.html`. Diagnosticar e verificar que não abre `localhost:3000`. Estas definições são no Dashboard; alterar o HTML sozinho não resolve.
- [ ] **Resolver limite de e-mails.** Investigar `email rate limit exceeded`; evitar reenvios repetidos; considerar SMTP próprio ou alternativa de login por palavra-passe aprovada, sem desativar proteções precipitadamente.
- [ ] **Verificar acesso do primeiro membro.** Confirmar e-mail, trigger de associação, leitura RLS, logout e rejeição de utilizadores fora da família.
- [ ] **Proteger acesso às páginas de dados.** Redirecionar para `entrar.html` quando não autenticado; impedir exibição de dados protegidos. **Não** afirmar que o site é privado enquanto os JSON públicos estiverem acessíveis.
- [ ] **Rever segurança da escrita.** Testar RLS e RPC com dois membros. Garantir que UPDATE direto não contorna `versao` (eventualmente revogar UPDATE e usar RPC autorizado).
- [ ] **Plano de privacidade do GitHub público.** Não adicionar dados sensíveis; tratar remoção de JSON/histórico de forma deliberada, com cópias e sem perder dados.

## P1 — Migração de persistência

- [ ] Criar um adaptador `supabase-sync.js` ou abstração de repositório para leitura/escrita dos 4 temas por utilizador autenticado.
- [ ] No `app.js`, substituir `sync.js` gradualmente, preservando menu, compras, compromissos e viaturas.
- [ ] Mostrar estados claros: a guardar, guardado no Supabase, sem rede, conflito, alteração local por publicar.
- [ ] Implementar verificação de versão `versao` nas alterações e resolução de conflitos sem perda de dados.
- [ ] Preservar/restaurar alterações locais antigas; garantir backup antes de substituir.
- [ ] Validar várias sessões (iPhone Chrome, Safari, computador) e atualização dos outros clientes. Definir atualização manual e/ou realtime.
- [ ] Desativar a necessidade de token GitHub na experiência final do utilizador.

## P2 — Qualidade e manutenção

- [ ] Testes automáticos (unidades, migração/validação JSON, integração simulada, E2E se possível).
- [ ] Documentar configuração local para Codex; melhorar separação JS, CSS e HTML sem alterar visual.
- [ ] Rever formatos de datas, mobile, acessibilidade e feedback de ações.
- [ ] Backups de dados no Supabase e processo de restauro.
- [ ] Atualizar `README.md` e `supabase/README.md` no momento do corte para produção.

## Critérios de aceitação de lançamento

1. Utilizador anónimo não consegue ler nem alterar os dados privados via UI ou API.
2. Membro autenticado pode inserir uma refeição no Chrome e observá-la noutro navegador depois de atualizar (sem token GitHub).
3. Mudança de um segundo membro não é sobrescrita sem aviso ao gravar em paralelo.
4. Erros de rede mantêm os dados recuperáveis e o site **nunca** mostra sucesso de gravação remota sem confirmação.
5. Dados existentes são conservados, exportáveis e comparados com quaisquer cópias locais.
6. Login, e-mail, redirects, logout e gestão de sessão testados no iPhone.
7. Sem secrets ou dados familiares sensíveis no repositório público.

## Ordem proposta para PRs

1. `fix/auth-redirect-and-login`
2. `feature/supabase-persistence`
3. `fix/rls-and-conflicts`
4. `test/mobile-and-data-recovery`
5. `release/supabase-cutover`

Cada PR deve explicar testes realizados, riscos de perda de dados, e como reverter.
