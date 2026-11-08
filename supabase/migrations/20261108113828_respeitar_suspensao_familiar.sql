-- Não altera documentos, contas, palavras-passe ou a lista de convites existente.
-- A lista de e-mails é privada e configurada pelo administrador fora do git.
create or replace function private.autorizar_familiar_email_confirmado()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_nome text;
begin
  if new.email_confirmed_at is not null and new.email is not null
     and (new.banned_until is null or new.banned_until <= now()) then
    select c.nome into v_nome from private.familia_convites c
     where c.email = lower(btrim(new.email));
  end if;
  if v_nome is not null then
    insert into public.familia_membros(user_id,nome) values(new.id,v_nome)
    on conflict(user_id) do update set nome=excluded.nome;
  else
    delete from public.familia_membros m where m.user_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.autorizar_familiar_email_confirmado() from public, anon, authenticated;

drop trigger if exists autorizar_familiar_confirmado on auth.users;
create trigger autorizar_familiar_confirmado
  after insert or update of email_confirmed_at, email, banned_until on auth.users
  for each row execute function private.autorizar_familiar_email_confirmado();

-- Apenas a Edge Function, depois de verificar a identidade do administrador,
-- pode alterar a autorização prévia. SECURITY INVOKER evita elevar privilégios.
grant usage on schema private to service_role;
grant select, insert, update, delete on private.familia_convites to service_role;
create or replace function public.familia_configurar_convite(p_email text, p_nome text, p_ativo boolean)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if p_nome is null or p_nome not in ('Nuno','Filipa','Martim','Madalena')
     or p_email is null or btrim(p_email) = '' or p_ativo is null then
    raise exception 'Autorização inválida';
  end if;
  if p_ativo then
    insert into private.familia_convites(email,nome) values(lower(btrim(p_email)),p_nome)
    on conflict(email) do update set nome=excluded.nome;
  else
    delete from private.familia_convites where email=lower(btrim(p_email)) and nome=p_nome;
  end if;
end;
$$;
revoke all on function public.familia_configurar_convite(text,text,boolean) from public, anon, authenticated;
grant execute on function public.familia_configurar_convite(text,text,boolean) to service_role;
