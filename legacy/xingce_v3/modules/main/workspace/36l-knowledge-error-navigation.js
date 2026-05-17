// ============================================================
// Knowledge workspace error navigation helpers
// ============================================================
function kwResolveErrorItem(errorId, deps) {
  var d = deps || {};
  var targetId = typeof d.normalizeErrorId === "function"
    ? d.normalizeErrorId(errorId)
    : String(errorId || "").trim();
  var item = typeof d.findErrorById === "function"
    ? d.findErrorById(targetId)
    : (d.errors || []).find(function (entry) { return String((entry && entry.id) || "").trim() === targetId; });
  return { targetId: targetId, errorItem: item };
}

function kwOpenKnowledgeForError(errorId, deps) {
  var d = deps || {};
  var resolved = kwResolveErrorItem(errorId, d);
  var errorItem = resolved.errorItem;
  if (!errorItem || !errorItem.noteNodeId) {
    if (typeof d.showToast === "function") d.showToast(d.noKnowledgeNodeText || "未绑定知识节点", "warning");
    return;
  }
  if (typeof d.setCurrentKnowledgeNode === "function") {
    d.setCurrentKnowledgeNode(errorItem.noteNodeId, { switchTab: true, mode: "list" });
  }
}

function kwJumpToErrorInList(errorId, deps) {
  var d = deps || {};
  var resolved = kwResolveErrorItem(errorId, d);
  var targetId = resolved.targetId;
  var errorItem = resolved.errorItem;

  function forceOpenEditor() {
    if (typeof d.openEditModal === "function") {
      try { d.openEditModal(targetId); } catch (e) {}
    }
  }

  if (!errorItem) {
    if (typeof d.showToast === "function") d.showToast("未找到对应错题", "warning");
    forceOpenEditor();
    return;
  }

  var selectors = [
    "[data-error-id=\"" + targetId + "\"]",
    "#card-" + targetId,
    ".notes-panel-right [data-error-id=\"" + targetId + "\"]",
    "#noteErrorList [data-error-id=\"" + targetId + "\"]"
  ];

  var attempts = 0;
  var maxAttempts = 14;

  function attemptLocate() {
    attempts += 1;
    for (var i = 0; i < selectors.length; i += 1) {
      var el = document.querySelector(selectors[i]);
      if (!el) continue;
      try { el.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
      setTimeout(forceOpenEditor, 80);
      return;
    }
    if (attempts < maxAttempts) {
      setTimeout(attemptLocate, 140);
      return;
    }
    forceOpenEditor();
    if (typeof d.showToast === "function") d.showToast("已定位到题目编辑面板", "success");
  }

  function openWorkspaceAndLocate() {
    try {
      if (typeof d.switchAppView === "function") d.switchAppView("workspace");
      if (errorItem.noteNodeId && typeof d.setCurrentKnowledgeNode === "function") {
        d.setCurrentKnowledgeNode(errorItem.noteNodeId, { switchTab: true, mode: "list" });
      } else if (typeof d.switchTab === "function") {
        d.switchTab("notes");
      }
    } catch (e) {
      console.warn("[knowledge-workspace] jumpToErrorInList workspace switch failed", e);
    }
    if (typeof d.requestWorkspaceRender === "function") {
      d.requestWorkspaceRender({ sidebar: false, notes: true, immediate: true });
    } else {
      if (typeof d.renderAll === "function") d.renderAll();
      if (typeof d.renderNotesByType === "function") d.renderNotesByType();
    }
    if (typeof d.renderNotesPanelRight === "function") d.renderNotesPanelRight();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        requestAnimationFrame(attemptLocate);
      });
    } else {
      setTimeout(attemptLocate, 32);
    }
  }

  if (typeof d.hasFullWorkspaceDataLoaded === "function"
    && typeof d.ensureFullWorkspaceDataLoaded === "function"
    && !d.hasFullWorkspaceDataLoaded()) {
    d.ensureFullWorkspaceDataLoaded().finally(function () { setTimeout(openWorkspaceAndLocate, 60); });
  } else {
    setTimeout(openWorkspaceAndLocate, 60);
  }
  setTimeout(forceOpenEditor, 700);
}
