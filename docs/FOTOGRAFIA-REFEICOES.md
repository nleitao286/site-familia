# Identificar pratos e estimar calorias por fotografia

## Utilização

No menu, escolher a semana/dia e carregar em **Identificar por fotografia** no
almoço ou jantar. Há duas opções: **Tirar fotografia**, que sugere a câmara
traseira em telemóvel, e **Escolher das fotos**, sem obrigar a abrir a câmara.
Em computador, o navegador pode apresentar um seletor de ficheiros em ambos os
casos. A captura real deve ser confirmada em iPhone/Safari/Chrome.

A fotografia é preparada localmente e apresentada antes de qualquer envio.
Indicar o peso da porção, se for conhecido, e carregar em **Analisar fotografia**.
O resultado contém um nome de prato, peso e energia estimada por 100 g.
Corrigir os valores e confirmar **Usar nesta refeição**. Alterar a porção
recalcula a energia: `gramas × kcal por 100 g / 100`.

O resultado é uma **estimativa visual**, não uma medição de ingredientes ou
porção. Azeite, molhos, ingredientes ocultos, escala e preparação podem alterar
as calorias. O nome pode ser corrigido, mas essa edição não provoca outra
análise: rever também os valores. Fotografias sem comida reconhecível são
recusadas em vez de criar um prato fictício.

A refeição selecionada recebe o prato e um campo opcional `nutrition`, com
porção, densidade energética, calorias aproximadas, notas e datas de análise/
revisão. A fotografia não é incluída no documento nem guardada pela aplicação.
Os outros dias, a opção de salada e campos existentes são preservados. Alterar
manualmente o prato limpa a estimativa anterior, para não associar calorias de
um prato diferente. A energia aparece também na impressão semanal.

A gravação usa o RPC versionado e os rascunhos existentes, com a confirmação
normal do Supabase. Analisar ou fechar o diálogo não altera a refeição. Fechar
durante um pedido impede aplicar a resposta tardia; não garante que o fornecedor
cancele um processamento já iniciado.

## Ativação pelo Nuno

O utilizador informou que ainda não tem uma chave API. A interface e a função
estão preparadas, mas **a identificação real fica pendente da chave e de um
ensaio com uma fotografia real**. Os testes da análise usam respostas simuladas.
Não foram feitas chamadas pagas ou criadas credenciais durante o desenvolvimento.

1. Criar/usar uma conta na [plataforma API da OpenAI](https://platform.openai.com/).
2. Confirmar acesso à API, faturação/créditos e modelo com análise de imagens.
   As chamadas podem ter custos; consultar [preços](https://openai.com/api/pricing/)
   e os controlos de utilização disponíveis na conta/projeto.
3. Criar uma chave privada em **API keys** com acesso ao endpoint Responses.
   Não confundir com a publishable key do Supabase nem com uma palavra-passe.
4. No [Supabase do site](https://supabase.com/dashboard/project/rhpmebmytzmfwitjrfau),
   abrir **Edge Functions → Secrets** e acrescentar `OPENAI_API_KEY` com essa chave.
   Não alterar `FAMILIA_ADMIN_USER_ID` ou `FAMILIA_ACESSOS`.
5. Opcional: `OPENAI_VISION_MODEL` permite escolher outro modelo compatível com
   imagens e Structured Outputs. O padrão é `gpt-4.1-mini`.
6. Publicar `familia-prato-foto` com `verify_jwt = true`, caso ainda não esteja
   publicado. Código em `supabase/functions/familia-prato-foto`; dependências
   e lockfile são os já existentes em `supabase/functions/`.
7. Entrar como membro e testar uma única fotografia de comida sem dados pessoais
   no enquadramento. Rever o resultado, ajustar porção e confirmar a gravação.
   Verificar o estado do Supabase e o resultado noutro navegador após atualizar.

**Nunca colocar a chave no chat, GitHub, HTML ou JavaScript do navegador.**
Sem chave no servidor, a função responde que a análise não está configurada.
Não há fallback que invente um prato ou calorias. A introdução manual do menu
continua disponível.

## Segurança e privacidade

- A função verifica JWT com `getUser` e consulta `familia_membros` com o JWT do
  chamador e RLS antes de contactar a OpenAI. Não usa metadados editáveis para
  autorizar, nem precisa de `service_role` para esta operação.
- Só a origem de produção é permitida no navegador. Anónimo e não membro não
  podem iniciar análises. A chave OpenAI só existe nos secrets do servidor.
- O cliente aceita imagens até 20 MB, reduz a dimensão máxima para 1280 píxeis
  e recodifica JPEG, removendo metadados do ficheiro original. Imagens que o
  navegador não consiga descodificar devem ser escolhidas em JPEG/PNG/WebP.
- O servidor aceita apenas dados JPEG em base64, até cerca de 1,2 MB após
  preparação. Não aceita URLs remotas, SVG ou caminhos de ficheiros. Limita o
  tamanho do corpo, impõe timeout e valida os valores e a estrutura da resposta.
- Os pedidos usam Responses API com `store: false`. Isto não equivale a uma
  promessa de retenção zero pelo fornecedor: aplicam-se os controlos e políticas
  de dados da conta OpenAI. A aplicação não guarda a imagem no Supabase, no
  navegador de forma persistente ou no GitHub, e não regista corpos/fotos/chaves.
- Um clique inicia uma análise, sem reenvio automático. O cliente impede pedidos
  em paralelo e o servidor recusa pedidos em menos de 15 segundos por membro
  **na mesma instância**. Este controlo não é uma quota global de faturação;
  usar os controlos disponíveis da conta API para acompanhar os custos.
- O serviço não recebe nomes/e-mails familiares nem o documento completo de
  refeições: apenas a fotografia preparada e, opcionalmente, o peso informado.
- Não há novas tabelas, migrações ou alterações em dados existentes.

## Validação

```sh
node tests/meal-photo.test.cjs
node tests/auth-login.test.cjs
node tests/admin-access.test.cjs
node tests/family-store.test.cjs
python tests/browser-meal-photo.py
python tests/browser-private-data.py
```

O teste de navegador usa Chromium e Playwright já descritos no projeto. Testa
os dois seletores, redução a JPEG, envio apenas após clique, correção de porção,
resultado aplicado sem imagem, preservação de campos, limpeza de calorias quando
o prato muda, erro de configuração e cancelamento de resposta tardia.
Os testes do backend cobrem anónimo/não membro, chave em falta, origem/método,
tamanhos/formato, resposta inválida/sem comida, erro/limite do fornecedor e
cálculo. Não identificam comida através de uma chamada real.

## Reversão

Reverter o commit remove a interface e deixa o menu manual a funcionar. Os
campos `nutrition` já guardados são opcionais e preservados no JSONB; não apagar
documentos ou rascunhos para reverter a funcionalidade. A função de análise
pode ser despublicada separadamente, sem tocar na autenticação, convites ou dados.

Referências consultadas em 18/11/2026:

- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://supabase.com/docs/guides/functions/secrets
