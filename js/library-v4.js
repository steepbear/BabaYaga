(()=>{'use strict';
const $=selector=>document.querySelector(selector),$$=selector=>Array.from(document.querySelectorAll(selector));
const PROJECT_URL='https://jkrjxviduubqbikuycte.supabase.co';
const API_KEY='sb_publishable_ks8aQQQoe-cWXRo6b947cw_bYzTiBcZ';
const RPC=PROJECT_URL+'/rest/v1/rpc/get_game_questions_by_source';
const SESSION_KEY='by-access-v4',GAME_KEY='by-current-game-v5';
const SUBJECTS=['math','russian','world','english'];
const NAMES={math:'Математика',russian:'Русский язык',world:'Окружающий мир',english:'Английский язык'};
const LEVELS={1:'Лёгкий',2:'Обычный',3:'Сложный'},DICE={1:'1–2',2:'3–4',3:'5–6'};
const SOURCES={editorial:'Редакционные',community:'Пользовательские',private:'Личные'};
const PRINT_ART={math:'assets/template-yaga.webp',russian:'assets/template-dragon.webp',world:'assets/template-leshy.webp',english:'assets/template-cat.webp'};
let code='',subject='math',source='editorial',busy=false,controller=null,currentGame=null,activeSubject='math',asked=new Set(),difficultyFilters={};
let teacherClient=null,teacher=null,teacherReady=null,modalResolve=null,lastFocus=null;

function el(tag,cls,value){const element=document.createElement(tag);if(cls)element.className=cls;if(value!==undefined)element.textContent=String(value);return element}
function say(selector,value){const element=$(selector);if(element)element.textContent=value||''}
function setBusy(value){
 busy=value;
 for(const id of ['access-submit','generate-btn','generate-game-btn','reshuffle-btn','reset-asked','print-btn']){
  const button=$('#'+id);if(button)button.disabled=value;
 }
 $('#access-submit').textContent=value&&!code?'Проверяем…':'Открыть библиотеку →';
 $('#generate-btn').textContent=value?'Загрузка…':'Сформировать набор';
 $('#generate-game-btn').textContent=value?'Загрузка…':'Сформировать игру';
}
function savedCode(){try{return sessionStorage.getItem(SESSION_KEY)||''}catch{return ''}}
function storeCode(value){try{if(value)sessionStorage.setItem(SESSION_KEY,value);else sessionStorage.removeItem(SESSION_KEY)}catch{}}
function forgetGame(){currentGame=null;asked.clear();difficultyFilters={};try{sessionStorage.removeItem(GAME_KEY)}catch{}$('#results').hidden=true;$('#template-print-pages').replaceChildren()}
function storeGame(){
 if(!currentGame||currentGame.source==='private')return; // Do not store personal questions in sessionStorage.
 try{sessionStorage.setItem(GAME_KEY,JSON.stringify({...currentGame,code,activeSubject,asked:Array.from(asked),difficultyFilters}))}catch{}
}
function validSets(value){return Array.isArray(value)&&value.length===3&&value.every(Array.isArray)}
function restoreGame(){
 try{
  const raw=sessionStorage.getItem(GAME_KEY);if(!raw)return;
  const item=JSON.parse(raw),mode=item.mode==='game'?'game':'set';
  if(item.code!==code||![1,2,3,4].includes(item.grade)||![2,4,6,10,22].includes(item.perLevel))return;
  if(item.source==='editorial'&&item.grade!==2)return;
  if(!['editorial','community'].includes(item.source))return;
  if(mode==='game'){
   if(!item.subjects||!SUBJECTS.every(name=>validSets(item.subjects[name])))return;
   currentGame={mode,grade:item.grade,perLevel:item.perLevel,source:item.source,subjects:item.subjects};
   activeSubject=SUBJECTS.includes(item.activeSubject)?item.activeSubject:'math';
  }else{
   if(!SUBJECTS.includes(item.subject)||!validSets(item.sets))return;
   currentGame={mode,grade:item.grade,perLevel:item.perLevel,source:item.source,subject:item.subject,sets:item.sets};
   activeSubject=item.subject;
  }
  source=item.source;$('#count-select').value=String(item.perLevel);syncGradeOptions();$('#grade-select').value=String(item.grade);
  const radio=$('input[name="question-source"][value="'+source+'"]');if(radio)radio.checked=true;
  asked=new Set(Array.isArray(item.asked)?item.asked.map(String):[]);
  difficultyFilters=item.difficultyFilters&&typeof item.difficultyFilters==='object'?item.difficultyFilters:{};
  selectSubject(activeSubject);render();
 }catch{forgetGame()}
}

function syncGradeOptions(){
 const editorial=source==='editorial';
 for(const option of $('#grade-select').options){
  option.disabled=editorial&&option.value!=='2';
  option.textContent=option.value+' класс'+(editorial&&option.value!=='2'?' — пока нет вопросов':'');
 }
 if(editorial)$('#grade-select').value='2';
}
function displayTeacher(){
 const logged=!!teacher;
 $('#teacher-session').hidden=!logged;$('#teacher-source-note').hidden=logged||source!=='private';
 say('#teacher-session-text',logged?'Вы вошли как '+(teacher.email||'преподаватель'):'');
}
async function initTeacher(){
 if(!window.supabase?.createClient){displayTeacher();return null}
 teacherClient=window.supabase.createClient(PROJECT_URL,API_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 teacherClient.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'){
   teacher=null;
   if(currentGame?.source==='private')forgetGame();
   displayTeacher();
  }else if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){
   teacher=session?.user||null;displayTeacher();
  }
 });
 const {data,error}=await teacherClient.auth.getUser();
 teacher=error?null:(data?.user||null);displayTeacher();return teacher;
}
function checkTeacherReady(){return teacherReady||Promise.resolve(null)}
async function getTeacherToken(){
 await checkTeacherReady();
 if(!teacherClient)throw Error('Модуль авторизации недоступен. Обновите страницу.');
 const {data,error}=await teacherClient.auth.getSession();
 if(error||!data?.session)throw Error('Для личных вопросов необходимо войти в кабинет.');
 teacher=data.session.user||teacher;
 return data.session.access_token;
}
function openTeacherModal(){
 if(modalResolve)return Promise.reject(Error('Окно входа уже открыто.'));
 lastFocus=document.activeElement;
 $('#teacher-modal-status').textContent='';$('#teacher-modal').hidden=false;
 $('#teacher-modal-email').focus();
 return new Promise((resolve,reject)=>{modalResolve={resolve,reject}});
}
function closeTeacherModal(ok){
 $('#teacher-modal').hidden=true;$('#teacher-modal-password').value='';
 if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus();
 if(modalResolve){const resolver=modalResolve;modalResolve=null;if(ok)resolver.resolve();else resolver.reject(Error('Вход отменён.'))}
}
async function ensureTeacher(){
 await checkTeacherReady();
 if(teacher){try{await getTeacherToken();return}catch{teacher=null;displayTeacher()}}
 await openTeacherModal();
 await getTeacherToken();
}

