(function () {
  var knowledgeNodeDropHint = { nodeId: null, mode: "" };

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
    knowledgeNodeModalState = knmOpenKnowledgeNodeModal(mode, opts, {
      ensureKnowledgeState: ensureKnowledgeState,
      getKnowledgeNodeById: getKnowledgeNodeById,
      toPathText: function (nodeId) {
        return collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId)).join(" > ");
      },
      renderKnowledgeNodeTargetOptions: renderKnowledgeNodeTargetOptions,
      openModal: openModal
    });
  }

  function closeKnowledgeNodeModal() {
    knowledgeNodeModalState = knmCloseKnowledgeNodeModal(closeModal);
  }

  function handleKnowledgeNodeTitleKeydown(event) {
    knmHandleKnowledgeNodeTitleKeydown(event, submitKnowledgeNodeModal);
  }

  function renderKnowledgeNodeTargetOptions() {
    knmRenderKnowledgeNodeTargetOptions(knowledgeNodeModalState, {
      getTargetOptions: knmGetKnowledgeNodeModalTargetOptions,
      escapeHtml: escapeHtml
    });
  }

  function selectKnowledgeNodeModalTarget(nodeId) {
    knowledgeNodeModalState = knmSelectKnowledgeNodeModalTarget(
      knowledgeNodeModalState,
      nodeId,
      renderKnowledgeNodeTargetOptions
    );
  }

  function moveKnowledgeNodeToTarget(nodeId, targetId, opts) {
    return knmMoveKnowledgeNodeToTarget(nodeId, targetId, opts, {
      getKnowledgeNodeById: getKnowledgeNodeById,
      isKnowledgeDescendant: isKnowledgeDescendant,
      findKnowledgeParent: findKnowledgeParent,
      getKnowledgeRootNodes: getKnowledgeRootNodes,
      getKnowledgeDescendantNodeIds: getKnowledgeDescendantNodeIds,
      detachKnowledgeNodeById: detachKnowledgeNodeById,
      mergeKnowledgeNodeIntoTarget: mergeKnowledgeNodeIntoTarget,
      knowledgeExpanded: knowledgeExpanded,
      removeKnowledgeNoteEntry: removeKnowledgeNoteEntry,
      expandKnowledgePath: expandKnowledgePath,
      knmSyncMovedKnowledgeNodeErrors: knmSyncMovedKnowledgeNodeErrors,
      saveData: saveData,
      saveKnowledgeState: saveKnowledgeState,
      showToast: showToast,
      toPathText: function (id) { return collapseKnowledgePathTitles(getKnowledgePathTitles(id)).join(" > "); },
      setCurrentKnowledgeNode: setCurrentKnowledgeNode
    });
  }

  function submitKnowledgeNodeModal() {
    knmSubmitKnowledgeNodeModal(knowledgeNodeModalState || {}, {
      getKnowledgeNodeById: getKnowledgeNodeById,
      normalizeKnowledgeTitle: normalizeKnowledgeTitle,
      findKnowledgeParent: findKnowledgeParent,
      getKnowledgeRootNodes: getKnowledgeRootNodes,
      showToast: showToast,
      saveKnowledgeState: saveKnowledgeState,
      closeKnowledgeNodeModal: closeKnowledgeNodeModal,
      renderSidebar: renderSidebar,
      renderNotesByType: renderNotesByType,
      renderNotesPanelRight: renderNotesPanelRight,
      moveKnowledgeNodeToTarget: moveKnowledgeNodeToTarget,
      ensureKnowledgeChild: ensureKnowledgeChild,
      ensureKnowledgeNoteRecord: ensureKnowledgeNoteRecord,
      expandKnowledgePath: expandKnowledgePath,
      setCurrentKnowledgeNode: setCurrentKnowledgeNode
    });
  }

  function renameKnowledgeNode(nodeId) {
    var node = getKnowledgeNodeById(nodeId);
    if (!node) return;
    openKnowledgeNodeModal("rename", { nodeId: node.id });
  }

  function moveKnowledgeNode(nodeId) {
    var node = getKnowledgeNodeById(nodeId);
    if (!node) return;
    if (!knmGetKnowledgeNodeModalTargetOptions(nodeId).length) {
      showToast("暂无可移动到的目标节点", "warning");
      return;
    }
    openKnowledgeNodeModal("move", { nodeId: node.id });
  }

  function canMoveKnowledgeNode(nodeId) {
    var node = getKnowledgeNodeById(nodeId);
    return !!node && Number(node.level || 0) > 1;
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
    if (childCount || directErrors.length) {
      showToast("不能直接删除「" + node.title + "」：还有 " + childCount + " 个下级、" + directErrors.length + " 道直属题目。请先移动或清理后再删。", "warning");
      return;
    }
    var noteFlag = (node.contentMd || "").trim() ? "\n- 当前节点有笔记内容" : "";
    var ok = confirm("确认删除知识点「" + node.title + "」吗？" + noteFlag + "\n\n此操作不可撤销。");
    if (!ok) return;

    var siblings = parent.children || [];
    var idx = siblings.findIndex(function (item) { return item.id === node.id; });
    if (idx < 0) return;

    siblings.splice(idx, 1);
    parent.isLeaf = siblings.length === 0;
    delete knowledgeNotes[node.id];
    knowledgeExpanded.delete(node.id);
    saveKnowledgeExpanded();
    if (selectedKnowledgeNodeId === node.id) selectedKnowledgeNodeId = parent.id;
    saveData();
    saveKnowledgeState();
    knmRerenderKnowledgeShell();
    showToast("已删除知识点：" + node.title, "success");
  }

  function assignErrorToKnowledgeNode(errorId, targetNodeId, opts) {
    return knmAssignErrorToKnowledgeNode(errorId, targetNodeId, opts, {
      errors: errors,
      getKnowledgeNodeById: getKnowledgeNodeById,
      knmSyncErrorKnowledgeBindingToNode: knmSyncErrorKnowledgeBindingToNode,
      saveData: saveData,
      saveKnowledgeState: saveKnowledgeState,
      setCurrentKnowledgeNode: setCurrentKnowledgeNode,
      knmRerenderKnowledgeShell: knmRerenderKnowledgeShell,
      knowledgeNodeFilter: knowledgeNodeFilter,
      showToast: showToast,
      toPathText: function (nodeId) {
        return collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId)).join(" > ");
      }
    });
  }

  function startKnowledgeNodeDrag(nodeId, event) {
    knmStartKnowledgeNodeDrag(nodeId, event, {
      setDraggingKnowledgeNodeId: function (value) { draggingKnowledgeNodeId = value; },
      setDraggingErrorId: function (value) { draggingErrorId = value; }
    });
  }

  function endKnowledgeNodeDrag() {
    knmEndKnowledgeNodeDrag(clearKnowledgeDropIndicators, {
      setDraggingKnowledgeNodeId: function (value) { draggingKnowledgeNodeId = value; }
    });
  }

  function startErrorDrag(errorId, event) {
    knmStartErrorDrag(errorId, event, {
      setDraggingErrorId: function (value) { draggingErrorId = value; },
      setDraggingKnowledgeNodeId: function (value) { draggingKnowledgeNodeId = value; }
    });
  }

  function endErrorDrag() {
    knmEndErrorDrag(clearKnowledgeDropIndicators, {
      setDraggingErrorId: function (value) { draggingErrorId = value; }
    });
  }

  function clearKnowledgeDropIndicators() {
    knmClearKnowledgeDropIndicators(knowledgeNodeDropHint);
  }

  function resolveKnowledgeDropMode(event, el) {
    return knmResolveKnowledgeDropMode(event, el);
  }

  function canDropKnowledgeNodeToMode(fromNodeId, toNodeId, mode) {
    return knmCanDropKnowledgeNodeToMode(fromNodeId, toNodeId, mode, isKnowledgeDescendant);
  }

  function moveKnowledgeNodeToSiblingPosition(nodeId, targetId, mode) {
    return knmMoveKnowledgeNodeToSiblingPosition(nodeId, targetId, mode, {
      getKnowledgeNodeById: getKnowledgeNodeById,
      isKnowledgeDescendant: isKnowledgeDescendant,
      showToast: showToast,
      findKnowledgeParent: findKnowledgeParent,
      getKnowledgeRootNodes: getKnowledgeRootNodes,
      getKnowledgeDescendantNodeIds: getKnowledgeDescendantNodeIds,
      knmSyncMovedKnowledgeNodeErrors: knmSyncMovedKnowledgeNodeErrors,
      saveData: saveData,
      saveKnowledgeState: saveKnowledgeState,
      expandKnowledgePath: expandKnowledgePath,
      setCurrentKnowledgeNode: setCurrentKnowledgeNode
    });
  }

  function allowKnowledgeDrop(event, nodeId) {
    knmAllowKnowledgeDrop(event, nodeId, {
      draggingKnowledgeNodeId: draggingKnowledgeNodeId,
      draggingErrorId: draggingErrorId,
      clearKnowledgeDropIndicators: clearKnowledgeDropIndicators,
      isKnowledgeDescendant: isKnowledgeDescendant,
      knowledgeNodeDropHint: knowledgeNodeDropHint
    });
  }

  function leaveKnowledgeDrop(event) {
    knmLeaveKnowledgeDrop(event);
  }

  function handleKnowledgeDrop(nodeId, event) {
    knmHandleKnowledgeDrop(nodeId, event, {
      knowledgeNodeDropHint: knowledgeNodeDropHint,
      clearKnowledgeDropIndicators: clearKnowledgeDropIndicators,
      draggingKnowledgeNodeId: draggingKnowledgeNodeId,
      draggingErrorId: draggingErrorId,
      moveKnowledgeNodeToSiblingPosition: moveKnowledgeNodeToSiblingPosition,
      moveKnowledgeNodeToTarget: moveKnowledgeNodeToTarget,
      endKnowledgeNodeDrag: endKnowledgeNodeDrag,
      assignErrorToKnowledgeNode: assignErrorToKnowledgeNode,
      endErrorDrag: endErrorDrag
    });
  }

  function moveErrorToKnowledgeNode(errorId, preferredNodeId) {
    var nextState = knmMoveErrorToKnowledgeNode(errorId, preferredNodeId, {
      errors: errors,
      toPathText: function (nodeId) {
        return collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId)).join(" > ");
      },
      renderKnowledgeMoveOptions: renderKnowledgeMoveOptions,
      openModal: openModal
    });
    pendingKnowledgeMoveErrorId = nextState.pendingErrorId;
    pendingKnowledgeMoveTargetId = nextState.pendingTargetId;
  }

  function closeKnowledgeMoveModal() {
    var nextState = knmCloseKnowledgeMoveModal(closeModal);
    pendingKnowledgeMoveErrorId = nextState.pendingErrorId;
    pendingKnowledgeMoveTargetId = nextState.pendingTargetId;
  }

  function renderKnowledgeMoveOptions() {
    knmRenderKnowledgeMoveOptions(
      { pendingErrorId: pendingKnowledgeMoveErrorId, pendingTargetId: pendingKnowledgeMoveTargetId },
      {
        getKnowledgePathOptions: knmGetKnowledgePathOptions,
        errors: errors,
        escapeHtml: escapeHtml
      }
    );
  }

  function selectKnowledgeMoveTarget(nodeId) {
    var nextState = knmSelectKnowledgeMoveTarget(
      { pendingErrorId: pendingKnowledgeMoveErrorId, pendingTargetId: pendingKnowledgeMoveTargetId },
      nodeId,
      renderKnowledgeMoveOptions
    );
    pendingKnowledgeMoveErrorId = nextState.pendingErrorId;
    pendingKnowledgeMoveTargetId = nextState.pendingTargetId;
  }

  function getErrorKnowledgeNodeId(errorId) {
    return knmGetErrorKnowledgeNodeId(errorId, errors);
  }

  function applyKnowledgeMove() {
    var result = knmApplyKnowledgeMove(
      { pendingErrorId: pendingKnowledgeMoveErrorId, pendingTargetId: pendingKnowledgeMoveTargetId },
      {
        errors: errors,
        getKnowledgeNodeById: getKnowledgeNodeById,
        showToast: showToast,
        assignErrorToKnowledgeNode: assignErrorToKnowledgeNode
      }
    );
    if (result && result.closeModal) {
      closeKnowledgeMoveModal();
    }
  }

  if (typeof window.openKnowledgeNodeModal !== "function") window.openKnowledgeNodeModal = openKnowledgeNodeModal;
  if (typeof window.getKnowledgePathOptions !== "function") window.getKnowledgePathOptions = knmGetKnowledgePathOptions;
  if (typeof window.getKnowledgeNodeModalTargetOptions !== "function") window.getKnowledgeNodeModalTargetOptions = knmGetKnowledgeNodeModalTargetOptions;
  if (typeof window.chooseKnowledgeNodeByPrompt !== "function") window.chooseKnowledgeNodeByPrompt = knmChooseKnowledgeNodeByPrompt;
  if (typeof window.addKnowledgeLeafUnderSelected !== "function") window.addKnowledgeLeafUnderSelected = addKnowledgeLeafUnderSelected;
  if (typeof window.closeKnowledgeNodeModal !== "function") window.closeKnowledgeNodeModal = closeKnowledgeNodeModal;
  if (typeof window.handleKnowledgeNodeTitleKeydown !== "function") window.handleKnowledgeNodeTitleKeydown = handleKnowledgeNodeTitleKeydown;
  if (typeof window.renderKnowledgeNodeTargetOptions !== "function") window.renderKnowledgeNodeTargetOptions = renderKnowledgeNodeTargetOptions;
  if (typeof window.selectKnowledgeNodeModalTarget !== "function") window.selectKnowledgeNodeModalTarget = selectKnowledgeNodeModalTarget;
  if (typeof window.submitKnowledgeNodeModal !== "function") window.submitKnowledgeNodeModal = submitKnowledgeNodeModal;
  if (typeof window.renameKnowledgeNode !== "function") window.renameKnowledgeNode = renameKnowledgeNode;
  if (typeof window.moveKnowledgeNodeToTarget !== "function") window.moveKnowledgeNodeToTarget = moveKnowledgeNodeToTarget;
  if (typeof window.moveKnowledgeNodeToSiblingPosition !== "function") window.moveKnowledgeNodeToSiblingPosition = moveKnowledgeNodeToSiblingPosition;
  if (typeof window.canMoveKnowledgeNode !== "function") window.canMoveKnowledgeNode = canMoveKnowledgeNode;
  if (typeof window.moveKnowledgeNode !== "function") window.moveKnowledgeNode = moveKnowledgeNode;
  if (typeof window.deleteKnowledgeNode !== "function") window.deleteKnowledgeNode = deleteKnowledgeNode;
  if (typeof window.assignErrorToKnowledgeNode !== "function") window.assignErrorToKnowledgeNode = assignErrorToKnowledgeNode;
  if (typeof window.startKnowledgeNodeDrag !== "function") window.startKnowledgeNodeDrag = startKnowledgeNodeDrag;
  if (typeof window.endKnowledgeNodeDrag !== "function") window.endKnowledgeNodeDrag = endKnowledgeNodeDrag;
  if (typeof window.startErrorDrag !== "function") window.startErrorDrag = startErrorDrag;
  if (typeof window.endErrorDrag !== "function") window.endErrorDrag = endErrorDrag;
  if (typeof window.allowKnowledgeDrop !== "function") window.allowKnowledgeDrop = allowKnowledgeDrop;
  if (typeof window.leaveKnowledgeDrop !== "function") window.leaveKnowledgeDrop = leaveKnowledgeDrop;
  if (typeof window.handleKnowledgeDrop !== "function") window.handleKnowledgeDrop = handleKnowledgeDrop;
  if (typeof window.moveErrorToKnowledgeNode !== "function") window.moveErrorToKnowledgeNode = moveErrorToKnowledgeNode;
  if (typeof window.closeKnowledgeMoveModal !== "function") window.closeKnowledgeMoveModal = closeKnowledgeMoveModal;
  if (typeof window.renderKnowledgeMoveOptions !== "function") window.renderKnowledgeMoveOptions = renderKnowledgeMoveOptions;
  if (typeof window.selectKnowledgeMoveTarget !== "function") window.selectKnowledgeMoveTarget = selectKnowledgeMoveTarget;
  if (typeof window.getErrorKnowledgeNodeId !== "function") window.getErrorKnowledgeNodeId = getErrorKnowledgeNodeId;
  if (typeof window.applyKnowledgeMove !== "function") window.applyKnowledgeMove = applyKnowledgeMove;
})();
