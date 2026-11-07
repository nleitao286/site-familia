# SITE-FAMILIA — Arquitetura e inventário

## Identificação

- Repositório: https://github.com/nleitao286/site-familia
- Pages (endereço esperado): https://nleitao286.github.io/site-familia/
- Base de dados: https://supabase.com/dashboard/project/rhpmebmytzmfwitjrfau
- Supabase Project ID: `rhpmebmytzmfwitjrfau`
- Região: `eu-central-1` (Frankfurt)
- Estado: **migração em curso, não operacional ponta a ponta**.

## Mapa de ficheiros

| Ficheiro | Responsabilidade |
| --- | --- |
| `index.html` | Painel familiar e exportação/importação de cópias |
| `menu.html` | Refeições, criação de pratos, seleção de almoços/jantares, impressão |
| `viaturas.html` | Registo de veículos, seguros, inspeções, manutenção e pneus |
| `compras.html` | Lista de supermercado |
| `compromissos.html` | Pagamentos, contadores, tarefas regulares e histórico |
| `entrar.html`, `familia-login.js` | Login inicial Supabase Auth por e-mail/OTP |
| `app.js` | Interação das 5 páginas de dados |
| `sync.js` | Persistência antiga em JSON GitHub API/localStorage |
| `recovery.js`, `recuperar.html` | Recuperação e exportação de cópias locais |
| `styles.css` | Estilos responsivos, impressão |
| `dados/*.json` | Dados antigos, **públicos**; não usar como fonte de verdade após migração |
| `supabase/01-schema.sql` | Esquema de membro/documento + RLS + RPC (representa configuração inicial) |
| `supabase/02-importar-dados.sql` | Cópia inicial dos quatro documentos |
| `supabase/README.md` | Instruções de migração existentes; rever contra estado atual |
| `AGENTS.md` | Instruções de engenharia para Codex |
| `docs/ROADMAP.md` | Prioridades, aceitação e tarefas pendentes |

## Modelo de dados (atual)

- `public.familia_dados(tema text PK, conteudo jsonb, versao bigint, atualizado_em, atualizado_por)`: 4 documentos JSONB por tema (`refeicoes`, `viaturas`, `compras`, `compromissos`).
- `public.familia_membros(user_id uuid PK -> auth.users, nome)`: identifica familiares; RLS ativo.
- `private.familia_convites(email text PK, nome)`: lista fechada de endereços autorizados.
- Trigger em `auth.users`: após confirmação do email, autoriza/revoga membro conforme a lista de convites.
- `public.guardar_familia_dados(p_tema, p_conteudo, p_versao)`: função com atualização condicional por versão. Revisitar política de UPDATE direto, que hoje permite contornar essa verificação.
- Números verificados no início da migração: 4 pratos na biblioteca, 4 viaturas, 3 artigos de compra, 5 compromissos. Isso **não** significa que todos os dados locais não publicados estejam migrados.

## Fluxo pretendido

```text
iPhone Chrome / Safari / computador
             |
       GitHub Pages
             |
     Supabase Auth (login)
             |
  PostgreSQL com RLS / RPC
             |
  dados partilhados e versões
```

## Fluxo atual (atenção)

```text
Página principal -> app.js -> localStorage -> sync.js -> GitHub JSON
Página entrar.html -> familia-login.js -> Supabase Auth
Supabase PostgreSQL: 4 documentos importados, ainda não usados por app.js
```

## Problemas observados

1. Criar pratos num navegador não os tornava visíveis noutro: gravação não confirmada no GitHub, dados só locais.
2. Login Supabase sem proteção do restante site.
3. Redirect de magic link foi para `http://localhost:3000`; ajustar Site URL e allow list no Dashboard.
4. Serviço SMTP de demonstração atingiu `email rate limit exceeded`; evitar tentativas repetidas; considerar SMTP próprio.
5. Dados antigos acessíveis publicamente no GitHub (mesmo se a aplicação futura for privada).

## Cuidados na migração

Fazer exportações antes de alterar o armazenamento. Se houver diferenças entre dados atuais no Chrome e documentos do Supabase, mostrar comparação e permitir conciliação. Não substituir por omissão. Prever modo de leitura e aviso de falha sem representar persistência local como gravação confirmada.
