// ============================================================
// Knowledge node modal submit/move handlers
// ============================================================
function knmMoveKnowledgeNodeToTarget(nodeId, targetId, opts, deps) {
  var d = deps || {};
  var node = d.getKnowledgeNodeById(nodeId);
  var moveToRoot = false;
  var target = moveToRoot ? null : d.getKnowledgeNodeById(targetId);
  if (!node || (!moveToRoot && !target)) return false;
  var isFixedRoot = Number(node.level || 0) === 1
    && Array.isArray(FIXED_KNOWLEDGE_ROOTS)
    && FIXED_KNOWLEDGE_ROOTS.includes(String(node.title || ""));
  if (isFixedRoot) {
    d.showToast("一级节点不支持移动", "warning");
    return false;
  }
  if (!moveToRoot && node.id === target.id) {
    d.showToast("不能移动到自己", "warning");
    return false;
  }
  if (!moveToRoot && d.isKnowledgeDescendant(node.id, target.id)) {
    d.showToast("不能移动到自己的下级节点", "error");
    return false;
  }

  var oldParent = d.findKnowledgeParent(node.id);
  var oldList = oldParent ? (oldParent.children || []) : d.getKnowledgeRootNodes();
  var idx = oldList.findIndex(function (item) { return item.id === node.id; });
  if (idx < 0) return false;
  var movedNodeIds = typeof d.getKnowledgeDescendantNodeIds === "function"
    ? d.getKnowledgeDescendantNodeIds(node).map(function (id) { return String(id || ""); })
    : [String(node.id || "")];
  var detachedNode = typeof d.detachKnowledgeNodeById === "function"
    ? d.detachKnowledgeNodeById(node.id)
    : null;
  var movingNode = detachedNode || node;
  if (oldParent) oldParent.isLeaf = !(Array.isArray(oldParent.children) && oldParent.children.length);
  if (!moveToRoot) target.children = target.children || [];
  var duplicateTarget = !moveToRoot
    ? target.children.find(function (item) { return item.id !== node.id && item.title === node.title; })
    : null;
  if (duplicateTarget && !moveToRoot) {
    var descendantIds = movedNodeIds.filter(function (id) { return id && id !== String(node.id || ""); });
    d.mergeKnowledgeNodeIntoTarget(duplicateTarget, movingNode);
    if (oldParent) oldParent.isLeaf = !(Array.isArray(oldParent.children) && oldParent.children.length);
    duplicateTarget.isLeaf = (duplicateTarget.children || []).length === 0;
    d.knowledgeExpanded.delete(movingNode.id);
    d.removeKnowledgeNoteEntry(movingNode.id);
    d.expandKnowledgePath(duplicateTarget.id);
    d.knmSyncMovedKnowledgeNodeErrors(descendantIds);
    d.saveData();
    d.saveKnowledgeState();

    if (!opts || !opts.silent) {
      d.showToast("目标位置已有同名节点，已自动合并到：" + d.toPathText(duplicateTarget.id), "success");
    }
    d.setCurrentKnowledgeNode(duplicateTarget.id, { switchTab: false });
    return true;
  }

  target.children.push(movingNode);
  target.isLeaf = false;
  d.expandKnowledgePath(target.id);
  if (oldParent) oldParent.isLeaf = !(Array.isArray(oldParent.children) && oldParent.children.length);
  d.knmSyncMovedKnowledgeNodeErrors(movedNodeIds);
  d.saveData();
  d.saveKnowledgeState();

  if (!opts || !opts.silent) {
    d.showToast("节点已移动到：" + d.toPathText(target.id), "success");
  }
  d.setCurrentKnowledgeNode(movingNode.id, { switchTab: false });
  return true;
}

function knmSubmitKnowledgeNodeModal(state, deps) {
  var d = deps || {};
  var modalState = state || {};
  if (modalState.mode === "rename") {
    var node = d.getKnowledgeNodeById(modalState.nodeId);
    if (!node) return;
    var input = document.getElementById("knowledgeNodeTitleInput");
    var nextTitle = input ? input.value : "";
    var title = d.normalizeKnowledgeTitle(nextTitle, node.title);
    if (title === node.title) {
      d.closeKnowledgeNodeModal();
      return;
    }
    var parent = d.findKnowledgeParent(node.id);
    var siblings = parent ? (parent.children || []) : d.getKnowledgeRootNodes();
    if (siblings.some(function (item) { return item.id !== node.id && item.title === title; })) {
      d.showToast("同级下已存在同名节点", "error");
      return;
    }
    node.title = title;
    node.updatedAt = new Date().toISOString();
    d.saveKnowledgeState();
    d.closeKnowledgeNodeModal();
    d.showToast("节点已重命名", "success");
    d.renderSidebar();
    d.renderNotesByType();
    d.renderNotesPanelRight();
    return;
  }

  if (modalState.mode === "move") {
    if (!modalState.targetId) {
      d.showToast("请选择目标父节点", "warning");
      return;
    }
    var moved = d.moveKnowledgeNodeToTarget(modalState.nodeId, modalState.targetId, { silent: false });
    if (moved) d.closeKnowledgeNodeModal();
    return;
  }

  var createParent = d.getKnowledgeNodeById(modalState.parentId);
  if (!createParent) return;
  var inputEl = document.getElementById("knowledgeNodeTitleInput");
  var rawTitle = inputEl ? inputEl.value : "";
  var childTitle = d.normalizeKnowledgeTitle(rawTitle, modalState.fallbackTitle || "新知识点");
  if ((createParent.children || []).some(function (item) { return item.title === childTitle; })) {
    d.showToast("同级下已存在同名节点", "error");
    return;
  }
  var child = d.ensureKnowledgeChild(createParent.children, childTitle, (createParent.level || 1) + 1, true);
  if (!child.contentMd) {
    child.contentMd = "# " + child.title + "\n\n";
    child.updatedAt = new Date().toISOString();
  }
  createParent.isLeaf = false;
  d.ensureKnowledgeNoteRecord(child);
  d.expandKnowledgePath(createParent.id);
  d.saveKnowledgeState();
  d.closeKnowledgeNodeModal();
  if (typeof modalState.afterSubmit === "function") modalState.afterSubmit(child);
  d.setCurrentKnowledgeNode(child.id, { switchTab: false });
  d.showToast("已新建知识点：" + child.title, "success");
}
