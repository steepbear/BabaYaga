(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const STORAGE='baba-yaga-personal-questions-v1', SESSION='baba-yaga-demo-access-v1';
const state={subject:'math',source:'official',generated:[],grade:3,count:6};
const levels={1:'Простой',2:'Средний',3:'Сложный'};
let local=[];
function load(){try{const data=JSON.parse(localStorage.getItem(STORAGE)||'[]');local=Array.isArray(data)?data.filter(q=>q&&typeof q.text==='string'):[]}catch{local=[]}}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(local));return true}catch{window.alert('Не удалось сохранить вопрос. Возможно, браузер запрещает локальное хранение.');return false}}
function el(name,className,text){const node=document.createElement(name);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node}
function setTab(page){$$('.side-link').forEach(b=>{let active=b.dataset.page===page;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});$$('.library-tab-page').forEach(b=>b.classList.toggle('active',b.id==='page-'+page));if(page==='mine')renderMine();window.scrollTo({top:0,behavior:'smooth'})}
function empty(node,title,description){node.replaceChildren();const box=el('div','empty-state');box.append(el('div','empty-icon','✧'),el('h3','',title),el('p','',description));node.append(box)}
function chooseDiversified(pool,count){const buckets=new Map();for(const q of pool){const key=q.topic||'Без темы';if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(q)};const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};const groups=shuffle(Array.from(buckets.values()).map(shuffle));const result=[];while(result.length<count&&groups.some(g=>g.length)){for(const group of groups){if(result.length>=count)break;if(group.length)result.push(group.pop())}shuffle(groups)}return result}
function make(){state.grade=Number($('#grade-select').value);state.count=Number($('#count-select').value);
 const pool=(state.source==='official'?window.BY_QUESTIONS:local.filter(q=>q.source===state.source)).filter(q=>q.grade===state.grade&&q.subject===state.subject);
 state.generated=chooseDiversified(pool,state.count);
 showResult();
}
function showResult(){const output=$('#question-output'),printList=$('#print-answer-list');output.replaceChildren();printList.replaceChildren();const questions=state.generated,available=(state.source==='official'?window.BY_QUESTIONS:local.filter(q=>q.source===state.source)).filter(q=>q.grade===state.grade&&q.subject===state.subject).length;
 $('#reshuffle-btn').disabled=questions.length===0;$('#print-btn').disabled=questions.length===0;
 $('#result-count').textContent=questions.length?`${questions.length} вопросов · доступно ${available}`:'Нет вопросов в выбранной библиотеке';
 $('#print-subtitle').textContent=`${state.grade} класс · ${window.BY_SUBJECTS[state.subject]} · ${state.source==='official'?'основная библиотека':state.source==='private'?'личные вопросы':'вопросы преподавателей'} · демонстрация`;
 if(!questions.length){empty(output,'Вопросов пока нет',state.source==='official'?'Для этого класса и предмета пока не добавлены примеры.':'Добавьте свои вопросы в соответствующую библиотеку — и сможете собрать подборку.');return}
 if(questions.length<state.count){const a=el('div','inline-alert',`В этой библиотеке есть только ${questions.length} подходящих вопросов. Мы включили все без повторений.`);output.append(a)}
 questions.forEach((q,i)=>{
 const card=el('article','q-item');const top=el('div','q-top');top.append(el('span','q-number',`${i+1}.`),el('span','q-topic',q.topic||'Без темы'),el('span','q-difficulty',`Сложность: ${levels[q.level]||'Не указана'}`));card.append(top,el('p','',q.text));const answer=el('div','q-answer');answer.append(el('strong','', 'Ответ: '),document.createTextNode(q.answer));card.append(answer);output.append(card);
 const listitem=el('li','',`${q.answer} (${q.topic||'Без темы'})`);printList.append(listitem);
 });
}
function renderMine(){const node=$('#my-questions-list');node.replaceChildren();$('#mine-count').textContent=local.length;
 if(!local.length){empty(node,'Здесь пока пусто','Ваши сохранённые вопросы появятся здесь.');return}
 local.slice().reverse().forEach(q=>{
  const row=el('div','my-question');const info=el('div');info.append(el('strong','',q.text),el('span','',`${q.grade} класс · ${window.BY_SUBJECTS[q.subject]} · ${q.topic} · ${q.source==='private'?'🔒 Личный':'◇ Общий (только локально)'}`));const button=el('button','small-delete','Удалить');button.type='button';button.addEventListener('click',()=>{if(window.confirm('Удалить этот вопрос из браузера?')){local=local.filter(item=>item.id!==q.id);if(persist()){renderMine();state.generated=[];showResult()}}});row.append(info,button);node.append(row)
 });
}
function addQuestion(event){event.preventDefault();const frm=event.currentTarget;
 const v=id=>$('#'+id).value.trim();
 const q={id:(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`),grade:Number(v('add-grade')),subject:v('add-subject'),topic:v('add-topic'),level:Number(v('add-level')),text:v('add-question'),answer:v('add-answer'),source:document.querySelector('input[name="privacy"]:checked').value};
 if(!q.text||!q.answer||!q.topic)return;
 local.push(q);if(!persist()){local.pop();return}
 const notice=$('#save-feedback');notice.className='notice-success';notice.textContent=q.source==='private'?'Личный вопрос сохранён в этом браузере.':'Вопрос сохранён в локальной демоверсии общей библиотеки. На сервер он не опубликован.';
 frm.reset();$('#add-grade').value=String(q.grade);$('#add-subject').value=q.subject;$('#mine-count').textContent=local.length;setTimeout(()=>{notice.textContent='';notice.className=''},6500);
}
function access(){let passed=false;try{passed=sessionStorage.getItem(SESSION)==='yes'}catch{}
 if(passed)return;
 const modal=$('#access-modal');modal.classList.remove('hidden');document.body.classList.add('modal-open');
 const unlock=()=>{try{sessionStorage.setItem(SESSION,'yes')}catch{}modal.classList.add('hidden');document.body.classList.remove('modal-open')};
 $('#access-submit').addEventListener('click',()=>{if($('#access-code').value.trim().toUpperCase()==='DEMO'){unlock()}else{$('#access-message').textContent='Постоянные коды ещё не подключены. Для просмотра используйте DEMO или кнопку ниже.'}});
 $('#access-code').addEventListener('keydown',e=>{if(e.key==='Enter')$('#access-submit').click()});$('#access-demo').addEventListener('click',unlock);
}
$$('.side-link').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.page)));
$$('.subject-button').forEach(b=>b.addEventListener('click',()=>{state.subject=b.dataset.subject;$$('.subject-button').forEach(el=>el.classList.toggle('active',el===b))}));
$$('.source-tab').forEach(b=>b.addEventListener('click',()=>{state.source=b.dataset.source;$$('.source-tab').forEach(el=>el.classList.toggle('active',el===b))}));
$('#generate-btn').addEventListener('click',make);$('#reshuffle-btn').addEventListener('click',make);$('#print-btn').addEventListener('click',()=>window.print());
$('#question-form').addEventListener('submit',addQuestion);$('#add-from-mine').addEventListener('click',()=>setTab('add'));
load();renderMine();access();
})();
