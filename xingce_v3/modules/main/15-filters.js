// ============================================================
// 筛选
// ============================================================
function getTaskFilterLabel(mode){
  const key = String(mode || 'all');
  if (key === 'diagnose') return '待判因';
  if (key === 'review_ready') return '待复盘';
  if (key === 'retrain') return '待复训';
  return '全部任务';
}
function matchTaskFilter(errorLike, mode){
  const key = String(mode || 'all');
  if (key === 'all') return true;
  const e = typeof normalizeErrorForWorkflow === 'function' ? normalizeErrorForWorkflow({ ...(errorLike || {}) }) : (errorLike || {});
  const stage = String(e.workflowStage || '');
  if (key === 'diagnose') return stage === 'captured' || stage === 'diagnosing';
  if (key === 'review_ready') return stage === 'review_ready';
  if (key === 'retrain') return stage === 'retrain_due';
  return true;
}
function setTaskFilter(mode){
  taskFilter = ['diagnose', 'review_ready', 'retrain'].includes(String(mode || '')) ? String(mode) : 'all';
  statusFilter='all';
  typeFilter=null;
  reasonFilter=null;
  knowledgeNodeFilter=null;
  searchKw='';
  dateFrom='';
  dateTo='';
  const searchInput = document.getElementById('searchInput');
  const dateFromInput = document.getElementById('dateFrom');
  const dateToInput = document.getElementById('dateTo');
  if (searchInput) searchInput.value = '';
  if (dateFromInput) dateFromInput.value = '';
  if (dateToInput) dateToInput.value = '';
  if (typeof updateSearchClear === 'function') updateSearchClear();
  if (typeof requestWorkspaceRender === 'function') {
    requestWorkspaceRender({ sidebar: true });
  } else {
    renderSidebar();
    renderAll();
  }
}
function setStatusFilter(s){ taskFilter='all';statusFilter=s;typeFilter=null;knowledgeNodeFilter=null;if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:true }); else { renderSidebar();renderAll(); } }
function setTypeFilter(t){ taskFilter='all';typeFilter={level:'type',value:t};knowledgeNodeFilter=null;if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:true }); else { renderSidebar();renderAll(); } }
function setSubFilter(t,s){ taskFilter='all';typeFilter={level:'subtype',type:t,value:s};knowledgeNodeFilter=null;if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:true }); else { renderSidebar();renderAll(); } }
function setReasonFilter(r){ taskFilter='all';reasonFilter=(reasonFilter===r)?null:r; knowledgeNodeFilter=null; if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:true }); else { renderSidebar();renderAll(); } }

