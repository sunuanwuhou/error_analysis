// ============================================================
// Knowledge duplicate merge helpers
// ============================================================
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
