// ============================================================
// Error card actions
// ============================================================

function saveCardNote(id, val) {
  const e = findErrorById(id);
  if (!e) return;
  e.note = val;
  touchErrorUpdatedAt(e);
  recordErrorUpsert(e);
  refreshWorkspaceAfterErrorMutation({ save: true });
}

function updateStatus(id, s) {
  const e = findErrorById(id);
  if (!e) return;
  e.status = normalizeErrorStatusValue(s);
  if (e.status === 'mastered') e.masteryLevel = 'mastered';
  if (e.status !== 'mastered' && normalizeMasteryLevelValue(e.masteryLevel) === 'mastered') e.masteryLevel = 'fuzzy';
  touchErrorUpdatedAt(e);
  recordErrorUpsert(e);
  refreshWorkspaceAfterErrorMutation({ save: true });
}

function updateWorkflowStage(id, stage) {
  const e = findErrorById(id);
  if (!e) return;
  e.workflowStage = normalizeWorkflowStageValue(stage);
  if (e.workflowStage === 'mastered') {
    e.status = 'mastered';
    e.masteryLevel = 'mastered';
  } else if (normalizeErrorStatusValue(e.status) === 'mastered') {
    e.status = 'review';
    if (normalizeMasteryLevelValue(e.masteryLevel) === 'mastered') e.masteryLevel = 'fuzzy';
  }
  touchErrorUpdatedAt(e);
  recordErrorUpsert(e);
  refreshWorkspaceAfterErrorMutation({ save: true });
}

function cyclemastery(id) {
  const e = findErrorById(id);
  if (!e) return;
  const cycle = { not_mastered: 'fuzzy', fuzzy: 'mastered', mastered: 'not_mastered' };
  e.masteryLevel = cycle[normalizeMasteryLevelValue(e.masteryLevel)] || 'not_mastered';
  e.masteryUpdatedAt = new Date().toISOString();
  if (e.masteryLevel === 'mastered') e.status = 'mastered';
  else if (normalizeErrorStatusValue(e.status) === 'mastered') e.status = 'review';
  touchErrorUpdatedAt(e);
  recordErrorUpsert(e);
  refreshWorkspaceAfterErrorMutation({ save: true });
}

function deleteErrorFallback(id) {
  const targetId = normalizeErrorId(id);
  if (!confirm(`Delete #${targetId}?`)) return;
  errors = errors.filter(e => normalizeErrorId(e.id) !== targetId);
  revealed.delete(targetId);
  refreshWorkspaceAfterErrorMutation({ save: true, reveal: true, syncNotes: true });
}

if (typeof window !== 'undefined' && typeof window.deleteError !== 'function') {
  window.deleteError = deleteErrorFallback;
}

function clearAllData() {
  if (!errors.length) {
    showToast('No data to clear', 'warning');
    return;
  }
  if (!confirm(`Clear all ${errors.length} items?`)) return;
  errors = [];
  revealed = new Set();
  saveData();
  saveReveal();
  renderSidebar();
  renderAll();
}
