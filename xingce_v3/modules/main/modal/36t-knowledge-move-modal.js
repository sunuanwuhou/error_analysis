// ============================================================
// Knowledge move modal handlers (error -> knowledge node)
// ============================================================
function knmMoveErrorToKnowledgeNode(errorId, preferredNodeId, deps) {
  var d = deps || {};
  var errorItem = (d.errors || []).find(function (item) { return item.id === errorId; });
  if (!errorItem) return { pendingErrorId: d.pendingErrorId || null, pendingTargetId: d.pendingTargetId || null };
  var nextState = {
    pendingErrorId: errorId,
    pendingTargetId: preferredNodeId || errorItem.noteNodeId || null
  };
  var currentText = errorItem.noteNodeId
    ? d.toPathText(errorItem.noteNodeId)
    : "未关联知识点";
  var currentEl = document.getElementById("knowledgeMoveCurrent");
  if (currentEl) currentEl.textContent = "当前知识点：" + currentText;
  var search = document.getElementById("knowledgeMoveSearch");
  if (search) search.value = "";
  if (typeof d.renderKnowledgeMoveOptions === "function") d.renderKnowledgeMoveOptions();
  if (typeof d.openModal === "function") d.openModal("knowledgeMoveModal");
  return nextState;
}

function knmCloseKnowledgeMoveModal(closeModalFn) {
  if (typeof closeModalFn === "function") closeModalFn("knowledgeMoveModal");
  return { pendingErrorId: null, pendingTargetId: null };
}

function knmGetErrorKnowledgeNodeId(errorId, errors) {
  var errorItem = (errors || []).find(function (item) { return item.id === errorId; });
  return errorItem ? (errorItem.noteNodeId || null) : null;
}

function knmRenderKnowledgeMoveOptions(state, deps) {
  var d = deps || {};
  var list = document.getElementById("knowledgeMoveList");
  if (!list) return;
  var search = (document.getElementById("knowledgeMoveSearch") ? document.getElementById("knowledgeMoveSearch").value : "").trim().toLowerCase();
  var options = (typeof d.getKnowledgePathOptions === "function" ? d.getKnowledgePathOptions(false, null) : []).filter(function (item) {
    if (!search) return true;
    return item.label.toLowerCase().includes(search) || item.node.title.toLowerCase().includes(search);
  });
  if (!options.length) {
    list.innerHTML = '<div class="knowledge-move-empty">没有匹配的知识点</div>';
    return;
  }
  var pendingTargetId = state && state.pendingTargetId;
  var pendingErrorId = state && state.pendingErrorId;
  var currentNodeId = knmGetErrorKnowledgeNodeId(pendingErrorId, d.errors || []);
  var escape = d.escapeHtml || function (v) { return String(v || ""); };
  list.innerHTML = options.map(function (item) {
    return "<div class=\"knowledge-move-item " + (item.id === pendingTargetId ? "active" : "") + "\" onclick=\"selectKnowledgeMoveTarget('" + item.id + "')\">" +
      "<div class=\"knowledge-move-item-title\">" + escape(item.node.title) + "</div>" +
      "<div class=\"knowledge-move-item-path\">" + escape(item.label) + "</div>" +
      (item.id === currentNodeId ? '<div class="knowledge-move-item-current">当前挂载</div>' : "") +
    "</div>";
  }).join("");
}

function knmSelectKnowledgeMoveTarget(state, nodeId, renderFn) {
  var nextState = {
    pendingErrorId: state ? state.pendingErrorId : null,
    pendingTargetId: nodeId
  };
  if (typeof renderFn === "function") renderFn();
  return nextState;
}

function knmApplyKnowledgeMove(state, deps) {
  var d = deps || {};
  var pendingErrorId = state ? state.pendingErrorId : null;
  var pendingTargetId = state ? state.pendingTargetId : null;
  var errorItem = (d.errors || []).find(function (item) { return item.id === pendingErrorId; });
  if (!errorItem) {
    return { closeModal: true };
  }
  if (!pendingTargetId) {
    if (typeof d.showToast === "function") d.showToast("请选择目标知识点", "warning");
    return { closeModal: false };
  }
  var targetNode = typeof d.getKnowledgeNodeById === "function" ? d.getKnowledgeNodeById(pendingTargetId) : null;
  if (!targetNode) {
    if (typeof d.showToast === "function") d.showToast("目标知识点无效", "error");
    return { closeModal: false };
  }
  if (typeof d.assignErrorToKnowledgeNode === "function") {
    d.assignErrorToKnowledgeNode(errorItem.id, targetNode.id, { focusNode: true });
  }
  return { closeModal: true };
}
