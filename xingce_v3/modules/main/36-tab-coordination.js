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
  const options = opts || {};
  switchTab(options.tab === 'notes' ? 'notes' : 'errors');
}

function openWorkspaceView(tabName) {
  switchAppView('workspace', { tab: tabName === 'notes' ? 'notes' : 'errors' });
}

function openWorkspaceTaskView(taskMode) {
  openWorkspaceView(taskMode === 'notes' ? 'notes' : 'errors');
}

function openWorkspaceQuickAdd() {
  openWorkspaceView('errors');
  openQuickAddModal();
}

function switchTab(tabName) {
  const activeTab = tabName === 'errors' ? 'errors' : 'notes';
  if (appView !== 'workspace') {
    appView = 'workspace';
  }
  if (typeof hasFullWorkspaceDataLoaded === 'function'
      && typeof ensureFullWorkspaceDataLoaded === 'function'
      && !hasFullWorkspaceDataLoaded()) {
    const target = activeTab === 'notes'
      ? document.getElementById('tabContentNotes')
      : document.getElementById('tabContentErrors');
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
  if (tabErrors) tabErrors.classList.toggle('active', activeTab === 'errors');
  if (tabNotes) tabNotes.classList.toggle('active', activeTab === 'notes');
  if (tabContentErrors) tabContentErrors.classList.toggle('active', activeTab === 'errors');
  if (tabContentNotes) tabContentNotes.classList.toggle('active', activeTab === 'notes');

  renderSidebar();
  renderAll();
  if (activeTab === 'notes') {
    renderNotesByType();
  }
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
        <button type="button" class="knowledge-tree-toggle${hasChildren ? '' : ' placeholder'}" onclick="toggleKnowledgeExpanded('${node.id}', event)" aria-label="${hasChildren ? 'Toggle' : 'No children'}">${hasChildren ? (expanded ? '▼' : '▶') : '•'}</button>
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
      <button class="btn btn-secondary btn-sm" onclick="openImportModalForCurrentKnowledge()">JSON导入</button>
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
      <button class="btn btn-secondary btn-sm" onclick="openImportModalForCurrentKnowledge()">JSON导入</button>
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
            <button class="btn btn-secondary btn-sm" onclick="openImportModalForCurrentKnowledge()">JSON导入</button>
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

function extractMdHeadings(content) {
  const headings = [];
  const lines = String(content || '').replace(/\r/g, '').split('\n');
  let headingIndex = 0;
  for (const line of lines) {
    const parsed = parseLooseNoteHeading(line);
    const m = parsed ? [line, '#'.repeat(parsed.level), parsed.text] : null;
    if (m) {
      headings.push({ level: m[1].length, text: m[2].trim(), headingIndex });
        headingIndex++;
      }
    }
  return headings;
}
function prependNodeHeading(headings, nodeTitle) {
  const title = String(nodeTitle || '').trim();
  const list = Array.isArray(headings) ? headings : [];
  if (!title) return list;
  const normalized = title.replace(/\s+/g, '');
  const first = list[0];
  if (first && String(first.text || '').replace(/\s+/g, '') === normalized) {
    return list;
  }
  return [{ level: 1, text: title, headingIndex: 0 }].concat(
    list.map(item => ({ ...item, headingIndex: Number(item.headingIndex || 0) + 1 }))
  );
}
function renderNotePreviewLayout(previewHtml, tocHtml) {
  const article = `<div class="note-preview-article-scroll"><article class="note-preview-article">${previewHtml || ''}</article></div>`;
  if (!tocHtml) {
    return `<div class="note-preview-layout note-preview-layout-no-toc">${article}</div>`;
  }
  return `<div class="note-preview-layout"><aside class="note-preview-toc">${tocHtml}</aside>${article}</div>`;
}
function renderKnowledgeWorkspaceHeader(node, pathText, directCount, linkedCount, noteEditing) {
  if (!node) return '';
  return `<div class="knowledge-workspace-meta">
      <div class="note-page-breadcrumb">${escapeHtml(pathText || '')}</div>
      <div class="knowledge-workspace-title">${escapeHtml(node.title || '')}</div>
      <div class="knowledge-page-meta">
        <span class="knowledge-page-pill">直属 ${directCount || 0}</span>
        <span class="knowledge-page-pill">含下级 ${linkedCount || 0}</span>
      </div>
    </div>
    <div class="knowledge-page-actions">
      <button class="btn btn-primary btn-sm" onclick="noteEditing=${noteEditing ? 'false' : 'true'};renderNotesByType()">${noteEditing ? '完成' : '编辑'}</button>
      <details class="note-more-menu">
        <summary class="btn btn-secondary btn-sm">更多</summary>
        <div class="note-more-menu-panel">
          <button class="btn btn-secondary btn-sm" onclick="renameKnowledgeNode('${node.id}')">重命名</button>
          ${findKnowledgeParent(node.id) ? `<button class="btn btn-secondary btn-sm" onclick="moveKnowledgeNode('${node.id}')">移动</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="selectedKnowledgeNodeId='${node.id}';addKnowledgeLeafUnderSelected()">新建下级</button>
          <button class="btn btn-secondary btn-sm" onclick="openAddModalForCurrentKnowledge()">录入题目</button>
          <button class="btn btn-secondary btn-sm" onclick="openImportModalForCurrentKnowledge()">导入 JSON</button>
          <button class="btn btn-secondary btn-sm" onclick="deleteKnowledgeNode('${node.id}')">删除节点</button>
        </div>
      </details>
    </div>`;
}
function decorateKnowledgeNotesView(contentEl, currentNode, pathText, directCount, linkedCount, summaryHtml, noteEditing) {
  if (!contentEl) return;
  const header = contentEl.querySelector('.knowledge-workspace-bar');
  if (header) {
    header.innerHTML = renderKnowledgeWorkspaceHeader(currentNode, pathText, directCount, linkedCount, noteEditing);
  }
  const splitArea = contentEl.querySelector('.note-split-area');
  if (splitArea) {
    let intro = contentEl.querySelector('.note-page-intro');
    if (!intro) {
      intro = document.createElement('div');
      intro.className = 'note-page-intro';
      splitArea.parentNode.insertBefore(intro, splitArea);
    }
    intro.innerHTML = summaryHtml || '';
    contentEl.querySelectorAll('.note-split-area .knowledge-children-bar, .note-split-area .knowledge-node-hint').forEach(node => node.remove());
  }
  contentEl.querySelectorAll('.note-split-label').forEach(label => {
    const text = (label.textContent || '').trim();
    if (!noteEditing || text.indexOf('预览') >= 0 || text.indexOf('当前笔记') >= 0) {
      label.remove();
    }
  });
}
function ensureGlobalNoteTocDock() {
  let dock = document.getElementById('globalNoteTocDock');
  if (!dock) {
    dock = document.createElement('div');
    dock.id = 'globalNoteTocDock';
    dock.className = 'global-note-toc-dock';
    document.body.appendChild(dock);
  }
  return dock;
}
function clearGlobalNoteTocDock() {
  const dock = document.getElementById('globalNoteTocDock');
  if (!dock) return;
  dock.innerHTML = '';
  dock.style.display = 'none';
}
function updateGlobalNoteTocDock(headings, anchorPrefix) {
  clearGlobalNoteTocDock();
}
function renderNoteToc(content, anchorPrefix) {
  const raw = (content || '').trim();
  if (!anchorPrefix) return '';
  if (!raw) {
    return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录</div><div class="note-toc-list"><div class="note-toc-item">当前笔记为空</div></div></div>`;
  }
  const headings = extractMdHeadings(content).filter(item => item.level >= 1 && item.level <= 4);
  if (!headings.length) {
    return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录</div><div class="note-toc-list"><div class="note-toc-item">还没有 Markdown 标题，使用 # 或 ## 添加</div></div></div>`;
  }
  const items = headings.map(item => {
    const anchorId = getNoteHeadingAnchorId(anchorPrefix, item.headingIndex);
    return `<div class="note-toc-item lv${Math.min(item.level, 4)}" onclick="jumpToRenderedAnchor('${anchorId}')">${escapeHtml(item.text)}</div>`;
  }).join('');
  return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录</div><div class="note-toc-list">${items}</div></div>`;
}
function renderNoteTocFromHeadings(headings, anchorPrefix) {
  if (!anchorPrefix) return '';
  const list = Array.isArray(headings) ? headings : [];
  if (!list.length) {
    return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录</div><div class="note-toc-list"><div class="note-toc-item">还没有 Markdown 标题，使用 # 或 ## 添加</div></div></div>`;
  }
  const items = list.map(item => {
    const anchorId = getNoteHeadingAnchorId(anchorPrefix, item.headingIndex);
    return `<div class="note-toc-item lv${Math.min(item.level, 4)}" onclick="jumpToRenderedAnchor('${anchorId}')">${escapeHtml(item.text)}</div>`;
  }).join('');
  return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录（${list.length}）</div><div class="note-toc-list">${items}</div></div>`;
}
function renderInlineHeadingPanel(headings, anchorPrefix) {
  const list = Array.isArray(headings) ? headings : [];
  if (!anchorPrefix) return '';
  if (!list.length) {
    return `<div style="margin:0 0 14px;padding:10px 12px;border:1px solid #f0e2cf;border-radius:10px;background:#fffaf3;color:#7c5a2f;font-size:12px;line-height:1.7"><strong>本页笔记目录</strong><br>还没有 Markdown 标题</div>`;
  }
  const items = list.map(item => {
    const anchorId = getNoteHeadingAnchorId(anchorPrefix, item.headingIndex);
    const pad = 8 + Math.max(0, item.level - 1) * 14;
    return `<div onclick="jumpToRenderedAnchor('${anchorId}')" style="padding:4px 8px 4px ${pad}px;border-radius:6px;cursor:pointer;color:#7c5a2f">${escapeHtml(item.text)}</div>`;
  }).join('');
  return `<div style="margin:0 0 14px;padding:10px 12px;border:1px solid #f0e2cf;border-radius:10px;background:#fffaf3;color:#7c5a2f;font-size:12px;line-height:1.7"><strong>本页笔记目录（${list.length}）</strong>${items}</div>`;
}
  function renderFloatingHeadingPanel(headings, anchorPrefix) {
    const list = Array.isArray(headings) ? headings : [];
    if (!anchorPrefix) return '';
    if (!list.length) {
      return `<div class="note-toc note-toc-floating"><div class="note-toc-title"><span>本页笔记目录</span><span>0</span></div><div class="note-toc-list"><div class="note-toc-item">还没有 Markdown 标题，使用 # 概括 或 ## 方法</div></div></div>`;
    }
    const items = list.map(item => {
      const anchorId = getNoteHeadingAnchorId(anchorPrefix, item.headingIndex);
      return `<div class="note-toc-item lv${Math.min(item.level, 4)}" data-anchor-id="${anchorId}" onclick="jumpToRenderedAnchor('${anchorId}')">${escapeHtml(item.text)}</div>`;
    }).join('');
    return `<div class="note-toc note-toc-floating"><div class="note-toc-title"><span>本页笔记目录</span><span>${list.length}</span></div><div class="note-toc-list">${items}</div></div>`;
}

