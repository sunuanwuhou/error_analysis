(function () {
  function init() {
    const sync = window.V53AttemptSync;
    const modal = window.V53AttemptModal;
    const panel = window.V53AttemptPanel;
    if (!sync || !modal || !panel) {
      console.warn('attempt modules not ready');
      return;
    }

    panel.init({ sync, modal });

    window.setQuizStatusTag = panel.setStatusTag;
    window.setQuizConfidence = panel.setConfidence;
    window.openPracticeAttemptsModal = modal.open;
    window.refreshPracticeAttemptsModal = modal.refresh;
    window.exportPracticeAttemptsJson = sync.exportAttemptsJson;
    window.openAttemptClosure = panel.openAttemptClosure;
    window.syncAttemptLinkAfterSave = sync.syncAttemptLinkAfterSave;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
