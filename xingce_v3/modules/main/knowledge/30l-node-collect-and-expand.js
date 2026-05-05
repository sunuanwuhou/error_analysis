// ============================================================
// Knowledge node collect and expand helpers
// ============================================================
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

function detachKnowledgeNodeById(nodeId, nodes) {
  const targetId = String(nodeId || '').trim();
  if (!targetId) return null;
  const list = Array.isArray(nodes) ? nodes : getKnowledgeRootNodes();
  for (let idx = 0; idx < list.length; idx += 1) {
    const node = list[idx];
    if (!node) continue;
    if (String(node.id || '') === targetId) {
      list.splice(idx, 1);
      return node;
    }
    const found = detachKnowledgeNodeById(targetId, node.children || []);
    if (found) {
      node.isLeaf = !(Array.isArray(node.children) && node.children.length);
      return found;
    }
  }
  return null;
}

function getKnowledgeDescendantNodeIds(node) {
  if (!node) return [];
  let ids = [node.id];
  (node.children || []).forEach(child => {
    ids = ids.concat(getKnowledgeDescendantNodeIds(child));
  });
  return ids;
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
