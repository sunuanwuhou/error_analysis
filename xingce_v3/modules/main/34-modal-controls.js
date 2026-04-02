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
