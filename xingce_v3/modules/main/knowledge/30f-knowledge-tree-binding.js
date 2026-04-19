// ============================================================
// Knowledge tree binding and navigation
// ============================================================

function resolveErrorKnowledgeNodeId(errorItem, opts) {
  if (!errorItem) return '';
  const options = opts || {};
  const currentId = String(errorItem.noteNodeId || '').trim();
  if (currentId && getKnowledgeNodeById(currentId)) return currentId;
  const pathTitles = getEntryKnowledgePathTitles(errorItem, {
    allowLegacyPathText: true,
    fallbackTitles: [errorItem?.type || '其他', errorItem?.subtype || '未分类', errorItem?.subSubtype || '未细分']
  });
  if (!pathTitles.length) return '';
  const node = options.ensure === true
    ? ensureKnowledgePathByTitles(pathTitles)
    : getKnowledgeNodeByPathTitles(pathTitles);
  return node && node.id ? node.id : '';
}

function getErrorKnowledgePathTitles(errorItem) {
  const nodeId = resolveErrorKnowledgeNodeId(errorItem);
  if (nodeId) {
    const titles = collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId));
    if (titles.length) return titles;
  }
  return getEntryKnowledgePathTitles(errorItem, {
    allowLegacyPathText: true,
    fallbackTitles: [errorItem?.type || '其他', errorItem?.subtype || '未分类', errorItem?.subSubtype || '未细分']
  });
}

function getErrorKnowledgePathText(errorItem) {
  return getErrorKnowledgePathTitles(errorItem).join(' > ');
}

function getKnowledgeDisplayNode(node) {
  if (!node) return null;
  if (Number(node.level || 0) !== 1) return node;
  const rootAlias = typeof resolveLegacyKnowledgeRootAlias === 'function'
    ? resolveLegacyKnowledgeRootAlias(node.title)
    : '';
  if (!rootAlias || rootAlias === node.title) return node;
  if (typeof ensureKnowledgePathByTitles !== 'function') return node;
  return ensureKnowledgePathByTitles([rootAlias, String(node.title || '').trim()]) || node;
}

function resolveKnowledgeDisplayNodeId(nodeId) {
  const node = getKnowledgeNodeById(nodeId);
  const displayNode = getKnowledgeDisplayNode(node);
  return displayNode && displayNode.id ? displayNode.id : nodeId;
}

function getCurrentKnowledgeNode() {
  return selectedKnowledgeNodeId ? getKnowledgeNodeById(selectedKnowledgeNodeId) : null;
}

function syncErrorKnowledgeBindingToCurrentNode(errorItem, node) {
  if (!errorItem || !node || !node.id) return false;
  const stableTitles = collapseKnowledgePathTitles(getKnowledgePathTitles(node.id));
  const stablePath = stableTitles.join(' > ');
  errorItem.noteNodeId = node.id;
  errorItem.knowledgePathTitles = stableTitles.slice();
  errorItem.knowledgePath = stablePath;
  errorItem.knowledgeNodePath = stablePath;
  errorItem.notePath = stablePath;
  errorItem.type = stableTitles[0] || '';
  errorItem.subtype = stableTitles[1] || '';
  errorItem.subSubtype = stableTitles[stableTitles.length - 1] || '';
  errorItem.updatedAt = new Date().toISOString();
  return true;
}

function syncMovedKnowledgeNodeErrors(nodeIds) {
  const idSet = new Set((nodeIds || []).map(id => String(id || '')).filter(Boolean));
  if (!idSet.size || !Array.isArray(errors)) return 0;
  let changed = 0;
  errors.forEach(errorItem => {
    const nodeId = String((errorItem && errorItem.noteNodeId) || '');
    if (!nodeId || !idSet.has(nodeId)) return;
    const node = getKnowledgeNodeById(nodeId);
    if (!node) return;
    if (syncErrorKnowledgeBindingToCurrentNode(errorItem, node)) changed += 1;
  });
  return changed;
}

