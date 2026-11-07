import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm";
const URL="https://rhpmebmytzmfwitjrfau.supabase.co",KEY="sb_publishable_4c94DsunCCoQjMyuHoxzWg_jK_7qQtm";
// Endereço exato autorizado no Dashboard: nunca derivar de previews/localhost.
const LOGIN_REDIRECT_URL="https://nleitao286.github.io/site-familia/entrar.html";
const supabase=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const COOLDOWN_KEY="familia-auth-next-send";
let pendingEmail="",sending=false,verifying=false,sessionVersion=0,nextSendAt=0;
try{nextSendAt=Number(sessionStorage.getItem(COOLDOWN_KEY))||0}catch{}
function message(text,kind="info"){const el=$("login-message");el.textContent=text;el.dataset.kind=kind;el.hidden=false}
function updateSendButton(){
 const seconds=Math.max(0,Math.ceil((nextSendAt-Date.now())/1000));
 $("login-send").disabled=sending||seconds>0;
 $("login-send").textContent=sending?"A ENVIAR…":seconds>0?`AGUARDA ${seconds} S`:"ENVIAR LIGAÇÃO";
 $("login-email").disabled=sending;
}
function cooldown(){
 nextSendAt=Date.now()+60000;
 try{sessionStorage.setItem(COOLDOWN_KEY,String(nextSendAt))}catch{}
 updateSendButton();
}
async function renderSession(){
 const version=++sessionVersion;
 if($("login-message").dataset.kind==="success")$("login-message").hidden=true;
 $("session-area").hidden=true;$("session-controls").hidden=true;
 $("login-area").hidden=false;
 try{
   const {data:{user},error}=await supabase.auth.getUser();
   if(version!==sessionVersion)return;
   if(error){
     if(error.name!=="AuthSessionMissingError")message("Não foi possível confirmar a sessão. Verifica a ligação e tenta novamente.","error");
     return;
   }
   if(!user)return;
   $("login-area").hidden=true;$("otp-area").hidden=true;$("session-controls").hidden=false;
   const {data:member,error:permissionError}=await supabase.from("familia_membros").select("nome").eq("user_id",user.id).maybeSingle();
   if(version!==sessionVersion)return;
   if(permissionError){message("Não foi possível confirmar o acesso familiar. Verifica a ligação ou termina sessão e tenta novamente.","error");return}
   if(!member){message("O e-mail está autenticado, mas não foi autorizado como membro da família. Contacta o administrador ou termina sessão para usar outra conta.","error");return}
   $("session-person").textContent="Bem-vindo, "+member.nome+". A tua conta foi reconhecida.";
   $("session-area").hidden=false;
   message("Acesso familiar autenticado com sucesso.","success");
 }catch{
   if(version===sessionVersion)message("Não foi possível confirmar a sessão. Verifica a ligação e tenta novamente.","error");
 }
}
$("login-form").addEventListener("submit",async event=>{
 event.preventDefault();
 if(sending||Date.now()<nextSendAt)return;
 const email=$("login-email").value.trim().toLowerCase();
 if(!email)return;
 sending=true;updateSendButton();
 try{
   const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:LOGIN_REDIRECT_URL}});
   if(error)throw error;
   pendingEmail=email;cooldown();
   message("Se o e-mail for aceite, receberás uma ligação de acesso. Abre-a no mesmo navegador. Verifica também a pasta de spam. Aguarda antes de pedir outra ligação.","success");
   $("otp-code").value="";$("otp-area").hidden=false;
 }catch(e){
   cooldown();
   if(e?.status===429 || /rate limit|too many requests/i.test(e?.message||"")){
     message("Foi atingido o limite de pedidos ou de e-mails de autenticação. Não repitas o envio: aguarda a reposição do limite ou contacta o administrador. A espera do botão não garante que a quota do serviço já esteja disponível.","error");
   }else{
     message("Não foi possível enviar a ligação. Verifica a ligação à Internet e tenta mais tarde.","error");
   }
 }
 finally{sending=false;updateSendButton()}
});
$("otp-form").addEventListener("submit",async event=>{
 event.preventDefault();
 if(verifying)return;
 const code=$("otp-code").value.trim();
 if(!pendingEmail){message("Pede primeiro uma ligação com o teu e-mail neste separador.","error");return}
 if(!/^[0-9]{6}$/.test(code)){message("Introduz o código de seis dígitos recebido por e-mail.","error");return}
 verifying=true;$("otp-confirm").disabled=true;
 try{
   const {error}=await supabase.auth.verifyOtp({email:pendingEmail,token:code,type:"email"});
   if(error){message("Código não aceite ou expirado. Verifica o último e-mail recebido.","error");return}
   await renderSession();
 }catch{message("Não foi possível confirmar o código. Verifica a ligação e tenta novamente.","error")}
 finally{verifying=false;$("otp-confirm").disabled=false}
});
$("logout").addEventListener("click",async()=>{
 $("logout").disabled=true;
 try{
   const {error}=await supabase.auth.signOut({scope:"local"});
   if(error)throw error;
   ++sessionVersion;pendingEmail="";$("otp-code").value="";
   $("session-area").hidden=true;$("session-controls").hidden=true;$("otp-area").hidden=true;$("login-area").hidden=false;
   message("Sessão terminada neste navegador.","success");
 }catch{message("Não foi possível terminar a sessão. Verifica a ligação e tenta novamente.","error")}
 finally{$("logout").disabled=false}
});
// O SDK processa a sessão do magic link; os erros do retorno nunca são HTML.
const callbackUrl=new globalThis.URL(location.href);
const hash=new URLSearchParams(callbackUrl.hash.slice(1));
const callbackError=callbackUrl.searchParams.has("error")||hash.has("error")||callbackUrl.searchParams.has("error_code")||hash.has("error_code");
if(callbackError){
 message("A ligação de acesso não é válida ou expirou. Usa a ligação mais recente ou pede outra após o período de espera.","error");
 for(const key of ["error","error_code","error_description"]){callbackUrl.searchParams.delete(key);hash.delete(key)}
 callbackUrl.hash=hash.toString();history.replaceState(null,"",callbackUrl.href);
}
supabase.auth.onAuthStateChange(()=>{setTimeout(()=>renderSession(),0)});
updateSendButton();setInterval(updateSendButton,1000);
await renderSession();
