// ============================================================
// Directory management
// ============================================================
function walkKnowledgeNodes(nodes, visitor, trail) {
  (nodes || []).forEach(node => {
    const nextTrail = (trail || []).concat(node);
    visitor(node, nextTrail);
    walkKnowledgeNodes(node.children || [], visitor, nextTrail);
  });
}
function syncKnowledgeNotesFromTree() {
  const next = {};
  walkKnowledgeNodes(getKnowledgeRootNodes(), node => {
    next[node.id] = {
      title: node.title,
      content: node.contentMd || '',
      updatedAt: node.updatedAt || ''
    };
  });
  knowledgeNotes = next;
}
function getLegacyKnowledgeNoteSnapshot(nodeId) {
  if (!knowledgeNotes || typeof knowledgeNotes !== 'object' || !nodeId) return null;
  const legacy = knowledgeNotes[nodeId];
  if (!legacy || typeof legacy !== 'object') return null;
  return {
    title: String(legacy.title || ''),
    content: String(legacy.content || ''),
    updatedAt: String(legacy.updatedAt || '')
  };
}
function removeKnowledgeNoteEntry(nodeId) {
  if (!nodeId || !knowledgeNotes || typeof knowledgeNotes !== 'object') return;
  delete knowledgeNotes[nodeId];
}
function migrateKnowledgeNodeReference(oldId, newId) {
  if (!oldId || !newId || oldId === newId) return;
  errors.forEach(item => {
    if (item.noteNodeId === oldId) {
      item.noteNodeId = newId;
      item.updatedAt = new Date().toISOString();
    }
  });
  if (selectedKnowledgeNodeId === oldId) selectedKnowledgeNodeId = newId;
  if (knowledgeNodeFilter === oldId) knowledgeNodeFilter = newId;
  if (knowledgeExpanded.has(oldId)) {
    knowledgeExpanded.delete(oldId);
    knowledgeExpanded.add(newId);
  }
  const legacy = getLegacyKnowledgeNoteSnapshot(oldId);
  if (legacy) {
    const current = getLegacyKnowledgeNoteSnapshot(newId) || { title: '', content: '', updatedAt: '' };
    if (!String(current.content || '').trim() && String(legacy.content || '').trim()) {
      knowledgeNotes[newId] = {
        title: current.title || legacy.title || '',
        content: legacy.content || '',
        updatedAt: legacy.updatedAt || current.updatedAt || ''
      };
    }
    removeKnowledgeNoteEntry(oldId);
  }
}
function getKnowledgeDirectErrorCountMap() {
  const counts = new Map();
  (errors || []).forEach(item => {
    const nodeId = String((item && item.noteNodeId) || '');
    if (!nodeId) return;
    counts.set(nodeId, (counts.get(nodeId) || 0) + 1);
  });
  return counts;
}
function mergeKnowledgeNodeIntoTarget(target, source) {
  if (!target || !source || target === source) return;
  const targetContent = String(target.contentMd || '').trim();
  const sourceContent = String(source.contentMd || '').trim();
  if (!targetContent && sourceContent) {
    target.contentMd = source.contentMd || '';
    target.updatedAt = source.updatedAt || target.updatedAt || '';
  } else if (sourceContent && String(source.updatedAt || '') > String(target.updatedAt || '')) {
    target.contentMd = source.contentMd || target.contentMd || '';
    target.updatedAt = source.updatedAt || target.updatedAt || '';
  }
  target.children = (target.children || []).concat(source.children || []);
  migrateKnowledgeNodeReference(String(source.id || ''), String(target.id || ''));
}
function mergeDuplicateKnowledgeSiblings(nodes) {
  let changed = false;
  const list = Array.isArray(nodes) ? nodes : [];
  list.forEach(node => {
    if (mergeDuplicateKnowledgeSiblings(node.children || [])) changed = true;
  });
  const next = [];
  const seen = new Map();
  list.forEach(node => {
    if (!node || typeof node !== 'object') return;
    const key = String(node.title || '').trim();
    if (!key) {
      next.push(node);
      return;
    }
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, node);
      next.push(node);
      return;
    }
    mergeKnowledgeNodeIntoTarget(existing, node);
    changed = true;
  });
  if (changed && Array.isArray(nodes)) {
    nodes.splice(0, nodes.length, ...next);
  }
  return changed;
}
function pruneKnowledgeGhostNodes(nodes, directCountMap) {
  let changed = false;
  const list = Array.isArray(nodes) ? nodes : [];
  const next = [];
  list.forEach(node => {
    if (!node || typeof node !== 'object') return;
    if (pruneKnowledgeGhostNodes(node.children || [], directCountMap)) changed = true;
    node.children = Array.isArray(node.children) ? node.children : [];
    const nodeId = String(node.id || '');
    const directCount = directCountMap.get(nodeId) || 0;
    const hasContent = !!String(node.contentMd || '').trim();
    const isProtectedRoot = Number(node.level || 0) === 1 && FIXED_KNOWLEDGE_ROOTS.includes(String(node.title || ''));
    if (isProtectedRoot) {
      next.push(node);
      return;
    }
    if (!hasContent && directCount === 0) {
      if (node.children.length === 0) {
        knowledgeExpanded.delete(nodeId);
        removeKnowledgeNoteEntry(nodeId);
        changed = true;
        return;
      }
      if (node.children.length === 1) {
        const child = node.children[0];
        if (child && typeof child === 'object') {
          child.level = node.level;
          migrateKnowledgeNodeReference(nodeId, String(child.id || ''));
          next.push(child);
          changed = true;
          return;
        }
      }
    }
    next.push(node);
  });
  if (Array.isArray(nodes)) {
    nodes.splice(0, nodes.length, ...next);
  }
  return changed;
}
function collapseDuplicateKnowledgeWrappers(nodes) {
  let changed = false;
  const list = Array.isArray(nodes) ? nodes : [];
  for (let idx = 0; idx < list.length; idx += 1) {
    let node = list[idx];
    if (!node) continue;
    if (collapseDuplicateKnowledgeWrappers(node.children || [])) changed = true;
    while (
      node &&
      Array.isArray(node.children) &&
      node.children.length === 1 &&
      node.children[0] &&
      node.children[0].title === node.title
    ) {
      const child = node.children[0];
      if (!String(child.contentMd || '').trim() && String(node.contentMd || '').trim()) {
        child.contentMd = node.contentMd;
        child.updatedAt = child.updatedAt || node.updatedAt || '';
      }
      child.level = node.level;
      migrateKnowledgeNodeReference(node.id, child.id);
      list[idx] = child;
      node = child;
      changed = true;
    }
  }
  return changed;
}
function normalizeKnowledgeNodes(nodes, level) {
  (nodes || []).forEach(node => {
    if (!node.id) node.id = newKnowledgeNodeId();
    const fallbackTitle = level === 1 ? '未分类' : `知识点${node.id.slice(-4)}`;
    node.title = normalizeKnowledgeTitle(node.title, fallbackTitle);
    node.level = level;
    if (!Array.isArray(node.children)) node.children = [];
    const legacy = getLegacyKnowledgeNoteSnapshot(node.id);
    if (typeof node.contentMd !== 'string') {
      node.contentMd = legacy && typeof legacy.content === 'string' ? legacy.content : '';
    }
    if (typeof node.updatedAt !== 'string') {
      node.updatedAt = legacy && typeof legacy.updatedAt === 'string' ? legacy.updatedAt : '';
    }
    normalizeKnowledgeNodes(node.children, level + 1);
    node.isLeaf = node.children.length === 0;
  });
}
function getKnowledgePathConfig(type, subtype, subSubtype) {
  return {
    rootTitle: normalizeKnowledgeTitle(type, '未分类'),
    subTitle: normalizeKnowledgeTitle(subtype, '未分类'),
    sub2Title: normalizeKnowledgeTitle(subSubtype, '未细分')
  };
}
function ensureKnowledgePathByTitles(pathTitles) {
  const titles = (pathTitles || []).map(item => String(item || '').trim()).filter(Boolean);
  if (!titles.length) return null;
  let siblings = getKnowledgeRootNodes();
  let node = null;
  titles.forEach((title, index) => {
    node = ensureKnowledgeChild(siblings, title, index + 1, false);
    siblings = node.children;
  });
  return node;
}
function ensureKnowledgeBranchPath(type, subtype, subSubtype) {
  const path = getKnowledgePathConfig(type, subtype, subSubtype);
  const root = ensureKnowledgePathByTitles([path.rootTitle]);
  const sub = ensureKnowledgePathByTitles([path.rootTitle, path.subTitle]);
  const sub2 = ensureKnowledgePathByTitles([path.rootTitle, path.subTitle, path.sub2Title]);
  return { root, sub, sub2 };
}
function ensureKnowledgeNoteRecord(leafNode) {
  if (!leafNode) return false;
  let changed = false;
  if (typeof leafNode.contentMd !== 'string') {
    leafNode.contentMd = '';
    changed = true;
  }
  if (typeof leafNode.updatedAt !== 'string') {
    leafNode.updatedAt = '';
    changed = true;
  }
  if (!knowledgeNotes[leafNode.id]) {
    knowledgeNotes[leafNode.id] = {
      title: leafNode.title,
      content: leafNode.contentMd || '',
      updatedAt: leafNode.updatedAt || ''
    };
    changed = true;
  }
  return changed;
}
function getKnowledgeLeafDefaultTitle(type, subtype, subSubtype) {
  return normalizeKnowledgeTitle(subSubtype, normalizeKnowledgeTitle(subtype, normalizeKnowledgeTitle(type, '未分类')));
}
function ensureKnowledgeLeaf(type, subtype, subSubtype, leafTitle) {
  const path = ensureKnowledgeBranchPath(type, subtype, subSubtype);
  const title = normalizeKnowledgeTitle(leafTitle, getKnowledgeLeafDefaultTitle(type, subtype, subSubtype));
  const leaf = ensureKnowledgeChild(path.sub2.children, title, 4, true);
  if (!leaf.contentMd) {
    leaf.contentMd = `# ${leaf.title}\n\n`;
    leaf.updatedAt = new Date().toISOString();
  }
  ensureKnowledgeNoteRecord(leaf);
  return leaf;
}
function collectKnowledgeLeaves(nodes, bucket) {
  const list = nodes || getKnowledgeRootNodes();
  const acc = bucket || [];
  list.forEach(node => {
    if (!node.children || node.children.length === 0) acc.push(node);
    collectKnowledgeLeaves(node.children || [], acc);
  });
  return acc;
}
function collectKnowledgeNodes(nodes, bucket) {
  const list = nodes || getKnowledgeRootNodes();
  const acc = bucket || [];
  list.forEach(node => {
    acc.push(node);
    collectKnowledgeNodes(node.children || [], acc);
  });
  return acc;
}
function getKnowledgeDescendantNodeIds(node) {
  if (!node) return [];
  let ids = [node.id];
  (node.children || []).forEach(child => {
    ids = ids.concat(getKnowledgeDescendantNodeIds(child));
  });
  return ids;
}
function getKnowledgeErrorCountMaps() {
  if (knowledgeErrorCountCache.version === knowledgeErrorCountCacheVersion) {
    return knowledgeErrorCountCache;
  }
  const direct = new Map();
  getErrorEntries().forEach(item => {
    const nodeId = String(item && item.noteNodeId || '');
    if (!nodeId) return;
    direct.set(nodeId, (direct.get(nodeId) || 0) + 1);
  });
  const aggregate = new Map();
  function walk(node) {
    if (!node || !node.id) return 0;
    let total = direct.get(node.id) || 0;
    (node.children || []).forEach(child => {
      total += walk(child);
    });
    aggregate.set(node.id, total);
    return total;
  }
  getKnowledgeRootNodes().forEach(root => walk(root));
  knowledgeErrorCountCache = {
    version: knowledgeErrorCountCacheVersion,
    direct,
    aggregate
  };
  return knowledgeErrorCountCache;
}
function countErrorsForKnowledgeNode(nodeId, includeDescendants) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return 0;
  const maps = getKnowledgeErrorCountMaps();
  return includeDescendants === false
    ? (maps.direct.get(node.id) || 0)
    : (maps.aggregate.get(node.id) || 0);
}
function getKnowledgeAssignableNodesForPath(type, subtype, subSubtype) {
  const path = getKnowledgePathConfig(type, subtype, subSubtype);
  const root = getKnowledgeRootNodes().find(node => node.title === path.rootTitle);
  const sub = root && (root.children || []).find(node => node.title === path.subTitle);
  const sub2 = sub && (sub.children || []).find(node => node.title === path.sub2Title);
  if (!sub2) return [];
  const list = [sub2];
  walkKnowledgeNodes(sub2.children || [], node => list.push(node));
  return list;
}
function getKnowledgeNodeByPathTitles(pathTitles) {
  const titles = (pathTitles || []).map(item => String(item || '').trim()).filter(Boolean);
  if (!titles.length) return null;
  let siblings = getKnowledgeRootNodes();
  let node = null;
  for (const title of titles) {
    node = (siblings || []).find(item => String(item.title || '').trim() === title);
    if (!node) return null;
    siblings = node.children || [];
  }
  return node;
}
function getKnowledgeAssignableNodesForTitles(pathTitles) {
  const baseNode = getKnowledgeNodeByPathTitles(pathTitles);
  if (!baseNode) return [];
  const list = [baseNode];
  walkKnowledgeNodes(baseNode.children || [], node => list.push(node));
  return list;
}
function getKnowledgePathTitles(nodeId) {
  function walk(nodes, parentTrail) {
    for (const node of nodes) {
      const next = parentTrail.concat(node.title);
      if (node.id === nodeId) return next;
      const found = walk(node.children || [], next);
      if (found) return found;
    }
    return null;
  }
  return walk(getKnowledgeRootNodes(), []) || [];
}
function collapseKnowledgePathTitles(titles) {
  return (titles || []).filter((title, idx, arr) => idx === 0 || title !== arr[idx - 1]);
}
function getEntryPathTitlesFromForm() {
  const level1 = document.getElementById('editType')?.value || '';
  const level2 = document.getElementById('editSubtype')?.value.trim() || '';
  const level3 = document.getElementById('editSubSubtype')?.value.trim() || '';
  const level4 = document.getElementById('editLevel4')?.value.trim() || '';
  return [level1, level2, level3, level4].filter(Boolean);
}
function getEntryClassificationTripleFromForm() {
  const titles = getEntryPathTitlesFromForm();
  return {
    type: titles[0] || '',
    subtype: titles[1] || '',
    subSubtype: titles[titles.length - 1] || ''
  };
}
function getKnowledgeNodePathTriple(nodeId) {
  const titles = collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId));
  return {
    type: titles[0] || '',
    subtype: titles[1] || '',
    subSubtype: titles[titles.length - 1] || ''
  };
}
function doesKnowledgeNodeMatchPathTitles(nodeId, pathTitles) {
  const actual = collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId));
  const target = collapseKnowledgePathTitles((pathTitles || []).map(item => String(item || '').trim()).filter(Boolean));
  if (actual.length !== target.length) return false;
  return actual.every((title, index) => title === target[index]);
}
function doesKnowledgeNodeMatchEntryPath(nodeId, type, subtype, subSubtype) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return false;
  const target = getKnowledgePathConfig(type, subtype, subSubtype);
  const actual = getKnowledgeNodePathTriple(nodeId);
  return actual.type === target.rootTitle
    && actual.subtype === target.subTitle
    && actual.subSubtype === target.sub2Title;
}
function ensureKnowledgeState(opts) {
  const options = opts || {};
  getKnowledgeRootNodes();
  knowledgeNotes = knowledgeNotes && typeof knowledgeNotes === 'object' ? knowledgeNotes : {};
  let changed = ensureFixedKnowledgeRoots();
  if (mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes())) changed = true;
  if (collapseDuplicateKnowledgeWrappers(getKnowledgeRootNodes())) changed = true;
  if (pruneKnowledgeGhostNodes(getKnowledgeRootNodes(), getKnowledgeDirectErrorCountMap())) changed = true;
  normalizeKnowledgeNodes(getKnowledgeRootNodes(), 1);
  if (mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes())) changed = true;
  ensureKnowledgeExpandedDefaults();
  errors.forEach(item => {
    if (ensureKnowledgeBindingForError(item)) changed = true;
  });
  const allNodes = collectKnowledgeNodes();
  if ((!selectedKnowledgeNodeId || !getKnowledgeNodeById(selectedKnowledgeNodeId)) && allNodes.length > 0) {
    selectedKnowledgeNodeId = allNodes[0].id;
  }
  if (changed) {
    knowledgeErrorCountCacheVersion += 1;
  }
  syncKnowledgeNotesFromTree();
  if (options.persist && changed) {
    saveData();
  }
  if (options.persist) {
    saveKnowledgeState();
  }
}
function findKnowledgeBranchForModal(createIfMissing) {
  const pathTitles = getEntryPathTitlesFromForm();
  if (!pathTitles.length) return null;
  if (createIfMissing) {
    return ensureKnowledgePathByTitles(pathTitles);
  }
  return getKnowledgeNodeByPathTitles(pathTitles);
}
function ensureKnowledgeExpandedDefaults() {
  if (knowledgeExpandedLoaded) return;
  knowledgeExpandedLoaded = true;
}
function expandKnowledgePath(nodeId) {
  let current = getKnowledgeNodeById(nodeId);
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
  const node = getKnowledgeNodeById(nodeId);
  if (!node || !node.children || !node.children.length) return;
  if (knowledgeExpanded.has(node.id)) knowledgeExpanded.delete(node.id);
  else knowledgeExpanded.add(node.id);
  saveKnowledgeExpanded();
  renderSidebar();
}

