// ============================================================
// 练习历史
// ============================================================
function openHistory() {
  const hist = loadHistory();
  const content = document.getElementById('historyContent');
  if (!content) return;
  if (!hist.length) {
    content.innerHTML = '<div style="color:#98a2b3;text-align:center;padding:40px;font-size:13px">暂时还没有练习记录</div>';
    openModal('historyModal');
    return;
  }
  const items = hist.map(h => {
    const rate = h.total > 0 ? Math.round(h.correct / h.total * 100) : 0;
    const cls = rate >= 80 ? 'good' : 'bad';
    const skippedStr = h.skipped ? ` · 跳过 ${h.skipped}` : '';
    return `<div class="hist-item">
      <span class="hist-date">${escapeHtml(h.date || '—')}</span>
      <span class="hist-type">${escapeHtml(h.sessionType || '练习')}${skippedStr}</span>
      <span class="hist-score ${cls}">${h.correct}/${h.total}</span>
      <span class="hist-rate">${rate}%</span>
    </div>`;
  }).join('');
  content.innerHTML = items;
  openModal('historyModal');
}
