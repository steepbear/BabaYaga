(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const URL='https://jkrjxviduubqbikuycte.supabase.co';
const KEY='sb_publishable_ks8aQQQoe-cWXRo6b947cw_bYzTiBcZ';
const SUBJECTS={math:'Математика',russian:'Русский язык',world:'Окружающий мир',english:'Английский язык'};
let db=null,user=null,editingId=null,questions=[],listFilter='all',waiting=false;
function status(selector,text,isError=false){const e=$(selector);e.textContent=text||'';e.classList.toggle('error',isError)}
function fail(error){return (error&&error.message)||'Не удалось выполнить операцию. Повторите попытку.'}
function busy(value){waiting=value;$$('form button[type="submit"], #reload-questions').forEach(b=>b.disabled=value)}
function text(tag,cls,content){const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=String(content||'');return e}
function showAuthTab(tab){
 const login=tab==='login';
 $('#teacher-login-form').hidden=!login;$('#teacher-signup-form').hidden=login;
 $('#show-login').classList.toggle('active',login);
 $('#show-signup').classList.toggle('active',!login);
 $('#show-login').setAttribute('aria-selected',String(login));
 $('#show-signup').setAttribute('aria-selected',String(!login));
 status('#auth-status','');
}
async function loadUser(){
 if(!db)return;
 const {data,error}=await db.auth.getUser();
 user=error?null:(data.user||null);
 $('#teacher-logged-in').hidden=!user;
 $('#teacher-auth-forms').hidden=!!user;
 $('#editor').hidden=!user;
 $('#my-questions').hidden=!user;
 $('#teacher-email').textContent=user?.email||'преподаватель';
 if(user)await loadQuestions();
 else{questions=[];resetEditor();$('#my-question-items').replaceChildren();}
}
async function login(event){
 event.preventDefault();if(waiting||!db)return;
 busy(true);status('#auth-status','');
 try{
  const {error}=await db.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
  if(error)throw error;
  $('#login-password').value='';
  await loadUser();
  status('#auth-status','Вход выполнен.');
 }catch(error){status('#auth-status',fail(error),true)}
 finally{busy(false)}
}
async function signup(event){
 event.preventDefault();if(waiting||!db)return;
 const password=$('#signup-password').value;
 if(password.length<8){status('#auth-status','Пароль должен содержать не менее 8 символов.',true);return}
 busy(true);status('#auth-status','');
 try{
  const {data,error}=await db.auth.signUp({
   email:$('#signup-email').value.trim(),password,
   options:{emailRedirectTo:'https://steepbear.github.io/BabaYaga/questions.html'}
  });
  if(error)throw error;
  $('#signup-password').value='';
  if(data.session){await loadUser();status('#auth-status','Регистрация завершена. Можно добавлять вопросы.')}
  else{status('#auth-status','Проверьте почту: для завершения регистрации откройте письмо и подтвердите email. После подтверждения вернитесь сюда.');}
 }catch(error){status('#auth-status',fail(error),true)}
 finally{busy(false)}
}
function resetEditor(){
 editingId=null;$('#question-form').reset();
 $('#editor-heading').textContent='Новый вопрос';$('#cancel-edit').hidden=true;
 status('#question-status','');
}
function questionValues(){
 const subject=$('#question-subject').value,grade=Number($('#question-grade').value),difficulty=Number($('#question-difficulty').value);
 const topic=$('#question-topic').value.trim(),question_text=$('#question-text').value.trim(),answer_text=$('#question-answer').value.trim();
 const kind=$('input[name="question-visibility"]:checked').value;
 if(!SUBJECTS[subject]||![1,2,3,4].includes(grade)||![1,2,3].includes(difficulty))throw Error('Проверьте класс, предмет и сложность.');
 if(question_text.length<5||question_text.length>1200)throw Error('Текст вопроса должен содержать от 5 до 1200 символов.');
 if(!answer_text||answer_text.length>600)throw Error('Укажите правильный ответ длиной до 600 символов.');
 if(topic.length>120)throw Error('Тема слишком длинная.');
 if(!['private','community'].includes(kind))throw Error('Выберите доступность вопроса.');
 return {subject_id:subject,grade,difficulty,topic:topic||null,question_text,answer_text,kind};
}
async function save(event){
 event.preventDefault();if(waiting||!db||!user)return;
 let values;try{values=questionValues()}catch(error){status('#question-status',fail(error),true);return}
 busy(true);$('#save-question').disabled=true;status('#question-status','');
 try{
  let result;
  if(editingId){
   result=await db.from('questions').update(values).eq('id',editingId).eq('owner_id',user.id).select('id').single();
  }else{
   result=await db.from('questions').insert({...values,owner_id:user.id}).select('id').single();
  }
  if(result.error)throw result.error;
  resetEditor();
  await loadQuestions();
  status('#question-status',values.kind==='community'?'Вопрос опубликован в общей библиотеке.':'Вопрос сохранён в личной библиотеке.');
 }catch(error){status('#question-status',fail(error),true)}
 finally{busy(false);$('#save-question').disabled=false}
}
async function loadQuestions(){
 if(!user||!db)return;
 status('#list-status','');
 const {data,error}=await db.from('questions').select('id,subject_id,grade,difficulty,topic,question_text,answer_text,kind,created_at,updated_at').eq('owner_id',user.id).order('updated_at',{ascending:false}).limit(200);
 if(error){status('#list-status',fail(error),true);return}
 questions=data||[];
 renderList();
}
function renderList(){
 const host=$('#my-question-items');host.replaceChildren();
 const chosen=questions.filter(q=>listFilter==='all'||q.kind===listFilter);
 $('#questions-count').textContent=questions.length+' ваших вопросов · показано '+chosen.length;
 if(!chosen.length){host.append(text('p','q-muted',questions.length?'Для выбранного фильтра вопросов нет.':'У вас пока нет собственных вопросов.'));return}
 for(const q of chosen){
  const card=text('article','my-question-card','');
  const meta=text('div','my-question-top','');
  const badge=text('span','my-kind '+(q.kind==='community'?'community':''),q.kind==='community'?'Общедоступный':'Личный');
  meta.append(badge,text('span','',q.grade+' класс · '+(SUBJECTS[q.subject_id]||q.subject_id)+' · '+(['','Лёгкий','Обычный','Сложный'][q.difficulty]||'')));
  card.append(meta);
  if(q.topic)card.append(text('div','my-topic','Тема: '+q.topic));
  card.append(text('h3','',q.question_text),text('div','my-answer','Ответ: '+q.answer_text));
  const controls=text('div','my-question-actions','');
  const edit=text('button','','Изменить'),vis=text('button','',q.kind==='community'?'Сделать личным':'Опубликовать'),del=text('button','delete-question','Удалить');
  for(const button of [edit,vis,del])button.type='button';
  edit.addEventListener('click',()=>editQuestion(q.id));
  vis.addEventListener('click',()=>changeVisibility(q.id));
  del.addEventListener('click',()=>deleteQuestion(q.id));
  controls.append(edit,vis,del);card.append(controls);host.append(card);
 }
}
function editQuestion(id){
 const q=questions.find(x=>x.id===id);if(!q)return;
 editingId=id;$('#editor-heading').textContent='Редактирование вопроса';$('#cancel-edit').hidden=false;
 $('#question-grade').value=String(q.grade);$('#question-subject').value=q.subject_id;
 $('#question-difficulty').value=String(q.difficulty);$('#question-topic').value=q.topic||'';
 $('#question-text').value=q.question_text;$('#question-answer').value=q.answer_text;
 const radio=$('input[name="question-visibility"][value="'+q.kind+'"]');if(radio)radio.checked=true;
 status('#question-status','');
 $('#editor').scrollIntoView({behavior:'smooth',block:'start'});
}
async function changeVisibility(id){
 if(waiting)return;
 const q=questions.find(x=>x.id===id);if(!q)return;
 const kind=q.kind==='community'?'private':'community';
 if(kind==='community'&&!confirm('Опубликовать вопрос в общей библиотеке для всех игроков с кодом?'))return;
 waiting=true;status('#list-status','');
 try{
  const {data,error}=await db.from('questions').update({kind}).eq('id',id).eq('owner_id',user.id).select('id').single();
  if(error)throw error;
  if(editingId===id)resetEditor();
  await loadQuestions();
  status('#list-status',kind==='community'?'Вопрос опубликован.':'Вопрос теперь личный.');
 }catch(error){status('#list-status',fail(error),true)}finally{waiting=false}
}
async function deleteQuestion(id){
 if(waiting||!user)return;
 if(!confirm('Удалить этот вопрос без возможности восстановления?'))return;
 waiting=true;status('#list-status','');
 try{
  const {error}=await db.from('questions').delete().eq('id',id).eq('owner_id',user.id);
  if(error)throw error;
  if(editingId===id)resetEditor();
  await loadQuestions();
  status('#list-status','Вопрос удалён.');
 }catch(error){status('#list-status',fail(error),true)}finally{waiting=false}
}
function start(){
 $('#show-login').addEventListener('click',()=>showAuthTab('login'));
 $('#show-signup').addEventListener('click',()=>showAuthTab('signup'));
 $('#teacher-login-form').addEventListener('submit',login);
 $('#teacher-signup-form').addEventListener('submit',signup);
 $('#question-form').addEventListener('submit',save);
 $('#clear-question').addEventListener('click',resetEditor);
 $('#cancel-edit').addEventListener('click',resetEditor);
 $('#reload-questions').addEventListener('click',()=>loadQuestions());
 $$('.my-filter-btn').forEach(button=>button.addEventListener('click',()=>{
  listFilter=button.dataset.kind;
  $$('.my-filter-btn').forEach(b=>{const on=b===button;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
  renderList();
 }));
 $('#teacher-signout').addEventListener('click',async()=>{
  if(!db)return;
  const {error}=await db.auth.signOut();
  if(error){status('#auth-status',fail(error),true);return}
  await loadUser();status('#auth-status','Вы вышли из кабинета.');
 });
 if(!window.supabase||!window.supabase.createClient){
  status('#auth-status','Не удалось загрузить модуль авторизации. Проверьте подключение и обновите страницу.',true);return;
 }
 db=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 db.auth.onAuthStateChange((event)=>{
  if(['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){
   setTimeout(()=>loadUser().catch(e=>status('#auth-status',fail(e),true)),0);
  }
 });
 loadUser().catch(e=>status('#auth-status',fail(e),true));
}
start();
})();