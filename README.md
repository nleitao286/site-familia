# A nossa família

Site estático em português de Portugal para **Filipa, Nuno, Martim e Madalena**.

## Páginas

- **index.html** — início, resumo de artigos, viaturas e prazos próximos; exportação e importação de todos os dados.
- **menu.html** — apenas **almoços e jantares**, de sábado a sexta-feira, com listas de pratos inicialmente vazias, possibilidade de adicionar ideias, opção «Fazer salada» e impressão em A4 horizontal.
- **viaturas.html** — registo de viaturas, matrícula, responsável, seguradora/apólice, validade do seguro, próxima inspeção, manutenções, quilómetros e pneus. Permite editar e eliminar.
- **compras.html** — lista de compras com artigo, quantidade e familiar que o acrescentou; marcar como comprado, apagar e partilhar por texto.
- **compromissos.html** — tarefas periódicas, responsáveis, próximas datas, conclusão, histórico e registo de leitura de contadores. Tem quatro exemplos iniciais: pagar condomínio e contagens de água, luz e gás.

Os compromissos de exemplo têm periodicidade mensal **provisória**, editável, e nenhuma data de vencimento predefinida.

## Armazenamento, partilha e privacidade

Esta versão **guarda dados apenas no browser (localStorage)**. A atribuição dos artigos a membros da família identifica o autor escolhido no formulário; **não é autenticação**. Os dados **não são partilhados nem sincronizados automaticamente** entre os telemóveis dos familiares.

A página inicial permite **exportar uma cópia de segurança JSON** e importá-la noutro navegador. Importar substitui os dados atuais nesse dispositivo. A lista de compras pode ser partilhada como texto (isso não sincroniza a aplicação).

O código está num repositório público e, se for publicado com GitHub Pages, as páginas serão públicas. **Não há proteção por palavra-passe, notificações automáticas nem base de dados remota.** Os valores introduzidos nos formulários não são enviados para o GitHub; ficam no navegador utilizado.

Para permitir que Filipa, Nuno, Martim e Madalena editem **a mesma lista em tempo real**, será necessário integrar um serviço de autenticação e base de dados, com regras de acesso (por exemplo, Supabase ou Firebase). Não publicar segredos de servidor nem credenciais neste repositório.

## Estrutura

- `index.html`, `menu.html`, `viaturas.html`, `compras.html`, `compromissos.html`
- `styles.css` — estilos responsivos e de impressão.
- `app.js` — lógica das páginas e armazenamento local, sem bibliotecas externas.

## Publicar

Em **GitHub → Settings → Pages → Build and deployment**, selecionar **Deploy from a branch**, `main` e `/ (root)`. O endereço habitual será `https://nleitao286.github.io/site-familia/` quando o Pages estiver ativo.

## Migração do menu original

Se existirem dados anteriores no mesmo domínio/navegador, ao abrir o novo menu pela primeira vez o site procura `menu-semana` e transfere as escolhas de **almoço e jantar** e ideias personalizadas para o novo formato, respeitando a semana que estava escolhida. Pequenos-almoços e lanches deixam de aparecer. As listas predefinidas de almoço/jantar continuam vazias.

## Verificação

O JavaScript foi validado sintaticamente e foi realizado um teste de inicialização das cinco páginas. Validar visualmente num navegador antes de utilização regular.
