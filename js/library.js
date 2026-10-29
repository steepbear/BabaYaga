(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const STORAGE='baba-yaga-local-questions-v3', SESSION='baba-yaga-demo-access-v3';
const state={subject:'math',source:'official',generated:[],grade:3,count:2};
const levels={1:'Простой',2:'Обычный',3:'Сложный'};
const dice={1:'1–2',2:'3–4',3:'5–6'};
let local=[];
function load(){try{const data=JSON.parse(localStorage.getItem(STORAGE)||'[]');local=Array.isArray(data)?data.filter(q=>q&&typeof q.text==='string'):[]}catch{local=[]}}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(local));return true}catch{window.alert('Не удалось сохранить вопрос. Возможно, браузер запрещает локальное хранение.');return false}}
function el(name,className,text){const node=document.createElement(name);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node}
function setTab(page){$$('.side-link').forEach(b=>{let active=b.dataset.page===page;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});$$('.library-tab-page').forEach(b=>b.classList.toggle('active',b.id==='page-'+page));if(page==='mine')renderMine();window.scrollTo({top:0,behavior:'smooth'})}
function empty(node,title,description){node.replaceChildren();const box=el('div','empty-state');box.append(el('div','empty-icon','✧'),el('h3','',title),el('p','',description));node.append(box)}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function chooseDiversified(pool,count){const buckets=new Map();for(const q of pool){const key=q.topic||'Без темы';if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(q)}const groups=shuffle(Array.from(buckets.values()).map(shuffle));const result=[];while(result.length<count&&groups.some(g=>g.length)){for(const group of groups){if(result.length>=count)break;if(group.length)result.push(group.pop())}shuffle(groups)}return result}
function pool(){return (state.source==='official'?window.BY_QUESTIONS:local.filter(q=>q.source===state.source)).filter(q=>Number(q.grade)===state.grade&&q.subject===state.subject)}
function make(){state.grade=Number($('#grade-select').value);state.count=Number($('#count-select').value);const candidates=pool();state.generated=[];for(const level of [1,2,3])state.generated.push(...chooseDiversified(candidates.filter(q=>Number(q.level)===level),state.count));showResult()}
function showResult(){const output=$('#question-output'),printList=$('#print-answer-list');output.replaceChildren();printList.replaceChildren();const qs=state.generated,available=pool().length;
$('#reshuffle-btn').disabled=qs.length===0;$('#print-btn').disabled=qs.length===0;
$('#result-count').textContent=qs.length?`${qs.length} вопросов · ${available} в библиотеке`:'Нет вопросов в выбранной библиотеке';
$('#print-subtitle').textContent=`${state.grade} класс · ${window.BY_SUBJECTS[state.subject]} · ${state.source==='official'?'основная библиотека':state.source==='private'?'личные вопросы':'вопросы преподавателей'} · демоверсия`;
if(!qs.length){empty(output,'Здесь пока нет вопросов','Выберите другую библиотеку или добавьте собственные вопросы.');return}
const short=[1,2,3].filter(level=>qs.filter(q=>Number(q.level)===level).length<state.count);
if(short.length){const missing=short.map(l=>`${levels[l].toLowerCase()} (${qs.filter(q=>Number(q.level)===l).length} из ${state.count})`).join(', ');output.append(el('div','inline-alert',`Недостаточно вопросов на некоторых уровнях: ${missing}. Включены все доступные вопросы без повторов.`))}
let n=0;
for(const level of [1,2,3]){
 const group=el('section','level-group');const header=el('div','level-group-heading');header.append(el('h3','',`${levels[level]} уровень`),el('span','level-pill',`Кубик ${dice[level]}`));group.append(header);
 const rows=qs.filter(q=>Number(q.level)===level);
 if(!rows.length)group.append(el('p','level-empty','Вопросов этого уровня пока нет'));
 rows.forEach(q=>{n+=1;const card=el('article','q-item'),top=el('div','q-top');top.append(el('span','q-number',`${n}.`),el('span','q-topic',q.topic||'Без темы'));card.append(top,el('p','',q.text));const answer=el('div','q-answer');answer.append(el('strong','', 'Ответ: '),document.createTextNode(q.answer));card.append(answer);group.append(card);
 const item=el('li','',`${n}. ${q.answer} (${levels[level].toLowerCase()}; ${q.topic||'без темы'})`);item.style.listStyle='none';printList.append(item)});
 output.append(group)
}
}
function renderMine(){const node=$('#my-questions-list');node.replaceChildren();$('#mine-count').textContent=local.length;if(!local.length){empty(node,'Здесь пока пусто','Вопросы, сохранённые на этом устройстве, появятся здесь.');return}
local.slice().reverse().forEach(q=>{const row=el('div','my-question'),info=el('div');info.append(el('strong','',q.text),el('span','',`${q.grade} класс · ${window.BY_SUBJECTS[q.subject]} · ${q.topic} · ${q.source==='private'?'🔒 Личный':'◇ Общий (пока локально)'}`));const button=el('button','small-delete','Удалить');button.type='button';button.addEventListener('click',()=>{if(window.confirm('Удалить этот вопрос из браузера?')){const old=local;local=local.filter(item=>item.id!==q.id);if(persist()){renderMine();state.generated=[];showResult()}else local=old}});row.append(info,button);node.append(row)})}
function addQuestion(event){event.preventDefault();const frm=event.currentTarget,v=id=>$('#'+id).value.trim();const q={id:typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`,grade:Number(v('add-grade')),subject:v('add-subject'),topic:v('add-topic'),level:Number(v('add-level')),text:v('add-question'),answer:v('add-answer'),source:document.querySelector('input[name="privacy"]:checked').value};if(!q.text||!q.answer||!q.topic)return;local.push(q);if(!persist()){local.pop();return}const notice=$('#save-feedback');notice.className='notice-success';notice.textContent=q.source==='private'?'Личный вопрос сохранён только в этом браузере.':'Вопрос сохранён локально. В общую базу он не опубликован.';frm.reset();$('#add-grade').value=String(q.grade);$('#add-subject').value=q.subject;$('#mine-count').textContent=local.length;setTab('mine')}
function access(){let passed=false;try{passed=sessionStorage.getItem(SESSION)==='yes'}catch{}if(passed)return;const modal=$('#access-modal');modal.classList.remove('hidden');document.body.classList.add('modal-open');const unlock=()=>{try{sessionStorage.setItem(SESSION,'yes')}catch{}modal.classList.add('hidden');document.body.classList.remove('modal-open')};$('#access-submit').addEventListener('click',()=>{if($('#access-code').value.trim().toUpperCase()==='DEMO')unlock();else $('#access-message').textContent='Постоянные коды пока не подключены. Используйте DEMO или кнопку ниже.'});$('#access-code').addEventListener('keydown',e=>{if(e.key==='Enter')$('#access-submit').click()});$('#access-demo').addEventListener('click',unlock)}
$$('.side-link').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.page)));
$$('.subject-button').forEach(b=>b.addEventListener('click',()=>{state.subject=b.dataset.subject;$$('.subject-button').forEach(x=>x.classList.toggle('active',x===b))}));
$$('.source-tab').forEach(b=>b.addEventListener('click',()=>{state.source=b.dataset.source;$$('.source-tab').forEach(x=>x.classList.toggle('active',x===b))}));
$('#generate-btn').addEventListener('click',make);$('#reshuffle-btn').addEventListener('click',make);$('#print-btn').addEventListener('click',()=>window.print());$('#question-form').addEventListener('submit',addQuestion);$('#add-from-mine').addEventListener('click',()=>setTab('add'));
load();renderMine();access();
})();
