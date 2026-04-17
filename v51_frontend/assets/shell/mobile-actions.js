(function () {
  let rafResizeToken = 0;

  function bindQuickActions(core) {
    const byId = core.byId;
    byId('mobileQuickNotes')?.addEventListener('click', () => {
      if (typeof window.switchTab === 'function') window.switchTab('notes');
    });
    byId('mobileQuickErrors')?.addEventListener('click', () => {
      if (typeof window.switchTab === 'function') window.switchTab('notes');
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

  function closeSidebarOnMainClick(core) {
    document.querySelector('.main-area')?.addEventListener('click', (event) => {
      if (!core.isMobile()) return;
      if (event.target.closest('.modal-mask, .modal, .quiz-modal, .claude-modal')) return;
      if (typeof window.closeMobileSidebar === 'function') window.closeMobileSidebar();
    });
  }

  function syncQuizBadges(core) {
    const byId = core.byId;
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
      observer.observe(from, { childList: true, characterData: true });
      to.textContent = from.textContent || '0';
    });
  }

  function installResizeHandler(core) {
    const onResizeOptimized = () => {
      if (rafResizeToken) return;
      rafResizeToken = window.requestAnimationFrame(() => {
        rafResizeToken = 0;
        core.enhanceSidebarButtons();
        core.updateHeaderTitle();
        core.updateBottomActive();
      });
    };
    window.addEventListener('resize', onResizeOptimized, { passive: true });
  }

  function observeNotesTitle(core) {
    const notesObserver = new MutationObserver(() => core.updateHeaderTitle());
    const notesContent = core.byId('notesContent');
    if (notesContent) notesObserver.observe(notesContent, { childList: true, subtree: true });
  }

  window.V53ShellMobile = {
    bindQuickActions,
    closeSidebarOnMainClick,
    syncQuizBadges,
    installResizeHandler,
    observeNotesTitle,
  };
})();
