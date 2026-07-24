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
    const previousEntry = previous[node.id];
    const previousContent = previousEntry && typeof previousEntry.content === 'string'
      ? previousEntry.content.trim()
      : '';
    const nodeContent = String(node.contentMd || '').trim();
    const legacyContent = legacy && legacy.content ? String(legacy.content).trim() : '';
    const content = nodeContent || legacyContent || previousContent || '';
    if (!nodeContent && content) {
      node.contentMd = nodeContent || legacyContent || previousContent;
      if (!node.updatedAt) {
        node.updatedAt = String(
          (legacy && legacy.updatedAt)
          || (previousEntry && previousEntry.updatedAt)
          || ''
        );
      }
    }
    next[node.id] = {
      title: String(node.title || (legacy && legacy.title) || (previousEntry && previousEntry.title) || ''),
      content,
      updatedAt: String(
        node.updatedAt
        || (legacy && legacy.updatedAt)
        || (previousEntry && previousEntry.updatedAt)
        || ''
      )
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
