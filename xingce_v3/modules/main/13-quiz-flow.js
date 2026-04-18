// ============================================================
// 答题流程（新版：选项点击 → 全部完成 → 批量回顾 → 保存）
// ============================================================
function buildQuizQueueFromItems(items) {
  return (items || []).map(item => ({ ...findErrorById(item.id), ...item })).filter(isErrorEntry);
}

function findQuizErrorById(errorId) {
  const direct = findErrorById(errorId);
  if (direct) return direct;
  const normalized = normalizeErrorId(errorId);
  return errors.find(x => normalizeErrorId(x && x.id) === normalized) || null;
}

let quizQuestionStartedAt = 0;

function getCurrentQuizElapsedSec() {
  if (!quizQuestionStartedAt) return 0;
  return Math.max(1, Math.round((Date.now() - quizQuestionStartedAt) / 1000));
}

function getQuizDurationHint(errorLike) {
  const e = errorLike || {};
  const target = Math.max(Number(e.targetDurationSec || 0), 0);
  const recent = Math.max(Number(e.lastDuration || e.actualDurationSec || 0), 0);
  if (quizSessionMode === 'speed') {
    const chips = [];
    if (target > 0) chips.push(`<span style="font-size:12px;padding:4px 10px;border-radius:999px;background:#fff7e6;color:#d46b08;font-weight:700">目标 ${target} 秒</span>`);
    if (recent > 0) chips.push(`<span style="font-size:12px;padding:4px 10px;border-radius:999px;background:#f5f5f5;color:#666">上次 ${recent} 秒</span>`);
    return `<div style="margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${chips.join('') || '<span style="font-size:12px;color:#d46b08;font-weight:700">这题按限时复训处理</span>'}</div>`;
  }
  if (quizSessionMode === 'direct' && String(e.tip || '').trim()) {
    return `<div style="margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#f6ffed;border:1px solid #b7eb8f;color:#237804;font-size:13px;line-height:1.7"><strong style="font-weight:700">做题提醒：</strong>${escapeHtml(String(e.tip || '').trim())}</div>`;
  }
  return '';
}

async function startPracticeQueue(mode) {
  if (!(await ensureQuizModalReady())) return;
  const normalizedMode = String(mode || 'daily');
  let serverPayload = null;
  try {
    serverPayload = await fetchJsonWithAuth('/api/practice/daily?limit=12');
  } catch (e) {
    console.warn('daily practice fallback:', e);
  }

  const localPack = typeof buildPracticeTaskPack === 'function' ? buildPracticeTaskPack(12) : null;
  const serverDaily = buildQuizQueueFromItems(serverPayload && serverPayload.items);
  const serverReview = buildQuizQueueFromItems(serverPayload && serverPayload.reviewQueue);
  const serverRetrain = buildQuizQueueFromItems(serverPayload && serverPayload.retrainQueue);

  let title = '📝 今日复习';
  if (normalizedMode === 'review') title = '🧩 待复盘训练';
  else if (normalizedMode === 'retrain') title = '🔁 待复训训练';

  if (normalizedMode === 'daily') {
    const advice = Array.isArray(serverPayload && serverPayload.advice) ? serverPayload.advice[0] : null;
    const fallbackTitle = localPack && localPack.advice && localPack.advice[0] ? localPack.advice[0].title : '';
    if (advice && advice.title) title = `📝 今日复习 · ${advice.title}`;
    else if (fallbackTitle) title = `📝 今日复习 · ${fallbackTitle}`;
    quizQueue = serverDaily.length ? serverDaily : (localPack ? localPack.dailyQueue : getDueList());
  } else if (normalizedMode === 'review') {
    quizQueue = serverReview.length ? serverReview : ((localPack && localPack.reviewQueue) || (typeof getTaskPackQueueByMode === 'function' ? getTaskPackQueueByMode('review', 12) : []));
  } else if (normalizedMode === 'retrain') {
    quizQueue = serverRetrain.length ? serverRetrain : ((localPack && localPack.retrainQueue) || (typeof getTaskPackQueueByMode === 'function' ? getTaskPackQueueByMode('retrain', 12) : []));
  } else {
    quizQueue = serverDaily.length ? serverDaily : (localPack ? localPack.dailyQueue : getDueList());
  }

  if (!quizQueue.length) {
    const msg = normalizedMode === 'review' ? '当前没有待复盘题' : (normalizedMode === 'retrain' ? '当前没有待复训题' : '今日暂无需要复习的题目');
    showToast(msg, 'warning');
    return;
  }
  quizSessionMode = normalizedMode;
  quizIdx = 0; quizAnswers = []; quizSkipped = new Set();
  document.getElementById('quizTitleText').textContent = title;
  openModal('quizModal');
  renderQuizQuestion();
}

