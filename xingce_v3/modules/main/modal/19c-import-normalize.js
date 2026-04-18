// ============================================================
// Import normalize
// ============================================================

function getKnowledgeContextDepth(context) {
  if (!context) return 0;
  if (context.subSubtype) return 3;
  if (context.subtype) return 2;
  if (context.type) return 1;
  return 0;
}

function extractImportedKnowledgePathTitles(item) {
  const rawPath = item?.knowledgePath || item?.notePath || item?.knowledgeNodePath || item?.knowledgePathTitles || null;
  if (Array.isArray(rawPath)) {
    return rawPath.map(part => String(part || '').trim()).filter(Boolean);
  }
  if (typeof rawPath === 'string') {
    return rawPath.split(/>|\/|→/).map(part => String(part || '').trim()).filter(Boolean);
  }
  return [];
}

function getImportedErrorTargetNodeId(item, context) {
  const importedPathTitles = extractImportedKnowledgePathTitles(item);
  if (importedPathTitles.length >= 3) {
    const importedNode = ensureKnowledgePathByTitles(importedPathTitles);
    if (importedNode) {
      ensureKnowledgeNoteRecord(importedNode);
      return importedNode.id;
    }
  }
  if (item?.noteNodeId && getKnowledgeNodeById(item.noteNodeId)) {
    if (!item?.type && !item?.subtype && !item?.subSubtype) return item.noteNodeId;
    if (doesKnowledgeNodeMatchEntryPath(item.noteNodeId, item.type || '', item.subtype || '', item.subSubtype || '')) {
      return item.noteNodeId;
    }
  }
  const explicitType = String(item?.type || '').trim();
  const explicitSubtype = String(item?.subtype || '').trim();
  const explicitSubSubtype = String(item?.subSubtype || '').trim();
  if (explicitType || explicitSubtype || explicitSubSubtype) {
    const branch = ensureKnowledgeBranchPath(
      explicitType || context?.type || '其他',
      explicitSubtype || context?.subtype || '未分类',
      explicitSubSubtype || context?.subSubtype || ''
    );
    ensureKnowledgeNoteRecord(branch.sub2);
    return branch.sub2.id;
  }
  return '';
}

function getKnowledgeContextForEntry(nodeId) {
  const node = nodeId ? getKnowledgeNodeById(nodeId) : null;
  const titles = node ? collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)) : [];
  return {
    node,
    type: titles[0] || '',
    subtype: titles[1] || '',
    subSubtype: node && node.isLeaf ? (titles[titles.length - 1] || node.title || '') : (titles[titles.length - 1] || '')
  };
}

function normalizeImportedErrorsForCurrentKnowledge(list, defaultKind) {
  const context = importKnowledgeNodeId ? getKnowledgeContextForEntry(importKnowledgeNodeId) : null;
  return (list || []).map(item => {
    const normalizedType = item.type || context?.type || '其他';
    const normalizedSubtype = item.subtype || context?.subtype || '未分类';
    const normalizedSubSubtype = item.subSubtype || context?.subSubtype || '';
    return {
      ...normalizeEntryRecord(item, defaultKind || 'error'),
      id: item.id ? normalizeErrorId(item.id) : newId(),
      type: normalizedType,
      subtype: normalizedSubtype,
      subSubtype: normalizedSubSubtype,
      noteNodeId: getImportedErrorTargetNodeId({
        ...item,
        type: normalizedType,
        subtype: normalizedSubtype,
        subSubtype: normalizedSubSubtype
      }, context),
      addDate: item.addDate || today(),
      quiz: item.quiz || null,
      status: item.status || 'focus',
      masteryLevel: item.masteryLevel || 'not_mastered',
      masteryUpdatedAt: item.masteryUpdatedAt || null,
      lastPracticedAt: item.lastPracticedAt || null
    };
  });
}
