const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');
const {PGlite}=require(process.env.SITE_FAMILIA_PGLITE_MODULE||'@electric-sql/pglite');
const root=new URL('../',`file://${__filename}`);
test('PostgreSQL: apenas RPC autorizado, versões concorrentes e dados preservados',async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;
 grant usage on schema auth to anon,authenticated,service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key);`);
 await db.exec(readFileSync(new URL('supabase/01-schema.sql',root),'utf8'));
 await db.exec(readFileSync(new URL('supabase/migrations/20261108200642_escrita_familiar_versionada.sql',root),'utf8'));
 await db.query('insert into auth.users(id) values($1),($2),($3)',[a,b,outsider]);
 await db.query("insert into public.familia_membros(user_id,nome) values($1,'Nuno'),($2,'Filipa')",[a,b]);
 await db.exec(`insert into public.familia_dados(tema,conteudo) values('compras','[{"id":"original"}]'),('viaturas','[]'),('compromissos','[]'),('refeicoes','{"weeks":{},"dishes":{"A":[],"J":[]}}');`);
 const role=async(name,id,fn)=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(`set role ${name}`);try{return await fn()}finally{await db.exec('reset role')}};
 await role('anon',null,async()=>{
  await assert.rejects(db.query('select * from public.familia_dados'),/permission denied/);
  await assert.rejects(db.query("select * from public.guardar_familia_dados('compras','[]',1)"),/permission denied/);
 });
 await role('authenticated',outsider,async()=>{
  assert.equal((await db.query('select * from public.familia_dados')).rows.length,0);
  await assert.rejects(db.query("select * from public.guardar_familia_dados('compras','[]',1)"),/não autorizado/);
 });
 await role('authenticated',a,async()=>{
  assert.equal((await db.query('select * from public.familia_dados')).rows.length,4);
  await assert.rejects(db.query("update public.familia_dados set conteudo='[]' where tema='compras'"),/permission denied/);
  await assert.rejects(db.query("select * from public.guardar_familia_dados('refeicoes','[]',1)"),/Formato/);
  const result=await db.query("select * from public.guardar_familia_dados('compras','[{\"id\":\"original\"},{\"id\":\"a\"}]',1)");assert.equal(result.rows[0].nova_versao,2);
 });
 await role('authenticated',b,async()=>{
  const stale=await db.query("select * from public.guardar_familia_dados('compras','[{\"id\":\"b\"}]',1)");assert.equal(stale.rows.length,0);
  const row=(await db.query("select conteudo,versao from public.familia_dados where tema='compras'")).rows[0];assert.equal(row.versao,2);assert.equal(row.conteudo.length,2);
  const merged=await db.query("select * from public.guardar_familia_dados('compras','[{\"id\":\"original\"},{\"id\":\"a\"},{\"id\":\"b\"}]',2)");assert.equal(merged.rows[0].nova_versao,3);
 });
 const writer=(await db.query("select rolbypassrls,rolcanlogin from pg_roles where rolname='familia_rpc_writer'")).rows[0];assert.deepEqual(writer,{rolbypassrls:false,rolcanlogin:false});
 await db.query('delete from public.familia_membros where user_id=$1',[a]);
 await role('authenticated',a,async()=>{assert.equal((await db.query('select * from public.familia_dados')).rows.length,0);await assert.rejects(db.query("select * from public.guardar_familia_dados('compras','[]',3)"),/não autorizado/)});
 const all=(await db.query('select tema,versao from public.familia_dados order by tema')).rows;
 assert.equal(all.length,4);assert.ok(all.filter(x=>x.tema!=='compras').every(x=>x.versao===1));
 }finally{await db.close()}
});
