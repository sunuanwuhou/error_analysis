// ============================================================
// Workspace data actions and scoped mutations
// ============================================================

function resolveCurrentErrorScope() {
  if (knowledgeNodeFilter) {
    const node = getKnowledgeNodeById(knowledgeNodeFilter);
    const nodeIds = node ? getKnowledgeDescendantNodeIds(node) : [knowledgeNodeFilter];
    return {
      label: node ? `Knowledge "${node.title}"` : 'Current knowledge scope',
      predicate: e => nodeIds.includes(typeof resolveErrorKnowledgeNodeId === 'function' ? resolveErrorKnowledgeNodeId(e) : String(e.noteNodeId || ''))
    };
  }
  if (typeFilter) {
    const scope = typeof resolveTypeFilterNodeScope === 'function'
      ? resolveTypeFilterNodeScope(typeFilter)
      : null;
    if (scope && scope.node) {
      return {
        label: `Knowledge "${scope.node.title}"`,
        predicate: e => scope.ids.includes(typeof resolveErrorKnowledgeNodeId === 'function' ? resolveErrorKnowledgeNodeId(e) : String(e.noteNodeId || ''))
      };
    }
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
      predicate: e => nodeIds.includes(typeof resolveErrorKnowledgeNodeId === 'function' ? resolveErrorKnowledgeNodeId(e) : String(e.noteNodeId || ''))
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

  refreshWorkspaceAfterErrorMutation({ save:false, syncNotes:true, renderNotes:true });
  showToast(`Question #${targetId} deleted`, 'success');
}

// Add a new error and keep related note structures ready.
function addError(data) {
  const record = {id: newId(), addDate: today(), ...data};
  if (typeof ensureKnowledgeBindingForError === 'function') {
    ensureKnowledgeBindingForError(record);
  }
  // 1. Add the error.
  errors.push(record);

  // 2. Sync note structure.
  syncNotesWithErrors();

  // 3. Create note chapter if needed.
  ensureNoteChapterExists(record.type, record.subtype, record.subSubtype, record.noteNodeId, record.knowledgePathTitles);

  // 4. Re-render.
  refreshWorkspaceAfterErrorMutation({ save:true, syncNotes:true, renderNotes:true });
}

// Ensure a knowledge note exists for the real tree node instead of the legacy notesByType bucket.
function ensureNoteChapterExists(type, subtype, subSubtype, noteNodeId, knowledgePathTitles) {
  const titles = Array.isArray(knowledgePathTitles) && knowledgePathTitles.length
    ? knowledgePathTitles.filter(Boolean)
    : [type || '', subtype || '', subSubtype || ''].filter(Boolean);
  const node = noteNodeId
    ? getKnowledgeNodeById(noteNodeId)
    : (titles.length && typeof ensureKnowledgePathByTitles === 'function' ? ensureKnowledgePathByTitles(titles) : null);
  if (!node) return null;
  if (typeof ensureKnowledgeNoteRecord === 'function') ensureKnowledgeNoteRecord(node);
  return node;
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
