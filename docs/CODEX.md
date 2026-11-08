# Continuar o SITE-FAMILIA noutro computador

## Código guardado no GitHub

Repositório: **https://github.com/nleitao286/site-familia**.
Branch principal: **`main`**. Inclui o site, autenticação, painel do Nuno,
persistência Supabase, migrações, testes e documentação. Os PRs #5, #6 e #7
foram integrados; não é necessário copiar ficheiros deste workspace para obter
essas alterações.

O site publicado encontra-se em:
https://nleitao286.github.io/site-familia/

## Clonar e editar

Instalar Git e um editor, por exemplo Visual Studio Code. Num terminal:

```sh
git clone https://github.com/nleitao286/site-familia.git
cd site-familia
git switch main
git pull --ff-only origin main
git switch -c feature/nome-da-alteracao
```

Se a cópia do repositório já existir nesse computador, conservar/commitar primeiro
as alterações locais e usar `git pull --ff-only` na branch principal. Não utilizar
reset forçado nem apagar dados para resolver diferenças.

Antes de alterar código, ler `AGENTS.md`, `docs/ARCHITECTURE.md`,
`docs/ROADMAP.md` e a documentação da área a modificar.

O frontend é HTML/CSS/JS estático; não precisa de compilação nem de `npm install`.
Para servir uma pré-visualização local, com Python instalado:

```sh
python -m http.server 8000
```

Abrir `http://localhost:8000/entrar.html`. O cliente aponta para o projeto
Supabase existente: uma entrada real por palavra-passe pode aceder a dados de
produção. Para desenvolvimento sem tocar em dados reais, preferir os testes
com API simulada descritos abaixo. A alternativa de ligação por e-mail retorna
ao site oficial; o painel administrativo só permite a origem de produção.
Não alterar redirects ou CORS de produção apenas para contornar um teste local.

Para guardar e propor uma alteração:

```sh
git add caminho/dos/ficheiros-alterados
git diff --cached
git commit -m "Descrever a alteração"
git push -u origin feature/nome-da-alteracao
```

Depois, abrir um Pull Request para `main`, rever o diff e executar os testes
adequados antes de integrar. A integração em `main` publica automaticamente no
GitHub Pages; confirmar o resultado em **Actions**. É necessário autenticar o
Git com uma conta autorizada para fazer push. Não colocar tokens no código.

## Testes e backend

Com Node 24, sem dependências adicionais para estes testes:

```sh
node tests/auth-login.test.cjs
node tests/admin-access.test.cjs
node tests/family-store.test.cjs
```

Os testes de PostgreSQL local usam PGlite 0.5.15; os de navegador usam
Playwright 1.62.0 e Chromium. Instalação e comandos:
[docs/MIGRACAO-DADOS.md](MIGRACAO-DADOS.md).

O backend **não está alojado no computador de desenvolvimento**. O projeto
Supabase `rhpmebmytzmfwitjrfau` e os seus dados continuam disponíveis depois de
clonar o código noutro computador. Não criar outro projeto, reaplicar migrações
ou voltar a importar documentos só por mudar de máquina.

O código da Edge Function e as migrações estão no GitHub. Alterar esses ficheiros
não publica automaticamente o backend: rever e aplicar alterações no projeto
existente, com testes e comparação dos dados. Os nomes dos scripts locais podem
ter timestamps diferentes das entradas criadas pela ferramenta de migração em
produção; verificar o histórico remoto antes de qualquer aplicação automática.

## Configurações e cópias privadas

Os e-mails autorizados e o UUID do administrador estão nos secrets
`FAMILIA_ACESSOS` e `FAMILIA_ADMIN_USER_ID` do Supabase. As palavras-passe são
geridas por Supabase Auth. Não precisam de ser copiadas para o novo computador
para usar o backend já publicado.

`.env.local`, credenciais, tokens e backups familiares ficam fora do GitHub.
A configuração local de apoio criada neste workspace não é requisito para
clonar ou editar o frontend. A cópia privada anterior à migração também não é
um backup guardado no GitHub; conservar backups de dados separadamente, num
local privado controlado pelo administrador.

Os ficheiros de dados antigos foram retirados da versão atual, mas continuam
no histórico público. Não reintroduzir JSON/SQL com dados pessoais. A limpeza
desse histórico requer uma tarefa específica; não reescrever o histórico para
atualizar a cópia de desenvolvimento.

## Continuar no Codex

1. Abrir o Codex e ligar a conta GitHub autorizada.
2. Selecionar **`nleitao286/site-familia`**, branch **`main`**.
3. Pedir, por exemplo:

> Trabalha no SITE-FAMILIA. Lê AGENTS.md, docs/ARCHITECTURE.md e docs/ROADMAP.md.
> Parte da main atual, preserva dados Supabase e rascunhos locais, e implementa
> a alteração pedida numa branch com testes e Pull Request. Não publicar dados
> privados nem modificar produção sem verificar o resultado.
