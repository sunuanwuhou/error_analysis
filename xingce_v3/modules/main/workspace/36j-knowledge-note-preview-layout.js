// ============================================================
// Knowledge workspace note preview layout helpers
// ============================================================
function kwGetAvailableNotePreviewHeight(container, host) {
  if (!container || !host) return 0;
  var containerRect = container.getBoundingClientRect();
  var hostRect = host.getBoundingClientRect();
  return Math.max(0, Math.floor(hostRect.bottom - containerRect.top - 12));
}

function kwSyncNotePreviewViewportHeight(isEditing) {
  var container = document.getElementById("noteSplitPreview");
  var host = document.getElementById("notesContent");
  if (!container || !host) return;
  if (!isEditing) {
    var frame = document.getElementById("noteReadPreviewFrame");
    var contentHeight = frame ? Math.ceil(Number(frame.dataset.contentHeight) || 0) : 0;
    var available = kwGetAvailableNotePreviewHeight(container, host);
    if (frame && contentHeight > 0 && available > 0) {
      var nextHeight = Math.max(120, Math.min(contentHeight, available));
      container.style.height = nextHeight + "px";
      frame.style.height = nextHeight + "px";
    } else if (available > 0) {
      var fallbackHeight = Math.max(260, available);
      container.style.height = fallbackHeight + "px";
      if (frame) frame.style.height = fallbackHeight + "px";
    } else {
      container.style.height = "";
      if (frame) frame.style.height = "";
    }
    container.style.maxHeight = "none";
    return;
  }

  var available = kwGetAvailableNotePreviewHeight(container, host);
  if (available < 260) return;

  container.style.height = available + "px";
  container.style.maxHeight = "none";
}

function kwRenderViewerFrame(nodeId, role, previewLabel) {
  var roleName = role || "preview";
  var src = "/assets/note_viewer.html?nodeId=" + encodeURIComponent(nodeId || "") +
    "&embed=1&role=" + encodeURIComponent(roleName);
  return "<iframe" +
    " class=\"note-viewer-frame note-viewer-frame--" + kwEscapeAttr(roleName === "noteSplitPreview" ? "split" : "read") + " js-note-viewer-frame\"" +
    " id=\"" + kwEscapeAttr(roleName) + "Frame\"" +
    " src=\"" + kwEscapeAttr(src) + "\"" +
    " loading=\"lazy\"" +
    " referrerpolicy=\"same-origin\"" +
    " title=\"" + (previewLabel || "") + "\">" +
  "</iframe>";
}

function kwApplyNoteViewerHeight(role, contentHeight) {
  if (role !== "noteReadPreview") return;
  var frame = document.getElementById(role + "Frame");
  if (!frame) return;
  var measuredHeight = Math.max(120, Math.ceil(Number(contentHeight) || 0));
  frame.dataset.contentHeight = String(measuredHeight);
  frame.style.height = measuredHeight + "px";
}
