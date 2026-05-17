const TREE=[
  {id:'type-methods',title:'题型方法',children:[
    {id:'type-summary',title:'概括归纳'},
    {id:'type-analysis',title:'综合分析'},
    {id:'type-solution',title:'提出对策'},
    {id:'type-execution',title:'贯彻执行'},
    {id:'type-essay',title:'申发论述'}
  ]},
  {id:'material-process',title:'材料处理',children:[
    {id:'material-read',title:'材料阅读'},
    {id:'material-points',title:'要点提取'},
    {id:'material-structure',title:'归纳整合'}
  ]},
  {id:'essay-argument',title:'申发论述',children:[
    {id:'essay-position',title:'立意'},
    {id:'essay-opening',title:'开头'},
    {id:'essay-arguments',title:'分论点'},
    {id:'essay-ending',title:'结尾'}
  ]},
  {id:'hot-topics',title:'热点主题',children:[
    {id:'topic-governance',title:'基层治理'},
    {id:'topic-rural',title:'乡村振兴'},
    {id:'topic-business',title:'营商环境'},
    {id:'topic-people',title:'民生服务'}
  ]},
  {id:'case-library',title:'案例素材',children:[
    {id:'case-people',title:'人物案例'},
    {id:'case-local',title:'地方案例'}
  ]},
  {id:'golden-lines',title:'金句表达',children:[
    {id:'line-opening',title:'开头表达'},
    {id:'line-policy',title:'对策表达'}
  ]},
  {id:'common-losses',title:'常见失分',children:[
    {id:'loss-topic',title:'审题偏差'},
    {id:'loss-points',title:'要点遗漏'},
    {id:'loss-logic',title:'条理混乱'},
    {id:'loss-empty',title:'表达空泛'},
  ]},
  {id:'paper-review',title:'套题复盘',children:[
    {id:'review-national',title:'国考套题'},
    {id:'review-province',title:'省考套题'}
  ]}
];
const TYPE_TO_NODE={'概括归纳':'type-summary','综合分析':'type-analysis','提出对策':'type-solution','贯彻执行':'type-execution','申发论述':'type-essay'};
const NODE_ALIASES={
  'material-classify':'material-structure',
  'material-compare':'material-structure',
  'material-transform':'material-structure',
  'essay-title':'essay-position',
  'essay-proof':'essay-arguments',
  'topic-digital':'topic-governance',
  'topic-ecology':'topic-people',
  'topic-culture':'topic-people',
  'case-policy':'case-local',
  'line-transition':'line-opening',
  'line-ending':'line-policy',
  'loss-format':'loss-logic',
  'review-mock':'review-province'
};
const K='shenlun_workspace_v3_local',OLD_KEYS=['shenlun_workspace_v2_local','shenlun_workspace_v1_local'],SK='shenlun_workspace_v3',OLD_SYNC_KEYS=['shenlun_workspace_v2','shenlun_workspace_v1'],ST='shenlun_last_sync_time_v3',SA='shenlun_last_sync_at_v3',E={};
let W=loadWorkspace(),U=null,syncTimer=null,busy=false,toastTimer=null;
const $=id=>document.getElementById(id),now=()=>new Date().toISOString(),uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const esc=v=>String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function flat(nodes,out=[]){(nodes||[]).forEach(n=>{out.push({id:n.id,title:n.title});flat(n.children||[],out)});return out}
function canonicalNodeId(id){return NODE_ALIASES[String(id||'')]||String(id||'')}
function nodeLabel(id){return(flat(TREE).find(x=>x.id===id)||{}).title||'未分类'}
function time(v){if(!v)return'未记录';const d=new Date(v);if(Number.isNaN(d.getTime()))return v;return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function toast(msg){E.toast.textContent=msg;E.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>E.toast.classList.remove('show'),2200)}
function setSync(state,msg,at){E.syncBadge.dataset.state=state;E.syncBadge.textContent=({idle:'同步待命',saving:'同步中',synced:'已同步',error:'同步失败'})[state]||state;E.syncHint.textContent=`${msg}${at?` | 最近同步: ${time(at)}`:''}`}

