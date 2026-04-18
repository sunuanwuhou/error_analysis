// ============================================================
// Notes tree status rendering
// ============================================================

function renderNotesPanelTree(notesData, level) {
  // Keep this stub so older callers do not fail.
  return '';
}

// Render note tree with chapter status and actions.
function renderNotesTreeWithStatus(notesData, level = 0) {
  if (!notesData || Object.keys(notesData).length === 0) {
    return `<div class="note-placeholder">No notes yet. Use the edit button to add a summary.</div>`;
  }

  let html = '';
  for (const [key, node] of Object.entries(notesData)) {
    const hasChildren = node.children && Object.keys(node.children).length > 0;
    const isExpanded = expTypes.has(key) || level > 0;
    const indent = '  '.repeat(level);

    // Count linked questions under this chapter.
    const chapterCount = countQuestionsInChapter(key, level);
    const hasQuestions = chapterCount > 0;

    const statusClass = hasQuestions ? 'status-has-questions' : 'status-empty';
    const statusText = hasQuestions ? `${chapterCount} linked question(s)` : 'Empty chapter';

    // Render chapter row.
    html += `${indent}<div class="note-tree-item">
      <div class="note-tree-header" onclick="toggleNoteNode('${escapeHtml(key)}', ${level})">
        <div class="note-tree-arrow ${isExpanded ? 'open' : ''}">${hasChildren ? '▼' : '•'}</div>
        <div class="note-tree-title">${escapeHtml(node.title || key)}</div>
        <div class="note-tree-count ${statusClass}">${statusText}</div>
      </div>
      <div class="note-tree-content" style="display:${isExpanded ? 'block' : 'none'}">
        <div class="chapter-meta">
          <span class="status ${statusClass}">${statusText}</span>
          <span style="color:#888">Updated ${node.updatedAt || 'Not recorded'}</span>
          <div class="chapter-actions">
            <button class="btn-delete" ${hasQuestions ? 'disabled' : ''}
                    onclick="event.stopPropagation(); safeDeleteNoteChapter('${escapeHtml(key.split('::')[0])}', '${escapeHtml(key.split('::')[1] || '')}', '${escapeHtml(key.split('::')[2] || '')}')"
                    title="${hasQuestions ? 'Has linked questions' : 'Delete empty chapter'}">Delete</button>
            <button class="note-action-btn" onclick="event.stopPropagation(); editNoteNode('${escapeHtml(key)}', ${level})" title="Edit">Edit</button>
            <button class="note-action-btn" onclick="filterByNoteTitle('${escapeHtml(key.split('::')[0])}', '${escapeHtml(key.split('::')[1] || '')}', '${escapeHtml(key.split('::')[2] || '')}')" title="Filter questions">Filter</button>
          </div>
        </div>
        ${node.content ? renderMd(node.content) : '<div style="color:#aaa;font-size:12px">No content</div>'}
        ${hasChildren ? renderNotesTreeWithStatus(node.children, level + 1) : ''}
      </div>
    </div>`;
  }
  return html;
}

// Count questions under the chapter.
function countQuestionsInChapter(key, level) {
  const parts = key.split('::');
  const type = parts[0];
  const subtype = parts[1] || null;
  const subSubtype = parts[2] || null;

  return getErrorEntries().filter(e => {
    const matchType = e.type === type;
    const matchSubtype = subtype === 'Uncategorized' ? !e.subtype : e.subtype === subtype;
    const matchSubSubtype = subSubtype === 'Uncategorized' ? !e.subSubtype : e.subSubtype === subSubtype;

    if (level === 0) return matchType && matchSubtype && matchSubSubtype;
    if (level === 1) return matchType && matchSubtype;
    if (level === 2) return matchType;
    return false;
  }).length;
}
