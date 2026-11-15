# Viagens — inscrições e participantes

## Funcionalidades
- Familiares com sessão Supabase podem consultar viagens e participantes.
- Após o administrador abrir as inscrições, cada familiar inscreve-se a si próprio (ou cancela enquanto estiver aberto).
- Apenas Nuno, como administrador autenticado, pode abrir/fechar inscrições, adicionar/remover convidados externos. Convidados não têm conta ou acesso ao site.
- A lotação indicada na viagem inclui familiares e convidados. A validação e o bloqueio transacional acontecem no PostgreSQL.
- A viagem existente foi mantida como rascunho. Nenhuma inscrição de teste foi persistida.

## Supabase
Migrações aplicadas ao projeto existente: `viagem_participantes_inscricoes_automaticas`, `viagens_nomes_participantes`.

Tabela `public.viagem_participantes`: id, viagem_id, user_id (familiar, opcional), nome_externo (convidado, opcional), nome (apresentação, calculado no servidor) e criado_em. Uma constraint obriga exatamente um dos dois tipos e índice único impede inscrições duplicadas do mesmo membro.

- RLS habilitado em `viagem_participantes`; SELECT limitado à família.
- INSERT para membro na própria inscrição ou para convidado externo apenas pelo administrador. Trigger exige estado `abertas`, prazo e vagas para inscrições familiares. Convidados só podem ser adicionados pelo administrador a viagens não canceladas nem concluídas, respeitando a lotação.
- DELETE para o membro cancelar a sua inscrição enquanto aberta e para administrador retirar convidados.
- UPDATE apenas de `nome_externo` por administrador; trigger sincroniza `nome`.
- `public.viagens`: privilégios UPDATE concedidos **apenas à coluna estado** para `authenticated`, com política de administrador. Inscrições são abertas/fechadas manualmente.
- Não foi usado `service_role` no navegador.

## Testes realizados
Transações SQL com `ROLLBACK`: admin adiciona convidado; membro inscreve-se após abrir; não-admin não adiciona convidados. Todos confirmados. Contagens depois: 1 viagem existente, 0 participantes.
Faltam testes reais de UI em iPhone, múltiplas sessões, conflitos de inscrições e lotação concorrente em simultâneo.

## Limitações
Não existem ainda custos, transportes, itinerário, anexos ou edição das informações básicas. Não colocar informações pessoais no repositório público.
