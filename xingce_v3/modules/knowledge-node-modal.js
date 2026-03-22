(function () {
  function rerenderKnowledgeShell() {
    renderSidebar();
    renderAll();
    renderNotesByType();
    renderNotesPanelRight();
  }

  function addKnowledgeLeafUnderSelected() {
    ensureKnowledgeState();
    var current = getKnowledgeNodeById(selectedKnowledgeNodeId);
    var parent = current || findKnowledgeBranchForModal(true);
    if (!parent) {
      showToast("请先选择一个知识点节点", "warning");
      return;
    }
    var fallback = parent && parent.title ? (parent.title + "补充") : "新知识点";
    openKnowledgeNodeModal("create-child", { parentId: parent.id, fallbackTitle: fallback });
  }

  function openKnowledgeNodeModal(mode, opts) {
    ensureKnowledgeState();
    knowledgeNodeModalState = Object.assign({
      mode: mode,
      nodeId: null,
      parentId: null,
      targetId: null,
      fallbackTitle: "",
      afterSubmit: null
    }, opts || {});

    var titleEl = document.getElementById("knowledgeNodeModalTitle");
    var subtitleEl = document.getElementById("knowledgeNodeModalSubtitle");
    var titleGroup = document.getElementById("knowledgeNodeTitleGroup");
    var titleLabel = document.getElementById("knowledgeNodeTitleLabel");
    var titleInput = document.getElementById("knowledgeNodeTitleInput");
    var targetGroup = document.getElementById("knowledgeNodeTargetGroup");
    var searchInput = document.getElementById("knowledgeNodeTargetSearch");
    if (!titleEl || !subtitleEl || !titleGroup || !titleLabel || !titleInput || !targetGroup || !searchInput) return;

    var node = knowledgeNodeModalState.nodeId ? getKnowledgeNodeById(knowledgeNodeModalState.nodeId) : null;
    var parent = knowledgeNodeModalState.parentId ? getKnowledgeNodeById(knowledgeNodeModalState.parentId) : null;

    if (mode === "rename") {
      if (!node) return;
      titleEl.textContent = "重命名知识点";
      subtitleEl.textContent = "当前节点：" + collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(" > ");
      titleLabel.textContent = "新的节点名称";
      titleInput.value = node.title || "";
      titleGroup.style.display = "";
      targetGroup.style.display = "none";
    } else if (mode === "move") {
      if (!node) return;
      titleEl.textContent = "移动知识点";
      subtitleEl.textContent = "当前节点：" + collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(" > ") + "。请选择新的父节点。";
      titleGroup.style.display = "none";
      targetGroup.style.display = "";
      searchInput.value = "";
      knowledgeNodeModalState.targetId = null;
      renderKnowledgeNodeTargetOptions();
    } else {
      if (!parent) return;
      titleEl.textContent = "新建下级知识点";
      subtitleEl.textContent = "父节点：" + collapseKnowledgePathTitles(getKnowledgePathTitles(parent.id)).join(" > ");
      titleLabel.textContent = "知识点名称";
      titleInput.value = knowledgeNodeModalState.fallbackTitle || "";
      titleGroup.style.display = "";
      targetGroup.style.display = "none";
    }

    openModal("knowledgeNodeModal");
    setTimeout(function () {
      if (mode === "move") searchInput.focus();
      else titleInput.focus();
      if (mode !== "move") titleInput.select();
    }, 10);
  }

  function closeKnowledgeNodeModal() {
    knowledgeNodeModalState = { mode: "", nodeId: null, parentId: null, targetId: null, fallbackTitle: "" };
    closeModal("knowledgeNodeModal");
  }

  function handleKnowledgeNodeTitleKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitKnowledgeNodeModal();
    }
  }

  function renderKnowledgeNodeTargetOptions() {
    var list = document.getElementById("knowledgeNodeTargetList");
    var searchInput = document.getElementById("knowledgeNodeTargetSearch");
    if (!list || !searchInput || knowledgeNodeModalState.mode !== "move") return;

    var keyword = searchInput.value.trim().toLowerCase();
    var filtered = getKnowledgeNodeModalTargetOptions(knowledgeNodeModalState.nodeId).filter(function (item) {
      if (!keyword) return true;
      return item.label.toLowerCase().includes(keyword) || item.node.title.toLowerCase().includes(keyword);
    });

    if (!filtered.length) {
      list.innerHTML = '<div class="knowledge-move-empty">没有匹配的目标知识点</div>';
      return;
    }

    list.innerHTML = filtered.map(function (item) {
      var active = knowledgeNodeModalState.targetId === item.id ? " active" : "";
      return "<div class=\"knowledge-move-item" + active + "\" onclick=\"selectKnowledgeNodeModalTarget('" + item.id + "')\">" +
        "<div class=\"knowledge-move-item-title\">" + escapeHtml(item.node.title) + "</div>" +
        "<div class=\"knowledge-move-item-path\">" + escapeHtml(item.label) + "</div>" +
      "</div>";
    }).join("");
  }

  function selectKnowledgeNodeModalTarget(nodeId) {
    knowledgeNodeModalState.targetId = nodeId;
    renderKnowledgeNodeTargetOptions();
  }

  function moveKnowledgeNodeToTarget(nodeId, targetId, opts) {
    var node = getKnowledgeNodeById(nodeId);
    var target = getKnowledgeNodeById(targetId);
    if (!node || !target) return false;
    if (node.id === target.id) {
      showToast("不能移动到自己", "warning");
      return false;
    }
    if (isKnowledgeDescendant(node.id, target.id)) {
      showToast("不能移动到自己的下级节点", "error");
      return false;
    }

    var oldParent = findKnowledgeParent(node.id);
    if (!oldParent) {
      showToast("一级节点暂不支持移动", "warning");
      return false;
    }

    target.children = target.children || [];
    if (target.children.some(function (item) { return item.id !== node.id && item.title === node.title; })) {
      showToast("目标节点下已存在同名节点", "error");
      return false;
    }

    var oldList = oldParent.children || [];
    var idx = oldList.findIndex(function (item) { return item.id === node.id; });
    if (idx < 0) return false;

    oldList.splice(idx, 1);
    target.children.push(node);
    oldParent.isLeaf = oldList.length === 0;
    target.isLeaf = false;
    expandKnowledgePath(target.id);
    saveKnowledgeState();

    if (!opts || !opts.silent) {
      showToast("节点已移动到：" + collapseKnowledgePathTitles(getKnowledgePathTitles(target.id)).join(" > "), "success");
    }
    setCurrentKnowledgeNode(node.id, { switchTab: false });
    return true;
  }

  function submitKnowledgeNodeModal() {
    var state = knowledgeNodeModalState || {};

    if (state.mode === "rename") {
      var node = getKnowledgeNodeById(state.nodeId);
      if (!node) return;
      var nextTitle = document.getElementById("knowledgeNodeTitleInput") ? document.getElementById("knowledgeNodeTitleInput").value : "";
      var title = normalizeKnowledgeTitle(nextTitle, node.title);
      if (title === node.title) {
        closeKnowledgeNodeModal();
        return;
      }
      var parent = findKnowledgeParent(node.id);
      var siblings = parent ? (parent.children || []) : getKnowledgeRootNodes();
      if (siblings.some(function (item) { return item.id !== node.id && item.title === title; })) {
        showToast("同级下已存在同名节点", "error");
        return;
      }
      node.title = title;
      node.updatedAt = new Date().toISOString();
      saveKnowledgeState();
      closeKnowledgeNodeModal();
      showToast("节点已重命名", "success");
      renderSidebar();
      renderNotesByType();
      renderNotesPanelRight();
      return;
    }

    if (state.mode === "move") {
      if (!state.targetId) {
        showToast("请选择目标父节点", "warning");
        return;
      }
      var moved = moveKnowledgeNodeToTarget(state.nodeId, state.targetId, { silent: false });
      if (moved) closeKnowledgeNodeModal();
      return;
    }

    var createParent = getKnowledgeNodeById(state.parentId);
    if (!createParent) return;
    var rawTitle = document.getElementById("knowledgeNodeTitleInput") ? document.getElementById("knowledgeNodeTitleInput").value : "";
    var childTitle = normalizeKnowledgeTitle(rawTitle, state.fallbackTitle || "新知识点");
    if ((createParent.children || []).some(function (item) { return item.title === childTitle; })) {
      showToast("同级下已存在同名节点", "error");
      return;
    }
    var child = ensureKnowledgeChild(createParent.children, childTitle, (createParent.level || 1) + 1, true);
    if (!child.contentMd) {
      child.contentMd = "# " + child.title + "\n\n";
      child.updatedAt = new Date().toISOString();
    }
    createParent.isLeaf = false;
    ensureKnowledgeNoteRecord(child);
    expandKnowledgePath(createParent.id);
    saveKnowledgeState();
    closeKnowledgeNodeModal();
    if (typeof state.afterSubmit === "function") state.afterSubmit(child);
    setCurrentKnowledgeNode(child.id, { switchTab: false });
    showToast("已新建知识点：" + child.title, "success");
  }

  function renameKnowledgeNode(nodeId) {
    var node = getKnowledgeNodeById(nodeId);
    if (!node) return;
    openKnowledgeNodeModal("rename", { nodeId: node.id });
  }

  function moveKnowledgeNode(nodeId) {
    var node = getKnowledgeNodeById(nodeId);
    if (!node) return;
    if (!getKnowledgeNodeModalTargetOptions(nodeId).length) {
      showToast("暂无可移动到的目标节点", "warning");
      return;
    }
    openKnowledgeNodeModal("move", { nodeId: node.id });
  }

  function deleteKnowledgeNode(nodeId) {
    var node = getKnowledgeNodeById(nodeId);
    var parent = findKnowledgeParent(nodeId);
    if (!node) return;
    if (!parent) {
      showToast("一级节点暂不支持删除", "warning");
      return;
    }
    var directErrors = errors.filter(function (item) { return item.noteNodeId === node.id; });
    var childCount = (node.children || []).length;
    var noteFlag = (node.contentMd || "").trim() ? "\n- 当前节点有笔记内容" : "";
    var childFlag = childCount ? ("\n- 当前节点有 " + childCount + " 个下级，删除后会自动上提到父节点") : "";
    var errorFlag = directErrors.length ? ("\n- 当前节点直属挂了 " + directErrors.length + " 道错题，删除后会自动移动到父节点") : "";
    var ok = confirm("确认删除知识点「" + node.title + "」吗？" + noteFlag + childFlag + errorFlag + "\n\n此操作不可撤销。");
    if (!ok) return;

    var siblings = parent.children || [];
    var idx = siblings.findIndex(function (item) { return item.id === node.id; });
    if (idx < 0) return;

    directErrors.forEach(function (item) { item.noteNodeId = parent.id; });
    siblings.splice.apply(siblings, [idx, 1].concat(node.children || []));
    parent.isLeaf = siblings.length === 0;
    delete knowledgeNotes[node.id];
    knowledgeExpanded.delete(node.id);
    saveKnowledgeExpanded();
    if (selectedKnowledgeNodeId === node.id) selectedKnowledgeNodeId = parent.id;
    saveData();
    saveKnowledgeState();
    rerenderKnowledgeShell();
    showToast("已删除知识点：" + node.title, "success");
  }

  function assignErrorToKnowledgeNode(errorId, targetNodeId, opts) {
    var errorItem = errors.find(function (item) { return item.id === errorId; });
    var targetNode = getKnowledgeNodeById(targetNodeId);
    if (!errorItem || !targetNode) return false;

    var previousNodeId = errorItem.noteNodeId || null;
    errorItem.noteNodeId = targetNode.id;
    saveData();
    saveKnowledgeState();

    if (opts && opts.focusNode) {
      setCurrentKnowledgeNode(targetNode.id, { switchTab: false });
    } else {
      rerenderKnowledgeShell();
    }

    if (!opts || !opts.silent) {
      if (previousNodeId && knowledgeNodeFilter === previousNodeId && previousNodeId !== targetNode.id) {
        showToast("已改挂载到：" + collapseKnowledgePathTitles(getKnowledgePathTitles(targetNode.id)).join(" > ") + "，该题已移出原知识点视图。", "success");
      } else {
        showToast("已改挂载到：" + collapseKnowledgePathTitles(getKnowledgePathTitles(targetNode.id)).join(" > "), "success");
      }
    }
    return true;
  }

  function startKnowledgeNodeDrag(nodeId, event) {
    draggingKnowledgeNodeId = nodeId;
    draggingErrorId = null;
    if (event && event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "knowledge-node:" + nodeId);
    }
    var el = document.querySelector("[data-knowledge-node-id=\"" + nodeId + "\"]");
    if (el) el.classList.add("knowledge-dragging");
  }

  function endKnowledgeNodeDrag() {
    draggingKnowledgeNodeId = null;
    document.querySelectorAll(".knowledge-dragging").forEach(function (el) { el.classList.remove("knowledge-dragging"); });
    document.querySelectorAll(".knowledge-drop-over").forEach(function (el) { el.classList.remove("knowledge-drop-over"); });
  }

  function startErrorDrag(errorId, event) {
    draggingErrorId = errorId;
    draggingKnowledgeNodeId = null;
    if (event && event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "knowledge-error:" + errorId);
    }
  }

  function endErrorDrag() {
    draggingErrorId = null;
    document.querySelectorAll(".knowledge-drop-over").forEach(function (el) { el.classList.remove("knowledge-drop-over"); });
  }

  function allowKnowledgeDrop(event, nodeId) {
    if (!draggingKnowledgeNodeId && !draggingErrorId) return;
    event.preventDefault();
    var el = document.querySelector("[data-knowledge-node-id=\"" + nodeId + "\"]");
    if (el) el.classList.add("knowledge-drop-over");
  }

  function leaveKnowledgeDrop(event) {
    if (event && event.currentTarget) event.currentTarget.classList.remove("knowledge-drop-over");
  }

  function handleKnowledgeDrop(nodeId, event) {
    event.preventDefault();
    event.stopPropagation();
    document.querySelectorAll(".knowledge-drop-over").forEach(function (el) { el.classList.remove("knowledge-drop-over"); });
    if (draggingKnowledgeNodeId) {
      moveKnowledgeNodeToTarget(draggingKnowledgeNodeId, nodeId);
      endKnowledgeNodeDrag();
      return;
    }
    if (draggingErrorId) {
      assignErrorToKnowledgeNode(draggingErrorId, nodeId, { focusNode: true });
      endErrorDrag();
    }
  }

  function moveErrorToKnowledgeNode(errorId, preferredNodeId) {
    var errorItem = errors.find(function (item) { return item.id === errorId; });
    if (!errorItem) return;
    pendingKnowledgeMoveErrorId = errorId;
    pendingKnowledgeMoveTargetId = preferredNodeId || errorItem.noteNodeId || null;
    var currentText = errorItem.noteNodeId
      ? collapseKnowledgePathTitles(getKnowledgePathTitles(errorItem.noteNodeId)).join(" > ")
      : "未关联知识点";
    var currentEl = document.getElementById("knowledgeMoveCurrent");
    if (currentEl) currentEl.textContent = "当前知识点：" + currentText;
    var search = document.getElementById("knowledgeMoveSearch");
    if (search) search.value = "";
    renderKnowledgeMoveOptions();
    openModal("knowledgeMoveModal");
  }

  function closeKnowledgeMoveModal() {
    pendingKnowledgeMoveErrorId = null;
    pendingKnowledgeMoveTargetId = null;
    closeModal("knowledgeMoveModal");
  }

  function renderKnowledgeMoveOptions() {
    var list = document.getElementById("knowledgeMoveList");
    if (!list) return;
    var search = (document.getElementById("knowledgeMoveSearch") ? document.getElementById("knowledgeMoveSearch").value : "").trim().toLowerCase();
    var options = getKnowledgePathOptions(false, null).filter(function (item) {
      if (!search) return true;
      return item.label.toLowerCase().includes(search) || item.node.title.toLowerCase().includes(search);
    });
    if (!options.length) {
      list.innerHTML = '<div class="knowledge-move-empty">没有匹配的知识点</div>';
      return;
    }
    list.innerHTML = options.map(function (item) {
      return "<div class=\"knowledge-move-item " + (item.id === pendingKnowledgeMoveTargetId ? "active" : "") + "\" onclick=\"selectKnowledgeMoveTarget('" + item.id + "')\">" +
        "<div class=\"knowledge-move-item-title\">" + escapeHtml(item.node.title) + "</div>" +
        "<div class=\"knowledge-move-item-path\">" + escapeHtml(item.label) + "</div>" +
        (item.id === getErrorKnowledgeNodeId(pendingKnowledgeMoveErrorId) ? '<div class="knowledge-move-item-current">当前挂载</div>' : "") +
      "</div>";
    }).join("");
  }

  function selectKnowledgeMoveTarget(nodeId) {
    pendingKnowledgeMoveTargetId = nodeId;
    renderKnowledgeMoveOptions();
  }

  function getErrorKnowledgeNodeId(errorId) {
    var errorItem = errors.find(function (item) { return item.id === errorId; });
    return errorItem ? (errorItem.noteNodeId || null) : null;
  }

  function applyKnowledgeMove() {
    var errorItem = errors.find(function (item) { return item.id === pendingKnowledgeMoveErrorId; });
    if (!errorItem) {
      closeKnowledgeMoveModal();
      return;
    }
    if (!pendingKnowledgeMoveTargetId) {
      showToast("请选择目标知识点", "warning");
      return;
    }
    var targetNode = getKnowledgeNodeById(pendingKnowledgeMoveTargetId);
    if (!targetNode) {
      showToast("目标知识点无效", "error");
      return;
    }
    closeKnowledgeMoveModal();
    assignErrorToKnowledgeNode(errorItem.id, targetNode.id, { focusNode: true });
  }

  window.openKnowledgeNodeModal = openKnowledgeNodeModal;
  window.addKnowledgeLeafUnderSelected = addKnowledgeLeafUnderSelected;
  window.closeKnowledgeNodeModal = closeKnowledgeNodeModal;
  window.handleKnowledgeNodeTitleKeydown = handleKnowledgeNodeTitleKeydown;
  window.renderKnowledgeNodeTargetOptions = renderKnowledgeNodeTargetOptions;
  window.selectKnowledgeNodeModalTarget = selectKnowledgeNodeModalTarget;
  window.submitKnowledgeNodeModal = submitKnowledgeNodeModal;
  window.renameKnowledgeNode = renameKnowledgeNode;
  window.moveKnowledgeNodeToTarget = moveKnowledgeNodeToTarget;
  window.moveKnowledgeNode = moveKnowledgeNode;
  window.deleteKnowledgeNode = deleteKnowledgeNode;
  window.assignErrorToKnowledgeNode = assignErrorToKnowledgeNode;
  window.startKnowledgeNodeDrag = startKnowledgeNodeDrag;
  window.endKnowledgeNodeDrag = endKnowledgeNodeDrag;
  window.startErrorDrag = startErrorDrag;
  window.endErrorDrag = endErrorDrag;
  window.allowKnowledgeDrop = allowKnowledgeDrop;
  window.leaveKnowledgeDrop = leaveKnowledgeDrop;
  window.handleKnowledgeDrop = handleKnowledgeDrop;
  window.moveErrorToKnowledgeNode = moveErrorToKnowledgeNode;
  window.closeKnowledgeMoveModal = closeKnowledgeMoveModal;
  window.renderKnowledgeMoveOptions = renderKnowledgeMoveOptions;
  window.selectKnowledgeMoveTarget = selectKnowledgeMoveTarget;
  window.getErrorKnowledgeNodeId = getErrorKnowledgeNodeId;
  window.applyKnowledgeMove = applyKnowledgeMove;
})();