function ensureKnowledgeBindingForError(errorItem) {
  if (!errorItem) return '';
  const currentNode = errorItem.noteNodeId ? getKnowledgeNodeById(errorItem.noteNodeId) : null;
  if (currentNode) {
    const stableTitles = collapseKnowledgePathTitles(getKnowledgePathTitles(currentNode.id));
    const stablePath = stableTitles.join(' > ');
    errorItem.knowledgePathTitles = stableTitles.slice();
    errorItem.knowledgePath = stablePath;
    errorItem.knowledgeNodePath = stablePath;
    errorItem.notePath = stablePath;
    errorItem.type = stableTitles[0] || errorItem.type || '';
    errorItem.subtype = stableTitles[1] || errorItem.subtype || '';
    errorItem.subSubtype = stableTitles[stableTitles.length - 1] || errorItem.subSubtype || '';
    return currentNode.id;
  }
  const expectedTitles = getEntryKnowledgePathTitles(errorItem, {
    allowLegacyPathText: true,
    fallbackTitles: [errorItem.type || '其他', errorItem.subtype || '未分类', errorItem.subSubtype || '未细分']
  });
  if (!expectedTitles.length) return '';
  const node = ensureKnowledgePathByTitles(expectedTitles);
  if (!node) return '';
  ensureKnowledgeNoteRecord(node);
  errorItem.noteNodeId = node.id;
  const stableTitles = collapseKnowledgePathTitles(getKnowledgePathTitles(node.id));
  const stablePath = stableTitles.join(' > ');
  errorItem.knowledgePathTitles = stableTitles.slice();
  errorItem.knowledgePath = stablePath;
  errorItem.knowledgeNodePath = stablePath;
  errorItem.notePath = stablePath;
  errorItem.type = stableTitles[0] || errorItem.type || '';
  errorItem.subtype = stableTitles[1] || errorItem.subtype || '';
  errorItem.subSubtype = stableTitles[stableTitles.length - 1] || errorItem.subSubtype || '';
  return node.id;
}

function resyncAllErrorKnowledgeBindings() {
  if (!Array.isArray(errors)) return 0;
  let changed = 0;
  errors.forEach(errorItem => {
    if (!errorItem) return;
    const beforeNodeId = String(errorItem.noteNodeId || '');
    const beforePath = Array.isArray(errorItem.knowledgePathTitles)
      ? errorItem.knowledgePathTitles.join(' > ')
      : String(errorItem.knowledgePath || '');
    const afterNodeId = ensureKnowledgeBindingForError(errorItem);
    const afterPath = Array.isArray(errorItem.knowledgePathTitles)
      ? errorItem.knowledgePathTitles.join(' > ')
      : String(errorItem.knowledgePath || '');
    if (String(afterNodeId || '') !== beforeNodeId || afterPath !== beforePath) changed += 1;
  });
  return changed;
}

function resolveKnowledgeNodeIdForSave(pathTitles) {
  const normalizedPathTitles = normalizeKnowledgePathTitles(pathTitles);
  const select = document.getElementById('editKnowledgeLeaf');
  const selectedId = select ? select.value : '';
  const selectedNode = selectedId ? getKnowledgeNodeById(selectedId) : null;
  if (selectedNode && doesKnowledgeNodeMatchPathTitles(selectedNode.id, normalizedPathTitles)) {
    ensureKnowledgeNoteRecord(selectedNode);
    selectedKnowledgeNodeId = selectedNode.id;
    return selectedNode.id;
  }
  const targetNode = ensureKnowledgePathByTitles(normalizedPathTitles);
  if (!targetNode) return '';
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
    if (typeof requestWorkspaceRender === 'function') {
      requestWorkspaceRender({ sidebar: true, notes: true, immediate: true });
    } else {
      renderSidebar();
      renderAll();
      renderNotesByType();
    }
  }
}

function filterByKnowledgeNode(nodeId) {
  setCurrentKnowledgeNode(nodeId, { switchTab: true });
}

function handleKnowledgeNodeClick(nodeId, event) {
  if (event) event.stopPropagation();
  selectKnowledgeNodeFromSidebar(nodeId);
}

function handleKnowledgeNodeDoubleClick(nodeId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  toggleKnowledgeExpanded(nodeId);
}

function handleKnowledgeToggleClick(nodeId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
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

function clearKnowledgeNodeFilterView() {
  knowledgeNodeFilter = null;
  if (typeof requestWorkspaceRender === 'function') {
    requestWorkspaceRender({ sidebar: true, notes: true, immediate: true });
  } else {
    renderSidebar();
    renderAll();
    renderNotesByType();
  }
  if (typeof renderNotesPanelRight === 'function') renderNotesPanelRight();
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
    if (typeof requestWorkspaceRender === 'function') {
      requestWorkspaceRender({ sidebar: false, notes: true, immediate: true });
    } else {
      if (typeof renderAll === 'function') renderAll();
      if (typeof renderNotesByType === 'function') renderNotesByType();
    }
    if (typeof renderNotesPanelRight === 'function') renderNotesPanelRight();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(attemptLocate));
    } else {
      setTimeout(attemptLocate, 32);
    }
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
  window.syncMovedKnowledgeNodeErrors = syncMovedKnowledgeNodeErrors;
  window.resolveErrorKnowledgeNodeId = resolveErrorKnowledgeNodeId;
}
