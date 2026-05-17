// ============================================================
// Knowledge node drag and drop handlers
// ============================================================
function knmClearKnowledgeDropIndicators(stateObj) {
  if (stateObj) {
    stateObj.nodeId = null;
    stateObj.mode = "";
  }
  document.querySelectorAll(".knowledge-drop-over,.knowledge-drop-before,.knowledge-drop-after,.knowledge-drop-invalid").forEach(function (el) {
    el.classList.remove("knowledge-drop-over");
    el.classList.remove("knowledge-drop-before");
    el.classList.remove("knowledge-drop-after");
    el.classList.remove("knowledge-drop-invalid");
  });
}

function knmResolveKnowledgeDropMode(event, el) {
  if (!event || !el || typeof event.clientY !== "number") return "inside";
  var rect = el.getBoundingClientRect();
  if (!rect || !rect.height) return "inside";
  var y = event.clientY - rect.top;
  var edge = Math.max(7, Math.min(18, rect.height * 0.28));
  if (y <= edge) return "before";
  if (y >= rect.height - edge) return "after";
  return "inside";
}

function knmCanDropKnowledgeNodeToMode(fromNodeId, toNodeId, mode, isDescendantFn) {
  if (!fromNodeId || !toNodeId) return false;
  if (fromNodeId === toNodeId) return false;
  if (typeof isDescendantFn === "function" && isDescendantFn(fromNodeId, toNodeId)) return false;
  return mode === "before" || mode === "after" || mode === "inside";
}

function knmStartKnowledgeNodeDrag(nodeId, event, deps) {
  var d = deps || {};
  if (typeof d.setDraggingKnowledgeNodeId === "function") d.setDraggingKnowledgeNodeId(nodeId);
  if (typeof d.setDraggingErrorId === "function") d.setDraggingErrorId(null);
  if (event && event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "knowledge-node:" + nodeId);
  }
  var el = document.querySelector("[data-knowledge-node-id=\"" + nodeId + "\"]");
  if (el) el.classList.add("knowledge-dragging");
}

function knmEndKnowledgeNodeDrag(clearFn, deps) {
  var d = deps || {};
  if (typeof d.setDraggingKnowledgeNodeId === "function") d.setDraggingKnowledgeNodeId(null);
  document.querySelectorAll(".knowledge-dragging").forEach(function (el) { el.classList.remove("knowledge-dragging"); });
  if (typeof clearFn === "function") clearFn();
}

function knmStartErrorDrag(errorId, event, deps) {
  var d = deps || {};
  if (typeof d.setDraggingErrorId === "function") d.setDraggingErrorId(errorId);
  if (typeof d.setDraggingKnowledgeNodeId === "function") d.setDraggingKnowledgeNodeId(null);
  if (event && event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "knowledge-error:" + errorId);
  }
}

function knmEndErrorDrag(clearFn, deps) {
  var d = deps || {};
  if (typeof d.setDraggingErrorId === "function") d.setDraggingErrorId(null);
  if (typeof clearFn === "function") clearFn();
}

function knmAllowKnowledgeDrop(event, nodeId, deps) {
  var d = deps || {};
  if (!d.draggingKnowledgeNodeId && !d.draggingErrorId) return;
  event.preventDefault();
  var el = document.querySelector("[data-knowledge-node-id=\"" + nodeId + "\"]");
  if (!el) return;

  if (typeof d.clearKnowledgeDropIndicators === "function") d.clearKnowledgeDropIndicators();

  if (d.draggingKnowledgeNodeId) {
    var mode = knmResolveKnowledgeDropMode(event, el);
    var allowed = knmCanDropKnowledgeNodeToMode(d.draggingKnowledgeNodeId, nodeId, mode, d.isKnowledgeDescendant);
    if (d.knowledgeNodeDropHint) {
      d.knowledgeNodeDropHint.nodeId = nodeId;
      d.knowledgeNodeDropHint.mode = mode;
    }
    if (!allowed) {
      el.classList.add("knowledge-drop-invalid");
      return;
    }
    if (mode === "before") el.classList.add("knowledge-drop-before");
    else if (mode === "after") el.classList.add("knowledge-drop-after");
    else el.classList.add("knowledge-drop-over");
    return;
  }

  el.classList.add("knowledge-drop-over");
}

function knmLeaveKnowledgeDrop(event) {
  if (!event || !event.currentTarget) return;
  var current = event.currentTarget;
  current.classList.remove("knowledge-drop-over");
  current.classList.remove("knowledge-drop-before");
  current.classList.remove("knowledge-drop-after");
  current.classList.remove("knowledge-drop-invalid");
}

function knmHandleKnowledgeDrop(nodeId, event, deps) {
  var d = deps || {};
  event.preventDefault();
  event.stopPropagation();
  var hintedMode = (d.knowledgeNodeDropHint && d.knowledgeNodeDropHint.nodeId === nodeId && d.knowledgeNodeDropHint.mode)
    ? d.knowledgeNodeDropHint.mode
    : "";
  if (typeof d.clearKnowledgeDropIndicators === "function") d.clearKnowledgeDropIndicators();
  if (d.draggingKnowledgeNodeId) {
    var mode = hintedMode || knmResolveKnowledgeDropMode(event, event.currentTarget);
    if (mode === "before" || mode === "after") {
      d.moveKnowledgeNodeToSiblingPosition(d.draggingKnowledgeNodeId, nodeId, mode);
    } else {
      d.moveKnowledgeNodeToTarget(d.draggingKnowledgeNodeId, nodeId);
    }
    d.endKnowledgeNodeDrag();
    return;
  }
  if (d.draggingErrorId) {
    d.assignErrorToKnowledgeNode(d.draggingErrorId, nodeId, { focusNode: true });
    d.endErrorDrag();
  }
}
