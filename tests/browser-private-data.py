"""Integração com a aplicação real e serviço simulado partilhado entre browsers."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
BASE='https://nleitao286.github.io/site-familia/'
DB={t:{'tema':t,'conteudo':([] if t!='refeicoes' else {'weeks':{},'dishes':{'A':['Ideia de teste'],'J':[]}}),'versao':1} for t in ['refeicoes','viaturas','compras','compromissos']}
CALLS=[]
MOCK='''
export function createClient(){
 const role=()=>localStorage.getItem('TEST_SIGNED_OUT')?'anon':window.TEST_ROLE||'anon';
 const offline=()=>window.TEST_NETWORK_OFFLINE;
 return {auth:{
 getUser:async()=>({data:{user:role()==='anon'?null:{id:role()}},error:offline()?{name:'NetworkError'}:null}),
 onAuthStateChange:fn=>{window.TEST_AUTH_LISTENER=fn},
 signOut:async()=>{localStorage.setItem('TEST_SIGNED_OUT','1');window.TEST_AUTH_LISTENER?.('SIGNED_OUT');return {error:null}},
 signInWithPassword:async()=>({error:null})
 },functions:{invoke:async()=>({error:{context:{status:403,json:async()=>({error:'Não autorizado'})}}})},from(table){return {select(){return {eq(column,value){return {
 maybeSingle:async()=>({data:['user-a','user-b'].includes(role())?{nome:role()==='user-a'?'Nuno':'Filipa'}:null,error:offline()?{}:null}),
 single:async()=>{if(offline())return {error:{},data:null};const r=await fetch('https://mock-family.example/data?topic='+value+'&role='+role());return {data:await r.json(),error:r.ok?null:{}}}
 }}}}}},rpc:async(name,args)=>{if(offline())return {error:{},data:null};const r=await fetch('https://mock-family.example/save?role='+role(),{method:'POST',body:JSON.stringify(args)});return {data:await r.json(),error:r.ok?null:{}}}
 };
}'''
def route(request):
 url=request.request.url
 if 'cdn.jsdelivr.net/npm/@supabase/' in url:
  request.fulfill(status=200,content_type='application/javascript',body=MOCK)
 elif url.startswith('https://mock-family.example/'):
  from urllib.parse import urlparse,parse_qs
  parsed=urlparse(url);q=parse_qs(parsed.query);role=q.get('role',['anon'])[0]
  CALLS.append((parsed.path,role))
  if role not in ['user-a','user-b']:request.fulfill(status=403,json={'error':'denied'});return
  if parsed.path=='/data':request.fulfill(status=200,json=DB[q['topic'][0]]);return
  args=json.loads(request.request.post_data);row=DB[args['p_tema']]
  if args['p_versao']!=row['versao']:request.fulfill(status=200,json=[]);return
  row['conteudo']=args['p_conteudo'];row['versao']+=1
  request.fulfill(status=200,json=[{'nova_versao':row['versao']}])
 elif url.startswith(BASE):
  name=url[len(BASE):].split('?')[0] or 'index.html'
  if name.startswith('dados/') or name.endswith('.sql'):
   request.fulfill(status=404,body='not found');return
  path=ROOT/name
  if path.is_file() and path.suffix in ['.html','.js','.css']:
   request.fulfill(status=200,content_type={'.html':'text/html','.js':'application/javascript','.css':'text/css'}[path.suffix],body=path.read_text())
  else:request.fulfill(status=404,body='not found')
 else:request.abort()

def context(browser,role='user-a',mobile=False,js=True):
 ctx=browser.new_context(java_script_enabled=js,viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},is_mobile=mobile)
 ctx.route('**/*',route);ctx.add_init_script('window.TEST_ROLE='+json.dumps(role))
 return ctx

def ready(page,path):
 page.goto(BASE+path)
 expect(page.locator('html')).to_have_attribute('data-family-auth','ready')

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for role in ['anon','outsider']:
  ctx=context(browser,role);page=ctx.new_page()
  page.add_init_script("localStorage.setItem('familia-menu-v3',JSON.stringify({weeks:{},dishes:{A:['SEGREDO-LOCAL-TESTE'],J:[]}}))")
  before=len(CALLS);page.goto(BASE+'menu.html');page.wait_for_url('**/entrar.html?next=menu.html')
  assert 'SEGREDO-LOCAL-TESTE' not in page.locator('body').inner_text();assert len(CALLS)==before
  ctx.close()
 ctx=context(browser,'anon',js=False);page=ctx.new_page();page.goto(BASE+'menu.html');expect(page.locator('.shell')).to_be_hidden();ctx.close()
 print('Anónimo/não membro/JavaScript desligado: nenhum dado carregado ou mostrado.')
 a=context(browser,'user-a');b=context(browser,'user-b',mobile=True);pa=a.new_page();pb=b.new_page();errors=[]
 for page in [pa,pb]:page.on('pageerror',lambda e:errors.append(str(e)))
 ready(pa,'compras.html');ready(pb,'compras.html')
 pa.locator('#shopping-name').fill('Artigo A');pa.locator('#shopping-form button[type=submit]').click()
 expect(pa.locator('#sync-state')).to_have_text('SUPABASE');pa.wait_for_timeout(1000)
 assert len(DB['compras']['conteudo'])==1
 pb.locator('#shopping-name').fill('Artigo B');pb.locator('#shopping-form button[type=submit]').click()
 expect(pb.locator('#sync-state')).to_have_text('CONFLITO')
 pb.locator('#sync-reconcile summary').click()
 merged=DB['compras']['conteudo']+[{'id':'merged-b','name':'Artigo B','done':False}]
 pb.get_by_label('Versão conciliada de Compras').fill(json.dumps(merged))
 pb.once('dialog',lambda dialog:dialog.accept())
 pb.get_by_role('button',name='GUARDAR VERSÃO CONCILIADA').click()
 expect(pb.locator('#sync-state')).to_have_text('SUPABASE');assert len(DB['compras']['conteudo'])==2
 pa.locator('#sync-reload').click();expect(pa.locator('#shopping-list')).to_contain_text('Artigo B')
 # Uma alteração durante falha de rede mantém rascunho; a nova página pede autenticação antes de o recuperar.
 pa.evaluate('window.TEST_NETWORK_OFFLINE=true');pa.locator('#shopping-name').fill('Sem rede');pa.locator('#shopping-form button[type=submit]').click()
 expect(pa.locator('#auth-gate')).to_be_visible();assert len(DB['compras']['conteudo'])==2
 pa.on('dialog',lambda dialog:dialog.accept())
 pa.reload();expect(pa.locator('html')).to_have_attribute('data-family-auth','ready');expect(pa.locator('#shopping-list')).to_contain_text('Sem rede')
 pa.locator('#sync-publish').click();expect(pa.locator('#sync-state')).to_have_text('SUPABASE');assert len(DB['compras']['conteudo'])==3
 # Refeições em dois browsers: nova ideia fica no servidor e aparece após atualizar.
 ready(pa,'menu.html');ready(pb,'menu.html')
 pa.locator('#meal-new-A').fill('Prato novo de teste');pa.locator('form.meal-idea[data-meal=A] button').click();pa.wait_for_timeout(1000)
 pb.locator('#sync-reload').click();expect(pb.locator('#dish-library')).to_contain_text('Prato novo de teste')
 for path in ['index.html','viaturas.html','compromissos.html','recuperar.html']:
  ready(pa,path);assert pa.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # A cópia antiga nunca é apagada nem enviada automaticamente.
 legacy='[{"id":"antigo","name":"Artigo local antigo"}]'
 pb.add_init_script('localStorage.setItem("familia-compras-v1",'+json.dumps(legacy)+')')
 before=len([x for x in CALLS if x[0]=='/save']);ready(pb,'compras.html');expect(pb.locator('#sync-reconcile')).to_contain_text('cópia antiga')
 assert pb.evaluate('localStorage.getItem("familia-compras-v1")')==legacy
 assert len([x for x in CALLS if x[0]=='/save'])==before
 pb.screenshot(path='/tmp/site-familia-private-mobile.png',full_page=True)
 pb.locator('#sync-logout').click();pb.wait_for_url('**/entrar.html?next=compras.html')
 assert 'Artigo local antigo' not in pb.locator('body').inner_text()
 assert pb.evaluate('localStorage.getItem("familia-compras-v1")')==legacy
 assert not errors,errors
 a.close();b.close();browser.close()
 print('Dois browsers: compras, conflitos, conciliação, falha de rede, recuperação, refeições, seis páginas e logout passaram.')