// ---- 错因表单逻辑（大类过滤 + 自由手填）----
function initReasonCatSelect(){
  const sel = document.getElementById('editReasonCat');
  if(!sel || sel.options.length > 1) return;
  REASON_GROUPS.forEach(g=>{
    const o = document.createElement('option');
    o.value = g.label;
    o.textContent = g.label;
    sel.appendChild(o);
  });
}
function rebuildReasonDatalist(cat){
  const dl = document.getElementById('editReasonDatalist');
  if(!dl) return;
  dl.innerHTML = '';
  const groups = cat ? REASON_GROUPS.filter(g=>g.label===cat) : REASON_GROUPS;
  groups.forEach(g=>{
    g.reasons.forEach(r=>{
      const o = document.createElement('option');
      o.value = r.v;
      o.label = r.d;  // 部分浏览器会显示为提示
      dl.appendChild(o);
    });
  });
}
function onReasonCatChange(){
  const cat = document.getElementById('editReasonCat').value;
  rebuildReasonDatalist(cat);
  // 切换大类后清空当前值（如果当前值不属于新大类）
  const cur = document.getElementById('editErrorReason').value.trim();
  if(cur && cat){
    const g = getReasonGroup(cur);
    if(!g || g.label !== cat) document.getElementById('editErrorReason').value = '';
  }
  updateReasonDesc();
}
function updateReasonDesc(){
  const v = document.getElementById('editErrorReason').value.trim();
  const descBox = document.getElementById('editReasonDescBox');
  if(!v){ descBox.style.display='none'; return; }
  const d = getReasonDesc(v);
  const g = getReasonGroup(v);
  if(d){
    descBox.innerHTML = (g ? `<span style="color:${g.color};font-weight:600">${escapeHtml(g.label)}</span> · ` : '') + escapeHtml(d);
    descBox.style.display = '';
  } else {
    descBox.style.display = 'none';
  }
}
function setReasonFormValue(reason){
  rebuildReasonDatalist('');   // 全量 datalist 作提示
  const inp = document.getElementById('editErrorReason');
  if(inp) inp.value = reason||'';
  updateReasonDesc();
}
function setSub2Filter(t,s,s2){
  if (typeFilter && typeFilter.level==='sub2' && typeFilter.type===t && typeFilter.subtype===s) {
    typeFilter = null;
  } else {
    typeFilter={level:'sub2',type:t,subtype:s,value:s2};
  }
  taskFilter='all';
  knowledgeNodeFilter=null;
  if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:true });
  else { renderSidebar();renderAll(); }
}
function toggleExpSubtype(t,s){
  const k='sub:'+t+'::'+s;
  if(expTypes.has(k)) expTypes.delete(k); else expTypes.add(k);
  saveExpTypes(); renderSidebar();
}
function onSearch(){
  searchKw=document.getElementById('searchInput').value.trim();
  // 高亮匹配项（可选：在菜单项中用 hl 函数高亮）
  if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:false });
  else renderAll();
}
function clearFilter(){ taskFilter='all';statusFilter='all';typeFilter=null;reasonFilter=null;knowledgeNodeFilter=null;searchKw='';dateFrom='';dateTo='';document.getElementById('searchInput').value='';document.getElementById('dateFrom').value='';document.getElementById('dateTo').value='';updateSearchClear();if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:true }); else { renderSidebar();renderAll(); } }
function getFiltered(){
  return getErrorEntries().filter(e=>{
    if(!matchTaskFilter(e, taskFilter)) return false;
    if(statusFilter!=='all' && normalizeErrorStatusValue(e.status)!==statusFilter) return false;
    if(knowledgeNodeFilter){
      const currentNode = getKnowledgeNodeById(knowledgeNodeFilter);
      const nodeIds = currentNode ? getKnowledgeDescendantNodeIds(currentNode) : [knowledgeNodeFilter];
      if(!nodeIds.includes(e.noteNodeId)) return false;
    }
    if(typeFilter){
      if(typeFilter.level==='type'&&e.type!==typeFilter.value)return false;
      if(typeFilter.level==='subtype'&&(e.type!==typeFilter.type||e.subtype!==typeFilter.value))return false;
      if(typeFilter.level==='sub2'&&(e.type!==typeFilter.type||e.subtype!==typeFilter.subtype||e.subSubtype!==typeFilter.value))return false;
    }
    if(reasonFilter && (e.rootReason||e.errorReason||'').trim() !== reasonFilter) return false;
    if(searchKw){
      const terms=searchKw.toLowerCase().split(/\s+/).filter(Boolean);
      const text=(e.question+' '+(e.options||'')+' '+(e.analysis||'')+' '+e.type+' '+(e.subtype||'')+' '+(e.subSubtype||'')+' '+(e.errorReason||'')+' '+(e.rootReason||'')+' '+(e.srcYear||'')+' '+(e.srcProvince||'')+' '+(e.srcOrigin||'')).toLowerCase();
      // 多关键词 AND 子串匹配：空格分隔多个词，每个词都必须出现在题目中
      if(!terms.every(t=>text.includes(t)))return false;
    }
    if(dateFrom && e.addDate && e.addDate < dateFrom) return false;
    if(dateTo   && e.addDate && e.addDate > dateTo)   return false;
    return true;
  });
}

window.getTaskFilterLabel = getTaskFilterLabel;
window.matchTaskFilter = matchTaskFilter;
