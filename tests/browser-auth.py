"""Teste Chromium com APIs simuladas. Não contacta Supabase nem envia e-mails."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://nleitao286.github.io/site-familia/'
MOCK = '''
export function createClient(){
 const people=['Nuno','Filipa','Martim','Madalena'].map((nome,i)=>({nome,email:nome.toLowerCase()+'@example.org',exists:i===0,active:i===0,admin:i===0}));
 const state=window.__auth={user:null,member:null,calls:[],error:null,people};let listener=()=>{};
 function login(email){state.user={id:email==='nuno@example.org'?'admin-user':'member-user'};state.member={nome:email==='nuno@example.org'?'Nuno':'Filipa'};listener()}
 return {auth:{
 getUser:async()=>({data:{user:state.user},error:null}),
 signInWithPassword:async o=>{state.calls.push({type:'password',email:o.email});login(o.email);return {error:null}},
 signInWithOtp:async o=>{state.calls.push({type:'email',...o});return {error:state.error}},
 verifyOtp:async()=>{login('nuno@example.org');return {error:null}},
 signOut:async()=>{state.user=null;listener();return {error:null}},
 onAuthStateChange:fn=>{listener=fn}
 },functions:{invoke:async(name,{body})=>{
 if(!state.user||state.user.id!=='admin-user')return {error:{context:{json:async()=>({error:'Só o administrador pode gerir os acessos.'})}}};
 state.calls.push({type:'admin',action:body.action,nome:body.nome});
 if(body.action==='list')return {data:{people}};
 const person=people.find(person=>person.nome===body.nome);
 if(body.action==='create'){person.exists=true;person.active=true}
 if(body.action==='suspend')person.active=false;
 if(body.action==='activate')person.active=true;
 return {data:{message:'Operação confirmada pelo servidor.'}};
 }},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:state.member,error:null})})})})};
}'''

def route(request):
    url = request.request.url
    if 'cdn.jsdelivr.net/npm/@supabase/' in url:
        request.fulfill(status=200, content_type='application/javascript', body=MOCK)
    elif url.startswith(ORIGIN):
        name = url.split('/')[-1].split('?')[0]
        if name in ['entrar.html', 'familia-login.js', 'familia-admin.js', 'styles.css']:
            content_type = {'html': 'text/html', 'js': 'application/javascript', 'css': 'text/css'}[name.split('.')[-1]]
            request.fulfill(status=200, content_type=content_type, body=(ROOT/name).read_text())
        else:
            request.abort()
    else:
        request.abort()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for label, viewport in [('desktop', {'width': 1280, 'height': 900}), ('mobile', {'width': 390, 'height': 844})]:
        context = browser.new_context(viewport=viewport, is_mobile=label=='mobile', has_touch=label=='mobile')
        context.route('**/*', route)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script("localStorage.setItem('familia-preservar-teste','alteracao-local-pendente')")
        page.goto(ORIGIN+'entrar.html')
        expect(page.locator('#admin-area')).to_be_hidden()
        page.locator('#login-email').fill('nuno@example.org')
        page.locator('#login-password').fill('Exemplo-apenas-123')
        page.locator('#password-login').click()
        expect(page.locator('#session-area')).to_be_visible()
        expect(page.locator('#admin-area')).to_be_visible()
        assert page.evaluate("window.__auth.calls.filter(c=>c.type==='email').length") == 0
        assert page.locator('#login-password').input_value() == ''
        page.locator('#admin-person').select_option('Filipa')
        page.locator('#admin-action').select_option('create')
        page.locator('#admin-password').fill('Exemplo-apenas-123')
        page.locator('#admin-password-confirm').fill('Diferente-apenas-123')
        page.locator('#admin-save').click()
        expect(page.locator('#admin-message')).to_contain_text('mesma palavra-passe')
        page.locator('#admin-password-confirm').fill('Exemplo-apenas-123')
        page.locator('#admin-save').click()
        expect(page.locator('#admin-message')).to_contain_text('confirmada pelo servidor')
        expect(page.locator('#admin-state')).to_contain_text('acesso ativo')
        assert page.locator('#admin-password').input_value() == ''
        page.locator('#admin-action').select_option('password')
        page.locator('#admin-password').fill('Novo-exemplo-123')
        page.locator('#admin-password-confirm').fill('Novo-exemplo-123')
        page.locator('#admin-save').click()
        expect(page.locator('#admin-message')).to_contain_text('confirmada pelo servidor')
        page.locator('#admin-action').select_option('suspend')
        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('#admin-save').click()
        expect(page.locator('#admin-state')).to_contain_text('suspenso')
        page.locator('#admin-action').select_option('activate')
        page.locator('#admin-save').click()
        expect(page.locator('#admin-state')).to_contain_text('acesso ativo')
        page.locator('#admin-person').select_option('Nuno')
        page.locator('#admin-action').select_option('suspend')
        expect(page.locator('#admin-save')).to_be_disabled()
        page.screenshot(path='/tmp/site-familia-acessos-'+label+'.png',full_page=True)
        page.locator('#logout').click()
        expect(page.locator('#login-area')).to_be_visible()
        expect(page.locator('#admin-area')).to_be_hidden()
        assert page.locator('#admin-person').text_content() == ''
        page.locator('#login-email').fill('filipa@example.org')
        page.locator('#login-password').fill('Exemplo-apenas-123')
        page.locator('#password-login').click()
        expect(page.locator('#session-area')).to_be_visible()
        expect(page.locator('#admin-area')).to_be_hidden()
        page.locator('#logout').click()
        expect(page.locator('#login-area')).to_be_visible()
        page.locator('summary').click()
        page.locator('#link-email').fill('nuno@example.org')
        page.locator('#login-send').click()
        expect(page.locator('#otp-area')).to_be_visible()
        expect(page.locator('#login-send')).to_be_disabled()
        assert page.evaluate("window.__auth.calls.find(c=>c.type==='email').options.emailRedirectTo") == ORIGIN+'entrar.html'
        page.reload()
        page.locator('summary').click()
        expect(page.locator('#login-send')).to_be_disabled()
        assert page.evaluate("localStorage.getItem('familia-preservar-teste')") == 'alteracao-local-pendente'
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        assert not errors, errors
        print(label+': palavra-passe/admin/criação/reset/suspensão/reativação/logout/membro/ligação/espera/dados locais OK')
        context.close()
    browser.close()
