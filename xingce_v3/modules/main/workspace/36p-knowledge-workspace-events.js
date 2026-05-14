// ============================================================
// Knowledge workspace directory/event handlers
// ============================================================
function kwOpenKnowledgeDirectoryNode(nodeId, deps) {
  var d = deps || {};
  if (!nodeId) return;
  if (typeof d.setNoteEditing === "function") d.setNoteEditing(false);
  var node = typeof d.getKnowledgeNodeById === "function" ? d.getKnowledgeNodeById(nodeId) : null;
  if (!node) return;
  var targetId = nodeId;
  var normalize = d.normalizeKnowledgeNoteMarkdown || function (v) { return String(v || ""); };
  if (!normalize(node.contentMd).trim()) {
    var descendants = (typeof d.getKnowledgeDescendantNodeIds === "function" ? d.getKnowledgeDescendantNodeIds(node) : [])
      .slice(1)
      .map(function (id) { return d.getKnowledgeNodeById(id); })
      .filter(function (item) { return item && normalize(item.contentMd).trim(); });
    if (descendants.length) targetId = descendants[0].id;
  }
  if (typeof d.setDirectoryPreviewNodeId === "function") d.setDirectoryPreviewNodeId(targetId);
  if (typeof d.renderNotesByType === "function") d.renderNotesByType();
}

var __kwResizeSyncRafId = 0;
var __kwPendingViewerResize = { role: "", height: 0 };

function kwIsKnowledgeWorkspaceMessageTrusted(event) {
  if (!event) return false;
  if (event.origin === window.location.origin) return true;
  var frame = document.getElementById("knowledgeNoteEditorModalFrame");
  if (frame && frame.contentWindow && event.source === frame.contentWindow) return true;
  return false;
}

function kwScheduleKnowledgeViewerResizeSync(role, height, deps) {
  var d = deps || {};
  __kwPendingViewerResize.role = String(role || "");
  __kwPendingViewerResize.height = Number(height || 0);
  if (__kwResizeSyncRafId) return;
  var flush = function () {
    __kwResizeSyncRafId = 0;
    if (typeof d.applyNoteViewerHeight === "function") {
      d.applyNoteViewerHeight(__kwPendingViewerResize.role, __kwPendingViewerResize.height);
    }
    if (typeof d.syncNotePreviewViewportHeight === "function") {
      d.syncNotePreviewViewportHeight();
    }
  };
  if (typeof requestAnimationFrame === "function") {
    __kwResizeSyncRafId = requestAnimationFrame(flush);
    return;
  }
  __kwResizeSyncRafId = setTimeout(flush, 16);
}

function kwHandleKnowledgeWorkspaceMessage(event, deps) {
  var d = deps || {};
  if (!event || !kwIsKnowledgeWorkspaceMessageTrusted(event)) return;
  var data = event.data || {};
  if (data.type === "knowledge-note-viewer-size") {
    kwScheduleKnowledgeViewerResizeSync(data.role, data.height, d);
    return;
  }
  if (data.type === "knowledge-note-viewer-ready") {
    var currentNode = typeof d.getCurrentKnowledgeNode === "function" ? d.getCurrentKnowledgeNode() : null;
    if (typeof d.syncNotePreviewViewportHeight === "function") d.syncNotePreviewViewportHeight();
    if (currentNode && typeof d.syncEmbeddedNoteViewers === "function" && typeof d.getCurrentNoteMarkdown === "function") {
      d.syncEmbeddedNoteViewers(currentNode, d.getCurrentNoteMarkdown());
    }
    return;
  }
  if (data.type === "knowledge-note-editor-close") {
    if (typeof d.closeEmbeddedKnowledgeNoteEditor === "function") d.closeEmbeddedKnowledgeNoteEditor(true);
    return;
  }
  if (data.type !== "knowledge-note-saved") return;
  if (typeof d.setNoteEditing === "function") d.setNoteEditing(false);
  if (data.nodeId && typeof d.setSelectedKnowledgeNodeId === "function") d.setSelectedKnowledgeNodeId(data.nodeId);
  if (typeof d.requestWorkspaceRender === "function") {
    d.requestWorkspaceRender({ sidebar: true, notes: true, immediate: true });
  } else {
    if (typeof d.renderSidebar === "function") d.renderSidebar();
    if (typeof d.renderNotesByType === "function") d.renderNotesByType();
  }
  if (typeof d.renderNotesPanelRight === "function") d.renderNotesPanelRight();
}
