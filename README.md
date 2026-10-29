# Site da família

Site estático da Filipa, Nuno, Martim e Madalena.

## Páginas
- `index.html`: página inicial.
- `menu.html`: planeador semanal de refeições para quatro pessoas.

## Funcionalidades do menu
- Planeamento de sábado a sexta-feira, com pequeno-almoço, almoço, jantar e lanches individuais.
- Ideias personalizadas, opção «Fazer salada», contador e impressão A4 horizontal.
- Exportação/importação de cópia de segurança em JSON.

## Dados e privacidade
Os dados são guardados **apenas no navegador** (`localStorage`), não são sincronizados entre dispositivos. Publicar em GitHub Pages disponibiliza as páginas publicamente; **não insira dados sensíveis** no site. O código inclui nomes da família.

## Publicar com GitHub Pages
1. Criar um repositório GitHub e enviar todos os ficheiros desta pasta para a raiz.
2. Em **Settings → Pages**, escolher **Deploy from a branch**, branch `main`, diretoria `/ (root)` e guardar.
3. Abrir o endereço disponibilizado pelo GitHub Pages.

O site não necessita de servidor nem de base de dados. O Google Fonts do `menu.html` requer internet para carregar as fontes personalizadas (há alternativas locais).

## Configuração
Editar o bloco `CONFIGURAÇÃO` em `menu.html` para mudar nomes, fruta e opções de refeições. A Filipa e o Nuno partilham as listas de lanches MA/TA, enquanto Martim e Madalena usam ME/TE por defeito. Estas associações são provisórias.