function resolveCurrentErrorScope() {
  if (knowledgeNodeFilter) {
    const node = getKnowledgeNodeById(knowledgeNodeFilter);
    const nodeIds = node ? getKnowledgeDescendantNodeIds(node) : [knowledgeNodeFilter];
    return {
      label: node ? `Knowledge "${node.title}"` : 'Current knowledge scope',
      predicate: e => nodeIds.includes(e.noteNodeId)
    };
  }
  if (typeFilter) {
    if (typeFilter.level === 'type') {
      return {
        label: `Type "${typeFilter.value}"`,
        predicate: e => e.type === typeFilter.value
      };
    }
    if (typeFilter.level === 'subtype') {
      return {
        label: `Module "${typeFilter.type} / ${typeFilter.value}"`,
        predicate: e => e.type === typeFilter.type && e.subtype === typeFilter.value
      };
    }
    return {
      label: `Module "${typeFilter.type} / ${typeFilter.subtype} / ${typeFilter.value}"`,
      predicate: e => e.type === typeFilter.type && e.subtype === typeFilter.subtype && e.subSubtype === typeFilter.value
    };
  }
  if (selectedKnowledgeNodeId) {
    const node = getKnowledgeNodeById(selectedKnowledgeNodeId);
    const nodeIds = node ? getKnowledgeDescendantNodeIds(node) : [selectedKnowledgeNodeId];
    return {
      label: node ? `Knowledge "${node.title}"` : 'Current knowledge scope',
      predicate: e => nodeIds.includes(e.noteNodeId)
    };
  }
  if (statusFilter !== 'all' || reasonFilter || searchKw || dateFrom || dateTo) {
    const ids = new Set(getFiltered().map(item => item.id));
    return {
      label: 'Current filtered result',
      predicate: e => ids.has(e.id)
    };
  }
  return null;
}

