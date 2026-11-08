const {test}=require('node:test');const assert=require('node:assert/strict');
const modulePromise=import('../family-store.js');let sequence=0;
class Storage{constructor(){this.map=new Map();this.fail=false}get length(){return this.map.size}key(i){return [...this.map.keys()][i]??null}getItem(k){return this.map.get(k)??null}setItem(k,v){if(this.fail)throw Error('quota');this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}}
const key='familia-compras-v1';
async function setup({storage=new Storage(),database={compras:{data:[],version:1}},userId='user-a',client}={}){
 const {FamilyStore}=await modulePromise;
 const calls=[];
 client??={from(table){assert.equal(table,'familia_dados');return {select(){return {eq(column,topic){return {single:async()=>({data:{tema:topic,conteudo:structuredClone(database[topic].data),versao:database[topic].version},error:null})}}}}}},rpc:async(name,args)=>{
  assert.equal(name,'guardar_familia_dados');calls.push(structuredClone(args));const row=database[args.p_tema];
  if(row.version!==args.p_versao)return {data:[],error:null};row.data=structuredClone(args.p_conteudo);row.version++;return {data:[{nova_versao:row.version}],error:null};
 }};
 const store=new FamilyStore({client,storage,userId,id:()=>String(++sequence)});await store.load('compras');return {store,storage,database,calls,client};
}
test('leitura usa apenas Supabase e não publica a cópia antiga automaticamente',async()=>{
 const storage=new Storage();const legacy=[{id:'old',name:'Cópia antiga'}];storage.setItem(key,JSON.stringify(legacy));
 const app=await setup({storage});assert.deepEqual(app.store.get(key,[]),[]);assert.deepEqual(app.store.records.compras.legacy.data,legacy);
 assert.equal(app.calls.length,0);assert.equal(storage.getItem(key),JSON.stringify(legacy));
});
test('cópia antiga já publicada no GitHub não é confundida com alteração por publicar',async()=>{
 const storage=new Storage();storage.setItem(key,'[{"id":"old"}]');storage.setItem('familia-gh-snapshot-v1',JSON.stringify({compras:'[{"id":"old"}]'}));
 const app=await setup({storage});assert.equal(app.store.records.compras.legacy,null);
});
test('gravação confirmada avança a versão e resolve apenas o rascunho enviado',async()=>{
 const app=await setup();app.store.changed(key,[{id:'a',name:'Exemplo'}]);assert.equal(app.store.records.compras.dirty,true);
 assert.equal(await app.store.save('compras'),true);assert.equal(app.database.compras.version,2);assert.equal(app.store.records.compras.dirty,false);
 assert.equal(app.calls[0].p_versao,1);
});
test('falha de rede mantém dados por confirmar e permite exportação sem tokens',async()=>{
 const app=await setup();app.storage.setItem('sb-project-auth-token','DO-NOT-EXPORT');
 app.store.changed(key,[{id:'pending'}]);app.client.rpc=async()=>({error:{message:'offline'},data:null});
 assert.equal(await app.store.save('compras'),false);assert.equal(app.store.records.compras.dirty,true);
 assert.match(app.store.records.compras.error,/Sem confirmação/);assert.doesNotMatch(JSON.stringify(app.store.export()),/DO-NOT-EXPORT/);
 const next=await setup({storage:app.storage,database:app.database});assert.deepEqual(next.store.get(key),[{id:'pending'}]);assert.equal(next.calls.length,0);
});
test('resposta perdida depois de gravar é reconhecida na leitura seguinte sem repetir a escrita',async()=>{
 const app=await setup();app.store.changed(key,[{id:'saved'}]);const rpc=app.client.rpc;
 app.client.rpc=async(...args)=>{await rpc(...args);return {error:{message:'response lost'},data:null}};
 await app.store.save('compras');const next=await setup({storage:app.storage,database:app.database});
 assert.equal(next.store.records.compras.dirty,false);assert.equal(next.database.compras.version,2);
});
test('edições feitas durante uma gravação não são apagadas pela resposta anterior',async()=>{
 const app=await setup();let release;const rpc=app.client.rpc;
 app.client.rpc=(...args)=>new Promise(resolve=>{release=async()=>resolve(await rpc(...args))});
 app.store.changed(key,[{id:'a'}]);const pending=app.store.save('compras');
 app.store.changed(key,[{id:'a'},{id:'b'}]);await release();await pending;
 assert.deepEqual(app.store.get(key),[{id:'a'},{id:'b'}]);assert.equal(app.store.records.compras.dirty,true);assert.equal(app.store.records.compras.version,2);
 app.client.rpc=rpc;await app.store.save('compras');assert.deepEqual(app.database.compras.data,[{id:'a'},{id:'b'}]);assert.equal(app.database.compras.version,3);
});
test('duas sessões concorrentes: uma grava, a outra conserva o rascunho em conflito',async()=>{
 const database={compras:{data:[],version:1}};const a=await setup({database}),b=await setup({database});
 a.store.changed(key,[{id:'a'}]);b.store.changed(key,[{id:'b'}]);await a.store.save('compras');
 assert.equal(await b.store.save('compras'),false);assert.equal(b.store.records.compras.conflict,true);
 assert.deepEqual(b.store.get(key),[{id:'b'}]);assert.deepEqual(database.compras.data,[{id:'a'}]);
});
test('separadores mantêm rascunhos independentes e todas as versões podem ser conciliadas',async()=>{
 const storage=new Storage(),database={compras:{data:[],version:1}};const a=await setup({storage,database}),b=await setup({storage,database});
 a.store.changed(key,[{id:'a'}]);b.store.changed(key,[{id:'b'}]);assert.notEqual(a.store.key('compras'),b.store.key('compras'));
 const c=await setup({storage,database});assert.equal(c.store.records.compras.conflict,true);assert.equal(c.store.records.compras.candidates.length,2);
 await c.store.resolve('compras',[{id:'a'},{id:'b'}],1);await c.store.save('compras');
 const d=await setup({storage,database});assert.equal(d.store.records.compras.dirty,false);assert.deepEqual(d.store.get(key),[{id:'a'},{id:'b'}]);
 assert.ok(Object.keys(d.store.export().journals).length>=4);
});
test('uma conta diferente não vê rascunhos Supabase da conta anterior',async()=>{
 const a=await setup();a.store.changed(key,[{id:'private'}]);const b=await setup({storage:a.storage,userId:'user-b'});
 assert.deepEqual(b.store.get(key),[]);assert.doesNotMatch(JSON.stringify(b.store.export()),/private/);
});
test('aceitar remoto conserva a cópia anterior e não escreve no servidor',async()=>{
 const app=await setup();app.store.changed(key,[{id:'local'}]);await app.store.acceptRemote('compras');
 assert.equal(app.store.records.compras.dirty,false);assert.ok(app.store.records.compras.history.some(v=>v.data[0]?.id==='local'));assert.equal(app.calls.length,0);
});
test('atualizar não descarta conflitos entre rascunhos mesmo se um coincide com o servidor',async()=>{
 const app=await setup();app.store.changed(key,[{id:'a'}]);app.store.records.compras.conflict=true;app.database.compras={data:[{id:'a'}],version:2};
 await app.store.refresh('compras');assert.equal(app.store.records.compras.conflict,true);assert.equal(app.store.records.compras.dirty,true);
});
test('conciliação rejeita uma versão remota que mudou depois da comparação',async()=>{
 const app=await setup();app.store.changed(key,[{id:'local'}]);app.database.compras={data:[{id:'other'}],version:2};
 await assert.rejects(app.store.resolve('compras',[{id:'merged'}],1),/mudaram/);assert.deepEqual(app.store.get(key),[{id:'local'}]);assert.equal(app.calls.length,0);
});
test('quota local impede substituição e mantém a alteração em memória para exportar',async()=>{
 const app=await setup();app.store.changed(key,[{id:'before'}]);const raw=app.storage.getItem(app.store.key('compras'));app.storage.fail=true;
 assert.equal(app.store.changed(key,[{id:'after'}]),false);assert.equal(app.storage.getItem(app.store.key('compras')),raw);
 assert.deepEqual(app.store.export().topics.compras.data,[{id:'after'}]);assert.equal(await app.store.save('compras'),false);
 await assert.rejects(app.store.acceptRemote('compras'),/conservar/);assert.deepEqual(app.store.get(key),[{id:'after'}]);
});
test('restauro cria um conflito explícito e não faz gravação automática',async()=>{
 const app=await setup();app.store.restore('compras',[{id:'restore'}]);assert.equal(app.store.records.compras.conflict,true);assert.equal(await app.store.save('compras'),false);assert.equal(app.calls.length,0);
});
test('resposta RPC inválida não é tratada como gravação confirmada',async()=>{
 const app=await setup();app.store.changed(key,[{id:'a'}]);app.client.rpc=async()=>({data:[{nova_versao:999}],error:null});
 assert.equal(await app.store.save('compras'),false);assert.equal(app.store.records.compras.dirty,true);
});
test('sessão desativada não pode continuar a ler ou gravar',async()=>{
 const app=await setup();app.store.deactivate();assert.equal(app.store.changed(key,[{id:'a'}]),false);await assert.rejects(app.store.remote('compras'),/sessão terminou/);
});

