// ============================================================
// Quiz canvas and answer feedback helpers
// ============================================================

const quizScratchState = {};

function getQuizScratchState(questionId) {
  const key = String(questionId || '');
  if (!quizScratchState[key]) quizScratchState[key] = { lines: [], drawing: false };
  return quizScratchState[key];
}

function drawQuizScratchCanvas(canvas, questionId) {
  if (!canvas) return;
  const state = getQuizScratchState(questionId);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(ratio, ratio);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  state.lines.forEach((line) => {
    if (!Array.isArray(line) || !line.length) return;
    ctx.beginPath();
    ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i += 1) ctx.lineTo(line[i].x, line[i].y);
    ctx.stroke();
  });
}

function bindQuizScratchCanvas(questionId) {
  const canvas = document.getElementById('quizScratchCanvas');
  if (!canvas) return;
  const state = getQuizScratchState(questionId);
  if (canvas.dataset.boundQuestionId === String(questionId || '')) {
    drawQuizScratchCanvas(canvas, questionId);
    return;
  }
  canvas.dataset.boundQuestionId = String(questionId || '');
  const readPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    const point = event.touches && event.touches[0] ? event.touches[0] : event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };
  const start = (event) => {
    event.preventDefault();
    state.drawing = true;
    state.lines.push([readPoint(event)]);
    drawQuizScratchCanvas(canvas, questionId);
  };
  const move = (event) => {
    if (!state.drawing || !state.lines.length) return;
    event.preventDefault();
    state.lines[state.lines.length - 1].push(readPoint(event));
    drawQuizScratchCanvas(canvas, questionId);
  };
  const stop = () => { state.drawing = false; };
  canvas.onmousedown = start;
  canvas.onmousemove = move;
  canvas.onmouseup = stop;
  canvas.onmouseleave = stop;
  canvas.ontouchstart = start;
  canvas.ontouchmove = move;
  canvas.ontouchend = stop;
  canvas.ontouchcancel = stop;
  drawQuizScratchCanvas(canvas, questionId);
}

function toggleQuizProcessCanvas(questionId, btn) {
  const drawer = document.getElementById('quizScratchDrawer');
  const shell = document.querySelector('.quiz-stage-shell');
  if (!drawer || !shell) {
    if (typeof window.openCanvas === 'function') window.openCanvas();
    return;
  }
  const willOpen = !drawer.classList.contains('open');
  drawer.classList.toggle('open', willOpen);
  shell.classList.toggle('quiz-canvas-open', willOpen);
  btn?.classList.toggle('active', willOpen);
  if (willOpen) bindQuizScratchCanvas(questionId);
}

function closeQuizProcessCanvas() {
  document.getElementById('quizScratchDrawer')?.classList.remove('open');
  document.querySelector('.quiz-stage-shell')?.classList.remove('quiz-canvas-open');
  document.getElementById('quizCanvasToggleBtn')?.classList.remove('active');
}

function clearQuizProcessCanvas(questionId) {
  const state = getQuizScratchState(questionId);
  state.lines = [];
  drawQuizScratchCanvas(document.getElementById('quizScratchCanvas'), questionId);
}

function undoQuizProcessCanvas(questionId) {
  const state = getQuizScratchState(questionId);
  if (state.lines.length) state.lines.pop();
  drawQuizScratchCanvas(document.getElementById('quizScratchCanvas'), questionId);
}

function getQuizTimingSummary(errorLike, durationSec) {
  const target = Math.max(Number(errorLike?.targetDurationSec || 0), 0);
  const actual = Math.max(Number(durationSec || 0), 0);
  if (!actual) return '';
  let tone = 'ok';
  let label = `Used ${actual}s`;
  if (target > 0) {
    if (actual <= target) label = `On time ${actual}s / ${target}s`;
    else if (actual <= Math.round(target * 1.3)) {
      tone = 'warn';
      label = `A bit slow ${actual}s / ${target}s`;
    } else {
      tone = 'danger';
      label = `Too slow ${actual}s / ${target}s`;
    }
  }
  return `<span class="quiz-result-chip quiz-result-chip--${tone}">${escapeHtml(label)}</span>`;
}

function getQuizAnswerFeedbackHtml(errorLike, answerRecord) {
  if (!errorLike || !answerRecord) return '';
  const statusTone = answerRecord.correct ? 'correct' : 'wrong';
  const statusText = answerRecord.correct ? 'Correct' : 'Wrong';
  const parts = [
    `<span class="quiz-result-chip quiz-result-chip--${statusTone}">${statusText}</span>`,
    `<span class="quiz-result-chip">Mine ${escapeHtml(answerRecord.userAnswer || '-')}</span>`,
    `<span class="quiz-result-chip">Answer ${escapeHtml(errorLike.answer || '-')}</span>`
  ];
  const timing = getQuizTimingSummary(errorLike, answerRecord.durationSec);
  if (timing) parts.push(timing);
  if (!answerRecord.correct && quizSessionMode === 'direct') {
    parts.push('<span class="quiz-result-chip quiz-result-chip--warn">Next: note-first</span>');
  }
  return `<div class="quiz-answer-feedback">${parts.join('')}</div>`;
}

function getQuizAnalysisPanelHtml(errorLike, answerRecord) {
  if (!errorLike || !answerRecord) return '';
  const analysisHtml = errorLike.analysis ? renderAnalysis(errorLike.analysis) : '';
  const reminderText = String(errorLike.tip || errorLike.nextAction || '').trim();
  const reminderHtml = reminderText
    ? `<div class="quiz-analysis-block"><div class="quiz-analysis-label">Next reminder</div><div>${renderAnalysis(reminderText)}</div></div>`
    : '';
  const emptyHtml = !analysisHtml && !reminderHtml
    ? '<div class="quiz-analysis-empty">No analysis yet.</div>'
    : '';
  return `
    <div class="quiz-analysis-panel" id="quizAnalysisPanel">
      <button class="quiz-analysis-toggle" type="button" onclick="toggleQuizAnalysisPanel()">
        <span>Analysis</span>
        <span class="quiz-analysis-toggle-meta">${answerRecord.correct ? 'Keep closed for fast flow' : 'Open if you need review'}</span>
      </button>
      <div class="quiz-analysis-content" id="quizAnalysisContent">
        ${analysisHtml ? `<div class="quiz-analysis-block"><div class="quiz-analysis-label">Why</div><div>${analysisHtml}</div></div>` : ''}
        ${reminderHtml}
        ${emptyHtml}
      </div>
    </div>`;
}

function toggleQuizAnalysisPanel(forceOpen) {
  const panel = document.getElementById('quizAnalysisPanel');
  if (!panel) return;
  const willOpen = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
  panel.classList.toggle('open', willOpen);
}

function updateQuizAnswerState(errorLike, answerRecord) {
  const feedbackHost = document.getElementById('quizAnswerFeedback');
  const analysisHost = document.getElementById('quizAnalysisMount');
  if (feedbackHost) feedbackHost.innerHTML = getQuizAnswerFeedbackHtml(errorLike, answerRecord);
  if (analysisHost) analysisHost.innerHTML = getQuizAnalysisPanelHtml(errorLike, answerRecord);
}
