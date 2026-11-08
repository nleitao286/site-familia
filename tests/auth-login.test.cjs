const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const source=readFileSync(new URL('../familia-login.js',`file://${__filename}`),'utf8').replace(/^import .*;\n/gm,'');
const redirect='https://nleitao286.github.io/site-familia/entrar.html';
async function setup({href=redirect,user=null,member=null,userError=null,memberError=null,storage=new Map(),otpError=null}={}){
 const elements=new Map();
 for(const id of ['login-form','link-form','login-send','login-email','link-email','login-password','password-login','login-message','login-area','session-area','session-controls','session-person','otp-area','otp-form','otp-code','otp-confirm','logout']){
   elements.set(id,{hidden:true,disabled:false,value:'',textContent:'',dataset:{},listeners:{},addEventListener(event,callback){this.listeners[event]=callback}});
 }
 let now=1000000;
 const calls={send:[],verify:[],signOut:[],password:[]};
 const auth={
   signInWithPassword:async options=>{calls.password.push(options);return {error:null}},
   getUser:async()=>({data:{user},error:userError}),
   signInWithOtp:async options=>{calls.send.push(options);return {error:otpError}},
   verifyOtp:async options=>{calls.verify.push(options);return {error:null}},
   signOut:async options=>{calls.signOut.push(options);user=null;return {error:null}},
   onAuthStateChange:()=>{}
 };
 const client={auth,from(table){assert.equal(table,'familia_membros');return {select(columns){assert.equal(columns,'nome');return {eq(column,id){assert.equal(column,'user_id');assert.equal(id,user.id);return {maybeSingle:async()=>({data:member,error:memberError})}}}}}}};
 const context={createClient:()=>client,createAdminPanel:()=>({hide(){},async load(){}}),document:{getElementById:id=>elements.get(id)},location:{href,replace(url){this.replaced=url}},URL,URLSearchParams,
   Date:{now:()=>now},sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
   localStorage:{getItem(){throw Error('Não ler dados locais')},setItem(){throw Error('Não alterar dados locais')},clear(){throw Error('Não apagar dados locais')}},
   history:{replaceState:(_state,_title,url)=>{context.location.href=url}},setTimeout:()=>{},setInterval:()=>{}};
 await vm.runInNewContext(`(async()=>{${source}\n})()`,context);
 return {el:id=>elements.get(id),calls,auth,context,storage,advance:ms=>{now+=ms},submit:id=>elements.get(id).listeners.submit({preventDefault(){}}),logout:()=>elements.get('logout').listeners.click()};
}
// Testes de comportamento com API simulada: nunca enviam e-mails nem escrevem dados reais.
test('não envia e-mail ao abrir e usa retorno canónico em produção, localhost e preview',async()=>{
 for(const href of [redirect,redirect+'?next=https://example.org', 'http://localhost:3000/entrar.html','https://preview.example/entrar.html']){
   const app=await setup({href});assert.equal(app.calls.send.length,0);
   app.el('link-email').value=' TESTE@example.org ';
   await app.submit('link-form');
   assert.equal(app.calls.send[0].options.emailRedirectTo,redirect);
   assert.equal(app.calls.send[0].options.shouldCreateUser,false);
   assert.equal(app.calls.send[0].email,'teste@example.org');
 }
});
test('impede duplo envio enquanto o pedido está pendente',async()=>{
 const app=await setup();let finish;
 app.auth.signInWithOtp=options=>{app.calls.send.push(options);return new Promise(resolve=>{finish=resolve})};
 app.el('link-email').value='teste@example.org';
 const first=app.submit('link-form');await app.submit('link-form');
 assert.equal(app.calls.send.length,1);assert.equal(app.el('link-email').disabled,true);
 finish({error:null});await first;assert.equal(app.el('link-email').disabled,false);
});
test('espera de 60 s mantém-se após recarregar o separador',async()=>{
 const app=await setup();app.el('link-email').value='teste@example.org';await app.submit('link-form');
 await app.submit('link-form');assert.equal(app.calls.send.length,1);
 const reload=await setup({storage:app.storage});reload.el('link-email').value='teste@example.org';
 await reload.submit('link-form');assert.equal(reload.calls.send.length,0);
 reload.advance(60001);await reload.submit('link-form');assert.equal(reload.calls.send.length,1);
});
test('quota esgotada bloqueia reenvio sem prometer reposição e sem mostrar OTP novo',async()=>{
 const app=await setup({otpError:{status:429,message:'email rate limit exceeded'}});
 app.el('link-email').value='teste@example.org';await app.submit('link-form');await app.submit('link-form');
 assert.equal(app.calls.send.length,1);assert.equal(app.el('otp-area').hidden,true);
 assert.equal(app.el('login-send').disabled,true);assert.match(app.el('login-message').textContent,/não garante/);
});
test('falha de rede no envio é recuperável e não mostra sucesso',async()=>{
 const app=await setup();app.auth.signInWithOtp=async()=>{throw Error('rede')};
 app.el('link-email').value='teste@example.org';await app.submit('link-form');
 assert.equal(app.el('login-message').dataset.kind,'error');assert.equal(app.el('link-email').disabled,false);
});
test('código usa o e-mail do pedido bem-sucedido, mesmo após editar o campo',async()=>{
 const app=await setup();app.el('link-email').value='primeiro@example.org';await app.submit('link-form');
 app.el('link-email').value='segundo@example.org';app.el('otp-code').value='123456';await app.submit('otp-form');
 assert.equal(app.calls.verify[0].email,'primeiro@example.org');assert.equal(app.calls.verify[0].token,'123456');assert.equal(app.calls.verify[0].type,'email');
});
test('rejeita código inválido sem chamar a API',async()=>{
 const app=await setup();app.el('link-email').value='teste@example.org';await app.submit('link-form');
 app.el('otp-code').value='abc';await app.submit('otp-form');assert.equal(app.calls.verify.length,0);
});
test('falha de verificação permite tentar de novo e não aceita sessão',async()=>{
 const app=await setup();app.el('link-email').value='teste@example.org';await app.submit('link-form');
 app.auth.verifyOtp=async()=>({error:{message:'expired'}});app.el('otp-code').value='123456';await app.submit('otp-form');
 assert.equal(app.el('otp-confirm').disabled,false);assert.equal(app.el('session-area').hidden,true);
 assert.equal(app.el('login-message').dataset.kind,'error');
});
test('erro no magic link mostra instruções e limpa parâmetros de erro',async()=>{
 for(const href of [redirect+'#error=access_denied&error_code=otp_expired&error_description=segredo',redirect+'?view=login&error=access_denied&error_description=segredo']){
   const app=await setup({href});assert.match(app.el('login-message').textContent,/expirou/);
   assert.doesNotMatch(app.context.location.href,/error|segredo/);assert.equal(app.calls.send.length,0);
 }
});
test('membro confirmado mostra acesso e logout termina apenas a sessão local',async()=>{
 const app=await setup({user:{id:'test-user'},member:{nome:'Teste'}});
 assert.equal(app.el('session-area').hidden,false);assert.equal(app.el('login-area').hidden,true);
 await app.logout();assert.equal(app.calls.signOut[0].scope,'local');
 assert.equal(app.el('session-area').hidden,true);assert.equal(app.el('login-area').hidden,false);
});
test('utilizador externo e falha RLS não mostram acesso confirmado e permitem logout',async()=>{
 for(const options of [{},{memberError:{message:'network'}}]){
   const app=await setup({user:{id:'test-user'},...options});
   assert.equal(app.el('session-area').hidden,true);assert.equal(app.el('session-controls').hidden,false);
   assert.equal(app.el('login-message').dataset.kind,'error');await app.logout();assert.equal(app.el('login-area').hidden,false);
 }
});
test('falha ao terminar sessão mantém controlos e apresenta erro',async()=>{
 const app=await setup({user:{id:'test-user'},member:{nome:'Teste'}});
 app.auth.signOut=async()=>({error:{message:'offline'}});await app.logout();
 assert.equal(app.el('session-controls').hidden,false);assert.equal(app.el('logout').disabled,false);
 assert.equal(app.el('login-message').dataset.kind,'error');
});
test('armazenamento indisponível não impede envio',async()=>{
 const storage={get(){throw Error('blocked')},set(){throw Error('blocked')}};
 const app=await setup({storage});app.el('link-email').value='teste@example.org';await app.submit('link-form');
 assert.equal(app.calls.send.length,1);assert.equal(app.el('otp-area').hidden,false);
});

