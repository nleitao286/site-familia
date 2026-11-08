// PostgreSQL local, sem rede, sem dados reais. Instalação de teste documentada.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {PGlite}=require(process.env.SITE_FAMILIA_PGLITE_MODULE || '@electric-sql/pglite');
const root=new URL('../',`file://${__filename}`);
const migration='supabase/migrations/20261108113828_respeitar_suspensao_familiar.sql';
const id='22222222-2222-4222-8222-222222222222';
test('PostgreSQL: RLS, convites privados, suspensão com JWT antigo, reset e reativação',async()=>{
 const db=new PGlite();
 try{
   await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
     create schema auth; grant usage on schema auth to anon, authenticated, service_role;
     create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
     create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,encrypted_password text);
     create schema private;
     create table private.familia_convites(email text primary key,nome text not null,criado_em timestamptz default now());
     alter table private.familia_convites enable row level security;`);
   await db.exec(readFileSync(new URL('supabase/01-schema.sql',root),'utf8'));
   await db.exec(readFileSync(new URL(migration,root),'utf8'));
   await db.exec(`insert into public.familia_dados(tema,conteudo) values('compras','{"preservar":"alteração existente"}');`);
   async function role(name,fn){await db.exec(`set role ${name}`);try{return await fn()}finally{await db.exec('reset role')}}
   await role('anon',async()=>{
     await assert.rejects(db.query('select * from public.familia_dados'),/permission denied/);
     await assert.rejects(db.query("select public.familia_configurar_convite('filipa@example.org','Filipa',true)"),/permission denied/);
   });
   await role('authenticated',async()=>{
     await assert.rejects(db.query("select public.familia_configurar_convite('filipa@example.org','Filipa',true)"),/permission denied/);
     await assert.rejects(db.query('select * from private.familia_convites'),/permission denied/);
   });
   const invite=async active=>role('service_role',()=>db.query("select public.familia_configurar_convite('filipa@example.org','Filipa',$1)",[active]));
   await invite(true);
   await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'filipa@example.org',now())",[id]);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
   const read=()=>role('authenticated',async()=> (await db.query('select conteudo from public.familia_dados')).rows);
   assert.equal((await read()).length,1,'membro autorizado lê');
   // Mesmo UID/JWT antes e depois: não esperar pela expiração do token.
   await invite(false);
   await db.query("update auth.users set banned_until=now()+interval '100 years' where id=$1",[id]);
   assert.equal((await read()).length,0,'suspensão retira acesso ao JWT existente');
   await db.query("update auth.users set encrypted_password='simulado',email_confirmed_at=email_confirmed_at where id=$1",[id]);
   assert.equal((await read()).length,0,'reset de password não reativa conta suspensa');
   // Mesmo um convite residual não deve vencer o bloqueio Auth.
   await invite(true);
   await db.query('update auth.users set email=email where id=$1',[id]);
   assert.equal((await read()).length,0,'conta bloqueada não ganha associação por convite residual');
   await db.query('update auth.users set banned_until=null where id=$1',[id]);
   assert.equal((await read()).length,1,'reativação repõe associação autorizada');
   const data=await db.query('select conteudo,versao from public.familia_dados');
   assert.deepEqual(data.rows[0].conteudo,{preservar:'alteração existente'});assert.equal(data.rows[0].versao,1);
   await db.exec(readFileSync(new URL(migration,root),'utf8'));
   assert.equal((await read()).length,1,'migração reaplicável preserva associação');
 }finally{await db.close()}
});
