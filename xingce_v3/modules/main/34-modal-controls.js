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
  function ensureStandaloneRichNoteModal() {
    let mask = document.getElementById('standaloneRichNoteModal');
    if (mask) return mask;
    mask = document.createElement('div');
    mask.id = 'standaloneRichNoteModal';
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="width:min(980px,96vw);max-width:96vw;max-height:90vh;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <h2 style="margin:0">独立 Markdown 备注</h2>
          <button class="modal-close" type="button" id="standaloneRichNoteCloseBtn">×</button>
        </div>
        <div style="color:#64748b;font-size:12px;line-height:1.7;margin-top:6px">该备注与知识树节点无关，用于全局临时记录。</div>
        <div style="display:flex;gap:10px;margin-top:12px;flex:1;min-height:0">
          <textarea id="standaloneRichNoteTA" class="note-md-textarea" style="flex:1;min-height:420px" placeholder="# 全局备注&#10;&#10;- 待办&#10;- 想法&#10;- 临时记录"></textarea>
          <div id="standaloneRichNotePreview" class="notes-content" style="flex:1;min-height:420px;overflow:auto;border:1px solid #eef2f7;border-radius:12px;padding:12px;background:#fff"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
          <button class="btn btn-secondary" type="button" id="standaloneRichNoteCancelBtn">取消</button>
          <button class="btn btn-primary" type="button" id="standaloneRichNoteSaveBtn">保存</button>
        </div>
      </div>
    `;
    mask.addEventListener('click', (event) => {
      if (event.target === mask) mask.classList.remove('open');
    });
    document.body.appendChild(mask);
    return mask;
  }

  function saveStandaloneRichNote(value) {
    globalNote = String(value || '');
    if (typeof queuePersist === 'function' && typeof KEY_GLOBAL_NOTE !== 'undefined') {
      queuePersist(KEY_GLOBAL_NOTE, globalNote || '');
    } else if (typeof DB !== 'undefined' && DB && typeof DB.set === 'function' && typeof KEY_GLOBAL_NOTE !== 'undefined') {
      DB.set(KEY_GLOBAL_NOTE, globalNote || '');
    }
    if (typeof markIncrementalWorkspaceChange === 'function') {
      markIncrementalWorkspaceChange();
    }
  }

  function renderStandaloneRichNotePreview() {
    const ta = document.getElementById('standaloneRichNoteTA');
    const preview = document.getElementById('standaloneRichNotePreview');
    if (!ta || !preview) return;
    const md = String(ta.value || '');
    preview.innerHTML = md
      ? (typeof renderMd === 'function' ? renderMd(md) : md.replace(/</g, '&lt;').replace(/\n/g, '<br>'))
      : '<div style="color:#94a3b8;font-size:12px">输入 Markdown 后这里实时预览</div>';
    if (typeof renderMathInElement === 'function') renderMathInElement(preview);
  }

  const mask = ensureStandaloneRichNoteModal();
  const ta = document.getElementById('standaloneRichNoteTA');
  const closeBtn = document.getElementById('standaloneRichNoteCloseBtn');
  const cancelBtn = document.getElementById('standaloneRichNoteCancelBtn');
  const saveBtn = document.getElementById('standaloneRichNoteSaveBtn');

  if (ta && !ta.dataset.bound) {
    ta.dataset.bound = '1';
    ta.addEventListener('input', renderStandaloneRichNotePreview);
    ta.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 's') {
        event.preventDefault();
        saveStandaloneRichNote(ta.value);
        showToast('全局备注已保存', 'success');
      }
    });
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', () => mask.classList.remove('open'));
  }
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = '1';
    cancelBtn.addEventListener('click', () => mask.classList.remove('open'));
  }
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', () => {
      saveStandaloneRichNote(ta ? ta.value : '');
      showToast('全局备注已保存', 'success');
    });
  }

  if (ta) {
    ta.value = String(globalNote || '');
    ta.focus();
  }
  renderStandaloneRichNotePreview();
  mask.classList.add('open');
}
