# Contas individuais e administração dos acessos

## Decisão e estado

A família escolheu e-mail e palavra-passe para Nuno, Filipa, Martim e Madalena.
Só o Nuno administra os acessos das outras pessoas no site. O utilizador
forneceu os quatro endereços em privado; não são incluídos no repositório.
Cada conta mantém o seu UUID e os dados familiares existentes são preservados.

Este PR prepara o cliente, a função de servidor e uma migração. **Não está
publicado em produção:** não foram criadas contas ou alteradas palavras-passe,
convites ou dados reais durante a preparação. O login por ligação já foi
confirmado pelo utilizador no iPhone, incluindo logout e nova entrada após a
reposição da quota. A palavra-passe e o painel novo precisam de teste real após
configuração e publicação.

## Utilização após publicação

1. Na página **Entrar**, usar e-mail e palavra-passe. Este fluxo não envia e-mails.
2. Se uma pessoa ainda não tiver conta ou se esquecer da palavra-passe, fala
   com o Nuno. Não existe inscrição pública nem recuperação automática nesta UI.
3. O Nuno entra com a sua conta existente. Pode usar a sessão já iniciada ou,
   para o primeiro acesso, a alternativa **Entrar por ligação de e-mail**,
   sujeita à quota SMTP. Não deve criar uma segunda conta administrativa.
4. O painel **Gerir acessos** só recebe a lista após autorização no servidor.
   Selecionar a pessoa e a operação: criar conta, definir palavra-passe,
   suspender ou reativar. Para uma conta existente, usar **Definir palavra-passe**,
   que preserva o UUID e não altera o estado ativo/suspenso.
5. Definir primeiro a palavra-passe do próprio Nuno, se necessário. Depois,
   criar os três acessos restantes. Escolher uma palavra-passe diferente por
   pessoa, com pelo menos 12 caracteres e até 72 bytes, repetida nos dois campos.
6. Partilhar cada palavra-passe pessoalmente ou por um canal privado. Nunca
   colocar palavras-passe no chat, GitHub, ficheiros de dados ou capturas de ecrã.
   O painel não mostra palavras-passe existentes nem as guarda no armazenamento
   do navegador; os campos são limpos depois da tentativa.

A exclusividade do Nuno aplica-se à gestão **de outras contas** através da
aplicação. O Supabase permite que uma pessoa autenticada altere a própria
palavra-passe através da API Auth; não se promete bloquear essa capacidade.
Os proprietários do projeto Supabase continuam a ter os poderes da plataforma.

## Configuração privada necessária para publicar

As ferramentas disponíveis não permitem escrever os secrets da função.
Foi preparado localmente `supabase/.env.local`, ignorado pelo git, com permissões
0600, o UUID da conta confirmada do Nuno e os quatro endereços fornecidos.
O ficheiro **não contém palavras-passe nem chaves administrativas**. Não o
adicionar ao PR nem partilhar o seu conteúdo em comentários públicos.

