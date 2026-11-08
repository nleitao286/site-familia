# Supabase — Site da Família

O projeto `rhpmebmytzmfwitjrfau` já existe e contém os quatro documentos.
**Não recriar o projeto nem importar dados por omissão.**

- [Migração, RLS, cópias e publicação](../docs/MIGRACAO-DADOS.md).
- [Configuração privada e administração das contas](../docs/ACESSOS-PASSWORD.md).
- [Diagnóstico histórico do login](../docs/AUTH-LOGIN.md).

`01-schema.sql` representa o esquema inicial para testes/instalações novas. Não
é o estado completo de produção e não deve ser reaplicado para corrigir Auth.
As migrações em `migrations/` acrescentam suspensão de acessos e escrita apenas
por RPC. A parte de convites privados já existia no projeto antes destas
migrações. Os testes criam os fixtures mínimos sem dados pessoais.

O antigo script `02-importar-dados.sql`, que continha dados, foi retirado da
versão atual com os JSON públicos, depois de cópia privada e comparação com o
Supabase. O histórico do GitHub continua público e requer tratamento separado.

As chaves `service_role` e secrets só pertencem ao servidor. O frontend usa a
publishable key existente com Auth/RLS. Não publicar e-mails autorizados,
palavras-passe, UUIDs pessoais, exportações ou backups neste repositório.
