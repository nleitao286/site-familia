"""Aplicação real, fotografia de teste e APIs simuladas; sem envios externos."""
import base64,datetime,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent;BASE='https://nleitao286.github.io/site-familia/'
today=datetime.date.today();week=str(today-datetime.timedelta(days=(today.weekday()+2)%7))
DB={'tema':'refeicoes','versao':1,'conteudo':{'weeks':{week:{'0':{'A':{'dish':'Prato existente','salad':True,'memo':'preservar'}}}},'dishes':{'A':['Prato existente'],'J':[]}}}
SAVES=[]
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=')
MOCK='''
export function createClient(){return {
 auth:{getUser:async()=>({data:{user:{id:'test-member'}},error:null}),onAuthStateChange:()=>{}},
 from(table){return {select(){return {eq(column,value){return {maybeSingle:async()=>({data:{nome:'Teste'},error:null}),single:async()=>({data:await (await fetch('https://photo-test.example/data')).json(),error:null})}}}}}},
 rpc:async(name,args)=>({data:await (await fetch('https://photo-test.example/save',{method:'POST',body:JSON.stringify(args)})).json(),error:null}),
 functions:{invoke:async(name,{body})=>{
 window.TEST_PHOTO_CALLS??=[];window.TEST_PHOTO_CALLS.push(body);
 if(window.TEST_DELAY)await new Promise(resolve=>setTimeout(resolve,window.TEST_DELAY));
 if(window.TEST_FAILURE)return {error:{context:{json:async()=>({error:'A análise de fotografias ainda não está configurada.'})}}};
 return {data:{result:{dish:'Arroz de legumes',portion_g:body.portion_g||300,kcal_per_100g:160,notes:'O azeite pode alterar o valor.',source:'photo-estimate',analysed_at:'2026-11-18T12:00:00Z'}}};
 }}
}}'''
def route(request):
 url=request.request.url
 if 'cdn.jsdelivr.net/npm/@supabase/' in url:request.fulfill(status=200,content_type='application/javascript',body=MOCK)
 elif url.startswith('https://photo-test.example/'):
  if url.endswith('/data'):request.fulfill(status=200,json=DB)
  else:
   args=json.loads(request.request.post_data);SAVES.append(args)
   assert args['p_versao']==DB['versao'];DB['conteudo']=args['p_conteudo'];DB['versao']+=1
   request.fulfill(status=200,json=[{'nova_versao':DB['versao']}])
 elif url.startswith(BASE):
  name=url[len(BASE):].split('?')[0];path=ROOT/name
  if path.is_file() and path.suffix in ['.html','.js','.css']:request.fulfill(status=200,content_type={'.html':'text/html','.js':'application/javascript','.css':'text/css'}[path.suffix],body=path.read_text())
  else:request.abort()
 else:request.abort()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for label,width in [('desktop',1280),('mobile',390)]:
  ctx=browser.new_context(viewport={'width':width,'height':844},is_mobile=label=='mobile',has_touch=label=='mobile');ctx.route('**/*',route)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(BASE+'menu.html');expect(page.locator('html')).to_have_attribute('data-family-auth','ready')
  page.locator('[data-photo-meal=A]').click();expect(page.locator('#meal-photo-dialog')).to_be_visible()
  expect(page.locator('#meal-photo-camera-file')).to_be_hidden();expect(page.locator('#meal-photo-gallery-file')).to_be_hidden()
  assert page.locator('#meal-photo-camera-file').get_attribute('capture')=='environment'
  assert page.locator('#meal-photo-gallery-file').get_attribute('capture') is None
  page.locator('#meal-photo-camera-file').set_input_files({'name':'foto.png','mimeType':'image/png','buffer':PNG})
  expect(page.locator('#meal-photo-preview')).to_be_visible();expect(page.locator('#meal-photo-analyze')).to_be_enabled()
  assert page.evaluate('(window.TEST_PHOTO_CALLS||[]).length')==0
  baseline=len(SAVES);page.locator('#meal-photo-known-weight').fill('350');page.locator('#meal-photo-analyze').click()
  expect(page.locator('#meal-photo-result')).to_be_visible();assert len(SAVES)==baseline
  assert page.evaluate('window.TEST_PHOTO_CALLS[0].image.startsWith("data:image/jpeg;base64,")')
  page.locator('#meal-photo-name').fill('Arroz e legumes');page.locator('#meal-photo-weight').fill('400')
  expect(page.locator('#meal-photo-total')).to_contain_text('640 kcal')
  page.locator('#meal-photo-density').fill('');expect(page.locator('#meal-photo-apply')).to_be_disabled()
  page.locator('#meal-photo-density').fill('160');expect(page.locator('#meal-photo-apply')).to_be_enabled()
  page.screenshot(path='/tmp/meal-photo-'+label+'.png',full_page=True)
  page.locator('#meal-photo-apply').click();expect(page.locator('#meal-photo-dialog')).to_be_hidden()
  expect(page.locator('#sync-status')).to_contain_text('Guardado no Supabase')
  meal=DB['conteudo']['weeks'][week]['0']['A'];assert meal['dish']=='Arroz e legumes';assert meal['salad'] is True;assert meal['memo']=='preservar';assert meal['nutrition']['kcal_estimate']==640
  assert 'Prato existente' in DB['conteudo']['dishes']['A'];assert 'data:image' not in json.dumps(DB)
  assert 'data:image' not in page.evaluate('JSON.stringify(localStorage)')
  # Mudar o prato manualmente não conserva as calorias da fotografia anterior.
  page.locator('#meal-A').select_option('Prato existente');expect(page.locator('[data-meal-calories=A]')).to_have_count(0)
  expect(page.locator('#sync-status')).to_contain_text('Guardado no Supabase')
  page.locator('[data-photo-meal=J]').click();page.locator('#meal-photo-gallery-file').set_input_files({'name':'galeria.png','mimeType':'image/png','buffer':PNG})
  expect(page.locator('#meal-photo-analyze')).to_be_enabled();page.evaluate('window.TEST_FAILURE=true');baseline=len(SAVES)
  page.locator('#meal-photo-analyze').click();expect(page.locator('#meal-photo-status')).to_contain_text('não está configurada');expect(page.locator('#meal-photo-result')).to_be_hidden();assert len(SAVES)==baseline
  # Fechar durante uma análise não aplica a resposta que chega depois.
  page.evaluate('window.TEST_FAILURE=false;window.TEST_DELAY=300');page.locator('#meal-photo-analyze').click();page.locator('#meal-photo-close').click();page.wait_for_timeout(500)
  expect(page.locator('#meal-photo-dialog')).to_be_hidden();assert len(SAVES)==baseline
  page.locator('[data-photo-meal=J]').click();expect(page.locator('#meal-photo-preview')).to_be_hidden();expect(page.locator('#meal-photo-result')).to_be_hidden()
  page.locator('#meal-photo-gallery-file').set_input_files({'name':'texto.txt','mimeType':'text/plain','buffer':b'text'})
  expect(page.locator('#meal-photo-status')).to_contain_text('Escolhe uma fotografia');expect(page.locator('#meal-photo-analyze')).to_be_disabled()
  page.locator('#meal-photo-close').click();assert not errors,errors;ctx.close()
  print(label+': câmara/galeria, preparação JPEG, revisão, cálculo, gravação sem imagem, erro e cancelamento OK')
 browser.close()
