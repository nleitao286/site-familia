# Migração para Supabase — Site da Família

O site continua a funcionar no GitHub Pages com o sistema atual até a ligação Supabase estar ativa. O projeto e os quatro documentos já existem no Supabase, mas o cliente web ainda não foi transferido. **Os ficheiros nesta pasta não criam um projeto Supabase por si só.**

## Contas e palavras-passe

A família escolheu contas individuais e gestão pelo Nuno. Consultar [configuração, segurança e publicação](../docs/ACESSOS-PASSWORD.md). As alterações estão em PR; não assumir que a função e a migração já foram aplicadas.

## Autenticação e redirecionamentos

Para a tarefa #1, consultar [o diagnóstico e os passos de validação](../docs/AUTH-LOGIN.md). O retorno HTTP atual aponta para GitHub Pages, mas login real e confirmação no Dashboard continuam pendentes. Não voltar a executar esquema/importação para corrigir Auth.

## Preparação no Supabase

1. Entrar em https://supabase.com/dashboard e criar um projeto na região **EU Central (Frankfurt)**, se disponível para a organização e plano. Escolher o plano gratuito.
2. No **SQL Editor**, executar `01-schema.sql` e depois `02-importar-dados.sql`. A importação usa os dados JSON já existentes no GitHub e não substitui linhas previamente criadas.
3. Em **Authentication**, ativar os utilizadores individuais por e-mail confirmado. A lista autorizada está na tabela privada `private.familia_convites`, criada numa migração posterior à `01-schema.sql`; existe um trigger de `auth.users` que associa apenas e-mails confirmados e autorizados. Os e-mails e palavras-passe não devem ser colocados no repositório.
4. **Em instalações novas sem o trigger de convites**, após os utilizadores estarem criados, consultar os UUID em **Authentication → Users** e autorizar cada um no SQL Editor:
   ```sql
   insert into public.familia_membros (user_id, nome)
   values
     ('UUID-REAL-FILIPA', 'Filipa'),
     ('UUID-REAL-NUNO', 'Nuno'),
     ('UUID-REAL-MARTIM', 'Martim'),
     ('UUID-REAL-MADALENA', 'Madalena')
   on conflict (user_id) do update set nome = excluded.nome;
   ```
   Substituir os UUID pelos identificadores reais. Só estas contas podem ler e atualizar os dados.
5. Para ligar o site, será necessário definir a **Project URL** e a **publishable/anon key**. Esta chave pública pode ser usada num cliente web **apenas** com RLS corretamente configurado. **Nunca** colocar a `service_role`, `secret key`, palavra-passe do projeto ou JWT de utilizadores no repositório.
6. Antes de ativar no site em produção, testar entrada, saída, leitura e gravação de duas contas, conflito de edição, e confirmar que um utilizador não autorizado não lê dados. Fazer cópia de segurança dos dados no GitHub. Depois migrar a interface de dados para Supabase.

## Esquema

- `familia_membros`: relação entre utilizadores Supabase Auth e membros da família.
- `familia_dados`: quatro documentos JSONB (`refeicoes`, `viaturas`, `compras`, `compromissos`) com número de versão.
- `guardar_familia_dados(tema, conteudo, versao)`: atualiza uma linha apenas quando o utilizador é membro e o número de versão corresponde. Caso não exista versão coincidente, retorna zero linhas: o cliente deve mostrar um conflito e conservar as alterações locais.

**Segurança:** o RLS protege leituras; a tabela não permite escrita diretamente pelo cliente. O RPC inicial usa `SECURITY INVOKER` e a política RLS controla a autorização. Atualmente também existe permissão UPDATE direta para membros; **o Codex deve rever isto antes da migração** porque a alteração direta pode contornar o controlo otimista por versão. Verificar políticas com contas reais antes de utilizar.

## Estado

- [x] Esquema PostgreSQL e políticas preparadas no repositório.
- [x] Script de importação dos dados atuais preparado.
- [x] Projeto Supabase `site-familia` criado na região `eu-central-1` (Frankfurt). ID: `rhpmebmytzmfwitjrfau`. Custo confirmado para criação: 0 USD/mês.
- [x] Esquema SQL aplicado no projeto, RLS ativo, importação dos quatro temas verificada, avisos de segurança consultados (sem resultados).
- [ ] Quatro contas de utilizador autenticadas e confirmadas. Um endereço de e-mail foi pré-autorizado na tabela de convites privados, mas ainda não houve confirmação de login funcional.
- [ ] Cliente web integrado no Supabase, testado e ativado.

**Problemas pendentes conhecidos:** magic link redirecionou para `localhost:3000` (Auth Site URL / Redirect URLs); pedido de email atingiu `email rate limit exceeded`. Estão registados como tarefas em `docs/ROADMAP.md` e nas issues do GitHub.

**Atenção:** enquanto as últimas etapas estiverem por fazer, o site **não** usa a nova base de dados. Continua com o sistema JSON/GitHub e as respetivas limitações de gravação. Não retirar os ficheiros JSON nem apagar dados locais até a migração estar concluída.
