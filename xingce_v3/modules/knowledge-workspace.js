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

  function escapeAttr(value) { return kwEscapeAttr(value); }

  function getWorkspaceMode() { return kwGetWorkspaceMode(DEFAULT_MODE); }

  function setWorkspaceMode(mode) { kwSetWorkspaceMode(mode); }

  function getNoteViewMode() { return kwGetNoteViewMode(); }

  function setNoteViewMode(mode) { kwSetNoteViewMode(mode); }

  function getDirectoryPreviewNodeId() { return kwGetDirectoryPreviewNodeId(); }

  function setDirectoryPreviewNodeId(nodeId) { kwSetDirectoryPreviewNodeId(nodeId); }

  function getCurrentKnowledgeNode() {
    return getKnowledgeNodeById(selectedKnowledgeNodeId);
  }

  function getCurrentNoteMarkdown() {
    var ta = document.getElementById("noteTypeTextarea");
    if (ta) return ta.value;
    var node = getCurrentKnowledgeNode();
    return normalizeKnowledgeNoteMarkdown(node ? node.contentMd : "");
  }

  function normalizeKnowledgeNoteMarkdown(value) {
    if (value === null || value === undefined) return "";
    var text = String(value);
    if (text.trim().toLowerCase() === "undefined") return "";
    return text;
  }

  function buildViewerPayload(currentNode, markdown) { return kwBuildViewerPayload(currentNode, markdown, TEXT.noNotes); }

  function postViewerPayload(frame, payload) { kwPostViewerPayload(frame, payload); }

  function bindViewerFrame(frame) {
    kwBindViewerFrame(frame, function () {
      var currentNode = getCurrentKnowledgeNode();
      if (!currentNode) return null;
      return buildViewerPayload(currentNode, getCurrentNoteMarkdown());
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

  function getAvailableNotePreviewHeight(container, host) { return kwGetAvailableNotePreviewHeight(container, host); }

  function syncNotePreviewViewportHeight() { kwSyncNotePreviewViewportHeight(noteEditing); }

  function renderViewerFrame(nodeId, role) { return kwRenderViewerFrame(nodeId, role, TEXT.preview); }

  function applyNoteViewerHeight(role, contentHeight) { kwApplyNoteViewerHeight(role, contentHeight); }


  function ensureEmbeddedNoteEditorModal() {
    return kwEnsureEmbeddedNoteEditorModal(TEXT, closeEmbeddedKnowledgeNoteEditor);
  }

  function closeEmbeddedKnowledgeNoteEditor(force) {
    kwCloseEmbeddedKnowledgeNoteEditor(force);
  }

  function collectNodeErrors(currentNode) {
    return kwCollectNodeErrors(currentNode, getFiltered());
  }

  function isTopLevelKnowledgeNode(node) {
    return kwIsTopLevelKnowledgeNode(node);
  }

  function collectDirectorySections(currentNode) {
    return kwCollectDirectorySections(currentNode, normalizeKnowledgeNoteMarkdown);
  }

  function buildDirectoryTree(node) {
    return kwBuildDirectoryTree(node, normalizeKnowledgeNoteMarkdown);
  }

  function flattenDirectoryTree(tree) {
    return kwFlattenDirectoryTree(tree);
  }

  function getDirectoryPreviewNode(currentNode, sections) {
    var previewNodeId = kwPickDirectoryPreviewNodeId(sections, getDirectoryPreviewNodeId());
    if (!previewNodeId) return null;
    setDirectoryPreviewNodeId(previewNodeId);
    return getKnowledgeNodeById(previewNodeId);
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
      if (typeof requestWorkspaceRender === "function") {
        requestWorkspaceRender({ sidebar: true, notes: true, immediate: true });
      } else {
        renderSidebar();
        renderAll();
        renderNotesByType();
      }
    }
  }

  function selectKnowledgeLeaf(nodeId) {
    if (!nodeId) return;
    saveNoteTypeContent();
    notesViewMode = "knowledge";
    setCurrentKnowledgeNode(nodeId, { switchTab: false, mode: DEFAULT_MODE });
  }

  function clearKnowledgeNodeFilterView() {
    knowledgeNodeFilter = null;
    if (typeof requestWorkspaceRender === "function") {
      requestWorkspaceRender({ sidebar: true, notes: true, immediate: true });
    } else {
      renderSidebar();
      renderAll();
      renderNotesByType();
    }
    if (typeof renderNotesPanelRight === "function") renderNotesPanelRight();
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
    kwOpenKnowledgeForError(errorId, {
      normalizeErrorId: normalizeErrorId,
      findErrorById: findErrorById,
      errors: errors,
      showToast: showToast,
      noKnowledgeNodeText: TEXT.noKnowledgeNode,
      setCurrentKnowledgeNode: setCurrentKnowledgeNode
    });
  }

  function jumpToErrorInList(errorId) {
    kwJumpToErrorInList(errorId, {
      normalizeErrorId: normalizeErrorId,
      findErrorById: findErrorById,
      errors: errors,
      showToast: showToast,
      openEditModal: openEditModal,
      switchAppView: switchAppView,
      setCurrentKnowledgeNode: setCurrentKnowledgeNode,
      switchTab: switchTab,
      requestWorkspaceRender: requestWorkspaceRender,
      renderAll: renderAll,
      renderNotesByType: renderNotesByType,
      renderNotesPanelRight: renderNotesPanelRight,
      hasFullWorkspaceDataLoaded: hasFullWorkspaceDataLoaded,
      ensureFullWorkspaceDataLoaded: ensureFullWorkspaceDataLoaded
    });
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
    kwOpenExternalKnowledgeNoteEditor(nodeId, {
      ensureKnowledgeState: ensureKnowledgeState,
      getKnowledgeNodeById: getKnowledgeNodeById,
      selectedKnowledgeNodeId: selectedKnowledgeNodeId,
      getCurrentKnowledgeNode: getCurrentKnowledgeNode,
      showToast: showToast,
      pickKnowledgeNodeText: TEXT.pickKnowledgeNode,
      texts: TEXT,
      closeEmbeddedKnowledgeNoteEditor: closeEmbeddedKnowledgeNoteEditor
    });
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
    return kwRenderWorkspaceHeader(currentNode, pathText, directCount, linkedCount, errorCount, mode, {
      text: TEXT,
      escapeHtml: escapeHtml,
      hasParent: function (nodeId) { return !!findKnowledgeParent(nodeId); },
      isTopLevelNode: isTopLevelKnowledgeNode,
      getNoteViewMode: getNoteViewMode
    });
  }

  function renderListMode(currentNode, relatedErrors) {
    return kwRenderListMode(relatedErrors, {
      queueVisiblePracticeSummaryLoad: queueVisiblePracticeSummaryLoad,
      renderCard: renderCard,
      text: TEXT
    });
  }

  function ensureKnowledgeWorkspaceListScrollable() {
    kwEnsureKnowledgeWorkspaceListScrollable();
  }

  var __knowledgeWorkspaceScrollListener = { bound: false };
  function bindKnowledgeWorkspaceScrollListener() {
    kwBindKnowledgeWorkspaceScrollListener(
      __knowledgeWorkspaceScrollListener,
      getWorkspaceMode,
      ensureKnowledgeWorkspaceListScrollable
    );
  }

  function renderInlineNotePreview(currentNode, noteContent) {
    return kwRenderInlineNotePreview(currentNode, noteContent, {
      text: TEXT,
      getKnowledgeNoteAnchorPrefix: getKnowledgeNoteAnchorPrefix,
      extractMdHeadings: extractMdHeadings,
      renderFloatingHeadingPanel: renderFloatingHeadingPanel,
      renderNotePreviewLayout: renderNotePreviewLayout,
      renderMd: renderMd
    });
  }

  function hydrateInlineNotePreview() {
    kwHydrateInlineNotePreview();
  }

  function syncKnowledgeNoteScrollFrames() {
    kwSyncKnowledgeNoteScrollFrames();
  }

  function renderNoteMode(currentNode, noteContent) {
    return kwRenderNoteMode(currentNode, noteContent, noteEditing, {
      text: TEXT,
      clearGlobalNoteTocDock: clearGlobalNoteTocDock,
      renderViewerFrame: renderViewerFrame,
      renderInlineNotePreview: renderInlineNotePreview,
      escapeHtml: escapeHtml
    });
  }

  function renderDirectoryMode(currentNode) {
    return kwRenderDirectoryMode(currentNode, {
      clearGlobalNoteTocDock: clearGlobalNoteTocDock,
      buildDirectoryTree: buildDirectoryTree,
      flattenDirectoryTree: flattenDirectoryTree,
      getDirectoryPreviewNode: getDirectoryPreviewNode,
      normalizeKnowledgeNoteMarkdown: normalizeKnowledgeNoteMarkdown,
      renderInlineNotePreview: renderInlineNotePreview,
      escapeHtml: escapeHtml
    });
  }

  function renderKnowledgeNotesViewV2() {
    ensureKnowledgeState();
    clearGlobalNoteTocDock();
    var content = document.getElementById("notesContent");
    if (!content) return;
    content.classList.add("knowledge-notes-active");

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
    var noteContent = normalizeKnowledgeNoteMarkdown(currentNode.contentMd);
    var mode = getWorkspaceMode();
    if (mode === "list" && !relatedErrors.length && noteContent.trim()) {
      mode = "note";
      setWorkspaceMode("note");
    }

    if (isTopLevelKnowledgeNode(currentNode)) {
      if (window.knowledgeNoteViewMode !== "directory" && window.knowledgeNoteViewMode !== "current") {
        setNoteViewMode("directory");
      }
    } else if (getNoteViewMode() !== "current") {
      setNoteViewMode("current");
    }
    var noteViewMode = isTopLevelKnowledgeNode(currentNode) ? getNoteViewMode() : "current";
    var bodyHtml = mode === "note"
      ? (noteViewMode === "directory" ? renderDirectoryMode(currentNode) : renderNoteMode(currentNode, noteContent))
      : renderListMode(currentNode, relatedErrors);

    content.classList.toggle("knowledge-workspace-list-mode", mode === "list");
    content.classList.toggle("knowledge-workspace-note-mode", mode === "note");

    content.innerHTML = "<div class=\"knowledge-workspace-shell\">" +
      renderWorkspaceHeader(currentNode, pathText, directCount, linkedCount, linkedCount, mode) +
      bodyHtml +
    "</div>";

    if (mode === "list") {
      bindKnowledgeWorkspaceScrollListener();
      requestAnimationFrame(function () {
        ensureKnowledgeWorkspaceListScrollable();
        setTimeout(ensureKnowledgeWorkspaceListScrollable, 80);
        setTimeout(ensureKnowledgeWorkspaceListScrollable, 260);
        setTimeout(ensureKnowledgeWorkspaceListScrollable, 520);
      });
    }

    syncNotePreviewViewportHeight();

    if (mode === "note") {
      if (typeof bindNotePreviewScrollTracking === "function") {
        bindNotePreviewScrollTracking(content);
      }
    }

    if (mode === "note" && noteViewMode === "current") {
      if (noteEditing) {
        syncEmbeddedNoteViewers(currentNode, getCurrentNoteMarkdown());
      } else {
        hydrateInlineNotePreview();
      }
    }

    if (mode === "note" && noteViewMode === "current" && noteEditing) {
      bindKnowledgeEditorShortcuts(content);
    }
    if (mode === "note") {
      requestAnimationFrame(function () {
        syncKnowledgeNoteScrollFrames();
        setTimeout(syncKnowledgeNoteScrollFrames, 120);
        setTimeout(syncKnowledgeNoteScrollFrames, 360);
      });
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

  function setKnowledgeNoteViewMode(mode) {
    setNoteViewMode(mode);
    noteEditing = false;
    renderNotesByType();
  }

  function openKnowledgeDirectoryNode(nodeId) {
    kwOpenKnowledgeDirectoryNode(nodeId, {
      setNoteEditing: function (value) { noteEditing = !!value; },
      getKnowledgeNodeById: getKnowledgeNodeById,
      getKnowledgeDescendantNodeIds: getKnowledgeDescendantNodeIds,
      normalizeKnowledgeNoteMarkdown: normalizeKnowledgeNoteMarkdown,
      setDirectoryPreviewNodeId: setDirectoryPreviewNodeId,
      renderNotesByType: renderNotesByType
    });
  }

  window.addEventListener("message", function (event) {
    kwHandleKnowledgeWorkspaceMessage(event, {
      applyNoteViewerHeight: applyNoteViewerHeight,
      syncNotePreviewViewportHeight: syncNotePreviewViewportHeight,
      getCurrentKnowledgeNode: getCurrentKnowledgeNode,
      syncEmbeddedNoteViewers: syncEmbeddedNoteViewers,
      getCurrentNoteMarkdown: getCurrentNoteMarkdown,
      closeEmbeddedKnowledgeNoteEditor: closeEmbeddedKnowledgeNoteEditor,
      setNoteEditing: function (value) { noteEditing = !!value; },
      setSelectedKnowledgeNodeId: function (nodeId) { selectedKnowledgeNodeId = nodeId; },
      renderSidebar: renderSidebar,
      renderNotesByType: renderNotesByType,
      renderNotesPanelRight: renderNotesPanelRight
    });
  });

  window.renderKnowledgeNotesViewV2 = renderKnowledgeNotesViewV2;
  window.getCurrentKnowledgeNode = getCurrentKnowledgeNode;
  window.setCurrentKnowledgeNode = setCurrentKnowledgeNode;
  window.selectKnowledgeLeaf = selectKnowledgeLeaf;
  window.clearKnowledgeNodeFilterView = clearKnowledgeNodeFilterView;
  window.selectNoteType = selectNoteType;
  window.openKnowledgeForError = openKnowledgeForError;
  window.jumpToErrorInList = function (errorId) {
    if (typeof window.__mainJumpToErrorInList === "function") {
      return window.__mainJumpToErrorInList(errorId);
    }
    return jumpToErrorInList(errorId);
  };
  window.liveNotePreview = liveNotePreview;
  window.saveNoteTypeContent = saveNoteTypeContent;
  window.setKnowledgeWorkspaceMode = setKnowledgeWorkspaceMode;
  window.setKnowledgeNoteViewMode = setKnowledgeNoteViewMode;
  window.openKnowledgeDirectoryNode = openKnowledgeDirectoryNode;
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
