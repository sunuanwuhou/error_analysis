// ============================================================
// Practice task engine / home queue model
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
  const summary = typeof getPracticeSummarySnapshotForError === 'function'
    ? (getPracticeSummarySnapshotForError(e) || {})
    : {};
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

  const hasReviewArtifact = !!String(
    e.rootReason || e.errorReason || e.analysis || e.note || e.nextAction || e.processCanvasData || ''
  ).trim();
  if (reviewCount > 0 && !hasReviewArtifact) { score += 12; reasons.push('已练未复盘'); }
  if (hasReviewArtifact && reviewCount === 0) { score += 9; reasons.push('已复盘待首练'); }

  if (!reasons.length) reasons.push('基础排序');
  return { score, reasons: reasons.slice(0, 3) };
}

const NOTE_FIRST_HINTS = ['不会', '没想到', '想不到', '题型', '识别', '概念', '公式', '方法', '语境', '知识点'];
const DIRECT_DO_HINTS = ['粗心', '看漏', '漏读', '审题', '顺序', '比较', '主语', '限定', '选项'];
const SPEED_DRILL_HINTS = ['耗时', '拖慢', '犹豫', '时间', '来不及', '卡住', '速度', '超时'];

function buildWorkflowTaskHints(errorLike) {
  const e = normalizeErrorForWorkflow(errorLike || {});
  const summary = typeof getPracticeSummarySnapshotForError === 'function'
    ? (getPracticeSummarySnapshotForError(e) || {})
    : {};
  const blob = [
    e.rootReason,
    e.errorReason,
    e.analysis,
    e.tip,
    e.nextAction,
    e.problemType,
    e.subtype,
    e.subSubtype,
    summary.lastMistakeType,
    summary.lastTriggerPoint,
    summary.lastCorrectModel,
    summary.lastNextAction,
  ].filter(Boolean).join(' ').toLowerCase();
  const targetDuration = Math.max(Number(e.targetDurationSec || 0), 1);
  const actualDuration = Math.max(
    Number(e.actualDurationSec || 0),
    Number(summary.lastDuration || 0),
    Number(summary.avgDuration || 0)
  );
  const confidence = Number(e.confidence || summary.lastConfidence || 0);
  const noteReady = !!String(e.noteNodeId || e.tip || e.analysis || '').trim();
  const matches = list => list.some(keyword => blob.includes(keyword));

  const isSpeedDrill = (
    (targetDuration > 0 && actualDuration > targetDuration) ||
    (targetDuration > 0 && actualDuration >= Math.round(targetDuration * 1.5)) ||
    matches(SPEED_DRILL_HINTS)
  );
  const isNoteFirst = (
    String(e.problemType || '').toLowerCase() === 'cognition' ||
    matches(NOTE_FIRST_HINTS) ||
    (confidence && confidence <= 2 && noteReady && !isSpeedDrill)
  );
  const isDirectDo = (
    String(e.problemType || '').toLowerCase() === 'execution' ||
    matches(DIRECT_DO_HINTS) ||
    String(summary.lastResult || '') === 'wrong' ||
    Number(summary.recentWrongCount || 0) >= 1
  );

  return {
    isSpeedDrill,
    isNoteFirst,
    isDirectDo,
    noteReady,
    actualDuration,
    targetDuration,
    confidence,
    summary,
  };
}

function isEffectivelyMastered(errorLike) {
  const e = normalizeErrorForWorkflow(errorLike || {});
  if (normalizeErrorStatusValue(e.status) === 'mastered') return true;
  const mastery = String(e.masteryLevel || '').trim().toLowerCase();
  return mastery === 'mastered';
}

