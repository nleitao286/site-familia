-- O schema auth é gerido pelo Supabase e postgres não pode voltar a conceder
-- os seus privilégios diretamente. A role de escrita herda os privilégios
-- normais de authenticated para executar auth.uid(), mantendo RLS e NOLOGIN.
-- Esta direção não dá a authenticated qualquer pertença/privilégio de writer.
grant authenticated to familia_rpc_writer with inherit true, set false;
