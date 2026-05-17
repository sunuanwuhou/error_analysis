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
  refreshSidebarAndErrorsList();
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

function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const matched = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matched) return null;
  try {
    const mime = matched[1] || 'application/octet-stream';
    const b64 = matched[2] || '';
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch (e) {
    return null;
  }
}

function copyTextWithOptionalImage(text, imageDataUrl, onSuccess, onFailure) {
  const hasClipboardWrite = navigator.clipboard && typeof navigator.clipboard.write === 'function';
  const hasClipboardWriteText = navigator.clipboard && typeof navigator.clipboard.writeText === 'function';
  const imageBlob = dataUrlToBlob(imageDataUrl);
  if (hasClipboardWrite && imageBlob && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/plain': new Blob([text], { type: 'text/plain' }),
      [imageBlob.type || 'image/png']: imageBlob
    });
    navigator.clipboard.write([item]).then(onSuccess).catch(onFailure);
    return;
  }
  if (hasClipboardWriteText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(onFailure);
    return;
  }
  onFailure();
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
  copyTextWithOptionalImage(text, errorItem && errorItem.imgData, handleSuccess, handleFailure);
}

function getQuestionAndOptionsText(errorItem) {
  const item = errorItem && typeof errorItem === 'object' ? errorItem : {};
  const answer = String(item.answer || '').trim();
  const analysis = String(item.correctModel || item.analysis || '').trim();
  const scoreTip = String(item.nextAction || item.tip || '').trim();
  const sections = [
    '【答案】',
    answer || '(空)'
  ];
  if (analysis) sections.push('', '【解析】', analysis);
  if (scoreTip) sections.push('', '【提分】', scoreTip);
  return sections.join('\n');
}

function copyQuestionAndOptions(id) {
  const errorItem = findErrorById(id);
  if (!errorItem) {
    showToast('未找到题目', 'warning');
    return;
  }
  const text = getQuestionAndOptionsText(errorItem);
  const handleSuccess = () => showToast('答案与解析已复制到剪贴板', 'success');
  const handleFailure = () => {
    const ok = fallbackCopyText(text);
    if (ok) handleSuccess();
    else showToast('复制失败，请稍后重试', 'error');
  };
  copyTextWithOptionalImage(text, errorItem && errorItem.imgData, handleSuccess, handleFailure);
}

if (typeof window !== 'undefined') {
  window.copyErrorMarkdown = copyErrorMarkdown;
  window.copyQuestionAndOptions = copyQuestionAndOptions;
}
