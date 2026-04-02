// ============================================================
// 内联做题
// ============================================================
function startInlineQuiz(id) {
  const targetId = normalizeErrorId(id);
  inlineQuizState[targetId] = {answered:false, userAnswer:'', correct:false};
  renderAll();
  // 滚动到卡片
  const el = document.getElementById('card-'+targetId);
  if (el) el.scrollIntoView({behavior:'smooth', block:'nearest'});
}
function closeInlineQuiz(id) {
  delete inlineQuizState[normalizeErrorId(id)];
  renderAll();
}
function selectInlineAnswer(id, letter) {
  const targetId = normalizeErrorId(id);
  const e = findErrorById(targetId);
  if (!e) return;
  const correct = (e.answer||'').trim().toUpperCase();
  const isRight = letter.toUpperCase() === correct;
  inlineQuizState[targetId] = {answered:true, userAnswer:letter, correct:isRight};
  renderAll();
}
function saveInlineResult(id) {
  const targetId = normalizeErrorId(id);
  const e = findErrorById(targetId);
  const st = inlineQuizState[targetId];
  if (!e || !st || !st.answered) return;
  // 更新复习记录（与 saveQuizResults 逻辑一致）
  if (!e.quiz) e.quiz = {streak:0,wrongCount:0,reviewCount:0,lastReview:null,nextReview:null};
  e.quiz.reviewCount++;
  e.quiz.lastReview = today();
  if (!e.quiz.history) e.quiz.history = [];
  e.quiz.history.push({date:today(), answer:st.userAnswer, correct:st.correct});
  if (st.correct) {
    e.quiz.streak = (e.quiz.streak||0)+1;
    if (e.quiz.streak>=6) e.status='mastered';
    else if (e.quiz.streak>=3) e.status='review';
  } else {
    e.quiz.streak = 0;
    e.quiz.wrongCount = (e.quiz.wrongCount||0)+1;
    e.status = 'focus';
    e.myAnswer = st.userAnswer;
  }
  e.quiz.nextReview = addDays(today(), INTERVALS[Math.min(e.quiz.streak||0, INTERVALS.length-1)]);
  e.lastPracticedAt = new Date().toISOString();
  e.updatedAt = new Date().toISOString();
  todayDone++;
  saveTodayDone();
  recordErrorUpsert(e);
  saveData();
  delete inlineQuizState[targetId];
  renderSidebar();
  renderAll();
}
