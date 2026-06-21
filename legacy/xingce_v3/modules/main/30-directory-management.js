// ============================================================
// Directory management
// ============================================================
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
    } else if (!String(node.contentMd || '').trim() && legacy && String(legacy.content || '').trim()) {
      node.contentMd = legacy.content;
    }
    if (typeof node.updatedAt !== 'string') {
      node.updatedAt = legacy && typeof legacy.updatedAt === 'string' ? legacy.updatedAt : '';
    } else if (!String(node.updatedAt || '').trim() && legacy && String(legacy.updatedAt || '').trim()) {
      node.updatedAt = legacy.updatedAt;
    }
    normalizeKnowledgeNodes(node.children, level + 1);
    node.isLeaf = node.children.length === 0;
  });
}
function ensureKnowledgeState(opts) {
  const options = opts || {};
  const preserveTreeShape = options.preserveTreeShape === true;
  const shouldRepairStructure = options.repair === true;
  const shouldSyncErrors = options.syncErrors === true;
  getKnowledgeRootNodes();
  knowledgeNotes = knowledgeNotes && typeof knowledgeNotes === 'object' ? knowledgeNotes : {};
  let changed = preserveTreeShape ? false : ensureFixedKnowledgeRoots();
  if (!preserveTreeShape && shouldRepairStructure) {
    const baselineApplied = typeof applyKnowledgeTreeBaselineFreeze === 'function' && applyKnowledgeTreeBaselineFreeze();
    if (baselineApplied) {
      changed = true;
    } else if (cleanupNoisyRootNodes()) {
      changed = true;
    }
    if (mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes())) changed = true;
    if (collapseDuplicateKnowledgeWrappers(getKnowledgeRootNodes())) changed = true;
  }
  normalizeKnowledgeNodes(getKnowledgeRootNodes(), 1);
  if (!preserveTreeShape && shouldRepairStructure && mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes())) changed = true;
  ensureKnowledgeExpandedDefaults();
  if (shouldSyncErrors) {
    if (typeof resyncAllErrorKnowledgeBindings === 'function') {
      if (resyncAllErrorKnowledgeBindings() > 0) changed = true;
    } else {
      errors.forEach(item => {
        const before = String((item && item.noteNodeId) || '');
        ensureKnowledgeBindingForError(item);
        const after = String((item && item.noteNodeId) || '');
        if (before !== after) changed = true;
      });
    }
  }
  const allNodes = collectKnowledgeNodes();
  if ((!selectedKnowledgeNodeId || !getKnowledgeNodeById(selectedKnowledgeNodeId)) && allNodes.length > 0) {
    selectedKnowledgeNodeId = allNodes[0].id;
  }
  if (changed) {
    knowledgeErrorCountCacheVersion += 1;
  }
  if (preserveTreeShape) {
    hydrateKnowledgeContentFromStoredNotes();
  } else {
    syncKnowledgeNotesFromTree();
  }
  const canPersistErrors = typeof hasFullWorkspaceDataLoaded !== 'function' || hasFullWorkspaceDataLoaded();
  if (options.persist && changed && canPersistErrors) {
    saveData();
  }
  if (options.persist) {
    saveKnowledgeState({ preserveTreeShape });
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

