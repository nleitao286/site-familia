-- Escrita apenas por RPC, sob uma função privada cujo proprietário não ignora RLS.
-- Não altera o conteúdo ou as versões dos documentos existentes.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='familia_rpc_writer') then
    create role familia_rpc_writer nologin noinherit nobypassrls;
  end if;
end $$;
grant usage on schema public, auth, private to familia_rpc_writer;
grant execute on function auth.uid() to familia_rpc_writer;
grant select on public.familia_membros to familia_rpc_writer;
grant select, update on public.familia_dados to familia_rpc_writer;
create policy "RPC consulta membro atual" on public.familia_membros
  for select to familia_rpc_writer using (user_id=(select auth.uid()));
create policy "RPC consulta documentos" on public.familia_dados
  for select to familia_rpc_writer
  using (exists(select 1 from public.familia_membros where user_id=(select auth.uid())));
create policy "RPC atualiza documentos" on public.familia_dados
  for update to familia_rpc_writer
  using (exists(select 1 from public.familia_membros where user_id=(select auth.uid())))
  with check (exists(select 1 from public.familia_membros where user_id=(select auth.uid())));

create function private.guardar_familia_dados_versionados(p_tema text,p_conteudo jsonb,p_versao bigint)
returns table(nova_versao bigint) language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not exists(select 1 from public.familia_membros where user_id=auth.uid()) then
    raise exception using errcode='42501',message='Acesso familiar não autorizado';
  end if;
  if p_tema is null or p_tema not in ('refeicoes','viaturas','compras','compromissos') or p_versao is null or p_versao<1
     or p_conteudo is null or octet_length(p_conteudo::text)>2000000 then
    raise exception 'Documento inválido';
  end if;
  if p_tema='refeicoes' then
    if jsonb_typeof(p_conteudo) is distinct from 'object'
       or jsonb_typeof(p_conteudo->'weeks') is distinct from 'object'
       or jsonb_typeof(p_conteudo->'dishes'->'A') is distinct from 'array'
       or jsonb_typeof(p_conteudo->'dishes'->'J') is distinct from 'array' then raise exception 'Formato de refeições inválido'; end if;
  elsif jsonb_typeof(p_conteudo) is distinct from 'array' then raise exception 'Formato de documento inválido';
  end if;
  return query update public.familia_dados d
    set conteudo=p_conteudo,versao=d.versao+1,atualizado_em=now(),atualizado_por=auth.uid()
    where d.tema=p_tema and d.versao=p_versao returning d.versao;
end $$;
-- CREATE é necessário só para transferir a propriedade, e é revogado de seguida.
grant create on schema private to familia_rpc_writer;
alter function private.guardar_familia_dados_versionados(text,jsonb,bigint) owner to familia_rpc_writer;
revoke create on schema private from familia_rpc_writer;
revoke all on function private.guardar_familia_dados_versionados(text,jsonb,bigint) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.guardar_familia_dados_versionados(text,jsonb,bigint) to authenticated;

create or replace function public.guardar_familia_dados(p_tema text,p_conteudo jsonb,p_versao bigint)
returns table(nova_versao bigint) language sql security invoker set search_path=''
as $$ select * from private.guardar_familia_dados_versionados(p_tema,p_conteudo,p_versao); $$;
revoke all on function public.guardar_familia_dados(text,jsonb,bigint) from public,anon;
grant execute on function public.guardar_familia_dados(text,jsonb,bigint) to authenticated;
revoke update on public.familia_dados from authenticated,anon;
