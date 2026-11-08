# Migração dos dados para Supabase

## Âmbito

As seis páginas de dados e recuperação exigem sessão Supabase Auth e associação
em `familia_membros` antes de carregar a aplicação ou mostrar cópias locais.
O frontend só lê `familia_dados` e grava através de `guardar_familia_dados`.
A publishable key é pública; Auth e RLS são a autorização real.

As páginas começam ocultas, incluindo quando JavaScript está desligado. A
confirmação da sessão ocorre antes de qualquer leitura de documentos e volta a
ser feita ao regressar à página. Logout, ausência de membro ou mudança de conta
retiram a interface e encaminham para a entrada. O retorno do login aceita
apenas os nomes das seis páginas conhecidas, sem redirecionamento externo.

## Escrita e concorrência

A migração `20261108200642_escrita_familiar_versionada.sql` retira UPDATE direto
à role `authenticated`. A função pública é `SECURITY INVOKER` e chama uma
função privada cujo proprietário é `familia_rpc_writer`: sem login, sem
BYPASSRLS e com SELECT/UPDATE limitado aos documentos. Herda os privilégios
Auth normais de `authenticated` pela migração `20261108204420_acesso_auth_da_role_writer.sql`;
a direção inversa não é concedida e os clientes não ganham UPDATE direto. As políticas RLS e a
própria função verificam `auth.uid()` e a associação familiar. Não há concessão
da role aos membros nem utilização de `user_metadata`.

Cada gravação exige o número de versão que foi lido. Uma alteração concorrente
faz o RPC devolver zero linhas: o navegador conserva o rascunho, apresenta as
duas versões e pede conciliação. Só uma resposta com a nova versão esperada é
tratada como confirmação. Erros de rede ou respostas inválidas não mostram
sucesso. Se a resposta se perder depois de gravar, uma leitura posterior pode
reconhecer conteúdo idêntico já confirmado, sem repetir a escrita.

As alterações feitas durante um pedido em curso são mantidas e usam a nova
versão quando for possível gravá-las. O botão **Atualizar dados** consulta o
Supabase; não descarta alterações por confirmar. A atualização entre navegadores
é manual nesta versão, sem promessa de realtime.

## Cópias locais e recuperação

Os dados antigos em `familia-menu-v3`, `familia-viaturas-v1`,
`familia-compras-v1`, `familia-compromissos-v1`, `menu-semana` e histórico GitHub
não são apagados ou substituídos. Uma cópia antiga divergente é apresentada
para comparação e não é publicada automaticamente. Cópias antigas conhecidas
como já publicadas não substituem uma versão mais recente do Supabase.

Os novos rascunhos usam o prefixo `familia-supabase-v1:<user_id>:`. Cada página
mantém um identificador próprio, para não sobrescrever rascunhos de outro
separador. Recibos locais indicam a revisão exata que foi conciliada, sem apagar
os ficheiros originais. São conservadas até dez versões anteriores dentro de
cada rascunho; os restantes rascunhos continuam exportáveis.

Quando há conflito, **Ver e conciliar versões** permite consultar o documento
partilhado, selecionar cópias locais, editar uma versão conciliada e gravá-la.
Se o servidor tiver mudado entretanto, é necessário voltar a comparar.
**Usar dados partilhados** conserva a cópia anterior e não faz uma escrita no
servidor. Importar/restaurar uma cópia cria um conflito explícito para revisão;
não publica automaticamente o conteúdo importado.

**Descarregar cópias** exporta os rascunhos, históricos e chaves antigas de dados.
Não exporta tokens Auth, cookies ou tokens GitHub. Se faltar espaço local, o
rascunho permanece em memória, a gravação automática pára e a interface pede
uma cópia antes de sair. Não apagar os dados do site antes de exportar alterações
pendentes. Logout conserva cópias recuperáveis, mas estas não são mostradas pela
aplicação sem nova autenticação. O acesso físico ao armazenamento do dispositivo
não é protegido por esta barreira de interface.

## Retirada das cópias públicas e limites de privacidade

Antes de retirar ficheiros, os quatro JSON da branch principal foram comparados
com os quatro documentos no Supabase e eram iguais. Foi criada uma cópia privada
fora do repositório, em `/workspace/private-backups/site-familia-before-cutover.json`,
com permissões 0600, incluindo ambas as fontes e o script antigo de importação.
Essa cópia não contém tokens nem credenciais.

Este PR retira os quatro `dados/*.json` e `supabase/02-importar-dados.sql` da
versão atual e impede a sua reintrodução acidental via `.gitignore`. `sync.js`
fica apenas como encaminhamento de páginas antigas; não lê/escreve no GitHub.
Nenhum documento, conta ou versão é apagado no Supabase.

**O histórico do repositório continua público.** Os commits anteriores ainda
podem conter dados e terceiros podem ter cópias. Esta alteração não reescreve o
histórico, não elimina caches de terceiros e não torna o repositório privado.
A limpeza do histórico ou mudança de alojamento/visibilidade exige uma tarefa
separada, com cópia e avaliação do GitHub Pages. Não anunciar privacidade total
dos dados históricos. Novas alterações deixam de ser publicadas no GitHub.

## Publicação e verificação

1. Rever o PR e executar os testes abaixo.
2. Aplicar as duas migrações novas, por ordem, no projeto existente. Não recriar/importar os
   documentos. A migração não altera os conteúdos ou versões existentes.
3. Verificar permissões: anónimo e utilizador fora da família não leem/escrevem;
   membro lê e grava pelo RPC; UPDATE direto é rejeitado.
4. Comparar assinaturas dos quatro documentos antes/depois da migração.
5. Publicar o frontend por integração em `main`, esperar pelo GitHub Pages e
   verificar que os JSON atuais e o script de importação devolvem 404.
6. Testar com a sessão real do Nuno e outro membro: criar uma refeição, atualizar
   o outro navegador, provocar uma edição concorrente e confirmar recuperação.
   Os testes automatizados de navegador usam API simulada; o ensaio físico em
   iPhone/Safari continua necessário.

Testes, com Node 24 e a dependência local de PostgreSQL já descrita em
[ACESSOS-PASSWORD.md](ACESSOS-PASSWORD.md):

```sh
node tests/family-store.test.cjs
node tests/auth-login.test.cjs
node tests/admin-access.test.cjs
SITE_FAMILIA_PGLITE_MODULE=/tmp/site-familia-dbtest/node_modules/@electric-sql/pglite node tests/persistence-rls.test.cjs
SITE_FAMILIA_PGLITE_MODULE=/tmp/site-familia-dbtest/node_modules/@electric-sql/pglite node tests/access-rls.test.cjs
python tests/browser-private-data.py
python tests/browser-auth.py
```

Os testes de navegador precisam de Playwright 1.62.0 e Chromium em
`/usr/bin/chromium`. Não criam contas, não enviam e-mails e não alteram dados reais.

## Reversão

Não voltar a publicar os JSON ou restaurar o sistema de gravação GitHub como
reversão. Em caso de falha, manter as páginas bloqueadas e o acesso pelo login,
conservar os rascunhos e corrigir o adaptador. O backend anterior continua a
poder ler os quatro documentos, mas não deve receber UPDATE direto novamente.
A cópia privada permite recuperar documentos deliberadamente, com comparação
por tema e versão, nunca por importação cega. Não limpar o armazenamento local.
