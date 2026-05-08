// ============================================================
// Knowledge workspace shell/header/list rendering
// ============================================================
function kwRenderWorkspaceHeader(currentNode, pathText, directCount, linkedCount, errorCount, mode, deps) {
  var d = deps || {};
  var text = d.text || {};
  var esc = typeof d.escapeHtml === "function" ? d.escapeHtml : function (v) { return String(v || ""); };
  var titleText = String((currentNode && currentNode.title) || "");
  var pathValue = String(pathText || "");
  var showPath = pathValue && pathValue !== titleText;
  var pathHtml = showPath
    ? "<div class=\"knowledge-workspace-shell-path\">" + esc(pathValue) + "</div>"
    : "";
  var backToRecommended = window.__recommendedNotesReturnEnabled
    ? "<button class=\"btn btn-sm btn-secondary\" onclick=\"returnToRecommendedNotes()\">返回推荐列表</button>"
    : "";
  var nodeActions = "<div class=\"knowledge-workspace-node-actions\">" +
    "<button class=\"btn btn-sm btn-secondary\" onclick=\"openExternalKnowledgeNoteEditor('" + currentNode.id + "')\">" + String(text.standaloneEdit || "") + "</button>" +
    "<button class=\"btn btn-sm btn-secondary\" onclick=\"renameKnowledgeNode('" + currentNode.id + "')\">" + String(text.rename || "") + "</button>" +
    "<button class=\"btn btn-sm btn-secondary\" onclick=\"moveKnowledgeNode('" + currentNode.id + "')\">" + String(text.move || "") + "</button>" +
    "<button class=\"btn btn-sm btn-secondary\" onclick=\"selectedKnowledgeNodeId='" + currentNode.id + "';addKnowledgeLeafUnderSelected()\">" + String(text.createChild || "") + "</button>" +
    "<button class=\"btn btn-sm btn-secondary\" onclick=\"openAddModalForCurrentKnowledge()\">" + String(text.createQuestion || "") + "</button>" +
  "</div>";
  var sortBy = String(window.errorSortBy || "created_at") === "wrong_count" ? "wrong_count" : "created_at";
  var sortOrder = String(window.errorSortOrder || "desc") === "asc" ? "asc" : "desc";
  var listSortTools = mode === "list"
    ? "<div class=\"knowledge-workspace-sort-tools\">" +
        "<span class=\"knowledge-workspace-sort-label\">排序</span>" +
        "<select class=\"knowledge-workspace-sort-select\" onchange=\"setErrorSortBy(this.value)\">" +
          "<option value=\"created_at\"" + (sortBy === "created_at" ? " selected" : "") + ">创建时间</option>" +
          "<option value=\"wrong_count\"" + (sortBy === "wrong_count" ? " selected" : "") + ">错题次数</option>" +
        "</select>" +
        "<button class=\"btn btn-sm btn-secondary\" type=\"button\" onclick=\"toggleErrorSortOrder()\">" + (sortOrder === "asc" ? "升序" : "降序") + "</button>" +
      "</div>"
    : "";
  var noteViewHtml = "";
  if (mode === "note" && typeof d.isTopLevelNode === "function" && d.isTopLevelNode(currentNode)) {
    var noteViewMode = typeof d.getNoteViewMode === "function" ? d.getNoteViewMode() : "current";
    noteViewHtml = "<div class=\"knowledge-workspace-mode-switch knowledge-note-view-switch\">" +
      "<button class=\"btn btn-sm " + (noteViewMode === "current" ? "btn-primary" : "btn-secondary") + "\" onclick=\"setKnowledgeNoteViewMode('current')\">当前笔记</button>" +
      "<button class=\"btn btn-sm " + (noteViewMode === "directory" ? "btn-primary" : "btn-secondary") + "\" onclick=\"setKnowledgeNoteViewMode('directory')\">章节目录</button>" +
    "</div>";
  }
  return "<div class=\"knowledge-workspace-shell-header\">" +
    "<div class=\"knowledge-workspace-shell-meta\">" +
      "<div class=\"knowledge-workspace-shell-title\">" + esc(titleText) + "</div>" +
      pathHtml +
      nodeActions +
    "</div>" +
    "<div class=\"knowledge-workspace-shell-actions\">" +
      "<div class=\"knowledge-workspace-mode-switch\">" +
        "<button class=\"btn btn-sm " + (mode === "list" ? "btn-primary" : "btn-secondary") + "\" onclick=\"setKnowledgeWorkspaceMode('list')\">" + String(text.tabQuestions || "") + "</button>" +
        "<button class=\"btn btn-sm " + (mode === "note" ? "btn-primary" : "btn-secondary") + "\" onclick=\"setKnowledgeWorkspaceMode('note')\">" + String(text.tabNotes || "") + "</button>" +
      "</div>" +
      listSortTools +
      noteViewHtml +
      "<span class=\"knowledge-workspace-count\">" + errorCount + String(text.countSuffix || "") + "</span>" +
      backToRecommended +
    "</div>" +
    "<div class=\"knowledge-workspace-shell-stats\">" +
      "<span class=\"knowledge-workspace-stat\">" + String(text.directCount || "") + directCount + "</span>" +
      "<span class=\"knowledge-workspace-stat\">" + String(text.linkedCount || "") + linkedCount + "</span>" +
    "</div>" +
  "</div>";
}

