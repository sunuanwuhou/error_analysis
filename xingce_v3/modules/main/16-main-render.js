// ============================================================
// 渲染主列表
// ============================================================
function renderStats(list){
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
  } else if(statusFilter!=='all') crumb=getErrorStatusLabel(statusFilter);
  if(reasonFilter) crumb+=(crumb==='全部题目'?'':`，`)+'错因: '+reasonFilter;
  if(searchKw) crumb+=` › 搜索"${escapeHtml(searchKw)}"`;
  document.getElementById('breadcrumb').innerHTML=crumb==='全部题目'?'全部题目':
    `全部 › <span>${escapeHtml(crumb)}</span> <span style="cursor:pointer;color:#aaa;font-size:11px;margin-left:4px" onclick="clearFilter()">✕ 清除</span>`;
}

function renderAll(){
  const list=getFiltered();
  renderStats(list);
  if(!list.length){
    document.getElementById('errorList').innerHTML=`<div class="empty"><div class="emoji">${searchKw?'🔍':'📭'}</div><p>${searchKw?'未找到匹配题目':'暂无错题，点击"＋ 添加"'}</p></div>`;
    if (typeof window.refreshKnowledgeWorkspaceCards === 'function') {
      window.refreshKnowledgeWorkspaceCards();
    }
    if (typeof window.refreshClaudeBankModal === 'function') {
      window.refreshClaudeBankModal();
    }
    return;
  }
  const typeMap={};
  list.forEach(e=>{
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
  el.innerHTML = html;
  el.classList.toggle('batch-mode-on', batchMode);
  if (typeof queueVisiblePracticeSummaryLoad === 'function') {
    queueVisiblePracticeSummaryLoad(list);
  }
  if (typeof window.refreshKnowledgeWorkspaceCards === 'function') {
    window.refreshKnowledgeWorkspaceCards();
  }
  if (typeof window.refreshClaudeBankModal === 'function') {
    window.refreshClaudeBankModal();
  }
}

function toggleMain(t){ if(expMain.has(t))expMain.delete(t);else expMain.add(t);saveExpMain();renderAll(); }
function toggleMainSub(t,s){ const k='sub:'+t+'::'+s; if(expMainSub.has(k))expMainSub.delete(k);else expMainSub.add(k);saveExpMain();renderAll(); }
function toggleMainSub2(t,s,s2){ const k='s2:'+t+'::'+s+'::'+s2; if(expMainSub2.has(k))expMainSub2.delete(k);else expMainSub2.add(k);saveExpMain();renderAll(); }

function expandAll(){
  const list=getFiltered();
  const typeMap={};
  list.forEach(e=>{
    if(!typeMap[e.type])typeMap[e.type]={};
    const s=e.subtype||'未分类';
    if(!typeMap[e.type][s])typeMap[e.type][s]=new Set();
    if(e.subSubtype) typeMap[e.type][s].add(e.subSubtype);
  });
  Object.keys(typeMap).forEach(t=>{
    expMain.add(t);
    Object.keys(typeMap[t]).forEach(s=>{
      expMainSub.add('sub:'+t+'::'+s);
      typeMap[t][s].forEach(s2=>expMainSub2.add('s2:'+t+'::'+s+'::'+s2));
    });
  });
  saveExpMain();renderAll();
}
function collapseAll(){
  expMain.clear();expMainSub.clear();expMainSub2.clear();saveExpMain();renderAll();
}
