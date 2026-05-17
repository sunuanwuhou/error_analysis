// ============================================================
// Note chapter maintenance actions
// ============================================================
function canDeleteNoteChapter(type, subtype, subSubtype) {
  const count = getErrorEntries().filter(e =>
    e.type === type &&
    e.subtype === subtype &&
    e.subSubtype === subSubtype
  ).length;
  return {
    canDelete: count === 0,
    count: count,
    message: count > 0 ? `${count} question(s) are still linked to this chapter.` : 'This chapter can be deleted'
  };
}

function safeDeleteNoteChapter(type, subtype, subSubtype) {
  const chapterName = getChapterDisplayName(type, subtype, subSubtype);
  const check = canDeleteNoteChapter(type, subtype, subSubtype);
  if (!check.canDelete) {
    showToast(check.message, 'warning');
    return false;
  }
  if (confirm(`Delete note chapter "${chapterName}"?`)) {
    deleteEmptyNoteChapter(type, subtype, subSubtype);
    syncNotesWithErrors();
    renderNotesByType();
    return true;
  }
  return false;
}

function getChapterDisplayName(type, subtype, subSubtype) {
  const parts = [];
  if (type) parts.push(type);
  if (subtype) parts.push(subtype);
  if (subSubtype) parts.push(subSubtype);
  return parts.join(' > ');
}

function deleteEmptyNoteChapter(type, subtype, subSubtype) {
  const key = `${type}::${subtype || 'Uncategorized'}::${subSubtype || 'Uncategorized'}`;
  deleteNoteNode(key, 0);
}

function clearNotes() {
  if (!selectedKnowledgeNodeId) return;
  const node = getKnowledgeNodeById(selectedKnowledgeNodeId);
  if (!node) return;
  if (!confirm(`Clear the Markdown note for "${node.title}"? This cannot be undone.`)) return;
  node.contentMd = '';
  node.updatedAt = new Date().toISOString();
  saveKnowledgeState();
  renderNotesByType();
  showToast('The current knowledge note has been cleared', 'success');
}