function clearCurrentModuleErrors() {
  const scope = resolveCurrentErrorScope();
  if (!scope) {
    showToast('Open a module or apply a filter before clearing', 'warning');
    return;
  }
  const matched = getErrorEntries().filter(scope.predicate);
  if (!matched.length) {
    showToast(`No questions found in ${scope.label}`, 'warning');
    return;
  }
  if (!confirm(`Delete ${matched.length} question(s) from ${scope.label}? This cannot be undone.`)) return;
  const ids = new Set(matched.map(item => item.id));
  errors = errors.filter(item => !ids.has(item.id));
  ids.forEach(id => revealed.delete(id));
  saveData();
  saveReveal();
  syncNotesWithErrors();
  renderSidebar();
  renderAll();
  renderNotesByType();
  showToast(`${matched.length} question(s) deleted from ${scope.label}`, 'success');
}

function clearAllErrorsData() {
  const errorEntries = getErrorEntries();
  if (!errorEntries.length) {
    showToast('There are no questions to delete', 'warning');
    return;
  }
  if (!confirm(`Delete all ${errorEntries.length} error question(s)? Claude items will be kept.`)) return;
  const ids = new Set(errorEntries.map(item => normalizeErrorId(item.id)));
  errors = errors.filter(item => !ids.has(normalizeErrorId(item.id)));
  revealed = new Set([...revealed].filter(id => !ids.has(normalizeErrorId(id))));
  saveData();
  saveReveal();
  syncNotesWithErrors();
  renderSidebar();
  renderAll();
  renderNotesByType();
  showToast('All error questions cleared', 'success');
}

