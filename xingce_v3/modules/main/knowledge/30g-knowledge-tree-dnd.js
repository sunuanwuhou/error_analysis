// ============================================================
// Knowledge tree dnd and move actions
// ============================================================

function assignErrorToKnowledgeNode(errorId, targetNodeId, opts) {
  const errorItem = errors.find(item => item.id === errorId);
  const targetNode = getKnowledgeNodeById(targetNodeId);
  if (!errorItem || !targetNode) return false;
  const previousNodeId = errorItem.noteNodeId || null;
  errorItem.noteNodeId = targetNode.id;
  errorItem.updatedAt = new Date().toISOString();
  recordErrorUpsert(errorItem);
  saveData();
  saveKnowledgeState();
  if (opts && opts.focusNode) {
    setCurrentKnowledgeNode(targetNode.id, { switchTab: false });
  } else {
    if (typeof requestWorkspaceRender === 'function') {
      requestWorkspaceRender({ sidebar: true, notes: true, immediate: true });
    } else {
      renderSidebar();
      renderAll();
      renderNotesByType();
    }
    if (typeof renderNotesPanelRight === 'function') renderNotesPanelRight();
  }
  if (!opts || !opts.silent) {
    if (previousNodeId && knowledgeNodeFilter === previousNodeId && previousNodeId !== targetNode.id) {
      showToast(`已改挂载到：${collapseKnowledgePathTitles(getKnowledgePathTitles(targetNode.id)).join(' > ')}，该题已移出原知识点视图。`, 'success');
    } else {
      showToast(`已改挂载到：${collapseKnowledgePathTitles(getKnowledgePathTitles(targetNode.id)).join(' > ')}`, 'success');
    }
  }
  return true;
}

function startKnowledgeNodeDrag(nodeId, event) {
  draggingKnowledgeNodeId = nodeId;
  draggingErrorId = null;
  if (event && event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `knowledge-node:${nodeId}`);
  }
  const el = document.querySelector(`[data-knowledge-node-id="${nodeId}"]`);
  if (el) el.classList.add('knowledge-dragging');
}

function endKnowledgeNodeDrag() {
  draggingKnowledgeNodeId = null;
  document.querySelectorAll('.knowledge-dragging').forEach(el => el.classList.remove('knowledge-dragging'));
  document.querySelectorAll('.knowledge-drop-over').forEach(el => el.classList.remove('knowledge-drop-over'));
}

function startErrorDrag(errorId, event) {
  draggingErrorId = errorId;
  draggingKnowledgeNodeId = null;
  if (event && event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `knowledge-error:${errorId}`);
  }
}

function endErrorDrag() {
  draggingErrorId = null;
  document.querySelectorAll('.knowledge-drop-over').forEach(el => el.classList.remove('knowledge-drop-over'));
}

function allowKnowledgeDrop(event, nodeId) {
  if (!draggingKnowledgeNodeId && !draggingErrorId) return;
  event.preventDefault();
  const el = document.querySelector(`[data-knowledge-node-id="${nodeId}"]`);
  if (el) el.classList.add('knowledge-drop-over');
}

function leaveKnowledgeDrop(event) {
  if (event && event.currentTarget) event.currentTarget.classList.remove('knowledge-drop-over');
}

function handleKnowledgeDrop(nodeId, event) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll('.knowledge-drop-over').forEach(el => el.classList.remove('knowledge-drop-over'));
  if (draggingKnowledgeNodeId) {
    moveKnowledgeNodeToTarget(draggingKnowledgeNodeId, nodeId);
    endKnowledgeNodeDrag();
    return;
  }
  if (draggingErrorId) {
    assignErrorToKnowledgeNode(draggingErrorId, nodeId, { focusNode: true });
    endErrorDrag();
  }
}

