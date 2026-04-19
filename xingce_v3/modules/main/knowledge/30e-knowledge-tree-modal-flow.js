// ============================================================
// Knowledge tree modal flow
// ============================================================

function createKnowledgeLeafFromModal() {
  const branch = findKnowledgeBranchForModal(true);
  if (!branch) {
    showToast('请先填写至少 1级 和 2级', 'warning');
    return;
  }
  const fallback = getKnowledgeLeafDefaultTitle(
    getEntryClassificationTripleFromForm().type,
    getEntryClassificationTripleFromForm().subtype,
    getEntryClassificationTripleFromForm().subSubtype
  );
  openKnowledgeNodeModal('create-child', {
    parentId: branch.id,
    fallbackTitle: fallback,
    afterSubmit: node => refreshKnowledgePicker(node.id)
  });
}

function rerenderKnowledgeWorkspace(opts) {
  const options = opts || {};
  if (typeof requestWorkspaceRender === 'function') {
    requestWorkspaceRender({
      sidebar: options.sidebar !== false,
      notes: options.notes === true,
      immediate: options.immediate === true
    });
  } else {
    if (options.sidebar !== false && typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderAll === 'function') renderAll();
    if (options.notes === true && typeof renderNotesByType === 'function') renderNotesByType();
  }
  if (options.rightPanel === true && typeof renderNotesPanelRight === 'function') {
    renderNotesPanelRight();
  }
}

function addKnowledgeLeafUnderSelected() {
  ensureKnowledgeState();
  const current = getKnowledgeNodeById(selectedKnowledgeNodeId);
  const parent = current || findKnowledgeBranchForModal(true);
  const fallback = parent && parent.title ? `${parent.title}补充` : '新知识点';
  openKnowledgeNodeModal('create-child', { parentId: parent.id, fallbackTitle: fallback });
}

function openKnowledgeNodeModal(mode, opts) {
  ensureKnowledgeState();
  knowledgeNodeModalState = Object.assign({
    mode,
    nodeId: null,
    parentId: null,
    targetId: null,
    fallbackTitle: '',
    afterSubmit: null
  }, opts || {});
  const titleEl = document.getElementById('knowledgeNodeModalTitle');
  const subtitleEl = document.getElementById('knowledgeNodeModalSubtitle');
  const titleGroup = document.getElementById('knowledgeNodeTitleGroup');
  const titleLabel = document.getElementById('knowledgeNodeTitleLabel');
  const titleInput = document.getElementById('knowledgeNodeTitleInput');
  const targetGroup = document.getElementById('knowledgeNodeTargetGroup');
  const searchInput = document.getElementById('knowledgeNodeTargetSearch');
  if (!titleEl || !subtitleEl || !titleGroup || !titleLabel || !titleInput || !targetGroup || !searchInput) return;

  const node = knowledgeNodeModalState.nodeId ? getKnowledgeNodeById(knowledgeNodeModalState.nodeId) : null;
  const parent = knowledgeNodeModalState.parentId ? getKnowledgeNodeById(knowledgeNodeModalState.parentId) : null;

  if (mode === 'rename') {
    if (!node) return;
    titleEl.textContent = '重命名知识点';
    subtitleEl.textContent = `当前节点：${collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' > ')}`;
    titleLabel.textContent = '新的节点名称';
    titleInput.value = node ? node.title : '';
    titleGroup.style.display = '';
    targetGroup.style.display = 'none';
  } else if (mode === 'move') {
    if (!node) return;
    titleEl.textContent = '移动知识点';
    subtitleEl.textContent = `当前节点：${collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' > ')}。请选择新的父节点。`;
    titleGroup.style.display = 'none';
    targetGroup.style.display = '';
    searchInput.value = '';
    knowledgeNodeModalState.targetId = null;
    renderKnowledgeNodeTargetOptions();
  } else {
    if (!parent) return;
    titleEl.textContent = '新建下级知识点';
    subtitleEl.textContent = `父节点：${collapseKnowledgePathTitles(getKnowledgePathTitles(parent.id)).join(' > ')}`;
    titleLabel.textContent = '知识点名称';
    titleInput.value = knowledgeNodeModalState.fallbackTitle || '';
    titleGroup.style.display = '';
    targetGroup.style.display = 'none';
  }

  openModal('knowledgeNodeModal');
  setTimeout(() => {
    if (mode === 'move') searchInput.focus();
    else titleInput.focus();
    if (mode !== 'move') titleInput.select();
  }, 10);
}

function closeKnowledgeNodeModal() {
  knowledgeNodeModalState = { mode: '', nodeId: null, parentId: null, targetId: null, fallbackTitle: '' };
  closeModal('knowledgeNodeModal');
}

function handleKnowledgeNodeTitleKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitKnowledgeNodeModal();
  }
}

function submitKnowledgeNodeModal() {
  const state = knowledgeNodeModalState || {};
  if (state.mode === 'rename') {
    const node = getKnowledgeNodeById(state.nodeId);
    if (!node) return;
    const nextTitle = document.getElementById('knowledgeNodeTitleInput')?.value || '';
    const title = normalizeKnowledgeTitle(nextTitle, node.title);
    if (title === node.title) {
      closeKnowledgeNodeModal();
      return;
    }
    const parent = findKnowledgeParent(node.id);
    const siblings = parent ? (parent.children || []) : getKnowledgeRootNodes();
    if (siblings.some(item => item.id !== node.id && item.title === title)) {
      showToast('同级下已存在同名节点', 'error');
      return;
    }
    node.title = title;
    node.updatedAt = new Date().toISOString();
    saveKnowledgeState();
    closeKnowledgeNodeModal();
    showToast('节点已重命名', 'success');
    rerenderKnowledgeWorkspace({ sidebar: true, notes: true, rightPanel: true, immediate: true });
    return;
  }
  if (state.mode === 'move') {
    if (!state.targetId) {
      showToast('请选择目标父节点', 'warning');
      return;
    }
    const moved = moveKnowledgeNodeToTarget(state.nodeId, state.targetId, { silent: false });
    if (moved) closeKnowledgeNodeModal();
    return;
  }
  const parent = getKnowledgeNodeById(state.parentId);
  if (!parent) return;
  const rawTitle = document.getElementById('knowledgeNodeTitleInput')?.value || '';
  const title = normalizeKnowledgeTitle(rawTitle, state.fallbackTitle || '新知识点');
  if ((parent.children || []).some(item => item.title === title)) {
    showToast('同级下已存在同名节点', 'error');
    return;
  }
  const child = ensureKnowledgeChild(parent.children, title, (parent.level || 1) + 1, true);
  if (!child.contentMd) {
    child.contentMd = `# ${child.title}\n\n`;
    child.updatedAt = new Date().toISOString();
  }
  parent.isLeaf = false;
  ensureKnowledgeNoteRecord(child);
  expandKnowledgePath(parent.id);
  saveKnowledgeState();
  closeKnowledgeNodeModal();
  if (typeof state.afterSubmit === 'function') state.afterSubmit(child);
  setCurrentKnowledgeNode(child.id, { switchTab: false });
  showToast(`已新建知识点：${child.title}`, 'success');
}

function renameKnowledgeNode(nodeId) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return;
  openKnowledgeNodeModal('rename', { nodeId: node.id });
}

function moveKnowledgeNodeToTarget(nodeId, targetId, opts) {
  const node = getKnowledgeNodeById(nodeId);
  const target = getKnowledgeNodeById(targetId);
  if (!node || !target) return false;
  if (node.id === target.id) {
    showToast('不能移动到自己', 'warning');
    return false;
  }
  if (isKnowledgeDescendant(node.id, target.id)) {
    showToast('不能移动到自己的下级节点', 'error');
    return false;
  }
  const oldParent = findKnowledgeParent(node.id);
  if (!oldParent) {
    showToast('一级节点暂不支持移动', 'warning');
    return false;
  }
  target.children = target.children || [];
  const oldList = oldParent.children || [];
  const idx = oldList.findIndex(item => item.id === node.id);
  if (idx < 0) return false;
  const movedNodeIds = typeof getKnowledgeDescendantNodeIds === 'function'
    ? getKnowledgeDescendantNodeIds(node).map(id => String(id || ''))
    : [String(node.id || '')];
  const detachedNode = typeof detachKnowledgeNodeById === 'function'
    ? detachKnowledgeNodeById(node.id)
    : null;
  const movingNode = detachedNode || node;
  oldParent.isLeaf = !(Array.isArray(oldParent.children) && oldParent.children.length);
  const duplicateTarget = target.children.find(item => item.id !== node.id && item.title === node.title);
  if (duplicateTarget) {
    const descendantIds = movedNodeIds.filter(id => id && id !== String(node.id || ''));
    mergeKnowledgeNodeIntoTarget(duplicateTarget, movingNode);
    oldParent.isLeaf = !(Array.isArray(oldParent.children) && oldParent.children.length);
    duplicateTarget.isLeaf = (duplicateTarget.children || []).length === 0;
    knowledgeExpanded.delete(movingNode.id);
    removeKnowledgeNoteEntry(movingNode.id);
    expandKnowledgePath(duplicateTarget.id);
    if (typeof syncMovedKnowledgeNodeErrors === 'function' && descendantIds.length) {
      syncMovedKnowledgeNodeErrors(descendantIds);
    }
    saveData();
    saveKnowledgeState();
    if (!opts || !opts.silent) showToast(`目标位置已有同名节点，已自动合并到：${collapseKnowledgePathTitles(getKnowledgePathTitles(duplicateTarget.id)).join(' > ')}`, 'success');
    setCurrentKnowledgeNode(duplicateTarget.id, { switchTab: false });
    return true;
  }
  target.children.push(movingNode);
  oldParent.isLeaf = !(Array.isArray(oldParent.children) && oldParent.children.length);
  target.isLeaf = false;
  expandKnowledgePath(target.id);
  if (typeof syncMovedKnowledgeNodeErrors === 'function') {
    syncMovedKnowledgeNodeErrors(movedNodeIds);
  }
  saveData();
  saveKnowledgeState();
  if (!opts || !opts.silent) showToast(`节点已移动到：${collapseKnowledgePathTitles(getKnowledgePathTitles(target.id)).join(' > ')}`, 'success');
  setCurrentKnowledgeNode(movingNode.id, { switchTab: false });
  return true;
}

