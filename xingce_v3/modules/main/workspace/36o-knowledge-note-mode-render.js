// ============================================================
// Knowledge workspace note/directory mode renderers
// ============================================================
function kwRenderInlineNotePreview(currentNode, noteContent, deps) {
  var d = deps || {};
  var text = d.text || {};
  var markdown = String(noteContent || "");
  if (!markdown.trim()) {
    return "<div class=\"knowledge-workspace-empty\">" + String(text.noNotes || "") + "</div>";
  }
  var anchorPrefix = d.getKnowledgeNoteAnchorPrefix(currentNode && currentNode.id);
  var headings = d.extractMdHeadings(markdown);
  var tocHtml = d.renderFloatingHeadingPanel(headings, anchorPrefix);
  var previewHtml = d.renderNotePreviewLayout(d.renderMd(markdown, { anchorPrefix: anchorPrefix }), tocHtml);
  return "<div class=\"knowledge-inline-preview\" data-role=\"knowledge-inline-preview\">" + previewHtml + "</div>";
}

function kwHydrateInlineNotePreview() {
  var preview = document.getElementById("noteSplitPreview");
  if (!preview) return;
  requestAnimationFrame(function () {
    syncActiveNoteToc(preview);
    renderMathInElement(preview);
  });
}

function kwSyncKnowledgeNoteScrollFrames() {
  var content = document.getElementById("notesContent");
  if (!content || !content.classList.contains("knowledge-workspace-note-mode")) return;
  var header = content.querySelector(".knowledge-workspace-shell-header");
  var listHead = content.querySelector(".knowledge-workspace-list-head");
  var contentRect = content.getBoundingClientRect();
  var headerHeight = header ? header.getBoundingClientRect().height : 0;
  var listHeadHeight = listHead ? listHead.getBoundingClientRect().height : 0;
  var available = Math.max(360, Math.floor(contentRect.height - headerHeight - listHeadHeight - 28));
  var px = available + "px";
  [
    ".knowledge-workspace-note-wrap--directory",
    ".knowledge-directory-layout",
    ".knowledge-directory-list",
    ".knowledge-directory-preview-wrap",
    ".knowledge-directory-preview",
    ".knowledge-inline-preview",
    ".note-preview-layout",
    ".note-preview-layout-no-toc",
    ".note-preview-toc",
    ".note-preview-toc .note-toc-floating",
    ".note-preview-article-scroll"
  ].forEach(function (selector) {
    Array.prototype.forEach.call(content.querySelectorAll(selector), function (el) {
      el.style.height = px;
      el.style.maxHeight = px;
      el.style.minHeight = "0";
    });
  });
  [
    ".knowledge-directory-list",
    ".note-preview-toc .note-toc-floating",
    ".note-preview-article-scroll"
  ].forEach(function (selector) {
    Array.prototype.forEach.call(content.querySelectorAll(selector), function (el) {
      el.style.overflowY = "scroll";
      el.style.overflowX = "hidden";
    });
  });
}

