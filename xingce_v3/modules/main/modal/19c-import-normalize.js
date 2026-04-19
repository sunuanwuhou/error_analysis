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

function normalizeKnowledgePathTitlesForImport(pathTitles, fallbackTitles) {
  if (typeof normalizeKnowledgePathTitles === 'function') {
    return normalizeKnowledgePathTitles(pathTitles, { fallbackTitles: fallbackTitles || [] });
  }
  const seed = Array.isArray(pathTitles) ? pathTitles : [];
  const fallback = Array.isArray(fallbackTitles) ? fallbackTitles : [];
  const cleaned = seed.map(part => String(part || '').trim()).filter(Boolean).slice(0, 5);
  if (cleaned.length) return cleaned;
  return fallback.map(part => String(part || '').trim()).filter(Boolean).slice(0, 5);
}

function getEntryKnowledgePathTitlesForImport(item, opts) {
  if (typeof getEntryKnowledgePathTitles === 'function') {
    return getEntryKnowledgePathTitles(item, opts || {});
  }
  const options = opts || {};
  const record = item && typeof item === 'object' ? item : {};
  const fromType = normalizeKnowledgePathTitlesForImport(
    [record.type, record.subtype, record.subSubtype, record.level4, record.level5],
    []
  );
  if (fromType.length) return fromType;
  const fromTitles = record.knowledgePathTitles;
  if (Array.isArray(fromTitles)) {
    const normalizedTitles = normalizeKnowledgePathTitlesForImport(fromTitles, options.fallbackTitles || []);
    if (normalizedTitles.length) return normalizedTitles;
  }
  const text = String(record.knowledgePath || record.knowledgeNodePath || record.notePath || '').trim();
  if (text) {
    return normalizeKnowledgePathTitlesForImport(text.split(/>|\/|→/), options.fallbackTitles || []);
  }
  return normalizeKnowledgePathTitlesForImport([], options.fallbackTitles || []);
}

function extractImportedKnowledgePathTitles(item) {
  return getEntryKnowledgePathTitlesForImport(item, { allowLegacyPathText: true });
}

function getImportedErrorTargetNodeId(item, context) {
  const contextFallback = [context?.type || '其他', context?.subtype || '未分类', context?.subSubtype || '未细分'];
  const importedPathTitles = getEntryKnowledgePathTitlesForImport(item, {
    allowLegacyPathText: true,
    fallbackTitles: contextFallback
  });
  if (importedPathTitles.length) {
    const importedNode = ensureKnowledgePathByTitles(importedPathTitles);
    if (importedNode) {
      ensureKnowledgeNoteRecord(importedNode);
      return importedNode.id;
    }
  }
  if (item?.noteNodeId && getKnowledgeNodeById(item.noteNodeId)) {
    if (!importedPathTitles.length) return item.noteNodeId;
    if (doesKnowledgeNodeMatchPathTitles(item.noteNodeId, importedPathTitles)) {
      return item.noteNodeId;
    }
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
    const normalizedPathTitles = getEntryKnowledgePathTitlesForImport(item, {
      allowLegacyPathText: true,
      fallbackTitles: [context?.type || '其他', context?.subtype || '未分类', context?.subSubtype || '未细分']
    });
    const normalizedType = normalizedPathTitles[0] || context?.type || '其他';
    const normalizedSubtype = normalizedPathTitles[1] || context?.subtype || '未分类';
    const normalizedSubSubtype = normalizedPathTitles[normalizedPathTitles.length - 1] || context?.subSubtype || '未细分';
    return {
      ...normalizeEntryRecord(item, defaultKind || 'error'),
      id: item.id ? normalizeErrorId(item.id) : newId(),
      type: normalizedType,
      subtype: normalizedSubtype,
      subSubtype: normalizedSubSubtype,
      knowledgePathTitles: normalizedPathTitles,
      knowledgePath: normalizedPathTitles.join(' > '),
      knowledgeNodePath: normalizedPathTitles.join(' > '),
      notePath: normalizedPathTitles.join(' > '),
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
