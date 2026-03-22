(function () {
  function normalizeKnowledgeTitle(value, fallback) {
    var text = (value || "").trim();
    return text || fallback;
  }

  function createKnowledgeNode(title, level, isLeaf) {
    return {
      id: newKnowledgeNodeId(),
      title: title,
      level: level,
      contentMd: "",
      updatedAt: "",
      isLeaf: !!isLeaf,
      children: []
    };
  }

  function createDefaultKnowledgeTree() {
    var roots = FIXED_TYPES.map(function (type) { return createKnowledgeNode(type, 1, false); });
    if (!roots.some(function (node) { return node.title === "未分类"; })) {
      roots.push(createKnowledgeNode("未分类", 1, false));
    }
    return { version: 1, roots: roots };
  }

  function getKnowledgeRootNodes() {
    if (!knowledgeTree || !Array.isArray(knowledgeTree.roots)) {
      knowledgeTree = createDefaultKnowledgeTree();
    }
    return knowledgeTree.roots;
  }

  function findKnowledgeNodeById(nodeId, nodes) {
    var list = nodes || getKnowledgeRootNodes();
    for (var i = 0; i < list.length; i += 1) {
      var node = list[i];
      if (node.id === nodeId) return node;
      var found = findKnowledgeNodeById(nodeId, node.children || []);
      if (found) return found;
    }
    return null;
  }

  function getKnowledgeNodeById(nodeId) {
    if (!nodeId) return null;
    return findKnowledgeNodeById(nodeId, getKnowledgeRootNodes());
  }

  function findKnowledgeParent(nodeId, nodes, parent) {
    var list = nodes || getKnowledgeRootNodes();
    for (var i = 0; i < list.length; i += 1) {
      var node = list[i];
      if (node.id === nodeId) return parent || null;
      var found = findKnowledgeParent(nodeId, node.children || [], node);
      if (found) return found;
    }
    return null;
  }

  function ensureKnowledgeChild(children, title, level, isLeaf) {
    var node = (children || []).find(function (item) { return item.title === title; });
    if (!node) {
      node = createKnowledgeNode(title, level, isLeaf);
      children.push(node);
    }
    if (!Array.isArray(node.children)) node.children = [];
    if (typeof node.contentMd !== "string") node.contentMd = "";
    if (typeof node.updatedAt !== "string") node.updatedAt = "";
    node.level = level;
    node.isLeaf = node.children.length === 0;
    return node;
  }

  function walkKnowledgeNodes(nodes, visitor, trail) {
    (nodes || []).forEach(function (node) {
      var nextTrail = (trail || []).concat(node);
      visitor(node, nextTrail);
      walkKnowledgeNodes(node.children || [], visitor, nextTrail);
    });
  }

  function syncKnowledgeNotesFromTree() {
    var next = {};
    walkKnowledgeNodes(getKnowledgeRootNodes(), function (node) {
      next[node.id] = {
        title: node.title,
        content: node.contentMd || "",
        updatedAt: node.updatedAt || ""
      };
    });
    knowledgeNotes = next;
  }

  function normalizeKnowledgeNodes(nodes, level) {
    (nodes || []).forEach(function (node) {
      if (!node.id) node.id = newKnowledgeNodeId();
      node.title = normalizeKnowledgeTitle(node.title, "知识点-" + node.id.slice(-4));
      node.level = level;
      if (!Array.isArray(node.children)) node.children = [];
      var legacy = knowledgeNotes && knowledgeNotes[node.id];
      if (typeof node.contentMd !== "string") {
        node.contentMd = legacy && typeof legacy.content === "string" ? legacy.content : "";
      }
      if (typeof node.updatedAt !== "string") {
        node.updatedAt = legacy && typeof legacy.updatedAt === "string" ? legacy.updatedAt : "";
      }
      normalizeKnowledgeNodes(node.children, level + 1);
      node.isLeaf = node.children.length === 0;
    });
  }

  function getKnowledgePathConfig(type, subtype, subSubtype) {
    return {
      rootTitle: normalizeKnowledgeTitle(type, "未分类"),
      subTitle: normalizeKnowledgeTitle(subtype, "未分类"),
      sub2Title: normalizeKnowledgeTitle(subSubtype, "未细分")
    };
  }

  function ensureKnowledgeBranchPath(type, subtype, subSubtype) {
    var path = getKnowledgePathConfig(type, subtype, subSubtype);
    var roots = getKnowledgeRootNodes();
    var root = ensureKnowledgeChild(roots, path.rootTitle, 1, false);
    var sub = ensureKnowledgeChild(root.children, path.subTitle, 2, false);
    var sub2 = ensureKnowledgeChild(sub.children, path.sub2Title, 3, false);
    return { root: root, sub: sub, sub2: sub2 };
  }

  function ensureKnowledgeNoteRecord(leafNode) {
    if (!leafNode) return false;
    var changed = false;
    if (typeof leafNode.contentMd !== "string") {
      leafNode.contentMd = "";
      changed = true;
    }
    if (typeof leafNode.updatedAt !== "string") {
      leafNode.updatedAt = "";
      changed = true;
    }
    if (!knowledgeNotes[leafNode.id]) {
      knowledgeNotes[leafNode.id] = {
        title: leafNode.title,
        content: leafNode.contentMd || "",
        updatedAt: leafNode.updatedAt || ""
      };
      changed = true;
    }
    return changed;
  }

  function getKnowledgeLeafDefaultTitle(type, subtype, subSubtype) {
    return normalizeKnowledgeTitle(subSubtype, normalizeKnowledgeTitle(subtype, normalizeKnowledgeTitle(type, "未分类")));
  }

  function ensureKnowledgeLeaf(type, subtype, subSubtype, leafTitle) {
    var path = ensureKnowledgeBranchPath(type, subtype, subSubtype);
    var title = normalizeKnowledgeTitle(leafTitle, getKnowledgeLeafDefaultTitle(type, subtype, subSubtype));
    var leaf = ensureKnowledgeChild(path.sub2.children, title, 4, true);
    if (!leaf.contentMd) {
      leaf.contentMd = "# " + leaf.title + "\n\n";
      leaf.updatedAt = new Date().toISOString();
    }
    ensureKnowledgeNoteRecord(leaf);
    return leaf;
  }

  function collectKnowledgeLeaves(nodes, bucket) {
    var list = nodes || getKnowledgeRootNodes();
    var acc = bucket || [];
    list.forEach(function (node) {
      if (!node.children || node.children.length === 0) acc.push(node);
      collectKnowledgeLeaves(node.children || [], acc);
    });
    return acc;
  }

  function collectKnowledgeNodes(nodes, bucket) {
    var list = nodes || getKnowledgeRootNodes();
    var acc = bucket || [];
    list.forEach(function (node) {
      acc.push(node);
      collectKnowledgeNodes(node.children || [], acc);
    });
    return acc;
  }

  function getKnowledgeDescendantNodeIds(node) {
    if (!node) return [];
    var ids = [node.id];
    (node.children || []).forEach(function (child) {
      ids = ids.concat(getKnowledgeDescendantNodeIds(child));
    });
    return ids;
  }

  function countErrorsForKnowledgeNode(nodeId, includeDescendants) {
    var node = getKnowledgeNodeById(nodeId);
    if (!node) return 0;
    var nodeIds = includeDescendants === false ? [node.id] : getKnowledgeDescendantNodeIds(node);
    return errors.filter(function (item) { return nodeIds.includes(item.noteNodeId); }).length;
  }

  function getKnowledgeAssignableNodesForPath(type, subtype, subSubtype) {
    var path = getKnowledgePathConfig(type, subtype, subSubtype);
    var root = getKnowledgeRootNodes().find(function (node) { return node.title === path.rootTitle; });
    var sub = root && (root.children || []).find(function (node) { return node.title === path.subTitle; });
    var sub2 = sub && (sub.children || []).find(function (node) { return node.title === path.sub2Title; });
    if (!sub2) return [];
    var list = [sub2];
    walkKnowledgeNodes(sub2.children || [], function (node) { list.push(node); });
    return list;
  }

  function getKnowledgePathTitles(nodeId) {
    function walk(nodes, parentTrail) {
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        var next = parentTrail.concat(node.title);
        if (node.id === nodeId) return next;
        var found = walk(node.children || [], next);
        if (found) return found;
      }
      return null;
    }
    return walk(getKnowledgeRootNodes(), []) || [];
  }

  function collapseKnowledgePathTitles(titles) {
    return (titles || []).filter(function (title, idx, arr) {
      return idx === 0 || title !== arr[idx - 1];
    });
  }

  function getKnowledgeDisplayNode(node) {
    return node || null;
  }

  function resolveKnowledgeDisplayNodeId(nodeId) {
    return nodeId;
  }

  function ensureKnowledgeBindingForError(errorItem) {
    if (!errorItem) return false;
    var bound = getKnowledgeNodeById(errorItem.noteNodeId);
    if (bound) {
      return ensureKnowledgeNoteRecord(bound);
    }
    var branch = ensureKnowledgeBranchPath(errorItem.type, errorItem.subtype, errorItem.subSubtype);
    ensureKnowledgeNoteRecord(branch.sub2);
    errorItem.noteNodeId = branch.sub2.id;
    return true;
  }

  function ensureKnowledgeExpandedDefaults() {
    if (knowledgeExpandedLoaded) return;
    getKnowledgeRootNodes().forEach(function (node) { knowledgeExpanded.add(node.id); });
    knowledgeExpandedLoaded = true;
  }

  function ensureKnowledgeState(opts) {
    var options = opts || {};
    getKnowledgeRootNodes();
    knowledgeNotes = knowledgeNotes && typeof knowledgeNotes === "object" ? knowledgeNotes : {};
    normalizeKnowledgeNodes(getKnowledgeRootNodes(), 1);
    ensureKnowledgeExpandedDefaults();
    var changed = false;
    errors.forEach(function (item) {
      if (ensureKnowledgeBindingForError(item)) changed = true;
    });
    var allNodes = collectKnowledgeNodes();
    if ((!selectedKnowledgeNodeId || !getKnowledgeNodeById(selectedKnowledgeNodeId)) && allNodes.length > 0) {
      selectedKnowledgeNodeId = allNodes[0].id;
    }
    syncKnowledgeNotesFromTree();
    if (options.persist && changed) saveData();
    if (options.persist) saveKnowledgeState();
  }

  function findKnowledgeBranchForModal(createIfMissing) {
    var type = document.getElementById("editType") ? document.getElementById("editType").value : "";
    var subtype = document.getElementById("editSubtype") ? document.getElementById("editSubtype").value.trim() : "";
    var subSubtype = document.getElementById("editSubSubtype") ? document.getElementById("editSubSubtype").value.trim() : "";
    if (createIfMissing) {
      return ensureKnowledgeBranchPath(type, subtype, subSubtype).sub2;
    }
    var path = getKnowledgePathConfig(type, subtype, subSubtype);
    var root = getKnowledgeRootNodes().find(function (node) { return node.title === path.rootTitle; });
    var sub = root && (root.children || []).find(function (node) { return node.title === path.subTitle; });
    return sub && (sub.children || []).find(function (node) { return node.title === path.sub2Title; });
  }

  function expandKnowledgePath(nodeId) {
    var current = getKnowledgeNodeById(nodeId);
    while (current) {
      knowledgeExpanded.add(current.id);
      current = findKnowledgeParent(current.id);
    }
    saveKnowledgeExpanded();
  }

  function isKnowledgeExpanded(node) {
    if (!node || !node.children || !node.children.length) return false;
    return knowledgeExpanded.has(node.id);
  }

  function toggleKnowledgeExpanded(nodeId, event) {
    if (event) event.stopPropagation();
    var node = getKnowledgeNodeById(nodeId);
    if (!node || !node.children || !node.children.length) return;
    if (knowledgeExpanded.has(node.id)) knowledgeExpanded.delete(node.id);
    else knowledgeExpanded.add(node.id);
    saveKnowledgeExpanded();
    renderSidebar();
  }

  function syncKnowledgePickerHint(selectedLeafId) {
    var hint = document.getElementById("editKnowledgeHint");
    if (!hint) return;
    var base = getKnowledgePathConfig(
      document.getElementById("editType") ? document.getElementById("editType").value : "",
      document.getElementById("editSubtype") ? document.getElementById("editSubtype").value.trim() : "",
      document.getElementById("editSubSubtype") ? document.getElementById("editSubSubtype").value.trim() : ""
    );
    var node = selectedLeafId ? getKnowledgeNodeById(selectedLeafId) : null;
    var pathTitles = node
      ? collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(" > ")
      : (base.rootTitle + " > " + base.subTitle + " > " + base.sub2Title);
    hint.textContent = node
      ? (pathTitles + "（保存到当前节点）")
      : (pathTitles + "（保存时默认挂到当前节点）");
  }

  function refreshKnowledgePicker(preferredId) {
    ensureKnowledgeState();
    var select = document.getElementById("editKnowledgeLeaf");
    if (!select) return;
    var nodes = getKnowledgeAssignableNodesForPath(
      document.getElementById("editType") ? document.getElementById("editType").value : "",
      document.getElementById("editSubtype") ? document.getElementById("editSubtype").value.trim() : "",
      document.getElementById("editSubSubtype") ? document.getElementById("editSubSubtype").value.trim() : ""
    );
    var options = ['<option value="">默认挂到当前三级节点</option>']
      .concat(nodes.map(function (node) {
        return '<option value="' + node.id + '">' + escapeHtml(collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(" > ")) + "</option>";
      }));
    select.innerHTML = options.join("");
    if (preferredId && nodes.some(function (node) { return node.id === preferredId; })) {
      select.value = preferredId;
    } else if (nodes.length === 1) {
      select.value = nodes[0].id;
    } else {
      select.value = "";
    }
    syncKnowledgePickerHint(select.value);
  }

  function createKnowledgeLeafFromModal() {
    var branch = findKnowledgeBranchForModal(true);
    var fallback = getKnowledgeLeafDefaultTitle(
      document.getElementById("editType") ? document.getElementById("editType").value : "",
      document.getElementById("editSubtype") ? document.getElementById("editSubtype").value.trim() : "",
      document.getElementById("editSubSubtype") ? document.getElementById("editSubSubtype").value.trim() : ""
    );
    openKnowledgeNodeModal("create-child", {
      parentId: branch.id,
      fallbackTitle: fallback,
      afterSubmit: function (node) { refreshKnowledgePicker(node.id); }
    });
  }

  function resolveKnowledgeNodeIdForSave(type, subtype, subSubtype) {
    var select = document.getElementById("editKnowledgeLeaf");
    var selectedId = select ? select.value : "";
    var selectedNode = selectedId ? getKnowledgeNodeById(selectedId) : null;
    if (selectedNode) {
      ensureKnowledgeNoteRecord(selectedNode);
      selectedKnowledgeNodeId = selectedNode.id;
      return selectedNode.id;
    }
    var branch = ensureKnowledgeBranchPath(type, subtype, subSubtype);
    ensureKnowledgeNoteRecord(branch.sub2);
    selectedKnowledgeNodeId = branch.sub2.id;
    if (select) refreshKnowledgePicker(branch.sub2.id);
    return branch.sub2.id;
  }

  function filterByKnowledgeNode(nodeId) {
    setCurrentKnowledgeNode(nodeId, { switchTab: true });
  }

  function selectKnowledgeNodeFromSidebar(nodeId) {
    setCurrentKnowledgeNode(nodeId, { switchTab: true });
  }

  window.normalizeKnowledgeTitle = normalizeKnowledgeTitle;
  window.createKnowledgeNode = createKnowledgeNode;
  window.createDefaultKnowledgeTree = createDefaultKnowledgeTree;
  window.getKnowledgeRootNodes = getKnowledgeRootNodes;
  window.findKnowledgeNodeById = findKnowledgeNodeById;
  window.getKnowledgeNodeById = getKnowledgeNodeById;
  window.findKnowledgeParent = findKnowledgeParent;
  window.ensureKnowledgeChild = ensureKnowledgeChild;
  window.walkKnowledgeNodes = walkKnowledgeNodes;
  window.syncKnowledgeNotesFromTree = syncKnowledgeNotesFromTree;
  window.normalizeKnowledgeNodes = normalizeKnowledgeNodes;
  window.getKnowledgePathConfig = getKnowledgePathConfig;
  window.ensureKnowledgeBranchPath = ensureKnowledgeBranchPath;
  window.ensureKnowledgeNoteRecord = ensureKnowledgeNoteRecord;
  window.getKnowledgeLeafDefaultTitle = getKnowledgeLeafDefaultTitle;
  window.ensureKnowledgeLeaf = ensureKnowledgeLeaf;
  window.collectKnowledgeLeaves = collectKnowledgeLeaves;
  window.collectKnowledgeNodes = collectKnowledgeNodes;
  window.getKnowledgeDescendantNodeIds = getKnowledgeDescendantNodeIds;
  window.countErrorsForKnowledgeNode = countErrorsForKnowledgeNode;
  window.getKnowledgeAssignableNodesForPath = getKnowledgeAssignableNodesForPath;
  window.getKnowledgePathTitles = getKnowledgePathTitles;
  window.collapseKnowledgePathTitles = collapseKnowledgePathTitles;
  window.getKnowledgeDisplayNode = getKnowledgeDisplayNode;
  window.resolveKnowledgeDisplayNodeId = resolveKnowledgeDisplayNodeId;
  window.ensureKnowledgeBindingForError = ensureKnowledgeBindingForError;
  window.ensureKnowledgeState = ensureKnowledgeState;
  window.findKnowledgeBranchForModal = findKnowledgeBranchForModal;
  window.ensureKnowledgeExpandedDefaults = ensureKnowledgeExpandedDefaults;
  window.expandKnowledgePath = expandKnowledgePath;
  window.isKnowledgeExpanded = isKnowledgeExpanded;
  window.toggleKnowledgeExpanded = toggleKnowledgeExpanded;
  window.syncKnowledgePickerHint = syncKnowledgePickerHint;
  window.refreshKnowledgePicker = refreshKnowledgePicker;
  window.createKnowledgeLeafFromModal = createKnowledgeLeafFromModal;
  window.resolveKnowledgeNodeIdForSave = resolveKnowledgeNodeIdForSave;
  window.filterByKnowledgeNode = filterByKnowledgeNode;
  window.selectKnowledgeNodeFromSidebar = selectKnowledgeNodeFromSidebar;
})();
