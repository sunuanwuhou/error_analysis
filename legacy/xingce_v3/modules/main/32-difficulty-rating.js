// ============================================================
// 难度评分
// ============================================================
function setModalDiff(n) {
  _modalDiff = (_modalDiff === n) ? 0 : n;
  updateModalDiffStars();
}
function updateModalDiffStars() {
  const labels = ['', '简单', '中等', '困难'];
  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById('dstar' + i);
    if (btn) btn.classList.toggle('on', i <= _modalDiff);
  }
  const lbl = document.getElementById('dstarLabel');
  if (lbl) lbl.textContent = _modalDiff > 0 ? labels[_modalDiff] : '';
}
function setCardDifficulty(id, n, event) {
  event && event.stopPropagation();
  const e = errors.find(x => x.id === id);
  if (!e) return;
  e.difficulty = (e.difficulty === n) ? 0 : n;
  e.updatedAt = new Date().toISOString();
  recordErrorUpsert(e);
  saveData();
  renderAll();
}
