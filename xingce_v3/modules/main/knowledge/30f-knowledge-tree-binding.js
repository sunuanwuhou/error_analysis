// ============================================================
// Knowledge tree binding and navigation
// ============================================================

function getErrorKnowledgePathTitles(errorItem) {
  const nodeId = errorItem && errorItem.noteNodeId;
  if (nodeId) {
    const titles = collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId));
    if (titles.length) return titles;
  }
  return [errorItem?.type, errorItem?.subtype, errorItem?.subSubtype].filter(Boolean);
}

function getErrorKnowledgePathText(errorItem) {
  return getErrorKnowledgePathTitles(errorItem).join(' > ');
}

function getKnowledgeDisplayNode(node) {
  return node;
}

function resolveKnowledgeDisplayNodeId(nodeId) {
  return nodeId;
}

function getCurrentKnowledgeNode() {
  return selectedKnowledgeNodeId ? getKnowledgeNodeById(selectedKnowledgeNodeId) : null;
}

function ensureKnowledgeBindingForError(errorItem) {
  if (!errorItem) return '';
  const currentNode = errorItem.noteNodeId ? getKnowledgeNodeById(errorItem.noteNodeId) : null;
  if (currentNode && doesKnowledgeNodeMatchEntryPath(currentNode.id, errorItem.type || '', errorItem.subtype || '', errorItem.subSubtype || '')) {
    return currentNode.id;
  }
  const node = ensureKnowledgeLeaf(errorItem.type || '其他', errorItem.subtype || '未分类', errorItem.subSubtype || '', getKnowledgeLeafDefaultTitle(errorItem.type, errorItem.subtype, errorItem.subSubtype));
  ensureKnowledgeNoteRecord(node);
  errorItem.noteNodeId = node.id;
  return node.id;
}

function resolveKnowledgeNodeIdForSave(pathTitles) {
  const select = document.getElementById('editKnowledgeLeaf');
  const selectedId = select ? select.value : '';
  const selectedNode = selectedId ? getKnowledgeNodeById(selectedId) : null;
  if (selectedNode && doesKnowledgeNodeMatchPathTitles(selectedNode.id, pathTitles)) {
    ensureKnowledgeNoteRecord(selectedNode);
    selectedKnowledgeNodeId = selectedNode.id;
    return selectedNode.id;
  }
  const targetNode = ensureKnowledgePathByTitles(pathTitles);
  ensureKnowledgeNoteRecord(targetNode);
  selectedKnowledgeNodeId = targetNode.id;
  if (select) refreshKnowledgePicker(targetNode.id);
  return targetNode.id;
}

function setCurrentKnowledgeNode(nodeId, opts) {
  const options = opts || {};
  if (!nodeId) return;
  const resolvedId = resolveKnowledgeDisplayNodeId(nodeId);
  if (options.expandPath !== false) {
    expandKnowledgePath(resolvedId);
  }
  selectedKnowledgeNodeId = resolvedId;
  knowledgeNodeFilter = options.applyFilter === false ? knowledgeNodeFilter : resolvedId;
  typeFilter = null;
  noteEditing = false;
  if (options.switchTab !== false) {
    switchTab('notes');
  } else {
    renderSidebar();
    renderAll();
    renderNotesByType();
  }
}

function filterByKnowledgeNode(nodeId) {
  setCurrentKnowledgeNode(nodeId, { switchTab: true });
}

let knowledgeNodeClickTimer = null;
function clearKnowledgeNodeClickTimer() {
  if (!knowledgeNodeClickTimer) return;
  clearTimeout(knowledgeNodeClickTimer);
  knowledgeNodeClickTimer = null;
}

function handleKnowledgeNodeClick(nodeId, event) {
  if (event) event.stopPropagation();
  clearKnowledgeNodeClickTimer();
  knowledgeNodeClickTimer = setTimeout(() => {
    knowledgeNodeClickTimer = null;
    selectKnowledgeNodeFromSidebar(nodeId);
  }, 170);
}

function handleKnowledgeNodeDoubleClick(nodeId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  clearKnowledgeNodeClickTimer();
  toggleKnowledgeExpanded(nodeId);
}

function selectKnowledgeNodeFromSidebar(nodeId) {
  setCurrentKnowledgeNode(nodeId, { switchTab: true, expandPath: false });
}

function selectKnowledgeLeaf(nodeId) {
  if (!nodeId) return;
  saveNoteTypeContent();
  setCurrentKnowledgeNode(nodeId, { switchTab: false });
}

function selectKnowledgeBranch(nodeId, event) {
  if (event) event.stopPropagation();
  if (!nodeId) return;
  saveNoteTypeContent();
  setCurrentKnowledgeNode(nodeId, { switchTab: false, expandPath: false });
}

function openKnowledgeForError(errorId) {
  const errorItem = findErrorById(errorId);
  if (!errorItem || !errorItem.noteNodeId) {
    showToast('当前题目还没有关联知识点', 'warning');
    return;
  }
  setCurrentKnowledgeNode(errorItem.noteNodeId, { switchTab: true });
}

function jumpToErrorInList(errorId) {
  const targetId = normalizeErrorId(errorId);
  const errorItem = findErrorById(targetId);
  if (!errorItem) {
    showToast('未找到对应错题', 'warning');
    if (typeof openEditModal === 'function') {
      try { openEditModal(targetId); } catch (e) {}
    }
    return;
  }
  const forceOpenEditor = () => {
    if (typeof openEditModal === 'function') {
      try { openEditModal(targetId); } catch (e) {}
    }
  };
  const openWorkspaceAndLocate = () => {
    try {
      if (typeof switchAppView === 'function') switchAppView('workspace');
      if (errorItem.noteNodeId) {
        setCurrentKnowledgeNode(errorItem.noteNodeId, { switchTab: true });
      } else if (typeof switchTab === 'function') {
        switchTab('notes');
      }
    } catch (e) {
      console.warn('[jumpToErrorInList] switch workspace failed', e);
    }
    if (typeof renderAll === 'function') renderAll();
    if (typeof renderNotesPanelRight === 'function') renderNotesPanelRight();
    if (typeof renderNotesByType === 'function') renderNotesByType();
    attemptLocate();
  };
  const selectors = [
    `[data-error-id="${targetId}"]`,
    `#card-${targetId}`,
    `.notes-panel-right [data-error-id="${targetId}"]`,
    `#noteErrorList [data-error-id="${targetId}"]`
  ];
  let attempts = 0;
  const maxAttempts = 14;
  const attemptLocate = () => {
    attempts += 1;
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(forceOpenEditor, 80);
        return;
      }
    }
    if (attempts < maxAttempts) {
      setTimeout(attemptLocate, 140);
      return;
    }
    if (typeof openEditModal === 'function') {
      forceOpenEditor();
      showToast('已定位到题目编辑面板', 'success');
    } else {
      showToast('未找到对应题卡，请稍后重试', 'warning');
    }
  };
  if (typeof hasFullWorkspaceDataLoaded === 'function'
      && typeof ensureFullWorkspaceDataLoaded === 'function'
      && !hasFullWorkspaceDataLoaded()) {
    ensureFullWorkspaceDataLoaded().finally(() => setTimeout(openWorkspaceAndLocate, 60));
    return;
  }
  setTimeout(openWorkspaceAndLocate, 60);
  setTimeout(forceOpenEditor, 700);
}

if (typeof window !== 'undefined') {
  window.__mainJumpToErrorInList = jumpToErrorInList;
}
