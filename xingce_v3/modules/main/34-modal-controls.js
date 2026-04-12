// ============================================================
// 弹窗控制
// ============================================================
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){
  if(id==='addModal' && saveErrorBusy) return;
  document.getElementById(id).classList.remove('open');
}
document.querySelectorAll('.modal-mask').forEach(mask=>{
  mask.addEventListener('click',function(e){
    if(e.target===this&&this.id!=='quizModal') closeModal(this.id);
  });
});
document.addEventListener('keydown', function(event) {
  if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
    event.preventDefault();
    openGlobalSearchModal();
    return;
  }
  if (event.key === 'Escape') {
    const searchModal = document.getElementById('globalSearchModal');
    if (searchModal && searchModal.classList.contains('open')) {
      closeGlobalSearchModal(true);
    }
  }
});
function showToast(message, type) {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type || 'success'}`;
  toast.textContent = message;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 220);
  }, 2200);
}
function closeMoreMenu() {
  const menu = document.getElementById('moreMenu');
  if (menu) menu.classList.remove('open');
}
function toggleMoreMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById('moreMenu');
  if (!menu) return;
  menu.classList.toggle('open');
}
document.addEventListener('click', event => {
  const menu = document.getElementById('moreMenu');
  if (menu && !menu.contains(event.target)) closeMoreMenu();
});

function openRichNoteEditorFromMore() {
  if (typeof ensureKnowledgeState === 'function') {
    ensureKnowledgeState();
  }
  let targetNode = typeof getCurrentKnowledgeNode === 'function' ? getCurrentKnowledgeNode() : null;
  if (!targetNode && typeof collectKnowledgeLeaves === 'function') {
    const leaves = collectKnowledgeLeaves() || [];
    targetNode = leaves.length ? leaves[0] : null;
  }
  if (!targetNode && typeof collectKnowledgeNodes === 'function') {
    const allNodes = collectKnowledgeNodes() || [];
    targetNode = allNodes.length ? allNodes[0] : null;
  }
  if (!targetNode) {
    showToast('暂无可编辑的知识点，请先录入一道题并关联知识点', 'warning');
    return;
  }
  if (typeof setCurrentKnowledgeNode === 'function') {
    setCurrentKnowledgeNode(targetNode.id, { switchTab: false });
  }
  if (typeof openExternalKnowledgeNoteEditor === 'function') {
    openExternalKnowledgeNoteEditor(targetNode.id);
    return;
  }
  showToast('备注编辑器暂不可用，请稍后重试', 'warning');
}