function moveErrorToKnowledgeNode(errorId, preferredNodeId) {
  const targetId = normalizeErrorId(errorId);
  const errorItem = findErrorById(targetId);
  if (!errorItem) return;
  pendingKnowledgeMoveErrorIds = [targetId];
  pendingKnowledgeMoveErrorId = targetId;
  pendingKnowledgeMoveTargetId = preferredNodeId || errorItem.noteNodeId || null;
  const currentText = errorItem.noteNodeId
    ? collapseKnowledgePathTitles(getKnowledgePathTitles(errorItem.noteNodeId)).join(' > ')
    : '未关联知识点';
  const currentEl = document.getElementById('knowledgeMoveCurrent');
  if (currentEl) currentEl.textContent = `当前知识点：${currentText}`;
  const search = document.getElementById('knowledgeMoveSearch');
  if (search) search.value = '';
  renderKnowledgeMoveOptions();
  openModal('knowledgeMoveModal');
}

function openBatchKnowledgeMove() {
  if (!batchSelected.size) {
    showToast('请先勾选题目', 'warning');
    return;
  }
  pendingKnowledgeMoveErrorIds = Array.from(batchSelected).map(id => normalizeErrorId(id));
  pendingKnowledgeMoveErrorId = pendingKnowledgeMoveErrorIds[0] || null;
  pendingKnowledgeMoveTargetId = pendingKnowledgeMoveErrorId ? (getErrorKnowledgeNodeId(pendingKnowledgeMoveErrorId) || null) : null;
  const currentEl = document.getElementById('knowledgeMoveCurrent');
  if (currentEl) currentEl.textContent = `已选 ${pendingKnowledgeMoveErrorIds.length} 题，确认后将统一改挂载`;
  const search = document.getElementById('knowledgeMoveSearch');
  if (search) search.value = '';
  renderKnowledgeMoveOptions();
  openModal('knowledgeMoveModal');
}

function closeKnowledgeMoveModal() {
  pendingKnowledgeMoveErrorIds = [];
  pendingKnowledgeMoveErrorId = null;
  pendingKnowledgeMoveTargetId = null;
  closeModal('knowledgeMoveModal');
}

function getErrorKnowledgeNodeId(errorId) {
  const errorItem = errors.find(item => item.id === errorId);
  return errorItem ? (errorItem.noteNodeId || null) : null;
}

function applyKnowledgeMove() {
  const targetIds = pendingKnowledgeMoveErrorIds.length
    ? pendingKnowledgeMoveErrorIds.slice()
    : (pendingKnowledgeMoveErrorId ? [pendingKnowledgeMoveErrorId] : []);
  const matched = errors.filter(item => targetIds.includes(normalizeErrorId(item.id)));
  if (!matched.length) {
    closeKnowledgeMoveModal();
    return;
  }
  if (!pendingKnowledgeMoveTargetId) {
    showToast('请选择目标知识点', 'warning');
    return;
  }
  const targetNode = getKnowledgeNodeById(pendingKnowledgeMoveTargetId);
  if (!targetNode) {
    showToast('目标知识点无效', 'error');
    return;
  }
  closeKnowledgeMoveModal();
  if (matched.length === 1) {
    assignErrorToKnowledgeNode(matched[0].id, targetNode.id, { focusNode: true });
    return;
  }
  const now = new Date().toISOString();
  matched.forEach(errorItem => {
    errorItem.noteNodeId = targetNode.id;
    errorItem.updatedAt = now;
    recordErrorUpsert(errorItem);
  });
  batchSelected.clear();
  saveData();
  saveKnowledgeState();
  if (typeof requestWorkspaceRender === 'function') {
    requestWorkspaceRender({ sidebar: true, notes: true, immediate: true });
  } else {
    renderSidebar();
    renderAll();
    renderNotesByType();
  }
  if (typeof renderNotesPanelRight === 'function') renderNotesPanelRight();
  updateBatchBar();
  showToast(`已批量改挂载 ${matched.length} 题`, 'success');
}
