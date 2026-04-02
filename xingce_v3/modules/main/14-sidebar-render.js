// ============================================================
// 侧边栏渲染
// ============================================================
function renderSidebarKnowledgeTree(nodes, depth) {
  return (nodes || []).map(node => {
    const displayNode = getKnowledgeDisplayNode(node);
    if (!displayNode) return '';
    if (displayNode.id !== node.id) {
      return renderSidebarKnowledgeTree([displayNode], depth);
    }
    const active = selectedKnowledgeNodeId === displayNode.id || knowledgeNodeFilter === displayNode.id;
    const count = countErrorsForKnowledgeNode(displayNode.id, true);
    const cls = depth === 0 ? 'nav-type-header' : depth === 1 ? 'nav-subtype' : 'nav-sub2';
    const extraStyle = depth > 2 ? `padding-left:${60 + ((depth - 2) * 18)}px` : '';
    const marker = displayNode.isLeaf ? '•' : '▸';
    const actions = `<span class="knowledge-node-actions">
        <button class="note-action-btn" title="重命名" onclick="event.stopPropagation();renameKnowledgeNode('${displayNode.id}')">✎</button>
        ${depth > 0 ? `<button class="note-action-btn" title="移动" onclick="event.stopPropagation();moveKnowledgeNode('${displayNode.id}')">⇄</button>` : ''}
      </span>`;
    let html = `<div class="${cls} ${active ? 'active' : ''}" style="${extraStyle}" onclick="selectKnowledgeNodeFromSidebar('${displayNode.id}')">
      <span style="display:flex;align-items:center;gap:6px;min-width:0;flex:1">
        <span class="nav-arrow" style="transform:none;color:${displayNode.isLeaf ? '#d0d0d0' : '#bbb'}">${marker}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(displayNode.title)}</span>
      </span>
      <span class="nav-count">${count}</span>${actions}</div>`;
    if (!displayNode.isLeaf && displayNode.children && displayNode.children.length) {
      html += renderSidebarKnowledgeTree(displayNode.children, depth + 1);
    }
    return html;
  }).join('');
}
function renderSidebarKnowledgeTreeV2(nodes, depth) {
  return (nodes || []).map(node => {
    const active = selectedKnowledgeNodeId === node.id || knowledgeNodeFilter === node.id;
    const count = countErrorsForKnowledgeNode(node.id, true);
    const cls = depth === 0 ? 'nav-item nav-type-header' : depth === 1 ? 'nav-item nav-subtype' : 'nav-item nav-sub2';
    const extraStyle = depth > 2 ? `padding-left:${60 + ((depth - 2) * 18)}px` : '';
    const hasChildren = !!(node.children && node.children.length);
    const expanded = hasChildren && depth > 0 && isKnowledgeExpanded(node);
    const marker = hasChildren ? (expanded ? '▾' : '▸') : '•';
    const countClass = count > 0 ? 'knowledge-tree-count' : 'knowledge-tree-count is-empty';
    const actions = `<span class="knowledge-node-actions">
      <button class="note-action-btn" title="重命名" onclick="event.stopPropagation();renameKnowledgeNode('${node.id}')">✎</button>
      ${depth > 0 ? `<button class="note-action-btn" title="移动" onclick="event.stopPropagation();moveKnowledgeNode('${node.id}')">⇄</button>` : ''}
      <button class="note-action-btn" title="删除" onclick="event.stopPropagation();deleteKnowledgeNode('${node.id}')">✕</button>
    </span>`;
    let html = `<div class="${cls} knowledge-tree-node ${active ? 'active is-active' : ''} ${hasChildren ? 'is-branch' : ''}" style="${extraStyle}" data-knowledge-node-id="${node.id}" draggable="true" ondragstart="startKnowledgeNodeDrag('${node.id}', event)" ondragend="endKnowledgeNodeDrag()" ondragover="allowKnowledgeDrop(event, '${node.id}')" ondragleave="leaveKnowledgeDrop(event)" ondrop="handleKnowledgeDrop('${node.id}', event)" onclick="selectKnowledgeNodeFromSidebar('${node.id}')">
      <span class="knowledge-tree-row">
        <button type="button" class="knowledge-tree-toggle${hasChildren ? '' : ' placeholder'}" onclick="toggleKnowledgeExpanded('${node.id}', event)" aria-label="${hasChildren ? '切换展开' : '无下级'}">${marker}</button>
        <span class="knowledge-tree-title">${escapeHtml(node.title)}</span>
      </span>
      <span style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <span class="${countClass}">${count}</span>
        ${actions}
      </span></div>`;
    if (hasChildren && expanded) {
      html += `<div class="knowledge-tree-children">${renderSidebarKnowledgeTreeV2(node.children, depth + 1)}</div>`;
    }
    return html;
  }).join('');
}
function renderSidebar() {
  updateSidebar();
  ensureKnowledgeState();
  const errorEntries = getErrorEntries();
  const focusN    = errorEntries.filter(e=>e.status==='focus').length;
  const reviewN   = errorEntries.filter(e=>e.status==='review').length;
  const masteredN = errorEntries.filter(e=>e.status==='mastered').length;
  const statusItems = [
    {key:'all',    label:'全部题目',  dot:'#aaa',    count:errorEntries.length},
    {key:'focus',  label:'重点复习',  dot:'#e74c3c', count:focusN},
    {key:'review', label:'待复习',    dot:'#fa8c16', count:reviewN},
    {key:'mastered',label:'已掌握',   dot:'#52c41a', count:masteredN},
  ];
  let html='<div class="nav-section-title">状态</div>';
  statusItems.forEach(item=>{
    const act=statusFilter===item.key&&!typeFilter&&!knowledgeNodeFilter?'active':'';
    html+=`<div class="nav-item ${act}" onclick="setStatusFilter('${item.key}')">
      <span class="nav-label"><span class="nav-dot" style="background:${item.dot}"></span>${escapeHtml(item.label)}</span>
      <span class="nav-count">${item.count}</span></div>`;
  });
  html += `<div class="nav-item ${knowledgeNodeFilter ? '' : 'active'}" onclick="knowledgeNodeFilter=null;renderSidebar();renderAll();">
    <span class="nav-label"><span class="nav-dot" style="background:#4e8ef7"></span>全部知识点</span>
    <span class="nav-count">${collectKnowledgeNodes().length}</span></div>`;
  html+='<div class="nav-section-title" style="margin-top:4px;border-top:1px solid #eee;padding-top:8px">知识树</div>';
  html += renderSidebarKnowledgeTreeV2(getKnowledgeRootNodes(), 0) || '<div style="color:#ccc;font-size:12px;padding:14px">暂无知识树</div>';
  document.getElementById('navScroll').innerHTML=html;
  const navScroll = document.getElementById('navScroll');
  if(navScroll){
    const titles = navScroll.querySelectorAll('.nav-section-title');
    if(titles.length > 1){
      titles[0].textContent = '\u72B6\u6001';
      titles[1].textContent = '\u77E5\u8BC6\u6811';
      const statusBlock = document.createElement('div');
      statusBlock.className = 'sidebar-status-block';
      while(navScroll.firstChild && navScroll.firstChild !== titles[1]){
        statusBlock.appendChild(navScroll.firstChild);
      }
      navScroll.insertBefore(statusBlock, titles[1]);
    }
  }
  syncKnowledgeTreeSearchUi();
}
function toggleReasonSection(){
  const k='__reasonSection_CLOSED__';
  if(expTypes.has(k)) expTypes.delete(k); else expTypes.add(k);
  saveExpTypes(); renderSidebar();
}
function toggleModuleReason(mod){
  if(moduleReasonOpen.has(mod)) moduleReasonOpen.delete(mod); else moduleReasonOpen.add(mod);
  renderSidebar();
}
function toggleExpType(t){
  if(expTypes.has(t)) expTypes.delete(t); else expTypes.add(t);
  saveExpTypes(); renderSidebar();
}
