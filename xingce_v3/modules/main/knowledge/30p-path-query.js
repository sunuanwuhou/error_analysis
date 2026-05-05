// ============================================================
// Knowledge path query helpers
// ============================================================
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
  function walkPath(nodes, parentTrail) {
    for (const node of nodes) {
      const next = parentTrail.concat(node.title);
      if (node.id === nodeId) return next;
      const found = walkPath(node.children || [], next);
      if (found) return found;
    }
    return null;
  }
  return walkPath(getKnowledgeRootNodes(), []) || [];
}
