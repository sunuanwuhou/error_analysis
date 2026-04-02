(function () {
  function byId(id) { return document.getElementById(id); }
  function isMobile() { return window.matchMedia('(max-width: 768px)').matches; }

  function updateBottomActive() {
    const notes = document.body.classList.contains('tab-notes-active');
    const errors = document.body.classList.contains('tab-errors-active');
    byId('mobileQuickNotes')?.classList.toggle('active', notes);
    byId('mobileQuickErrors')?.classList.toggle('active', errors);
  }

  function updateHeaderTitle() {
    const title = byId('mobileHeaderTitle');
    if (!title) return;
    if (document.body.classList.contains('tab-errors-active')) {
      title.textContent = '错题列表';
    } else {
      const nodeTitle = document.querySelector('.knowledge-workspace-title')?.textContent?.trim();
      title.textContent = nodeTitle || '学习笔记';
    }
  }

  function enhanceSidebarButtons() {
    const loadBtn = document.querySelector('.sidebar-cloud-actions .btn:nth-child(1)');
    const saveBtn = document.querySelector('.sidebar-cloud-actions .btn:nth-child(2)');
    if (loadBtn) loadBtn.textContent = isMobile() ? '加载' : 'Cloud Load';
    if (saveBtn) saveBtn.textContent = isMobile() ? '保存' : 'Cloud Save';
  }

  function wrapSwitchTab() {
    if (typeof window.switchTab !== 'function' || window.__v53SwitchWrapped) return;
    const original = window.switchTab;
    window.switchTab = function wrappedSwitchTab(tabName) {
      const result = original.apply(this, arguments);
      updateBottomActive();
      updateHeaderTitle();
      return result;
    };
    window.__v53SwitchWrapped = true;
  }

  function bindQuickActions() {
    byId('mobileQuickNotes')?.addEventListener('click', () => {
      if (typeof window.switchTab === 'function') window.switchTab('notes');
    });
    byId('mobileQuickErrors')?.addEventListener('click', () => {
      if (typeof window.switchTab === 'function') window.switchTab('errors');
    });
    byId('mobileQuickAdd')?.addEventListener('click', () => {
      if (typeof window.openQuickAddModal === 'function') window.openQuickAddModal();
    });
    byId('mobileQuickReview')?.addEventListener('click', () => {
      if (typeof window.startQuiz === 'function') window.startQuiz();
    });
    byId('mobileHeaderAdd')?.addEventListener('click', () => {
      if (typeof window.openQuickAddModal === 'function') window.openQuickAddModal();
    });
    byId('mobileHeaderSave')?.addEventListener('click', () => {
      if (typeof window.saveCloudBackup === 'function') window.saveCloudBackup();
    });
  }

  function closeSidebarOnMainClick() {
    document.querySelector('.main-area')?.addEventListener('click', (event) => {
      if (!isMobile()) return;
      if (event.target.closest('.modal-mask, .modal, .quiz-modal, .claude-modal')) return;
      if (typeof window.closeMobileSidebar === 'function') window.closeMobileSidebar();
    });
  }

  function syncQuizBadges() {
    const sourceIds = [
      ['quizBadge', 'mobileReviewBadge'],
      ['fullPracticeBadge', 'mobilePracticeBadge'],
    ];
    sourceIds.forEach(([fromId, toId]) => {
      const from = byId(fromId);
      const to = byId(toId);
      if (!from || !to) return;
      const observer = new MutationObserver(() => {
        to.textContent = from.textContent || '0';
      });
      observer.observe(from, { childList: true, subtree: true, characterData: true });
      to.textContent = from.textContent || '0';
    });
  }

  function init() {
    wrapSwitchTab();
    bindQuickActions();
    closeSidebarOnMainClick();
    syncQuizBadges();
    updateBottomActive();
    updateHeaderTitle();
    enhanceSidebarButtons();
    window.addEventListener('resize', () => {
      enhanceSidebarButtons();
      updateHeaderTitle();
      updateBottomActive();
    });

    const notesObserver = new MutationObserver(() => updateHeaderTitle());
    const notesContent = byId('notesContent');
    if (notesContent) notesObserver.observe(notesContent, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
