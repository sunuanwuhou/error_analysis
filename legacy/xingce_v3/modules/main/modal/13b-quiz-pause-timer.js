// ============================================================
// Quiz pause and timer state
// ============================================================
let quizQuestionStartedAt = 0;
let quizSessionPaused = false;
let quizQuestionPausedAccumMs = 0;
let quizQuestionPauseStartedAt = 0;

function getCurrentQuizElapsedSec() {
  if (!quizQuestionStartedAt) return 0;
  const activePausedMs = quizSessionPaused && quizQuestionPauseStartedAt
    ? (Date.now() - quizQuestionPauseStartedAt)
    : 0;
  const elapsedMs = Date.now() - quizQuestionStartedAt - quizQuestionPausedAccumMs - activePausedMs;
  return Math.max(1, Math.round(Math.max(0, elapsedMs) / 1000));
}

function resetQuizPauseState() {
  quizSessionPaused = false;
  quizQuestionPausedAccumMs = 0;
  quizQuestionPauseStartedAt = 0;
}

function startQuizQuestionTimer() {
  quizQuestionStartedAt = Date.now();
  quizQuestionPausedAccumMs = 0;
  quizQuestionPauseStartedAt = 0;
}

function applyQuizPauseUi() {
  const paused = !!quizSessionPaused;
  const pauseBtn = document.getElementById('quizPauseBtn');
  if (pauseBtn) {
    pauseBtn.textContent = paused ? '继续' : '暂停';
    pauseBtn.classList.toggle('active', paused);
    pauseBtn.disabled = false;
  }
  const overlay = document.getElementById('quizPauseOverlay');
  if (overlay) {
    overlay.style.display = paused ? 'flex' : 'none';
    overlay.setAttribute('aria-hidden', paused ? 'false' : 'true');
  }
  document.querySelectorAll('.quiz-opt-btn').forEach(btn => {
    if (paused) {
      if (!btn.disabled) btn.setAttribute('data-pause-locked', '1');
      btn.disabled = true;
    } else if (btn.getAttribute('data-pause-locked') === '1') {
      btn.disabled = false;
      btn.removeAttribute('data-pause-locked');
    }
  });
  const skipBtn = document.getElementById('quizSkipBtn');
  if (skipBtn) {
    if (paused) {
      if (!skipBtn.disabled) skipBtn.setAttribute('data-pause-locked', '1');
      skipBtn.disabled = true;
    } else if (skipBtn.getAttribute('data-pause-locked') === '1') {
      skipBtn.disabled = false;
      skipBtn.removeAttribute('data-pause-locked');
    }
  }
  const nextBtn = document.getElementById('quizNextBtn');
  if (nextBtn && nextBtn.style.display !== 'none') {
    if (paused) {
      if (!nextBtn.disabled) nextBtn.setAttribute('data-pause-locked', '1');
      nextBtn.disabled = true;
    } else if (nextBtn.getAttribute('data-pause-locked') === '1') {
      nextBtn.disabled = false;
      nextBtn.removeAttribute('data-pause-locked');
    }
  }
}

function toggleQuizPause() {
  if (!quizQueue.length) return;
  const titleText = String((document.getElementById('quizTitleText') || {}).textContent || '');
  if (titleText.indexOf('Review') >= 0 || titleText.indexOf('回顾') >= 0) return;
  if (!quizSessionPaused) {
    quizSessionPaused = true;
    quizQuestionPauseStartedAt = Date.now();
  } else {
    if (quizQuestionPauseStartedAt) {
      quizQuestionPausedAccumMs += (Date.now() - quizQuestionPauseStartedAt);
    }
    quizSessionPaused = false;
    quizQuestionPauseStartedAt = 0;
  }
  applyQuizPauseUi();
}
