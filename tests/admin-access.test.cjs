const {test}=require('node:test');
const assert=require('node:assert/strict');
const modulePromise=import('../supabase/functions/familia-acessos/handler.js');
const adminId='11111111-1111-4111-8111-111111111111';
const memberId='22222222-2222-4222-8222-222222222222';
const people=['Nuno','Filipa','Martim','Madalena'].map(nome=>({nome,email:`${nome.toLowerCase()}@example.org`}));
const admin={id:adminId,email:people[0].email,email_confirmed_at:'2026-01-01',user_metadata:{}};
async function fixture(options={}){
 const {createHandler,readAccessConfig}=await modulePromise;
 const users=options.users||[structuredClone(admin)];const members=options.members||[{user_id:adminId,nome:'Nuno'}];
 const calls=[];
 const client={rpc:async(name,args)=>{assert.equal(name,'familia_configurar_convite');calls.push(['invitation',args]);return {error:options.invitationError}},auth:{getUser:async token=>({data:{user:token==='valid'?(options.user||admin):null},error:null}),admin:{
   listUsers:async page=>{calls.push(['list',page]);return {data:{users:users.slice((page.page-1)*100,page.page*100)},error:options.listError}},
   createUser:async input=>{calls.push(['create',input]);if(options.createError)return {error:options.createError};const user={...input,id:memberId,email_confirmed_at:'2026-01-01'};users.push(user);return {data:{user},error:null}},
   updateUserById:async(id,input)=>{calls.push(['update',id,input]);return {data:{user:users.find(user=>user.id===id)},error:options.updateError}}
 }},from(table){assert.equal(table,'familia_membros','Não tocar nos documentos familiares');return {
   select(columns){return columns==='nome'?{eq(column,id){assert.equal(id,adminId);return {maybeSingle:async()=>({data:members.find(member=>member.user_id===id),error:options.memberError})}}}:Promise.resolve({data:members,error:null})},
   upsert:async(row)=>{calls.push(['upsert',row]);if(!options.upsertError)members.push(row);return {error:options.upsertError}},
   delete(){return {eq:async(column,id)=>{calls.push(['delete',id]);return {error:options.deleteError}}}}
 }} };
 const handler=createHandler({client,config:options.noConfig?null:readAccessConfig(adminId,JSON.stringify(people))});
 async function request(body={action:'list'},options={}){
   const headers={'content-type':'application/json',origin:'https://nleitao286.github.io',...options.headers};
   if(options.token!==null)headers.authorization=`Bearer ${options.token||'valid'}`;
   return handler(new Request('https://example.org/functions/v1/familia-acessos',{method:options.method||'POST',headers,...(['OPTIONS','GET'].includes(options.method)?{}:{body:options.raw??JSON.stringify(body)})}));
 }
 return {request,calls,users,members};
}
test('configuração exige administrador UUID e exatamente quatro contas únicas',async()=>{
 const {readAccessConfig}=await modulePromise;
 assert.throws(()=>readAccessConfig('Nuno',JSON.stringify(people)));
 assert.throws(()=>readAccessConfig(adminId,JSON.stringify(people.slice(1))));
 assert.throws(()=>readAccessConfig(adminId,JSON.stringify(people.map(person=>({...person,email:'same@example.org'})))));
 const cfg=readAccessConfig(adminId,JSON.stringify(people.map(person=>({...person,email:person.email.toUpperCase()}))));
 assert.equal(cfg.people[0].email,people[0].email);
});
test('anónimo, JWT inválido e membro com metadados falsos não leem lista nem escrevem',async()=>{
 for(const options of [{token:null},{token:'invalid'},{user:{...admin,id:memberId,user_metadata:{familia_admin:true,role:'admin'}}}]){
   const app=await fixture(options);const response=await app.request({action:'list'},options);
   assert.equal(response.status,options.user?403:401);assert.deepEqual(app.calls,[]);
 }
});
test('admin revogado, e-mail não coincidente e falha de autorização são rejeitados',async()=>{
 for(const options of [{members:[]},{user:{...admin,email:'other@example.org'}},{memberError:{message:'db secret'}}]){
   const app=await fixture(options);const response=await app.request();assert.ok([403,503].includes(response.status));
   assert.deepEqual(app.calls,[]);assert.doesNotMatch(await response.text(),/db secret/);
 }
});
test('origem indevida, método indevido e configuração em falta falham fechados',async()=>{
 const app=await fixture();assert.equal((await app.request({}, {headers:{origin:'https://attacker.example'}})).status,403);
 assert.equal((await app.request({}, {method:'GET'})).status,405);
 assert.equal((await app.request({}, {method:'OPTIONS',token:null})).status,204);
 const unconfigured=await fixture({noConfig:true});assert.equal((await unconfigured.request()).status,503);
 assert.deepEqual(app.calls,[]);
});
test('lista só devolve campos previstos das quatro pessoas ao administrador',async()=>{
 const app=await fixture({users:[{...admin,encrypted_password:'NEVER-RETURN',access_token:'NEVER-RETURN'}, {id:memberId,email:'outside@example.org'}]});
 const result=await app.request();assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
 const text=await result.text();assert.doesNotMatch(text,/NEVER-RETURN|outside@|access_token|encrypted_password/);
 const data=JSON.parse(text);assert.equal(data.people.length,4);assert.equal(data.people[0].active,true);assert.equal(data.people[1].exists,false);
});
test('criação usa e-mail privado e ignora campos de identidade manipulados',async()=>{
 const app=await fixture();const response=await app.request({action:'create',nome:'Filipa',email:'attacker@example.org',user_id:adminId,role:'admin',password:'Apenas-exemplo-123'});
 assert.equal(response.status,200);
 const input=app.calls.find(call=>call[0]==='create')[1];assert.equal(input.email,people[1].email);assert.equal(input.email_confirm,true);
 assert.equal(input.user_metadata,undefined);assert.equal(input.app_metadata,undefined);
 assert.deepEqual(app.calls.find(call=>call[0]==='upsert')[1],{user_id:memberId,nome:'Filipa'});
 assert.doesNotMatch(await response.text(),/Apenas-exemplo/);
});
test('não autoriza outros nomes ou palavras-passe inválidas',async()=>{
 for(const body of [{action:'create',nome:'Outro',password:'Apenas-exemplo-123'},{action:'create',nome:'Filipa',password:'curta'},{action:'password',nome:'Nuno',password:'é'.repeat(40)}]){
   const app=await fixture();assert.equal((await app.request(body)).status,400);assert.deepEqual(app.calls,[]);
 }
});
test('criação não substitui conta existente nem a sua palavra-passe',async()=>{
 const app=await fixture({users:[admin,{id:memberId,email:people[1].email}]});
 assert.equal((await app.request({action:'create',nome:'Filipa',password:'Apenas-exemplo-123'})).status,409);
 assert.equal(app.calls.some(call=>['update','upsert','create'].includes(call[0])),false);
});
test('reposição da palavra-passe mantém UUID e estado de acesso',async()=>{
 const app=await fixture();assert.equal((await app.request({action:'password',nome:'Nuno',password:'Apenas-exemplo-123'})).status,200);
 assert.deepEqual(app.calls.find(call=>call[0]==='update').slice(1),[adminId,{password:'Apenas-exemplo-123'}]);
 assert.equal(app.calls.some(call=>call[0]==='upsert'),false);
});
test('suspensão bloqueia Auth e remove só a associação; administrador não pode suspender-se',async()=>{
 const app=await fixture({users:[admin,{id:memberId,email:people[1].email}]});
 assert.equal((await app.request({action:'suspend',nome:'Nuno'})).status,400);
 assert.equal((await app.request({action:'suspend',nome:'Filipa'})).status,200);
 assert.deepEqual(app.calls.find(call=>call[0]==='update').slice(1),[memberId,{ban_duration:'876000h'}]);
 assert.deepEqual(app.calls.find(call=>call[0]==='delete'),['delete',memberId]);
});
test('reativação usa a identidade configurada e restaura apenas a associação',async()=>{
 const app=await fixture({users:[admin,{id:memberId,email:people[1].email}]});
 assert.equal((await app.request({action:'activate',nome:'Filipa'})).status,200);
 assert.deepEqual(app.calls.find(call=>call[0]==='update').slice(1),[memberId,{ban_duration:'none',email_confirm:true}]);
 assert.deepEqual(app.calls.find(call=>call[0]==='upsert')[1],{user_id:memberId,nome:'Filipa'});
});
test('falha na associação preserva a conta, bloqueia Auth e não anuncia sucesso',async()=>{
 const app=await fixture({upsertError:{message:'private'}});
 const response=await app.request({action:'create',nome:'Filipa',password:'Apenas-exemplo-123'});
 assert.equal(response.status,502);assert.equal(app.users.length,2);
 assert.deepEqual(app.calls.find(call=>call[0]==='update').slice(1),[memberId,{ban_duration:'876000h'}]);
 assert.match((await response.json()).error,/preservada e bloqueada/);
});
test('falha parcial de suspensão exige conciliação em vez de simular revogação completa',async()=>{
 const app=await fixture({users:[admin,{id:memberId,email:people[1].email}],deleteError:{message:'network'}});
 const response=await app.request({action:'suspend',nome:'Filipa'});assert.equal(response.status,502);
 assert.match((await response.json()).error,/falta revogar/);
});
test('JSON inválido e pedido demasiado longo não executam operações privilegiadas',async()=>{
 const app=await fixture();assert.equal((await app.request({}, {raw:'not JSON'})).status,400);
 assert.equal((await app.request({}, {raw:' '.repeat(4097)})).status,413);assert.deepEqual(app.calls,[]);
});
test('falha do Auth administrativo não expõe detalhes internos',async()=>{
 const app=await fixture({updateError:{message:'SECRET'}});
 const response=await app.request({action:'password',nome:'Nuno',password:'Apenas-exemplo-123'});
 assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/SECRET/);
});
test('paginação procura contas além da primeira página sem devolver estranhos',async()=>{
 const users=Array.from({length:100},(_,i)=>({id:`outside-${i}`,email:`outside-${i}@example.org`}));users.push(admin);
 const app=await fixture({users});const response=await app.request();assert.equal(response.status,200);
 assert.equal((await response.json()).people[0].exists,true);assert.equal(app.calls.filter(call=>call[0]==='list').length,2);
});

test('cliente normal não pode invocar a preparação de convites através da função',async()=>{
 const app=await fixture({user:{...admin,id:memberId}});const response=await app.request({action:'create',nome:'Filipa',password:'Apenas-exemplo-123'});
 assert.equal(response.status,403);assert.deepEqual(app.calls,[]);
});
test('falha de migração não cria nem altera conta de autenticação',async()=>{
 const app=await fixture({invitationError:{message:'RPC missing'}});
 const response=await app.request({action:'create',nome:'Filipa',password:'Apenas-exemplo-123'});assert.equal(response.status,502);
 assert.equal(app.calls.some(call=>['create','update','upsert'].includes(call[0])),false);
});
test('repor palavra-passe de conta suspensa mantém o convite revogado',async()=>{
 const app=await fixture({users:[admin,{id:memberId,email:people[1].email,banned_until:'2099-01-01',email_confirmed_at:'2026-01-01'}]});
 const response=await app.request({action:'password',nome:'Filipa',password:'Apenas-exemplo-123'});assert.equal(response.status,200);
 assert.equal(app.calls.find(call=>call[0]==='invitation')[1].p_ativo,false);
 assert.equal(app.calls.some(call=>call[0]==='upsert'),false);
});
