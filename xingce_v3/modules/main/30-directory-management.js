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
  return false;
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

function normalizeKnowledgeRootTitleForCleanup(title) {
  return String(title || '')
    .replace(/\uFEFF/g, '')
    .replace(/\u200B/g, '')
    .replace(/\u00A0/g, '')
    .replace(/[()（）【】\[\]·•,，.:：;；!?！？]/g, '')
    .replace(/\s+/g, '')
    .trim();
}
function resolveLegacyKnowledgeRootAlias(title) {
  const aliases = new Map([
    ['片段阅读', '言语理解与表达'],
    ['数字推理', '数量关系'],
    ['逻辑判断', '判断推理'],
    ['物理', '常识判断']
  ]);
  return aliases.get(normalizeKnowledgeRootTitleForCleanup(title)) || '';
}
function isPlaceholderKnowledgeRootTitle(title) {
  const normalized = normalizeKnowledgeRootTitleForCleanup(title);
  return normalized === '未细分' || normalized === '未分类';
}
function normalizeLegacyKnowledgePathConfig(type, subtype, subSubtype) {
  let rootTitle = normalizeKnowledgeTitle(type, '未分类');
  let subTitle = normalizeKnowledgeTitle(subtype, '未分类');
  let sub2Title = normalizeKnowledgeTitle(subSubtype, '未细分');

  const rootAlias = resolveLegacyKnowledgeRootAlias(rootTitle);
  if (rootAlias) {
    rootTitle = rootAlias;
    if (!String(subtype || '').trim() || isPlaceholderKnowledgeRootTitle(subTitle)) {
      subTitle = normalizeKnowledgeTitle(type, '未分类');
    }
  }

  if (isPlaceholderKnowledgeRootTitle(rootTitle) || !FIXED_TYPES.includes(rootTitle)) {
    const subAlias = resolveLegacyKnowledgeRootAlias(subTitle);
    if (subAlias) {
      rootTitle = subAlias;
    }
  }

  if ((isPlaceholderKnowledgeRootTitle(rootTitle) || rootTitle === '其他') && isPlaceholderKnowledgeRootTitle(subTitle)) {
    const sub2Alias = resolveLegacyKnowledgeRootAlias(sub2Title);
    if (sub2Alias) {
      rootTitle = sub2Alias;
      subTitle = normalizeKnowledgeTitle(subSubtype, '未分类');
    }
  }

  if (isPlaceholderKnowledgeRootTitle(rootTitle)) {
    rootTitle = '其他';
  }

  return { rootTitle, subTitle, sub2Title };
}
function cleanupNoisyRootNodes() {
  const roots = getKnowledgeRootNodes();
  if (!Array.isArray(roots) || !roots.length) return false;
  const remap = new Map([
    ['片段阅读', '言语理解与表达'],
    ['数字推理', '数量关系'],
    ['逻辑判断', '判断推理'],
    ['物理', '常识判断'],
    ['未细分', '其他'],
    ['未分类', '其他']
  ]);
  let changed = false;

  const getCanonicalNodeByTitle = title => {
    const normalized = normalizeKnowledgeRootTitleForCleanup(title);
    return roots.find(node => normalizeKnowledgeRootTitleForCleanup(node && node.title) === normalized) || null;
  };
  const isNoisyRoot = (title, noisyTitle) => {
    const text = normalizeKnowledgeRootTitleForCleanup(title);
    const target = normalizeKnowledgeRootTitleForCleanup(noisyTitle);
    return !!text && (text === target || text.includes(target));
  };

  remap.forEach((targetTitle, noisyTitle) => {
    const sourceIdx = roots.findIndex(node => isNoisyRoot(node && node.title, noisyTitle));
    if (sourceIdx < 0) return;
    const source = roots[sourceIdx];
    const target = getCanonicalNodeByTitle(targetTitle);
    const targetId = target ? String(target.id || '') : '';
    const sourceId = String(source && source.id || '');

    (errors || []).forEach(item => {
      if (String((item && item.noteNodeId) || '') === sourceId) {
        item.noteNodeId = targetId || '';
        item.updatedAt = new Date().toISOString();
      }
    });

    if (target && Array.isArray(source.children) && source.children.length) {
      target.children = (target.children || []).concat(source.children);
      target.isLeaf = false;
    } else if (Array.isArray(source.children) && source.children.length) {
      const insertAt = Math.max(0, sourceIdx + 1);
      roots.splice(insertAt, 0, ...source.children);
    }

    roots.splice(sourceIdx, 1);
    removeKnowledgeNoteEntry(sourceId);
    knowledgeExpanded.delete(sourceId);
    if (selectedKnowledgeNodeId === sourceId) selectedKnowledgeNodeId = targetId || null;
    if (knowledgeNodeFilter === sourceId) knowledgeNodeFilter = targetId || null;
    changed = true;
  });

  return changed;
}

