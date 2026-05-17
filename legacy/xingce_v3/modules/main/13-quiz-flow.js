// ============================================================
// 答题流程（新版：选项点击 → 全部完成 → 批量回顾 → 保存）
// ============================================================
function buildQuizQueueFromItems(items) {
  return (items || []).map(item => ({ ...findErrorById(item.id), ...item })).filter(isErrorEntry);
}

function findQuizErrorById(errorId) {
  const direct = findErrorById(errorId);
  if (direct) return direct;
  const normalized = normalizeErrorId(errorId);
  return errors.find(x => normalizeErrorId(x && x.id) === normalized) || null;
}

function getQuizDurationHint(errorLike) {
  const e = errorLike || {};
  const target = Math.max(Number(e.targetDurationSec || 0), 0);
  const recent = Math.max(Number(e.lastDuration || e.actualDurationSec || 0), 0);
  if (quizSessionMode === 'speed') {
    const chips = [];
    if (target > 0) chips.push(`<span style="font-size:12px;padding:4px 10px;border-radius:999px;background:#fff7e6;color:#d46b08;font-weight:700">目标 ${target} 秒</span>`);
    if (recent > 0) chips.push(`<span style="font-size:12px;padding:4px 10px;border-radius:999px;background:#f5f5f5;color:#666">上次 ${recent} 秒</span>`);
    return `<div style="margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${chips.join('') || '<span style="font-size:12px;color:#d46b08;font-weight:700">这题按限时复训处理</span>'}</div>`;
  }
  if (quizSessionMode === 'direct' && String(e.tip || '').trim()) {
    return `<div style="margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#f6ffed;border:1px solid #b7eb8f;color:#237804;font-size:13px;line-height:1.7"><strong style="font-weight:700">做题提醒：</strong>${escapeHtml(String(e.tip || '').trim())}</div>`;
  }
  return '';
}

const __baseStartPracticeQueue = startPracticeQueue;
startPracticeQueue = async function startPracticeQueueWorkflow(mode) {
  const normalizedMode = String(mode || 'daily');
  if (!['note', 'direct', 'speed'].includes(normalizedMode)) {
    return __baseStartPracticeQueue(normalizedMode);
  }
  if (!(await ensureQuizModalReady())) return;

  let serverPayload = null;
  try {
    serverPayload = await fetchJsonWithAuth('/api/practice/daily?limit=30');
  } catch (e) {
    console.warn('workflow practice fallback:', e);
  }

  const localPack = typeof buildPracticeTaskPack === 'function' ? buildPracticeTaskPack(30) : null;
  const serverNoteFirst = buildQuizQueueFromItems(serverPayload && serverPayload.noteFirstQueue);
  const serverDirectDo = buildQuizQueueFromItems(serverPayload && serverPayload.directDoQueue);
  const serverSpeedDrill = buildQuizQueueFromItems(serverPayload && serverPayload.speedDrillQueue);

  if (normalizedMode === 'note') {
    quizQueue = serverNoteFirst.length ? serverNoteFirst : ((localPack && localPack.noteFirstQueue) || (typeof getTaskPackQueueByMode === 'function' ? getTaskPackQueueByMode('note', 30) : []));
  } else if (normalizedMode === 'direct') {
    quizQueue = serverDirectDo.length ? serverDirectDo : ((localPack && localPack.directDoQueue) || (typeof getTaskPackQueueByMode === 'function' ? getTaskPackQueueByMode('direct', 30) : []));
  } else {
    quizQueue = serverSpeedDrill.length ? serverSpeedDrill : ((localPack && localPack.speedDrillQueue) || (typeof getTaskPackQueueByMode === 'function' ? getTaskPackQueueByMode('speed', 30) : []));
  }

  if (!quizQueue.length) {
    return __baseStartPracticeQueue(normalizedMode);
  }

  let title = '今日练习';
  if (normalizedMode === 'note') title = '先看笔记';
  if (normalizedMode === 'direct') title = '直接开做';
  if (normalizedMode === 'speed') title = '限时复训';

  quizSessionMode = normalizedMode;
  quizIdx = 0;
  quizAnswers = [];
  quizSkipped = new Set();
  resetQuizPauseState();
  document.getElementById('quizTitleText').textContent = title;
  openModal('quizModal');
  renderQuizQuestion();
};

window.startPracticeQueue = startPracticeQueue;
window.startRandomNoteReview = startRandomNoteReview;
window.randomNoteReviewPrev = randomNoteReviewPrev;
window.randomNoteReviewNext = randomNoteReviewNext;
window.randomNoteReviewShuffle = randomNoteReviewShuffle;
window.startRandomNoteHighValuePractice = startRandomNoteHighValuePractice;
window.openRandomNoteInWorkspace = openRandomNoteInWorkspace;
window.getRandomNoteReviewCandidateCount = getRandomNoteReviewCandidateCount;
renderQuizQuestion = renderQuizQuestionFenbiMode;
selectQuizAnswer = selectQuizAnswerFenbiMode;
renderQuizReview = renderQuizReviewFenbiMode;
skipQuizQuestion = function skipQuizQuestionWorkflow() {
  if (quizSessionPaused) {
    showToast('当前已暂停，请先继续', 'warning');
    return;
  }
  const e = quizQueue[quizIdx];
  quizAnswers.push({ id: e.id, userAnswer: 'SKIPPED', correct: false, skipped: true, durationSec: getCurrentQuizElapsedSec() });
  quizSkipped.add(quizIdx);
  quizIdx++;
  if (quizIdx >= quizQueue.length) renderQuizReview();
  else renderQuizQuestion();
};
window.toggleQuizPause = toggleQuizPause;