function moveKnowledgeNode(nodeId) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return;
  if (!getKnowledgeNodeModalTargetOptions(nodeId).length) {
    showToast('暂无可移动到的目标节点', 'warning');
    return;
  }
  openKnowledgeNodeModal('move', { nodeId: node.id });
}

function deleteSelectedKnowledgeNode() {
  const currentNode =
    getCurrentKnowledgeNode() ||
    (selectedKnowledgeNodeId ? getKnowledgeNodeById(selectedKnowledgeNodeId) : null) ||
    getKnowledgeRootNodes()[0];
  if (!currentNode) {
    showToast('当前没有可删除的知识点', 'warning');
    return;
  }
  deleteKnowledgeNode(currentNode.id);
}

function deleteKnowledgeNode(nodeId) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return;
  const parent = findKnowledgeParent(nodeId);
  const isRootNode = !parent;
  const roots = getKnowledgeRootNodes();
  const siblings = parent ? (parent.children || []) : roots;
  const directErrors = errors.filter(item => {
    const currentNodeId = typeof resolveErrorKnowledgeNodeId === 'function'
      ? resolveErrorKnowledgeNodeId(item)
      : String(item && item.noteNodeId || '');
    return currentNodeId === node.id;
  });
  const childCount = (node.children || []).length;
  const noteFlag = (node.contentMd || '').trim() ? '\n- 当前节点有笔记内容' : '';
  const childFlag = childCount ? `\n- 当前节点有 ${childCount} 个下级，删除后会自动提升到当前层级` : '';
  const errorFlag = directErrors.length ? `\n- 当前节点直属挂了 ${directErrors.length} 道错题，删除后会自动改挂到其他知识点或未归属` : '';
  const ok = confirm(`确认删除知识点「${node.title}」吗？${noteFlag}${childFlag}${errorFlag}\n\n此操作不可撤销。`);
  if (!ok) return;
  if (isRootNode) {
    const secondOk = confirm(`你正在删除一级知识点「${node.title}」。\n\n这会影响整组知识树结构和挂载错题，请再次确认。`);
    if (!secondOk) return;
  }
  const idx = siblings.findIndex(item => item.id === node.id);
  if (idx < 0) return;
  const promotedChildren = unwrapPromotedKnowledgeChildren(node.children || [], node.title);
  const fallbackTargetId = parent
    ? parent.id
    : (promotedChildren[0]?.id || siblings[idx - 1]?.id || siblings[idx + 1]?.id || '');
  directErrors.forEach(item => {
    if (typeof rebindErrorToKnowledgeNodeId === 'function') {
      rebindErrorToKnowledgeNodeId(item, fallbackTargetId || '');
      return;
    }
    item.noteNodeId = fallbackTargetId || '';
    item.updatedAt = new Date().toISOString();
  });
  siblings.splice(idx, 1, ...promotedChildren);
  if (parent) {
    parent.isLeaf = siblings.length === 0;
  }
  removeKnowledgeNoteEntry(node.id);
  knowledgeExpanded.delete(node.id);
  saveKnowledgeExpanded();
  if (knowledgeNodeFilter === node.id) knowledgeNodeFilter = null;
  if (selectedKnowledgeNodeId === node.id) {
    selectedKnowledgeNodeId = fallbackTargetId || promotedChildren[0]?.id || siblings[0]?.id || null;
  }
  saveData();
  saveKnowledgeState();
  rerenderKnowledgeWorkspace({ sidebar: true, notes: true, rightPanel: true, immediate: true });
  showToast(`已删除知识点：${node.title}`, 'success');
}