async function startQuiz() {
  return startPracticeQueue('daily');
}

function startFullPractice() {
  const all = getErrorEntries().filter(e => !(typeof isEffectivelyMastered === 'function' ? isEffectivelyMastered(e) : e.status === 'mastered'));
  if (!all.length) { showToast('暂无错题，当前都已掌握', 'warning'); return; }
  // 打开章节筛选弹窗
  const typeMap = {};
  all.forEach(e=>{
    if(!typeMap[e.type]) typeMap[e.type]=new Set();
    typeMap[e.type].add(e.subtype||'未分类');
  });
  let html='';
  Object.entries(typeMap).forEach(([type,subs])=>{
    html+=`<div class="chapter-filter-type">
      <label class="chapter-filter-type-label">
        <input type="checkbox" class="cf-type" data-type="${escapeHtml(type)}" checked onchange="cfTypeToggle(this)">
        ${escapeHtml(type)}
      </label>
      <div class="chapter-filter-subs">`;
    [...subs].sort().forEach(sub=>{
      html+=`<label class="chapter-filter-item">
        <input type="checkbox" class="cf-sub" data-type="${escapeHtml(type)}" data-sub="${escapeHtml(sub)}" checked>
        ${escapeHtml(sub)} <span style="color:#aaa;font-size:11px">(${all.filter(e=>e.type===type&&(e.subtype||'未分类')===sub).length})</span>
      </label>`;
    });
    html+='</div></div>';
  });
  document.getElementById('chapterFilterList').innerHTML=html;
  openModal('chapterFilterModal');
}
function cfTypeToggle(cb){
  const type=cb.getAttribute('data-type');const checked=cb.checked;
  document.querySelectorAll(`.cf-sub[data-type="${CSS.escape(type)}"]`).forEach(c=>c.checked=checked);
}
function chapterFilterSelectAll(v){
  document.querySelectorAll('#chapterFilterList input[type=checkbox]').forEach(c=>c.checked=v);
}
function startFullPracticeFiltered() {
  if (!document.getElementById('quizTitleText') || !document.getElementById('quizModal')) {
    showToast('题目弹窗尚未加载完成，请稍后再试', 'warning');
    return;
  }
  const selected=new Set();
  document.querySelectorAll('.cf-sub:checked').forEach(cb=>{
    selected.add(cb.getAttribute('data-type')+'::::'+(cb.getAttribute('data-sub')||'未分类'));
  });
  if(!selected.size){showToast('请至少选择一个章节', 'warning');return;}
  quizQueue = getErrorEntries().filter(e=>{
    if(typeof isEffectivelyMastered === 'function' ? isEffectivelyMastered(e) : normalizeErrorStatusValue(e.status)==='mastered') return false;
    const key=e.type+'::::'+(e.subtype||'未分类');
    return selected.has(key);
  }).slice().sort((a,b)=>{
    const aScore = typeof computePracticeScore === 'function' ? computePracticeScore(a).score : 0;
    const bScore = typeof computePracticeScore === 'function' ? computePracticeScore(b).score : 0;
    if (bScore !== aScore) return bScore - aScore;
    const tc=(a.type||'').localeCompare(b.type||'','zh');
    return tc!==0?tc:(a.subtype||'').localeCompare(b.subtype||'','zh');
  });
  if(!quizQueue.length){showToast('所选章节暂无错题', 'warning');return;}
  quizSessionMode = 'full';
  quizIdx=0; quizAnswers=[]; quizSkipped=new Set();
  closeModal('chapterFilterModal');
  document.getElementById('quizTitleText').textContent='📚 全量练习';
  openModal('quizModal');
  renderQuizQuestion();
}

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

function nextQuizQuestion() {
  quizIdx++;
  if (quizIdx >= quizQueue.length) {
    renderQuizReview();
  } else {
    renderQuizQuestion();
  }
}

