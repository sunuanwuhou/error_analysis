// ============================================================
// Quiz question render and answer actions
// ============================================================
function ensureQuizImageLightbox() {
  let mask = document.getElementById('quizImageLightbox');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'quizImageLightbox';
  mask.className = 'quiz-image-lightbox';
  mask.style.display = 'none';
  mask.innerHTML = `
    <div class="quiz-image-lightbox-backdrop"></div>
    <img id="quizImageLightboxImg" class="quiz-image-lightbox-img" src="" alt="preview">`;
  mask.addEventListener('click', closeQuizImageLightbox);
  document.body.appendChild(mask);
  return mask;
}

function openQuizImageLightbox(src) {
  const url = String(src || '').trim();
  if (!url) return;
  const mask = ensureQuizImageLightbox();
  const img = document.getElementById('quizImageLightboxImg');
  if (!img) return;
  img.setAttribute('src', url);
  mask.style.display = 'flex';
}

function openQuizImageLightboxFromEvent(event, src) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  openQuizImageLightbox(src);
  const mask = document.getElementById('quizImageLightbox');
  if (!mask || mask.style.display !== 'flex') {
    try {
      window.open(String(src || ''), '_blank', 'noopener,noreferrer');
    } catch (e) {}
  }
  return false;
}

function closeQuizImageLightbox() {
  const mask = document.getElementById('quizImageLightbox');
  if (!mask) return;
  mask.style.display = 'none';
}

