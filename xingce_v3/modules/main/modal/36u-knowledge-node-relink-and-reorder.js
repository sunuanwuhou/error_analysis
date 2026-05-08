// ============================================================
// Knowledge node reorder + error relink handlers
// ============================================================
function knmMoveKnowledgeNodeToSiblingPosition(nodeId, targetId, mode, deps) {
  var d = deps || {};
  if (mode !== "before" && mode !== "after") return false;
  var node = d.getKnowledgeNodeById(nodeId);
  var target = d.getKnowledgeNodeById(targetId);
  if (!node || !target) return false;
  if (node.id === target.id) return false;
  if (d.isKnowledgeDescendant(node.id, target.id)) {
    d.showToast("不能拖到自己的下级节点范围", "warning");
    return false;
  }

  var oldParent = d.findKnowledgeParent(node.id);
  var newParent = d.findKnowledgeParent(target.id);
  var oldList = oldParent ? (oldParent.children || []) : d.getKnowledgeRootNodes();
  var newList = newParent ? (newParent.children || []) : d.getKnowledgeRootNodes();
  var oldIdx = oldList.findIndex(function (item) { return item.id === node.id; });
  var targetIdxInitial = newList.findIndex(function (item) { return item.id === target.id; });
  if (oldIdx < 0 || targetIdxInitial < 0) return false;
  var targetIdx = targetIdxInitial;
  var movedNodeIds = typeof d.getKnowledgeDescendantNodeIds === "function"
    ? d.getKnowledgeDescendantNodeIds(node).map(function (id) { return String(id || ""); })
    : [String(node.id || "")];
  var pathChanged = oldParent !== newParent;

  var movedNode = oldList.splice(oldIdx, 1)[0];
  if (oldParent) oldParent.isLeaf = oldList.length === 0;
  if (oldList === newList && oldIdx < targetIdx) targetIdx -= 1;

  var insertIdx = mode === "before" ? targetIdx : targetIdx + 1;
  newList.splice(insertIdx, 0, movedNode);
  if (newParent) newParent.isLeaf = false;
  movedNode.updatedAt = new Date().toISOString();

  if (pathChanged) {
    d.knmSyncMovedKnowledgeNodeErrors(movedNodeIds);
    d.saveData();
  }
  d.saveKnowledgeState();
  d.expandKnowledgePath(target.id);
  d.setCurrentKnowledgeNode(movedNode.id, { switchTab: false });
  d.showToast(mode === "before" ? "已插入到目标节点上方" : "已插入到目标节点下方", "success");
  return true;
}

function knmAssignErrorToKnowledgeNode(errorId, targetNodeId, opts, deps) {
  var d = deps || {};
  var errorItem = (d.errors || []).find(function (item) { return item.id === errorId; });
  var targetNode = d.getKnowledgeNodeById(targetNodeId);
  if (!errorItem || !targetNode) return false;

  var previousNodeId = errorItem.noteNodeId || null;
  d.knmSyncErrorKnowledgeBindingToNode(errorItem, targetNode);
  d.saveData();
  d.saveKnowledgeState();

  if (opts && opts.focusNode) {
    d.setCurrentKnowledgeNode(targetNode.id, { switchTab: false });
  } else {
    d.knmRerenderKnowledgeShell();
  }

  if (!opts || !opts.silent) {
    if (previousNodeId && d.knowledgeNodeFilter === previousNodeId && previousNodeId !== targetNode.id) {
      d.showToast("已改挂载到：" + d.toPathText(targetNode.id) + "，该题已移出原知识点视图。", "success");
    } else {
      d.showToast("已改挂载到：" + d.toPathText(targetNode.id), "success");
    }
  }
  return true;
}