async function saveQuizResults() {
  const realAnswers = quizAnswers.filter(a=>!a.skipped);
  const attemptPayload = [];
  const touchedIds = [];
  const nowIso = new Date().toISOString();
  realAnswers.forEach(a => {
    const e = findQuizErrorById(a.id);
    if (!e) return;
    normalizeErrorForWorkflow(e);
    if (!e.quiz) e.quiz = {streak:0,wrongCount:0,reviewCount:0,lastReview:null,nextReview:null};
    e.quiz.reviewCount++;
    e.quiz.lastReview = today();
    if (!e.quiz.history) e.quiz.history = [];
    e.quiz.history.push({date:today(), answer:a.userAnswer, correct:a.correct});
    if (a.correct) {
      e.quiz.streak = (e.quiz.streak||0) + 1;
      if (e.quiz.streak>=6) {
        e.status = 'mastered';
        e.masteryLevel = 'mastered';
      } else if (e.quiz.streak>=3) {
        e.status = 'review';
        e.masteryLevel = 'fuzzy';
      } else {
        e.status = 'review';
        e.masteryLevel = 'not_mastered';
      }
    } else {
      e.quiz.streak = 0;
      e.quiz.wrongCount = (e.quiz.wrongCount||0)+1;
      e.status = 'focus';
      e.masteryLevel = 'not_mastered';
      e.myAnswer = a.userAnswer;
    }
    e.lastPracticedAt = nowIso;
    e.masteryUpdatedAt = nowIso;
    e.quiz.nextReview = addDays(today(), INTERVALS[Math.min(e.quiz.streak||0, INTERVALS.length-1)]);
    e.nextReviewAt = e.quiz.nextReview;
    touchErrorUpdatedAt(e);
    touchedIds.push(String(e.id));
    attemptPayload.push({
      sessionMode: quizSessionMode === 'full' ? 'full' : (quizSessionMode || 'daily'),
      source: quizSessionMode === 'full'
        ? 'phase13_22_full'
        : (quizSessionMode === 'note'
          ? 'phase13_22_note_first'
          : (quizSessionMode === 'direct'
            ? 'phase13_22_direct_do'
            : (quizSessionMode === 'speed' ? 'phase13_22_speed_drill' : 'phase13_22_daily'))),
      questionId: String(e.id || ''),
      errorId: String(e.id || ''),
      type: String(e.type || ''),
      subtype: String(e.subtype || ''),
      subSubtype: String(e.subSubtype || ''),
      questionText: String(e.question || ''),
      myAnswer: String(a.userAnswer || ''),
      correctAnswer: String(e.answer || ''),
      result: a.correct ? 'correct' : 'wrong',
      durationSec: Number(a.durationSec || 0),
      statusTag: String(e.status || ''),
      confidence: a.correct ? (e.quiz.streak >= 3 ? 4 : 3) : 1,
      solvingNote: String(e.note || ''),
      scratchData: {},
      noteNodeId: String(e.noteNodeId || ''),
      meta: {
        mistakeType: String(e.rootReason || e.errorReason || ''),
        triggerPoint: String(e.triggerPoint || ''),
        correctModel: String(e.analysis || e.correctModel || ''),
        nextAction: String(e.nextAction || (a.correct ? '继续下一轮复训' : '先回看错因与解析') || ''),
      },
    });
  });
  const sessionType = quizSessionMode === 'full' ? '全量练习' : '今日复习';
  pushHistory({
    date: today()+' '+new Date().toTimeString().slice(0,5),
    sessionType,
    total: realAnswers.length,
    correct: realAnswers.filter(a=>a.correct).length,
    skipped: quizAnswers.filter(a=>a.skipped).length,
    details: quizAnswers.map(a=>({id:a.id,correct:a.correct,skipped:a.skipped||false}))
  });
  try{
    await fetchJsonWithAuth('/api/practice/log', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        date: today(),
        mode: sessionType.includes('全量') ? 'targeted' : 'daily',
        weaknessTag: reasonFilter || '',
        total: realAnswers.length,
        correct: realAnswers.filter(a=>a.correct).length,
        errorIds: realAnswers.map(a=>String(a.id))
      })
    });
  }catch(e){
    console.warn('practice log sync failed:', e);
  }
  if (attemptPayload.length) {
    try {
      await fetchJsonWithAuth('/api/practice/attempts/batch', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ items: attemptPayload })
      });
      if (typeof window.invalidatePracticeAttemptSummaries === 'function') {
        window.invalidatePracticeAttemptSummaries(touchedIds);
      }
    } catch (e) {
      console.warn('practice attempts batch sync failed:', e);
    }
  }
  todayDone += realAnswers.length;
  saveTodayDone();
  saveData();
  closeQuizModal(true);
  renderSidebar();
  renderAll();
  showToast('记录已保存', 'success');
}


