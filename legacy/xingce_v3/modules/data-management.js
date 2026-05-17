(function () {
  function rerenderAfterDataChange() {
    if (typeof refreshWorkspaceAfterKnowledgeDataChange === "function") {
      refreshWorkspaceAfterKnowledgeDataChange({ sidebar: true, notes: true, rightPanel: true });
      return;
    }
    if (typeof knowledgeErrorCountCacheVersion !== "undefined") knowledgeErrorCountCacheVersion += 1;
    if (typeof knowledgeErrorCountCache !== "undefined") knowledgeErrorCountCache = { version: -1, direct: new Map(), aggregate: new Map() };
    if (typeof knowledgeNoteRenderCache !== "undefined" && knowledgeNoteRenderCache && typeof knowledgeNoteRenderCache.clear === "function") knowledgeNoteRenderCache.clear();
    if (typeof resetKnowledgeTreeRenderWindow === "function") resetKnowledgeTreeRenderWindow();
    renderSidebar();
    renderAll();
    renderNotesByType();
    renderNotesPanelRight();
  }

  function persistClearedErrors() {
    batchSelected = new Set();
    saveData();
    saveReveal();
    rerenderAfterDataChange();
  }

  function deleteErrorsByIds(ids) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    var idSet = new Set(ids);
    var before = errors.length;
    errors = errors.filter(function (item) { return !idSet.has(item.id); });
    ids.forEach(function (id) { revealed.delete(id); });
    persistClearedErrors();
    return before - errors.length;
  }

  function getCurrentModuleContext() {
    if (knowledgeNodeFilter) {
      var node = getKnowledgeNodeById(knowledgeNodeFilter);
      if (!node) return null;
      var ids = new Set(getKnowledgeDescendantNodeIds(node));
      return {
        label: collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(" > "),
        errorIds: errors.filter(function (item) { return ids.has(item.noteNodeId); }).map(function (item) { return item.id; })
      };
    }

    if (selectedKnowledgeNodeId && document.getElementById("tabContentNotes") && document.getElementById("tabContentNotes").classList.contains("active")) {
      var currentNode = getKnowledgeNodeById(selectedKnowledgeNodeId);
      if (!currentNode) return null;
      var currentIds = new Set(getKnowledgeDescendantNodeIds(currentNode));
      return {
        label: collapseKnowledgePathTitles(getKnowledgePathTitles(currentNode.id)).join(" > "),
        errorIds: errors.filter(function (item) { return currentIds.has(item.noteNodeId); }).map(function (item) { return item.id; })
      };
    }

    if (typeFilter) {
      var filtered = errors.filter(function (e) {
        if (typeFilter.level === "type") return e.type === typeFilter.value;
        if (typeFilter.level === "subtype") return e.type === typeFilter.type && e.subtype === typeFilter.value;
        if (typeFilter.level === "sub2") return e.type === typeFilter.type && e.subtype === typeFilter.subtype && e.subSubtype === typeFilter.value;
        return false;
      });
      var label = typeFilter.level === "type"
        ? typeFilter.value
        : typeFilter.level === "subtype"
          ? (typeFilter.type + " > " + typeFilter.value)
          : (typeFilter.type + " > " + typeFilter.subtype + " > " + typeFilter.value);
      return { label: label, errorIds: filtered.map(function (item) { return item.id; }) };
    }

    return null;
  }

  function clearCurrentModuleErrors() {
    var context = getCurrentModuleContext();
    if (!context) {
      showToast("请先选中一个知识点模块或题型筛选。", "warning");
      return;
    }
    if (!context.errorIds.length) {
      showToast("当前模块下没有可删除的题目。", "warning");
      return;
    }
    var ok = confirm("确认清空当前模块题目吗？\n\n模块：" + context.label + "\n题目数：" + context.errorIds.length + "\n\n此操作不可恢复。");
    if (!ok) return;
    var removed = deleteErrorsByIds(context.errorIds);
    showToast("已清空当前模块题目 " + removed + " 道", "success");
  }

  function clearAllErrorsData() {
    if (!errors.length) {
      showToast("当前没有题目可清空。", "warning");
      return;
    }
    var ok = confirm("确认清空全部题目吗？\n\n当前共 " + errors.length + " 道题目。\n\n此操作不可恢复。");
    if (!ok) return;
    var removed = deleteErrorsByIds(errors.map(function (item) { return item.id; }));
    knowledgeNodeFilter = null;
    typeFilter = null;
    showToast("已清空全部题目 " + removed + " 道", "success");
  }

  function resetAllStudyData() {
    var totalErrors = errors.length;
    var totalLegacyNotes = Object.keys(notesByType || {}).length;
    var totalKnowledgeNotes = Object.keys(knowledgeNotes || {}).length;
    var ok = confirm(
      "确认重置全部学习数据吗？\n\n" +
      "- 题目：" + totalErrors + " 道\n" +
      "- 旧题型笔记：" + totalLegacyNotes + " 个\n" +
      "- 知识点笔记：" + totalKnowledgeNotes + " 个\n\n" +
      "账号、目录规则和登录状态会保留。\n此操作不可恢复。"
    );
    if (!ok) return;

    errors = [];
    revealed = new Set();
    notesByType = {};
    noteImages = {};
    globalNote = "";
    knowledgeTree = createDefaultKnowledgeTree();
    knowledgeNotes = {};
    selectedKnowledgeNodeId = null;
    knowledgeNodeFilter = null;
    typeFilter = null;
    noteEditing = false;

    DB.set(KEY_GLOBAL_NOTE, "");
    DB.set(KEY_HISTORY, "[]");
    DB.set(KEY_TODAY_DONE, "0");
    DB.set(KEY_TODAY_DATE, today());
    saveNotesByType();
    saveKnowledgeState();
    persistClearedErrors();

    showToast("全部学习数据已重置", "success");
  }

  window.clearCurrentModuleErrors = clearCurrentModuleErrors;
  window.clearAllErrorsData = clearAllErrorsData;
  window.resetAllStudyData = resetAllStudyData;
})();