async function fetchLevel(access,grade,name,difficulty,count,signal,requestedSource='editorial',token=null){
 if(requestedSource==='private'){
  if(!token||!teacherClient||!teacher)throw Error('Необходима авторизация преподавателя.');
  const {data,error}=await teacherClient.from('questions')
   .select('id,subject_id,grade,difficulty,topic,question_text,answer_text,kind')
   .eq('kind','private').eq('owner_id',teacher.id)
   .eq('grade',grade).eq('subject_id',name).eq('difficulty',difficulty)
   .limit(1000).abortSignal(signal);
  if(error)throw Error('Не удалось загрузить личные вопросы: '+error.message);
  const found=[...(data||[])];
  for(let i=found.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[found[i],found[k]]=[found[k],found[i]]}
  return found.slice(0,count);
 }
 const headers={apikey:API_KEY,'Content-Type':'application/json',Accept:'application/json'};
 if(requestedSource==='private'){
  if(!token)throw Error('Необходима авторизация преподавателя.');
  headers.Authorization='Bearer '+token;
 }
 const response=await fetch(RPC,{
  method:'POST',cache:'no-store',signal,headers,
  body:JSON.stringify({p_access_code:access,p_grade:grade,p_subject_id:name,p_difficulty:difficulty,p_limit:count,p_source:requestedSource})
 });
 let data;try{data=await response.json()}catch{throw Error('Некорректный ответ сервера.')}
 if(!response.ok){
  const error=Error(data?.message||'Ошибка Supabase: '+response.status);
  error.invalidCode=data?.code==='P0001';error.invalidAuth=response.status===401||response.status===403;
  throw error;
 }
 if(!Array.isArray(data))throw Error('Неверный формат вопросов.');
 return data;
}
function setAccess(value){
 code=value;storeCode(value);
 $('#access-form').hidden=!!value;$('#access-success').hidden=!value;$('#generator-section').hidden=!value;
 if(!value){forgetGame();say('#generate-message','')}
}
async function runRequest(callback){
 if(busy)return;
 const taskController=new AbortController();controller=taskController;
 const timeout=setTimeout(()=>taskController.abort(),60000);setBusy(true);
 try{await callback(taskController.signal)}
 catch(error){
  if(error.invalidCode){setAccess('');say('#access-message','Код игрового поля неверный или отключён.');$('#access-code').focus()}
  else say(code?'#generate-message':'#access-message',error.name==='AbortError'?'Время ожидания истекло. Повторите запрос.':error.message||'Не удалось получить вопросы.');
 }finally{clearTimeout(timeout);if(controller===taskController)controller=null;setBusy(false)}
}
async function accessLogin(event){
 if(event)event.preventDefault();if(busy)return;
 const entered=$('#access-code').value.trim();
 if(entered.length<4){say('#access-message','Введите код с игрового поля.');return}
 say('#access-message','');
 await runRequest(async signal=>{
  await fetchLevel(entered,2,'math',1,1,signal,'editorial');
  setAccess(entered);restoreGame();
 });
}
function selectSubject(name){
 if(!SUBJECTS.includes(name))return;
 subject=name;
 $$('.subject-button').forEach(button=>{
  const selected=button.dataset.subject===name;
  button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
 });
}
function questionKey(name,item){return name+':'+String(item.id)}
function setsFor(name){return currentGame.mode==='game'?currentGame.subjects[name]:currentGame.sets}
function displayedSubjects(){return currentGame.mode==='game'?SUBJECTS:[currentGame.subject]}
function totalCount(){if(!currentGame)return 0;return displayedSubjects().reduce((total,name)=>total+setsFor(name).reduce((count,rows)=>count+rows.length,0),0)}
function askedCountFor(name){return setsFor(name).flat().reduce((total,item)=>total+(asked.has(questionKey(name,item))?1:0),0)}
function updateAskedProgress(){
 if(!currentGame){say('#asked-progress','Задано: 0 из 0');return}
 const number=displayedSubjects().reduce((sum,name)=>sum+askedCountFor(name),0);
 say('#asked-progress','Задано: '+number+' из '+totalCount());
 $$('.result-subject-tab').forEach(tab=>{
  const name=tab.dataset.subject,n=setsFor(name).reduce((sum,items)=>sum+items.length,0);
  const counter=tab.querySelector('.result-tab-counter');if(counter)counter.textContent=askedCountFor(name)+'/'+n;
 });
}
function renderTabs(){
 const host=$('#result-subject-tabs');host.replaceChildren();
 host.hidden=currentGame.mode!=='game';if(host.hidden)return;
 for(const name of SUBJECTS){
  const button=el('button','result-subject-tab');button.type='button';button.dataset.subject=name;
  button.setAttribute('role','tab');button.append(el('span','',NAMES[name]),el('span','result-tab-counter',''));
  button.addEventListener('click',()=>switchSubject(name));host.append(button);
 }
}
function switchSubject(name){
 if(!currentGame||currentGame.mode!=='game'||!SUBJECTS.includes(name))return;
 activeSubject=name;selectSubject(name);renderQuestions();storeGame();
}
function render(){
 if(!currentGame)return;
 $('#grade-select').value=String(currentGame.grade);$('#count-select').value=String(currentGame.perLevel);
 if(currentGame.mode==='set')activeSubject=currentGame.subject;
 const base=currentGame.mode==='game'?'Ваша игра — 4 предмета':'Ваш набор вопросов';
 say('#result-title',base+' · '+SOURCES[currentGame.source]);
 say('#result-count',totalCount()+' вопросов · '+currentGame.perLevel+' на уровень'+(currentGame.mode==='game'?' каждого предмета':''));
 $('#results').hidden=false;renderTabs();renderQuestions();
}
function applyDifficultyFilter(){
 if(!currentGame)return;
 const level=['all','1','2','3'].includes(difficultyFilters[activeSubject])?difficultyFilters[activeSubject]:'all';
 $$('.difficulty-filter-btn').forEach(b=>{const on=b.dataset.difficulty===level;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on))});
 $$('#question-output .level-group').forEach(g=>{g.hidden=level!=='all'&&g.dataset.level!==level});
 const levels=setsFor(activeSubject),total=levels.reduce((n,rows)=>n+rows.length,0);
 const shown=level==='all'?total:levels[Number(level)-1].length;
 say('#difficulty-filter-count','Показано: '+shown+' из '+total);
}
function renderQuestions(){
 const name=activeSubject,sets=setsFor(name),output=$('#question-output');
 output.replaceChildren();let number=0;
 say('#print-subtitle',currentGame.grade+' класс · '+NAMES[name]+' · '+SOURCES[currentGame.source]);
 for(let level=1;level<=3;level++){
  const group=el('section','level-group');group.dataset.level=String(level);
  const header=el('div','level-group-heading');
  header.append(el('h3','',LEVELS[level]+' уровень'),el('span','level-pill','Кубик '+DICE[level]));group.append(header);
  if(sets[level-1].length<currentGame.perLevel){
   group.append(el('p','level-empty','Доступно '+sets[level-1].length+' из '+currentGame.perLevel+' запрошенных'));
  }
  for(const q of sets[level-1]){
   number++;const key=questionKey(name,q);
   const card=el('article','q-item'),top=el('div','q-top');
   card.dataset.questionId=key;card.classList.toggle('is-asked',asked.has(key));
   top.append(el('span','q-number',number+'.'),el('span','q-topic',q.topic||'Без темы'));
   const label=el('label','question-mark'),input=document.createElement('input');
   input.type='checkbox';input.className='asked-checkbox';input.checked=asked.has(key);
   input.setAttribute('aria-label','Вопрос '+number+' задан');label.append(input,el('span','','Вопрос задан'));
   const printMark=el('span','print-question-mark print-only',input.checked?'☑ Задан':'□ Задан');
   top.append(label,printMark);
   input.addEventListener('change',()=>{
    if(input.checked)asked.add(key);else asked.delete(key);
    card.classList.toggle('is-asked',input.checked);printMark.textContent=input.checked?'☑ Задан':'□ Задан';
    updateAskedProgress();storeGame();
   });
   card.append(top,el('p','',q.question_text));
   const details=el('details','answer-toggle'),summary=el('summary','','Показать ответ'),answer=el('div','answer-text');
   answer.append(el('strong','','Ответ: '),document.createTextNode(q.answer_text||''));
   details.append(summary,answer);
   details.addEventListener('toggle',()=>{summary.textContent=details.open?'Скрыть ответ':'Показать ответ';syncAnswers()});
   card.append(details);
   const printAnswer=el('div','print-inline-answer print-only');
   printAnswer.append(el('strong','','Ответ: '),document.createTextNode(q.answer_text||''));card.append(printAnswer);
   group.append(card);
  }
  output.append(group);
 }
 if(!number)output.prepend(el('p','level-empty','По выбранному источнику пока нет вопросов для этого предмета и класса.'));
 $$('.result-subject-tab').forEach(tab=>{
  const selected=tab.dataset.subject===name;
  tab.classList.toggle('active',selected);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
 });
 output.setAttribute('aria-label','Вопросы: '+NAMES[name]);applyDifficultyFilter();syncAnswers();updateAskedProgress();
}
function syncAnswers(){const all=$$('.answer-toggle');$('#toggle-answers').textContent=all.length&&all.every(item=>item.open)?'Скрыть ответы':'Показать ответы'}
async function generate(mode,scroll,requestedSource=source,requestedSubject=subject){
 if(busy||!code)return;
 const grade=Number($('#grade-select').value),perLevel=Number($('#count-select').value);
 if(requestedSource==='editorial'&&grade!==2){say('#generate-message','Редакционные вопросы пока доступны только для 2-го класса.');return}
 if(!SOURCES[requestedSource])return;
 say('#generate-message','');
 let accessToken=null;
 if(requestedSource==='private'){
  try{await ensureTeacher();accessToken=await getTeacherToken()}
  catch(error){if(error.message!=='Вход отменён.')say('#generate-message',error.message);return}
 }
 const names=mode==='game'?SUBJECTS:[requestedSubject];
 await runRequest(async signal=>{
  say('#generate-message','Формируем '+(mode==='game'?'четыре комплекта вопросов…':'подборку вопросов…'));
  const pairs=await Promise.all(names.map(async name=>[
   name,await Promise.all([1,2,3].map(difficulty=>fetchLevel(code,grade,name,difficulty,perLevel,signal,requestedSource,accessToken)))
  ]));
  if(signal.aborted)return;
  const data=Object.fromEntries(pairs);asked.clear();difficultyFilters={};
  if(mode==='game'){
   currentGame={mode:'game',grade,perLevel,source:requestedSource,subjects:data};activeSubject='math';
  }else{
   currentGame={mode:'set',grade,perLevel,source:requestedSource,subject:requestedSubject,sets:data[requestedSubject]};activeSubject=requestedSubject;
  }
  source=requestedSource;const radio=$('input[name="question-source"][value="'+source+'"]');if(radio)radio.checked=true;
  selectSubject(activeSubject);say('#generate-message','');render();storeGame();
  if(scroll)$('#results').scrollIntoView({behavior:'smooth',block:'start'});
 });
}
function resetAsked(){if(!currentGame)return;asked.clear();renderQuestions();storeGame()}
function prepareTemplatePrint(){
 const host=$('#template-print-pages');document.body.append(host);host.replaceChildren();
 if(!currentGame)return;
 for(const name of displayedSubjects()){
  const sets=setsFor(name),max=Math.max(0,...sets.map(rows=>rows.length)),pageSize=22;
  for(let offset=0;offset<max;offset+=pageSize){
   const page=el('section','template-print-page');
   const rows=sets.flatMap(items=>items.slice(offset,offset+pageSize));
   const mean=rows.reduce((n,item)=>n+String(item.question_text||'').length,0)/Math.max(1,rows.length);
   const count=Math.min(pageSize,max-offset);
   page.classList.add(count<=10?'print-roomy':count<=17?'print-medium':mean>55?'print-dense':'print-compact');
   const head=el('header','template-print-top');
   head.append(el('h2','','«Баба Яга против!» — '+NAMES[name]),el('div','',currentGame.grade+' класс · '+SOURCES[currentGame.source]+' · Лист '+(Math.floor(offset/pageSize)+1)));
   page.append(head);
   const columns=el('div','template-print-columns');
   for(let level=1;level<=3;level++){
    const column=el('section','template-print-column difficulty-'+level);
    const heading=el('header','template-print-column-header'),image=el('img');
    image.src=PRINT_ART[name];image.alt='';image.width=38;image.height=38;
    const title=el('div','');title.append(el('strong','',level===1?'Лёгкие вопросы':level===2?'Обычные вопросы':'Сложные вопросы'),el('span','','Кубик '+DICE[level]));
    heading.append(image,title);column.append(heading);
    const table=el('table','template-print-table'),thead=el('thead'),headRow=el('tr');
    for(const label of ['№','Вопрос','Ответ','Задано'])headRow.append(el('th','',label));
    thead.append(headRow);table.append(thead);
    const tbody=el('tbody');
    for(let n=offset;n<Math.min(offset+pageSize,max);n++){
     const q=sets[level-1][n],row=el('tr','');
     if(q)row.append(el('td','number-cell',n+1),el('td','question-cell',q.question_text),el('td','answer-cell',q.answer_text),el('td','marked-cell',asked.has(questionKey(name,q))?'☑':'□'));
     else for(let k=0;k<4;k++)row.append(el('td','',k===3?'□':''));
     tbody.append(row);
    }
    table.append(tbody);column.append(table);columns.append(column);
   }
   page.append(columns);host.append(page);
  }
 }
}

