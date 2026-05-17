// ============================================================
// Knowledge workspace standalone note editor modal
// ============================================================
function kwEnsureEmbeddedNoteEditorModal(texts, closeHandler) {
  var existing = document.getElementById("knowledgeNoteEditorModal");
  if (existing) return existing;

  var safeTexts = texts || {};
  var mask = document.createElement("div");
  mask.id = "knowledgeNoteEditorModal";
  mask.className = "modal-mask note-editor-modal-mask";
  mask.innerHTML = "" +
    "<div class=\"note-editor-modal\" role=\"dialog\" aria-modal=\"true\" aria-label=\"" + String(safeTexts.standaloneEdit || "") + "\">" +
      "<button class=\"note-editor-modal-close\" type=\"button\" aria-label=\"Close\">&times;</button>" +
      "<iframe id=\"knowledgeNoteEditorModalFrame\" class=\"note-editor-modal-frame\" title=\"" + String(safeTexts.standaloneEdit || "") + "\"></iframe>" +
    "</div>";

  function requestCloseModal() {
    if (typeof closeHandler === "function") closeHandler(false);
  }

  mask.addEventListener("click", function (event) {
    if (event.target === mask) requestCloseModal();
  });
  mask.querySelector(".note-editor-modal-close").addEventListener("click", requestCloseModal);
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (!mask.classList.contains("open")) return;
    requestCloseModal();
  });

  document.body.appendChild(mask);
  return mask;
}

function kwCloseEmbeddedKnowledgeNoteEditor(force) {
  var mask = document.getElementById("knowledgeNoteEditorModal");
  if (!mask) return true;
  if (!force) {
    var frame = document.getElementById("knowledgeNoteEditorModalFrame");
    var editorWindow = frame && frame.contentWindow;
    if (editorWindow && typeof editorWindow.requestNoteEditorClose === "function") {
      if (editorWindow.requestNoteEditorClose(false) === false) return false;
    }
  }
  mask.classList.remove("open");
  document.body.classList.remove("note-editor-modal-open");
  return true;
}

function kwOpenExternalKnowledgeNoteEditor(nodeId, deps) {
  var d = deps || {};
  if (typeof d.ensureKnowledgeState === "function") d.ensureKnowledgeState();
  var targetNode = (typeof d.getKnowledgeNodeById === "function"
    ? d.getKnowledgeNodeById(nodeId || d.selectedKnowledgeNodeId)
    : null) || (typeof d.getCurrentKnowledgeNode === "function" ? d.getCurrentKnowledgeNode() : null);
  if (!targetNode) {
    if (typeof d.showToast === "function") d.showToast(d.pickKnowledgeNodeText || "请先选择知识节点", "warning");
    return;
  }
  var mask = kwEnsureEmbeddedNoteEditorModal(d.texts || {}, d.closeEmbeddedKnowledgeNoteEditor);
  var frame = document.getElementById("knowledgeNoteEditorModalFrame");
  if (!frame) return;
  frame.src = "/assets/note_editor.html?nodeId=" + encodeURIComponent(targetNode.id) + "&embed=1";
  mask.classList.add("open");
  document.body.classList.add("note-editor-modal-open");
}
