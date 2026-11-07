-- Site da Família: Supabase PostgreSQL
-- Executar no SQL Editor do projeto Supabase (região UE).
-- Tabelas privadas com Row Level Security (RLS).
-- Só membros identificados por UUID no Supabase Auth têm acesso.
begin;
create table if not exists public.familia_membros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (nome in ('Filipa','Nuno','Martim','Madalena')),
  criado_em timestamptz not null default now()
);
create table if not exists public.familia_dados (
  tema text primary key check (tema in ('refeicoes','viaturas','compras','compromissos')),
  conteudo jsonb not null,
  versao bigint not null default 1,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id)
);
create index if not exists familia_dados_atualizado_em_idx on public.familia_dados (atualizado_em);
create index if not exists familia_membros_nome_idx on public.familia_membros (nome);
alter table public.familia_membros enable row level security;
alter table public.familia_dados enable row level security;
revoke all on public.familia_membros from anon, authenticated;
revoke all on public.familia_dados from anon, authenticated;
grant select on public.familia_membros to authenticated;
grant select,update on public.familia_dados to authenticated;
drop policy if exists "Familia consulta membros" on public.familia_membros;
create policy "Familia consulta membros" on public.familia_membros
  for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Familia consulta dados" on public.familia_dados;
create policy "Familia consulta dados" on public.familia_dados
  for select to authenticated
  using (exists (select 1 from public.familia_membros m where m.user_id=(select auth.uid())));
drop policy if exists "Familia atualiza dados" on public.familia_dados;
create policy "Familia atualiza dados" on public.familia_dados
  for update to authenticated
  using (exists (select 1 from public.familia_membros m where m.user_id=(select auth.uid())))
  with check (exists (select 1 from public.familia_membros m where m.user_id=(select auth.uid())));
-- Não há INSERT/DELETE de dados no cliente. Apenas UPDATE depois de autenticação.
-- O RPC controla versões; RLS também protege UPDATE direto de membros autenticados.
-- Um cliente confiável só usa o RPC para evitar sobrescritas silenciosas.
create or replace function public.guardar_familia_dados(
  p_tema text,
  p_conteudo jsonb,
  p_versao bigint
) returns table (nova_versao bigint)
language plpgsql security invoker set search_path = ''
as $$
begin
  return query
  update public.familia_dados d
     set conteudo=p_conteudo,
         versao=d.versao+1,
         atualizado_em=now(),
         atualizado_por=(select auth.uid())
   where d.tema=p_tema and d.versao=p_versao
     and exists (select 1 from public.familia_membros m where m.user_id=(select auth.uid()))
  returning d.versao;
end;
$$;
revoke all on function public.guardar_familia_dados(text,jsonb,bigint) from public, anon;
grant execute on function public.guardar_familia_dados(text,jsonb,bigint) to authenticated;
commit;