function renderRelatedErrorOptions(options) {
  const raw = (options || '').trim();
  if (!raw) return '';
  const parts = raw.split(/\s*\|\s*/).map(item => item.trim()).filter(Boolean);
  if (!parts.length) return '';
  return `<div class="related-error-options">${parts.map(item => `<div class="related-error-option">${escapeHtml(item)}</div>`).join('')}</div>`;
}
function renderRelatedErrorMeta(label, value) {
  const text = (value || '').trim();
  if (!text) return '';
  return `<div class="related-error-meta"><strong>${escapeHtml(label)}</strong>${escapeHtml(text)}</div>`;
}
function updateKnowledgeWorkspaceChrome(currentNode) {
  const titleEl = document.querySelector('.notes-header h2');
  if (titleEl) titleEl.textContent = currentNode ? currentNode.title : 'Study Notes';
  const actionWrap = document.querySelector('.notes-header > div:last-child');
  if (actionWrap && actionWrap.innerHTML.indexOf('Global Search') === -1) {
    actionWrap.innerHTML = `<button class="btn btn-secondary" onclick="openGlobalSearchModal()">Global Search</button>` + actionWrap.innerHTML;
  }
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

// 鑾峰彇褰撳墠棰樺瀷宸叉湁鐨勫瓙绫诲瀷/涓夌骇鍒嗙被锛堜緵鑷姩琛ュ叏锛?
function getExistingSubtypes() {
  const type = document.getElementById('editType')?.value || '';
  const subtypes = [...new Set(getErrorEntries().filter(e => e.type === type).map(e => e.subtype).filter(Boolean))];
  const subtype = document.getElementById('editSubtype')?.value?.trim() || '';
  const subSubtypes = [...new Set(getErrorEntries().filter(e => e.type === type && e.subtype === subtype).map(e => e.subSubtype).filter(Boolean))];
  return { subtypes, subSubtypes };
}

function resetAIAnalyzeState() {
  aiAnalyzeBusy = false;
  aiAnalyzeResult = null;
  const statusEl = document.getElementById('aiAnalyzeStatus');
  const panelEl = document.getElementById('aiAnalyzePanel');
  const applyAllBtn = document.getElementById('aiApplyAllBtn');
  const analyzeBtn = document.getElementById('aiAnalyzeBtn');
  if (statusEl) statusEl.textContent = '';
  if (panelEl) {
    panelEl.style.display = 'none';
    panelEl.innerHTML = '';
  }
  if (applyAllBtn) applyAllBtn.style.display = 'none';
  if (analyzeBtn) {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'AI Analyze';
  }
}

function getAIFieldLabel(key) {
  return ({
    type: 'Level 1',
    subtype: 'Level 2',
    subSubtype: 'Level 3',
    rootReason: 'Root reason',
    errorReason: 'Trigger point',
    analysis: 'Correct model'
  })[key] || key;
}

function collectAIAnalyzePayload() {
  const existing = getExistingSubtypes();
  return {
    type: document.getElementById('editType').value || '',
    subtype: document.getElementById('editSubtype').value.trim(),
    subSubtype: document.getElementById('editSubSubtype').value.trim(),
    question: document.getElementById('editQuestion').value.trim(),
    options: document.getElementById('editOptions').value.trim(),
    answer: document.getElementById('editAnswer').value.trim(),
    myAnswer: document.getElementById('editMyAnswer').value.trim(),
    rootReason: document.getElementById('editRootReason').value.trim(),
    errorReason: document.getElementById('editErrorReason').value.trim(),
    analysis: document.getElementById('editAnalysis').value.trim(),
    availableSubtypes: existing.subtypes,
    availableSubSubtypes: existing.subSubtypes
  };
}

function applyAISuggestionField(key, value) {
  const val = String(value || '').trim();
  if (!val) return;
  if (key === 'type') {
    document.getElementById('editType').value = val;
    updateSubtypeOptions();
    refreshKnowledgePicker();
  } else if (key === 'subtype') {
    document.getElementById('editSubtype').value = val;
    refreshKnowledgePicker();
  } else if (key === 'subSubtype') {
    document.getElementById('editSubSubtype').value = val;
    refreshKnowledgePicker();
  } else if (key === 'rootReason') {
    document.getElementById('editRootReason').value = val;
  } else if (key === 'errorReason') {
    setReasonFormValue(val);
  } else if (key === 'analysis') {
    document.getElementById('editAnalysis').value = val;
  }
  renderAIAnalyzePanel();
}

function applyAISuggestionFieldEncoded(key, encodedValue) {
  applyAISuggestionField(key, decodeURIComponent(encodedValue || ''));
}

function applyAISuggestions() {
  if (!aiAnalyzeResult) return;
  ['type', 'subtype', 'subSubtype', 'rootReason', 'errorReason', 'analysis'].forEach(key => {
    applyAISuggestionField(key, aiAnalyzeResult[key] || '');
  });
  const statusEl = document.getElementById('aiAnalyzeStatus');
  if (statusEl) statusEl.textContent = 'AI suggestions applied';
}

function copyAIAnalyzeJson() {
  if (!aiAnalyzeResult) return;
  const text = JSON.stringify(aiAnalyzeResult, null, 2);
  const statusEl = document.getElementById('aiAnalyzeStatus');
  navigator.clipboard.writeText(text).then(() => {
    if (statusEl) statusEl.textContent = 'JSON copied';
  }).catch(() => {
    if (statusEl) statusEl.textContent = 'JSON copy failed';
  });
}

function renderAIAnalyzePanel() {
  const panelEl = document.getElementById('aiAnalyzePanel');
  const applyAllBtn = document.getElementById('aiApplyAllBtn');
  if (!panelEl || !aiAnalyzeResult) return;
  const rawJson = escapeHtml(JSON.stringify(aiAnalyzeResult, null, 2));
  panelEl.innerHTML = `
    <div style="margin-bottom:10px;padding:8px 10px;background:#fff;border:1px solid #ececec;border-radius:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="font-weight:600;color:#555">AI JSON Result</div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="copyAIAnalyzeJson()">Copy JSON</button>
      </div>
      <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.6;color:#222;background:none;border:none;padding:0">${rawJson}</pre>
    </div>
  `;
  panelEl.style.display = '';
  if (applyAllBtn) applyAllBtn.style.display = '';
}

async function analyzeEntryWithAI() {
  if (aiAnalyzeBusy) return;
  const payload = collectAIAnalyzePayload();
  if (!payload.question) {
    showToast('Please enter the question first', 'warning');
    document.getElementById('editQuestion').focus();
    return;
  }
  if (!payload.answer) {
    showToast('Please enter the correct answer first', 'warning');
    document.getElementById('editAnswer').focus();
    return;
  }
  aiAnalyzeBusy = true;
  const analyzeBtn = document.getElementById('aiAnalyzeBtn');
  const statusEl = document.getElementById('aiAnalyzeStatus');
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
  }
  if (statusEl) statusEl.textContent = 'Calling Minimax...';
  try {
    const res = await fetch('/api/ai/analyze-entry', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || 'AI analysis failed');
    aiAnalyzeResult = data.result || null;
    renderAIAnalyzePanel();
    if (statusEl) {
      const model = aiAnalyzeResult && aiAnalyzeResult.model ? ` (${aiAnalyzeResult.model})` : '';
      statusEl.textContent = 'AI analysis completed' + model;
    }
  } catch (e) {
    aiAnalyzeResult = null;
    const panelEl = document.getElementById('aiAnalyzePanel');
    const applyAllBtn = document.getElementById('aiApplyAllBtn');
    if (panelEl) {
      panelEl.style.display = 'none';
      panelEl.innerHTML = '';
    }
    if (applyAllBtn) applyAllBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = e.message || 'AI analysis failed';
    showToast(e.message || 'AI analysis failed', 'error');
  } finally {
    aiAnalyzeBusy = false;
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'AI Analyze';
    }
  }
}

