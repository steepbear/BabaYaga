
(()=>{'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const PROJECT_URL='https://jkrjxviduubqbikuycte.supabase.co';
const API_KEY='sb_publishable_ks8aQQQoe-cWXRo6b947cw_bYzTiBcZ';
const RPC=PROJECT_URL+'/rest/v1/rpc/get_game_questions';
const SESSION_KEY='by-access-v4', GAME_KEY='by-current-game-v5';
const SUBJECTS=['math','russian','world','english'];
const NAMES={math:'Математика',russian:'Русский язык',world:'Окружающий мир',english:'Английский язык'};
const LEVELS={1:'Лёгкий',2:'Обычный',3:'Сложный'};
const DICE={1:'1–2',2:'3–4',3:'5–6'};
const PRINT_ART={math:'assets/template-yaga.webp',russian:'assets/template-dragon.webp',world:'assets/template-leshy.webp',english:'assets/template-cat.webp'};
let code='',subject='math',busy=false,controller=null,asked=new Set(),currentGame=null,activeSubject='math';

function node(tag,cls,value){
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(value!==undefined)e.textContent=String(value);
 return e;
}
function tell(sel,value){const e=$(sel);if(e)e.textContent=value||''}
function setBusy(value){
 busy=value;
 for(const id of ['access-submit','generate-btn','generate-game-btn','reshuffle-btn','reset-asked','print-btn']){
  const btn=$('#'+id);if(btn)btn.disabled=value;
 }
 $('#access-submit').textContent=value&&!code?'Проверяем…':'Открыть библиотеку →';
 $('#generate-btn').textContent=value?'Загрузка…':'↝ Сформировать набор';
 $('#generate-game-btn').textContent=value?'Загрузка…':'✦ Сформировать игру';
}
function remember(value){
 try{if(value)sessionStorage.setItem(SESSION_KEY,value);else sessionStorage.removeItem(SESSION_KEY)}catch{}
}
function restore(){try{return sessionStorage.getItem(SESSION_KEY)||''}catch{return ''}}
function saveGame(){
 if(!currentGame)return;
 try{sessionStorage.setItem(GAME_KEY,JSON.stringify({...currentGame,code,activeSubject,asked:Array.from(asked)}))}catch{}
}
function forgetGame(){
 asked.clear();currentGame=null;
 try{sessionStorage.removeItem(GAME_KEY)}catch{}
}
function correctSets(sets){
 return Array.isArray(sets)&&sets.length===3&&sets.every(level=>Array.isArray(level));
}
function restoreGame(){
 try{
  const stored=sessionStorage.getItem(GAME_KEY);if(!stored)return;
  const data=JSON.parse(stored);
  if(data.code!==code||data.grade!==2||![2,4,6,10,22].includes(data.perLevel))return;
  const mode=data.mode==='game'?'game':'set';
  if(mode==='game'){
   if(!data.subjects||!SUBJECTS.every(name=>correctSets(data.subjects[name])))return;
   currentGame={mode,grade:2,perLevel:data.perLevel,subjects:data.subjects};
   activeSubject=SUBJECTS.includes(data.activeSubject)?data.activeSubject:'math';
  }else{
   if(!SUBJECTS.includes(data.subject)||!correctSets(data.sets))return;
   currentGame={mode,grade:2,perLevel:data.perLevel,subject:data.subject,sets:data.sets};
   activeSubject=data.subject;
  }
  subject=activeSubject;
  asked=new Set(Array.isArray(data.asked)?data.asked.map(String):[]);
  $('#grade-select').value='2';$('#count-select').value=String(data.perLevel);
  selectSubject(activeSubject);
  render();
 }catch{forgetGame()}
}
function authError(error){return error&&(/Неверный код доступа/i.test(error.message)||error.invalidCode)}
async function fetchLevel(access,grade,name,difficulty,limit,signal){
 const response=await fetch(RPC,{
  method:'POST',cache:'no-store',signal,
  headers:{apikey:API_KEY,'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify({p_access_code:access,p_grade:grade,p_subject_id:name,p_difficulty:difficulty,p_limit:limit})
 });
 let data;try{data=await response.json()}catch{throw Error('Некорректный ответ Supabase.')}
 if(!response.ok){
  const error=Error(data&&data.message?data.message:'Ошибка сервера '+response.status);
  error.invalidCode=data&&data.code==='P0001';throw error;
 }
 if(!Array.isArray(data))throw Error('Неверный формат ответа сервера.');
 return data;
}
function setAccess(access){
 code=access;remember(access);
 $('#access-form').hidden=!!access;$('#access-success').hidden=!access;
 $('#generator-section').hidden=!access;
 if(!access){
  $('#results').hidden=true;$('#result-subject-tabs').hidden=true;
  forgetGame();tell('#generate-message','');
 }
}
async function runRequest(fn){
 if(busy)return;
 const controllerHere=new AbortController();
 controller=controllerHere;
 const timeout=setTimeout(()=>controllerHere.abort(),25000);
 setBusy(true);
 try{await fn(controllerHere.signal)}
 catch(error){
  if(authError(error)){
   setAccess('');tell('#access-message','Код неверный или отключён. Проверьте символы на поле.');
   $('#access-code').focus();
  }else if(error.name!=='AbortError'||code){
   tell(code?'#generate-message':'#access-message',
    error.name==='AbortError'?'Превышено время ожидания. Повторите запрос.':(error.message||'Не удалось загрузить вопросы.'));
  }
 }finally{
  clearTimeout(timeout);
  if(controller===controllerHere)controller=null;
  setBusy(false);
 }
}
async function login(event){
 if(event)event.preventDefault();if(busy)return;
 const entered=$('#access-code').value.trim();
 if(entered.length<4){tell('#access-message','Введите код с игрового поля.');return}
 tell('#access-message','');
 await runRequest(async signal=>{
  await fetchLevel(entered,2,'math',1,1,signal);
  setAccess(entered);restoreGame();
 });
}
function selectSubject(name){
 subject=name;
 $$('.subject-button').forEach(button=>{
  const on=button.dataset.subject===name;button.classList.toggle('active',on);
  button.setAttribute('aria-pressed',String(on));
 });
}
function questionKey(name,q){return name+':'+String(q.id)}
function setsFor(name){
 return currentGame.mode==='game'?currentGame.subjects[name]:currentGame.sets;
}
function displayedSubjects(){
 return currentGame.mode==='game'?SUBJECTS:[currentGame.subject];
}
function totalCount(){
 if(!currentGame)return 0;
 return displayedSubjects().reduce((sum,name)=>sum+setsFor(name).reduce((n,rows)=>n+rows.length,0),0);
}
function askedCountFor(name){
 const all=setsFor(name).flat();
 return all.reduce((n,q)=>n+(asked.has(questionKey(name,q))?1:0),0);
}
function updateAskedProgress(){
 if(!currentGame){tell('#asked-progress','Задано: 0 из 0');return}
 const total=totalCount();
 const completed=displayedSubjects().reduce((sum,name)=>sum+askedCountFor(name),0);
 tell('#asked-progress','Задано: '+completed+' из '+total);
 $$('.result-subject-tab').forEach(tab=>{
  const name=tab.dataset.subject,sets=setsFor(name);
  const n=sets.reduce((sum,rows)=>sum+rows.length,0);
  const counter=tab.querySelector('.result-tab-counter');
  if(counter)counter.textContent=askedCountFor(name)+'/'+n;
 });
}
function renderTabs(){
 const host=$('#result-subject-tabs');host.replaceChildren();
 host.hidden=currentGame.mode!=='game';
 if(host.hidden)return;
 for(const name of SUBJECTS){
  const tab=node('button','result-subject-tab'),heading=node('span','',NAMES[name]),badge=node('span','result-tab-counter','');
  tab.type='button';tab.dataset.subject=name;tab.setAttribute('role','tab');
  tab.append(heading,badge);host.append(tab);
  tab.addEventListener('click',()=>showSubject(name));
 }
}
function showSubject(name){
 if(!currentGame||currentGame.mode!=='game'||!SUBJECTS.includes(name))return;
 activeSubject=name;selectSubject(name);
 renderQuestions();saveGame();
}
function render(){
 if(!currentGame)return;
 $('#grade-select').value=String(currentGame.grade);
 $('#count-select').value=String(currentGame.perLevel);
 if(currentGame.mode==='set')activeSubject=currentGame.subject;
 tell('#result-title',currentGame.mode==='game'?'Ваша игра — 4 предмета':'Ваш набор вопросов');
 tell('#result-count',totalCount()+' вопросов · '+currentGame.perLevel+' на уровень '+(currentGame.mode==='game'?'в каждом предмете':''));
 $('#results').hidden=false;
 renderTabs();renderQuestions();
}
function renderQuestions(){
 const name=activeSubject,sets=setsFor(name),output=$('#question-output');
 output.replaceChildren();let number=0;
 tell('#print-subtitle',currentGame.grade+' класс · '+NAMES[name]+' · редакционная библиотека');
 for(let level=1;level<=3;level++){
  const group=node('section','level-group');group.dataset.level=String(level);
  const header=node('div','level-group-heading');
  header.append(node('h3','',LEVELS[level]+' уровень'),node('span','level-pill','Кубик '+DICE[level]));
  group.append(header);
  if(sets[level-1].length<currentGame.perLevel)
   group.append(node('p','level-empty','Доступно '+sets[level-1].length+' из '+currentGame.perLevel+' запрошенных'));
  for(const q of sets[level-1]){
   number++;
   const key=questionKey(name,q);
   const card=node('article','q-item'),top=node('div','q-top');
   card.dataset.questionId=key;card.classList.toggle('is-asked',asked.has(key));
   top.append(node('span','q-number',number+'.'),node('span','q-topic',q.topic||'Без темы'));
   const mark=node('label','question-mark'),check=document.createElement('input');
   check.type='checkbox';check.className='asked-checkbox';check.checked=asked.has(key);
   check.setAttribute('aria-label','Вопрос '+number+' задан');
   mark.append(check,node('span','','Вопрос задан'));
   const printMark=node('span','print-question-mark print-only',check.checked?'☑ Задан':'□ Задан');
   top.append(mark,printMark);
   check.addEventListener('change',()=>{
    if(check.checked)asked.add(key);else asked.delete(key);
    card.classList.toggle('is-asked',check.checked);
    printMark.textContent=check.checked?'☑ Задан':'□ Задан';
    updateAskedProgress();saveGame();
   });
   card.append(top,node('p','',q.question_text));
   const details=node('details','answer-toggle'),summary=node('summary','','Показать ответ');
   const answer=node('div','answer-text');
   answer.append(node('strong','','Ответ: '),document.createTextNode(q.answer_text||''));
   details.append(summary,answer);
   details.addEventListener('toggle',()=>{summary.textContent=details.open?'Скрыть ответ':'Показать ответ';syncAnswers()});
   card.append(details);
   const printAnswer=node('div','print-inline-answer print-only');
   printAnswer.append(node('strong','','Ответ: '),document.createTextNode(q.answer_text||''));
   card.append(printAnswer);
   group.append(card);
  }
  output.append(group);
 }
 $$('.result-subject-tab').forEach(tab=>{
  const on=tab.dataset.subject===name;
  tab.classList.toggle('active',on);tab.setAttribute('aria-selected',String(on));
  tab.tabIndex=on?0:-1;
 });
 $('#question-output').setAttribute('aria-label','Вопросы: '+NAMES[name]);
 syncAnswers();updateAskedProgress();
}
function syncAnswers(){
 const all=$$('.answer-toggle');
 $('#toggle-answers').textContent=all.length&&all.every(x=>x.open)?'Скрыть ответы':'Показать ответы';
}
async function generate(mode,scroll){
 if(busy||!code)return;
 const grade=Number($('#grade-select').value),perLevel=Number($('#count-select').value);
 if(grade!==2){tell('#generate-message','Вопросы пока загружены только для 2-го класса.');return}
 tell('#generate-message','');
 const chosen=mode==='game'?SUBJECTS:[subject];
 const originalSubject=subject;
 await runRequest(async signal=>{
  const results={};
  for(const name of chosen){
   tell('#generate-message',mode==='game'?'Загружаем '+NAMES[name]+'…':'Загружаем вопросы…');
   results[name]=await Promise.all([1,2,3].map(level=>fetchLevel(code,grade,name,level,perLevel,signal)));
  }
  if(signal.aborted)return;
  asked.clear();
  if(mode==='game'){
   currentGame={mode:'game',grade,perLevel,subjects:results};activeSubject='math';
  }else{
   currentGame={mode:'set',grade,perLevel,subject:originalSubject,sets:results[originalSubject]};
   activeSubject=originalSubject;
  }
  selectSubject(activeSubject);
  tell('#generate-message','');
  render();saveGame();
  if(scroll)$('#results').scrollIntoView({behavior:'smooth',block:'start'});
 });
}
function resetAsked(){
 if(!currentGame)return;
 asked.clear();renderQuestions();saveGame();
}
function prepareTemplatePrint(){
 const host=$('#template-print-pages');document.body.append(host);host.replaceChildren();
 if(!currentGame)return;
 for(const name of displayedSubjects()){
  const sets=setsFor(name);
  const max=Math.max(0,...sets.map(rows=>rows.length)),pageSize=22;
  for(let offset=0;offset<max;offset+=pageSize){
   const page=node('section','template-print-page');
   const pageRows=sets.flatMap(rows=>rows.slice(offset,offset+pageSize));
   const avg=pageRows.reduce((sum,q)=>sum+String(q.question_text||'').length,0)/Math.max(1,pageRows.length);
   const count=Math.min(pageSize,max-offset);
   page.classList.add(count<=10?'print-roomy':count<=17?'print-medium':avg>55?'print-dense':'print-compact');
   const head=node('header','template-print-top');
   head.append(node('h2','','«Баба Яга против!» — '+NAMES[name]),
               node('div','',currentGame.grade+' класс · Лист '+(Math.floor(offset/pageSize)+1)));
   page.append(head);
   const cols=node('div','template-print-columns');
   for(let level=1;level<=3;level++){
    const col=node('section','template-print-column difficulty-'+level);
    const heading=node('header','template-print-column-header');
    const img=node('img');img.src=PRINT_ART[name];img.alt='';img.width=38;img.height=38;
    const title=node('div');
    title.append(node('strong','',level===1?'Лёгкие вопросы':level===2?'Обычные вопросы':'Сложные вопросы'),
                 node('span','','Кубик '+DICE[level]));
    heading.append(img,title);col.append(heading);
    const table=node('table','template-print-table'),thead=node('thead'),theadRow=node('tr');
    for(const label of ['№','Вопрос','Ответ','Задано'])theadRow.append(node('th','',label));
    thead.append(theadRow);table.append(thead);
    const tbody=node('tbody');
    for(let x=offset;x<Math.min(offset+pageSize,max);x++){
     const q=sets[level-1][x],row=node('tr','');
     if(q){
      row.append(node('td','number-cell',x+1),node('td','question-cell',q.question_text),
                 node('td','answer-cell',q.answer_text),node('td','marked-cell',asked.has(questionKey(name,q))?'☑':'□'));
     }else{
      for(let k=0;k<4;k++)row.append(node('td','',k===3?'□':''));
     }
     tbody.append(row);
    }
    table.append(tbody);col.append(table);cols.append(col);
   }
   page.append(cols);host.append(page);
  }
 }
}
$('#access-form').addEventListener('submit',login);
$('#change-code').addEventListener('click',()=>{
 if(busy&&controller)controller.abort();
 setAccess('');$('#access-code').value='';tell('#access-message','');
 $('#access-code').focus();
});
$$('.subject-button').forEach(button=>button.addEventListener('click',()=>selectSubject(button.dataset.subject)));
$('#grade-select').addEventListener('change',()=>{
 tell('#generate-message',$('#grade-select').value==='2'?'':'Для этого класса вопросы пока готовятся. Сейчас доступен 2-й класс.');
});
$('#generate-btn').addEventListener('click',()=>generate('set',true));
$('#generate-game-btn').addEventListener('click',()=>generate('game',true));
$('#reshuffle-btn').addEventListener('click',()=>generate(currentGame&&currentGame.mode==='game'?'game':'set',true));
$('#reset-asked').addEventListener('click',resetAsked);
$('#toggle-answers').addEventListener('click',()=>{
 const all=$$('.answer-toggle'),open=all.some(x=>!x.open);
 all.forEach(x=>x.open=open);syncAnswers();
});
$('#print-btn').addEventListener('click',()=>{if(currentGame&&totalCount()){prepareTemplatePrint();window.print()}});
const saved=restore();if(saved){$('#access-code').value=saved;login()}
})();