function buildPracticeTaskPack(limit) {
  const maxItems = Math.max(Number(limit) || 12, 4);
  const entries = getErrorEntries().filter(e => !isEffectivelyMastered(e));
  const ranked = entries.map(e => {
    const normalized = typeof normalizeErrorForWorkflow === 'function'
      ? normalizeErrorForWorkflow({ ...e })
      : { ...e };
    const pack = computePracticeScore(normalized);
    return { ...normalized, practiceScore: pack.score, priorityReasons: pack.reasons };
  }).sort((a, b) => {
    if (b.practiceScore !== a.practiceScore) return b.practiceScore - a.practiceScore;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''), 'zh');
  });

  const reviewQueue = ranked.filter(e => {
    const stage = String(e.workflowStage || '');
    return stage === 'captured' || stage === 'diagnosing';
  }).slice(0, Math.min(6, maxItems));

  const reviewReadyQueue = ranked.filter(e => String(e.workflowStage || '') === 'review_ready')
    .slice(0, Math.min(6, maxItems));

  const retrainQueue = ranked.filter(e => {
    const stage = String(e.workflowStage || '');
    return stage === 'retrain_due';
  }).slice(0, Math.min(6, maxItems));

  const noteFirstQueue = [];
  const directDoQueue = [];
  const speedDrillQueue = [];

  ranked.forEach(e => {
    const hints = buildWorkflowTaskHints(e);
    const common = {
      ...e,
      noteReady: hints.noteReady,
      recentWrongCount: Number(hints.summary.recentWrongCount || 0),
      lastConfidence: Number(hints.summary.lastConfidence || 0),
      lastDuration: Number(hints.summary.lastDuration || 0),
      avgDuration: Number(hints.summary.avgDuration || 0),
      lastResult: String(hints.summary.lastResult || ''),
    };

    if (hints.isSpeedDrill) {
      speedDrillQueue.push({
        ...common,
        taskMode: 'speed',
        taskLane: 'speed_drill',
        taskReason: '超时或明显拖慢，先限时复训',
      });
      return;
    }

    if (hints.isNoteFirst && hints.noteReady) {
      noteFirstQueue.push({
        ...common,
        taskMode: 'note',
        taskLane: 'note_first',
        taskReason: '方法未稳，先看笔记再做题',
      });
      return;
    }

    directDoQueue.push({
      ...common,
      taskMode: 'direct',
      taskLane: 'direct_do',
      taskReason: hints.noteReady ? '有基础但容易做错，先直接开做' : '先看短提示后进入练习',
    });
  });

  const dailyQueue = ranked.slice(0, maxItems);
  const weakestReasons = [];
  const reasonMap = {};
  ranked.forEach(e => {
    const reason = String(e.rootReason || e.errorReason || '').trim();
    if (!reason) return;
    reasonMap[reason] = (reasonMap[reason] || 0) + 1;
  });
  Object.entries(reasonMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([name, count]) => weakestReasons.push({ name, count }));

  const weakestTypes = [];
  const typeMap = {};
  ranked.forEach(e => {
    const type = String(e.type || '').trim();
    if (!type) return;
    typeMap[type] = (typeMap[type] || 0) + 1;
  });
  Object.entries(typeMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .forEach(([name, count]) => weakestTypes.push({ name, count }));

  const advice = [];
  if (noteFirstQueue.length) advice.push({
    key: 'note_first_queue',
    title: `先看 ${noteFirstQueue.length} 道方法型题`,
    description: '这些题更像不会做或方法未稳，先看笔记摘要再进入题目。',
  });
  if (directDoQueue.length) advice.push({
    key: 'direct_do_queue',
    title: `直接验证 ${directDoQueue.length} 道易错题`,
    description: '这些题更像会做但容易失误，先看一句提醒再开做。',
  });
  if (speedDrillQueue.length) advice.push({
    key: 'speed_drill_queue',
    title: `限时复训 ${speedDrillQueue.length} 道慢题`,
    description: '这些题主要卡在耗时，先做题再按需回看笔记摘要。',
  });
  if (reviewReadyQueue.length) advice.push({
    key: 'review_ready_queue',
    title: `处理 ${reviewReadyQueue.length} 道待复盘题`,
    description: '这些题的材料已较完整，可补充复盘后再进入后续训练。',
  });

  const mission = {
    total: dailyQueue.length,
    diagnoseCount: reviewQueue.length,
    reviewCount: reviewReadyQueue.length,
    retrainCount: retrainQueue.length,
    noteFirstCount: noteFirstQueue.length,
    directDoCount: directDoQueue.length,
    speedDrillCount: speedDrillQueue.length,
    topScore: dailyQueue[0] ? Number(dailyQueue[0].practiceScore || 0) : 0,
    suggestedDailyCount: Math.min(Math.max(8, dailyQueue.length), Math.max(dailyQueue.length, 8)),
    suggestedReviewCount: Math.min(Math.max(4, noteFirstQueue.length), Math.max(noteFirstQueue.length, 4)),
    suggestedRetrainCount: Math.min(Math.max(4, speedDrillQueue.length), Math.max(speedDrillQueue.length, 4)),
  };

  return {
    dailyQueue,
    reviewQueue,
    reviewReadyQueue,
    retrainQueue,
    noteFirstQueue: noteFirstQueue.slice(0, Math.min(6, maxItems)),
    directDoQueue: directDoQueue.slice(0, Math.min(6, maxItems)),
    speedDrillQueue: speedDrillQueue.slice(0, Math.min(6, maxItems)),
    weakestReasons,
    weakestTypes,
    advice,
    mission,
    behavior: getPracticeBehaviorSnapshot(7),
  };
}

