// ============================================================
// Random note practice prioritization helpers
// ============================================================
function _getErrorRecentWrongFlag(errorItem, summary) {
  if (summary && String(summary.lastResult || '') === 'wrong') return 1;
  if (Number(summary && summary.recentWrongCount || 0) > 0) return 1;
  if (String(errorItem && errorItem.lastResult || '') === 'wrong') return 1;
  return 0;
}

function _getErrorWrongCountForPriority(errorItem, summary) {
  const values = [
    Number(summary && summary.recentWrongCount || 0),
    Number(summary && summary.wrongCount || 0),
    Number(errorItem && errorItem.recentWrongCount || 0),
    Number(errorItem && errorItem.wrongCount || 0),
    Number(errorItem && errorItem.quiz && errorItem.quiz.wrongCount || 0),
  ].filter(v => Number.isFinite(v) && v >= 0);
  if (!values.length) return 0;
  return Math.max.apply(null, values);
}

function _getErrorDurationOverTargetRatio(errorItem, summary) {
  const target = Number(errorItem && errorItem.targetDurationSec || 0);
  if (!Number.isFinite(target) || target <= 0) return 0;
  const lastDuration = Number(
    (summary && summary.lastDuration)
    || (errorItem && errorItem.lastDuration)
    || (errorItem && errorItem.actualDurationSec)
    || 0
  );
  if (!Number.isFinite(lastDuration) || lastDuration <= 0) return 0;
  return Math.max(0, Math.min(2, (lastDuration - target) / target));
}

function _computeRandomNotePracticePriority(errorItem) {
  const summary = (typeof getPracticeSummaryForError === 'function') ? getPracticeSummaryForError(errorItem) : null;
  const wrongCount = _getErrorWrongCountForPriority(errorItem, summary);
  const recentWrong = _getErrorRecentWrongFlag(errorItem, summary);
  const durationOverTarget = _getErrorDurationOverTargetRatio(errorItem, summary);
  const score = (0.5 * wrongCount) + (0.3 * recentWrong) + (0.2 * durationOverTarget);
  return { score, wrongCount, recentWrong, durationOverTarget };
}

function _collectErrorsForRandomNotePractice(nodeId) {
  if (!nodeId || typeof getErrorEntries !== 'function') return [];
  const idSet = new Set([String(nodeId)]);
  if (typeof getKnowledgeNodeById === 'function' && typeof getKnowledgeDescendantNodeIds === 'function') {
    const node = getKnowledgeNodeById(nodeId);
    if (node) {
      (getKnowledgeDescendantNodeIds(node) || []).forEach(id => idSet.add(String(id)));
    }
  }
  return getErrorEntries().filter(e => {
    const nodeId = !e
      ? ''
      : (typeof resolveErrorKnowledgeNodeId === 'function'
        ? resolveErrorKnowledgeNodeId(e)
        : String(e.noteNodeId || ''));
    if (!nodeId || !idSet.has(String(nodeId || ''))) return false;
    if (typeof isEffectivelyMastered === 'function' && isEffectivelyMastered(e)) return false;
    return true;
  });
}