function kwRenderNoteMode(currentNode, noteContent, isEditing, deps) {
  var d = deps || {};
  var text = d.text || {};
  if (typeof d.clearGlobalNoteTocDock === "function") d.clearGlobalNoteTocDock();
  var previewHtml = isEditing
    ? d.renderViewerFrame(currentNode.id, "noteSplitPreview")
    : d.renderInlineNotePreview(currentNode, noteContent);

  if (isEditing) {
    return "" +
      "<div class=\"note-split-area\">" +
        "<div class=\"note-split-editor\">" +
          "<div class=\"note-split-label\">" + String(text.edit || "") +
            "<button onclick=\"saveNoteTypeContent();noteEditing=false;renderNotesByType()\" style=\"float:right;background:#52c41a;color:#fff;border:none;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:12px\">" + String(text.done || "") + "</button>" +
          "</div>" +
          "<textarea id=\"noteTypeTextarea\" class=\"note-md-textarea\" placeholder=\"# \\u89c4\\u5219\\u603b\\u7ed3&#10;## \\u6613\\u9519\\u70b9&#10;- ...&#10;&#10;## \\u884c\\u52a8\\u5efa\\u8bae&#10;- ...\" oninput=\"liveNotePreview()\">" + d.escapeHtml(noteContent) + "</textarea>" +
          "<div class=\"note-btn-bar\">" +
            "<button class=\"btn btn-primary btn-sm\" onclick=\"saveNoteTypeContent()\">" + String(text.save || "") + "</button>" +
            "<span class=\"save-hint\">" + String(text.shortcutSave || "") + "</span>" +
          "</div>" +
        "</div>" +
        "<div class=\"note-split-preview\">" +
          "<div class=\"note-split-label\">" + String(text.preview || "") + "</div>" +
          "<div class=\"note-preview-scroll note-preview-frame-scroll\" id=\"noteSplitPreview\">" + previewHtml + "</div>" +
        "</div>" +
      "</div>";
  }

  return "<div class=\"knowledge-workspace-note-wrap\">" +
    "<div class=\"knowledge-workspace-list-head\">" + String(text.currentNote || "") + "</div>" +
    "<div class=\"note-preview-scroll note-preview-frame-scroll\" id=\"noteSplitPreview\">" + previewHtml + "</div>" +
  "</div>";
}

function kwRenderDirectoryMode(currentNode, deps) {
  var d = deps || {};
  if (typeof d.clearGlobalNoteTocDock === "function") d.clearGlobalNoteTocDock();
  var tree = (currentNode.children || []).map(d.buildDirectoryTree).filter(Boolean);
  var sections = d.flattenDirectoryTree(tree);
  if (!sections.length) {
    return "<div class=\"knowledge-workspace-note-wrap\">" +
      "<div class=\"knowledge-workspace-list-head\">章节目录</div>" +
      "<div class=\"knowledge-workspace-empty\">当前一级节点下还没有可浏览的子章节。</div>" +
    "</div>";
  }

  var previewNode = d.getDirectoryPreviewNode(currentNode, sections);
  var previewContent = previewNode ? d.normalizeKnowledgeNoteMarkdown(previewNode.contentMd) : "";
  var previewHtml = previewNode
    ? d.renderInlineNotePreview(previewNode, previewContent)
    : "<div class=\"knowledge-workspace-empty\">请选择一个章节查看笔记。</div>";

  var blocks = sections.map(function (section) {
    var isActive = previewNode && section.nodeId === previewNode.id;
    return "<button class=\"knowledge-directory-item" + (isActive ? " active" : "") + (section.hasContent ? "" : " is-structural") + "\" type=\"button\" style=\"padding-left:" + (14 + section.depth * 18) + "px\" onclick=\"openKnowledgeDirectoryNode('" + d.escapeHtml(section.nodeId) + "')\">" +
      "<span class=\"knowledge-directory-item-title\">" + d.escapeHtml(section.title) + "</span>" +
      "<span class=\"knowledge-directory-item-meta\">" + section.childCount + "题</span>" +
    "</button>";
  }).join("");

  return "<div class=\"knowledge-workspace-note-wrap knowledge-workspace-note-wrap--directory\">" +
    "<div class=\"knowledge-workspace-list-head\">章节目录</div>" +
    "<div class=\"knowledge-directory-layout\">" +
      "<div class=\"knowledge-directory-list\" id=\"knowledgeDirectoryList\">" + blocks + "</div>" +
      "<div class=\"knowledge-directory-preview-wrap\">" +
        "<div class=\"knowledge-directory-preview-head\">" +
          "<div class=\"knowledge-directory-preview-title\">" + d.escapeHtml(previewNode ? (previewNode.title || "当前章节") : "当前章节") + "</div>" +
          "<div class=\"knowledge-directory-preview-path\">" + d.escapeHtml(previewNode ? collapseKnowledgePathTitles(getKnowledgePathTitles(previewNode.id)).join(" > ") : "") + "</div>" +
        "</div>" +
        "<div class=\"note-preview-scroll note-preview-frame-scroll knowledge-directory-preview\" id=\"knowledgeDirectoryPreview\">" + previewHtml + "</div>" +
      "</div>" +
    "</div>" +
  "</div>";
}
