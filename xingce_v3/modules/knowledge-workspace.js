(function () {
  function renderKnowledgeChildPills(currentNode) {
    return (currentNode.children || []).map(function (child) {
      var childCount = countErrorsForKnowledgeNode(child.id, true);
      return "<button class=\"knowledge-node-pill\" onclick=\"selectKnowledgeNodeFromSidebar('" + child.id + "')\">" +
        "<span>" + escapeHtml(child.title) + "</span>" +
        "<span class=\"knowledge-node-pill-count\">" + childCount + "题</span>" +
      "</button>";
    }).join("");
  }

  function getCurrentKnowledgeNode() {
    return getKnowledgeNodeById(selectedKnowledgeNodeId);
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
    if (options.switchTab !== false) {
      switchTab("notes");
    } else {
      renderSidebar();
      renderAll();
      renderNotesByType();
      renderNotesPanelRight();
    }
  }

  function selectKnowledgeLeaf(nodeId) {
    if (!nodeId) return;
    saveNoteTypeContent();
    notesViewMode = "knowledge";
    setCurrentKnowledgeNode(nodeId, { switchTab: false });
  }

  function selectNoteType(type) {
    saveNoteTypeContent();
    selectedNoteType = type;
    showToast("旧题型笔记已退到兼容层，当前统一使用知识树笔记。", "info");
    notesViewMode = "knowledge";
    renderNotesByType();
  }

  function openKnowledgeForError(errorId) {
    var errorItem = errors.find(function (item) { return item.id === errorId; });
    if (!errorItem || !errorItem.noteNodeId) {
      showToast("当前题目还没有关联知识点", "warning");
      return;
    }
    setCurrentKnowledgeNode(errorItem.noteNodeId, { switchTab: true });
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

  function renderKnowledgeWorkspaceHint(currentNode) {
    var childItems = renderKnowledgeChildPills(currentNode);
    return (childItems ? "<div class=\"knowledge-children-bar\">" + childItems + "</div>" : "") +
      "<div class=\"knowledge-node-hint\">当前节点本身就可以写笔记，也可以继续新增下级知识点。错题可以直接挂在当前节点，也可以拖到左侧其他节点重新挂载。</div>";
  }

  function bindKnowledgeEditorShortcuts(content) {
    var ta = content.querySelector("#noteTypeTextarea");
    if (!ta) return;
    ta.addEventListener("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "s") {
        ev.preventDefault();
        saveNoteTypeContent();
        renderNotesPanelRight();
      }
    });
  }

  function liveNotePreview() {
    var ta = document.getElementById("noteTypeTextarea");
    var preview = document.getElementById("noteSplitPreview");
    if (ta && preview) {
      preview.innerHTML = ta.value
        ? renderMd(ta.value)
        : '<span style="color:#ccc;font-size:12px;font-style:italic">输入 Markdown 后在此预览…</span>';
    }
    var gta = document.getElementById("globalNoteTA");
    var gpv = document.getElementById("noteEditPreview");
    if (gta && gpv) {
      gpv.innerHTML = renderMd(gta.value) || '<span style="color:#ccc;font-size:12px;font-style:italic">右侧实时预览</span>';
    }
  }

  function saveNoteTypeContent() {
    var ta = document.getElementById("noteTypeTextarea");
    if (!ta) return;
    if (notesViewMode === "knowledge") {
      ensureKnowledgeState();
      if (!selectedKnowledgeNodeId) return;
      var node = getKnowledgeNodeById(selectedKnowledgeNodeId);
      if (!node) return;
      node.contentMd = ta.value;
      node.updatedAt = new Date().toISOString();
      saveKnowledgeState();
      return;
    }
    if (!selectedNoteType) return;
    if (!notesByType[selectedNoteType]) {
      notesByType[selectedNoteType] = { content: "", updatedAt: "" };
    }
    notesByType[selectedNoteType].content = ta.value;
    notesByType[selectedNoteType].updatedAt = new Date().toISOString();
    saveNotesByType();
  }

  function renderKnowledgeNotesViewV2() {
    ensureKnowledgeState();
    var content = document.getElementById("notesContent");
    if (!content) return;

    var currentNode = getCurrentKnowledgeNode() || getKnowledgeRootNodes()[0];
    if (!currentNode) {
      content.innerHTML = '<div class="note-placeholder" style="padding:40px;text-align:center;color:#999">暂无知识点笔记，先录入错题后自动生成</div>';
      return;
    }

    selectedKnowledgeNodeId = currentNode.id;
    var pathText = collapseKnowledgePathTitles(getKnowledgePathTitles(currentNode.id)).join(" > ");
    var linkedCount = countErrorsForKnowledgeNode(currentNode.id, true);
    var directCount = countErrorsForKnowledgeNode(currentNode.id, false);
    var noteContent = currentNode.contentMd || "";
    var previewHtml = noteContent
      ? renderMd(noteContent)
      : '<div style="color:#c0c4cc;font-size:13px;font-style:italic;padding:18px 0">当前节点还没有笔记，直接在这里记录规则、易错点和行动建议。</div>';

    var workspaceBar = "<div class=\"knowledge-workspace-bar\">" +
      "<div class=\"knowledge-workspace-meta\">" +
        "<div class=\"knowledge-workspace-kicker\">知识点笔记</div>" +
        "<div class=\"knowledge-workspace-title\">" + escapeHtml(currentNode.title) + "</div>" +
        "<div class=\"knowledge-workspace-path\">" + escapeHtml(pathText) + " · 直属错题 " + directCount + " 题 · 含下级 " + linkedCount + " 题</div>" +
      "</div>" +
      "<div class=\"knowledge-workspace-actions\">" +
        "<button class=\"btn btn-secondary btn-sm\" onclick=\"renameKnowledgeNode('" + currentNode.id + "')\">重命名</button>" +
        (findKnowledgeParent(currentNode.id) ? "<button class=\"btn btn-secondary btn-sm\" onclick=\"moveKnowledgeNode('" + currentNode.id + "')\">移动</button>" : "") +
        "<button class=\"btn btn-secondary btn-sm\" onclick=\"selectedKnowledgeNodeId='" + currentNode.id + "';addKnowledgeLeafUnderSelected()\">+ 新建下级</button>" +
        (findKnowledgeParent(currentNode.id) ? "<button class=\"btn btn-secondary btn-sm\" onclick=\"deleteKnowledgeNode('" + currentNode.id + "')\">删除节点</button>" : "") +
        "<button class=\"btn btn-primary btn-sm\" onclick=\"noteEditing=" + (noteEditing ? "false" : "true") + ";renderNotesByType()\">" + (noteEditing ? "完成编辑" : "编辑笔记") + "</button>" +
      "</div>" +
    "</div>";

    var summaryHtml = renderKnowledgeWorkspaceHint(currentNode);
    var bodyHtml;

    if (noteEditing) {
      bodyHtml = "" +
        "<div class=\"note-split-area\">" +
          "<div class=\"note-split-editor\">" +
            "<div class=\"note-split-label\">✎ 编辑" +
              "<button onclick=\"saveNoteTypeContent();noteEditing=false;renderNotesByType()\" style=\"float:right;background:#52c41a;color:#fff;border:none;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:12px\">完成</button>" +
            "</div>" +
            summaryHtml +
            "<textarea id=\"noteTypeTextarea\" class=\"note-md-textarea\" placeholder=\"# 规则总结&#10;## 易错点&#10;- ...&#10;&#10;## 行动建议&#10;- ...\" oninput=\"liveNotePreview()\">" + escapeHtml(noteContent) + "</textarea>" +
            "<div class=\"note-btn-bar\">" +
              "<button class=\"btn btn-primary btn-sm\" onclick=\"saveNoteTypeContent()\">保存</button>" +
              "<button class=\"btn btn-secondary btn-sm\" onclick=\"selectedKnowledgeNodeId='" + currentNode.id + "';addKnowledgeLeafUnderSelected()\">+ 新建下级</button>" +
              "<span class=\"save-hint\">Ctrl+S 快捷保存</span>" +
            "</div>" +
          "</div>" +
          "<div class=\"note-split-preview\">" +
            "<div class=\"note-split-label\">预览</div>" +
            "<div class=\"note-preview-scroll notes-content\" id=\"noteSplitPreview\">" + previewHtml + "</div>" +
          "</div>" +
        "</div>";
    } else {
      bodyHtml = "" +
        "<div class=\"note-split-area\">" +
          "<div class=\"note-split-preview\" style=\"width:100%\">" +
            "<div class=\"note-split-label\">当前笔记</div>" +
            "<div class=\"note-preview-scroll notes-content\" id=\"noteSplitPreview\">" + summaryHtml + previewHtml + "</div>" +
          "</div>" +
        "</div>";
    }

    content.innerHTML = workspaceBar + bodyHtml;
    if (noteEditing) bindKnowledgeEditorShortcuts(content);
    updateKnowledgeWorkspaceChrome(currentNode, linkedCount);
    renderKnowledgeNotesPanelRight();
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
  window.renderNotesByType = function () {
    notesViewMode = "knowledge";
    renderKnowledgeNotesViewV2();
  };
  window.setNotesViewMode = function (mode) {
    if (mode !== "knowledge") {
      showToast("旧题型笔记已退到兼容层，当前统一使用知识树笔记。", "info");
    }
    notesViewMode = "knowledge";
    noteEditing = false;
    renderKnowledgeNotesViewV2();
    renderNotesPanelRight();
  };
  window.renderLegacyNotesView = function () {
    notesViewMode = "knowledge";
    renderKnowledgeNotesViewV2();
  };
})();
