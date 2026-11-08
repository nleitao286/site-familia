# Autenticação — diagnóstico e validação da tarefa #1

## Atualização de 8 de novembro de 2026

O utilizador confirmou no iPhone acesso familiar, logout e nova entrada após reposição da quota. A família optou entretanto por [e-mail e palavra-passe com administração do Nuno](ACESSOS-PASSWORD.md), para evitar envios em cada entrada. O diagnóstico abaixo permanece como histórico; a função e migração foram publicadas em 8/11/2026; o frontend segue a integração em `main`, e a validação real por palavra-passe continua pendente.

## Estado verificado em 7 de novembro de 2026

O código deste PR fixa o retorno de `signInWithOtp` em
`https://nleitao286.github.io/site-familia/entrar.html`, independentemente do
endereço onde a página foi aberta. Um preview ou servidor local continua a
receber a sessão no site oficial. Não adicionar URLs arbitrárias à allow list.

A consulta agregada dos logs Auth das últimas 24 horas encontrou 13 eventos
com referência a `localhost:3000` e dois com referência a `rate limit`.
Isto confirma os sintomas anteriores, mas não prova que a configuração atual
continue errada.

Foi feita uma verificação HTTP **sem enviar e-mails**: um GET ao endpoint
`/auth/v1/verify`, com token deliberadamente inválido e `type=magiclink`, sem
seguir o redirecionamento. Resultados atuais:

| Pedido | Resposta | Destino, antes do fragmento de erro |
| --- | --- | --- |
| Sem `redirect_to` | HTTP 303 | `https://nleitao286.github.io/site-familia/` |
| Com `redirect_to` igual ao retorno do cliente | HTTP 303 | `https://nleitao286.github.io/site-familia/entrar.html` |

Ambas as respostas incluem `error_code=otp_expired`, esperado para o token
inválido. **Não houve retorno para localhost nestas verificações.** O
comportamento atual é compatível com Site URL corrigido e retorno autorizado.
Não foi possível ler ou editar as definições Auth com as ferramentas disponíveis;
a verificação não certifica o conteúdo dos modelos de e-mail nem um login real.

## Confirmar no Dashboard antes de dar a tarefa por concluída

