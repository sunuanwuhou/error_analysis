(function () {
  function renderReviewExtra(answer, reviewIndex, formatDuration) {
    if (!answer || !answer.attempt) return '';
    const at = answer.attempt;
    const safe = (value) => (window.escapeHtml ? window.escapeHtml(String(value || '')) : String(value || ''));
    return `
      <div class="quiz-attempt-summary">
        <div class="quiz-attempt-summary-line">⏱ ${formatDuration(at.durationSec || 0)} · 状态：${safe(at.statusTag || '未标记')} · 把握度：${Number(at.confidence || 0)}</div>
        ${at.solvingNote ? `<div class="quiz-attempt-summary-note">📝 ${safe(at.solvingNote)}</div>` : ''}
        ${(!answer.correct || answer.skipped) ? `<div class="quiz-attempt-review-actions"><button class="btn btn-sm btn-secondary" onclick="openAttemptClosure(${reviewIndex})">补结构化错因/知识点</button></div>` : ''}
      </div>`;
  }

  window.V53ReviewExtraRenderer = { renderReviewExtra };
})();
