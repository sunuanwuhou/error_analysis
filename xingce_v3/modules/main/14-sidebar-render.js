// ============================================================
// 侧边栏渲染
// ============================================================
const KNOWLEDGE_TREE_INITIAL_RENDER_LIMIT = 120;
const KNOWLEDGE_TREE_RENDER_STEP = 120;
let knowledgeTreeRenderLimit = KNOWLEDGE_TREE_INITIAL_RENDER_LIMIT;
let knowledgeTreeRenderStateKey = '';

function getKnowledgeTreeRenderStateKey() {
  return JSON.stringify({
    selected: String(selectedKnowledgeNodeId || ''),
    filter: String(knowledgeNodeFilter || ''),
    search: String(knowledgeTreeSearchQuery || ''),
    roots: (getKnowledgeRootNodes() || []).length,
  });
}
function resetKnowledgeTreeRenderWindow() {
  knowledgeTreeRenderLimit = KNOWLEDGE_TREE_INITIAL_RENDER_LIMIT;
}
function loadMoreKnowledgeTreeNodes() {
  knowledgeTreeRenderLimit += KNOWLEDGE_TREE_RENDER_STEP;
  renderSidebar();
}

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
    let html = `<div class="${cls} ${active ? 'active' : ''}" style="${extraStyle}" onclick="selectKnowledgeNodeFromSidebar('${displayNode.id}')">
      <span style="display:flex;align-items:center;gap:6px;min-width:0;flex:1">
        <span class="nav-arrow" style="transform:none;color:${displayNode.isLeaf ? '#d0d0d0' : '#bbb'}">${marker}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(displayNode.title)}</span>
      </span>
      <span class="nav-count">${count}</span></div>`;
    if (!displayNode.isLeaf && displayNode.children && displayNode.children.length) {
      html += renderSidebarKnowledgeTree(displayNode.children, depth + 1);
    }
    return html;
  }).join('');
}
function renderSidebarKnowledgeTreeV2(nodes, depth, renderBudget) {
  if (renderBudget && renderBudget.done) return '';
  return (nodes || []).filter(node => {
    return typeof isKnowledgeNodeVisibleBySearch !== 'function' || isKnowledgeNodeVisibleBySearch(node);
  }).map(node => {
    const displayNode = typeof getKnowledgeDisplayNode === 'function' ? getKnowledgeDisplayNode(node) : node;
    if (!displayNode) return '';
    if (displayNode.id !== node.id) return '';
    if (renderBudget && !renderBudget.done && renderBudget.used >= renderBudget.limit) {
      renderBudget.done = true;
      return '';
    }
    if (renderBudget && !renderBudget.done) {
      renderBudget.used += 1;
    }
    const active = selectedKnowledgeNodeId === displayNode.id || knowledgeNodeFilter === displayNode.id;
    const matched = typeof isKnowledgeNodeSearchMatch === 'function' && isKnowledgeNodeSearchMatch(node);
    const count = countErrorsForKnowledgeNode(displayNode.id, true);
    const cls = depth === 0 ? 'nav-item nav-type-header' : depth === 1 ? 'nav-item nav-subtype' : 'nav-item nav-sub2';
    const extraStyle = depth > 2 ? `padding-left:${60 + ((depth - 2) * 18)}px` : '';
    const hasChildren = !!(displayNode.children && displayNode.children.length);
    const expanded = hasChildren && ((typeof hasKnowledgeTreeSearch === 'function' && hasKnowledgeTreeSearch()) || isKnowledgeExpanded(displayNode));
    const marker = hasChildren ? (expanded ? '▾' : '▸') : '•';
    const countClass = count > 0 ? 'knowledge-tree-count' : 'knowledge-tree-count is-empty';
    let html = `<div class="${cls} knowledge-tree-node ${active ? 'active is-active' : ''} ${matched ? 'is-search-match' : ''} ${hasChildren ? 'is-branch' : ''}" style="${extraStyle}" data-knowledge-node-id="${displayNode.id}" draggable="true" ondragstart="startKnowledgeNodeDrag('${displayNode.id}', event)" ondragend="endKnowledgeNodeDrag()" ondragover="allowKnowledgeDrop(event, '${displayNode.id}')" ondragleave="leaveKnowledgeDrop(event)" ondrop="handleKnowledgeDrop('${displayNode.id}', event)" onclick="handleKnowledgeNodeClick('${displayNode.id}', event)" ondblclick="handleKnowledgeNodeDoubleClick('${displayNode.id}', event)">
      <span class="knowledge-tree-row">
        <button type="button" class="knowledge-tree-toggle${hasChildren ? '' : ' placeholder'}" onclick="handleKnowledgeToggleClick('${displayNode.id}', event)" aria-label="${hasChildren ? '展开或收起' : '无下级'}">${marker}</button>
        <span class="knowledge-tree-drag-hint" title="拖拽排序">⋮⋮</span>
        <span class="knowledge-tree-title">${escapeHtml(displayNode.title)}</span>
      </span>
      <span style="display:flex;align-items:center;gap:6px;flex-shrink:0"><span class="${countClass}">${count}</span></span></div>`;
    if (hasChildren && expanded) {
      html += `<div class="knowledge-tree-children">${renderSidebarKnowledgeTreeV2(displayNode.children, depth + 1, renderBudget)}</div>`;
    }
    return html;
  }).join('');
}
function renderSidebar() {
  updateSidebar();
  ensureKnowledgeState();
  const nextTreeStateKey = getKnowledgeTreeRenderStateKey();
  if (nextTreeStateKey !== knowledgeTreeRenderStateKey) {
    knowledgeTreeRenderStateKey = nextTreeStateKey;
    resetKnowledgeTreeRenderWindow();
  }
  const renderBudget = { limit: knowledgeTreeRenderLimit, used: 0, done: false };
  let html='<div class="nav-section-title">知识树</div>';
  html += renderSidebarKnowledgeTreeV2(getKnowledgeRootNodes(), 0, renderBudget) || '<div style="color:#ccc;font-size:12px;padding:14px">暂无知识树</div>';
  if (renderBudget.done) {
    html += `<div style="padding:10px 14px 6px">
      <button type="button" class="btn btn-secondary btn-sm" style="width:100%" onclick="loadMoreKnowledgeTreeNodes()">继续加载 ${KNOWLEDGE_TREE_RENDER_STEP} 个节点</button>
    </div>`;
  }
  document.getElementById('navScroll').innerHTML=html;
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

window.loadMoreKnowledgeTreeNodes = loadMoreKnowledgeTreeNodes;
