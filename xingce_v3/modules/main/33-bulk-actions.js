// ============================================================
// 批量操作
// ============================================================
function toggleBatchMode() {
  batchMode = !batchMode;
  batchSelected.clear();
  const btn = document.getElementById('batchToggleBtn');
  if (btn) {
    btn.style.background = batchMode ? '#4e8ef7' : '';
    btn.style.color = batchMode ? '#fff' : '';
    btn.style.borderColor = batchMode ? '#4e8ef7' : '';
  }
  updateBatchBar();
  renderAll();
}
function toggleBatchSelect(id, event) {
  event && event.stopPropagation();
  if (batchSelected.has(id)) batchSelected.delete(id);
  else batchSelected.add(id);
  const cb = document.getElementById('bcb_' + id);
  if (cb) cb.checked = batchSelected.has(id);
  updateBatchBar();
}
function updateBatchBar() {
  const bar = document.getElementById('batchBar');
  const cnt = document.getElementById('batchCount');
  if (!bar) return;
  if (batchMode) {
    bar.classList.remove('hidden');
    if (cnt) cnt.textContent = '已选 ' + batchSelected.size + ' 题';
  } else {
    bar.classList.add('hidden');
  }
}
function executeBatch(action) {
  if (!batchSelected.size) { showToast('请先勾选题目', 'warning'); return; }
  if (action === 'delete') {
    if (!confirm('确认删除选中的 ' + batchSelected.size + ' 题？')) return;
    batchSelected.forEach(id => recordErrorDelete(id));
    errors = errors.filter(e => !batchSelected.has(e.id));
    batchSelected.forEach(id => revealed.delete(id));
    saveReveal();
  } else {
    errors.forEach(e => { if (batchSelected.has(e.id)) { e.status = action; e.updatedAt = new Date().toISOString(); recordErrorUpsert(e); } });
  }
  batchSelected.clear();
  saveData();
  syncNotesWithErrors();
  saveKnowledgeState();
  renderSidebar();
  renderAll();
  renderNotesByType();
  updateBatchBar();
}
