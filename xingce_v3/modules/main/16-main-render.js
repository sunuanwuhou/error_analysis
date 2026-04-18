// ============================================================
// 渲染主列表
// ============================================================
const INITIAL_ERROR_RENDER_LIMIT = 60;
const ERROR_RENDER_STEP = 60;
let errorRenderLimit = INITIAL_ERROR_RENDER_LIMIT;
let errorRenderKey = '';
let errorListAutoPagerObserver = null;

function getErrorRenderStateKey(list){
  return JSON.stringify({
    size: Array.isArray(list) ? list.length : 0,
    searchKw: String(searchKw || ''),
    statusFilter: String(statusFilter || ''),
    taskFilter: String(taskFilter || ''),
    reasonFilter: String(reasonFilter || ''),
    typeFilter: typeFilter || null
  });
}

function resetErrorRenderWindow(){
  errorRenderLimit = INITIAL_ERROR_RENDER_LIMIT;
}

function shouldUseProgressiveErrorRender(list){
  if (!Array.isArray(list)) return false;
  if (list.length > 120) return true;
  if (typeof isLikelyMobileLikeDevice === 'function' && isLikelyMobileLikeDevice() && list.length > 40) return true;
  return false;
}

function disconnectErrorListAutoPager(){
  if (errorListAutoPagerObserver) {
    errorListAutoPagerObserver.disconnect();
    errorListAutoPagerObserver = null;
  }
}

function attachErrorListAutoPager(){
  disconnectErrorListAutoPager();
  const sentinel = document.getElementById('errorListAutoPager');
  if (!sentinel || typeof IntersectionObserver === 'undefined') return;
  errorListAutoPagerObserver = new IntersectionObserver((entries) => {
    const hit = entries.some(entry => entry.isIntersecting);
    if (!hit) return;
    disconnectErrorListAutoPager();
    loadMoreErrors();
  }, {
    root: null,
    rootMargin: '240px 0px',
    threshold: 0.01
  });
  errorListAutoPagerObserver.observe(sentinel);
}

function renderTaskFilterBar(){
  const host = document.getElementById('taskFilterBar');
  if(!host) return;
  const allEntries = getErrorEntries();
  const items = [
    { key:'all', label:'全部', count:allEntries.length },
    { key:'diagnose', label:'待判因', count:allEntries.filter(e => matchTaskFilter(e, 'diagnose')).length },
    { key:'review_ready', label:'待复盘', count:allEntries.filter(e => matchTaskFilter(e, 'review_ready')).length },
    { key:'retrain', label:'待复训', count:allEntries.filter(e => matchTaskFilter(e, 'retrain')).length },
  ];
  host.innerHTML = items.map(item => `
    <button class="btn btn-sm ${taskFilter===item.key?'btn-primary':'btn-secondary'}" onclick="setTaskFilter('${item.key}')">
      ${escapeHtml(item.label)}（${item.count}）
    </button>
  `).join('');
}
function renderStats(list){
  renderTaskFilterBar();
  const f=list.filter(e=>normalizeErrorStatusValue(e.status)==='focus').length;
  const r=list.filter(e=>normalizeErrorStatusValue(e.status)==='review').length;
  const m=list.filter(e=>normalizeErrorStatusValue(e.status)==='mastered').length;
  document.getElementById('statsBar').innerHTML=`
    <div class="stat-item"><div class="stat-num">${list.length}</div><div class="stat-label">共计</div></div>
    <div class="stat-item"><div class="stat-num" style="color:#e74c3c">${f}</div><div class="stat-label">重点</div></div>
    <div class="stat-item"><div class="stat-num" style="color:#fa8c16">${r}</div><div class="stat-label">待复习</div></div>
    <div class="stat-item"><div class="stat-num" style="color:#52c41a">${m}</div><div class="stat-label">已掌握</div></div>`;
  let crumb='全部题目';
  if(typeFilter){
    if(typeFilter.level==='type') crumb=typeFilter.value;
    else if(typeFilter.level==='subtype') crumb=`${typeFilter.type} › ${typeFilter.value}`;
    else if(typeFilter.level==='sub2') crumb=`${typeFilter.type} › ${typeFilter.subtype} › ${typeFilter.value}`;
  } else if(taskFilter!=='all') {
    crumb=`任务视角：${getTaskFilterLabel(taskFilter)}`;
  } else if(statusFilter!=='all') crumb=getErrorStatusLabel(statusFilter);
  if(reasonFilter) crumb+=(crumb==='全部题目'?'':`，`)+'错因: '+reasonFilter;
  if(searchKw) crumb+=` › 搜索"${escapeHtml(searchKw)}"`;
  document.getElementById('breadcrumb').innerHTML=crumb==='全部题目'?'全部题目':
    `全部 › <span>${escapeHtml(crumb)}</span> <span style="cursor:pointer;color:#aaa;font-size:11px;margin-left:4px" onclick="clearFilter()">✕ 清除</span>`;
}