No [URL Configuration do projeto existente](https://supabase.com/dashboard/project/rhpmebmytzmfwitjrfau/auth/url-configuration):

1. Confirmar **Site URL**: `https://nleitao286.github.io/site-familia/`.
2. Confirmar em **Redirect URLs** a entrada exata:
   `https://nleitao286.github.io/site-familia/entrar.html`.
3. Se faltar, acrescentar essa entrada, preservando outras entradas legítimas.
   Evitar wildcards em produção. Não criar outro projeto nem executar os scripts
   de esquema/importação para corrigir uma definição de Auth.
4. Guardar se houver alterações e voltar a abrir a página para confirmar.
5. Em **Authentication → Email Templates**, verificar o modelo usado na confirmação
   inicial e no magic link. Preferir a ligação gerada `{{ .ConfirmationURL }}`;
   um modelo personalizado que use apenas `{{ .SiteURL }}` pode ignorar o retorno
   solicitado. Se o modelo construir a ligação manualmente, rever o uso de
   `{{ .RedirectTo }}` segundo a documentação. Não publicar uma ligação real de
   autenticação, pois contém credenciais temporárias.
6. Usar uma ligação nova no teste final: alterar a configuração não reescreve
   e-mails já recebidos.

## Limites de e-mail e recuperação

O cliente impede pedidos em paralelo e impõe uma espera de 60 segundos após
cada tentativa de envio. Guarda apenas o instante da próxima tentativa em
`sessionStorage` (`familia-auth-next-send`), para manter a espera ao recarregar o
mesmo separador. Isto reduz envios acidentais; não é uma proteção do servidor,
não coordena outros separadores/dispositivos e não repõe a quota SMTP.

Em HTTP 429 ou erro de rate limit não existe reenvio automático. A mensagem
pede para aguardar ou contactar o administrador; não promete que a quota
regresse ao terminar a contagem do botão. Outros erros de rede também não
mostram sucesso nem fazem tentativas automáticas.

No Dashboard, consultar **Authentication → Rate Limits**, configuração do
serviço de e-mail/SMTP e logs Auth antes de repetir o envio. O SMTP de teste
tem quotas e restrições de destinatários; confirmar os limites efetivos do
projeto. Para uso familiar regular, avaliar SMTP próprio, com destinatários
permitidos, domínio e remetente verificados. Configurar credenciais apenas no
Dashboard, nunca em ficheiros deste repositório. Não aumentar limites ou desligar
confirmação de e-mail como atalho. Não se configurou SMTP neste PR.

O formulário OTP só funciona quando o modelo recebido inclui um código de
seis dígitos. O cliente verifica-o com o e-mail do último pedido bem-sucedido,
mesmo que o campo do formulário seja editado. Não assumir que um modelo de
magic link também inclui um código. As regras atuais do plano gratuito podem
impedir personalizar modelos com SMTP de teste; nesse caso, avaliar SMTP
próprio antes de alterar o fluxo.

O logout usa `scope: "local"`: termina a sessão atual sem desligar os outros
navegadores da família. Um utilizador autenticado sem associação familiar, ou
com falha na consulta de associação, continua a poder terminar sessão e trocar
de conta. Só aparece «Acesso confirmado» após leitura bem-sucedida do membro.

## Testes e aceitação

Executar, sem instalar dependências de frontend (Node 24):

```sh
node tests/auth-login.test.cjs
node --check familia-login.js
git diff --check
```

Os 13 testes usam uma API simulada: retorno canónico em produção/preview/local,
nenhum envio ao abrir a página, pedido pendente, espera após reload, HTTP 429,
falha de rede, OTP/e-mail correspondente, código inválido/expirado, erros no
retorno, membro/não membro, logout e armazenamento indisponível. Nunca enviam
e-mails nem escrevem na base de dados.

Também foi executado Chromium com Playwright, com a API Supabase simulada,
em 1280×900 e 390×844: envio, URL de retorno, espera após reload, OTP, membro,
logout e erro de callback passaram, sem erros JavaScript ou overflow horizontal.
Uma alteração local de teste manteve-se intacta no `localStorage` durante o
fluxo. A simulação móvel em Chromium **não equivale a Safari/iPhone real**.

Validação real ainda pendente, antes de fechar a issue #1:

- [ ] Confirmar os valores e modelos no Dashboard.
- [ ] Após a quota estar disponível, pedir uma única ligação para um membro já
  autorizado. No iPhone, abrir no mesmo navegador e confirmar que o endereço
  fica em `/site-familia/entrar.html`, sem localhost, com acesso confirmado.
- [ ] Se o e-mail tiver OTP, confirmar o código; caso contrário, testar só a ligação.
- [ ] Terminar sessão e confirmar que o acesso confirmado desaparece; repetir
  em Safari, Chrome e computador. Não partilhar os URLs de retorno com tokens.
- [ ] Confirmar rejeição de conta fora da família com conta de teste autorizada
  para esse ensaio, sem publicar endereços/UUIDs ou criar membros para a contornar.

## Dados, âmbito e reversão

Não se alteraram os JSON, `app.js`, `sync.js`, recuperação de dados, tabelas,
RLS, convites, utilizadores ou chaves. Não foram feitas gravações na base de
dados ou pedidos de envio de e-mail. A autenticação continua separada da
persistência antiga; este PR não torna privadas as outras páginas ou os JSON.

Para reverter o código depois de integrado, reverter o commit deste PR.
A chave de espera em `sessionStorage` deixa de ser usada pelo código antigo;
não é necessário apagar `localStorage` nem restaurar dados. Não reverter uma
configuração Auth correta para localhost. Qualquer mudança futura no Dashboard
deve ser registada separadamente para permitir a sua reversão controlada.

Referências oficiais consultadas:

- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [SMTP próprio](https://supabase.com/docs/guides/auth/auth-smtp)
- [Changelog: modelos de e-mail no plano gratuito](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)