// Save or update an error item.
async function saveError(){
  if (saveErrorBusy) return;
  const level1 = document.getElementById('editType').value;
  const level2 = document.getElementById('editSubtype').value.trim();
  const level3 = document.getElementById('editSubSubtype').value.trim();
  const level4 = (document.getElementById('editLevel4')?.value || '').trim();
  const pathTitles = [level1, level2, level3, level4].filter(Boolean);
  const type = pathTitles[0] || '';
  const subtype = pathTitles[1] || '';
  const subSubtype = pathTitles[pathTitles.length - 1] || '';
  const question = document.getElementById('editQuestion').value.trim();
  const options = document.getElementById('editOptions').value.trim();
  const answer = document.getElementById('editAnswer').value.trim();
  const myAnswer = document.getElementById('editMyAnswer').value.trim();
  const rootReason = document.getElementById('editRootReason').value.trim();
  const errorReason = document.getElementById('editErrorReason').value.trim();
  const analysis = document.getElementById('editAnalysis').value.trim();
  const nextAction = (document.getElementById('editNextAction')?.value || '').trim();
  const mistakeType = rootReason;
  const triggerPoint = errorReason;
  const correctModel = analysis;
  const status = normalizeErrorStatusValue(document.getElementById('editStatus').value);
  const difficulty = _modalDiff || 0;
  const srcYear     = document.getElementById('editSrcYear').value;
  const srcProvince = document.getElementById('editSrcProvince').value;
  const srcOrigin   = document.getElementById('editSrcOrigin').value.trim();

  if(!question && !editImgBase64){ showToast('Question cannot be empty', 'warning'); return; }
  if(!subtype){ showToast('Level 2 cannot be empty', 'warning'); document.getElementById('editSubtype').focus(); return; }
  if(!answer){ showToast('Correct answer cannot be empty', 'warning'); document.getElementById('editAnswer').focus(); return; }
  if(!mistakeType){ showToast('Root reason cannot be empty', 'warning'); document.getElementById('editRootReason').focus(); return; }
  if(!triggerPoint){ showToast('Trigger point cannot be empty', 'warning'); document.getElementById('editErrorReason').focus(); return; }
  if(!correctModel){ showToast('Correct model cannot be empty', 'warning'); document.getElementById('editAnalysis').focus(); return; }
  setSaveErrorBusyState(true);
  try {
    const noteNodeId  = resolveKnowledgeNodeIdForSave(pathTitles);
    const knowledgePathTitles = noteNodeId && typeof getKnowledgePathTitles === 'function'
      ? collapseKnowledgePathTitles(getKnowledgePathTitles(noteNodeId))
      : pathTitles.slice();
    const knowledgePathText = knowledgePathTitles.join(' > ');
    const id = editingId ? normalizeErrorId(editingId) : null;

    // Use new image if present, keep the existing image otherwise.
    const existing = id ? findErrorById(id) : null;
    const prevImgData = existing?.imgData || null;
    const prevAnalysisImgData = existing?.analysisImgData || null;

    let imgData;
    if (editImgDeleted) {
      imgData = null;
      await unrefImageValue(prevImgData);
    } else if (editImgBase64) {
      imgData = await uploadImageValue(editImgBase64);
      if (prevImgData && prevImgData !== imgData) await unrefImageValue(prevImgData);
    } else {
      imgData = prevImgData;
    }

    let analysisImgData;
    if (editAnalysisImgDeleted) {
      analysisImgData = null;
      await unrefImageValue(prevAnalysisImgData);
    } else if (editAnalysisImgBase64) {
      analysisImgData = await uploadImageValue(editAnalysisImgBase64);
      if (prevAnalysisImgData && prevAnalysisImgData !== analysisImgData) await unrefImageValue(prevAnalysisImgData);
    } else {
      analysisImgData = prevAnalysisImgData;
    }

    let savedErrorId = '';
    const data = {
      type, subtype, subSubtype, question, options, answer, myAnswer, rootReason, errorReason, analysis, status, difficulty,
      imgData, analysisImgData, srcYear, srcProvince, srcOrigin, noteNodeId,
      mistakeType, triggerPoint, correctModel, nextAction,
      knowledgePathTitles,
      knowledgePath: knowledgePathText,
      knowledgeNodePath: knowledgePathText,
      notePath: knowledgePathText
    };
    if(existing){
      const old = existing;
      if (!old.id) old.id = newId();
      old.id = normalizeErrorId(old.id);
      const oldType = old ? old.type : null;
      Object.assign(old, data);
      normalizeErrorForWorkflow(old);
      touchErrorUpdatedAt(old);
      // 棰樺瀷鏀瑰悕 鈫?鍚屾绗旇 key
      if (oldType && oldType !== type && notesByType[oldType] !== undefined) {
        if (!notesByType[type]) notesByType[type] = notesByType[oldType];
        // 鏃?key 浠呭湪娌℃湁鍏朵粬閿欓浣跨敤鏃舵墠鍒犻櫎
        const stillUsed = errors.some(e => e.type === oldType);
        if (!stillUsed) delete notesByType[oldType];
        saveNotesByType();
      }
      recordErrorUpsert(old);
      savedErrorId = normalizeErrorId(old.id);
      showToast('Updated successfully', 'success');
    }else{
      const newErr = {
        id:newId(),
        entryKind:'error',
        addDate:today(),
        updatedAt:new Date().toISOString(),
        masteryLevel:'not_mastered',
        masteryUpdatedAt:null,
        lastPracticedAt:null,
        ...data
      };
      normalizeErrorForWorkflow(newErr);
      errors.push(newErr);
      recordErrorUpsert(newErr);
      savedErrorId = normalizeErrorId(newErr.id);
      showToast('Added successfully', 'success');
    }
    refreshWorkspaceAfterErrorMutation({ save:true, syncNotes:true, saveKnowledge:true, renderNotes:true });
    try {
      if (window.__pendingAttemptLink && typeof window.syncAttemptLinkAfterSave === 'function') {
        window.syncAttemptLinkAfterSave({
          attemptId: window.__pendingAttemptLink.attemptId || '',
          errorId: savedErrorId,
          noteNodeId,
          mistakeType,
          triggerPoint,
          correctModel,
          nextAction
        });
      }
      if (savedErrorId && typeof window.invalidatePracticeAttemptSummaries === 'function') {
        window.invalidatePracticeAttemptSummaries([savedErrorId]);
      }
    } catch (linkErr) { console.warn('attempt link sync failed', linkErr); }
    setSaveErrorBusyState(false);
    closeModal('addModal');
  } catch (e) {
    showToast(e && e.message ? e.message : 'Save failed, please try again', 'error');
  } finally {
    if (saveErrorBusy) setSaveErrorBusyState(false);
  }
}

