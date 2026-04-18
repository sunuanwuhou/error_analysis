// ============================================================
// Tab鍒囨崲涓庤仈鍔ㄥ姛鑳斤紙鍒濆鍖栧湪搴曢儴 async IIFE 涓墽琛岋級
// ============================================================

// 鑾峰彇绫诲瀷缁熻
function getTypeCounts() {
  const typeCounts = {};
  errors.forEach(e => {
    const t = e.type || '其他';
    const s = e.subtype || 'Uncategorized';
    const s2 = e.subSubtype;
    const key = `${t}|${s}|${s2 || ''}`;
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  });
  return typeCounts;
}

// 鑾峰彇鍒嗙粍鏁版嵁
function groupByType(displayData) {
  const grouped = {};
  displayData.forEach(e => {
    const key = `${e.type || 'Other'}|${e.subtype || 'Uncategorized'}|${e.subSubtype || ''}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });
  return grouped;
}

// Tab鍒囨崲鍑芥暟
function syncAppViewChrome() {
  document.body.classList.toggle('app-view-home', appView === 'home');
  document.body.classList.toggle('app-view-workspace', appView === 'workspace');
  const homeView = document.getElementById('homeView');
  const workspaceView = document.getElementById('workspaceView');
  const sidebarHomeBtn = document.getElementById('sidebarHomeBtn');
  const sidebarWorkspaceBtn = document.getElementById('sidebarWorkspaceBtn');
  if (homeView) homeView.classList.toggle('active', appView === 'home');
  if (workspaceView) workspaceView.classList.toggle('active', appView === 'workspace');
  if (sidebarHomeBtn) sidebarHomeBtn.classList.toggle('active', appView === 'home');
  if (sidebarWorkspaceBtn) sidebarWorkspaceBtn.classList.toggle('active', appView === 'workspace');
}

function switchAppView(nextView, opts) {
  appView = nextView === 'workspace' ? 'workspace' : 'home';
  syncAppViewChrome();
  if (appView === 'home') {
    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
    return;
  }
  switchTab('notes');
}

function openWorkspaceView(tabName) {
  switchAppView('workspace', { tab: 'notes' });
}

function openWorkspaceTaskView(taskMode) {
  openWorkspaceView('notes');
}

function openWorkspaceQuickAdd() {
  openWorkspaceView('notes');
  openQuickAddModal();
}

function ensureErrorsListScrollable() {
  const workspace = document.getElementById('workspaceView');
  const tabErrors = document.getElementById('tabContentErrors');
  const errorsArea = tabErrors ? tabErrors.querySelector('.errors-area') : null;
  const errorsList = document.getElementById('errorList');
  if (!workspace || !tabErrors || !errorsArea || !errorsList) return;
  workspace.style.overflow = 'hidden';
  tabErrors.style.display = 'flex';
  tabErrors.style.flexDirection = 'column';
  tabErrors.style.flex = '1';
  tabErrors.style.minHeight = '0';
  tabErrors.style.overflow = 'hidden';
  errorsArea.style.display = 'flex';
  errorsArea.style.flexDirection = 'column';
  errorsArea.style.flex = '1';
  errorsArea.style.minHeight = '0';
  errorsArea.style.overflow = 'hidden';
  const occupiedHeight = Array.from(errorsArea.children || [])
    .filter(el => el !== errorsList)
    .reduce((sum, el) => sum + (el instanceof HTMLElement ? el.offsetHeight : 0), 0);
  const fallbackTopGap = 8;
  const availableHeight = Math.max(180, (errorsArea.clientHeight || 0) - occupiedHeight - fallbackTopGap);
  errorsList.style.flex = '0 0 auto';
  errorsList.style.minHeight = '180px';
  errorsList.style.height = `${availableHeight}px`;
  errorsList.style.maxHeight = `${availableHeight}px`;
  errorsList.style.overflowY = 'auto';
  errorsList.style.overflowX = 'hidden';
  errorsList.style.touchAction = 'pan-y';
}

function switchTab(tabName) {
  const activeTab = 'notes';
  if (appView !== 'workspace') {
    appView = 'workspace';
  }
  if (typeof hasFullWorkspaceDataLoaded === 'function'
      && typeof ensureFullWorkspaceDataLoaded === 'function'
      && !hasFullWorkspaceDataLoaded()) {
    const target = document.getElementById('tabContentNotes');
    if (target) {
      target.innerHTML = '<div style="padding:24px;color:#64748b;font-size:13px;line-height:1.8">Loading the full workspace data. This usually takes only a moment.</div>';
      target.classList.add('active');
    }
    syncAppViewChrome();
    ensureFullWorkspaceDataLoaded().then(() => switchTab(activeTab));
    return;
  }
  syncAppViewChrome();
  document.body.classList.toggle('tab-errors-active', activeTab === 'errors');
  document.body.classList.toggle('tab-notes-active', activeTab === 'notes');
  const tabErrors = document.getElementById('tabErrors');
  const tabNotes = document.getElementById('tabNotes');
  const tabContentErrors = document.getElementById('tabContentErrors');
  const tabContentNotes = document.getElementById('tabContentNotes');
  if (tabErrors) tabErrors.classList.toggle('active', false);
  if (tabNotes) tabNotes.classList.toggle('active', true);
  if (tabContentErrors) tabContentErrors.classList.toggle('active', false);
  if (tabContentNotes) tabContentNotes.classList.toggle('active', true);

  renderSidebar();
  renderAll();
  renderNotesByType();
}

// Check whether a note chapter can be deleted.
function canDeleteNoteChapter(type, subtype, subSubtype) {
  const count = getErrorEntries().filter(e =>
    e.type === type &&
    e.subtype === subtype &&
    e.subSubtype === subSubtype
  ).length;

  return {
    canDelete: count === 0,
    count: count,
    message: count > 0 ? `${count} question(s) are still linked to this chapter.` : 'This chapter can be deleted'
  };
}

// Safely delete an empty note chapter.
function safeDeleteNoteChapter(type, subtype, subSubtype) {
  const chapterName = getChapterDisplayName(type, subtype, subSubtype);
  const check = canDeleteNoteChapter(type, subtype, subSubtype);

  if (!check.canDelete) {
    showToast(check.message, 'warning');
    return false;
  }

  if (confirm(`Delete note chapter "${chapterName}"?`)) {
    deleteEmptyNoteChapter(type, subtype, subSubtype);
    syncNotesWithErrors();
    renderNotesByType();
    return true;
  }

  return false;
}

// Get chapter display name.
function getChapterDisplayName(type, subtype, subSubtype) {
  const parts = [];
  if (type) parts.push(type);
  if (subtype) parts.push(subtype);
  if (subSubtype) parts.push(subSubtype);
  return parts.join(' > ');
}

// Delete an empty chapter.
function deleteEmptyNoteChapter(type, subtype, subSubtype) {
  const key = `${type}::${subtype || 'Uncategorized'}::${subSubtype || 'Uncategorized'}`;
  deleteNoteNode(key, 0);
}

// Clear the current note content.
function clearNotes() {
  if (!selectedKnowledgeNodeId) return;
  const node = getKnowledgeNodeById(selectedKnowledgeNodeId);
  if (!node) return;
  if (!confirm(`Clear the Markdown note for "${node.title}"? This cannot be undone.`)) return;
  node.contentMd = '';
  node.updatedAt = new Date().toISOString();
  saveKnowledgeState();
  renderNotesByType();
  showToast('The current knowledge note has been cleared', 'success');
}

// Filter the question list inside the notes tab.
function filterNoteErrorList() {
  const searchInput = document.getElementById('noteSearchInput');
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const list = document.getElementById('noteErrorList');
  if (!list) return;

  const filteredErrors = getErrorEntries().filter(e => {
    const text = `${e.type || ''} ${e.subtype || ''} ${e.subSubtype || ''} ${e.question || ''}`.toLowerCase();
    return text.includes(searchTerm);
  });

  list.innerHTML = filteredErrors.map(e => `
    <div class="error-card" id="card-${escapeHtml(String(e.id || ''))}" data-error-id="${escapeHtml(String(e.id || ''))}" onclick="highlightNoteChapter('${escapeHtml(e.type || '')}', '${escapeHtml(e.subtype || '')}', '${escapeHtml(e.subSubtype || '')}')">
      <div class="card-top">
        <span class="card-num">#${escapeHtml(String(e.id || ''))}</span>
      </div>
      <div class="card-question">${escapeHtml(e.question)}</div>
      <div class="card-options">${escapeHtml(e.options)}</div>
      <div class="card-actions">
        <span class="badge">绫诲瀷: ${escapeHtml(e.type || '')}</span>
        <span class="badge">瀛愮被鍨? ${escapeHtml(e.subtype || '')}</span>
        <span class="badge">缁嗗垎: ${escapeHtml(e.subSubtype || '')}</span>
      </div>
    </div>
  `).join('');
}

// 楂樹寒鍙充晶闈㈡澘涓殑瀵瑰簲绔犺妭锛堜笉鍒囨崲Tab锛?
function highlightNoteChapter(type, subtype, subSubtype) {
  // 娓呴櫎鏃ч珮浜?
  document.querySelectorAll('.note-panel-item-header').forEach(el => el.classList.remove('note-chapter-highlight'));
  if (!type) return;
  // Use index-based ids so Chinese titles do not become unstable DOM ids.
  const types = [...new Set(getErrorEntries().map(e => e.type).filter(Boolean))];
  const idx = types.indexOf(type);
  const safeId = idx >= 0 ? 'npitem_' + idx : null;
  if (!safeId) return;
  const target = document.getElementById(safeId);
  if (target) {
    const header = target.querySelector('.note-panel-item-header');
    if (header) {
      header.classList.add('note-chapter-highlight');
      header.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// 鎵嬪姩鍚屾棰樺瀷锛氭柊澧為鍨嬨€佽拷鍔犵己澶卞瓙绫诲瀷鏍囬銆佹彁绀哄鍎跨瑪璁?
function renderKnowledgeTreeHtml(nodes, depth) {
  const list = nodes || [];
  return list.map(node => {
    const count = countErrorsForKnowledgeNode(node.id, true);
    const pad = 10 + depth * 16;
    const hasChildren = !!(node.children && node.children.length);
    if (node.isLeaf) {
      const active = node.id === selectedKnowledgeNodeId;
      return `<div class="note-heading-item${active ? ' active' : ''}" style="padding-left:${pad}px;display:flex;align-items:center;justify-content:space-between" onclick="selectKnowledgeLeaf('${node.id}')">
        <span>${escapeHtml(node.title)}</span>
        <span style="font-size:10px;color:${active ? '#e74c3c' : '#aaa'}">${count}题</span>
      </div>`;
    }
    const expanded = isKnowledgeExpanded(node);
    const active = node.id === selectedKnowledgeNodeId;
    return `<div>
      <div class="note-panel-item-header${active ? ' active' : ''}" style="padding-left:${pad}px">
        <button type="button" class="knowledge-tree-toggle${hasChildren ? '' : ' placeholder'}" onclick="event.stopPropagation();" ondblclick="handleKnowledgeNodeDoubleClick('${node.id}', event)" aria-label="${hasChildren ? 'Double click to expand/collapse' : 'No children'}">${hasChildren ? (expanded ? '▼' : '▶') : '•'}</button>
        <button type="button" class="note-panel-title" style="background:none;border:none;padding:0;cursor:pointer;text-align:left" onclick="selectKnowledgeBranch('${node.id}', event)">${escapeHtml(node.title)}</button>
        <span style="font-size:11px;color:#aaa;margin-left:auto">${count}题</span>
      </div>
      ${expanded ? ((node.children && node.children.length) ? renderKnowledgeTreeHtml(node.children, depth + 1) : `<div style="padding:4px 0 8px ${pad + 16}px;color:#bbb;font-size:11px">暂无子节点</div>`) : ''}
    </div>`;
  }).join('');
}
function renderKnowledgeNotesView() {
  ensureKnowledgeState();
  const content = document.getElementById('notesContent');
  if (!content) return;
  const currentNode = getCurrentKnowledgeNode() || collectKnowledgeLeaves()[0];
  if (!currentNode) {
    content.innerHTML = '<div class="note-placeholder" style="padding:40px;text-align:center;color:#999">暂无知识点笔记，先录入错题后自动生成</div>';
    return;
  }
  selectedKnowledgeNodeId = currentNode.id;
  const pathText = collapseKnowledgePathTitles(getKnowledgePathTitles(currentNode.id)).join(' > ');
  const linkedCount = countErrorsForKnowledgeNode(currentNode.id, true);
  const childItems = (currentNode.children || []).map(child => {
    const displayChild = getKnowledgeDisplayNode(child);
    if (!displayChild) return '';
    return `<button class="btn btn-secondary btn-sm" onclick="selectKnowledgeNodeFromSidebar('${displayChild.id}')">${escapeHtml(displayChild.title)}</button>`;
  }).join('');
  const workspaceBar = `<div class="knowledge-workspace-bar">
    <div class="knowledge-workspace-meta">
      <div class="knowledge-workspace-kicker">${currentNode.isLeaf ? 'Knowledge Note' : 'Knowledge Folder'}</div>
      <div class="knowledge-workspace-title">${escapeHtml(currentNode.title)}</div>
      <div class="knowledge-workspace-path">${escapeHtml(pathText)}</div>
    </div>
    <div class="knowledge-workspace-actions">
      <button class="btn btn-secondary btn-sm" onclick="openGlobalSearchModal()">全局搜索</button>
      <button class="btn btn-secondary btn-sm" onclick="renameKnowledgeNode('${currentNode.id}')">重命名</button>
      ${findKnowledgeParent(currentNode.id) ? `<button class="btn btn-secondary btn-sm" onclick="moveKnowledgeNode('${currentNode.id}')">移动</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="addKnowledgeLeafUnderSelected()">+ 新建知识点</button>
      <button class="btn btn-secondary btn-sm" onclick="openAddModalForCurrentKnowledge()">+ 录入错题</button>
      <button class="btn btn-secondary btn-sm" onclick="openImportModalForCurrentKnowledge()">导入错题</button>
      <button class="btn btn-secondary btn-sm" onclick="deleteKnowledgeNode('${currentNode.id}')">删除节点</button>
      ${currentNode.isLeaf ? `<button class="btn btn-primary btn-sm" onclick="noteEditing=${noteEditing ? 'false' : 'true'};renderNotesByType()">${noteEditing ? '完成编辑' : '编辑笔记'}</button>` : ''}
    </div>
  </div>`;
  if (!currentNode.isLeaf) {
    content.innerHTML = `${workspaceBar}
      <div class="note-split-area">
        <div class="note-split-preview" style="width:100%">
          <div class="note-split-label">${escapeHtml(currentNode.title)}</div>
          <div class="note-preview-scroll notes-content" id="noteSplitPreview" style="padding:18px 20px">
            <p style="margin:0 0 12px;color:#666;line-height:1.8">当前节点是目录节点，不直接编辑 Markdown。关联错题会固定显示在右侧。</p>
            ${childItems ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${childItems}</div>` : '<div style="color:#bbb;font-size:12px">暂无下级知识点</div>'}
          </div>
        </div>
      </div>`;
    clearGlobalNoteTocDock();
    updateKnowledgeWorkspaceChrome(currentNode, linkedCount);
    return;
  }
  const note = knowledgeNotes[selectedKnowledgeNodeId] || { title: currentNode.title, content: '' };
  const noteAnchorPrefix = getKnowledgeNoteAnchorPrefix(currentNode.id);
  const noteHeadings = extractMdHeadings(note.content || '');
  const tocHtml = renderFloatingHeadingPanel(noteHeadings, noteAnchorPrefix);
  updateGlobalNoteTocDock(noteHeadings, noteAnchorPrefix);
  const previewHtml = note.content
    ? renderMd(note.content, { anchorPrefix: noteAnchorPrefix })
    : '<div style="color:#ccc;font-size:13px;font-style:italic;padding:20px;text-align:center">暂无笔记，点击右上角“编辑笔记”开始记录</div>';
  let bodyHtml;
  if (noteEditing) {
    bodyHtml = `
      <div class="note-split-area">
        <div class="note-split-editor">
          <div class="note-split-label">编辑
            <button onclick="saveNoteTypeContent();noteEditing=false;renderNotesByType()" style="float:right;background:#52c41a;color:#fff;border:none;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:12px">完成</button>
          </div>
          <textarea id="noteTypeTextarea" class="note-md-textarea" placeholder="# 规则总结&#10;## 易错点&#10;- ...&#10;&#10;## 行动建议&#10;- ..." oninput="liveNotePreview()">${escapeHtml(note.content || '')}</textarea>
          <div class="note-btn-bar">
            <div class="table-picker-wrap">
              <button class="btn btn-secondary btn-sm" type="button" id="tablePickerBtn" onclick="toggleTablePicker()">+ 表格</button>
              <div class="table-picker-panel" id="tablePickerPanel">
                <div class="table-picker-title">插入 Markdown 表格</div>
                <div class="table-picker-grid">
                  <label>行数<input id="tblRows" type="number" min="1" max="20" value="3"></label>
                  <label>列数<input id="tblCols" type="number" min="1" max="10" value="3"></label>
                </div>
                <div class="table-picker-actions">
                  <button class="btn btn-secondary btn-sm" type="button" onclick="document.getElementById('tablePickerPanel').style.display='none'">取消</button>
                  <button class="btn btn-primary btn-sm" type="button" onclick="insertQuickMdTable(document.getElementById('tblRows').value, document.getElementById('tblCols').value)">插入</button>
                </div>
              </div>
            </div>
            <div class="table-picker-wrap">
              <button class="btn btn-secondary btn-sm" type="button" id="tablePickerBtn" onclick="toggleTablePicker()">+ 表格</button>
              <div class="table-picker-panel" id="tablePickerPanel">
                <div class="table-picker-title">插入 Markdown 表格</div>
                <div class="table-picker-grid">
                  <label>行数<input id="tblRows" type="number" min="1" max="20" value="3"></label>
                  <label>列数<input id="tblCols" type="number" min="1" max="10" value="3"></label>
                </div>
                <div class="table-picker-actions">
                  <button class="btn btn-secondary btn-sm" type="button" onclick="document.getElementById('tablePickerPanel').style.display='none'">取消</button>
                  <button class="btn btn-primary btn-sm" type="button" onclick="insertQuickMdTable(document.getElementById('tblRows').value, document.getElementById('tblCols').value)">插入</button>
                </div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="saveNoteTypeContent()">保存</button>
            <button class="btn btn-secondary btn-sm" onclick="addKnowledgeLeafUnderSelected()">+ 新建同级节点</button>
            <button class="btn btn-secondary btn-sm" onclick="renameKnowledgeNode('${selectedKnowledgeNodeId}')">重命名</button>
            ${findKnowledgeParent(selectedKnowledgeNodeId) ? `<button class="btn btn-secondary btn-sm" onclick="moveKnowledgeNode('${selectedKnowledgeNodeId}')">移动</button>` : ''}
          </div>
        </div>
        <div class="note-split-preview">
          <div class="note-split-label">预览</div>
          <div class="note-preview-scroll notes-content" id="noteSplitPreview">${renderNotePreviewLayout(previewHtml, tocHtml)}</div>
        </div>
      </div>`;
  } else {
    bodyHtml = `
      <div class="note-split-area">
        <div class="note-split-preview" style="width:100%">
          <div class="note-split-label">${escapeHtml(currentNode.title)}
            <button onclick="noteEditing=true;renderNotesByType()" style="float:right;background:#e74c3c;color:#fff;border:none;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:12px">编辑</button>
          </div>
          <div class="note-preview-scroll notes-content" id="noteSplitPreview">${renderNotePreviewLayout(previewHtml, tocHtml)}</div>
        </div>
      </div>`;
  }
  content.innerHTML = `${workspaceBar}${bodyHtml}`;
  updateKnowledgeWorkspaceChrome(currentNode, linkedCount);
}
function getKnowledgeNoteRenderBundle(node) {
  const safeNode = node || {};
  const nodeId = String(safeNode.id || '');
  const noteContent = String(safeNode.contentMd || '');
  const updatedAt = String(safeNode.updatedAt || '');
  const cached = knowledgeNoteRenderCache.get(nodeId);
  if (cached && cached.content === noteContent && cached.updatedAt === updatedAt) {
    return cached;
  }
  const anchorPrefix = getKnowledgeNoteAnchorPrefix(nodeId);
  const headings = extractMdHeadings(noteContent);
  const bundle = {
    content: noteContent,
    updatedAt,
    anchorPrefix,
    headings,
    tocHtml: renderFloatingHeadingPanel(headings, anchorPrefix),
    previewHtml: noteContent
      ? renderMd(noteContent, { anchorPrefix })
      : '<div style="color:#c0c4cc;font-size:13px;font-style:italic;padding:18px 0">当前节点还没有笔记，直接在这里记录规则、易错点和行动建议。</div>'
  };
  knowledgeNoteRenderCache.set(nodeId, bundle);
  return bundle;
}
function renderKnowledgeNotesViewV2() {
  ensureKnowledgeState();
  const content = document.getElementById('notesContent');
  if (!content) return;
  content.classList.add('knowledge-notes-active');
  const currentNode = getCurrentKnowledgeNode() || getKnowledgeRootNodes()[0];
  if (!currentNode) {
    content.innerHTML = '<div class="note-placeholder" style="padding:40px;text-align:center;color:#999">暂无知识点笔记，先录入错题后自动生成</div>';
    return;
  }
  selectedKnowledgeNodeId = currentNode.id;
  const pathText = collapseKnowledgePathTitles(getKnowledgePathTitles(currentNode.id)).join(' > ');
  const linkedCount = countErrorsForKnowledgeNode(currentNode.id, true);
  const directCount = countErrorsForKnowledgeNode(currentNode.id, false);
  const childItems = (currentNode.children || []).map(child => {
    const childCount = countErrorsForKnowledgeNode(child.id, true);
    return `<button class="knowledge-node-pill" onclick="selectKnowledgeNodeFromSidebar('${child.id}')">
      <span>${escapeHtml(child.title)}</span>
      <span class="knowledge-node-pill-count">${childCount}题</span>
    </button>`;
  }).join('');
  const noteBundle = getKnowledgeNoteRenderBundle(currentNode);
  const noteContent = noteBundle.content;
  const noteAnchorPrefix = noteBundle.anchorPrefix;
  const noteHeadings = noteBundle.headings;
  const tocHtml = noteBundle.tocHtml;
  const previewHtml = noteBundle.previewHtml;
  const workspaceBar = `<div class="knowledge-workspace-bar">
    <div class="knowledge-workspace-meta">
      <div class="knowledge-workspace-kicker">知识点笔记</div>
      <div class="knowledge-workspace-title">${escapeHtml(currentNode.title)}</div>
      <div class="knowledge-workspace-path">${escapeHtml(pathText)} · 直属错题 ${directCount} 题 · 含下级 ${linkedCount} 题</div>
    </div>
    <div class="knowledge-workspace-actions">
      <button class="btn btn-secondary btn-sm" onclick="openGlobalSearchModal()">全局搜索</button>
      <button class="btn btn-secondary btn-sm" onclick="renameKnowledgeNode('${currentNode.id}')">重命名</button>
      ${findKnowledgeParent(currentNode.id) ? `<button class="btn btn-secondary btn-sm" onclick="moveKnowledgeNode('${currentNode.id}')">移动</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="selectedKnowledgeNodeId='${currentNode.id}';addKnowledgeLeafUnderSelected()">+ 新建下级</button>
      <button class="btn btn-secondary btn-sm" onclick="openAddModalForCurrentKnowledge()">+ 录入错题</button>
      <button class="btn btn-secondary btn-sm" onclick="openImportModalForCurrentKnowledge()">导入错题</button>
      <button class="btn btn-secondary btn-sm" onclick="deleteKnowledgeNode('${currentNode.id}')">删除节点</button>
      <button class="btn btn-primary btn-sm" onclick="noteEditing=${noteEditing ? 'false' : 'true'};renderNotesByType()">${noteEditing ? '完成编辑' : '编辑笔记'}</button>
    </div>
  </div>`;
  const summaryHtml = `${childItems ? `<div class="knowledge-children-bar">${childItems}</div>` : ''}<div class="knowledge-node-hint">当前节点本身可以写笔记，也可以继续新增下级知识点。错题既可以直接挂到当前节点，也可以拖到左侧其他节点重新挂载。</div>`;
  let bodyHtml;
  if (noteEditing) {
    bodyHtml = `
      <div class="note-split-area">
        <div class="note-split-editor">
          <div class="note-split-label">编辑
            <button onclick="saveNoteTypeContent();noteEditing=false;renderNotesByType()" style="float:right;background:#52c41a;color:#fff;border:none;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:12px">完成</button>
          </div>
          ${summaryHtml}
          <div class="table-picker-wrap" style="margin:0 0 8px">
            <button class="btn btn-secondary btn-sm" type="button" id="tablePickerBtn" onclick="toggleTablePicker()">+ 表格</button>
            <div class="table-picker-panel" id="tablePickerPanel">
              <div class="table-picker-title">插入 Markdown 表格</div>
              <div class="table-picker-grid">
                <label>行数<input id="tblRows" type="number" min="1" max="20" value="3"></label>
                <label>列数<input id="tblCols" type="number" min="1" max="10" value="3"></label>
              </div>
              <div class="table-picker-actions">
                <button class="btn btn-secondary btn-sm" type="button" onclick="document.getElementById('tablePickerPanel').style.display='none'">取消</button>
                <button class="btn btn-primary btn-sm" type="button" onclick="insertQuickMdTable(document.getElementById('tblRows').value, document.getElementById('tblCols').value)">插入</button>
              </div>
            </div>
          </div>
          <textarea id="noteTypeTextarea" class="note-md-textarea" placeholder="# 规则总结&#10;## 易错点&#10;- ...&#10;&#10;## 行动建议&#10;- ..." oninput="liveNotePreview()">${escapeHtml(noteContent)}</textarea>
          <div class="note-btn-bar">
            <button class="btn btn-primary btn-sm" onclick="saveNoteTypeContent()">保存</button>
            <button class="btn btn-secondary btn-sm" onclick="selectedKnowledgeNodeId='${currentNode.id}';addKnowledgeLeafUnderSelected()">+ 新建下级</button>
            <button class="btn btn-secondary btn-sm" onclick="openAddModalForCurrentKnowledge()">+ 录入错题</button>
            <button class="btn btn-secondary btn-sm" onclick="openImportModalForCurrentKnowledge()">导入错题</button>
            <span class="save-hint">Ctrl+S 快捷保存</span>
          </div>
        </div>
        <div class="note-split-preview">
          <div class="note-split-label">预览</div>
          <div class="note-preview-scroll notes-content" id="noteSplitPreview">${renderNotePreviewLayout(previewHtml, tocHtml)}</div>
        </div>
      </div>`;
  } else {
    bodyHtml = `
      <div class="note-split-area">
        <div class="note-split-preview" style="width:100%">
          <div class="note-split-label">当前笔记</div>
            <div class="note-preview-scroll notes-content" id="noteSplitPreview">${summaryHtml}${renderNotePreviewLayout(previewHtml, tocHtml)}</div>
          </div>
        </div>`;
  }
  content.innerHTML = `${workspaceBar}${bodyHtml}`;
  decorateKnowledgeNotesView(content, currentNode, pathText, directCount, linkedCount, summaryHtml, noteEditing);
  updateGlobalNoteTocDock(noteHeadings, noteAnchorPrefix);
  bindNotePreviewScrollTracking(content);
  if (noteEditing) {
    const ta = content.querySelector('#noteTypeTextarea');
    if (ta) {
      ta.addEventListener('keydown', function(ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') {
          ev.preventDefault();
          saveNoteTypeContent();
        }
      });
    }
  }
  updateKnowledgeWorkspaceChrome(currentNode, linkedCount);
}
function renderNotesByType() {
  renderKnowledgeNotesViewV2();
}

// Update the note preview panel in real time.
// Show or hide the Markdown table picker.
function toggleTablePicker() {
  const panel = document.getElementById('tablePickerPanel');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : '';
  if (!visible) {
    // Close the picker when clicking outside of it.
    setTimeout(() => {
      const close = e => {
        if (!panel.contains(e.target) && e.target.id !== 'tablePickerBtn') {
          panel.style.display = 'none';
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 0);
  }
}

// Insert a Markdown table at the cursor.
function insertMdTable() {
  const rows = Math.min(20, Math.max(1, parseInt(document.getElementById('tblRows').value) || 3));
  const cols = Math.min(10, Math.max(1, parseInt(document.getElementById('tblCols').value) || 3));
  const ta = document.getElementById('noteTypeTextarea');
  if (!ta) return;

  // Generate a simple table template.
  const header = '| ' + Array.from({length: cols}, (_, i) => `列${i + 1}`).join(' | ') + ' |';
  const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |';
  const row = '| ' + Array(cols).fill('    ').join(' | ') + ' |';
  const table = '\n' + [header, separator, ...Array(rows).fill(row)].join('\n') + '\n';

  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.substring(0, start) + table + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + table.length;
  ta.focus();
  liveNotePreview();

  document.getElementById('tablePickerPanel').style.display = 'none';
}
function insertQuickMdTable(rows, cols) {
  const ta = document.getElementById('noteTypeTextarea');
  if (!ta) return;
  const safeRows = Math.min(20, Math.max(1, parseInt(rows, 10) || 3));
  const safeCols = Math.min(10, Math.max(1, parseInt(cols, 10) || 3));
  const header = '| ' + Array.from({ length: safeCols }, (_, i) => `Col${i + 1}`).join(' | ') + ' |';
  const separator = '| ' + Array(safeCols).fill('---').join(' | ') + ' |';
  const row = '| ' + Array(safeCols).fill('    ').join(' | ') + ' |';
  const table = '\n' + [header, separator, ...Array(safeRows).fill(row)].join('\n') + '\n';
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  ta.value = ta.value.substring(0, start) + table + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + table.length;
  ta.focus();
  liveNotePreview();
  const panel = document.getElementById('tablePickerPanel');
  if (panel) panel.style.display = 'none';
}

function liveNotePreview() {
  const ta = document.getElementById('noteTypeTextarea');
  const preview = document.getElementById('noteSplitPreview');
  if (ta && preview) {
    const anchorPrefix = getKnowledgeNoteAnchorPrefix(selectedKnowledgeNodeId);
    const liveHeadings = extractMdHeadings(ta.value);
    const tocHtml = renderFloatingHeadingPanel(liveHeadings, anchorPrefix);
    preview.innerHTML = ta.value
      ? renderNotePreviewLayout(renderMd(ta.value, { anchorPrefix }), tocHtml)
      : '<span style="color:#ccc;font-size:12px;font-style:italic">输入 Markdown 后在此预览</span>';
  }
  if (preview) {
    requestAnimationFrame(() => {
      syncActiveNoteToc(preview);
      renderMathInElement(preview);
    });
  }
  const gta = document.getElementById('globalNoteTA');
  const gpv = document.getElementById('noteEditPreview');
  if (gta && gpv) requestAnimationFrame(() => renderMathInElement(gpv));
  if (gta && gpv) gpv.innerHTML = renderMd(gta.value) || '<span style="color:#ccc;font-size:12px;font-style:italic">右侧实时预览</span>';
}

function saveNoteTypeContent() {
  const ta = document.getElementById('noteTypeTextarea');
  if (!ta) return;
  ensureKnowledgeState();
  if (!selectedKnowledgeNodeId) return;
  const node = getKnowledgeNodeById(selectedKnowledgeNodeId);
  if (!node) return;
  node.contentMd = ta.value;
  node.updatedAt = new Date().toISOString();
  saveKnowledgeState();
}

function setKnowledgeRelatedMode(mode) {
  knowledgeRelatedMode = mode === 'direct' ? 'direct' : 'all';
  renderKnowledgeNotesViewV2();
}

function renderNotesPanelTree(notesData, level) {
  // Keep this stub so older callers do not fail.
  return '';
}

// Render note tree with chapter status and actions.
function renderNotesTreeWithStatus(notesData, level = 0) {
  if (!notesData || Object.keys(notesData).length === 0) {
    return `<div class="note-placeholder">No notes yet. Use the edit button to add a summary.</div>`;
  }

  let html = '';
  for (const [key, node] of Object.entries(notesData)) {
    const hasChildren = node.children && Object.keys(node.children).length > 0;
    const isExpanded = expTypes.has(key) || level > 0;
    const indent = '  '.repeat(level);

    // Count linked questions under this chapter.
    const chapterCount = countQuestionsInChapter(key, level);
    const hasQuestions = chapterCount > 0;

    const statusClass = hasQuestions ? 'status-has-questions' : 'status-empty';
    const statusText = hasQuestions ? `${chapterCount} linked question(s)` : 'Empty chapter';

    // Render chapter row.
    html += `${indent}<div class="note-tree-item">
      <div class="note-tree-header" onclick="toggleNoteNode('${escapeHtml(key)}', ${level})">
        <div class="note-tree-arrow ${isExpanded ? 'open' : ''}">${hasChildren ? '▼' : '•'}</div>
        <div class="note-tree-title">${escapeHtml(node.title || key)}</div>
        <div class="note-tree-count ${statusClass}">${statusText}</div>
      </div>
      <div class="note-tree-content" style="display:${isExpanded ? 'block' : 'none'}">
        <div class="chapter-meta">
          <span class="status ${statusClass}">${statusText}</span>
          <span style="color:#888">Updated ${node.updatedAt || 'Not recorded'}</span>
          <div class="chapter-actions">
            <button class="btn-delete" ${hasQuestions ? 'disabled' : ''}
                    onclick="event.stopPropagation(); safeDeleteNoteChapter('${escapeHtml(key.split('::')[0])}', '${escapeHtml(key.split('::')[1] || '')}', '${escapeHtml(key.split('::')[2] || '')}')"
                    title="${hasQuestions ? 'Has linked questions' : 'Delete empty chapter'}">Delete</button>
            <button class="note-action-btn" onclick="event.stopPropagation(); editNoteNode('${escapeHtml(key)}', ${level})" title="Edit">Edit</button>
            <button class="note-action-btn" onclick="filterByNoteTitle('${escapeHtml(key.split('::')[0])}', '${escapeHtml(key.split('::')[1] || '')}', '${escapeHtml(key.split('::')[2] || '')}')" title="Filter questions">Filter</button>
          </div>
        </div>
        ${node.content ? renderMd(node.content) : '<div style="color:#aaa;font-size:12px">No content</div>'}
        ${hasChildren ? renderNotesTreeWithStatus(node.children, level + 1) : ''}
      </div>
    </div>`;
  }
  return html;
}

// Count questions under the chapter.
function countQuestionsInChapter(key, level) {
  const parts = key.split('::');
  const type = parts[0];
  const subtype = parts[1] || null;
  const subSubtype = parts[2] || null;

  return getErrorEntries().filter(e => {
    const matchType = e.type === type;
    const matchSubtype = subtype === 'Uncategorized' ? !e.subtype : e.subtype === subtype;
    const matchSubSubtype = subSubtype === 'Uncategorized' ? !e.subSubtype : e.subSubtype === subSubtype;

    if (level === 0) return matchType && matchSubtype && matchSubSubtype;
    if (level === 1) return matchType && matchSubtype;
    if (level === 2) return matchType;
    return false;
  }).length;
}

window.syncAppViewChrome = syncAppViewChrome;
window.switchAppView = switchAppView;
window.openWorkspaceView = openWorkspaceView;
window.openWorkspaceTaskView = openWorkspaceTaskView;
window.openWorkspaceQuickAdd = openWorkspaceQuickAdd;
window.switchTab = switchTab;
setTimeout(() => {
  syncAppViewChrome();
  if (appView === 'home' && typeof renderHomeDashboard === 'function') renderHomeDashboard();
}, 0);