No [projeto Supabase existente](https://supabase.com/dashboard/project/rhpmebmytzmfwitjrfau):

1. Rever o PR. Em **Authentication → Users**, confirmar que o UUID em
   `FAMILIA_ADMIN_USER_ID` pertence à conta confirmada do Nuno que já consta
   de `public.familia_membros`. Não usar um e-mail no lugar do UUID.
2. Em **Edge Functions → Secrets**, configurar:
   - `FAMILIA_ADMIN_USER_ID`: UUID da conta existente do Nuno.
   - `FAMILIA_ACESSOS`: array JSON com exatamente quatro objetos `{ "nome": ...,
     "email": ... }`, um para cada pessoa, usando os endereços fornecidos em
     privado. Comparar os valores com `supabase/.env.local` sem os publicar.
3. Aplicar no SQL Editor apenas a migração deste PR:
   `supabase/migrations/20261108113828_respeitar_suspensao_familiar.sql`.
   Não voltar a executar os scripts antigos de criação/importação de dados.
   A migração não cria contas nem altera a lista atual de convites.
4. Publicar a Edge Function **familia-acessos**, com o conteúdo de
   `supabase/functions/familia-acessos`, dependências fixadas e lockfile em
   `supabase/functions/deno.lock`. Manter **Verify JWT** ativo, conforme
   `supabase/config.toml`. Não desligar a verificação para contornar um 401.
5. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizados pelo runtime
   da função Supabase. A chave administrativa nunca vai para HTML, JS do cliente,
   `.env.local` preparado ou repositório. O cliente usa a publishable key existente.
6. Em Authentication, manter o fornecedor Email e a confirmação de e-mail.
   Desativar inscrições públicas se ainda estiverem permitidas. A criação
   administrativa confirma apenas os endereços previamente autorizados pelo Nuno;
   não altera a configuração global de confirmação. A alternativa por magic link
   pede `shouldCreateUser: false` e não cria contas automaticamente.
7. Rever a política de palavras-passe do projeto. O advisor atual assinala a
   proteção de palavras-passe comprometidas como desligada; avaliar a ativação
   nas opções disponíveis do projeto, mantendo no mínimo 12 caracteres no painel.
   [Documentação oficial](https://supabase.com/docs/guides/auth/password-security).
8. Só depois de o backend estar pronto, integrar/publicar o frontend por GitHub
   Pages. Testar com o Nuno antes de distribuir acessos à família.

Sem configuração válida, a função devolve 503 e não altera contas. Sem a
migração, operações de alteração falham antes de chamar a API administrativa.
A ausência do painel não é confirmação de configuração concluída.

## Fronteiras de segurança e conservação de dados

- Todas as operações verificam o JWT com `getUser`, UUID administrativo,
  e-mail confirmado e associação familiar atual. Não usam `user_metadata`
  nem campos do pedido para atribuir privilégios.
- O servidor resolve o e-mail e o nome pela configuração privada. Ignora
  UUIDs, e-mails e papéis manipulados no pedido. Só as quatro identidades
  configuradas podem ser geridas. O painel não concede privilégios administrativos.
- Os convites privados são preparados por um RPC `SECURITY INVOKER` cuja
  execução só é concedida a `service_role`. `anon` e `authenticated` não
  podem chamar esse RPC ou escrever nos convites. A função Edge verifica
  primeiro que o chamador é o Nuno, antes de o invocar.
- A migração mantém o trigger existente, acrescenta a verificação de bloqueio
  Auth e reage a alterações de `banned_until`. Assim, suspender retira a
  associação familiar; os JWT antigos deixam de passar nas políticas RLS
  existentes. Repor uma palavra-passe suspensa mantém o convite revogado.
- A suspensão não elimina a conta nem os seus registos. O próprio administrador
  não pode suspender-se pelo painel. Se uma operação falhar parcialmente, a
  interface indica que é necessário conciliar; nunca anuncia sucesso completo.
- Não existem escritas nos quatro documentos, JSON, `app.js`, `sync.js` ou
  mecanismos de recuperação neste trabalho. A autorização do Supabase não
  protege os JSON públicos nem conclui a migração da persistência antiga.
- Pessoas suspensas podem continuar a ver dados antigos que já guardaram ou
  que permanecem públicos no GitHub. A privacidade global exige as tarefas
  restantes do roadmap.

## Testes reproduzíveis

Sem dependências adicionais, com Node 24:

```sh
node tests/auth-login.test.cjs
node tests/admin-access.test.cjs
node --check familia-login.js
node --check familia-admin.js
```

Os testes usam identidades fictícias e APIs simuladas; não enviam e-mails.
Para o teste de PostgreSQL local, instalar a dependência de teste numa pasta
local/temporária, nunca no frontend:

```sh
npm install --prefix /tmp/site-familia-dbtest --no-save --ignore-scripts @electric-sql/pglite@0.5.15
SITE_FAMILIA_PGLITE_MODULE=/tmp/site-familia-dbtest/node_modules/@electric-sql/pglite node tests/access-rls.test.cjs
```

O teste executa a migração numa base em memória e verifica RLS, rejeição de RPC
por anónimo/membro, convites privados, suspensão com o mesmo UID/JWT, reset
sem reativação, reativação e conservação do conteúdo/versão dos documentos.

O teste `tests/browser-auth.py` usa Playwright 1.62.0 e Chromium instalado em
`/usr/bin/chromium`. Executar `python tests/browser-auth.py` num ambiente com
essas ferramentas. Cobre login sem e-mail, visibilidade administrativa,
criação, reposição, suspensão, reativação, logout, utilizador comum e alternativa
por ligação em 1280×900 e 390×844. Não equivale a iPhone/Safari real.

Verificação da função com Deno 2.9.6:

```sh
deno check --frozen --lock=supabase/functions/deno.lock supabase/functions/familia-acessos/index.ts
```

Antes do lançamento: validar no projeto real login por palavra-passe do Nuno,
criação de uma conta familiar, rejeição do painel por outro membro, logout e
suspensão/reativação com RLS, sem partilhar tokens ou palavras-passe. A integração
real e os testes de iPhone da nova UI continuam pendentes.

## Reversão

Reverter as alterações do frontend volta a mostrar o acesso anterior. A migração
é compatível com o fluxo antigo e deve manter-se enquanto existirem contas
suspensas; não reintroduzir um trigger que ignore bloqueios. Não apagar contas,
convites, documentos nem palavras-passe como forma de reverter a interface.

Se o Nuno perder o acesso, o proprietário do projeto recupera a conta existente
pelo Dashboard, confirma o UUID e a associação familiar, e repõe a palavra-passe.
Não mudar `FAMILIA_ADMIN_USER_ID` para outra pessoa como solução temporária.
