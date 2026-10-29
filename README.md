# A nossa família

Site estático da **Filipa, Nuno, Martim e Madalena**, com uma apresentação visual escura, fotografias de destaque, tipografia forte e apontamentos vermelhos.

## Módulos

| Página | Dados |
| --- | --- |
| `index.html` | Visão geral; exportar/importar cópia de segurança |
| `menu.html` | Almoços e jantares, pratos novos, saladas e impressão A4 |
| `viaturas.html` | Viaturas, seguros, inspeção, manutenção e pneus |
| `compras.html` | Artigos, quantidades, responsável e estado de compra |
| `compromissos.html` | Pagamentos, leituras de contadores e tarefas periódicas |

## Ficheiros JSON

Os dados comuns estão no próprio repositório:

- `dados/refeicoes.json`
- `dados/viaturas.json`
- `dados/compras.json`
- `dados/compromissos.json`

Os ficheiros de refeições, viaturas e compras começam vazios. O de compromissos tem os quatro modelos iniciais: condomínio, água, luz e gás (sem datas de vencimento).

O navegador carrega os ficheiros através da **GitHub REST API** quando uma página é aberta. O botão **Atualizar dados** recarrega o tema da página a partir do GitHub.

### Como permitir que uma pessoa guarde alterações no GitHub

1. Essa pessoa deve ter conta GitHub com permissão de escrita em `nleitao286/site-familia`. O proprietário do repositório pode adicionar colaboradores nas definições do GitHub.
2. Em [GitHub → Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new), criar **um token individual**. Selecionar apenas o repositório `site-familia`; em **Repository permissions → Contents**, escolher **Read and write**. Usar uma validade curta.
3. No site, abrir **Acesso de edição**, introduzir o token no campo próprio e carregar em **Ligar GitHub**.
4. Os dados alterados são guardados no navegador e, com sessão autenticada, enviados automaticamente para o ficheiro JSON correspondente. Se existirem alterações anteriores por publicar, usar **Publicar alterações**.
5. No telemóvel de outro familiar, usar **Atualizar dados** para consultar os novos valores. Não existe atualização em tempo real (sem abrir/atualizar a página).

**Não incluir tokens em ficheiros JSON, código, URL, mensagens nem fotografias.** Os tokens introduzidos no site são guardados apenas em **sessionStorage** da sessão atual do navegador. Não persistem na conta do GitHub nem no próprio repositório. Fechar o separador/sessão termina o acesso guardado. Para deixar de usar um token, carregar em **Desligar**; também é possível revogá-lo no GitHub.

### Gravação, conflitos e segurança

- As alterações são enviadas através do endpoint oficial de atualização de conteúdo (`PUT /repos/.../contents/...`) com o `sha` do ficheiro atual.
- Se outro familiar alterar o mesmo ficheiro desde o último carregamento, o site **recusa a gravação** e apresenta uma mensagem de conflito, em vez de substituir silenciosamente os dados. Para recuperar, fazer primeiro uma cópia local em **Início → Descarregar cópia**, depois carregar em **Atualizar dados**. A reconciliação manual de alterações ainda é necessária.
- Na ausência de ligação à Internet ou de token válido, as alterações permanecem **apenas no navegador** até serem publicadas. O painel de sincronização assinala essa situação.
- Dados locais anteriores à alteração da arquitetura são preservados quando houver conteúdo ainda não publicado. Pode ser necessário selecionar **Publicar alterações** na primeira ligação.
- Cada gravação cria um commit no GitHub. Não é uma base de dados em tempo real, e não substitui uma solução multiutilizador com autenticação dedicada.
- **Este repositório é público.** Todos os ficheiros JSON podem ser lidos por terceiros, e cada commit permanece no histórico. Não guardar nele apólices, matrículas, moradas, códigos, documentos ou outras informações privadas. Para dados confidenciais, será necessário um repositório privado e um backend seguro, ou uma base de dados com controlo de acessos.
- Para leitura/edição das páginas não é necessário instalar software. As fotos ilustrativas são carregadas do Unsplash e as fontes do Google Fonts.

## Estrutura técnica

- `styles.css` — apresentação e impressão;
- `app.js` — funcionalidades dos quatro módulos e cópias locais;
- `sync.js` — leitura/escrita dos ficheiros JSON na GitHub API, controlo de versões e painel de ligação;
- `dados/*.json` — dados partilhados.

## Publicação

Abrir **Settings → Pages → Build and deployment** no repositório, selecionar `Deploy from a branch`, branch `main` e pasta `/ (root)`. Depois, se GitHub Pages estiver ativado, o endereço previsto é:

https://nleitao286.github.io/site-familia/

## Se fizeste alterações e não ficaram no GitHub

Os dados do repositório só são alterados por uma pessoa autenticada com acesso de escrita. **A mensagem de que a informação está guardada no navegador não significa que esteja guardada no GitHub.**

1. Abrir [Recuperar dados](recuperar.html) **no mesmo navegador, dispositivo e endereço** usados para introduzir as informações.
2. Verificar o conteúdo encontrado. Escolher **Restaurar** na versão correta. O restauro marca o tema como **NÃO GRAVADO NO GITHUB**.
3. Se existirem dados recuperados, fazer primeiro uma **cópia local** pela página de recuperação.
4. Abrir a página desse tema, ligar um token GitHub com permissão de escrita, usar **GRAVAR NO GITHUB** e **confirmar a mensagem «GRAVADO NO GITHUB»**.
5. Se estiver a aparecer «Conflito», não recarregar antes de descarregar uma cópia local.

As modificações desta versão mantêm um histórico local de até 10 versões por tema, para futuras recuperações. Este histórico **não é um backup externo**: se o browser apagar o armazenamento local ou se foi utilizado outro browser, não é possível recuperar versões perdidas por esta via. Se o repositório ainda tiver os ficheiros iniciais, não existem alterações publicadas para recuperar do GitHub.

### Avisos de gravação

- O painel mostra **NÃO GRAVADO NO GITHUB** enquanto existirem alterações locais pendentes.
- **GRAVAR NO GITHUB** pede credenciais caso ainda não exista ligação; nunca simula gravação sem confirmação.
- Após a resposta da API, o painel indica **GRAVADO NO GITHUB** apenas quando a escrita foi confirmada.
- Os ficheiros locais continuam disponíveis em `localStorage`, mesmo quando não existe sessão de edição.

## Limitações

É um protótipo que usa tokens de acesso pessoais introduzidos diretamente no navegador para edição. Para uso regular por pessoas sem contas GitHub, a arquitetura recomendada é um pequeno serviço de autenticação com backend e permissões familiares, evitando que cada utilizador tenha de gerir um token. Não há notificações automáticas nem sincronização instantânea.