function defaultNotes(){const t=now();return flat(TREE).reduce((a,n)=>(a[n.id]={id:n.id,title:n.title,content:'',updatedAt:t},a),{})}
function mergeNotes(rawNotes,fallback){
  const base=defaultNotes(),source=rawNotes&&typeof rawNotes==='object'?rawNotes:{};
  Object.keys(source).forEach(key=>{
    const targetId=canonicalNodeId(key);
    if(!base[targetId]) return;
    const record=source[key]&&typeof source[key]==='object'?source[key]:{};
    const content=String(record.content||'').trim();
    if(content){
      base[targetId].content=base[targetId].content?`${base[targetId].content}\n\n---\n\n${content}`:content;
    }
    base[targetId].updatedAt=String(record.updatedAt||fallback||now());
  });
  return base;
}
function baseWorkspace(){return{version:3,questions:[],notes:defaultNotes(),updatedAt:now(),ui:{activeTab:'questions',selectedNodeId:'type-summary',selectedQuestionId:''}}}
function normQuestion(raw){raw=raw&&typeof raw==='object'?raw:{};return{id:String(raw.id||uid('question')),nodeId:canonicalNodeId(raw.nodeId||TYPE_TO_NODE[raw.type]||'type-summary'),paperTitle:String(raw.paperTitle||''),prompt:String(raw.prompt||raw.title||''),myAnswer:String(raw.myAnswer||''),referenceAnswer:String(raw.referenceAnswer||''),updatedAt:String(raw.updatedAt||now())}}
function countPapers(questions){return new Set((questions||[]).map(q=>String(q.paperTitle||'').trim()).filter(Boolean)).size}

function migrateLegacy(raw){
  const i=raw&&typeof raw==='object'?raw:{},notes=mergeNotes(i.notes,i.updatedAt);
  const papersById=new Map((Array.isArray(i.papers)?i.papers:[]).map(p=>[String(p.id||''),p]));
  const answers=i.answers&&typeof i.answers==='object'?i.answers:{};
  const fromQuestions=Array.isArray(i.questions)?i.questions:[];
  const questions=fromQuestions.length?fromQuestions.map(q=>normQuestion({
    id:q.id,
    nodeId:q.nodeId||TYPE_TO_NODE[q.type]||'type-summary',
    paperTitle:q.paperTitle||(papersById.get(String(q.paperId||''))?.title)||[papersById.get(String(q.paperId||''))?.year,papersById.get(String(q.paperId||''))?.region,papersById.get(String(q.paperId||''))?.theme].filter(Boolean).join(' / '),
    prompt:q.prompt||q.title||'',
    myAnswer:answers[q.id]?.draftText||answers[q.id]?.finalText||answers[q.id]?.outline||'',
    referenceAnswer:q.referenceAnswer||'',
    updatedAt:q.updatedAt||answers[q.id]?.updatedAt||i.updatedAt
  })):[];
  if(!questions.length&&Array.isArray(i.papers)){
    i.papers.forEach(p=>{
      const paperTitle=String(p.title||[p.year,p.region,p.theme].filter(Boolean).join(' / ')||'');
      (Array.isArray(p.questions)?p.questions:[]).forEach(q=>{
        const a=answers[q.id]||{};
        questions.push(normQuestion({
          id:q.id,nodeId:TYPE_TO_NODE[q.type]||'type-summary',paperTitle,prompt:q.prompt||q.title||'',myAnswer:a.draftText||a.finalText||a.outline||'',referenceAnswer:q.referenceAnswer||'',updatedAt:q.updatedAt||a.updatedAt||p.updatedAt||i.updatedAt
        }));
      });
    });
  }
  return ensureWorkspace({version:3,questions,notes,updatedAt:i.updatedAt||now(),ui:{activeTab:'questions',selectedNodeId:'type-summary',selectedQuestionId:''}});
}

