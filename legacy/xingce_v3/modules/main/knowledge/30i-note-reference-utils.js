// ============================================================
// Knowledge note reference helpers
// ============================================================
function getLegacyKnowledgeNoteSnapshot(nodeId) {
  if (!knowledgeNotes || typeof knowledgeNotes !== 'object' || !nodeId) return null;
  const legacy = knowledgeNotes[nodeId];
  if (!legacy || typeof legacy !== 'object') return null;
  return {
    title: String(legacy.title || ''),
    content: String(legacy.content || ''),
    updatedAt: String(legacy.updatedAt || '')
  };
}

function removeKnowledgeNoteEntry(nodeId) {
  if (!nodeId || !knowledgeNotes || typeof knowledgeNotes !== 'object') return;
  delete knowledgeNotes[nodeId];
}

function rebindErrorToKnowledgeNodeId(errorItem, targetNodeId) {
  if (!errorItem) return false;
  const nextNodeId = String(targetNodeId || '').trim();
  if (!nextNodeId) {
    errorItem.noteNodeId = '';
    errorItem.knowledgePathTitles = [];
    errorItem.knowledgePath = '';
    errorItem.knowledgeNodePath = '';
    errorItem.notePath = '';
    errorItem.updatedAt = new Date().toISOString();
    return true;
  }
  const targetNode = typeof getKnowledgeNodeById === 'function' ? getKnowledgeNodeById(nextNodeId) : null;
  if (!targetNode) {
    errorItem.noteNodeId = nextNodeId;
    errorItem.updatedAt = new Date().toISOString();
    return true;
  }
  const stableTitles = collapseKnowledgePathTitles(getKnowledgePathTitles(targetNode.id));
  const stablePath = stableTitles.join(' > ');
  errorItem.noteNodeId = targetNode.id;
  errorItem.knowledgePathTitles = stableTitles.slice();
  errorItem.knowledgePath = stablePath;
  errorItem.knowledgeNodePath = stablePath;
  errorItem.notePath = stablePath;
  errorItem.type = stableTitles[0] || errorItem.type || '';
  errorItem.subtype = stableTitles[1] || errorItem.subtype || '';
  errorItem.subSubtype = stableTitles[stableTitles.length - 1] || errorItem.subSubtype || '';
  errorItem.updatedAt = new Date().toISOString();
  return true;
}

function migrateKnowledgeNodeReference(oldId, newId) {
  if (!oldId || !newId || oldId === newId) return;
  errors.forEach(item => {
    if (item.noteNodeId === oldId) {
      rebindErrorToKnowledgeNodeId(item, newId);
    }
  });
  if (selectedKnowledgeNodeId === oldId) selectedKnowledgeNodeId = newId;
  if (knowledgeNodeFilter === oldId) knowledgeNodeFilter = newId;
  if (knowledgeExpanded.has(oldId)) {
    knowledgeExpanded.delete(oldId);
    knowledgeExpanded.add(newId);
  }
  const legacy = getLegacyKnowledgeNoteSnapshot(oldId);
  if (legacy) {
    const current = getLegacyKnowledgeNoteSnapshot(newId) || { title: '', content: '', updatedAt: '' };
    if (!String(current.content || '').trim() && String(legacy.content || '').trim()) {
      knowledgeNotes[newId] = {
        title: current.title || legacy.title || '',
        content: legacy.content || '',
        updatedAt: legacy.updatedAt || current.updatedAt || ''
      };
    }
    removeKnowledgeNoteEntry(oldId);
  }
}
