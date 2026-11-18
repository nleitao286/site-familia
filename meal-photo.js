export function photoNutrition(value){
 const dish=typeof value?.dish==='string'?value.dish.trim():'';
 const weight=Number(value?.portion_g),density=Number(value?.kcal_per_100g);
 if(typeof value?.portion_g!=='number'||typeof value?.kcal_per_100g!=='number'||!dish||dish.length>160||!Number.isFinite(weight)||weight<1||weight>5000||!Number.isFinite(density)||density<0||density>900)throw Error('Revê o nome, a porção e as calorias por 100 g antes de guardar.');
 const grams=Math.round(weight),per100=Math.round(density);
 return {dish,portion_g:grams,kcal_per_100g:per100,kcal_estimate:Math.round(grams*per100/100),notes:String(value.notes||'').slice(0,600),source:'photo-estimate',analysed_at:value.analysed_at||new Date().toISOString(),reviewed_at:new Date().toISOString()};
}
export async function prepareMealImage(file){
 if(!file||!file.type.startsWith('image/'))throw Error('Escolhe uma fotografia, em vez de outro tipo de ficheiro.');
 if(file.size>20000000)throw Error('A fotografia é demasiado grande. Escolhe uma imagem até 20 MB.');
 const url=URL.createObjectURL(file),image=new Image();
 try{
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Não foi possível abrir esta fotografia. Experimenta uma imagem JPEG, PNG ou WebP.'));image.src=url});
  const width=image.naturalWidth,height=image.naturalHeight;
  if(!width||!height||width*height>80000000)throw Error('A resolução da fotografia é demasiado grande. Escolhe uma versão mais pequena.');
  const scale=Math.min(1,1280/Math.max(width,height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('Não foi possível preparar a fotografia neste navegador.');
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/jpeg',0.82);
  if(data.length>1600023)throw Error('A fotografia continua demasiado grande. Escolhe uma versão mais pequena.');
  return data;
 }finally{URL.revokeObjectURL(url);image.removeAttribute('src')}
}
export function createMealPhoto({analyze}){
 const $=id=>document.getElementById(id),dialog=$('meal-photo-dialog');
 let generation=0,imageData=null,result=null,onApply=null,busy=false,preparing=false;
 function message(text,error=false){$('meal-photo-status').textContent=text;$('meal-photo-status').dataset.kind=error?'error':'info'}
 function state(){
  $('meal-photo-analyze').disabled=busy||preparing||!imageData;
  $('meal-photo-analyze').textContent=busy?'A ANALISAR…':'ANALISAR FOTOGRAFIA';
  $('meal-photo-camera').disabled=busy||preparing;$('meal-photo-gallery').disabled=busy||preparing;
  $('meal-photo-apply').disabled=busy||preparing||!result;
 }
 function close(){generation++;imageData=null;result=null;onApply=null;busy=false;preparing=false;
  $('meal-photo-preview').removeAttribute('src');$('meal-photo-preview').hidden=true;
  for(const id of ['meal-photo-camera-file','meal-photo-gallery-file','meal-photo-name','meal-photo-weight','meal-photo-density','meal-photo-known-weight'])$(id).value='';
  $('meal-photo-result').hidden=true;if(dialog.open)dialog.close();
 }
 function open({title,apply}){
  close();onApply=apply;$('meal-photo-title').textContent='Fotografia — '+title;
  message('Tira uma fotografia ou escolhe uma imagem. Nada é enviado antes de carregares em Analisar.');state();dialog.showModal();
 }
 async function choose(file){
  if(!file)return;const current=++generation;preparing=true;result=null;$('meal-photo-result').hidden=true;imageData=null;state();message('A preparar fotografia…');
  try{const data=await prepareMealImage(file);if(current!==generation)return;imageData=data;$('meal-photo-preview').src=data;$('meal-photo-preview').hidden=false;message('Fotografia pronta. Se souberes o peso da porção, indica-o antes de analisar.');}
  catch(error){if(current===generation){$('meal-photo-preview').hidden=true;message(error.message,true)}}
  finally{if(current===generation){preparing=false;state()}}
 }
 $('meal-photo-camera').onclick=()=>$('meal-photo-camera-file').click();
 $('meal-photo-gallery').onclick=()=>$('meal-photo-gallery-file').click();
 for(const id of ['meal-photo-camera-file','meal-photo-gallery-file'])$(id).onchange=event=>{const file=event.target.files?.[0];event.target.value='';choose(file)};
 $('meal-photo-close').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
 function totals(){try{if($('meal-photo-density').value==='')throw Error('Indica as calorias por 100 g.');const value=photoNutrition({dish:$('meal-photo-name').value,portion_g:Number($('meal-photo-weight').value),kcal_per_100g:Number($('meal-photo-density').value)});$('meal-photo-total').textContent='≈ '+value.kcal_estimate+' kcal por porção';$('meal-photo-apply').disabled=busy||!result;}catch{$('meal-photo-total').textContent='Revê o nome e os valores da porção.';$('meal-photo-apply').disabled=true}}
 for(const id of ['meal-photo-name','meal-photo-weight','meal-photo-density'])$(id).addEventListener('input',totals);
 $('meal-photo-analyze').onclick=async()=>{
  if(busy||preparing||!imageData)return;
  const entered=$('meal-photo-known-weight').value,weight=entered===''?null:Number(entered);
  if(weight!==null&&(!Number.isFinite(weight)||weight<1||weight>5000)){message('Indica um peso entre 1 e 5000 gramas ou deixa o campo vazio.',true);return;}
  const current=generation;busy=true;result=null;$('meal-photo-result').hidden=true;state();message('A identificar o prato e a estimar a energia…');
  try{
   const data=await analyze({image:imageData,...(weight===null?{}:{portion_g:weight})});if(current!==generation)return;
   result=photoNutrition(data);$('meal-photo-name').value=result.dish;$('meal-photo-weight').value=result.portion_g;$('meal-photo-density').value=result.kcal_per_100g;
   $('meal-photo-notes').textContent=result.notes;$('meal-photo-result').hidden=false;message('Revê o prato e a porção. As calorias são uma estimativa, não uma medição.');
  }catch(error){if(current===generation)message(error.message||'Não foi possível analisar a fotografia. Tenta novamente.',true)}
  finally{if(current===generation){busy=false;state();if(result)totals()}}
 };
 $('meal-photo-apply').onclick=()=>{
  if(busy||!result||!onApply||document.documentElement.dataset.familyAuth!=='ready')return;
  try{if($('meal-photo-density').value==='')throw Error('Indica as calorias por 100 g.');const value=photoNutrition({...result,dish:$('meal-photo-name').value,portion_g:Number($('meal-photo-weight').value),kcal_per_100g:Number($('meal-photo-density').value)});
   if(onApply(value)===false){message('Não foi possível conservar a alteração. A fotografia não foi guardada; verifica o estado da gravação.',true);return;}close();
  }catch(error){message(error.message,true)}
 };
 window.addEventListener('pagehide',close);
 return {open,close};
}