function renderQuizQuestionFenbiMode() {
  const total = quizQueue.length;
  document.getElementById('quizProgress').textContent = `${quizIdx + 1} / ${total}`;
  document.getElementById('quizProgFill').style.width = `${(quizIdx / total) * 100}%`;
  const e = quizQueue[quizIdx];
  quizQuestionStartedAt = Date.now();
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
  const imgTag = e.imgData ? `<div class="quiz-image-wrap ${isImageHeavyQuestion ? 'is-image-heavy' : ''}"><img src="${escapeHtml(e.imgData)}" class="cuoti-img ${isImageHeavyQuestion ? 'quiz-image-heavy' : ''}" loading="lazy" decoding="async" onclick="this.classList.toggle('expanded')" title="toggle zoom"></div>` : '';
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
          <button class="quiz-skip-btn" type="button" id="quizCanvasToggleBtn" onclick='toggleQuizProcessCanvas(${idLit}, this)'>画布</button>
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
    </div>`;
  bindQuizScratchCanvas(e.id);
  closeQuizProcessCanvas();
};

function selectQuizAnswerFenbiMode(letter) {
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

function renderQuizReviewFenbiMode() {
  const realAnswers = quizAnswers.filter((a) => !a.skipped);
  const total = realAnswers.length;
  const correctN = realAnswers.filter((a) => a.correct).length;
  const wrongN = total - correctN;
  const skippedN = quizAnswers.filter((a) => a.skipped).length;
  document.getElementById('quizProgress').textContent = 'Review';
  document.getElementById('quizProgFill').style.width = '100%';
  document.getElementById('quizTitleText').textContent = 'Practice Review';
  closeQuizProcessCanvas();
  const items = quizAnswers.map((a) => {
    const e = errors.find((x) => x.id === a.id);
    if (!e) return '';
    const metaLine = [
      `<span class="quiz-result-chip">${escapeHtml(e.type || '')}</span>`,
      e.subtype ? `<span class="quiz-result-chip">${escapeHtml(e.subtype)}</span>` : ''
    ].filter(Boolean).join('');
    if (a.skipped) {
      return `<div class="quiz-review-item">
        <div class="review-meta"><span class="review-verdict" style="color:#d97706">Skipped</span>${metaLine}</div>
        <div style="font-size:13px;color:#334155;line-height:1.7">${escapeHtml(e.question || '')}</div>
      </div>`;
    }
    return `<div class="quiz-review-item ${a.correct ? 'right' : 'wrong'}">
      <div class="review-meta"><span class="review-verdict ${a.correct ? 'right' : 'wrong'}">${a.correct ? 'Correct' : 'Wrong'}</span>${metaLine}</div>
      <div style="font-size:13px;color:#334155;line-height:1.7;margin-bottom:10px">${escapeHtml(e.question || '')}</div>
      ${getQuizAnswerFeedbackHtml(e, a)}
      ${e.analysis ? `<div class="review-analysis">${renderAnalysis(e.analysis)}</div>` : ''}
    </div>`;
  }).join('');
  document.getElementById('quizContent').innerHTML = `
    <div class="quiz-review-shell">
      <div class="quiz-review-title">Session complete</div>
      <div class="quiz-summary-bar">
        <div class="sum-stat"><div class="sum-num green">${correctN}</div><div class="sum-label">Correct</div></div>
        <div class="sum-stat"><div class="sum-num">${wrongN}</div><div class="sum-label">Wrong</div></div>
        <div class="sum-stat"><div class="sum-num" style="color:#64748b">${total}</div><div class="sum-label">Answered</div></div>
        ${skippedN ? `<div class="sum-stat"><div class="sum-num" style="color:#d97706">${skippedN}</div><div class="sum-label">Skipped</div></div>` : ''}
      </div>
      <div class="quiz-review-list">${items}</div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="saveQuizResults()">Save and Close</button>
        <button class="btn btn-secondary" onclick="markAllWrongAsFocus()">Mark wrong as focus</button>
        <button class="btn btn-secondary" onclick="requestCloseQuizModal('notes')">Open notes</button>
      </div>
    </div>`;
};

const RANDOM_NOTE_EDIT_WEIGHT = 0.7;
const RANDOM_NOTE_VIEW_WEIGHT = 0.3;
const RANDOM_NOTE_RECENT_VIEW_DOWN_WEIGHT = 0.2;
const RANDOM_NOTE_RECENT_VIEW_DAYS = 1;
let randomNoteReviewQueue = [];
let randomNoteReviewIndex = -1;
let randomNoteReviewSessionSeen = new Set();

function _toValidDate(value) {
  const d = new Date(String(value || ''));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function _daysSince(value, fallbackDays) {
  const d = _toValidDate(value);
  if (!d) return Number.isFinite(fallbackDays) ? fallbackDays : null;
  const gapMs = Date.now() - d.getTime();
  return Math.max(0, gapMs / (24 * 60 * 60 * 1000));
}

function _formatGapDays(days) {
  if (!Number.isFinite(days) || days < 0.04) return '刚刚';
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} 小时`;
  return `${Math.round(days)} 天`;
}

