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
  const previous = knowledgeNotes && typeof knowledgeNotes === 'object' ? knowledgeNotes : {};
  const next = {};
  walkKnowledgeNodes(getKnowledgeRootNodes(), node => {
    const legacy = typeof getLegacyKnowledgeNoteSnapshot === 'function'
      ? getLegacyKnowledgeNoteSnapshot(node.id)
      : null;
    const nodeContent = String(node.contentMd || '').trim();
    const legacyContent = legacy && legacy.content ? String(legacy.content).trim() : '';
    const content = nodeContent || legacyContent || '';
    if (!nodeContent && legacyContent) {
      node.contentMd = legacy.content;
      if (legacy.updatedAt && !node.updatedAt) node.updatedAt = legacy.updatedAt;
    }
    next[node.id] = {
      title: String(node.title || (legacy && legacy.title) || ''),
      content,
      updatedAt: String(node.updatedAt || (legacy && legacy.updatedAt) || '')
    };
  });
  Object.keys(previous).forEach((nodeId) => {
    if (next[nodeId]) return;
    const legacy = previous[nodeId];
    const content = legacy && typeof legacy.content === 'string' ? legacy.content.trim() : '';
    if (!content) return;
    next[nodeId] = {
      title: String((legacy && legacy.title) || ''),
      content: legacy.content,
      updatedAt: String((legacy && legacy.updatedAt) || '')
    };
  });
  knowledgeNotes = next;
}