function renderAll(){
  const list=getFiltered();
  const currentRenderKey = getErrorRenderStateKey(list);
  if(currentRenderKey !== errorRenderKey){
    errorRenderKey = currentRenderKey;
    resetErrorRenderWindow();
  }
  renderStats(list);
  if(!list.length){
    disconnectErrorListAutoPager();
    document.getElementById('errorList').innerHTML=`<div class="empty"><div class="emoji">${searchKw?'🔍':'📭'}</div><p>${searchKw?'未找到匹配题目':'暂无错题，点击"＋ 添加"'}</p></div>`;
    if (typeof window.refreshKnowledgeWorkspaceCards === 'function') {
      window.refreshKnowledgeWorkspaceCards();
    }
    if (typeof window.refreshClaudeBankModal === 'function') {
      window.refreshClaudeBankModal();
    }
    return;
  }
  const progressive = shouldUseProgressiveErrorRender(list);
  const visibleList = progressive ? list.slice(0, errorRenderLimit) : list;
  const typeMap={};
  visibleList.forEach(e=>{
    if(!typeMap[e.type]) typeMap[e.type]={};
    const s=e.subtype||'未分类';
    if(!typeMap[e.type][s]) typeMap[e.type][s]=[];
    typeMap[e.type][s].push(e);   // 保持数组，三级分组在渲染时动态分拆
  });
  let html='';
  Object.entries(typeMap).forEach(([type,subs])=>{
    const open=expMain.has(type);
    const total=Object.values(subs).reduce((s,a)=>s+a.length,0);
    html+=`<div class="type-group">
      <div class="type-header" onclick="toggleMain('${escapeHtml(type)}')">
        <div class="type-title">
          <span class="type-arrow ${open?'open':''}">▶</span>
          ${escapeHtml(type)}<span class="type-badge">${total}</span>
        </div>
      </div>`;
    if(open){
      Object.entries(subs).forEach(([sub,cards])=>{
        const sk='sub:'+type+'::'+sub;
        const sopen=expMainSub.has(sk);
        // 按三级分组
        const sub2Map={};
        cards.forEach(e=>{
          const s2=e.subSubtype||'';
          if(!sub2Map[s2]) sub2Map[s2]=[];
          sub2Map[s2].push(e);
        });
        const hasSub2=Object.keys(sub2Map).some(k=>k!=='');
        html+=`<div class="subtype-group">
          <div class="subtype-header" onclick="toggleMainSub('${escapeHtml(type)}','${escapeHtml(sub)}')">
            <div class="subtype-title">
              <span class="subtype-arrow ${sopen?'open':''}">▶</span>
              ${escapeHtml(sub)}
              <span style="font-size:11px;color:#aaa;background:#f0f0f0;padding:1px 6px;border-radius:8px">${cards.length}</span>
            </div>
          </div>`;
        if(sopen){
          if(hasSub2){
            // 无三级分类的先输出
            (sub2Map['']||[]).forEach(e=>{ html+=renderCard(e); });
            Object.entries(sub2Map).forEach(([s2,s2cards])=>{
              if(!s2) return;
              const s2k='s2:'+type+'::'+sub+'::'+s2;
              const s2open=expMainSub2.has(s2k);
              html+=`<div class="sub2-group">
                <div class="sub2-header" onclick="toggleMainSub2('${escapeHtml(type)}','${escapeHtml(sub)}','${escapeHtml(s2)}')">
                  <div class="sub2-title">
                    <span class="sub2-arrow ${s2open?'open':''}">▶</span>
                    ${escapeHtml(s2)}
                    <span style="font-size:10px;color:#bbb;background:#f5f5f5;padding:0 5px;border-radius:5px">${s2cards.length}</span>
                  </div>
                </div>`;
              if(s2open) s2cards.forEach(e=>{ html+=renderCard(e); });
              html+='</div>';
            });
          } else {
            cards.forEach(e=>{ html+=renderCard(e); });
          }
        }
        html+='</div>';
      });
    }
    html+='</div>';
  });
  const el = document.getElementById('errorList');
  if (!el) {
    console.error('[FATAL] errorList container missing');
    return;
  }
  if(progressive && list.length > visibleList.length){
    html += `<div class="home-dashboard-card" style="margin:16px 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="font-size:13px;color:#64748b">已渲染 ${visibleList.length} / ${list.length} 题，继续加载更多可以避免手机和 iPad 一次性卡住。</div>
        <button class="btn btn-secondary" type="button" onclick="loadMoreErrors()">继续加载 ${Math.min(ERROR_RENDER_STEP, list.length - visibleList.length)} 题</button>
      </div>
      <div id="errorListAutoPager" style="height:1px"></div>
    </div>`;
  }
  el.innerHTML = html;
  el.classList.toggle('batch-mode-on', batchMode);
  if(progressive && list.length > visibleList.length){
    attachErrorListAutoPager();
  } else {
    disconnectErrorListAutoPager();
  }
  if (typeof queueVisiblePracticeSummaryLoad === 'function') {
    queueVisiblePracticeSummaryLoad(visibleList);
  }
  if (typeof hydrateRenderedErrorCardDetails === 'function') {
    hydrateRenderedErrorCardDetails(visibleList);
  }
  if (typeof window.refreshKnowledgeWorkspaceCards === 'function') {
    window.refreshKnowledgeWorkspaceCards();
  }
  if (typeof window.refreshClaudeBankModal === 'function') {
    window.refreshClaudeBankModal();
  }
}

