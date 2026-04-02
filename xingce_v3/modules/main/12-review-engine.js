// ============================================================
// 艾宾浩斯 & 今日复习
// ============================================================
function getDueList() {
  const t = today();
  return getErrorEntries().filter(e => {
    if (e.status==='mastered') return false;
    if (!e.quiz||!e.quiz.nextReview) return true;
    return e.quiz.nextReview <= t;
  });
}
function updateSidebar() {
  const dueN = getDueList().length;
  document.getElementById('quizBadge').textContent = dueN;
  const btn = document.getElementById('quizBtn');
  btn.classList.toggle('disabled', dueN===0);
  // 全量练习 badge：所有非已掌握题目数
  const fullN = getErrorEntries().filter(e => e.status !== 'mastered').length;
  document.getElementById('fullPracticeBadge').textContent = fullN;
  document.getElementById('fullPracticeBtn').classList.toggle('disabled', fullN===0);
  const total = todayDone + dueN;
  document.getElementById('progText').textContent = `${todayDone}/${total||todayDone}`;
  const pct = total>0 ? Math.round((todayDone/total)*100) : (todayDone>0?100:0);
  document.getElementById('progFill').style.width = pct+'%';
}
