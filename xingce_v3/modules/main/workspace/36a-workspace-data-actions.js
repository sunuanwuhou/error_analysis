// ============================================================
// Workspace data actions and scoped mutations
// ============================================================

function resolveCurrentErrorScope() {
  if (knowledgeNodeFilter) {
    const node = getKnowledgeNodeById(knowledgeNodeFilter);
    const nodeIds = node ? getKnowledgeDescendantNodeIds(node) : [knowledgeNodeFilter];
    return {
      label: node ? `Knowledge "${node.title}"` : 'Current knowledge scope',
      predicate: e => nodeIds.includes(e.noteNodeId)
    };
  }
  if (typeFilter) {
    if (typeFilter.level === 'type') {
      return {
        label: `Type "${typeFilter.value}"`,
        predicate: e => e.type === typeFilter.value
      };
    }
    if (typeFilter.level === 'subtype') {
      return {
        label: `Module "${typeFilter.type} / ${typeFilter.value}"`,
        predicate: e => e.type === typeFilter.type && e.subtype === typeFilter.value
      };
    }
    return {
      label: `Module "${typeFilter.type} / ${typeFilter.subtype} / ${typeFilter.value}"`,
      predicate: e => e.type === typeFilter.type && e.subtype === typeFilter.subtype && e.subSubtype === typeFilter.value
    };
  }
  if (selectedKnowledgeNodeId) {
    const node = getKnowledgeNodeById(selectedKnowledgeNodeId);
    const nodeIds = node ? getKnowledgeDescendantNodeIds(node) : [selectedKnowledgeNodeId];
    return {
      label: node ? `Knowledge "${node.title}"` : 'Current knowledge scope',
      predicate: e => nodeIds.includes(e.noteNodeId)
    };
  }
  if (statusFilter !== 'all' || reasonFilter || searchKw || dateFrom || dateTo) {
    const ids = new Set(getFiltered().map(item => item.id));
    return {
      label: 'Current filtered result',
      predicate: e => ids.has(e.id)
    };
  }
  return null;
}

function clearCurrentModuleErrors() {
  const scope = resolveCurrentErrorScope();
  if (!scope) {
    showToast('Open a module or apply a filter before clearing', 'warning');
    return;
  }
  const matched = getErrorEntries().filter(scope.predicate);
  if (!matched.length) {
    showToast(`No questions found in ${scope.label}`, 'warning');
    return;
  }
  if (!confirm(`Delete ${matched.length} question(s) from ${scope.label}? This cannot be undone.`)) return;
  const ids = new Set(matched.map(item => item.id));
  errors = errors.filter(item => !ids.has(item.id));
  ids.forEach(id => revealed.delete(id));
  saveData();
  saveReveal();
  syncNotesWithErrors();
  renderSidebar();
  renderAll();
  renderNotesByType();
  showToast(`${matched.length} question(s) deleted from ${scope.label}`, 'success');
}

function clearAllErrorsData() {
  const errorEntries = getErrorEntries();
  if (!errorEntries.length) {
    showToast('There are no questions to delete', 'warning');
    return;
  }
  if (!confirm(`Delete all ${errorEntries.length} error question(s)? Claude items will be kept.`)) return;
  const ids = new Set(errorEntries.map(item => normalizeErrorId(item.id)));
  errors = errors.filter(item => !ids.has(normalizeErrorId(item.id)));
  revealed = new Set([...revealed].filter(id => !ids.has(normalizeErrorId(id))));
  saveData();
  saveReveal();
  syncNotesWithErrors();
  renderSidebar();
  renderAll();
  renderNotesByType();
  showToast('All error questions cleared', 'success');
}

function renderRelatedErrorOptions(options) {
  const raw = (options || '').trim();
  if (!raw) return '';
  const parts = raw.split(/\s*\|\s*/).map(item => item.trim()).filter(Boolean);
  if (!parts.length) return '';
  return `<div class="related-error-options">${parts.map(item => `<div class="related-error-option">${escapeHtml(item)}</div>`).join('')}</div>`;
}

function renderRelatedErrorMeta(label, value) {
  const text = (value || '').trim();
  if (!text) return '';
  return `<div class="related-error-meta"><strong>${escapeHtml(label)}</strong>${escapeHtml(text)}</div>`;
}

// Delete an error item and keep linked state in sync.
function deleteError(id){
  const targetId = normalizeErrorId(id);
  if(!confirm(`Delete question #${targetId}?`))return;

  const error = findErrorById(targetId);
  if (!error) return;

  unrefImageValue(error.imgData);
  unrefImageValue(error.analysisImgData);
  unrefImageValue(getProcessImageUrl(error));
  errors = errors.filter(e => normalizeErrorId(e.id) !== targetId);
  revealed.delete(targetId);
  recordErrorDelete(targetId);
  refreshWorkspaceAfterErrorMutation({ save:true, reveal:true });

  // If a type no longer has questions, allow removing its note bucket too.
  const typeCount = getErrorEntries().filter(e => e.type === error.type).length;
  if (typeCount === 0 && notesByType[error.type]) {
    if (confirm(`"${error.type}" has no remaining questions. Delete its note bucket too?`)) {
      delete notesByType[error.type];
      saveNotesByType();
    }
  }

  refreshWorkspaceAfterErrorMutation({ save:false, syncNotes:true, renderNotes:true });
  showToast(`Question #${targetId} deleted`, 'success');
}

// Add a new error and keep related note structures ready.
function addError(data) {
  // 1. Add the error.
  errors.push({id: newId(), addDate: today(), ...data});

  // 2. Sync note structure.
  syncNotesWithErrors();

  // 3. Create note chapter if needed.
  ensureNoteChapterExists(data.type, data.subtype, data.subSubtype);

  // 4. Re-render.
  refreshWorkspaceAfterErrorMutation({ save:true, syncNotes:true, renderNotes:true });
}

// Ensure a note chapter exists.
function ensureNoteChapterExists(type, subtype, subSubtype) {
  const key = `${type}::${subtype || 'Uncategorized'}::${subSubtype || 'Uncategorized'}`;

  // Check whether it already exists.
  let node = getNoteNodeByKey(notesByType, key, 0);
  if (node) {
    return;
  }

  // Create a new note chapter.
  const newNode = {
    title: `${type} ${subtype || ''} ${subSubtype || ''}`.trim(),
    content: `## ${type} ${subtype || ''} ${subSubtype || ''}`.trim(),
    children: {},
    updatedAt: today()
  };

  // Insert into note structure.
  setNoteNodeByKey(notesByType, key, 0, newNode);
  saveNotesByType();
}

// Set a note node by key path.
function setNoteNodeByKey(notesData, key, level, node) {
  const parts = key.split('::');
  if (level >= parts.length) return;

  const currentKey = parts[level];
  if (!notesData[currentKey]) {
    notesData[currentKey] = { title: currentKey, content: '', children: {}, updatedAt: today() };
  }

  if (level === parts.length - 1) {
    // Reached the target level.
    notesData[currentKey] = node;
  } else {
    // Continue into the next level.
    setNoteNodeByKey(notesData[currentKey].children, key, level + 1, node);
  }
}
