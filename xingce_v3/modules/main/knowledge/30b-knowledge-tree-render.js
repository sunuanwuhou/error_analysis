// ============================================================
// Knowledge tree render
// ============================================================

function renderDirCols() {
  const col1 = document.getElementById('dirCol1');
  col1.innerHTML = FIXED_TYPES.map(t =>
    `<div class="dir-item ${t === _dirSelType ? 'active' : ''}" onclick="dirSelType('${escapeHtml(t)}')">${escapeHtml(t)}</div>`
  ).join('');

  const subs = (_dirTree[_dirSelType] && Object.keys(_dirTree[_dirSelType])) || [];
  const col2 = document.getElementById('dirCol2');
  col2.innerHTML = subs.map(s =>
    `<div class="dir-item ${s === _dirSelSub ? 'active' : ''}" onclick="dirSelSub('${escapeHtml(s)}')">`
      + `<span>${escapeHtml(s)}</span>`
      + `<button class="dir-item-del" onclick="event.stopPropagation();dirDelSub('${escapeHtml(s)}')">?</button>`
      + `</div>`
  ).join('') || '<div style="color:#ccc;font-size:12px;padding:12px;text-align:center">' + "??????" + '</div>';

  const sub2s = (_dirSelSub && _dirTree[_dirSelType] && _dirTree[_dirSelType][_dirSelSub]) || [];
  const col3 = document.getElementById('dirCol3');
  col3.innerHTML = sub2s.map(s2 =>
    `<div class="dir-item">`
      + `<span>${escapeHtml(s2)}</span>`
      + `<button class="dir-item-del" onclick="dirDelSub2('${escapeHtml(s2)}')">?</button>`
      + `</div>`
  ).join('') || `<div style="color:#ccc;font-size:12px;padding:12px;text-align:center">${_dirSelSub ? "??????" : "????????"}</div>`;
}

function syncKnowledgePickerHint(selectedLeafId) {
  const hint = document.getElementById('editKnowledgeHint');
  if (!hint) return;
  const baseTitles = getEntryPathTitlesFromForm();
  const node = selectedLeafId ? getKnowledgeNodeById(selectedLeafId) : null;
  const activeNode = node;
  const pathTitles = activeNode ? collapseKnowledgePathTitles(getKnowledgePathTitles(activeNode.id)).join(' > ') : (baseTitles.join(' > ') || '未分类 > 未分类 > 未细分');
  hint.textContent = activeNode ? `${pathTitles}（已手动选择具体节点）` : `${pathTitles}（保存时按题目分类自动挂载）`;
}

function refreshKnowledgePicker(preferredId) {
  ensureKnowledgeState();
  const select = document.getElementById('editKnowledgeLeaf');
  if (!select) return;
  const nodes = getKnowledgeAssignableNodesForTitles(getEntryPathTitlesFromForm());
  const options = ['<option value="">默认按1-4级自动挂载</option>']
    .concat(nodes.map(node => `<option value="${node.id}">${escapeHtml(collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' > '))}</option>`));
  select.innerHTML = options.join('');
  if (preferredId && nodes.some(node => node.id === preferredId)) {
    select.value = preferredId;
  } else if (nodes.length === 1) {
    select.value = nodes[0].id;
  } else {
    select.value = '';
  }
  syncKnowledgePickerHint(select.value);
}

