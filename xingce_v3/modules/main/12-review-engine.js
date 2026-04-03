// ============================================================
// 复练引擎 / 今日任务包
// ============================================================
function _safePracticeDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const short = text.slice(0, 10);
  const d = new Date(short);
  return Number.isNaN(d.getTime()) ? null : d;
}

function _daysSincePractice(value) {
  const d = _safePracticeDate(value);
  if (!d) return null;
  const now = _safePracticeDate(today()) || new Date();
  return Math.max(Math.round((now.getTime() - d.getTime()) / 86400000), 0);
}

function _collectHistoryDetailRows(days) {
  const hist = loadHistory();
  const cutoff = addDays(today(), -(Math.max(Number(days) || 7, 1) - 1));
  const bucket = [];
  hist.forEach(item => {
    const day = String(item && item.date || '').slice(0, 10);
    if (!day || day < cutoff) return;
    (item.details || []).forEach(detail => {
      bucket.push({
        id: String(detail && detail.id || ''),
        correct: !!(detail && detail.correct),
        skipped: !!(detail && detail.skipped),
        day,
      });
    });
  });
  return bucket;
}

function getPracticeBehaviorSnapshot(days) {
  const rows = _collectHistoryDetailRows(days || 7);
  const total = rows.filter(item => !item.skipped).length;
  const correct = rows.filter(item => !item.skipped && item.correct).length;
  const wrong = rows.filter(item => !item.skipped && !item.correct).length;
  const uniqueIds = new Set(rows.map(item => item.id).filter(Boolean));
  const activeDays = new Set(rows.map(item => item.day).filter(Boolean));
  return {
    rangeDays: days || 7,
    total,
    correct,
    wrong,
    accuracy: total ? Math.round(correct / total * 100) : 0,
    uniqueErrors: uniqueIds.size,
    activeDays: activeDays.size,
  };
}

function computePracticeScore(errorLike) {
  const e = normalizeErrorForWorkflow(errorLike || {});
  const quiz = e.quiz || {};
  const summary = typeof getPracticeSummarySnapshotForError === 'function' ? (getPracticeSummarySnapshotForError(e) || {}) : {};
  let score = 0;
  const reasons = [];

  if (e.status === 'focus') { score += 20; reasons.push('重点复习'); }
  else if (e.status === 'review') { score += 12; reasons.push('待复习'); }

  if (e.masteryLevel === 'not_mastered') { score += 26; reasons.push('未掌握'); }
  else if (e.masteryLevel === 'fuzzy') { score += 14; reasons.push('掌握模糊'); }

  const reviewCount = Number(quiz.reviewCount || 0);
  const wrongCount = Number(quiz.wrongCount || 0);
  const streak = Number(quiz.streak || 0);
  const dueDays = _daysSincePractice(quiz.nextReview || e.nextReviewAt || e.lastPracticedAt || e.updatedAt || e.addDate);
  const staleDays = _daysSincePractice(e.lastPracticedAt || e.updatedAt || e.addDate);

  if (wrongCount >= 2) { score += 18 + Math.min(wrongCount * 2, 8); reasons.push('反复做错'); }
  else if (wrongCount === 1) { score += 10; }

  if (reviewCount === 0) { score += 14; reasons.push('尚未复练'); }
  if (streak === 0 && reviewCount > 0) { score += 8; reasons.push('最近不稳定'); }

  if (dueDays === null) { score += 8; }
  else {
    score += Math.min(dueDays, 18);
    if (dueDays >= 7) reasons.push('长期未练');
  }

  if (staleDays !== null && staleDays <= 7) { score += 6; reasons.push('新近错题'); }

  const confidence = Number(summary.lastConfidence || 0);
  const duration = Number(summary.lastDuration || 0);
  if (confidence && confidence <= 2) { score += 10; reasons.push('把握度低'); }
  if (duration >= 180) { score += 10; reasons.push('高耗时'); }
  else if (duration >= 90) { score += 6; }

  const hasReviewArtifact = !!String(e.rootReason || e.errorReason || e.analysis || e.note || e.nextAction || e.processCanvasData || '').trim();
  if (reviewCount > 0 && !hasReviewArtifact) { score += 12; reasons.push('已练未复盘'); }
  if (hasReviewArtifact && reviewCount === 0) { score += 9; reasons.push('已复盘待首练'); }

  if (!reasons.length) reasons.push('基础排序');
  return { score, reasons: reasons.slice(0, 3) };
}

