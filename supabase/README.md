# Migração para Supabase — Site da Família

O site continua a funcionar no GitHub Pages com o sistema atual até a ligação Supabase estar ativa. **Os ficheiros nesta pasta não criam um projeto Supabase por si só.**

## Preparação no Supabase

1. Entrar em https://supabase.com/dashboard e criar um projeto na região **EU Central (Frankfurt)**, se disponível para a organização e plano. Escolher o plano gratuito.
2. No **SQL Editor**, executar `01-schema.sql` e depois `02-importar-dados.sql`. A importação usa os dados JSON já existentes no GitHub e não substitui linhas previamente criadas.
3. Em **Authentication**, criar/ativar os quatro utilizadores individuais (por exemplo, por convite ou registo por e-mail). Os e-mails e palavras-passe não devem ser colocados no repositório.
4. Após os utilizadores estarem criados, consultar os identificadores UUID em **Authentication → Users** e autorizar cada um no SQL Editor:
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

**Segurança:** o RLS protege leituras; a tabela não permite escrita diretamente pelo cliente. Um RPC `SECURITY DEFINER` autoriza a escrita depois de confirmar `auth.uid()` como membro. Verificar políticas com contas reais antes de utilizar.

## Estado

- [x] Esquema PostgreSQL e políticas preparadas no repositório.
- [x] Script de importação dos dados atuais preparado.
- [ ] Projeto Supabase criado e ligado pelo proprietário.
- [ ] SQL executado no projeto.
- [ ] Quatro contas de utilizador e respetivos UUID autorizados.
- [ ] Cliente web integrado no Supabase, testado e ativado.

**Atenção:** enquanto as últimas etapas estiverem por fazer, o site **não** usa a nova base de dados. Continua com o sistema JSON/GitHub e as respetivas limitações de gravação. Não retirar os ficheiros JSON nem apagar dados locais até a migração estar concluída.