function renderKnowledgeNodeTargetOptions() {
  const list = document.getElementById('knowledgeNodeTargetList');
  const searchInput = document.getElementById('knowledgeNodeTargetSearch');
  if (!list || !searchInput || knowledgeNodeModalState.mode !== 'move') return;
  const keyword = searchInput.value.trim().toLowerCase();
  const filtered = getKnowledgeNodeModalTargetOptions(knowledgeNodeModalState.nodeId).filter(item => {
    if (!keyword) return true;
    return item.label.toLowerCase().includes(keyword) || item.node.title.toLowerCase().includes(keyword);
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="knowledge-move-empty">没有匹配的目标知识点</div>';
    return;
  }
  list.innerHTML = filtered.map(item => {
    const active = knowledgeNodeModalState.targetId === item.id ? ' active' : '';
    return `<div class="knowledge-move-item${active}" onclick="selectKnowledgeNodeModalTarget('${item.id}')">
      <div class="knowledge-move-item-title">${escapeHtml(item.node.title)}</div>
      <div class="knowledge-move-item-path">${escapeHtml(item.label)}</div>
    </div>`;
  }).join('');
}

function renderKnowledgeMoveOptions() {
  const list = document.getElementById('knowledgeMoveList');
  if (!list) return;
  const search = (document.getElementById('knowledgeMoveSearch')?.value || '').trim().toLowerCase();
  const options = getKnowledgePathOptions(false, null).filter(item => {
    if (!search) return true;
    return item.label.toLowerCase().includes(search) || item.node.title.toLowerCase().includes(search);
  });
  if (!options.length) {
    list.innerHTML = '<div class="knowledge-move-empty">没有匹配的知识点</div>';
    return;
  }
  list.innerHTML = options.map(item => `
    <div class="knowledge-move-item ${item.id === pendingKnowledgeMoveTargetId ? 'active' : ''}" onclick="selectKnowledgeMoveTarget('${item.id}')">
      <div class="knowledge-move-item-title">${escapeHtml(item.node.title)}</div>
      <div class="knowledge-move-item-path">${escapeHtml(item.label)}</div>
      ${item.id === getErrorKnowledgeNodeId(pendingKnowledgeMoveErrorId) ? '<div class="knowledge-move-item-current">当前挂载</div>' : ''}
    </div>
  `).join('');
}

function updateKnowledgeWorkspaceChrome(currentNode, linkedCount) {
  const titleEl = document.querySelector('.notes-header h2');
  if (titleEl) titleEl.textContent = currentNode ? `知识工作区 · ${currentNode.title}` : '知识工作区';

  const actionWrap = document.querySelector('.notes-header > div:last-child');
  if (actionWrap) {
    actionWrap.innerHTML = `
      <button class="btn btn-secondary" onclick="openGlobalSearchModal()">全局搜索</button>
      <button class="btn btn-secondary" onclick="openImportModalForCurrentKnowledge()">导入错题</button>
      <button class="btn btn-secondary" onclick="setKnowledgeRelatedMode('all');renderNotesPanelRight()">关联错题</button>
      <button class="btn btn-secondary" onclick="addKnowledgeLeafUnderSelected()">+ 新建知识点</button>
      ${currentNode ? `<button class="btn btn-secondary" onclick="renameKnowledgeNode('${currentNode.id}')">重命名</button>` : ''}
      ${currentNode && findKnowledgeParent(currentNode.id) ? `<button class="btn btn-secondary" onclick="moveKnowledgeNode('${currentNode.id}')">移动</button>` : ''}
      ${currentNode ? `<button class="btn btn-secondary" onclick="deleteKnowledgeNode('${currentNode.id}')">删除知识点</button>` : ''}
      ${currentNode ? `<button class="btn btn-secondary" onclick="clearNotes()">清空</button>` : ''}
    `;
  }

  const rightHeader = document.querySelector('.notes-panel-right-header h3');
  if (rightHeader) {
    const count = currentNode
      ? countErrorsForKnowledgeNode(currentNode.id, knowledgeRelatedMode !== 'direct')
      : 0;
    const suffix = knowledgeRelatedMode === 'direct' ? '直属' : '含下级';
    rightHeader.textContent = currentNode ? `关联错题 · ${suffix} ${count}` : '关联错题';
  }

  const rightActions = document.querySelector('.notes-panel-right-header > div:last-child');
  if (rightActions) {
    rightActions.innerHTML = `
      <button class="btn btn-sm ${knowledgeRelatedMode === 'direct' ? 'btn-primary' : 'btn-secondary'}" onclick="setKnowledgeRelatedMode('direct')" title="只看直接挂在当前节点的错题">直属</button>
      <button class="btn btn-sm ${knowledgeRelatedMode === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="setKnowledgeRelatedMode('all')" title="查看当前节点及下级节点的错题">含下级</button>
      <button class="btn btn-sm btn-secondary" onclick="clearKnowledgeNodeFilterView()" title="清除节点筛选">全部</button>
      ${currentNode ? `<button class="btn btn-sm btn-secondary" onclick="switchTab('notes')" title="查看当前知识点笔记">笔记</button>` : ''}
    `;
  }
}

function updateSubtypeOptions() {
  const type = document.getElementById('editType').value;
  const subs = getDirSubs(type);
  const existing = getExistingSubtypes().subtypes;
  const merged = Array.from(new Set([...subs, ...existing])).sort();
  const el = document.getElementById('editSubtype');
  let dl = document.getElementById('subtypeDatalist');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'subtypeDatalist'; document.body.appendChild(dl); }
  dl.innerHTML = merged.map(s => `<option value="${escapeHtml(s)}">`).join('');
  el.setAttribute('list', 'subtypeDatalist');
}

function updateSub2Options() {
  const type = document.getElementById('editType').value;
  const sub = document.getElementById('editSubtype').value.trim();
  const sub2s = getDirSub2s(type, sub);
  const existing = getExistingSubtypes().subSubtypes;
  const merged2 = Array.from(new Set([...sub2s, ...existing])).sort();
  let dl = document.getElementById('sub2Datalist');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'sub2Datalist'; document.body.appendChild(dl); }
  dl.innerHTML = merged2.map(s => `<option value="${escapeHtml(s)}">`).join('');
  document.getElementById('editSubSubtype').setAttribute('list', 'sub2Datalist');
  refreshKnowledgePicker();
}
