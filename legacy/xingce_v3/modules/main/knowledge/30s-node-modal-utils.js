// ============================================================
// Knowledge node modal utility helpers
// ============================================================
function knmSyncErrorKnowledgeBindingToNode(errorItem, targetNode) {
  if (!errorItem || !targetNode || !targetNode.id) return false;
  var stableTitles = collapseKnowledgePathTitles(getKnowledgePathTitles(targetNode.id));
  var stablePath = stableTitles.join(" > ");
  errorItem.noteNodeId = targetNode.id;
  errorItem.knowledgePathTitles = stableTitles.slice();
  errorItem.knowledgePath = stablePath;
  errorItem.knowledgeNodePath = stablePath;
  errorItem.notePath = stablePath;
  errorItem.type = stableTitles[0] || "";
  errorItem.subtype = stableTitles[1] || "";
  errorItem.subSubtype = stableTitles[stableTitles.length - 1] || "";
  errorItem.updatedAt = new Date().toISOString();
  return true;
}

function knmSyncMovedKnowledgeNodeErrors(nodeIds) {
  var idSet = new Set((nodeIds || []).map(function (id) { return String(id || ""); }).filter(Boolean));
  if (!idSet.size || !Array.isArray(errors)) return 0;
  var changed = 0;
  errors.forEach(function (errorItem) {
    var nodeId = String((errorItem && errorItem.noteNodeId) || "");
    if (!nodeId || !idSet.has(nodeId)) return;
    var node = getKnowledgeNodeById(nodeId);
    if (!node) return;
    if (knmSyncErrorKnowledgeBindingToNode(errorItem, node)) changed += 1;
  });
  return changed;
}

function knmRerenderKnowledgeShell() {
  renderSidebar();
  renderAll();
  renderNotesByType();
  renderNotesPanelRight();
}

function knmGetKnowledgePathOptions(leafOnly, excludeNodeId) {
  var options = [];
  function walk(nodes, trail) {
    (nodes || []).forEach(function (node) {
      var currentTrail = collapseKnowledgePathTitles(trail.concat(node.title));
      var pathLabel = currentTrail.join(" > ");
      if ((!leafOnly || node.isLeaf) && node.id !== excludeNodeId) {
        options.push({ id: node.id, label: pathLabel, node: node });
      }
      if (node.children && node.children.length) {
        walk(node.children, currentTrail);
      }
    });
  }
  walk(getKnowledgeRootNodes(), []);
  return options;
}

function knmGetKnowledgeNodeModalTargetOptions(nodeId) {
  return knmGetKnowledgePathOptions(false, nodeId).filter(function (item) {
    return !isKnowledgeDescendant(nodeId, item.id);
  });
}

function knmChooseKnowledgeNodeByPrompt() {
  showToast("编号选择已退到兼容层，当前统一使用弹层搜索和拖拽。", "info");
  return null;
}
