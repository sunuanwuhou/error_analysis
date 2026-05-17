(function () {
  function renderAttemptCard(item, formatDuration) {
    const escapeHtml = window.escapeHtml;
    const pathText = (typeof window.getDisplayKnowledgePath === 'function' ? window.getDisplayKnowledgePath(item) : '') || item.type || '未分类';
    const safe = (value) => (escapeHtml ? escapeHtml(String(value || '')) : String(value || ''));
    const meta = item.meta || {};
    const closureHtml = (meta.mistakeType || meta.triggerPoint || meta.correctModel)
      ? `<div class="attempt-card-meta">错误类型：${safe(meta.mistakeType || '—')} · 触发点：${safe(meta.triggerPoint || '—')}</div>`
      : '<div class="attempt-card-meta" style="color:#b45309">尚未补全结构化错因</div>';

    return `
      <div class="attempt-card">
        <div class="attempt-card-head">
          <div><strong>${safe(pathText)}</strong></div>
          <div style="font-size:12px;color:#64748b">${safe(item.createdAt || '')}</div>
        </div>
        <div class="attempt-card-question">${safe(item.questionText || '')}</div>
        <div class="attempt-card-meta">结果：${safe(item.result || '')} · 我答：${safe(item.myAnswer || '—')} · 正确：${safe(item.correctAnswer || '—')} · 用时：${formatDuration(item.durationSec || 0)}</div>
        <div class="attempt-card-meta">状态：${safe(item.statusTag || '未标记')} · 把握度：${Number(item.confidence || 0)}</div>
        ${closureHtml}
        ${item.solvingNote ? `<div class="attempt-card-note">📝 ${safe(item.solvingNote)}</div>` : ''}
      </div>`;
  }

  window.V53AttemptCardRenderer = { renderAttemptCard };
})();