function cleanupForcedKnowledgeNodeByPath(pathTitles) {
  const titles = (pathTitles || []).map(item => String(item || '').trim()).filter(Boolean);
  if (!titles.length) return false;
  const targetNode = getKnowledgeNodeByPathTitles(titles);
  if (!targetNode) return false;
  const parent = findKnowledgeParent(targetNode.id);
  if (!parent || !Array.isArray(parent.children)) return false;

  const siblings = parent.children;
  const idx = siblings.findIndex(item => item && item.id === targetNode.id);
  if (idx < 0) return false;

  const promotedChildren = unwrapPromotedKnowledgeChildren(targetNode.children || [], targetNode.title);
  const fallbackTargetId = parent.id || promotedChildren[0]?.id || siblings[idx - 1]?.id || siblings[idx + 1]?.id || '';

  (errors || []).forEach(item => {
    if (String((item && item.noteNodeId) || '') !== String(targetNode.id || '')) return;
    item.noteNodeId = fallbackTargetId || '';
    item.updatedAt = new Date().toISOString();
  });

  siblings.splice(idx, 1, ...promotedChildren);
  parent.isLeaf = siblings.length === 0;
  removeKnowledgeNoteEntry(targetNode.id);
  knowledgeExpanded.delete(targetNode.id);

  if (selectedKnowledgeNodeId === targetNode.id) {
    selectedKnowledgeNodeId = fallbackTargetId || promotedChildren[0]?.id || parent.id || null;
  }
  if (knowledgeNodeFilter === targetNode.id) {
    knowledgeNodeFilter = parent.id || null;
  }
  return true;
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
  return normalizeLegacyKnowledgePathConfig(type, subtype, subSubtype);
}
function splitKnowledgePathText(rawPath) {
  return String(rawPath || '')
    .split(/>|\/|→/)
    .map(part => String(part || '').trim())
    .filter(Boolean);
}
function normalizeKnowledgePathTitles(pathTitles, opts) {
  const options = opts || {};
  const maxDepth = Number(options.maxDepth || 5);
  const fallbackTitles = Array.isArray(options.fallbackTitles) ? options.fallbackTitles : [];
  const seed = Array.isArray(pathTitles) ? pathTitles : [];
  const normalized = collapseKnowledgePathTitles(
    seed
      .map(item => String(item || '').trim())
      .filter(Boolean)
  ).slice(0, Math.max(1, maxDepth));
  if (normalized.length) return normalized;
  return collapseKnowledgePathTitles(
    fallbackTitles
      .map(item => String(item || '').trim())
      .filter(Boolean)
  ).slice(0, Math.max(1, maxDepth));
}
function getEntryTypePathTitles(item) {
  const record = item && typeof item === 'object' ? item : {};
  return normalizeKnowledgePathTitles([
    record.type,
    record.subtype,
    record.subSubtype,
    record.level4 || record.fourthLevel || record.levelFour || record.topic4,
    record.level5 || record.fifthLevel || record.levelFive || record.topic5
  ]);
}
function getEntryKnowledgePathTitles(item, opts) {
  const record = item && typeof item === 'object' ? item : {};
  const options = opts || {};
  const fromType = getEntryTypePathTitles(record);
  if (fromType.length) return fromType;
  const titles = record.knowledgePathTitles;
  if (Array.isArray(titles) || typeof titles === 'string') {
    const fromTitles = normalizeKnowledgePathTitles(
      Array.isArray(titles) ? titles : splitKnowledgePathText(titles),
      { fallbackTitles: options.fallbackTitles || [] }
    );
    if (fromTitles.length) return fromTitles;
  }
  const legacyText = record.knowledgePath || record.knowledgeNodePath || record.notePath || '';
  if (options.allowLegacyPathText !== false && String(legacyText || '').trim()) {
    const fromLegacyText = normalizeKnowledgePathTitles(splitKnowledgePathText(legacyText), {
      fallbackTitles: options.fallbackTitles || []
    });
    if (fromLegacyText.length) return fromLegacyText;
  }
  return normalizeKnowledgePathTitles([], { fallbackTitles: options.fallbackTitles || [] });
}
function ensureKnowledgePathByTitles(pathTitles) {
  const titles = normalizeKnowledgePathTitles(pathTitles);
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
  const titles = normalizeKnowledgePathTitles(pathTitles);
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
  return (titles || [])
    .map(title => String(title || '').trim())
    .filter((title, idx, arr) => title && (idx === 0 || title !== arr[idx - 1]));
}
function getEntryPathTitlesFromForm() {
  const level1 = document.getElementById('editType')?.value || '';
  const level2 = document.getElementById('editSubtype')?.value.trim() || '';
  const level3 = document.getElementById('editSubSubtype')?.value.trim() || '';
  const level4 = document.getElementById('editLevel4')?.value.trim() || '';
  return normalizeKnowledgePathTitles([level1, level2, level3, level4], {
    fallbackTitles: [level1 || '其他', level2 || '未分类', level3 || '未细分']
  });
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
  const target = normalizeKnowledgePathTitles(pathTitles);
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
  if (cleanupNoisyRootNodes()) changed = true;
  if (cleanupForcedKnowledgeNodeByPath(['判断推理', '逻辑判断'])) changed = true;
  if (mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes())) changed = true;
  if (collapseDuplicateKnowledgeWrappers(getKnowledgeRootNodes())) changed = true;
  normalizeKnowledgeNodes(getKnowledgeRootNodes(), 1);
  if (mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes())) changed = true;
  ensureKnowledgeExpandedDefaults();
  errors.forEach(item => {
    const before = String((item && item.noteNodeId) || '');
    ensureKnowledgeBindingForError(item);
    const after = String((item && item.noteNodeId) || '');
    if (before !== after) changed = true;
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