function ensureWorkspace(raw){
  if(!raw||typeof raw!=='object')return baseWorkspace();
  if(!Array.isArray(raw.questions))return migrateLegacy(raw);
  const base=baseWorkspace(),notes=mergeNotes(raw.notes,raw.updatedAt);
  const w={version:3,questions:raw.questions.map(normQuestion),notes,updatedAt:String(raw.updatedAt||now()),ui:Object.assign({},base.ui,raw.ui||{})};
  w.ui.selectedNodeId=canonicalNodeId(w.ui.selectedNodeId);
  if(!w.notes[w.ui.selectedNodeId])w.ui.selectedNodeId='type-summary';
  const firstInNode=w.questions.find(q=>q.nodeId===w.ui.selectedNodeId&&q.id===w.ui.selectedQuestionId)||w.questions.find(q=>q.nodeId===w.ui.selectedNodeId)||null;
  w.ui.selectedQuestionId=firstInNode?firstInNode.id:'';
  if(!['questions','notes'].includes(w.ui.activeTab))w.ui.activeTab='questions';
  return w;
}

function loadWorkspace(){
  try{
    const raw=localStorage.getItem(K)||OLD_KEYS.map(key=>localStorage.getItem(key)).find(Boolean);
    return raw?ensureWorkspace(JSON.parse(raw)):baseWorkspace();
  }catch(e){
    console.warn('[shenlun] load failed',e);
    return baseWorkspace();
  }
}

function saveWorkspace(){localStorage.setItem(K,JSON.stringify(W))}
function touch(){W.updatedAt=now();saveWorkspace();localStorage.setItem(SA,W.updatedAt)}
function questionsForNode(nodeId){return W.questions.filter(q=>q.nodeId===nodeId)}
function selectedQuestion(){return W.questions.find(q=>q.id===W.ui.selectedQuestionId)||null}
function selectedNote(){return W.notes[W.ui.selectedNodeId]||null}

