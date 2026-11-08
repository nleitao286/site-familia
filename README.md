# SITE-FAMILIA — A nossa família

Site familiar de refeições, viaturas, compras e compromissos, em português de
Portugal, alojado no GitHub Pages e ligado ao Supabase.

## Acesso e dados

[Entrar no site](https://nleitao286.github.io/site-familia/entrar.html) com a conta
individual e palavra-passe. O Nuno é o único administrador dos quatro acessos
na aplicação. [Configuração dos acessos](docs/ACESSOS-PASSWORD.md).

As páginas de dados e recuperação só carregam após confirmar sessão e associação
familiar. Os dados partilhados são lidos no Supabase com RLS; as gravações usam
RPC e controlo de versão. Não é necessário token GitHub. Confirma o estado da
gravação antes de sair: numa falha de rede, a alteração pode estar apenas no
rascunho deste navegador.

**Atualizar dados** consulta as alterações dos outros dispositivos. Um conflito
não apaga nenhuma cópia: compara as versões e prepara a versão conciliada.
**Descarregar cópias** e [Recuperar dados](https://nleitao286.github.io/site-familia/recuperar.html)
permitem conservar e restaurar versões. As cópias antigas do navegador não são
substituídas silenciosamente. [Migração e recuperação](docs/MIGRACAO-DADOS.md).

## Privacidade histórica

Este repositório é público. Os JSON e o script de importação antigos foram
retirados da versão atual depois de comparação com Supabase e cópia privada,
mas **continuam no histórico de commits**. A proteção atual não apaga dados já
publicados ou cópias existentes. Limpar o histórico ou mudar a visibilidade/
alojamento é uma tarefa separada. Não colocar novos dados familiares privados,
backups, credenciais ou tokens no GitHub.

## Continuar noutro computador

Todo o código está na branch `main`. Seguir as [instruções para clonar, testar e propor alterações](docs/CODEX.md). Dados e configurações privadas permanecem no Supabase e fora do repositório.

## Desenvolvimento

Ler [AGENTS.md](AGENTS.md), [arquitetura](docs/ARCHITECTURE.md) e
[roadmap](docs/ROADMAP.md). Frontend estático, sem compilação ou dependência de
Node no navegador. `family-page.js` confirma Auth e carrega a página;
`family-store.js` gere rascunhos e versões; `app.js` mantém os quatro módulos.

Os testes e o procedimento de publicação/reversão estão em
[docs/MIGRACAO-DADOS.md](docs/MIGRACAO-DADOS.md). Não executar os scripts antigos
como forma de repor produção; usar cópias privadas e comparar versões.
