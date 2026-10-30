
(()=>{'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const PROJECT_URL='https://jkrjxviduubqbikuycte.supabase.co';
const API_KEY='sb_publishable_ks8aQQQoe-cWXRo6b947cw_bYzTiBcZ';
const RPC=PROJECT_URL+'/rest/v1/rpc/get_game_questions';
const SESSION_KEY='by-access-v4';
const NAMES={math:'Математика',russian:'Русский язык',world:'Окружающий мир',english:'Английский язык'};
const LEVELS={1:'Лёгкий',2:'Обычный',3:'Сложный'};
const DICE={1:'1–2',2:'3–4',3:'5–6'};
let code='',subject='math',busy=false,generated=[],controller=null;
function node(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e}
function tell(sel,text){$(sel).textContent=text||''}
function setBusy(v){busy=v;$('#access-submit').disabled=v;$('#generate-btn').disabled=v;$('#reshuffle-btn').disabled=v;$('#access-submit').textContent=v&&!code?'Проверяем…':'Открыть библиотеку →';$('#generate-btn').textContent=v?'Получаем вопросы…':'↝  Сформировать набор'}
function remember(v){try{if(v)sessionStorage.setItem(SESSION_KEY,v);else sessionStorage.removeItem(SESSION_KEY)}catch{}}
function restore(){try{return sessionStorage.getItem(SESSION_KEY)||''}catch{return ''}}
function authError(e){return e&&(/Неверный код доступа/i.test(e.message)||e.invalidCode)}
async function fetchLevel(inputCode,grade,subjectId,level,limit,signal){
 const response=await fetch(RPC,{method:'POST',headers:{apikey:API_KEY,'Content-Type':'application/json','Accept':'application/json'},cache:'no-store',signal,
   body:JSON.stringify({p_access_code:inputCode,p_grade:grade,p_subject_id:subjectId,p_difficulty:level,p_limit:limit})});
 let data;try{data=await response.json()}catch{throw Error('Некорректный ответ Supabase.')}
 if(!response.ok){const e=Error(data&&data.message?data.message:'Ошибка сервера '+response.status);e.invalidCode=data&&data.code==='P0001';throw e}
 if(!Array.isArray(data))throw Error('Неверный формат вопросов.');
 return data;
}
function setAccess(v){
 code=v;remember(v);
 $('#access-form').hidden=!!v;
 $('#access-success').hidden=!v;
 $('#generator-section').hidden=!v;
 if(!v){$('#results').hidden=true;generated=[];tell('#generate-message','')}
}
async function runRequest(fn){
 if(busy)return;
 controller=new AbortController();const active=controller;const timer=setTimeout(()=>active.abort(),18000);setBusy(true);
 try{await fn(active.signal)}
 catch(e){
  if(authError(e)){setAccess('');tell('#access-message','Код неверный или отключён. Проверьте символы на поле.');$('#access-code').focus()}
  else{tell(code?'#generate-message':'#access-message',e.name==='AbortError'?'Превышено время ожидания. Повторите запрос.':e.message||'Не удалось загрузить вопросы.')}
 }finally{clearTimeout(timer);if(controller===active)controller=null;setBusy(false)}
}
async function login(e){
 if(e)e.preventDefault();if(busy)return;
 const entered=$('#access-code').value.trim();if(entered.length<4){tell('#access-message','Введите код с игрового поля.');return}
 tell('#access-message','');
 await runRequest(async signal=>{
  await fetchLevel(entered,2,'math',1,1,signal);
  setAccess(entered);
 });
}
function emptyResult(msg){
 const out=$('#question-output');out.replaceChildren();const div=node('div','empty-state');div.append(node('h3','',msg));out.append(div);
}
function render(sets,grade,selected,perLevel){
 const out=$('#question-output'),ans=$('#print-answer-list');out.replaceChildren();ans.replaceChildren();
 let n=0;const total=sets.reduce((sum,x)=>sum+x.length,0);
 $('#result-count').textContent=total+' вопросов · '+perLevel+' на уровень';
 $('#print-subtitle').textContent=grade+' класс · '+NAMES[selected]+' · редакционная библиотека';
 if(!total){emptyResult('По выбранным параметрам вопросов пока нет.');$('#results').hidden=false;return}
 for(let level=1;level<=3;level++){
  const group=node('section','level-group'),header=node('div','level-group-heading');
  header.append(node('h3','',LEVELS[level]+' уровень'),node('span','level-pill','Кубик '+DICE[level]));
  group.append(header);
  const rows=sets[level-1];
  if(rows.length<perLevel)group.append(node('p','level-empty','Доступно '+rows.length+' из '+perLevel+' запрошенных'));
  for(const q of rows){
   n++;
   const card=node('article','q-item'),top=node('div','q-top');
   top.append(node('span','q-number',n+'.'),node('span','q-topic',q.topic||'Без темы'));
   card.append(top,node('p','',q.question_text));
   const details=node('details','answer-toggle'),summary=node('summary','','Показать ответ');
   const answer=node('div','answer-text');answer.append(node('strong','','Ответ: '),document.createTextNode(q.answer_text||''));
   details.append(summary,answer);
   details.addEventListener('toggle',()=>{summary.textContent=details.open?'Скрыть ответ':'Показать ответ';syncAnswers()});
   card.append(details);group.append(card);
   ans.append(node('li','',n+'. '+(q.answer_text||'')+' ('+LEVELS[level].toLowerCase()+'; '+(q.topic||'без темы')+')'));
  }
  out.append(group);
 }
 $('#results').hidden=false;syncAnswers();
}
function syncAnswers(){const all=$$('.answer-toggle');$('#toggle-answers').textContent=all.length&&all.every(x=>x.open)?'Скрыть ответы':'Показать ответы'}
async function generate(scroll){
 if(busy||!code)return;
 const grade=Number($('#grade-select').value),perLevel=Number($('#count-select').value);
 if(grade!==2){$('#results').hidden=true;tell('#generate-message','Вопросы пока загружены только для 2-го класса.');return}
 tell('#generate-message','');
 await runRequest(async signal=>{
  const sets=await Promise.all([1,2,3].map(level=>fetchLevel(code,grade,subject,level,perLevel,signal)));
  generated=sets;render(sets,grade,subject,perLevel);
  if(scroll&&!$('#results').hidden)$('#results').scrollIntoView({behavior:'smooth',block:'start'});
 });
}
$('#access-form').addEventListener('submit',login);
$('#change-code').addEventListener('click',()=>{if(controller)controller.abort();setAccess('');$('#access-code').value='';tell('#access-message','');$('#access-code').focus()});
$$('.subject-button').forEach(button=>button.addEventListener('click',()=>{
 subject=button.dataset.subject;
 $$('.subject-button').forEach(x=>{const on=x===button;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on))});
}));
$('#grade-select').addEventListener('change',()=>tell('#generate-message',$('#grade-select').value==='2'?'':'Для этого класса вопросы пока готовятся. Сейчас доступен 2-й класс.'));
$('#generate-btn').addEventListener('click',()=>generate(true));
$('#reshuffle-btn').addEventListener('click',()=>generate(true));
$('#toggle-answers').addEventListener('click',()=>{const all=$$('.answer-toggle'),open=all.some(x=>!x.open);all.forEach(x=>x.open=open);syncAnswers()});
$('#print-btn').addEventListener('click',()=>{if(generated.length)window.print()});
const saved=restore();
if(saved){$('#access-code').value=saved;login()}
})();