function kwRenderListMode(relatedErrors, deps) {
  var d = deps || {};
  if (typeof d.queueVisiblePracticeSummaryLoad === "function") {
    d.queueVisiblePracticeSummaryLoad(relatedErrors);
  }
  var body = (relatedErrors || []).length
    ? (relatedErrors || []).map(function (item) { return d.renderCard(item); }).join("")
    : "<div class=\"knowledge-workspace-empty\">" + String((d.text || {}).noQuestions || "") + "</div>";

  return "<div class=\"knowledge-workspace-list-wrap\">" +
    "<div class=\"knowledge-workspace-list-head\">" + String((d.text || {}).currentQuestions || "") + "</div>" +
    "<div class=\"knowledge-workspace-list\">" + body + "</div>" +
  "</div>";
}

function kwEnsureKnowledgeWorkspaceListScrollable() {
  var content = document.getElementById("notesContent");
  if (!content) return;
  var shell = content.querySelector(".knowledge-workspace-shell");
  if (!shell) return;
  var listWrap = shell.querySelector(".knowledge-workspace-list-wrap");
  var list = shell.querySelector(".knowledge-workspace-list");
  if (!listWrap || !list) return;
  var shellHeader = shell.querySelector(".knowledge-workspace-shell-header");
  var listHead = listWrap.querySelector(".knowledge-workspace-list-head");
  listWrap.style.display = "flex";
  listWrap.style.flexDirection = "column";
  listWrap.style.flex = "1";
  listWrap.style.minHeight = "0";
  listWrap.style.overflow = "hidden";
  listWrap.style.height = "";
  listWrap.style.maxHeight = "";

  if (shellHeader) shellHeader.style.flexShrink = "0";
  if (listHead) listHead.style.flexShrink = "0";

  list.style.flex = "1";
  list.style.minHeight = "0";
  list.style.height = "";
  list.style.maxHeight = "";
  list.style.overflowY = "auto";
  list.style.overflowX = "hidden";
  list.style.touchAction = "pan-y";
  list.style.webkitOverflowScrolling = "touch";
}

function kwBindKnowledgeWorkspaceScrollListener(stateObj, getWorkspaceMode, ensureScrollable) {
  if (!stateObj || stateObj.bound) return;
  stateObj.bound = true;
  window.addEventListener("resize", function () {
    var content = document.getElementById("notesContent");
    if (!content || !content.classList.contains("knowledge-notes-active")) return;
    if (typeof getWorkspaceMode === "function" && getWorkspaceMode() !== "list") return;
    if (typeof ensureScrollable === "function") {
      ensureScrollable();
      setTimeout(ensureScrollable, 80);
    }
  });
}