function renderMetrics(){E.metricQuestions.textContent=W.questions.length;E.metricDone.textContent=W.questions.filter(q=>String(q.myAnswer||'').trim()).length;E.metricPapers.textContent=countPapers(W.questions)}
function renderTree(){E.noteTree.innerHTML=TREE.map(group=>`<div class="sl-tree-group"><div class="sl-tree-group-title">${esc(group.title)}</div>${((group.children&&group.children.length)?group.children:[group]).map(n=>`<button class="${n.id===W.ui.selectedNodeId?'active':''}" data-node-id="${n.id}">${esc(n.title)} <small>${questionsForNode(n.id).length}题</small></button>`).join('')}</div>`).join('')}
function renderQuestionList(){const list=questionsForNode(W.ui.selectedNodeId);if(!list.length){E.questionList.innerHTML='<div class="empty">当前节点还没有题目。先录第一题。</div>';return}E.questionList.innerHTML=`<div class="sl-question-table"><div class="sl-question-head"><div>题目</div><div>套卷</div><div>更新</div></div>${list.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).map(q=>`<button class="sl-question-row ${q.id===W.ui.selectedQuestionId?'active':''}" data-question-id="${q.id}"><div class="sl-question-title">${esc((q.prompt||'').split('\n')[0]||'未命名题目')}</div><div class="sl-question-cell">${esc(q.paperTitle||'未套卷')}</div><div class="sl-question-cell">${esc(time(q.updatedAt))}</div></button>`).join('')}</div>`}
function renderHero(){const q=selectedQuestion();E.heroTitle.textContent=nodeLabel(W.ui.selectedNodeId);E.heroSummary.textContent=q?`当前题：${(q.prompt||'').split('\n')[0]||'未命名题目'}`:'当前节点还没有题目，先录第一题';E.heroMeta.innerHTML=`<span class="sl-badge">节点题数：${questionsForNode(W.ui.selectedNodeId).length}</span><span class="sl-badge">总题数：${W.questions.length}</span><span class="sl-badge">当前标签：${W.ui.activeTab==='questions'?'题目':'笔记'}</span>`}
function renderTabs(){document.querySelectorAll('.sl-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===W.ui.activeTab));document.querySelectorAll('.sl-panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${W.ui.activeTab}`))}
function renderQuestionForm(){const q=selectedQuestion();E.questionNodeLabel.value=nodeLabel(W.ui.selectedNodeId);E.questionPaperTitle.value=q?q.paperTitle:'';E.questionPrompt.value=q?q.prompt:'';E.questionMyAnswer.value=q?q.myAnswer:'';E.questionReference.value=q?q.referenceAnswer:''}
function renderNote(){const n=selectedNote();E.noteTitle.value=n?n.title:nodeLabel(W.ui.selectedNodeId);E.noteContent.value=n?n.content:'';E.notePreviewTitle.textContent=n?n.title:nodeLabel(W.ui.selectedNodeId);E.notePreviewContent.textContent=n&&n.content?n.content:'当前还没有内容。'}
function render(){W=ensureWorkspace(W);renderMetrics();renderTree();renderQuestionList();renderHero();renderTabs();renderQuestionForm();renderNote()}

async function runtimeInfo(){try{const r=await fetch(`/api/runtime-info?ts=${Date.now()}`,{credentials:'include'}),d=await r.json();E.runtimeBadge.dataset.mode=String(d?.mode||'unknown');E.runtimeBadge.textContent=String(d?.label||'Runtime: unknown')}catch(e){E.runtimeBadge.dataset.mode='unknown';E.runtimeBadge.textContent='Runtime: unavailable'}}
async function refreshSession(){try{const r=await fetch('/api/me',{credentials:'include'}),d=await r.json();if(!d||!d.authenticated){window.location.replace('/login');return false}U=d.user;E.cloudUserBadge.textContent=`Cloud: ${U.username}`;return true}catch(e){window.location.replace('/login');return false}}
function buildOp(){return{id:uid('shenlun-op'),op_type:'setting_upsert',entity_id:SK,payload:{value:W,updatedAt:W.updatedAt},created_at:now()}}
function latestRemote(ops){const keys=[SK].concat(OLD_SYNC_KEYS),arr=(Array.isArray(ops)?ops:[]).filter(o=>o&&o.op_type==='setting_upsert'&&keys.includes(o.entity_id)).map(o=>{const p=o.payload&&typeof o.payload==='object'?o.payload:{};const v=p.value&&typeof p.value==='object'?p.value:null;return v?{w:ensureWorkspace(v),u:String(v.updatedAt||p.updatedAt||o.created_at||'')}:null}).filter(Boolean).sort((a,b)=>String(a.u).localeCompare(String(b.u)));return arr[arr.length-1]||null}
async function pull(full,silent){if(!U)return;try{const since=full?'':(localStorage.getItem(ST)||''),r=await fetch(`/api/sync?since=${encodeURIComponent(since)}`,{credentials:'include'}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||d.error||'pull failed');const m=latestRemote(d.ops);if(m&&String(m.u)>String(W.updatedAt||'')){W=m.w;saveWorkspace();render();if(!silent)toast('已拉取申论工作区')}if(d.serverTime)localStorage.setItem(ST,d.serverTime);const at=m&&m.u?m.u:(localStorage.getItem(SA)||'');setSync(at?'synced':'idle',at?'申论工作区已与云端对齐':'云端还没有申论工作区，当前先使用本地数据',at)}catch(e){console.warn('[shenlun] pull failed',e);setSync('error',`拉取失败：${e.message||'unknown error'}`,localStorage.getItem(SA)||'')}}
async function push(msg){if(!U||busy)return;busy=true;setSync('saving',msg||'正在上传申论工作区',W.updatedAt);try{const r=await fetch('/api/sync',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({ops:[buildOp()]})}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||d.error||'push failed');if(d.serverTime)localStorage.setItem(ST,d.serverTime);localStorage.setItem(SA,W.updatedAt);setSync('synced','申论工作区已同步',W.updatedAt)}catch(e){console.warn('[shenlun] push failed',e);setSync('error',`上传失败：${e.message||'unknown error'}`,W.updatedAt)}finally{busy=false}}
function later(msg){clearTimeout(syncTimer);setSync('saving',msg||'检测到本地修改，准备同步',W.updatedAt);syncTimer=setTimeout(()=>push('申论工作区已同步'),1200)}

function clearQuestion(){W.ui.selectedQuestionId='';saveWorkspace();render()}
function saveQuestion(){
  const prompt=E.questionPrompt.value.trim();
  if(!prompt)return toast('先填写题目');
  const q=selectedQuestion(),payload={nodeId:W.ui.selectedNodeId,paperTitle:E.questionPaperTitle.value.trim(),prompt,myAnswer:E.questionMyAnswer.value.trim(),referenceAnswer:E.questionReference.value.trim(),updatedAt:now()};
  if(q)Object.assign(q,payload);
  else{const nq=normQuestion(Object.assign({id:uid('question')},payload));W.questions.unshift(nq);W.ui.selectedQuestionId=nq.id}
  touch();render();later('题目已更新，准备同步');toast('题目已保存');
}
function deleteQuestion(){const q=selectedQuestion();if(!q)return toast('当前没有可删除的题目');if(!window.confirm('确认删除当前题目吗？'))return;W.questions=W.questions.filter(x=>x.id!==q.id);W.ui.selectedQuestionId='';touch();render();later('题目已删除，准备同步');toast('题目已删除')}
function saveNote(){W.notes[W.ui.selectedNodeId]={id:W.ui.selectedNodeId,title:E.noteTitle.value.trim()||nodeLabel(W.ui.selectedNodeId),content:E.noteContent.value.trim(),updatedAt:now()};touch();render();later('节点笔记已更新，准备同步');toast('节点笔记已保存')}

function bind(){
  document.querySelectorAll('.sl-tab').forEach(b=>b.addEventListener('click',()=>{W.ui.activeTab=b.dataset.tab;saveWorkspace();renderTabs();renderHero()}));
  E.noteTree.addEventListener('click',e=>{const b=e.target.closest('[data-node-id]');if(!b)return;W.ui.selectedNodeId=b.dataset.nodeId;W.ui.selectedQuestionId='';saveWorkspace();render()});
  E.questionList.addEventListener('click',e=>{const b=e.target.closest('[data-question-id]');if(!b)return;W.ui.selectedQuestionId=b.dataset.questionId;saveWorkspace();render()});
  E.newQuestionBtn.onclick=clearQuestion;
  E.saveQuestionBtn.onclick=saveQuestion;
  E.resetQuestionBtn.onclick=clearQuestion;
  E.deleteQuestionBtn.onclick=deleteQuestion;
  E.saveNoteBtn.onclick=saveNote;
  E.resetNoteBtn.onclick=renderNote;
  E.manualSyncBtn.onclick=async()=>{await push('正在手动同步申论工作区');await pull(false,true)};
  E.logoutBtn.onclick=async()=>{try{await fetch('/api/auth/logout',{method:'POST',credentials:'include'})}catch(e){}window.location.replace('/login')};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearTimeout(syncTimer);if(U)push('正在后台同步申论工作区')}});
}

async function init(){
  ['runtimeBadge','cloudUserBadge','syncBadge','syncHint','metricQuestions','metricDone','metricPapers','noteTree','questionList','heroTitle','heroSummary','heroMeta','questionNodeLabel','questionPaperTitle','questionPrompt','questionMyAnswer','questionReference','saveQuestionBtn','resetQuestionBtn','deleteQuestionBtn','newQuestionBtn','noteTitle','noteContent','notePreviewTitle','notePreviewContent','saveNoteBtn','resetNoteBtn','manualSyncBtn','logoutBtn','toast'].forEach(id=>E[id]=$(id));
  render();
  bind();
  await runtimeInfo();
  if(!await refreshSession())return;
  await pull(true,true);
  render();
  setInterval(()=>{if(!document.hidden)pull(false,true)},45000);
}

window.addEventListener('DOMContentLoaded',init);