// Delete an error item and keep linked state in sync.
function deleteError(id){
  const targetId = normalizeErrorId(id);
  if(!confirm(`Delete question #${targetId}?`))return;

  const error = findErrorById(targetId);
  if (!error) return;

  unrefImageValue(error.imgData);
  unrefImageValue(error.analysisImgData);
  unrefImageValue(getProcessImageUrl(error));
  errors = errors.filter(e => normalizeErrorId(e.id) !== targetId);
  revealed.delete(targetId);
  recordErrorDelete(targetId);
  refreshWorkspaceAfterErrorMutation({ save:true, reveal:true });

  // If a type no longer has questions, allow removing its note bucket too.
  const typeCount = getErrorEntries().filter(e => e.type === error.type).length;
  if (typeCount === 0 && notesByType[error.type]) {
    if (confirm(`"${error.type}" has no remaining questions. Delete its note bucket too?`)) {
      delete notesByType[error.type];
      saveNotesByType();
    }
  }

  refreshWorkspaceAfterErrorMutation({ save:false, syncNotes:true, renderNotes:true });
  showToast(`Question #${targetId} deleted`, 'success');
}

// Add a new error and keep related note structures ready.
function addError(data) {
  // 1. Add the error.
  errors.push({id: newId(), addDate: today(), ...data});

  // 2. Sync note structure.
  syncNotesWithErrors();

  // 3. Create note chapter if needed.
  ensureNoteChapterExists(data.type, data.subtype, data.subSubtype);

  // 4. Re-render.
  refreshWorkspaceAfterErrorMutation({ save:true, syncNotes:true, renderNotes:true });
}