function _formatIsoTime(value) {
  const d = _toValidDate(value);
  if (!d) return '未知';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function _normalizeNoteMeaningfulText(raw) {
  return String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/^#{1,6}\s*/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/^\s*\d+\.\s+/gm, ' ')
    .replace(/[>|`*_~]/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

function _hasMeaningfulNoteContent(contentMd, title) {
  const body = String(contentMd || '').trim();
  if (!body) return false;
  const normalizedBody = _normalizeNoteMeaningfulText(body);
  if (!normalizedBody) return false;
  const normalizedTitle = _normalizeNoteMeaningfulText(String(title || ''));
  if (!normalizedTitle) return true;
  if (normalizedBody === normalizedTitle) return false;
  if (normalizedBody.startsWith(normalizedTitle) && normalizedBody.length <= normalizedTitle.length + 2) return false;
  return true;
}

function _collectRandomNoteCandidates() {
  if (typeof ensureKnowledgeState === 'function') ensureKnowledgeState();
  const roots = (typeof getKnowledgeRootNodes === 'function')
    ? (getKnowledgeRootNodes() || [])
    : ((knowledgeTree && knowledgeTree.roots) || []);
  const candidates = [];
  const walk = (nodes) => {
    (nodes || []).forEach(node => {
      if (!node || typeof node !== 'object') return;
      const contentMd = String(node.contentMd || '').trim();
      if (_hasMeaningfulNoteContent(contentMd, node.title)) {
        const tracking = (noteReviewTracking && noteReviewTracking[node.id]) || {};
        const editGapDays = _daysSince(node.updatedAt, 365);
        const viewGapDays = _daysSince(tracking.lastViewedAt, 365);
        let score = (RANDOM_NOTE_EDIT_WEIGHT * Math.log1p(editGapDays))
          + (RANDOM_NOTE_VIEW_WEIGHT * Math.log1p(viewGapDays));
        if (viewGapDays < RANDOM_NOTE_RECENT_VIEW_DAYS) score *= RANDOM_NOTE_RECENT_VIEW_DOWN_WEIGHT;
        candidates.push({
          nodeId: String(node.id || ''),
          title: String(node.title || '未命名笔记'),
          contentMd,
          updatedAt: String(node.updatedAt || ''),
          lastViewedAt: String(tracking.lastViewedAt || ''),
          viewCount: Number(tracking.viewCount || 0),
          editGapDays,
          viewGapDays,
          score: Math.max(0.001, score),
        });
      }
      walk(node.children || []);
    });
  };
  walk(roots);
  return candidates;
}

function getRandomNoteReviewCandidateCount() {
  return _collectRandomNoteCandidates().length;
}

function _pickWeightedIndex(pool) {
  const total = pool.reduce((sum, item) => sum + Math.max(0.001, Number(item.score || 0)), 0);
  if (!Number.isFinite(total) || total <= 0) return Math.floor(Math.random() * pool.length);
  let cursor = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    cursor -= Math.max(0.001, Number(pool[i].score || 0));
    if (cursor <= 0) return i;
  }
  return pool.length - 1;
}

function _buildRandomNoteReviewQueue(excludeNodeId) {
  const source = _collectRandomNoteCandidates().filter(item => item.nodeId && item.nodeId !== String(excludeNodeId || ''));
  const pool = source.slice();
  const queue = [];
  while (pool.length) {
    const idx = _pickWeightedIndex(pool);
    const picked = pool.splice(idx, 1)[0];
    queue.push(picked);
  }
  return queue;
}

function _markRandomNoteViewed(nodeId) {
  if (!nodeId) return;
  noteReviewTracking = noteReviewTracking || {};
  const current = noteReviewTracking[nodeId] || {};
  noteReviewTracking[nodeId] = {
    ...current,
    nodeId,
    lastViewedAt: new Date().toISOString(),
    lastViewedDate: today(),
    lastSource: 'random_note_review',
    lastRandomReviewAt: new Date().toISOString(),
    viewCount: Number(current.viewCount || 0) + 1,
  };
  if (typeof saveNoteReviewTracking === 'function') saveNoteReviewTracking();
}

function _openRandomNoteInWorkspace(nodeId) {
  if (!nodeId) return;
  closeModal('randomNoteReviewModal');
  if (typeof switchAppView === 'function') switchAppView('workspace');
  let attempts = 0;
  const locate = () => {
    attempts += 1;
    if (typeof setCurrentKnowledgeNode === 'function') {
      setCurrentKnowledgeNode(nodeId, { switchTab: true, mode: 'note' });
      return;
    }
    if (attempts >= 25) return;
    setTimeout(locate, 120);
  };
  locate();
}

function _getErrorRecentWrongFlag(errorItem, summary) {
  if (summary && String(summary.lastResult || '') === 'wrong') return 1;
  if (Number(summary && summary.recentWrongCount || 0) > 0) return 1;
  if (String(errorItem && errorItem.lastResult || '') === 'wrong') return 1;
  return 0;
}

function _getErrorWrongCountForPriority(errorItem, summary) {
  const values = [
    Number(summary && summary.recentWrongCount || 0),
    Number(summary && summary.wrongCount || 0),
    Number(errorItem && errorItem.recentWrongCount || 0),
    Number(errorItem && errorItem.wrongCount || 0),
    Number(errorItem && errorItem.quiz && errorItem.quiz.wrongCount || 0),
  ].filter(v => Number.isFinite(v) && v >= 0);
  if (!values.length) return 0;
  return Math.max.apply(null, values);
}

function _getErrorDurationOverTargetRatio(errorItem, summary) {
  const target = Number(errorItem && errorItem.targetDurationSec || 0);
  if (!Number.isFinite(target) || target <= 0) return 0;
  const lastDuration = Number(
    (summary && summary.lastDuration)
    || (errorItem && errorItem.lastDuration)
    || (errorItem && errorItem.actualDurationSec)
    || 0
  );
  if (!Number.isFinite(lastDuration) || lastDuration <= 0) return 0;
  return Math.max(0, Math.min(2, (lastDuration - target) / target));
}

function _computeRandomNotePracticePriority(errorItem) {
  const summary = (typeof getPracticeSummaryForError === 'function') ? getPracticeSummaryForError(errorItem) : null;
  const wrongCount = _getErrorWrongCountForPriority(errorItem, summary);
  const recentWrong = _getErrorRecentWrongFlag(errorItem, summary);
  const durationOverTarget = _getErrorDurationOverTargetRatio(errorItem, summary);
  const score = (0.5 * wrongCount) + (0.3 * recentWrong) + (0.2 * durationOverTarget);
  return { score, wrongCount, recentWrong, durationOverTarget };
}

function _collectErrorsForRandomNotePractice(nodeId) {
  if (!nodeId || typeof getErrorEntries !== 'function') return [];
  const idSet = new Set([String(nodeId)]);
  if (typeof getKnowledgeNodeById === 'function' && typeof getKnowledgeDescendantNodeIds === 'function') {
    const node = getKnowledgeNodeById(nodeId);
    if (node) {
      (getKnowledgeDescendantNodeIds(node) || []).forEach(id => idSet.add(String(id)));
    }
  }
  return getErrorEntries().filter(e => {
    if (!e || !idSet.has(String(e.noteNodeId || ''))) return false;
    if (typeof isEffectivelyMastered === 'function' && isEffectivelyMastered(e)) return false;
    return true;
  });
}

async function startRandomNoteHighValuePractice(limit) {
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  if (!current || !current.nodeId) {
    showToast('当前没有可练习笔记', 'warning');
    return;
  }
  if (typeof hasFullWorkspaceDataLoaded === 'function'
      && typeof ensureFullWorkspaceDataLoaded === 'function'
      && !hasFullWorkspaceDataLoaded()) {
    showToast('正在加载完整错题数据...', 'warning');
    try {
      await ensureFullWorkspaceDataLoaded();
    } catch (e) {
      showToast('错题数据加载失败，请稍后重试', 'error');
      return;
    }
  }
  if (!(await ensureQuizModalReady())) return;
  const maxItems = Math.max(1, Number(limit || 5));
  const pool = _collectErrorsForRandomNotePractice(current.nodeId);
  if (!pool.length) {
    showToast('这条笔记下暂无可练习错题', 'warning');
    return;
  }
  const ranked = pool.map(item => {
    const priority = _computeRandomNotePracticePriority(item);
    return { item, priority };
  }).sort((a, b) => {
    if (b.priority.score !== a.priority.score) return b.priority.score - a.priority.score;
    if (b.priority.wrongCount !== a.priority.wrongCount) return b.priority.wrongCount - a.priority.wrongCount;
    const ta = String(a.item.updatedAt || a.item.lastPracticedAt || '');
    const tb = String(b.item.updatedAt || b.item.lastPracticedAt || '');
    return tb.localeCompare(ta);
  });
  quizQueue = ranked.slice(0, maxItems).map(row => row.item);
  if (!quizQueue.length) {
    showToast('没有可练习题目', 'warning');
    return;
  }
  quizSessionMode = 'note';
  quizIdx = 0;
  quizAnswers = [];
  quizSkipped = new Set();
  document.getElementById('quizTitleText').textContent = `笔记专项练习 · ${current.title} (${quizQueue.length}题)`;
  closeModal('randomNoteReviewModal');
  openModal('quizModal');
  renderQuizQuestion();
}

function ensureRandomNoteReviewModal() {
  let mask = document.getElementById('randomNoteReviewModal');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'randomNoteReviewModal';
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal" style="width:860px;max-width:96vw;max-height:90vh;overflow-y:auto">
      <button class="modal-close" type="button" onclick="closeModal('randomNoteReviewModal')">×</button>
      <h2 style="margin-bottom:6px">随机笔记复习</h2>
      <div style="font-size:12px;color:#888;margin-bottom:12px">按“越久未编辑 + 越久未查看”加权抽取，避免只看熟悉内容。</div>
      <div id="randomNoteReviewBody"></div>
    </div>
  `;
  document.body.appendChild(mask);
  return mask;
}

function renderRandomNoteReview() {
  ensureRandomNoteReviewModal();
  const body = document.getElementById('randomNoteReviewBody');
  if (!body) return;
  if (!randomNoteReviewQueue.length || randomNoteReviewIndex < 0 || randomNoteReviewIndex >= randomNoteReviewQueue.length) {
    body.innerHTML = '<div class="home-note-item"><strong>暂无可复习笔记</strong><span>请先在知识点下补充笔记内容。</span></div>';
    return;
  }
  const item = randomNoteReviewQueue[randomNoteReviewIndex];
  if (!randomNoteReviewSessionSeen.has(item.nodeId)) {
    randomNoteReviewSessionSeen.add(item.nodeId);
    _markRandomNoteViewed(item.nodeId);
  }
  const liveNode = (typeof getKnowledgeNodeById === 'function') ? getKnowledgeNodeById(item.nodeId) : null;
  const liveTracking = (noteReviewTracking && noteReviewTracking[item.nodeId]) || {};
  const liveUpdatedAt = String((liveNode && liveNode.updatedAt) || item.updatedAt || '');
  const liveLastViewedAt = String(liveTracking.lastViewedAt || item.lastViewedAt || '');
  const liveEditGapDays = _daysSince(liveUpdatedAt, null);
  const liveViewGapDays = _daysSince(liveLastViewedAt, null);
  const pathTitles = (typeof getKnowledgePathTitles === 'function') ? getKnowledgePathTitles(item.nodeId) : [item.title];
  const pathText = Array.isArray(pathTitles) ? pathTitles.join(' > ') : String(item.title || '');
  const contentHtml = (typeof renderMd === 'function')
    ? renderMd(item.contentMd, { anchorPrefix: `rnd-note-${escapeAttrStr(item.nodeId)}` })
    : `<pre style="white-space:pre-wrap;line-height:1.8">${escapeHtml(item.contentMd)}</pre>`;
  const editGapText = Number.isFinite(liveEditGapDays) ? _formatGapDays(liveEditGapDays) : '未知';
  const viewGapText = liveLastViewedAt
    ? (Number.isFinite(liveViewGapDays) ? _formatGapDays(liveViewGapDays) : '未知')
    : '从未';
  const whyText = `距上次编辑 ${editGapText}，距上次查看 ${viewGapText}`;
  const canPrev = randomNoteReviewIndex > 0;
  const canNext = randomNoteReviewIndex < randomNoteReviewQueue.length - 1;
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="knowledge-tree-count">${randomNoteReviewIndex + 1} / ${randomNoteReviewQueue.length}</span>
        <span style="font-size:12px;padding:3px 10px;border-radius:999px;background:#fff7e6;color:#ad6800;border:1px solid #ffd591">${escapeHtml(whyText)}</span>
      </div>
      <div style="font-size:12px;color:#888">最后编辑：${escapeHtml(_formatIsoTime(liveUpdatedAt))} · 上次查看：${escapeHtml(liveLastViewedAt ? _formatIsoTime(liveLastViewedAt) : '从未')}</div>
    </div>
    <div class="home-dashboard-card" style="margin-bottom:12px">
      <h3 style="margin-bottom:6px">${escapeHtml(item.title)}</h3>
      <div style="font-size:12px;color:#888;line-height:1.7">${escapeHtml(pathText)}</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:12px;background:#fff;max-height:48vh;overflow:auto;padding:14px;line-height:1.9;font-size:14px">
      ${contentHtml}
    </div>
    <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      <button class="btn btn-secondary" type="button" onclick="randomNoteReviewPrev()" ${canPrev ? '' : 'disabled'}>上一个</button>
      <button class="btn btn-secondary" type="button" onclick="randomNoteReviewNext()" ${canNext ? '' : 'disabled'}>下一个</button>
      <button class="btn btn-secondary" type="button" onclick="randomNoteReviewShuffle()">换一条</button>
      <button class="btn btn-secondary" type="button" onclick="startRandomNoteHighValuePractice(5)">练高价值错题(5题)</button>
      <button class="btn btn-primary" type="button" onclick="openRandomNoteInWorkspace()">打开到知识树</button>
    </div>
  `;
}

function startRandomNoteReview() {
  const queue = _buildRandomNoteReviewQueue('');
  if (!queue.length) {
    showToast('暂无可复习笔记（需要有内容）', 'warning');
    return;
  }
  randomNoteReviewQueue = queue;
  randomNoteReviewIndex = 0;
  randomNoteReviewSessionSeen = new Set();
  ensureRandomNoteReviewModal();
  openModal('randomNoteReviewModal');
  renderRandomNoteReview();
}

function randomNoteReviewPrev() {
  if (randomNoteReviewIndex <= 0) return;
  randomNoteReviewIndex -= 1;
  renderRandomNoteReview();
}

function randomNoteReviewNext() {
  if (randomNoteReviewIndex >= randomNoteReviewQueue.length - 1) return;
  randomNoteReviewIndex += 1;
  renderRandomNoteReview();
}

function randomNoteReviewShuffle() {
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  const nextQueue = _buildRandomNoteReviewQueue(current && current.nodeId);
  if (!nextQueue.length) {
    showToast('没有更多可切换笔记', 'warning');
    return;
  }
  randomNoteReviewQueue = nextQueue;
  randomNoteReviewIndex = 0;
  randomNoteReviewSessionSeen = new Set();
  renderRandomNoteReview();
}

function openRandomNoteInWorkspace() {
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  if (!current || !current.nodeId) return;
  _openRandomNoteInWorkspace(current.nodeId);
}

const __baseStartPracticeQueue = startPracticeQueue;
startPracticeQueue = async function startPracticeQueueWorkflow(mode) {
  const normalizedMode = String(mode || 'daily');
  if (!['note', 'direct', 'speed'].includes(normalizedMode)) {
    return __baseStartPracticeQueue(normalizedMode);
  }
  if (!(await ensureQuizModalReady())) return;

  let serverPayload = null;
  try {
    serverPayload = await fetchJsonWithAuth('/api/practice/daily?limit=12');
  } catch (e) {
    console.warn('workflow practice fallback:', e);
  }

  const localPack = typeof buildPracticeTaskPack === 'function' ? buildPracticeTaskPack(12) : null;
  const serverNoteFirst = buildQuizQueueFromItems(serverPayload && serverPayload.noteFirstQueue);
  const serverDirectDo = buildQuizQueueFromItems(serverPayload && serverPayload.directDoQueue);
  const serverSpeedDrill = buildQuizQueueFromItems(serverPayload && serverPayload.speedDrillQueue);

  if (normalizedMode === 'note') {
    quizQueue = serverNoteFirst.length ? serverNoteFirst : ((localPack && localPack.noteFirstQueue) || (typeof getTaskPackQueueByMode === 'function' ? getTaskPackQueueByMode('note', 12) : []));
  } else if (normalizedMode === 'direct') {
    quizQueue = serverDirectDo.length ? serverDirectDo : ((localPack && localPack.directDoQueue) || (typeof getTaskPackQueueByMode === 'function' ? getTaskPackQueueByMode('direct', 12) : []));
  } else {
    quizQueue = serverSpeedDrill.length ? serverSpeedDrill : ((localPack && localPack.speedDrillQueue) || (typeof getTaskPackQueueByMode === 'function' ? getTaskPackQueueByMode('speed', 12) : []));
  }

  if (!quizQueue.length) {
    return __baseStartPracticeQueue(normalizedMode);
  }

  let title = '今日练习';
  if (normalizedMode === 'note') title = '先看笔记';
  if (normalizedMode === 'direct') title = '直接开做';
  if (normalizedMode === 'speed') title = '限时复训';

  quizSessionMode = normalizedMode;
  quizIdx = 0;
  quizAnswers = [];
  quizSkipped = new Set();
  document.getElementById('quizTitleText').textContent = title;
  openModal('quizModal');
  renderQuizQuestion();
};

window.startPracticeQueue = startPracticeQueue;
window.startRandomNoteReview = startRandomNoteReview;
window.randomNoteReviewPrev = randomNoteReviewPrev;
window.randomNoteReviewNext = randomNoteReviewNext;
window.randomNoteReviewShuffle = randomNoteReviewShuffle;
window.startRandomNoteHighValuePractice = startRandomNoteHighValuePractice;
window.openRandomNoteInWorkspace = openRandomNoteInWorkspace;
window.getRandomNoteReviewCandidateCount = getRandomNoteReviewCandidateCount;
renderQuizQuestion = renderQuizQuestionFenbiMode;
selectQuizAnswer = selectQuizAnswerFenbiMode;
renderQuizReview = renderQuizReviewFenbiMode;
skipQuizQuestion = function skipQuizQuestionWorkflow() {
  const e = quizQueue[quizIdx];
  quizAnswers.push({ id: e.id, userAnswer: 'SKIPPED', correct: false, skipped: true, durationSec: getCurrentQuizElapsedSec() });
  quizSkipped.add(quizIdx);
  quizIdx++;
  if (quizIdx >= quizQueue.length) renderQuizReview();
  else renderQuizQuestion();
};