test('exportação completa pode ser importada noutra conta sem publicar nem perder os rascunhos',async()=>{
 const a=await setup();a.store.changed(key,[{id:'exportado'}]);const pack=a.store.export();
 const b=await setup({userId:'user-b'});assert.equal(b.store.importPack(pack),1);
 assert.deepEqual(b.store.get(key),[{id:'exportado'}]);assert.equal(b.store.records.compras.conflict,true);assert.equal(b.calls.length,0);
 const archives=Object.values(b.store.export().journals).map(JSON.parse).filter(x=>x.archived);assert.ok(archives.some(x=>x.data[0]?.id==='exportado'));
});

test('menu original permanece intacto e pode ser conciliado e exportado',async()=>{
 const storage=new Storage();const raw=JSON.stringify({inicio:'2026-11-07',sel:{'0A':'Ideia antiga'},ideas:{A:['Ideia antiga'],J:[]}});storage.setItem('menu-semana',raw);
 const app=await setup({storage,database:{compras:{data:[],version:1},refeicoes:{data:{weeks:{},dishes:{A:[],J:[]}},version:1}}});
 await app.store.load('refeicoes');assert.equal(app.store.records.refeicoes.legacy.data.weeks['2026-11-07'][0].A.dish,'Ideia antiga');assert.equal(storage.getItem('menu-semana'),raw);
});
