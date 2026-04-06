(function () {
  var DEFAULT_MODE = "note";

  var TEXT = {
    legacyTypeNotes: "\u65e7\u9898\u578b\u7b14\u8bb0\u5df2\u7ecf\u9000\u5230\u517c\u5bb9\u5c42\uff0c\u5f53\u524d\u7edf\u4e00\u4f7f\u7528\u77e5\u8bc6\u6811\u7b14\u8bb0\u3002",
    noKnowledgeNode: "\u5f53\u524d\u9898\u76ee\u8fd8\u6ca1\u6709\u5173\u8054\u77e5\u8bc6\u70b9",
    pickKnowledgeNode: "\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a\u77e5\u8bc6\u70b9",
    tabQuestions: "\u9898\u76ee",
    tabNotes: "\u7b14\u8bb0",
    countSuffix: "\u9898",
    createQuestion: "+ \u65b0\u5efa\u9898\u76ee",
    standaloneEdit: "\u5f39\u7a97\u7f16\u8f91",
    rename: "\u91cd\u547d\u540d",
    move: "\u79fb\u52a8",
    createChild: "+ \u65b0\u5efa\u4e0b\u7ea7",
    directCount: "\u76f4\u5c5e ",
    linkedCount: "\u542b\u4e0b\u7ea7 ",
    noQuestions: "\u5f53\u524d\u77e5\u8bc6\u70b9\u4e0b\u8fd8\u6ca1\u6709\u9898\u76ee\uff0c\u5148\u70b9\u201c\u65b0\u5efa\u9898\u76ee\u201d\u5f55\u4e00\u9898\u3002",
    currentQuestions: "\u5f53\u524d\u9898\u76ee",
    noNotes: "\u5f53\u524d\u8282\u70b9\u8fd8\u6ca1\u6709\u7b14\u8bb0\uff0c\u5148\u5199\u89c4\u5219\u603b\u7ed3\u3001\u6613\u9519\u70b9\u548c\u4e0b\u4e00\u6b65\u52a8\u4f5c\u3002",
    openStandaloneEditor: "\u6253\u5f00\u5f39\u7a97\u7f16\u8f91\u5668",
    edit: "\u7f16\u8f91",
    done: "\u5b8c\u6210",
    save: "\u4fdd\u5b58",
    shortcutSave: "Ctrl+S \u5feb\u6377\u4fdd\u5b58",
    preview: "\u9884\u89c8",
    currentNote: "\u5f53\u524d\u7b14\u8bb0",
    noKnowledgeContent: "\u6682\u65f6\u8fd8\u6ca1\u6709\u77e5\u8bc6\u70b9\u5185\u5bb9\uff0c\u5148\u5f55\u5165\u9519\u9898\u540e\u4f1a\u81ea\u52a8\u751f\u6210\u7ed3\u6784\u3002"
  };

  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getWorkspaceMode() {
    if (window.knowledgeWorkspaceMode !== "list" && window.knowledgeWorkspaceMode !== "note") {
      window.knowledgeWorkspaceMode = DEFAULT_MODE;
    }
    return window.knowledgeWorkspaceMode;
  }

  function setWorkspaceMode(mode) {
    window.knowledgeWorkspaceMode = mode === "note" ? "note" : "list";
  }

  function getCurrentKnowledgeNode() {
    return getKnowledgeNodeById(selectedKnowledgeNodeId);
  }

  function getCurrentNoteMarkdown() {
    var ta = document.getElementById("noteTypeTextarea");
    if (ta) return ta.value;
    var node = getCurrentKnowledgeNode();
    return node ? (node.contentMd || "") : "";
  }

  function buildViewerPayload(currentNode, markdown) {
    if (!currentNode) return null;
    return {
      nodeId: currentNode.id,
      title: currentNode.title || "",
      pathText: collapseKnowledgePathTitles(getKnowledgePathTitles(currentNode.id)).join(" > "),
      markdown: markdown || "",
      emptyText: TEXT.noNotes
    };
  }

  function postViewerPayload(frame, payload) {
    if (!frame || !frame.contentWindow || !payload) return;
    try {
      frame.contentWindow.postMessage(
        { type: "knowledge-note-viewer-sync", payload: payload },
        window.location.origin
      );
    } catch (error) {
      console.warn("post viewer payload failed", error);
    }
  }

  function bindViewerFrame(frame) {
    if (!frame || frame.dataset.viewerBound === "1") return;
    frame.dataset.viewerBound = "1";
    frame.addEventListener("load", function () {
      var currentNode = getCurrentKnowledgeNode();
      if (!currentNode) return;
      postViewerPayload(frame, buildViewerPayload(currentNode, getCurrentNoteMarkdown()));
    });
  }

  function syncEmbeddedNoteViewers(currentNode, markdown) {
    var content = document.getElementById("notesContent");
    if (!content || !currentNode) return;
    var payload = buildViewerPayload(currentNode, markdown);
    content.querySelectorAll(".js-note-viewer-frame").forEach(function (frame) {
      bindViewerFrame(frame);
      postViewerPayload(frame, payload);
    });
  }

  function getAvailableNotePreviewHeight(container, host) {
    if (!container || !host) return 0;
    var containerRect = container.getBoundingClientRect();
    var hostRect = host.getBoundingClientRect();
    return Math.max(0, Math.floor(hostRect.bottom - containerRect.top - 12));
  }

  function syncNotePreviewViewportHeight() {
    var container = document.getElementById("noteSplitPreview");
    var host = document.getElementById("notesContent");
    if (!container || !host) return;
    if (!noteEditing) {
      var frame = document.getElementById("noteReadPreviewFrame");
      var contentHeight = frame ? Math.ceil(Number(frame.dataset.contentHeight) || 0) : 0;
      var available = getAvailableNotePreviewHeight(container, host);
      if (frame && contentHeight > 0 && available > 0) {
        var nextHeight = Math.max(120, Math.min(contentHeight, available));
        container.style.height = nextHeight + "px";
        frame.style.height = nextHeight + "px";
      } else {
        container.style.height = "auto";
        if (frame) frame.style.height = "auto";
      }
      container.style.maxHeight = "none";
      return;
    }

    var available = getAvailableNotePreviewHeight(container, host);
    if (available < 260) return;

    container.style.height = available + "px";
    container.style.maxHeight = "none";
  }

  function renderViewerFrame(nodeId, role) {
    var roleName = role || "preview";
    var src = "/assets/note_viewer.html?nodeId=" + encodeURIComponent(nodeId || "") +
      "&embed=1&role=" + encodeURIComponent(roleName);
    return "<iframe" +
      " class=\"note-viewer-frame note-viewer-frame--" + escapeAttr(roleName === "noteSplitPreview" ? "split" : "read") + " js-note-viewer-frame\"" +
      " id=\"" + escapeAttr(roleName) + "Frame\"" +
      " src=\"" + escapeAttr(src) + "\"" +
      " loading=\"lazy\"" +
      " referrerpolicy=\"same-origin\"" +
      " title=\"" + TEXT.preview + "\">" +
    "</iframe>";
  }

  function applyNoteViewerHeight(role, contentHeight) {
    if (role !== "noteReadPreview") return;
    var frame = document.getElementById(role + "Frame");
    if (!frame) return;
    var measuredHeight = Math.max(120, Math.ceil(Number(contentHeight) || 0));
    frame.dataset.contentHeight = String(measuredHeight);
    frame.style.height = measuredHeight + "px";
  }

  function ensureEmbeddedNoteEditorModal() {
    var existing = document.getElementById("knowledgeNoteEditorModal");
    if (existing) return existing;

    var mask = document.createElement("div");
    mask.id = "knowledgeNoteEditorModal";
    mask.className = "modal-mask note-editor-modal-mask";
    mask.innerHTML = "" +
      "<div class=\"note-editor-modal\" role=\"dialog\" aria-modal=\"true\" aria-label=\"" + TEXT.standaloneEdit + "\">" +
        "<button class=\"note-editor-modal-close\" type=\"button\" aria-label=\"Close\">&times;</button>" +
        "<iframe id=\"knowledgeNoteEditorModalFrame\" class=\"note-editor-modal-frame\" title=\"" + TEXT.standaloneEdit + "\"></iframe>" +
      "</div>";

    function requestClose() {
      var frame = document.getElementById("knowledgeNoteEditorModalFrame");
      var editorWindow = frame && frame.contentWindow;
      if (editorWindow && typeof editorWindow.requestNoteEditorClose === "function") {
        if (editorWindow.requestNoteEditorClose(false) === false) return;
      }
      closeEmbeddedKnowledgeNoteEditor(true);
    }

    mask.addEventListener("click", function (event) {
      if (event.target === mask) requestClose();
    });
    mask.querySelector(".note-editor-modal-close").addEventListener("click", requestClose);
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (!mask.classList.contains("open")) return;
      requestClose();
    });

    document.body.appendChild(mask);
    return mask;
  }

  function closeEmbeddedKnowledgeNoteEditor(force) {
    var mask = document.getElementById("knowledgeNoteEditorModal");
    if (!mask) return;
    if (!force) {
      var frame = document.getElementById("knowledgeNoteEditorModalFrame");
      var editorWindow = frame && frame.contentWindow;
      if (editorWindow && typeof editorWindow.requestNoteEditorClose === "function") {
        if (editorWindow.requestNoteEditorClose(false) === false) return;
      }
    }
    mask.classList.remove("open");
    document.body.classList.remove("note-editor-modal-open");
  }

  function collectNodeErrors(currentNode) {
    if (!currentNode) return [];
    var nodeIds = getKnowledgeDescendantNodeIds(currentNode);
    return getFiltered().filter(function (item) {
      return nodeIds.includes(item.noteNodeId);
    });
  }

  function setCurrentKnowledgeNode(nodeId, opts) {
    var options = opts || {};
    if (!nodeId) return;
    var resolvedId = resolveKnowledgeDisplayNodeId(nodeId);
    expandKnowledgePath(resolvedId);
    selectedKnowledgeNodeId = resolvedId;
    knowledgeNodeFilter = options.applyFilter === false ? knowledgeNodeFilter : resolvedId;
    typeFilter = null;
    noteEditing = false;
    if (options.mode) {
      setWorkspaceMode(options.mode);
    } else {
      setWorkspaceMode(DEFAULT_MODE);
    }
    if (options.switchTab !== false) {
      switchTab("notes");
    } else {
      renderSidebar();
      renderAll();
      renderNotesByType();
    }
  }

  function selectKnowledgeLeaf(nodeId) {
    if (!nodeId) return;
    saveNoteTypeContent();
    notesViewMode = "knowledge";
    setCurrentKnowledgeNode(nodeId, { switchTab: false, mode: DEFAULT_MODE });
  }

  function selectNoteType(type) {
    saveNoteTypeContent();
    selectedNoteType = type;
    showToast(TEXT.legacyTypeNotes, "info");
    notesViewMode = "knowledge";
    setWorkspaceMode("note");
    renderNotesByType();
  }

  function openKnowledgeForError(errorId) {
    var errorItem = errors.find(function (item) { return item.id === errorId; });
    if (!errorItem || !errorItem.noteNodeId) {
      showToast(TEXT.noKnowledgeNode, "warning");
      return;
    }
    setCurrentKnowledgeNode(errorItem.noteNodeId, { switchTab: true, mode: "list" });
  }

  function jumpToErrorInList(errorId) {
    switchTab("errors");
    revealed.add(errorId);
    saveReveal();
    renderAll();
    setTimeout(function () {
      var el = document.getElementById("card-" + errorId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  function bindKnowledgeEditorShortcuts(content) {
    var ta = content.querySelector("#noteTypeTextarea");
    if (!ta) return;
    ta.addEventListener("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "s") {
        ev.preventDefault();
        saveNoteTypeContent();
      }
    });
  }

  function openExternalKnowledgeNoteEditor(nodeId) {
    ensureKnowledgeState();
    var targetNode = getKnowledgeNodeById(nodeId || selectedKnowledgeNodeId) || getCurrentKnowledgeNode();
    if (!targetNode) {
      showToast(TEXT.pickKnowledgeNode, "warning");
      return;
    }
    var mask = ensureEmbeddedNoteEditorModal();
    var frame = document.getElementById("knowledgeNoteEditorModalFrame");
    if (!frame) return;
    frame.src = "/assets/note_editor.html?nodeId=" + encodeURIComponent(targetNode.id) + "&embed=1";
    mask.classList.add("open");
    document.body.classList.add("note-editor-modal-open");
  }

  function liveNotePreview() {
    var ta = document.getElementById("noteTypeTextarea");
    var currentNode = getCurrentKnowledgeNode();
    if (!ta || !currentNode) return;
    clearGlobalNoteTocDock();
    syncEmbeddedNoteViewers(currentNode, ta.value);
  }

  function saveNoteTypeContent() {
    var ta = document.getElementById("noteTypeTextarea");
    if (!ta) return;
    ensureKnowledgeState();
    if (!selectedKnowledgeNodeId) return;
    var node = getKnowledgeNodeById(selectedKnowledgeNodeId);
    if (!node) return;
    node.contentMd = ta.value;
    node.updatedAt = new Date().toISOString();
    saveKnowledgeState();
  }

  function renderWorkspaceHeader(currentNode, pathText, directCount, linkedCount, errorCount, mode) {
    return "<div class=\"knowledge-workspace-shell-header\">" +
      "<div class=\"knowledge-workspace-shell-meta\">" +
        "<div class=\"knowledge-workspace-shell-title\">" + escapeHtml(currentNode.title) + "</div>" +
        "<div class=\"knowledge-workspace-shell-path\">" + escapeHtml(pathText) + "</div>" +
      "</div>" +
      "<div class=\"knowledge-workspace-shell-actions\">" +
        "<div class=\"knowledge-workspace-mode-switch\">" +
          "<button class=\"btn btn-sm " + (mode === "list" ? "btn-primary" : "btn-secondary") + "\" onclick=\"setKnowledgeWorkspaceMode('list')\">" + TEXT.tabQuestions + "</button>" +
          "<button class=\"btn btn-sm " + (mode === "note" ? "btn-primary" : "btn-secondary") + "\" onclick=\"setKnowledgeWorkspaceMode('note')\">" + TEXT.tabNotes + "</button>" +
        "</div>" +
        "<span class=\"knowledge-workspace-count\">" + errorCount + TEXT.countSuffix + "</span>" +
        "<button class=\"btn btn-sm btn-secondary\" onclick=\"openAddModalForCurrentKnowledge()\">" + TEXT.createQuestion + "</button>" +
        "<button class=\"btn btn-sm btn-secondary\" onclick=\"openExternalKnowledgeNoteEditor('" + currentNode.id + "')\">" + TEXT.standaloneEdit + "</button>" +
        "<button class=\"btn btn-sm btn-secondary\" onclick=\"renameKnowledgeNode('" + currentNode.id + "')\">" + TEXT.rename + "</button>" +
        (findKnowledgeParent(currentNode.id) ? "<button class=\"btn btn-sm btn-secondary\" onclick=\"moveKnowledgeNode('" + currentNode.id + "')\">" + TEXT.move + "</button>" : "") +
        "<button class=\"btn btn-sm btn-secondary\" onclick=\"selectedKnowledgeNodeId='" + currentNode.id + "';addKnowledgeLeafUnderSelected()\">" + TEXT.createChild + "</button>" +
      "</div>" +
      "<div class=\"knowledge-workspace-shell-stats\">" +
        "<span class=\"knowledge-workspace-stat\">" + TEXT.directCount + directCount + "</span>" +
        "<span class=\"knowledge-workspace-stat\">" + TEXT.linkedCount + linkedCount + "</span>" +
      "</div>" +
    "</div>";
  }

  function renderListMode(currentNode, relatedErrors) {
    var body = relatedErrors.length
      ? relatedErrors.map(function (item) { return renderCard(item); }).join("")
      : "<div class=\"knowledge-workspace-empty\">" + TEXT.noQuestions + "</div>";

    return "<div class=\"knowledge-workspace-list-wrap\">" +
      "<div class=\"knowledge-workspace-list-head\">" + TEXT.currentQuestions + "</div>" +
      "<div class=\"knowledge-workspace-list\">" + body + "</div>" +
    "</div>";
  }

  function renderInlineNotePreview(currentNode, noteContent) {
    var markdown = String(noteContent || "");
    if (!markdown.trim()) {
      return "<div class=\"knowledge-workspace-empty\">" + TEXT.emptyNote + "</div>";
    }
    var anchorPrefix = getKnowledgeNoteAnchorPrefix(currentNode && currentNode.id);
    var headings = extractMdHeadings(markdown);
    var tocHtml = renderFloatingHeadingPanel(headings, anchorPrefix);
    var previewHtml = renderNotePreviewLayout(renderMd(markdown, { anchorPrefix: anchorPrefix }), tocHtml);
    return "<div class=\"knowledge-inline-preview\" data-role=\"knowledge-inline-preview\">" + previewHtml + "</div>";
  }

  function hydrateInlineNotePreview() {
    var preview = document.getElementById("noteSplitPreview");
    if (!preview) return;
    requestAnimationFrame(function () {
      syncActiveNoteToc(preview);
      renderMathInElement(preview);
    });
  }

  function renderNoteMode(currentNode, noteContent) {
    clearGlobalNoteTocDock();
    var previewHtml = noteEditing
      ? renderViewerFrame(currentNode.id, "noteSplitPreview")
      : renderInlineNotePreview(currentNode, noteContent);

    if (noteEditing) {
      return "" +
        "<div class=\"note-split-area\">" +
          "<div class=\"note-split-editor\">" +
            "<div class=\"note-split-label\">" + TEXT.edit +
              "<button onclick=\"saveNoteTypeContent();noteEditing=false;renderNotesByType()\" style=\"float:right;background:#52c41a;color:#fff;border:none;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:12px\">" + TEXT.done + "</button>" +
            "</div>" +
            "<textarea id=\"noteTypeTextarea\" class=\"note-md-textarea\" placeholder=\"# \\u89c4\\u5219\\u603b\\u7ed3&#10;## \\u6613\\u9519\\u70b9&#10;- ...&#10;&#10;## \\u884c\\u52a8\\u5efa\\u8bae&#10;- ...\" oninput=\"liveNotePreview()\">" + escapeHtml(noteContent) + "</textarea>" +
            "<div class=\"note-btn-bar\">" +
              "<button class=\"btn btn-primary btn-sm\" onclick=\"saveNoteTypeContent()\">" + TEXT.save + "</button>" +
              "<span class=\"save-hint\">" + TEXT.shortcutSave + "</span>" +
            "</div>" +
          "</div>" +
          "<div class=\"note-split-preview\">" +
            "<div class=\"note-split-label\">" + TEXT.preview + "</div>" +
            "<div class=\"note-preview-scroll note-preview-frame-scroll\" id=\"noteSplitPreview\">" + previewHtml + "</div>" +
          "</div>" +
        "</div>";
    }

    return "<div class=\"knowledge-workspace-note-wrap\">" +
      "<div class=\"knowledge-workspace-list-head\">" + TEXT.currentNote + "</div>" +
      "<div class=\"note-preview-scroll note-preview-frame-scroll\" id=\"noteSplitPreview\">" + previewHtml + "</div>" +
    "</div>";
  }

  function renderKnowledgeNotesViewV2() {
    ensureKnowledgeState();
    clearGlobalNoteTocDock();
    var content = document.getElementById("notesContent");
    if (!content) return;

    var currentNode = getCurrentKnowledgeNode() || getKnowledgeRootNodes()[0];
    if (!currentNode) {
      content.innerHTML = '<div class="knowledge-workspace-empty">' + TEXT.noKnowledgeContent + "</div>";
      return;
    }

    selectedKnowledgeNodeId = currentNode.id;
    notesViewMode = "knowledge";
    var pathText = collapseKnowledgePathTitles(getKnowledgePathTitles(currentNode.id)).join(" > ");
    var linkedCount = countErrorsForKnowledgeNode(currentNode.id, true);
    var directCount = countErrorsForKnowledgeNode(currentNode.id, false);
    var relatedErrors = collectNodeErrors(currentNode);
    var noteContent = currentNode.contentMd || "";
    var mode = getWorkspaceMode();
    if (mode === "list" && !relatedErrors.length && noteContent.trim()) {
      mode = "note";
      setWorkspaceMode("note");
    }

    var bodyHtml = mode === "note"
      ? renderNoteMode(currentNode, noteContent)
      : renderListMode(currentNode, relatedErrors);

    content.innerHTML = "<div class=\"knowledge-workspace-shell\">" +
      renderWorkspaceHeader(currentNode, pathText, directCount, linkedCount, relatedErrors.length, mode) +
      bodyHtml +
    "</div>";

    syncNotePreviewViewportHeight();

    if (mode === "note") {
      if (noteEditing) {
        syncEmbeddedNoteViewers(currentNode, getCurrentNoteMarkdown());
      } else {
        hydrateInlineNotePreview();
      }
    }

    if (mode === "note" && noteEditing) {
      bindKnowledgeEditorShortcuts(content);
    }
  }

  function refreshKnowledgeWorkspaceCards() {
    var content = document.getElementById("notesContent");
    if (!content) return;
    if (!content.querySelector(".knowledge-workspace-shell")) return;
    renderKnowledgeNotesViewV2();
  }

  function setKnowledgeWorkspaceMode(mode, editing) {
    setWorkspaceMode(mode);
    if (editing && mode === "note") {
      noteEditing = false;
      renderNotesByType();
      openExternalKnowledgeNoteEditor(selectedKnowledgeNodeId);
      return;
    }
    noteEditing = false;
    renderNotesByType();
  }

  window.addEventListener("message", function (event) {
    if (!event || event.origin !== window.location.origin) return;
    var data = event.data || {};
    if (data.type === "knowledge-note-viewer-size") {
      applyNoteViewerHeight(data.role, data.height);
      syncNotePreviewViewportHeight();
      return;
    }
    if (data.type === "knowledge-note-viewer-ready") {
      var currentNode = getCurrentKnowledgeNode();
      syncNotePreviewViewportHeight();
      if (currentNode) syncEmbeddedNoteViewers(currentNode, getCurrentNoteMarkdown());
      return;
    }
    if (data.type === "knowledge-note-editor-close") {
      closeEmbeddedKnowledgeNoteEditor(true);
      return;
    }
    if (data.type !== "knowledge-note-saved") return;
    noteEditing = false;
    if (data.nodeId) selectedKnowledgeNodeId = data.nodeId;
    renderSidebar();
    renderNotesByType();
    if (typeof renderNotesPanelRight === "function") renderNotesPanelRight();
  });

  window.renderKnowledgeNotesViewV2 = renderKnowledgeNotesViewV2;
  window.getCurrentKnowledgeNode = getCurrentKnowledgeNode;
  window.setCurrentKnowledgeNode = setCurrentKnowledgeNode;
  window.selectKnowledgeLeaf = selectKnowledgeLeaf;
  window.selectNoteType = selectNoteType;
  window.openKnowledgeForError = openKnowledgeForError;
  window.jumpToErrorInList = jumpToErrorInList;
  window.liveNotePreview = liveNotePreview;
  window.saveNoteTypeContent = saveNoteTypeContent;
  window.setKnowledgeWorkspaceMode = setKnowledgeWorkspaceMode;
  window.openExternalKnowledgeNoteEditor = openExternalKnowledgeNoteEditor;
  window.refreshKnowledgeWorkspaceCards = refreshKnowledgeWorkspaceCards;
  window.renderNotesByType = function () {
    renderKnowledgeNotesViewV2();
  };
  window.setNotesViewMode = function () {
    setWorkspaceMode("note");
    noteEditing = false;
    renderKnowledgeNotesViewV2();
  };
  window.renderLegacyNotesView = function () {
    setWorkspaceMode("note");
    noteEditing = false;
    renderKnowledgeNotesViewV2();
  };
  window.addEventListener("resize", syncNotePreviewViewportHeight);
})();