window.openQuizImageLightbox = openQuizImageLightbox;
window.openQuizImageLightboxFromEvent = openQuizImageLightboxFromEvent;
window.closeQuizImageLightbox = closeQuizImageLightbox;
window.openQuizImageInNewTab = function openQuizImageInNewTab(src) {
  try {
    const url = String(src || '').trim();
    if (!url) return false;
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {}
  return false;
};

function renderQuizQuestionFenbiMode() {
  const total = quizQueue.length;
  document.getElementById('quizProgress').textContent = `${quizIdx + 1} / ${total}`;
  document.getElementById('quizProgFill').style.width = `${(quizIdx / total) * 100}%`;
  const e = quizQueue[quizIdx];
  startQuizQuestionTimer();
  const idLit = idArg(e.id);
  const questionText = String(e.question || '').trim();
  const isImageHeavyQuestion = !!e.imgData && questionText.length < 20;
  const opts = e.options ? e.options.split(/\n|\|/).map((o) => o.trim()).filter(Boolean) : [];
  const optBtns = opts.map((o, i) => {
    const letter = String.fromCharCode(65 + i);
    return `<button class="quiz-opt-btn" id="qopt_${letter}" onclick="selectQuizAnswer('${letter}')">${escapeHtml(o)}</button>`;
  }).join('');
  const chapterTag = `<div class="quiz-chip-row">
    <span class="quiz-chip quiz-chip-type">${escapeHtml(e.type || '')}</span>
    ${e.subtype ? `<span class="quiz-chip quiz-chip-sub">${escapeHtml(e.subtype)}</span>` : ''}
  </div>`;
  const imgTag = e.imgData
    ? `<div class="quiz-image-wrap ${isImageHeavyQuestion ? 'is-image-heavy' : ''}">
        <img src="${escapeHtml(e.imgData)}" class="cuoti-img ${isImageHeavyQuestion ? 'quiz-image-heavy' : ''}" loading="lazy" decoding="async" data-quiz-lightbox="1" title="点击放大查看" onclick="return openQuizImageLightboxFromEvent(event, '${escapeHtml(e.imgData)}')">
        <div class="quiz-image-actions">
          <button type="button" class="quiz-image-btn" data-quiz-lightbox-btn="1">放大预览</button>
          <a class="quiz-image-btn quiz-image-link" href="${escapeHtml(e.imgData)}" target="_blank" rel="noopener noreferrer">查看原图</a>
        </div>
      </div>`
    : '';
  const processImageTag = renderProcessImagePreview(e, 'quiz');
  const quickJudgeArea = e.imgData ? `
      <div class="quiz-opt-grid">
        ${['A', 'B', 'C', 'D'].map((l) => `<button class="quiz-opt-btn" id="qopt_${l}" onclick="selectQuizAnswer('${l}')" style="text-align:center;font-size:16px;font-weight:700">${l}</button>`).join('')}
      </div>` : `
      <div class="quiz-judge-row">
        <button class="quiz-opt-btn quiz-judge-btn quiz-judge-btn--ok" onclick="selectQuizAnswer('√')">正确</button>
        <button class="quiz-opt-btn quiz-judge-btn quiz-judge-btn--bad" onclick="selectQuizAnswer('×')">错误</button>
      </div>`;
  const quizOptionArea = `${optBtns || (!e.imgData ? '<p class="quiz-empty-option">No options. Judge directly.</p>' : '')}
    ${!opts.length ? quickJudgeArea : ''}`;
  const durationHint = getQuizDurationHint(e);
  document.getElementById('quizContent').innerHTML = `
    <div class="quiz-stage-shell">
      <div class="quiz-stage-head">
        ${chapterTag}
        ${durationHint || ''}
      </div>
      <div class="quiz-stage-main">
        <div class="quiz-process-canvas-host error-card quiz-question-surface" data-error-id="${escapeHtml(String(e.id || ''))}">
          <div class="quiz-sheet-panel ${isImageHeavyQuestion ? 'is-image-heavy' : ''}">
            <div class="quiz-reading-panel">
              ${questionText ? `<div class="card-question quiz-question-box">${escapeHtml(questionText)}</div>` : ''}
              ${imgTag}
              ${processImageTag}
            </div>
            <div class="quiz-answer-panel">
              <div class="quiz-answer-panel-title">Choose your answer</div>
              <div class="quiz-canvas-options-wrap">
                <div class="quiz-opt-grid">${quizOptionArea}</div>
              </div>
            </div>
          </div>
          <div id="quizAnswerFeedback"></div>
          <div id="quizAnalysisMount"></div>
        </div>
      </div>
      <div class="quiz-bottom-row quiz-action-dock">
        <div class="quiz-action-secondary">
          <button class="quiz-skip-btn" type="button" onclick='copyQuestionStem(${idLit})'>复制题目</button>
          <button class="quiz-skip-btn" type="button" id="quizCanvasToggleBtn" onclick='toggleQuizProcessCanvas(${idLit}, this)'>画布</button>
          <button class="quiz-skip-btn" type="button" id="quizPauseBtn" onclick="toggleQuizPause()">暂停</button>
          <button class="quiz-skip-btn" id="quizSkipBtn" onclick="skipQuizQuestion()">跳过</button>
        </div>
        <button class="quiz-next-btn" id="quizNextBtn" onclick="nextQuizQuestion()" style="display:none;flex:1">
          ${quizIdx + 1 < quizQueue.length ? '下一题' : '查看结果'}
        </button>
      </div>
      <div class="quiz-scratch-drawer" id="quizScratchDrawer">
        <div class="quiz-scratch-head">
          <div>
            <div class="quiz-scratch-title">Scratch pad</div>
            <div class="quiz-scratch-sub">Bounded workspace, hidden by default.</div>
          </div>
          <div class="quiz-scratch-actions">
            <button type="button" class="quiz-scratch-btn" onclick='undoQuizProcessCanvas(${idLit})'>Undo</button>
            <button type="button" class="quiz-scratch-btn" onclick='clearQuizProcessCanvas(${idLit})'>Clear</button>
            <button type="button" class="quiz-scratch-btn" onclick='closeQuizProcessCanvas()'>Close</button>
          </div>
        </div>
        <canvas id="quizScratchCanvas" class="quiz-scratch-canvas"></canvas>
      </div>
      <div class="quiz-pause-overlay" id="quizPauseOverlay" style="display:none" onclick="toggleQuizPause()">
        <div class="quiz-pause-overlay-card">已暂停，点击“继续”或遮罩恢复作答</div>
      </div>
    </div>`;
  bindQuizScratchCanvas(e.id);
  const quizImg = document.querySelector('#quizContent .cuoti-img[data-quiz-lightbox="1"]');
  if (quizImg && !quizImg.dataset.boundLightbox) {
    quizImg.dataset.boundLightbox = '1';
    quizImg.addEventListener('click', function (evt) {
      openQuizImageLightboxFromEvent(evt, this.getAttribute('src') || '');
    });
  }
  const previewBtn = document.querySelector('#quizContent [data-quiz-lightbox-btn="1"]');
  if (previewBtn && !previewBtn.dataset.boundLightboxBtn) {
    previewBtn.dataset.boundLightboxBtn = '1';
    previewBtn.addEventListener('click', function (evt) {
      const src = quizImg ? (quizImg.getAttribute('src') || '') : '';
      openQuizImageLightboxFromEvent(evt, src);
    });
  }
  closeQuizProcessCanvas();
  applyQuizPauseUi();
};

function selectQuizAnswerFenbiMode(letter) {
  if (quizSessionPaused) {
    showToast('当前已暂停，请先继续', 'warning');
    return;
  }
  document.querySelectorAll('.quiz-opt-btn').forEach((b) => { b.disabled = true; });
  const e = quizQueue[quizIdx];
  const correct = e.answer ? e.answer.trim().toUpperCase() : '';
  const isRight = letter === correct || letter === '√' || (letter !== '×' && letter === correct);
  const selectedBtn = document.getElementById(`qopt_${letter}`);
  if (selectedBtn) selectedBtn.classList.add(isRight ? 'correct' : 'wrong');
  if (!isRight && correct) {
    const correctBtn = document.getElementById(`qopt_${correct}`);
    if (correctBtn) correctBtn.classList.add('correct');
  }
  const answerRecord = {
    id: e.id,
    userAnswer: letter,
    correct: isRight,
    skipped: false,
    durationSec: getCurrentQuizElapsedSec()
  };
  quizAnswers.push(answerRecord);
  updateQuizAnswerState(e, answerRecord);
  document.getElementById('quizSkipBtn')?.style.setProperty('display', 'none');
  const nextBtn = document.getElementById('quizNextBtn');
  if (nextBtn) {
    nextBtn.style.display = 'block';
    nextBtn.textContent = quizIdx + 1 < quizQueue.length ? '下一题' : '查看结果';
  }
};
