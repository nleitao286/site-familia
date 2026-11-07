# SITE-FAMILIA — Instruções para o Codex

Lê primeiro este ficheiro, `README.md`, `docs/ARCHITECTURE.md` e `docs/ROADMAP.md` antes de modificar código.

## Objetivo

Site familiar, em português europeu, para Filipa, Nuno, Martim e Madalena. Permite planear refeições (almoço/jantar), gerir viaturas, lista de compras e compromissos. O objetivo principal atual é migrar de JSON público/GitHub para **Supabase autenticado e partilhado entre navegadores**.

## Estado real (não assumir migração concluída)

- Site estático alojado com GitHub Pages, originado da branch `main`, na raiz.
- `index.html`, `menu.html`, `viaturas.html`, `compras.html`, `compromissos.html` usam `app.js` e `sync.js` (GitHub JSON + `localStorage`). **Não usam ainda Supabase para os dados.**
- `entrar.html` + `familia-login.js` têm um primeiro formulário Supabase Auth (magic link/OTP); **não protegem as outras páginas**.
- Projeto Supabase existente: `rhpmebmytzmfwitjrfau` (região `eu-central-1`). Dados já importados em `public.familia_dados`; autenticador familiar em `public.familia_membros` e `private.familia_convites`.
- A primeira conta familiar foi pré-autorizada mas **não foi confirmado login bem-sucedido**.
- Falha observada: e-mail de login redirecionou para `localhost:3000` (configuração Auth Site URL / redirect URLs); também foi observado `email rate limit exceeded`.
- Repositório **público**, incluindo `dados/*.json` e histórico anterior. Não inserir dados privados nem credenciais nele.

## Segurança prioritária

1. Não divulgar nem comitar credenciais, senhas, tokens pessoais, `service_role`, `sb_secret_*`, cookies, JWTs ou segredos SMTP. A **publishable key** Supabase é de cliente, mas a autorização é garantida por Auth + RLS; nunca a tratar como segredo nem como autenticação.
2. Todas as leituras e alterações reais têm de depender de sessão Supabase Auth e políticas RLS. Nunca usar o frontend, `localStorage` ou um token GitHub como fronteira de segurança.
3. Verificar URLs de redirecionamento de login no projeto, sem escrever segredos no código.
4. Preservar o histórico e os dados locais de utilizadores que fizeram alterações ainda não publicadas. **Não sobrescrever `localStorage` com dados remotos sem aviso, cópia e opção de conciliação.**
5. Não apagar ficheiros JSON públicos ou migrar dados privados sem estratégia explícita: o histórico de git já publicou dados passados. Recomendar a privacidade e tratar eventual remoção do histórico separadamente.
6. Todas as tabelas expostas pela Data API devem ter RLS ativado; testar operações para membro autenticado e utilizador não autorizado.
7. Evitar perda de atualizações simultâneas: `familia_dados.versao` e RPC `guardar_familia_dados` suportam controlo otimista. Atualmente a tabela também concede UPDATE a membros: avaliar revogar UPDATE direto para obrigar o uso de RPC, preservando RLS com função segura.
8. Usar documentação Supabase atual antes de introduzir alterações em Auth ou base de dados.

## Desenvolvimento

- Manter visual inspirado em estilo editorial escuro/vermelho, responsivo iPhone.
- Português de Portugal em toda a interface e documentação dirigida à família.
- Sem dependência de Node no frontend atual; é HTML/CSS/JS estático. Considerar ferramenta de testes simples e fixar dependências se forem introduzidas.
- Preservar o HTML das páginas e a experiência existente durante a migração.
- Trabalhar por pequenos PRs; não modificar produção nem chaves sem testes.
- Fazer verificações de sintaxe e testes de login, leitura, alteração, atualização entre browsers, conflitos e recuperação de dados.
- Nunca afirmar que dados foram partilhados enquanto não existir confirmação real de gravação remota.

## Como começar

1. Ler `docs/ROADMAP.md`, começar pelo primeiro item **P0**.
2. Rever `familia-login.js` e configuração das Redirect URLs no Dashboard Supabase.
3. Planear e implementar um adaptador de persistência Supabase para `app.js`, substituindo gradualmente `sync.js`.
4. Confirmar todos os comportamentos de segurança e de recuperação antes de desativar a persistência antiga.

Referências: `docs/CODEX.md`, `docs/ARCHITECTURE.md`, `supabase/README.md`.
