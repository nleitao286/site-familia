# SITE-FAMILIA — Arquitetura

- Site estático: `https://nleitao286.github.io/site-familia/`.
- Supabase existente: `rhpmebmytzmfwitjrfau`, região `eu-central-1`.
- Contas individuais; só o Nuno administra as quatro identidades autorizadas.

## Fluxo atual

```text
Páginas ocultas → Auth getUser → familia_membros (RLS)
                          ↓
               familia_dados (SELECT com RLS)
                          ↓
              rascunho local por utilizador/página
                          ↓
           guardar_familia_dados (versão condicional)
                          ↓
        função privada / role sem login e sem BYPASSRLS
                          ↓
                 UPDATE com RLS e versão
```

`supabase-client.js` centraliza o cliente de dados. `family-page.js` verifica
acesso antes de carregar `app.js` ou `recovery.js`. `family-store.js` lê os quatro
documentos e conserva rascunhos por utilizador, com versões e conciliação.
`familia-login.js` mantém login/password, alternativa por ligação e o retorno
limitado às páginas conhecidas. `familia-admin.js` chama a Edge Function
`familia-acessos`, que verifica a identidade administrativa no servidor.

`familia_dados(tema,conteudo,versao,atualizado_em,atualizado_por)` conserva os
quatro documentos JSONB. `familia_membros(user_id,nome)` autoriza leitura do
próprio membro e dos documentos familiares. O trigger de Auth associa apenas
convites privados confirmados e respeita `banned_until`.

A role `authenticated` tem SELECT, sem UPDATE direto. O RPC público é invoker;
a função privada que faz a atualização tem um proprietário dedicado sem login,
sem BYPASSRLS e com políticas de membro atual. Nunca se utilizam metadados
editáveis pelo utilizador para decisões de autorização.

As páginas de dados não leem os antigos JSON/GitHub. Os ficheiros públicos
atuais foram retirados com cópia privada; o histórico continua público. O
`sync.js` é só uma ponte para páginas antigas em cache. Não altera dados.

Ver [migração e recuperação](MIGRACAO-DADOS.md),
[administração](ACESSOS-PASSWORD.md) e [roadmap](ROADMAP.md). Testes automáticos
cobrem dois contextos de navegador com API simulada; a validação física no
Chrome/Safari do iPhone continua necessária.
