// ============================================================
// Quiz submit flow
// ============================================================
function nextQuizQuestion() {
  if (quizSessionPaused) {
    showToast('当前已暂停，请先继续', 'warning');
    return;
  }
  quizIdx++;
  if (quizIdx >= quizQueue.length) {
    renderQuizReview();
  } else {
    renderQuizQuestion();
  }
}

async function saveQuizResults() {
  const realAnswers = quizAnswers.filter(a=>!a.skipped);
  const attemptPayload = [];
  const touchedIds = [];
  const nowIso = new Date().toISOString();
  realAnswers.forEach(a => {
    const e = findQuizErrorById(a.id);
    if (!e) return;
    normalizeErrorForWorkflow(e);
    if (!e.quiz) e.quiz = {streak:0,wrongCount:0,reviewCount:0,lastReview:null,nextReview:null};
    e.quiz.reviewCount++;
    e.quiz.lastReview = today();
    if (!e.quiz.history) e.quiz.history = [];
    e.quiz.history.push({date:today(), answer:a.userAnswer, correct:a.correct});
    if (a.correct) {
      e.quiz.streak = (e.quiz.streak||0) + 1;
      if (e.quiz.streak>=6) {
        e.status = 'mastered';
        e.masteryLevel = 'mastered';
      } else if (e.quiz.streak>=3) {
        e.status = 'review';
        e.masteryLevel = 'fuzzy';
      } else {
        e.status = 'review';
        e.masteryLevel = 'not_mastered';
      }
    } else {
      e.quiz.streak = 0;
      e.quiz.wrongCount = (e.quiz.wrongCount||0)+1;
      e.status = 'focus';
      e.masteryLevel = 'not_mastered';
      e.myAnswer = a.userAnswer;
    }
    e.lastPracticedAt = nowIso;
    e.masteryUpdatedAt = nowIso;
    e.quiz.nextReview = addDays(today(), INTERVALS[Math.min(e.quiz.streak||0, INTERVALS.length-1)]);
    e.nextReviewAt = e.quiz.nextReview;
    touchErrorUpdatedAt(e);
    touchedIds.push(String(e.id));
    attemptPayload.push({
      sessionMode: quizSessionMode === 'full' ? 'full' : (quizSessionMode || 'daily'),
      source: quizSessionMode === 'full'
        ? 'phase13_22_full'
        : (quizSessionMode === 'note'
          ? 'phase13_22_note_first'
          : (quizSessionMode === 'direct'
            ? 'phase13_22_direct_do'
            : (quizSessionMode === 'speed' ? 'phase13_22_speed_drill' : 'phase13_22_daily'))),
      questionId: String(e.id || ''),
      errorId: String(e.id || ''),
      type: String(e.type || ''),
      subtype: String(e.subtype || ''),
      subSubtype: String(e.subSubtype || ''),
      questionText: String(e.question || ''),
      myAnswer: String(a.userAnswer || ''),
      correctAnswer: String(e.answer || ''),
      result: a.correct ? 'correct' : 'wrong',
      durationSec: Number(a.durationSec || 0),
      statusTag: String(e.status || ''),
      confidence: a.correct ? (e.quiz.streak >= 3 ? 4 : 3) : 1,
      solvingNote: String(e.note || ''),
      scratchData: {},
      noteNodeId: String(e.noteNodeId || ''),
      meta: {
        mistakeType: String(e.rootReason || e.errorReason || ''),
        triggerPoint: String(e.triggerPoint || ''),
        correctModel: String(e.analysis || e.correctModel || ''),
        nextAction: String(e.nextAction || (a.correct ? '继续下一轮复训' : '先回看错因与解析') || ''),
      },
    });
  });
  const sessionType = quizSessionMode === 'full' ? '全量练习' : '今日复习';
  pushHistory({
    date: today()+' '+new Date().toTimeString().slice(0,5),
    sessionType,
    total: realAnswers.length,
    correct: realAnswers.filter(a=>a.correct).length,
    skipped: quizAnswers.filter(a=>a.skipped).length,
    details: quizAnswers.map(a=>({id:a.id,correct:a.correct,skipped:a.skipped||false}))
  });
  try{
    await fetchJsonWithAuth('/api/practice/log', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        date: today(),
        mode: sessionType.includes('全量') ? 'targeted' : 'daily',
        weaknessTag: reasonFilter || '',
        total: realAnswers.length,
        correct: realAnswers.filter(a=>a.correct).length,
        errorIds: realAnswers.map(a=>String(a.id))
      })
    });
  }catch(e){
    console.warn('practice log sync failed:', e);
  }
  if (attemptPayload.length) {
    try {
      await fetchJsonWithAuth('/api/practice/attempts/batch', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ items: attemptPayload })
      });
      if (typeof window.invalidatePracticeAttemptSummaries === 'function') {
        window.invalidatePracticeAttemptSummaries(touchedIds);
      }
    } catch (e) {
      console.warn('practice attempts batch sync failed:', e);
    }
  }
  todayDone += realAnswers.length;
  saveTodayDone();
  saveData();
  closeQuizModal(true);
  refreshSidebarAndErrorsList();
  showToast('记录已保存', 'success');
}
