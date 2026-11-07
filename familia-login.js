import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm";
const URL="https://rhpmebmytzmfwitjrfau.supabase.co",KEY="sb_publishable_4c94DsunCCoQjMyuHoxzWg_jK_7qQtm";
const supabase=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
let pendingEmail="";
function message(text,kind="info"){const el=$("login-message");el.textContent=text;el.dataset.kind=kind;el.hidden=false}
function busy(v){$("login-send").disabled=v;$("login-send").textContent=v?"A ENVIAR…":"ENVIAR LIGAÇÃO"}
async function renderSession(){
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user){$("session-area").hidden=true;$("login-area").hidden=false;return}
 const {data:member,error:permissionError}=await supabase.from("familia_membros").select("nome").eq("user_id",user.id).maybeSingle();
 if(permissionError){message("Não foi possível confirmar o acesso familiar: "+permissionError.message,"error");return}
 if(!member){message("O e-mail está autenticado, mas ainda não foi autorizado como membro da família. Contacta o administrador.","error");$("session-area").hidden=true;return}
 $("session-person").textContent="Bem-vindo, "+member.nome+". A tua conta foi reconhecida.";
 $("session-area").hidden=false;$("login-area").hidden=true;$("otp-area").hidden=true;
 message("Acesso familiar autenticado com sucesso.","success");
}
$("login-form").addEventListener("submit",async event=>{
 event.preventDefault();pendingEmail=$("login-email").value.trim().toLowerCase();
 if(!pendingEmail)return;busy(true);
 try{
   const {error}=await supabase.auth.signInWithOtp({email:pendingEmail,options:{emailRedirectTo:location.origin+location.pathname}});
   if(error)throw error;
   message("Se o e-mail for aceite, receberás uma ligação de acesso. Abre-a no mesmo navegador. Verifica também a pasta de spam.","success");
   $("otp-area").hidden=false;
 }catch(e){
   if(e?.status===429 || /rate limit|too many requests/i.test(e?.message||"")){
     message("O Supabase atingiu o limite de e-mails de autenticação do projeto (2 por hora no serviço de e-mail de teste). Não insistas no envio: espera pelo restabelecimento do limite ou configura SMTP próprio no Supabase. A base de dados não foi afetada.","error");
   }else{
     message("Não foi possível enviar a ligação: "+(e.message||e),"error");
   }
 }
 finally{busy(false)}
});
$("otp-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const code=$("otp-code").value.trim();
 if(!pendingEmail){message("Introduz primeiro o teu e-mail.","error");return}
 const {error}=await supabase.auth.verifyOtp({email:pendingEmail,token:code,type:"email"});
 if(error){message("Código não aceite: "+error.message,"error");return}
 await renderSession();
});
$("logout").addEventListener("click",async()=>{await supabase.auth.signOut();location.reload()});
supabase.auth.onAuthStateChange(()=>{setTimeout(()=>renderSession(),0)});
await renderSession();