$('#access-form').addEventListener('submit',accessLogin);
$('#change-code').addEventListener('click',()=>{
 if(busy&&controller)controller.abort();setAccess('');$('#access-code').value='';say('#access-message','');$('#access-code').focus();
});
$$('.subject-button').forEach(button=>button.addEventListener('click',()=>selectSubject(button.dataset.subject)));
$$('input[name="question-source"]').forEach(input=>input.addEventListener('change',()=>{
 source=input.value;syncGradeOptions();displayTeacher();if(source==='private'&&!teacher){checkTeacherReady().then(()=>{if(!teacher)return openTeacherModal()}).catch(()=>{})}
}));
$('#open-teacher-login').addEventListener('click',()=>{checkTeacherReady().then(()=>openTeacherModal()).catch(()=>{})});
$('#grade-select').addEventListener('change',()=>say('#generate-message',''));
$('#generate-btn').addEventListener('click',()=>generate('set',true));
$('#generate-game-btn').addEventListener('click',()=>generate('game',true));
$('#reshuffle-btn').addEventListener('click',()=>{
 if(!currentGame)return;generate(currentGame.mode,true,currentGame.source,currentGame.subject||activeSubject);
});
$('#reset-asked').addEventListener('click',resetAsked);
$$('.difficulty-filter-btn').forEach(b=>b.addEventListener('click',()=>{if(!currentGame)return;difficultyFilters[activeSubject]=b.dataset.difficulty;applyDifficultyFilter();storeGame()}));
$('#toggle-answers').addEventListener('click',()=>{const all=$$('.answer-toggle'),open=all.some(item=>!item.open);all.forEach(item=>item.open=open);syncAnswers()});
$('#print-btn').addEventListener('click',()=>{if(currentGame&&totalCount()){prepareTemplatePrint();window.print()}});
$('#teacher-modal-close').addEventListener('click',()=>closeTeacherModal(false));
$('#teacher-modal-backdrop').addEventListener('click',()=>closeTeacherModal(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#teacher-modal').hidden)closeTeacherModal(false)});
$('#teacher-modal-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('#teacher-modal-submit');button.disabled=true;say('#teacher-modal-status','');
 try{
  await checkTeacherReady();if(!teacherClient)throw Error('Модуль авторизации не загрузился. Обновите страницу.');
  const {data,error}=await teacherClient.auth.signInWithPassword({email:$('#teacher-modal-email').value.trim(),password:$('#teacher-modal-password').value});
  if(error)throw error;
  teacher=data.user;displayTeacher();closeTeacherModal(true);
 }catch(error){say('#teacher-modal-status',error.message||'Ошибка входа.')}finally{button.disabled=false}
});
$('#teacher-sign-out').addEventListener('click',async()=>{
 if(!teacherClient)return;
 const {error}=await teacherClient.auth.signOut();
 if(error){say('#generate-message',error.message);return}
 teacher=null;if(currentGame?.source==='private')forgetGame();displayTeacher();
});
syncGradeOptions();
teacherReady=initTeacher().catch(()=>{teacher=null;displayTeacher()});
const existing=savedCode();if(existing){$('#access-code').value=existing;accessLogin()}
})();
