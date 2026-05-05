// ============================================================
// Knowledge node error count helpers
// ============================================================
function getKnowledgeErrorCountMaps() {
  if (knowledgeErrorCountCache.version === knowledgeErrorCountCacheVersion) {
    return knowledgeErrorCountCache;
  }
  const direct = new Map();
  getErrorEntries().forEach(item => {
    const nodeId = typeof resolveErrorKnowledgeNodeId === 'function'
      ? String(resolveErrorKnowledgeNodeId(item) || '')
      : String(item && item.noteNodeId || '');
    if (!nodeId) return;
    direct.set(nodeId, (direct.get(nodeId) || 0) + 1);
  });
  const aggregate = new Map();
  function walkAggregate(node) {
    if (!node || !node.id) return 0;
    let total = direct.get(node.id) || 0;
    (node.children || []).forEach(child => {
      total += walkAggregate(child);
    });
    aggregate.set(node.id, total);
    return total;
  }
  getKnowledgeRootNodes().forEach(root => walkAggregate(root));
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