test('entrada por palavra-passe não envia e-mail e limpa o campo após o pedido',async()=>{
 const app=await setup();app.el('login-email').value=' TESTE@example.org ';app.el('login-password').value='Exemplo-falso-123';
 await app.submit('login-form');assert.equal(app.calls.password.length,1);assert.equal(app.calls.send.length,0);
 assert.equal(app.calls.password[0].email,'teste@example.org');assert.equal(app.el('login-password').value,'');
});
test('falha na palavra-passe não expõe detalhes da conta nem bloqueia nova tentativa',async()=>{
 const app=await setup();app.auth.signInWithPassword=async()=>({error:{status:400,message:'secret internal details'}});
 app.el('login-email').value='teste@example.org';app.el('login-password').value='Exemplo-falso-123';await app.submit('login-form');
 assert.equal(app.el('login-message').dataset.kind,'error');assert.doesNotMatch(app.el('login-message').textContent,/secret/);
 assert.equal(app.el('password-login').disabled,false);assert.equal(app.el('login-password').value,'');assert.equal(app.calls.send.length,0);
});
test('entrada por palavra-passe impede pedidos concorrentes',async()=>{
 const app=await setup();let finish;app.auth.signInWithPassword=options=>{app.calls.password.push(options);return new Promise(resolve=>{finish=resolve})};
 app.el('login-email').value='teste@example.org';app.el('login-password').value='Exemplo-falso-123';
 const first=app.submit('login-form');await app.submit('login-form');assert.equal(app.calls.password.length,1);finish({error:null});await first;
});

test('login com membro redireciona apenas para páginas internas autorizadas',async()=>{
 const app=await setup({href:redirect+'?next=menu.html',user:{id:'test-user'},member:{nome:'Teste'}});assert.equal(app.context.location.replaced,'menu.html');
 for(const next of ['https://attacker.example','//attacker.example','menu.html?next=evil']){
  const other=await setup({href:redirect+'?next='+encodeURIComponent(next),user:{id:'test-user'},member:{nome:'Teste'}});assert.equal(other.context.location.replaced,undefined);
 }
});
