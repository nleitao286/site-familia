# Abrir SITE-FAMILIA no Codex

## Repositório existente

**https://github.com/nleitao286/site-familia**

Este repositório GitHub é a fonte do código. Está em `main`, com HTML/CSS/JS, quatro módulos funcionais no modo antigo, autenticação Supabase ainda separada e scripts SQL.

## No Codex

1. Abre o Codex no ChatGPT ou em https://chatgpt.com/codex (se disponível na tua conta).
2. Liga a conta GitHub `nleitao286`, se for solicitado.
3. Seleciona o repositório **`nleitao286/site-familia`**; identifica o trabalho como **SITE-FAMILIA** no Codex.
4. Abre `AGENTS.md` e `docs/ROADMAP.md`. Se trabalhares em cloud, assegura que a configuração de ambiente necessária está disponível.
5. Pede ao Codex para trabalhar na primeira tarefa P0, numa branch própria, com PR e testes; revê antes de publicar em `main`.

**Nota:** não há um “projeto Codex” criado automaticamente só por existir este ficheiro. Pode ser necessário selecionar/criar o workspace no próprio Codex. Não precisas de criar um segundo repositório.

## Prompt de arranque recomendado

> Trabalha no projeto SITE-FAMILIA, repositório `nleitao286/site-familia`. Lê `AGENTS.md`, `docs/ARCHITECTURE.md` e `docs/ROADMAP.md`. Começa pela primeira tarefa P0: diagnostica o redirect do Supabase Auth para `localhost:3000` e o limite de e-mails. Se a alteração depender do Dashboard, documenta exatamente os passos, sem inventar acesso. Prepara a integração segura do frontend com Supabase, sem perder dados locais nem mexer nos documentos atuais até existir plano de migração. Cria branch e PR, com testes e riscos.

## Regras para tarefas no Codex

- Repositório público: **não colocar tokens, secrets, credenciais SMTP, chaves `service_role`, ou informação familiar confidencial**.
- Projeto Supabase: `rhpmebmytzmfwitjrfau` (`eu-central-1`). É um identificador de projeto, não uma credencial.
- Dados públicos antigos: `dados/*.json`; só retirar quando a migração para Auth/RLS estiver pronta e verificada.
- O facto de `entrar.html` funcionar não protege `menu.html`, `viaturas.html`, `compras.html` nem `compromissos.html`.
- Código estático sem processo de compilação. Testar em diferentes navegadores e não confiar apenas no `localStorage`.
- Mensagens e documentação voltadas à família em português europeu.

## Ligações úteis

- GitHub: https://github.com/nleitao286/site-familia
- Supabase: https://supabase.com/dashboard/project/rhpmebmytzmfwitjrfau
- Redirecionamentos Auth: https://supabase.com/dashboard/project/rhpmebmytzmfwitjrfau/auth/url-configuration
- Documentação Supabase Auth: https://supabase.com/docs/guides/auth/redirect-urls
