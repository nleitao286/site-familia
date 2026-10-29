
"use strict";
const KEYS={menu:"familia-menu-v3",vehicles:"familia-viaturas-v1",shopping:"familia-compras-v1",tasks:"familia-compromissos-v1"};
const PEOPLE=["Filipa","Nuno","Martim","Madalena"];
const DAYS=["sábado","domingo","segunda","terça","quarta","quinta","sexta"];
const $=id=>document.getElementById(id);
const safe=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const get=(key,fallback)=>{try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback}catch(e){return fallback}};
function set(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true}catch(e){toast("Não foi possível guardar neste navegador.");return false}}
const uid=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
function toast(message){const el=$("toast");if(!el)return;el.textContent=message;el.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add("hidden"),2900)}
function isoDate(d){const pad=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function parseDate(s){if(!/^\d{4}-\d\d-\d\d$/.test(String(s||"")))return null;const [y,m,d]=s.split("-").map(Number);const dt=new Date(y,m-1,d);return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d?dt:null}
function pretty(s){const d=parseDate(s);return d?d.toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric"}):"Não definida"}
function relative(s){const d=parseDate(s);if(!d)return {cls:"dim",label:"Por agendar",days:null};const t=new Date();t.setHours(0,0,0,0);const n=Math.round((d-t)/86400000);return n<0?{cls:"late",label:"Atrasado "+Math.abs(n)+" d",days:n}:n===0?{cls:"warning",label:"Hoje",days:0}:n<=30?{cls:"warning",label:"Em "+n+" d",days:n}:{cls:"",label:pretty(s),days:n}}
function pill(s){const p=relative(s);return '<span class="pill '+p.cls+'">'+safe(p.label)+'</span>'}
function addPeriod(s,freq){const date=parseDate(s);if(!date)return "";const d=new Date(date);if(freq==="weekly"){d.setDate(d.getDate()+7);return isoDate(d)}const months={monthly:1,quarterly:3,yearly:12}[freq];if(!months)return "";const originalDay=d.getDate();const dest=new Date(d.getFullYear(),d.getMonth()+months,1);const last=new Date(dest.getFullYear(),dest.getMonth()+1,0).getDate();dest.setDate(Math.min(originalDay,last));return isoDate(dest)}
function tasksSeed(){return [
{id:"initial-condo",name:"Pagar condomínio",type:"task",freq:"monthly",due:"",person:"",notes:"",history:[],completed:false},
{id:"initial-water",name:"Contagem de água",type:"meter",freq:"monthly",due:"",person:"",notes:"",history:[],completed:false},
{id:"initial-electricity",name:"Contagem de luz",type:"meter",freq:"monthly",due:"",person:"",notes:"",history:[],completed:false},
{id:"initial-gas",name:"Contagem de gás",type:"meter",freq:"monthly",due:"",person:"",notes:"",history:[],completed:false}
]}
function loadTasks(){const tasks=get(KEYS.tasks,null);if(Array.isArray(tasks))return tasks;const seeded=tasksSeed();set(KEYS.tasks,seeded);return seeded}
function loadVehicles(){const v=get(KEYS.vehicles,[]);return Array.isArray(v)?v:[]}
function loadShopping(){const v=get(KEYS.shopping,[]);return Array.isArray(v)?v:[]}
function saturday(input){const d=parseDate(input)||new Date();d.setDate(d.getDate()-(d.getDay()+1)%7);return isoDate(d)}
function defaultMeals(){return {weeks:{},dishes:{A:[],J:[]}}}
function loadMeals(){
 let data=get(KEYS.menu,null);
 if(data&&data.weeks&&data.dishes)return data;
 data=defaultMeals();
 const old=get("menu-semana",null);
 if(old&&old.sel&&typeof old.sel==="object"){
  const w=saturday(old.inicio||isoDate(new Date()));const meals={};
  for(let i=0;i<7;i++){meals[i]={A:{dish:String(old.sel[i+"A"]||""),salad:!!old.sel[i+"AS"]},J:{dish:String(old.sel[i+"J"]||""),salad:!!old.sel[i+"JS"]}}}
  data.weeks[w]=meals;
  for(const k of ["A","J"]){const ideas=Array.isArray(old.ideas?.[k])?old.ideas[k]:[];data.dishes[k]=[...new Set(ideas.filter(x=>typeof x==="string"&&x.trim()))]}
 }
 set(KEYS.menu,data);return data;
}
function value(id){return $(id)?.value?.trim()||""}
function scrollForm(id){$(id)?.scrollIntoView({behavior:"smooth",block:"start"})}
function fieldMeta(label,value){return value?'<span><b>'+safe(label)+':</b> '+safe(value)+'</span>':""}
function initHome(){
 const v=loadVehicles(),s=loadShopping(),t=loadTasks();
 const remaining=s.filter(x=>!x.done).length;
 const dates=[...v.flatMap(x=>[["Seguro",x.insurance],["Inspeção",x.inspection],["Manutenção",x.maintenanceNext],["Pneus",x.tiresNext]].filter(y=>y[1]).map(y=>({label:y[0]+" · "+x.name,date:y[1]}))),...t.filter(x=>!x.completed&&x.due).map(x=>({label:x.name,date:x.due}))];
 const nearing=dates.filter(x=>{const n=relative(x.date).days;return n!==null&&n<=30}).sort((a,b)=>a.date.localeCompare(b.date));
 $("overview").innerHTML='<div class="panel"><div class="eyebrow">COMPRAS</div><span class="count">'+remaining+'</span><p>artigos por comprar</p><a href="compras.html">Ver lista →</a></div>'+
 '<div class="panel"><div class="eyebrow">VIATURAS</div><span class="count">'+v.length+'</span><p>viaturas registadas</p><a href="viaturas.html">Ver viaturas →</a></div>'+
 '<div class="panel"><div class="eyebrow">PRÓXIMOS PRAZOS</div><span class="count">'+nearing.length+'</span><p>obrigações em atraso ou até 30 dias</p><a href="compromissos.html">Ver compromissos →</a></div>'+
 (nearing.length?'<div class="panel span-all" style="grid-column:1/-1"><h3>Prazos a acompanhar</h3>'+nearing.slice(0,8).map(x=>'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0"><span>'+safe(x.label)+'</span>'+pill(x.date)+'</div>').join("")+'</div>':"");
 $("export-all").onclick=()=>{
  const pack={format:"familia-backup",version:1,exportedAt:new Date().toISOString(),data:{menu:loadMeals(),vehicles:loadVehicles(),shopping:loadShopping(),tasks:loadTasks()}};
  const blob=new Blob([JSON.stringify(pack,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="familia-copia-"+isoDate(new Date())+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("Cópia de segurança criada.");
 };
 $("import-all").onchange=async e=>{
  const f=e.target.files?.[0];if(!f)return;
  if(f.size>2000000){toast("Ficheiro demasiado grande (máximo 2 MB).");e.target.value="";return}
  try{const pack=JSON.parse(await f.text());const d=pack?.data;
   if(pack.format!=="familia-backup"||pack.version!==1||!d||!d.menu?.weeks||!d.menu?.dishes||!Array.isArray(d.vehicles)||!Array.isArray(d.shopping)||!Array.isArray(d.tasks))throw Error("Formato inválido");
   if(!confirm("Substituir os dados do menu, viaturas, compras e compromissos neste dispositivo?"))return;
   set(KEYS.menu,d.menu);set(KEYS.vehicles,d.vehicles);set(KEYS.shopping,d.shopping);set(KEYS.tasks,d.tasks);
   toast("Dados importados.");initHome();
  }catch(err){toast("O ficheiro não é uma cópia de segurança válida.")}finally{e.target.value=""}
 };
}
function initMenu(){
 let m=loadMeals();let wk=saturday(isoDate(new Date())),day=0;
 const weekInput=$("week-start");weekInput.value=wk;
 function getMeal(k){const p=m.weeks?.[wk]?.[day]?.[k];return p&&typeof p==="object"?p:{dish:"",salad:false}}
 function setMeal(k,changes){m.weeks??={};m.weeks[wk]??={};m.weeks[wk][day]??={};m.weeks[wk][day][k]={...getMeal(k),...changes};set(KEYS.menu,m)}
 function dishOptions(k,current){const arr=Array.isArray(m.dishes[k])?m.dishes[k]:[];const unique=[...new Set([...arr,current].filter(Boolean))];return '<option value="">Escolher…</option>'+unique.map(d=>'<option value="'+safe(d)+'" '+(d===current?"selected":"")+'>'+safe(d)+'</option>').join("")}
 function render(){
  const start=parseDate(wk);
  $("day-tabs").innerHTML=DAYS.map((s,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return '<button type="button" role="tab" data-day="'+i+'" aria-selected="'+(day===i)+'" class="'+(day===i?"on":"")+'">'+safe(s.slice(0,3))+' '+d.getDate()+'</button>'}).join("");
  const d=new Date(start);d.setDate(d.getDate()+day);
  const fmt=d.toLocaleDateString("pt-PT",{day:"numeric",month:"long"});
  const entries=Object.values(m.weeks?.[wk]||{}).reduce((sum,x)=>sum+["A","J"].filter(k=>x[k]?.dish).length,0);
  $("selected-day").textContent=DAYS[day][0].toUpperCase()+DAYS[day].slice(1)+" · "+fmt+"   ("+entries+"/14)";
  $("meals").innerHTML=["A","J"].map(k=>{const title=k==="A"?"Almoço":"Jantar",current=getMeal(k);return '<div class="panel"><h2>'+title+'</h2><div class="field"><label for="meal-'+k+'">Escolher prato</label><select id="meal-'+k+'" data-meal="'+k+'">'+dishOptions(k,current.dish)+'</select></div><form class="meal-idea" data-meal="'+k+'" style="margin-top:18px"><label for="meal-new-'+k+'">Nova ideia</label><div class="toolbar"><input style="flex:1;min-width:150px" maxlength="160" id="meal-new-'+k+'" placeholder="Escrever o nome do prato" required><button type="submit">Adicionar e usar</button></div></form><div class="checkline"><input id="salad-'+k+'" type="checkbox" data-salad="'+k+'" '+(current.salad?"checked":"")+'><label for="salad-'+k+'">Fazer salada</label></div></div>'}).join("");
  $("dish-library").innerHTML=["A","J"].map(k=>{const list=Array.isArray(m.dishes[k])?m.dishes[k]:[];return '<div style="margin-bottom:20px"><h3>'+(k==="A"?"Almoços":"Jantares")+' <span class="subtle">('+list.length+')</span></h3>'+(list.length?'<div class="dish-list">'+list.map((s,i)=>'<button type="button" data-remove-dish="'+k+'" data-dish-index="'+i+'" title="Retirar da lista de opções">× '+safe(s)+'</button>').join("")+'</div>':'<p class="subtle">Ainda sem pratos na lista.</p>')+'</div>'}).join("");
  const end=new Date(start);end.setDate(end.getDate()+6);
  const lines=DAYS.map((label,i)=>{const di=new Date(start);di.setDate(di.getDate()+i);const x=m.weeks?.[wk]?.[i]||{};const cell=k=>{const meal=x[k]||{};return safe(meal.dish||"")+(meal.salad?'<br><small>+ Fazer salada</small>':"")};return '<tr><th>'+safe(label[0].toUpperCase()+label.slice(1))+'<br>'+safe(pretty(isoDate(di)))+'</th><td>'+cell("A")+'</td><td>'+cell("J")+'</td></tr>'}).join("");
  $("print-week").innerHTML='<h2>Menu semanal · '+safe(pretty(wk))+' a '+safe(pretty(isoDate(end)))+'</h2><table><thead><tr><th>Dia</th><th>Almoço</th><th>Jantar</th></tr></thead><tbody>'+lines+'</tbody></table>';
 }
 weekInput.onchange=()=>{if(!weekInput.value)return;wk=saturday(weekInput.value);weekInput.value=wk;day=0;render()};
 $("day-tabs").onclick=e=>{const b=e.target.closest("[data-day]");if(!b)return;day=Number(b.dataset.day);render()};
 $("meals").onchange=e=>{const k=e.target.dataset.meal;if(k){setMeal(k,{dish:e.target.value});render();return}const salad=e.target.dataset.salad;if(salad){setMeal(salad,{salad:e.target.checked});render()}};
 $("meals").onsubmit=e=>{const form=e.target.closest(".meal-idea");if(!form)return;e.preventDefault();const k=form.dataset.meal;const name=value("meal-new-"+k);if(!name)return;const list=m.dishes[k]||(m.dishes[k]=[]);if(!list.includes(name))list.push(name);setMeal(k,{dish:name});render();toast("Prato acrescentado.")};
 $("dish-library").onclick=e=>{const b=e.target.closest("[data-remove-dish]");if(!b)return;const k=b.dataset.removeDish;const ix=Number(b.dataset.dishIndex);if(!confirm("Retirar este prato da lista de opções? As refeições já planeadas não serão apagadas."))return;m.dishes[k].splice(ix,1);set(KEYS.menu,m);render()};
 $("print-menu").onclick=()=>window.print();render();
}
const VEH_FIELDS={name:"vehicle-name",plate:"vehicle-plate",owner:"vehicle-owner",insurer:"vehicle-insurer",policy:"vehicle-policy",insurance:"vehicle-insurance",inspection:"vehicle-inspection",maintenanceLast:"vehicle-maintenance-last",maintenanceNext:"vehicle-maintenance-next",km:"vehicle-km",tires:"vehicle-tires",tiresNext:"vehicle-tires-next",notes:"vehicle-notes"};
function initVehicles(){
 let vehicles=loadVehicles();const form=$("vehicle-form");const id=$("vehicle-id");
 function clear(){form.reset();id.value="";$("vehicle-form-title").textContent="Adicionar viatura";$("vehicle-save").textContent="Guardar viatura";$("vehicle-cancel").classList.add("hidden")}
 function render(){
  $("vehicle-count").textContent=vehicles.length+" registadas";
  $("vehicle-list").innerHTML=vehicles.length?vehicles.map(v=>{const dates=[["Seguro",v.insurance],["Inspeção",v.inspection],["Próxima manutenção",v.maintenanceNext],["Verificação dos pneus",v.tiresNext]];
   return '<article class="item"><div class="item-head"><div><strong>'+safe(v.name)+'</strong><div class="meta">'+fieldMeta("Matrícula",v.plate)+fieldMeta("Responsável",v.owner)+fieldMeta("Seguradora",v.insurer)+fieldMeta("Apólice",v.policy)+fieldMeta("Quilómetros",v.km?Number(v.km).toLocaleString("pt-PT")+" km":"")+'</div></div><div class="tools"><button type="button" class="outline small" data-edit="'+safe(v.id)+'">Editar</button><button type="button" class="danger small" data-delete="'+safe(v.id)+'">Eliminar</button></div></div><div class="grid" style="margin-top:12px;gap:9px">'+dates.map(([label,date])=>'<div style="font-size:13px"><span class="muted">'+label+'</span><div style="margin-top:5px">'+pill(date)+'</div></div>').join("")+'</div><div class="meta">'+fieldMeta("Última manutenção",v.maintenanceLast?pretty(v.maintenanceLast):"")+fieldMeta("Última troca de pneus",v.tires?pretty(v.tires):"")+'</div>'+(v.notes?'<p style="white-space:pre-wrap;font-size:14px">'+safe(v.notes)+'</p>':"")+'</article>'
  }).join(""):'<div class="empty"><strong>Ainda não há viaturas registadas.</strong>Preenche o formulário para começares.</div>';
 }
 form.onsubmit=e=>{e.preventDefault();const obj={id:id.value||uid()};for(const [key,dom] of Object.entries(VEH_FIELDS))obj[key]=value(dom);
  if(!obj.name)return;const pos=vehicles.findIndex(v=>v.id===obj.id);if(pos<0)vehicles.unshift(obj);else vehicles[pos]=obj;
  if(set(KEYS.vehicles,vehicles)){clear();render();toast("Viatura guardada.")}};
 $("vehicle-cancel").onclick=()=>{clear();scrollForm("vehicle-form")};
 $("vehicle-list").onclick=e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(edit){const v=vehicles.find(x=>x.id===edit.dataset.edit);if(!v)return;id.value=v.id;for(const [key,dom] of Object.entries(VEH_FIELDS))$(dom).value=v[key]||"";$("vehicle-form-title").textContent="Editar viatura";$("vehicle-save").textContent="Guardar alterações";$("vehicle-cancel").classList.remove("hidden");scrollForm("vehicle-form");return}
 if(del){const v=vehicles.find(x=>x.id===del.dataset.delete);if(!v||!confirm('Eliminar a viatura "'+v.name+'"?'))return;vehicles=vehicles.filter(x=>x.id!==v.id);set(KEYS.vehicles,vehicles);if(id.value===v.id)clear();render();toast("Viatura eliminada.")}};
 render();
}
function initShopping(){
 let items=loadShopping(),hideDone=false;
 function render(){
  const remaining=items.filter(x=>!x.done).length;
  $("shopping-pending").textContent=remaining;
  $("shopping-hide-done").textContent=hideDone?"Mostrar todos":"Ocultar comprados";
  const visible=[...items].sort((a,b)=>Number(!!a.done)-Number(!!b.done)).filter(x=>!hideDone||!x.done);
  $("shopping-list").innerHTML=visible.length?visible.map(x=>'<article class="item"><div class="item-head"><div class="checkitem '+(x.done?"done":"")+'"><input type="checkbox" data-toggle="'+safe(x.id)+'" aria-label="Comprado: '+safe(x.name)+'" '+(x.done?"checked":"")+'><div><span class="item-title"><strong>'+safe(x.name)+'</strong> '+(x.qty?'<span class="muted">· '+safe(x.qty)+'</span>':"")+'</span><div class="subtle" style="margin-top:4px">Adicionado por '+safe(x.person||"Não definido")+'</div></div></div><button class="danger small" type="button" data-remove="'+safe(x.id)+'">Remover</button></div></article>').join(""):'<div class="empty"><strong>Lista vazia.</strong>Adiciona o primeiro artigo para começar.</div>';
 }
 $("shopping-form").onsubmit=e=>{e.preventDefault();const name=value("shopping-name");if(!name)return;items.push({id:uid(),name,qty:value("shopping-qty"),person:value("shopping-person"),done:false,addedAt:new Date().toISOString()});if(set(KEYS.shopping,items)){e.target.reset();render();$("shopping-name").focus();toast("Artigo adicionado.")}};
 $("shopping-list").onchange=e=>{const id=e.target.dataset.toggle;if(!id)return;const v=items.find(x=>x.id===id);if(!v)return;v.done=e.target.checked;set(KEYS.shopping,items);render()};
 $("shopping-list").onclick=e=>{const b=e.target.closest("[data-remove]");if(!b)return;items=items.filter(x=>x.id!==b.dataset.remove);set(KEYS.shopping,items);render()};
 $("shopping-hide-done").onclick=()=>{hideDone=!hideDone;render()};
 $("shopping-clear-done").onclick=()=>{if(!items.some(x=>x.done))return toast("Não há artigos comprados.");if(!confirm("Apagar todos os artigos assinalados como comprados?"))return;items=items.filter(x=>!x.done);set(KEYS.shopping,items);render()};
 $("shopping-share").onclick=async()=>{
  const content="Lista de compras\n"+items.filter(x=>!x.done).map(x=>"• "+x.name+(x.qty?" — "+x.qty:"")+" ("+(x.person||"família")+")").join("\n");
  if(!items.some(x=>!x.done))return toast("A lista está vazia.");
  try{if(navigator.share)await navigator.share({title:"Lista de compras da família",text:content});else if(navigator.clipboard){await navigator.clipboard.writeText(content);toast("Lista copiada para partilhar.")}else prompt("Copia a lista:",content)}
  catch(e){if(e.name!=="AbortError")prompt("Copia a lista:",content)}
 };
 render();
}
const TASK_FIELDS={name:"task-name",freq:"task-freq",due:"task-due",person:"task-person",notes:"task-notes",type:"task-type"};
function initTasks(){
 let tasks=loadTasks();const form=$("task-form"),id=$("task-id");
 function clear(){form.reset();id.value="";$("task-form-title").textContent="Novo compromisso";$("task-save").textContent="Guardar compromisso";$("task-cancel").classList.add("hidden")}
 function render(){
  const sorted=[...tasks].sort((a,b)=>(a.completed?1:0)-(b.completed?1:0)||(a.due||"9999").localeCompare(b.due||"9999"));
  $("task-list").innerHTML=sorted.length?sorted.map(t=>{const freq={weekly:"Semanal",monthly:"Mensal",quarterly:"Trimestral",yearly:"Anual",once:"Uma vez"}[t.freq]||"Mensal";
   return '<article class="item"><div class="item-head"><div><strong>'+safe(t.name)+'</strong> '+(t.completed?'<span class="pill dim">Concluído</span>':pill(t.due))+'<div class="meta">'+fieldMeta("Periodicidade",freq)+fieldMeta("Próxima data",t.due?pretty(t.due):"Por definir")+fieldMeta("Responsável",t.person)+(t.type==="meter"?'<span><b>Tipo:</b> Leitura de contador</span>':"")+'</div></div><div class="tools"><button type="button" class="small outline" data-task-edit="'+safe(t.id)+'">Editar</button><button type="button" class="small danger" data-task-remove="'+safe(t.id)+'">Eliminar</button></div></div>'+(t.notes?'<p style="white-space:pre-wrap;font-size:14px">'+safe(t.notes)+'</p>':"")+'<div class="actions"><button type="button" data-task-done="'+safe(t.id)+'" class="small" '+(t.completed?"disabled":"")+'>'+(t.type==="meter"?"Registar leitura":"Marcar como feito")+'</button><span class="subtle">'+(t.completed?"Concluído":!t.due?"Define a data ou regista agora.":"Ao concluir, calcula o próximo vencimento.")+'</span></div></article>'
  }).join(""):'<div class="empty">Ainda não há compromissos.</div>';
  const entries=tasks.flatMap(t=>(t.history||[]).map(h=>({name:t.name,...h}))).sort((a,b)=>String(b.at||"").localeCompare(String(a.at||""))).slice(0,20);
  $("task-history").innerHTML=entries.length?entries.map(x=>'<div style="display:flex;justify-content:space-between;gap:9px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:9px 0"><span>'+safe(x.name)+(x.reading?": <strong>"+safe(x.reading)+"</strong>":"")+'</span><span>'+safe(new Date(x.at).toLocaleDateString("pt-PT"))+'</span></div>').join(""):'Ainda não há registos concluídos.';
 }
 form.onsubmit=e=>{e.preventDefault();const obj={id:id.value||uid()};for(const [key,dom] of Object.entries(TASK_FIELDS))obj[key]=value(dom);if(!obj.name)return;
  const pos=tasks.findIndex(t=>t.id===obj.id);obj.history=pos>=0?(tasks[pos].history||[]):[];obj.completed=pos>=0?!!tasks[pos].completed:false;if(obj.freq!=="once")obj.completed=false;
  if(pos<0)tasks.unshift(obj);else tasks[pos]=obj;
  if(set(KEYS.tasks,tasks)){clear();render();toast("Compromisso guardado.")}};
 $("task-cancel").onclick=()=>{clear();scrollForm("task-form")};
 $("task-list").onclick=e=>{
  const ed=e.target.closest("[data-task-edit]"),rm=e.target.closest("[data-task-remove]"),done=e.target.closest("[data-task-done]");
  if(ed){const t=tasks.find(x=>x.id===ed.dataset.taskEdit);if(!t)return;id.value=t.id;for(const [k,dom] of Object.entries(TASK_FIELDS))$(dom).value=t[k]|| (k==="type"?"task":k==="freq"?"monthly":"");$("task-form-title").textContent="Editar compromisso";$("task-save").textContent="Guardar alterações";$("task-cancel").classList.remove("hidden");scrollForm("task-form");return}
  if(rm){const t=tasks.find(x=>x.id===rm.dataset.taskRemove);if(!t||!confirm('Eliminar "'+t.name+'" e o respetivo histórico?'))return;tasks=tasks.filter(x=>x.id!==t.id);set(KEYS.tasks,tasks);if(id.value===t.id)clear();render();toast("Compromisso eliminado.");return}
  if(done){const t=tasks.find(x=>x.id===done.dataset.taskDone);if(!t||t.completed)return;let reading="";
    if(t.type==="meter"){const entered=prompt('Introduz a leitura do contador para "'+t.name+'" (valor e unidade, se aplicável):');if(entered===null)return;reading=entered.trim();if(!reading){toast("É necessário indicar a leitura.");return}if(reading.length>120){toast("Leitura demasiado longa.");return}}
    t.history??=[];t.history.push({at:new Date().toISOString(),reading});
    if(t.freq==="once"){t.completed=true;t.due=""}else{let next=t.due||isoDate(new Date()),i=0;do{next=addPeriod(next,t.freq);i++}while(next&&next<=isoDate(new Date())&&i<240);t.due=next||""}
    set(KEYS.tasks,tasks);render();toast("Registo guardado.");
  }
 };
 render();
}
const page=document.body.dataset.page;
try{if(page==="index")initHome();else if(page==="menu")initMenu();else if(page==="viaturas")initVehicles();else if(page==="compras")initShopping();else if(page==="compromissos")initTasks()}catch(err){console.error(err);toast("Ocorreu um problema ao carregar esta área.")}
