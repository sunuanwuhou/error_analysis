// ============================================================
// Knowledge walk and notes sync helpers
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
