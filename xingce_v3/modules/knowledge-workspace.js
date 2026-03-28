(function () {
  var DEFAULT_MODE = "note";

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
    showToast("旧题型笔记已退到兼容层，当前统一使用知识树笔记。", "info");
    notesViewMode = "knowledge";
    setWorkspaceMode("note");
    renderNotesByType();
  }

  function openKnowledgeForError(errorId) {
    var errorItem = errors.find(function (item) { return item.id === errorId; });
    if (!errorItem || !errorItem.noteNodeId) {
      showToast("当前题目还没有关联知识点", "warning");
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

  function liveNotePreview() {
    var ta = document.getElementById("noteTypeTextarea");
    var preview = document.getElementById("noteSplitPreview");
    if (ta && preview) {
      var anchorPrefix = getKnowledgeNoteAnchorPrefix(selectedKnowledgeNodeId);
      var liveHeadings = extractMdHeadings(ta.value);
      var tocHtml = renderFloatingHeadingPanel(liveHeadings, anchorPrefix);
      updateGlobalNoteTocDock(liveHeadings, anchorPrefix);
      preview.innerHTML = ta.value
        ? renderNotePreviewLayout(renderMd(ta.value, { anchorPrefix: anchorPrefix }), tocHtml)
        : '<span style="color:#ccc;font-size:12px;font-style:italic">输入 Markdown 后在这里预览</span>';
    }
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
          "<button class=\"btn btn-sm " + (mode === "list" ? "btn-primary" : "btn-secondary") + "\" onclick=\"setKnowledgeWorkspaceMode('list')\">题目</button>" +
          "<button class=\"btn btn-sm " + (mode === "note" ? "btn-primary" : "btn-secondary") + "\" onclick=\"setKnowledgeWorkspaceMode('note')\">笔记</button>" +
        "</div>" +
        "<span class=\"knowledge-workspace-count\">" + errorCount + "题</span>" +
        "<button class=\"btn btn-sm btn-secondary\" onclick=\"openAddModalForCurrentKnowledge()\">+ 新建题目</button>" +
        "<button class=\"btn btn-sm btn-secondary\" onclick=\"setKnowledgeWorkspaceMode('note', true)\">编辑笔记</button>" +
        "<button class=\"btn btn-sm btn-secondary\" onclick=\"renameKnowledgeNode('" + currentNode.id + "')\">重命名</button>" +
        (findKnowledgeParent(currentNode.id) ? "<button class=\"btn btn-sm btn-secondary\" onclick=\"moveKnowledgeNode('" + currentNode.id + "')\">移动</button>" : "") +
        "<button class=\"btn btn-sm btn-secondary\" onclick=\"selectedKnowledgeNodeId='" + currentNode.id + "';addKnowledgeLeafUnderSelected()\">+ 新建下级</button>" +
      "</div>" +
      "<div class=\"knowledge-workspace-shell-stats\">" +
        "<span class=\"knowledge-workspace-stat\">直属 " + directCount + "</span>" +
        "<span class=\"knowledge-workspace-stat\">含下级 " + linkedCount + "</span>" +
      "</div>" +
    "</div>";
  }

  function renderListMode(currentNode, relatedErrors) {
    var body = relatedErrors.length
      ? relatedErrors.map(function (item) { return renderCard(item); }).join("")
      : "<div class=\"knowledge-workspace-empty\">当前知识点下还没有题目，先点“新建题目”录一题。</div>";

    return "<div class=\"knowledge-workspace-list-wrap\">" +
      "<div class=\"knowledge-workspace-list-head\">当前题目</div>" +
      "<div class=\"knowledge-workspace-list\">" + body + "</div>" +
    "</div>";
  }

  function renderNoteMode(currentNode, noteContent) {
    var noteAnchorPrefix = getKnowledgeNoteAnchorPrefix(currentNode.id);
    var noteHeadings = extractMdHeadings(noteContent);
    var tocHtml = renderFloatingHeadingPanel(noteHeadings, noteAnchorPrefix);
    var previewHtml = noteContent
      ? renderNotePreviewLayout(renderMd(noteContent, { anchorPrefix: noteAnchorPrefix }), tocHtml)
      : '<div class="knowledge-workspace-empty">当前节点还没有笔记，直接开始写总结、易错点和行动建议。</div>';

    updateGlobalNoteTocDock(noteHeadings, noteAnchorPrefix);

    if (noteEditing) {
      return "" +
        "<div class=\"note-split-area\">" +
          "<div class=\"note-split-editor\">" +
            "<div class=\"note-split-label\">编辑" +
              "<button onclick=\"saveNoteTypeContent();noteEditing=false;renderNotesByType()\" style=\"float:right;background:#52c41a;color:#fff;border:none;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:12px\">完成</button>" +
            "</div>" +
            "<textarea id=\"noteTypeTextarea\" class=\"note-md-textarea\" placeholder=\"# 规则总结&#10;## 易错点&#10;- ...&#10;&#10;## 行动建议&#10;- ...\" oninput=\"liveNotePreview()\">" + escapeHtml(noteContent) + "</textarea>" +
            "<div class=\"note-btn-bar\">" +
              "<button class=\"btn btn-primary btn-sm\" onclick=\"saveNoteTypeContent()\">保存</button>" +
              "<span class=\"save-hint\">Ctrl+S 快捷保存</span>" +
            "</div>" +
          "</div>" +
          "<div class=\"note-split-preview\">" +
            "<div class=\"note-split-label\">预览</div>" +
            "<div class=\"note-preview-scroll notes-content\" id=\"noteSplitPreview\">" + previewHtml + "</div>" +
          "</div>" +
        "</div>";
    }

    return "<div class=\"knowledge-workspace-note-wrap\">" +
      "<div class=\"knowledge-workspace-list-head\">当前笔记</div>" +
      "<div class=\"note-preview-scroll notes-content\" id=\"noteSplitPreview\">" + previewHtml + "</div>" +
    "</div>";
  }

  function renderKnowledgeNotesViewV2() {
    ensureKnowledgeState();
    clearGlobalNoteTocDock();
    var content = document.getElementById("notesContent");
    if (!content) return;

    var currentNode = getCurrentKnowledgeNode() || getKnowledgeRootNodes()[0];
    if (!currentNode) {
      content.innerHTML = '<div class="knowledge-workspace-empty">暂无知识点内容，先录入错题后会自动生成结构。</div>';
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
    noteEditing = !!editing && mode === "note";
    renderNotesByType();
  }

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
})();
