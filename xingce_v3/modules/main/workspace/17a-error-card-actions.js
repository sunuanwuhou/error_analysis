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

function getErrorCardMarkdown(errorItem) {
  const item = errorItem && typeof errorItem === 'object' ? errorItem : {};
  const question = String(item.question || '').trim();
  const options = String(item.options || '')
    .split(/\n|\|/)
    .map(part => String(part || '').trim())
    .filter(Boolean)
    .join('\n');
  const answer = String(item.answer || '').trim();
  const analysis = String(item.correctModel || item.analysis || '').trim();
  const scoreTip = String(item.nextAction || item.tip || '').trim();
  const questionBlock = [question, options].filter(Boolean).join('\n\n');
  const sections = [
    '# 题目导出',
    '',
    '## 题目',
    questionBlock || '未填写',
    '',
    '## 答案',
    answer || '未填写',
    '',
    '## 解析',
    analysis || '未填写',
    '',
    '## 提分',
    scoreTip || '未填写'
  ];
  return sections.join('\n');
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function copyErrorMarkdown(id) {
  const errorItem = findErrorById(id);
  if (!errorItem) {
    showToast('未找到题目', 'warning');
    return;
  }
  const text = getErrorCardMarkdown(errorItem);
  const handleSuccess = () => showToast('该题 MD 已复制到剪贴板', 'success');
  const handleFailure = () => {
    const ok = fallbackCopyText(text);
    if (ok) handleSuccess();
    else showToast('复制失败，请稍后重试', 'error');
  };
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text).then(handleSuccess).catch(handleFailure);
    return;
  }
  handleFailure();
}

if (typeof window !== 'undefined') {
  window.copyErrorMarkdown = copyErrorMarkdown;
}
