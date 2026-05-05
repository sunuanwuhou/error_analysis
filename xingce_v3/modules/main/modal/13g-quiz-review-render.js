// ============================================================
// Quiz review rendering
// ============================================================
function renderQuizReviewFenbiMode() {
  resetQuizPauseState();
  const realAnswers = quizAnswers.filter((a) => !a.skipped);
  const total = realAnswers.length;
  const correctN = realAnswers.filter((a) => a.correct).length;
  const wrongN = total - correctN;
  const skippedN = quizAnswers.filter((a) => a.skipped).length;
  document.getElementById('quizProgress').textContent = 'Review';
  document.getElementById('quizProgFill').style.width = '100%';
  document.getElementById('quizTitleText').textContent = 'Practice Review';
  closeQuizProcessCanvas();
  const items = quizAnswers.map((a) => {
    const e = errors.find((x) => x.id === a.id);
    if (!e) return '';
    const metaLine = [
      `<span class="quiz-result-chip">${escapeHtml(e.type || '')}</span>`,
      e.subtype ? `<span class="quiz-result-chip">${escapeHtml(e.subtype)}</span>` : ''
    ].filter(Boolean).join('');
    if (a.skipped) {
      return `<div class="quiz-review-item">
        <div class="review-meta"><span class="review-verdict" style="color:#d97706">Skipped</span>${metaLine}</div>
        <div style="font-size:13px;color:#334155;line-height:1.7">${escapeHtml(e.question || '')}</div>
      </div>`;
    }
    return `<div class="quiz-review-item ${a.correct ? 'right' : 'wrong'}">
      <div class="review-meta"><span class="review-verdict ${a.correct ? 'right' : 'wrong'}">${a.correct ? 'Correct' : 'Wrong'}</span>${metaLine}</div>
      <div style="font-size:13px;color:#334155;line-height:1.7;margin-bottom:10px">${escapeHtml(e.question || '')}</div>
      ${getQuizAnswerFeedbackHtml(e, a)}
      ${e.analysis ? `<div class="review-analysis">${renderAnalysis(e.analysis)}</div>` : ''}
    </div>`;
  }).join('');
  document.getElementById('quizContent').innerHTML = `
    <div class="quiz-review-shell">
      <div class="quiz-review-title">Session complete</div>
      <div class="quiz-summary-bar">
        <div class="sum-stat"><div class="sum-num green">${correctN}</div><div class="sum-label">Correct</div></div>
        <div class="sum-stat"><div class="sum-num">${wrongN}</div><div class="sum-label">Wrong</div></div>
        <div class="sum-stat"><div class="sum-num" style="color:#64748b">${total}</div><div class="sum-label">Answered</div></div>
        ${skippedN ? `<div class="sum-stat"><div class="sum-num" style="color:#d97706">${skippedN}</div><div class="sum-label">Skipped</div></div>` : ''}
      </div>
      <div class="quiz-review-list">${items}</div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="saveQuizResults()">Save and Close</button>
        <button class="btn btn-secondary" onclick="markAllWrongAsFocus()">Mark wrong as focus</button>
        <button class="btn btn-secondary" onclick="requestCloseQuizModal('notes')">Open notes</button>
      </div>
    </div>`;
};