function getTaskPackQueueByMode(mode, limit) {
  const taskPack = buildPracticeTaskPack(limit || 12);
  const normalized = String(mode || 'daily');
  if (normalized === 'note') return taskPack.noteFirstQueue || [];
  if (normalized === 'direct') return taskPack.directDoQueue || [];
  if (normalized === 'speed') return taskPack.speedDrillQueue || [];
  if (normalized === 'review') return taskPack.reviewReadyQueue || [];
  if (normalized === 'retrain') return taskPack.retrainQueue || [];
  return taskPack.dailyQueue || [];
}

function getDueList() {
  if (typeof hasFullWorkspaceDataLoaded === 'function' && !hasFullWorkspaceDataLoaded()) {
    return [];
  }
  return buildPracticeTaskPack(24).dailyQueue;
}

function updateSidebar() {
  const hasFullData = typeof hasFullWorkspaceDataLoaded === 'function' ? hasFullWorkspaceDataLoaded() : true;
  const summary = typeof getStartupSummaryCache === 'function' ? (getStartupSummaryCache() || {}) : {};
  const taskPack = hasFullData ? buildPracticeTaskPack(24) : null;
  const dueN = hasFullData ? taskPack.dailyQueue.length : Number(summary.todayDue || 0);
  const noteFirstCount = hasFullData ? Number(taskPack.noteFirstQueue.length || 0) : Number(summary.noteFirstCount || 0);
  const directDoCount = hasFullData ? Number(taskPack.directDoQueue.length || 0) : Number(summary.directDoCount || 0);
  const speedDrillCount = hasFullData ? Number(taskPack.speedDrillQueue.length || 0) : Number(summary.speedDrillCount || 0);
  const quizBadge = document.getElementById('quizBadge');
  if (quizBadge) quizBadge.textContent = dueN;
  const btn = document.getElementById('quizBtn');
  if (btn) {
    btn.classList.toggle('disabled', dueN === 0);
    btn.title = dueN
      ? `今日任务 ${dueN} 题 · 先看笔记 ${noteFirstCount} · 直接开做 ${directDoCount} · 限时复训 ${speedDrillCount}`
      : '今日暂无任务';
  }
  const fullN = hasFullData
    ? getErrorEntries().filter(e => !isEffectivelyMastered(e)).length
    : Number(summary.fullPracticeCount || 0);
  const fullPracticeBadge = document.getElementById('fullPracticeBadge');
  if (fullPracticeBadge) fullPracticeBadge.textContent = fullN;
  const fullPracticeBtn = document.getElementById('fullPracticeBtn');
  if (fullPracticeBtn) fullPracticeBtn.classList.toggle('disabled', fullN === 0);
  const total = todayDone + dueN;
  const progText = document.getElementById('progText');
  if (progText) progText.textContent = `${todayDone}/${total || todayDone}`;
  const pct = total > 0 ? Math.round((todayDone / total) * 100) : (todayDone > 0 ? 100 : 0);
  const progFill = document.getElementById('progFill');
  if (progFill) progFill.style.width = pct + '%';
}

window.computePracticeScore = computePracticeScore;
window.buildPracticeTaskPack = buildPracticeTaskPack;
window.getPracticeBehaviorSnapshot = getPracticeBehaviorSnapshot;
window.getTaskPackQueueByMode = getTaskPackQueueByMode;
window.isEffectivelyMastered = isEffectivelyMastered;
