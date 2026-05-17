// ============================================================
// 01-state error workflow helper utils
// ============================================================
function stNormalizeErrorStatusValue(raw){
  var value = String(raw || '').trim();
  if(value === 'mastered') return 'mastered';
  if(value === 'review') return 'review';
  return 'focus';
}

function stNormalizeMasteryLevelValue(raw){
  var value = String(raw || '').trim();
  if(value === 'mastered') return 'mastered';
  if(value === 'fuzzy') return 'fuzzy';
  return 'not_mastered';
}

function stGetPracticeSummarySnapshotForError(errorLike, deps){
  var d = deps || {};
  var normalizedId = d.normalizeErrorId(errorLike && errorLike.id);
  var map = d.practiceAttemptSummaryByErrorId || {};
  if(normalizedId && Object.prototype.hasOwnProperty.call(map, normalizedId)) return map[normalizedId];
  var questionId = String((errorLike && errorLike.id) || '').trim();
  if(questionId && Object.prototype.hasOwnProperty.call(map, questionId)) return map[questionId];
  return null;
}

function stGetErrorWorkflowStage(errorLike, deps){
  var d = deps || {};
  var error = errorLike || {};
  var status = stNormalizeErrorStatusValue(error.status);
  var masteryLevel = stNormalizeMasteryLevelValue(error.masteryLevel);
  var summary = stGetPracticeSummarySnapshotForError(error, d);
  var hasAttemptSummary = !!(summary && (summary.lastTime || summary.lastResult || summary.lastConfidence || summary.lastDuration));
  var hasReason = !!String(error.rootReason || error.errorReason || error.mistakeType || error.triggerPoint || '').trim();
  var hasModel = !!String(error.analysis || error.correctModel || '').trim();
  var processImage = typeof d.getProcessImageUrl === 'function' ? d.getProcessImageUrl(error) : '';
  var hasReviewArtifact = !!String(error.note || error.nextAction || error.processCanvasData || processImage || '').trim();
  if(masteryLevel === 'mastered' || status === 'mastered') return 'mastered';
  if(hasAttemptSummary) return 'pending_retry';
  if(hasReviewArtifact || status === 'review') return 'review_ready';
  if(hasReason || hasModel || status === 'focus') return 'captured';
  return 'new';
}

function stRefreshWorkspaceAfterErrorMutation(options, deps){
  var d = deps || {};
  var cfg = Object.assign({ save:true, reveal:false, syncNotes:false, saveKnowledge:false, renderNotes:false }, options || {});
  if(cfg.save && typeof d.saveData === 'function') d.saveData();
  if(cfg.reveal && typeof d.saveReveal === 'function') d.saveReveal();
  if(cfg.syncNotes && typeof d.syncNotesWithErrors === 'function') d.syncNotesWithErrors();
  if(cfg.saveKnowledge && typeof d.saveKnowledgeState === 'function') d.saveKnowledgeState();
  if (typeof d.refreshSidebarErrorsOptionalNotes === "function") d.refreshSidebarErrorsOptionalNotes(cfg.renderNotes);
}
