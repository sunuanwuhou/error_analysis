// ============================================================
// Tab鍒囨崲涓庤仈鍔ㄥ姛鑳斤紙鍒濆鍖栧湪搴曢儴 async IIFE 涓墽琛岋級
// ============================================================



// Filter the question list inside the notes tab.
// 楂樹寒鍙充晶闈㈡澘涓殑瀵瑰簲绔犺妭锛堜笉鍒囨崲Tab锛?
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