// Ensure a note chapter exists.
function ensureNoteChapterExists(type, subtype, subSubtype) {
  const key = `${type}::${subtype || 'Uncategorized'}::${subSubtype || 'Uncategorized'}`;

  // Check whether it already exists.
  let node = getNoteNodeByKey(notesByType, key, 0);
  if (node) {
    return;
  }

  // Create a new note chapter.
  const newNode = {
    title: `${type} ${subtype || ''} ${subSubtype || ''}`.trim(),
    content: `## ${type} ${subtype || ''} ${subSubtype || ''}`.trim(),
    children: {},
    updatedAt: today()
  };

  // Insert into note structure.
  setNoteNodeByKey(notesByType, key, 0, newNode);
  saveNotesByType();
}

// Set a note node by key path.
function setNoteNodeByKey(notesData, key, level, node) {
  const parts = key.split('::');
  if (level >= parts.length) return;

  const currentKey = parts[level];
  if (!notesData[currentKey]) {
    notesData[currentKey] = { title: currentKey, content: '', children: {}, updatedAt: today() };
  }

  if (level === parts.length - 1) {
    // Reached the target level.
    notesData[currentKey] = node;
  } else {
    // Continue into the next level.
    setNoteNodeByKey(notesData[currentKey].children, key, level + 1, node);
  }
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

