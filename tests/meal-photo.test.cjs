const {test}=require('node:test');const assert=require('node:assert/strict');
const backend=import('../supabase/functions/familia-prato-foto/handler.js');const frontend=import('../meal-photo.js');
const image='data:image/jpeg;base64,/9j/2Q==';
const result={is_food:true,dish:'Arroz de legumes',portion_g:300,kcal_per_100g:160,notes:'O azeite pode alterar a estimativa.'};
async function fixture(options={}){
 const {createPhotoHandler}=await backend;const calls=[];
 const handler=createPhotoHandler({authorize:options.authorize|| (async()=> 'member-a'),apiKey:options.apiKey===undefined?'test-key-not-real':options.apiKey,
 fetcher:async(url,init)=>{calls.push({url,init});if(options.throwError)throw Error('private-details');return new Response(JSON.stringify(options.response||{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(options.result||result)}]}]}),{status:options.status||200})}});
 const request=async(body={image},extra={})=>handler(new Request('https://example.org/photo',{method:extra.method||'POST',headers:{'Content-Type':'application/json',...(extra.noToken?{}:{Authorization:'Bearer user-session-test'}),...extra.headers},...(['GET','OPTIONS'].includes(extra.method)?{}:{body:extra.raw||JSON.stringify(body)})}));
 return {request,calls};
}
test('anónimo e utilizador fora da família não enviam imagens ao fornecedor',async()=>{
 const a=await fixture();assert.equal((await a.request({image},{noToken:true})).status,401);assert.equal(a.calls.length,0);
 const b=await fixture({authorize:async()=>null});assert.equal((await b.request()).status,403);assert.equal(b.calls.length,0);
});
test('serviço sem chave falha sem resultados fictícios ou chamadas externas',async()=>{
 const app=await fixture({apiKey:''});const response=await app.request();assert.equal(response.status,503);assert.match((await response.json()).error,/configurada/);assert.equal(app.calls.length,0);
});
test('origem e método indevidos são recusados',async()=>{
 const app=await fixture();assert.equal((await app.request({},{headers:{Origin:'https://other.example'}})).status,403);assert.equal((await app.request({},{method:'GET'})).status,405);assert.equal(app.calls.length,0);
});
test('URLs externas, formatos falsos, peso inválido e corpo demasiado grande são recusados',async()=>{
 for(const body of [{image:'https://example.org/secret.jpg'},{image:'data:image/svg+xml;base64,PHN2Zz4='},{image:'data:image/jpeg;base64,YWJjZA=='},{image,portion_g:-2}]){
  const app=await fixture();assert.equal((await app.request(body)).status,400);assert.equal(app.calls.length,0);
 }
 const app=await fixture();assert.equal((await app.request({},{raw:'x'.repeat(1700001)})).status,413);assert.equal(app.calls.length,0);
});
test('resultado validado e peso conhecido prevalecem sobre a estimativa visual',async()=>{
 const app=await fixture();const response=await app.request({image,portion_g:450});assert.equal(response.status,200);
 const data=(await response.json()).result;assert.equal(data.portion_g,450);assert.equal(data.dish,result.dish);assert.equal(data.source,'photo-estimate');
 const payload=JSON.parse(app.calls[0].init.body);assert.equal(payload.store,false);assert.equal(payload.text.format.type,'json_schema');assert.equal(payload.input[0].content[1].image_url,image);
 assert.equal(app.calls[0].init.headers.Authorization,'Bearer test-key-not-real');assert.doesNotMatch(JSON.stringify(payload),/user-session-test/);
});
test('foto sem comida não é convertida numa refeição',async()=>{
 const app=await fixture({result:{...result,is_food:false}});assert.equal((await app.request()).status,422);
});
test('respostas inválidas, truncadas ou com densidade impossível não são usadas',async()=>{
 for(const options of [{result:{...result,kcal_per_100g:2000}},{response:{status:'incomplete',output:[]}},{response:{status:'completed',output:[]}}]){
  const app=await fixture(options);assert.equal((await app.request()).status,502);
 }
});
test('erros e limites do fornecedor são claros sem expor detalhes internos',async()=>{
 const rate=await fixture({status:429});assert.equal((await rate.request()).status,429);
 const fail=await fixture({throwError:true});const response=await fail.request();assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/private-details|test-key/);
});
test('reenvio imediato não executa uma segunda análise',async()=>{
 const app=await fixture();await app.request();assert.equal((await app.request()).status,429);assert.equal(app.calls.length,1);
});
test('correção de porção recalcula calorias e exclui imagem dos dados a guardar',async()=>{
 const {photoNutrition}=await frontend;const value=photoNutrition({dish:'Prato',portion_g:400,kcal_per_100g:160,image});assert.equal(value.kcal_estimate,640);assert.equal(value.image,undefined);
 assert.throws(()=>photoNutrition({dish:'Prato',portion_g:0,kcal_per_100g:100}));
});
