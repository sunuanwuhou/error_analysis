// ============================================================
// Quiz modal session shell
// ============================================================
async function ensureQuizModalReady() {
  const hasModal = document.getElementById('quizModal');
  const hasTitle = document.getElementById('quizTitleText');
  const hasContent = document.getElementById('quizContent');
  if (hasModal && hasTitle && hasContent) return true;

  if (typeof window.ensureDeferredPartialsLoaded === 'function') {
    try {
      await window.ensureDeferredPartialsLoaded();
    } catch (e) {
      console.warn('ensure deferred partials for quiz failed', e);
    }
  }

  const ready =
    !!document.getElementById('quizModal') &&
    !!document.getElementById('quizTitleText') &&
    !!document.getElementById('quizContent');
  if (!ready) {
    showToast('题目弹窗尚未加载完成，请稍后再试', 'warning');
  }
  return ready;
}

function resetQuizSession() {
  quizQueue = [];
  quizIdx = 0;
  quizAnswers = [];
  quizSkipped = new Set();
  resetQuizPauseState();
  const titleEl = document.getElementById('quizTitleText');
  const progressEl = document.getElementById('quizProgress');
  const fillEl = document.getElementById('quizProgFill');
  const contentEl = document.getElementById('quizContent');
  if (titleEl) titleEl.textContent = '📝 今日复习';
  if (progressEl) progressEl.textContent = '';
  if (fillEl) fillEl.style.width = '0%';
  if (contentEl) contentEl.innerHTML = '';
}

function getQuizClosePrompt(targetTab) {
  const sessionLabel = quizSessionMode === 'full' ? '全量练习' : '今日复习';
  const destination = targetTab === 'notes' ? '并前往知识树' : '';
  if (!quizAnswers.length && quizIdx === 0) {
    return `确认关闭本次${sessionLabel}${destination}？`;
  }
  if ((document.getElementById('quizTitleText')?.textContent || '').indexOf('回顾') >= 0) {
    return `当前已经进入答题回顾，尚未保存本次${sessionLabel}结果。确认关闭${destination}？`;
  }
  return `当前${sessionLabel}进度尚未保存。确认关闭${destination}？`;
}

function requestCloseQuizModal(targetTab) {
  const quizModal = document.getElementById('quizModal');
  if (!quizModal || !quizModal.classList.contains('open')) return;
  const message = getQuizClosePrompt(targetTab);
  if (message && !confirm(message)) return;
  closeQuizModal(true);
  if (targetTab) switchTab(targetTab);
}

function closeQuizModal(force) {
  closeModal('quizModal');
  if (force) resetQuizSession();
}
