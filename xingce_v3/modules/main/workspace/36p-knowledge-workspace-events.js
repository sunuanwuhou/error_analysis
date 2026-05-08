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

function kwHandleKnowledgeWorkspaceMessage(event, deps) {
  var d = deps || {};
  if (!event || event.origin !== window.location.origin) return;
  var data = event.data || {};
  if (data.type === "knowledge-note-viewer-size") {
    if (typeof d.applyNoteViewerHeight === "function") d.applyNoteViewerHeight(data.role, data.height);
    if (typeof d.syncNotePreviewViewportHeight === "function") d.syncNotePreviewViewportHeight();
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
  if (typeof d.renderSidebar === "function") d.renderSidebar();
  if (typeof d.renderNotesByType === "function") d.renderNotesByType();
  if (typeof d.renderNotesPanelRight === "function") d.renderNotesPanelRight();
}
