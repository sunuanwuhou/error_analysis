(function () {
  const STATUS_OPTIONS = [
    { value: 'solved', label: '会做' },
    { value: 'hesitant', label: '犹豫' },
    { value: 'guessed', label: '蒙的' },
    { value: 'stuck', label: '卡住' },
  ];

  let timer = null;
  let attemptDrafts = {};

  function q() { return window.quizQueue?.[window.quizIdx] || null; }
  function nowIso() { return new Date().toISOString(); }
  function normalizeId(v) { return v == null ? '' : String(v); }
  function getAttemptPanel() { return document.getElementById('quizAttemptPanel'); }

  function formatDuration(sec) {
    const value = Math.max(0, Number(sec) || 0);
    const m = Math.floor(value / 60);
    const s = value % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function secondsSince(start) {
    if (!start) return 0;
    const ts = new Date(start).getTime();
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, Math.round((Date.now() - ts) / 1000));
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function getDisplayKnowledgePath(item) {
    if (item && item.noteNodeId && typeof window.getKnowledgePathTitles === 'function' && typeof window.collapseKnowledgePathTitles === 'function') {
      const titles = window.collapseKnowledgePathTitles(window.getKnowledgePathTitles(item.noteNodeId));
      if (titles && titles.length) return titles.join(' > ');
    }
    return [item?.type, item?.subtype, item?.subSubtype].filter(Boolean).join(' > ');
  }

  window.getDisplayKnowledgePath = getDisplayKnowledgePath;

  function getCurrentDraft() {
    const item = q();
    if (!item) return null;
    const key = normalizeId(item.id || item.questionId || window.quizIdx);
    if (!attemptDrafts[key]) {
      attemptDrafts[key] = {
        id: (window.newId ? window.newId() : `${Date.now()}_${Math.random().toString(16).slice(2)}`),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        sessionMode: window.quizSessionMode || '',
        source: window.quizSessionMode === 'full' ? '全量练习' : '今日复习',
        questionId: key,
        errorId: normalizeId(item.id || ''),
        type: item.type || '',
        subtype: item.subtype || '',
        subSubtype: item.subSubtype || '',
        questionText: item.question || '',
        correctAnswer: item.answer || '',
        statusTag: '',
        confidence: 0,
        solvingNote: '',
        noteNodeId: item.noteNodeId || '',
        scratchData: {
          processImageUrl: typeof window.getProcessImageUrl === 'function' ? (window.getProcessImageUrl(item) || '') : '',
        },
        meta: {},
        startedAt: nowIso(),
      };
    }
    return attemptDrafts[key];
  }

  function syncDraftFromUi(options) {
    const draft = getCurrentDraft();
    if (!draft) return null;
    const refreshProcessImage = options?.refreshProcessImage !== false;
    const noteEl = document.getElementById('quizSolvingNote');
    draft.solvingNote = noteEl ? noteEl.value.trim() : (draft.solvingNote || '');
    draft.updatedAt = nowIso();
    const item = q();
    if (refreshProcessImage && item && typeof window.getProcessImageUrl === 'function') {
      draft.scratchData = draft.scratchData || {};
      draft.scratchData.processImageUrl = window.getProcessImageUrl(item) || '';
    }
    return draft;
  }

  function startQuestionTimer() {
    stopTimer();
    const tick = () => {
      const draft = getCurrentDraft();
      const el = document.getElementById('quizAttemptTimer');
      if (el && draft) el.textContent = formatDuration(secondsSince(draft.startedAt));
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  function setStatusTag(value) {
    const draft = syncDraftFromUi();
    if (!draft) return;
    draft.statusTag = value;
    const panel = getAttemptPanel();
    if (!panel) return;
    panel.querySelectorAll('[data-quiz-status]').forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-quiz-status') === value));
  }

  function setConfidence(value) {
    const draft = syncDraftFromUi();
    if (!draft) return;
    draft.confidence = Number(value) || 0;
    const panel = getAttemptPanel();
    if (!panel) return;
    panel.querySelectorAll('[data-quiz-confidence]').forEach((btn) => btn.classList.toggle('active', Number(btn.getAttribute('data-quiz-confidence')) === draft.confidence));
  }

  function onAttemptPanelClick(event) {
    const statusBtn = event.target?.closest?.('[data-quiz-status]');
    if (statusBtn) {
      setStatusTag(statusBtn.getAttribute('data-quiz-status'));
      return;
    }
    const confidenceBtn = event.target?.closest?.('[data-quiz-confidence]');
    if (confidenceBtn) {
      setConfidence(confidenceBtn.getAttribute('data-quiz-confidence'));
    }
  }

  function onAttemptPanelInput(event) {
    if (event.target?.id === 'quizSolvingNote') {
      syncDraftFromUi({ refreshProcessImage: false });
    }
  }

  function injectAttemptPanel() {
    const content = document.getElementById('quizContent');
    const bottom = content?.querySelector('.quiz-bottom-row');
    if (!content || !bottom || document.getElementById('quizAttemptPanel')) return;
    const draft = getCurrentDraft();
    if (!draft) return;

    const panel = document.createElement('div');
    panel.id = 'quizAttemptPanel';
    panel.className = 'quiz-attempt-panel';
    panel.innerHTML = `
      <div class="quiz-attempt-head">
        <strong>做题记录</strong>
        <span class="quiz-attempt-timer">用时 <span id="quizAttemptTimer">0:00</span></span>
      </div>
      <div class="quiz-attempt-row">
        <span class="quiz-attempt-label">状态</span>
        <div class="quiz-attempt-chip-wrap">
          ${STATUS_OPTIONS.map((opt) => `<button type="button" class="quiz-attempt-chip ${draft.statusTag === opt.value ? 'active' : ''}" data-quiz-status="${opt.value}">${opt.label}</button>`).join('')}
        </div>
      </div>
      <div class="quiz-attempt-row">
        <span class="quiz-attempt-label">把握度</span>
        <div class="quiz-attempt-chip-wrap">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="quiz-attempt-chip ${draft.confidence === n ? 'active' : ''}" data-quiz-confidence="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="quiz-attempt-row" style="align-items:flex-start">
        <span class="quiz-attempt-label">备注</span>
        <textarea id="quizSolvingNote" class="quiz-attempt-note" placeholder="简记当时思路、卡点、为什么犹豫"></textarea>
      </div>`;

    bottom.parentNode.insertBefore(panel, bottom);
    panel.addEventListener('click', onAttemptPanelClick);
    panel.addEventListener('input', onAttemptPanelInput);
    const noteEl = document.getElementById('quizSolvingNote');
    if (noteEl) noteEl.value = draft.solvingNote || '';
    startQuestionTimer();
  }

  function finalizeAttempt(answer, result) {
    const draft = syncDraftFromUi();
    if (!draft) return null;
    stopTimer();
    draft.myAnswer = answer || '';
    draft.result = result || '';
    draft.durationSec = secondsSince(draft.startedAt);
    draft.updatedAt = nowIso();
    return JSON.parse(JSON.stringify(draft));
  }

  function resetAttemptState() {
    stopTimer();
    attemptDrafts = {};
  }

  function decorateReview() {
    const answers = Array.isArray(window.quizAnswers) ? window.quizAnswers : [];
    const cards = document.querySelectorAll('#quizContent .quiz-review-item');
    const reviewRenderer = window.V53ReviewExtraRenderer;
    cards.forEach((card, idx) => {
      const answer = answers[idx];
      if (!answer || !answer.attempt || card.querySelector('.quiz-attempt-summary')) return;
      const extra = document.createElement('div');
      extra.innerHTML = reviewRenderer.renderReviewExtra(answer, idx, formatDuration);
      const child = extra.firstElementChild;
      if (child) card.appendChild(child);
    });
  }

  function prefillModalFromAttempt(answer) {
    const at = answer?.attempt || null;
    const item = answer || q() || {};
    if (typeof window.openAddModal !== 'function') return;
    window.openAddModal();
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };
    setVal('editType', item.type || at?.type || '其他');
    if (typeof window.updateSubtypeOptions === 'function') window.updateSubtypeOptions();
    setVal('editSubtype', item.subtype || at?.subtype || '');
    setVal('editSubSubtype', item.subSubtype || at?.subSubtype || '');
    setVal('editQuestion', item.question || at?.questionText || '');
    setVal('editOptions', String(item.options || '').replace(/\n/g, '|'));
    setVal('editAnswer', item.answer || at?.correctAnswer || '');
    setVal('editMyAnswer', answer?.myAnswer || at?.myAnswer || '');
    setVal('editRootReason', at?.meta?.mistakeType || '');
    setVal('editErrorReason', at?.meta?.triggerPoint || '');
    setVal('editAnalysis', at?.meta?.correctModel || '');
    setVal('editNextAction', at?.meta?.nextAction || '');
    if (typeof window.refreshKnowledgePicker === 'function') window.refreshKnowledgePicker(item.noteNodeId || at?.noteNodeId || '');
    window.__pendingAttemptLink = {
      attemptId: at?.id || '',
      sourceAnswerId: answer?.id || '',
      sourceQuestionId: at?.questionId || item.id || '',
    };
    const banner = document.getElementById('entryFlowBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.textContent = '当前正在补全：做题记录 -> 结构化错因 -> 知识点绑定';
    }
  }

  function openAttemptClosure(reviewIndex) {
    const answers = Array.isArray(window.quizAnswers) ? window.quizAnswers : [];
    const answer = answers[Number(reviewIndex)] || null;
    if (!answer) return;
    if (answer.id && typeof window.openEditModal === 'function') {
      window.__pendingAttemptLink = {
        attemptId: answer.attempt?.id || '',
        sourceAnswerId: answer.id || '',
        sourceQuestionId: answer.attempt?.questionId || answer.id || '',
      };
      window.openEditModal(answer.id);
      const banner = document.getElementById('entryFlowBanner');
      if (banner) {
        banner.style.display = 'block';
        banner.textContent = '当前正在补全：做题记录 -> 结构化错因 -> 知识点绑定';
      }
      return;
    }
    prefillModalFromAttempt(answer);
  }

  function simplifyChrome() {
    document.querySelectorAll('#moreMenuPanel .btn').forEach((btn) => {
      const text = (btn.textContent || '').trim();
      if (/Claude|AI/.test(text)) btn.remove();
    });
    const more = document.getElementById('moreMenuPanel');
    if (more) {
      const order = ['导入错题', '导出', '统计'];
      Array.from(more.querySelectorAll('.btn'))
        .sort((a, b) => {
          const ta = (a.textContent || '').trim();
          const tb = (b.textContent || '').trim();
          const ia = order.findIndex((k) => ta.includes(k));
          const ib = order.findIndex((k) => tb.includes(k));
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        })
        .forEach((btn) => more.appendChild(btn));
    }
    const quizBtn = document.getElementById('quizBtn');
    if (quizBtn) quizBtn.querySelector('span')?.replaceChildren('📘 今日训练');
  }

  function patchFunctions(sync) {
    if (typeof window.renderQuizQuestion === 'function' && !window.__patchedRenderQuizQuestion) {
      const original = window.renderQuizQuestion;
      window.renderQuizQuestion = function wrappedRenderQuizQuestion() {
        const out = original.apply(this, arguments);
        injectAttemptPanel();
        return out;
      };
      window.__patchedRenderQuizQuestion = true;
    }

    if (typeof window.startQuiz === 'function' && !window.__patchedStartQuiz) {
      const original = window.startQuiz;
      window.startQuiz = async function wrappedStartQuiz() {
        resetAttemptState();
        return await original.apply(this, arguments);
      };
      window.__patchedStartQuiz = true;
    }

    if (typeof window.startFullPractice === 'function' && !window.__patchedStartFull) {
      const original = window.startFullPractice;
      window.startFullPractice = function wrappedStartFullPractice() {
        resetAttemptState();
        return original.apply(this, arguments);
      };
      window.__patchedStartFull = true;
    }

    if (typeof window.selectQuizAnswer === 'function' && !window.__patchedSelectQuizAnswer) {
      const original = window.selectQuizAnswer;
      window.selectQuizAnswer = function wrappedSelectQuizAnswer(letter) {
        const item = q();
        const correct = item && item.answer ? String(item.answer).trim().toUpperCase() : '';
        const isRight = letter === correct || letter === '✔' || (letter !== '✔' && letter === correct);
        const attempt = finalizeAttempt(letter, isRight ? 'correct' : 'wrong');
        const out = original.apply(this, arguments);
        const last = window.quizAnswers && window.quizAnswers[window.quizAnswers.length - 1];
        if (last && attempt) last.attempt = attempt;
        return out;
      };
      window.__patchedSelectQuizAnswer = true;
    }

    if (typeof window.skipQuizQuestion === 'function' && !window.__patchedSkipQuiz) {
      const original = window.skipQuizQuestion;
      window.skipQuizQuestion = function wrappedSkipQuizQuestion() {
        const attempt = finalizeAttempt('—', 'skipped');
        const out = original.apply(this, arguments);
        const last = window.quizAnswers && window.quizAnswers[window.quizAnswers.length - 1];
        if (last && attempt) last.attempt = attempt;
        return out;
      };
      window.__patchedSkipQuiz = true;
    }

    if (typeof window.renderQuizReview === 'function' && !window.__patchedRenderQuizReview) {
      const original = window.renderQuizReview;
      window.renderQuizReview = function wrappedRenderQuizReview() {
        const out = original.apply(this, arguments);
        decorateReview();
        return out;
      };
      window.__patchedRenderQuizReview = true;
    }

    if (typeof window.saveQuizResults === 'function' && !window.__patchedSaveQuizResults) {
      const original = window.saveQuizResults;
      window.saveQuizResults = async function wrappedSaveQuizResults() {
        const attempts = (Array.isArray(window.quizAnswers) ? window.quizAnswers : []).map((a) => a && a.attempt).filter(Boolean);
        await sync.saveAttemptsBatch(attempts);
        return await original.apply(this, arguments);
      };
      window.__patchedSaveQuizResults = true;
    }

    if (typeof window.closeQuizModal === 'function' && !window.__patchedCloseQuiz) {
      const original = window.closeQuizModal;
      window.closeQuizModal = function wrappedCloseQuizModal(force) {
        if (force) resetAttemptState();
        return original.apply(this, arguments);
      };
      window.__patchedCloseQuiz = true;
    }
  }

  function init(options) {
    const sync = options?.sync || window.V53AttemptSync;
    patchFunctions(sync);
    simplifyChrome();
  }

  window.V53AttemptPanel = {
    init,
    openAttemptClosure,
    setStatusTag,
    setConfidence,
  };
})();
