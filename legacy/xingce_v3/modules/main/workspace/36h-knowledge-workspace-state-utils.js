// ============================================================
// Knowledge workspace state helper utils
// ============================================================
function kwEscapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function kwGetWorkspaceMode(defaultMode) {
  if (window.knowledgeWorkspaceMode !== "list" && window.knowledgeWorkspaceMode !== "note") {
    window.knowledgeWorkspaceMode = defaultMode || "note";
  }
  return window.knowledgeWorkspaceMode;
}

function kwSetWorkspaceMode(mode) {
  window.knowledgeWorkspaceMode = mode === "note" ? "note" : "list";
}

function kwGetNoteViewMode() {
  if (window.knowledgeNoteViewMode !== "directory" && window.knowledgeNoteViewMode !== "current") {
    window.knowledgeNoteViewMode = "current";
  }
  return window.knowledgeNoteViewMode;
}

function kwSetNoteViewMode(mode) {
  window.knowledgeNoteViewMode = mode === "directory" ? "directory" : "current";
}

function kwGetDirectoryPreviewNodeId() {
  return String(window.knowledgeDirectoryPreviewNodeId || "").trim();
}

function kwSetDirectoryPreviewNodeId(nodeId) {
  window.knowledgeDirectoryPreviewNodeId = String(nodeId || "").trim();
}