function buildPracticeTaskPack(limit) {
  const maxItems = Math.max(Number(limit) || 12, 4);
  const entries = getErrorEntries().filter(e => normalizeErrorStatusValue(e.status) !== 'mastered');
  const ranked = entries.map(e => {
    const pack = computePracticeScore(e);
    return { ...e, practiceScore: pack.score, priorityReasons: pack.reasons };
  }).sort((a, b) => {
    if (b.practiceScore !== a.practiceScore) return b.practiceScore - a.practiceScore;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''), 'zh');
  });

  const reviewQueue = ranked.filter(e => {
    const hasReviewArtifact = !!String(e.rootReason || e.errorReason || e.analysis || e.note || e.nextAction || e.processCanvasData || '').trim();
    const reviewCount = Number((e.quiz && e.quiz.reviewCount) || 0);
    return reviewCount > 0 && !hasReviewArtifact;
  }).slice(0, Math.min(6, maxItems));

  const retrainQueue = ranked.filter(e => {
    const hasReviewArtifact = !!String(e.rootReason || e.errorReason || e.analysis || e.note || e.nextAction || e.processCanvasData || '').trim();
    const reviewCount = Number((e.quiz && e.quiz.reviewCount) || 0);
    const wrongCount = Number((e.quiz && e.quiz.wrongCount) || 0);
    const summary = typeof getPracticeSummarySnapshotForError === 'function' ? (getPracticeSummarySnapshotForError(e) || {}) : {};
    const lowConfidence = Number(summary.lastConfidence || 0) > 0 && Number(summary.lastConfidence || 0) <= 2;
    return hasReviewArtifact && (reviewCount === 0 || wrongCount > 0 || lowConfidence);
  }).slice(0, Math.min(6, maxItems));

  const dailyQueue = ranked.slice(0, maxItems);
  const weakestReasons = [];
  const reasonMap = {};
  ranked.forEach(e => {
    const reason = String(e.rootReason || e.errorReason || '').trim();
    if (!reason) return;
    reasonMap[reason] = (reasonMap[reason] || 0) + 1;
  });
  Object.entries(reasonMap).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([name,count]) => weakestReasons.push({ name, count }));

  const weakestTypes = [];
  const typeMap = {};
  ranked.forEach(e => {
    const type = String(e.type || '').trim();
    if (!type) return;
    typeMap[type] = (typeMap[type] || 0) + 1;
  });
  Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([name,count]) => weakestTypes.push({ name, count }));

  const advice = [];
  if (reviewQueue.length) advice.push({ key:'review_queue', title:`先补 ${reviewQueue.length} 道待复盘题`, description:'这些题已经练过，但错因/总结/过程图还不完整。' });
  if (retrainQueue.length) advice.push({ key:'retrain_queue', title:`优先复训 ${retrainQueue.length} 道不稳定题`, description:'这些题已有复盘痕迹，但最近仍做错、低把握或高耗时。' });
  if (dailyQueue.length) advice.push({ key:'daily_queue', title:`今天先练 ${dailyQueue.length} 道高优先级题`, description:'已按反复错、低把握、未掌握、长期未练综合排序。' });

  const mission = {
    total: dailyQueue.length,
    reviewCount: reviewQueue.length,
    retrainCount: retrainQueue.length,
    topScore: dailyQueue[0] ? Number(dailyQueue[0].practiceScore || 0) : 0,
    suggestedDailyCount: Math.min(Math.max(8, reviewQueue.length + retrainQueue.length), Math.max(dailyQueue.length, 8)),
    suggestedReviewCount: Math.min(Math.max(4, reviewQueue.length), Math.max(reviewQueue.length, 4)),
    suggestedRetrainCount: Math.min(Math.max(4, retrainQueue.length), Math.max(retrainQueue.length, 4)),
  };

  return { dailyQueue, reviewQueue, retrainQueue, weakestReasons, weakestTypes, advice, mission, behavior: getPracticeBehaviorSnapshot(7) };
}

function getTaskPackQueueByMode(mode, limit) {
  const taskPack = buildPracticeTaskPack(limit || 12);
  const normalized = String(mode || 'daily');
  if (normalized === 'review') return taskPack.reviewQueue || [];
  if (normalized === 'retrain') return taskPack.retrainQueue || [];
  return taskPack.dailyQueue || [];
}

function getDueList() {
  return buildPracticeTaskPack(24).dailyQueue;
}

function updateSidebar() {
  const taskPack = buildPracticeTaskPack(24);
  const dueN = taskPack.dailyQueue.length;
  const quizBadge = document.getElementById('quizBadge');
  if (quizBadge) quizBadge.textContent = dueN;
  const btn = document.getElementById('quizBtn');
  if (btn) {
    btn.classList.toggle('disabled', dueN===0);
    btn.title = dueN ? `今日任务 ${dueN} 题 · 待复盘 ${taskPack.reviewQueue.length} · 待复训 ${taskPack.retrainQueue.length}` : '今日暂无任务';
  }
  const fullN = getErrorEntries().filter(e => normalizeErrorStatusValue(e.status) !== 'mastered').length;
  const fullPracticeBadge = document.getElementById('fullPracticeBadge');
  if (fullPracticeBadge) fullPracticeBadge.textContent = fullN;
  const fullPracticeBtn = document.getElementById('fullPracticeBtn');
  if (fullPracticeBtn) fullPracticeBtn.classList.toggle('disabled', fullN===0);
  const total = todayDone + dueN;
  const progText = document.getElementById('progText');
  if (progText) progText.textContent = `${todayDone}/${total||todayDone}`;
  const pct = total>0 ? Math.round((todayDone/total)*100) : (todayDone>0?100:0);
  const progFill = document.getElementById('progFill');
  if (progFill) progFill.style.width = pct+'%';
}

window.computePracticeScore = computePracticeScore;
window.buildPracticeTaskPack = buildPracticeTaskPack;
window.getPracticeBehaviorSnapshot = getPracticeBehaviorSnapshot;
window.getTaskPackQueueByMode = getTaskPackQueueByMode;
