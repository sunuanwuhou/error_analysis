
(function(){
  const STATUS_OPTIONS = [
    { value: 'solved', label: '会做' },
    { value: 'hesitant', label: '犹豫' },
    { value: 'guessed', label: '蒙的' },
    { value: 'stuck', label: '卡住' },
  ];
  let timer = null;
  let attemptDrafts = {};
  let attemptsCache = [];

  function q(){ return window.quizQueue?.[window.quizIdx] || null; }
  function nowIso(){ return new Date().toISOString(); }
  function secondsSince(start){
    if(!start) return 0;
    const ts = new Date(start).getTime();
    if(!Number.isFinite(ts)) return 0;
    return Math.max(0, Math.round((Date.now() - ts) / 1000));
  }
  function stopTimer(){ if(timer){ clearInterval(timer); timer = null; } }
  function formatDuration(sec){ sec = Math.max(0, Number(sec)||0); const m = Math.floor(sec/60); const s = sec % 60; return `${m}:${String(s).padStart(2,'0')}`; }
  function normalizeId(v){ return v == null ? '' : String(v); }
  function getCurrentDraft(){
    const item = q();
    if(!item) return null;
    const key = normalizeId(item.id || item.questionId || window.quizIdx);
    if(!attemptDrafts[key]){
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
  function syncDraftFromUi(){
    const draft = getCurrentDraft();
    if(!draft) return null;
    const noteEl = document.getElementById('quizSolvingNote');
    draft.solvingNote = noteEl ? noteEl.value.trim() : (draft.solvingNote || '');
    draft.updatedAt = nowIso();
    const item = q();
    if(item && typeof window.getProcessImageUrl === 'function'){
      draft.scratchData = draft.scratchData || {};
      draft.scratchData.processImageUrl = window.getProcessImageUrl(item) || '';
    }
    return draft;
  }
  function startQuestionTimer(){
    stopTimer();
    const tick = () => {
      const draft = getCurrentDraft();
      const el = document.getElementById('quizAttemptTimer');
      if(el && draft) el.textContent = formatDuration(secondsSince(draft.startedAt));
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  function setStatusTag(value){
    const draft = syncDraftFromUi();
    if(!draft) return;
    draft.statusTag = value;
    document.querySelectorAll('[data-quiz-status]').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-quiz-status') === value));
  }
  function setConfidence(value){
    const draft = syncDraftFromUi();
    if(!draft) return;
    draft.confidence = Number(value) || 0;
    document.querySelectorAll('[data-quiz-confidence]').forEach(btn => btn.classList.toggle('active', Number(btn.getAttribute('data-quiz-confidence')) === draft.confidence));
  }
  function injectAttemptPanel(){
    const content = document.getElementById('quizContent');
    const bottom = content?.querySelector('.quiz-bottom-row');
    if(!content || !bottom || document.getElementById('quizAttemptPanel')) return;
    const draft = getCurrentDraft();
    if(!draft) return;
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
          ${STATUS_OPTIONS.map(opt => `<button type="button" class="quiz-attempt-chip ${draft.statusTag===opt.value?'active':''}" data-quiz-status="${opt.value}">${opt.label}</button>`).join('')}
        </div>
      </div>
      <div class="quiz-attempt-row">
        <span class="quiz-attempt-label">把握度</span>
        <div class="quiz-attempt-chip-wrap">
          ${[1,2,3,4,5].map(n => `<button type="button" class="quiz-attempt-chip ${draft.confidence===n?'active':''}" data-quiz-confidence="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="quiz-attempt-row" style="align-items:flex-start">
        <span class="quiz-attempt-label">备注</span>
        <textarea id="quizSolvingNote" class="quiz-attempt-note" placeholder="简记当时思路、卡点、为什么犹豫"></textarea>
      </div>
    `;
    bottom.parentNode.insertBefore(panel, bottom);
    document.querySelectorAll('[data-quiz-status]').forEach(btn => btn.addEventListener('click', ()=>setStatusTag(btn.getAttribute('data-quiz-status'))));
    document.querySelectorAll('[data-quiz-confidence]').forEach(btn => btn.addEventListener('click', ()=>setConfidence(btn.getAttribute('data-quiz-confidence'))));
    const noteEl = document.getElementById('quizSolvingNote');
    if(noteEl){ noteEl.value = draft.solvingNote || ''; noteEl.addEventListener('input', syncDraftFromUi); }
    startQuestionTimer();
  }
  function finalizeAttempt(answer, result){
    const draft = syncDraftFromUi();
    if(!draft) return null;
    stopTimer();
    draft.myAnswer = answer || '';
    draft.result = result || '';
    draft.durationSec = secondsSince(draft.startedAt);
    draft.updatedAt = nowIso();
    return JSON.parse(JSON.stringify(draft));
  }
  function resetAttemptState(){ stopTimer(); attemptDrafts = {}; }

  function decorateReview(){
    const answers = Array.isArray(window.quizAnswers) ? window.quizAnswers : [];
    const cards = document.querySelectorAll('#quizContent .quiz-review-item');
    cards.forEach((card, idx) => {
      const a = answers[idx];
      if(!a || !a.attempt || card.querySelector('.quiz-attempt-summary')) return;
      const at = a.attempt;
      const extra = document.createElement('div');
      extra.className = 'quiz-attempt-summary';
      extra.innerHTML = `
        <div class="quiz-attempt-summary-line">⏱ ${formatDuration(at.durationSec || 0)} · 状态：${window.escapeHtml ? escapeHtml(at.statusTag || '未标记') : (at.statusTag || '未标记')} · 把握度：${at.confidence || 0}</div>
        ${at.solvingNote ? `<div class="quiz-attempt-summary-note">📝 ${window.escapeHtml ? escapeHtml(at.solvingNote) : at.solvingNote}</div>` : ''}
        ${(!a.correct || a.skipped) ? `<div class="quiz-attempt-review-actions"><button class="btn btn-sm btn-secondary" onclick="openAttemptClosure(${idx})">补结构化错因/知识点</button></div>` : ''}
      `;
      card.appendChild(extra);
    });
  }


  function prefillModalFromAttempt(answer){
    const at = answer?.attempt || null;
    const item = answer || q() || {};
    if(typeof window.openAddModal !== 'function') return;
    window.openAddModal();
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
    setVal('editType', item.type || at?.type || '其他');
    if(typeof window.updateSubtypeOptions === 'function') window.updateSubtypeOptions();
    setVal('editSubtype', item.subtype || at?.subtype || '');
    setVal('editSubSubtype', item.subSubtype || at?.subSubtype || '');
    setVal('editQuestion', item.question || at?.questionText || '');
    setVal('editOptions', String(item.options || '').replace(/\n/g,'|'));
    setVal('editAnswer', item.answer || at?.correctAnswer || '');
    setVal('editMyAnswer', answer?.myAnswer || at?.myAnswer || '');
    setVal('editRootReason', at?.meta?.mistakeType || '');
    setVal('editErrorReason', at?.meta?.triggerPoint || '');
    setVal('editAnalysis', at?.meta?.correctModel || '');
    setVal('editNextAction', at?.meta?.nextAction || '');
    if(typeof window.refreshKnowledgePicker === 'function') window.refreshKnowledgePicker(item.noteNodeId || at?.noteNodeId || '');
    window.__pendingAttemptLink = {
      attemptId: at?.id || '',
      sourceAnswerId: answer?.id || '',
      sourceQuestionId: at?.questionId || item.id || ''
    };
    const banner = document.getElementById('entryFlowBanner');
    if(banner){
      banner.style.display = 'block';
      banner.textContent = '当前正在补全：做题记录 → 结构化错因 → 知识点绑定';
    }
  }

  function openAttemptClosure(reviewIndex){
    const answers = Array.isArray(window.quizAnswers) ? window.quizAnswers : [];
    const answer = answers[Number(reviewIndex)] || null;
    if(!answer) return;
    if(answer.id && typeof window.openEditModal === 'function'){
      window.__pendingAttemptLink = { attemptId: answer.attempt?.id || '', sourceAnswerId: answer.id || '', sourceQuestionId: answer.attempt?.questionId || answer.id || '' };
      window.openEditModal(answer.id);
      const banner = document.getElementById('entryFlowBanner');
      if(banner){ banner.style.display='block'; banner.textContent='当前正在补全：做题记录 → 结构化错因 → 知识点绑定'; }
      return;
    }
    prefillModalFromAttempt(answer);
  }

  async function syncAttemptLinkAfterSave(payload){
    if(!payload || !payload.attemptId) { window.__pendingAttemptLink = null; return; }
    const idx = attemptsCache.findIndex(it => String(it.id) === String(payload.attemptId));
    const base = idx >= 0 ? attemptsCache[idx] : null;
    const meta = Object.assign({}, base?.meta || {}, {
      mistakeType: payload.mistakeType || '',
      triggerPoint: payload.triggerPoint || '',
      correctModel: payload.correctModel || '',
      nextAction: payload.nextAction || '',
      closureDone: true
    });
    const item = Object.assign({}, base || {}, {
      id: payload.attemptId,
      updatedAt: new Date().toISOString(),
      errorId: payload.errorId || base?.errorId || '',
      noteNodeId: payload.noteNodeId || base?.noteNodeId || '',
      meta
    });
    await saveAttemptsBatch([item]);
    if(payload.errorId && typeof window.invalidatePracticeAttemptSummaries === 'function'){
      window.invalidatePracticeAttemptSummaries([payload.errorId]);
    }
    window.__pendingAttemptLink = null;
  }

  async function saveAttemptsBatch(items){
    if(!items || !items.length) return;
    try{
      const res = await window.fetchJsonWithAuth('/api/practice/attempts/batch', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ items })
      });
      attemptsCache = Array.isArray(res.items) ? res.items.concat(attemptsCache).slice(0, 400) : attemptsCache;
      const touchedErrorIds = (Array.isArray(items) ? items : []).map(it => String(it && it.errorId || '').trim()).filter(Boolean);
      if(touchedErrorIds.length && typeof window.invalidatePracticeAttemptSummaries === 'function'){
        window.invalidatePracticeAttemptSummaries(touchedErrorIds);
      }
      if(typeof window.invalidatePracticeWorkbench === 'function'){
        window.invalidatePracticeWorkbench();
      }
      if(typeof window.renderHomeDashboard === 'function' && (window.currentAppView === 'home' || document.getElementById('homeView')?.classList.contains('active'))){
        window.renderHomeDashboard();
      }
    }catch(e){
      console.warn('save attempts failed:', e);
      window.showToast && showToast('做题记录同步失败，已保留在本地会话', 'warning');
    }
  }

  async function loadAttempts(limit){
    const data = await window.fetchJsonWithAuth(`/api/practice/attempts?limit=${encodeURIComponent(limit || 120)}`);
    attemptsCache = Array.isArray(data.items) ? data.items : [];
    return attemptsCache;
  }

  function ensureAttemptsModal(){
    let mask = document.getElementById('practiceAttemptsModal');
    if(mask) return mask;
    mask = document.createElement('div');
    mask.id = 'practiceAttemptsModal';
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="width:980px;max-width:96vw;max-height:92vh;overflow:auto">
        <button class="modal-close" type="button" onclick="closeModal('practiceAttemptsModal')">✕</button>
        <h2 style="margin-bottom:8px">做题记录</h2>
        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
          <div id="practiceAttemptsMeta" style="font-size:12px;color:#64748b">加载中...</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="refreshPracticeAttemptsModal()">刷新</button>
            <button class="btn btn-secondary btn-sm" onclick="exportPracticeAttemptsJson()">导出 JSON</button>
          </div>
        </div>
        <div id="practiceAttemptsList"></div>
      </div>`;
    document.body.appendChild(mask);
    return mask;
  }
  function renderAttemptsModal(items){
    const list = document.getElementById('practiceAttemptsList');
    const meta = document.getElementById('practiceAttemptsMeta');
    if(!list || !meta) return;
    const arr = Array.isArray(items) ? items : [];
    const avg = arr.length ? Math.round(arr.reduce((s,it)=>s+(Number(it.durationSec)||0),0)/arr.length) : 0;
    meta.textContent = `共 ${arr.length} 条 · 平均用时 ${formatDuration(avg)}`;
    if(!arr.length){ list.innerHTML = '<div style="padding:18px;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b">暂无做题记录</div>'; return; }
    list.innerHTML = arr.map(it => `
      <div class="attempt-card">
        <div class="attempt-card-head">
          <div><strong>${window.escapeHtml ? escapeHtml(it.type || '未分类') : (it.type || '未分类')}</strong>${it.subtype ? ` · <span>${window.escapeHtml ? escapeHtml(it.subtype) : it.subtype}</span>` : ''}</div>
          <div style="font-size:12px;color:#64748b">${window.escapeHtml ? escapeHtml(it.createdAt || '') : (it.createdAt || '')}</div>
        </div>
        <div class="attempt-card-question">${window.escapeHtml ? escapeHtml(it.questionText || '') : (it.questionText || '')}</div>
        <div class="attempt-card-meta">结果：${window.escapeHtml ? escapeHtml(it.result || '') : (it.result || '')} · 我答：${window.escapeHtml ? escapeHtml(it.myAnswer || '—') : (it.myAnswer || '—')} · 正确：${window.escapeHtml ? escapeHtml(it.correctAnswer || '—') : (it.correctAnswer || '—')} · 用时：${formatDuration(it.durationSec || 0)}</div>
        <div class="attempt-card-meta">状态：${window.escapeHtml ? escapeHtml(it.statusTag || '未标记') : (it.statusTag || '未标记')} · 把握度：${it.confidence || 0}</div>
        ${(it.meta && (it.meta.mistakeType || it.meta.triggerPoint || it.meta.correctModel)) ? `<div class="attempt-card-meta">错误类型：${window.escapeHtml ? escapeHtml(it.meta.mistakeType || '—') : (it.meta.mistakeType || '—')} · 触发点：${window.escapeHtml ? escapeHtml(it.meta.triggerPoint || '—') : (it.meta.triggerPoint || '—')}</div>` : `<div class="attempt-card-meta" style="color:#b45309">⚠ 尚未补全结构化错因</div>`}
        ${it.solvingNote ? `<div class="attempt-card-note">📝 ${window.escapeHtml ? escapeHtml(it.solvingNote) : it.solvingNote}</div>` : ''}
      </div>`).join('');
  }
  async function openPracticeAttemptsModal(){
    ensureAttemptsModal();
    openModal('practiceAttemptsModal');
    try{ renderAttemptsModal(await loadAttempts(120)); }catch(e){
      document.getElementById('practiceAttemptsMeta').textContent = e.message || '加载失败';
      document.getElementById('practiceAttemptsList').innerHTML = `<div style="padding:18px;border:1px dashed #fecaca;border-radius:12px;color:#b91c1c">${window.escapeHtml ? escapeHtml(String(e.message || e)) : String(e.message || e)}</div>`;
    }
  }
  async function refreshPracticeAttemptsModal(){
    try{ renderAttemptsModal(await loadAttempts(120)); }catch(e){ window.showToast && showToast(e.message || '刷新失败', 'error'); }
  }
  async function exportPracticeAttemptsJson(){
    try{
      const items = attemptsCache.length ? attemptsCache : await loadAttempts(500);
      const blob = new Blob([JSON.stringify(items, null, 2)], {type:'application/json;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `practice_attempts_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    }catch(e){ window.showToast && showToast(e.message || '导出失败', 'error'); }
  }

  function injectSidebarEntry(){
    return;
  }

  function simplifyChrome(){
    document.getElementById('codexInboxBtn')?.remove();
    document.querySelectorAll('#moreMenuPanel .btn').forEach(btn => {
      const text = (btn.textContent || '').trim();
      if(/Codex|Claude|AI/.test(text)) btn.remove();
    });
    const more = document.getElementById('moreMenuPanel');
    if(more){
      const order = ['导入错题','导出','统计'];
      Array.from(more.querySelectorAll('.btn')).sort((a,b)=>{
        const ta=(a.textContent||'').trim(), tb=(b.textContent||'').trim();
        const ia=order.findIndex(k=>ta.includes(k)); const ib=order.findIndex(k=>tb.includes(k));
        return (ia<0?99:ia) - (ib<0?99:ib);
      }).forEach(btn=>more.appendChild(btn));
    }
    const quizBtn = document.getElementById('quizBtn'); if(quizBtn){ quizBtn.querySelector('span')?.replaceChildren('📝 今日训练'); }
  }

  function patchFunctions(){
    if(typeof window.renderQuizQuestion === 'function' && !window.__patchedRenderQuizQuestion){
      const original = window.renderQuizQuestion;
      window.renderQuizQuestion = function(){
        const out = original.apply(this, arguments);
        injectAttemptPanel();
        return out;
      };
      window.__patchedRenderQuizQuestion = true;
    }
    if(typeof window.startQuiz === 'function' && !window.__patchedStartQuiz){
      const original = window.startQuiz;
      window.startQuiz = async function(){ resetAttemptState(); return await original.apply(this, arguments); };
      window.__patchedStartQuiz = true;
    }
    if(typeof window.startFullPractice === 'function' && !window.__patchedStartFull){
      const original = window.startFullPractice;
      window.startFullPractice = function(){ resetAttemptState(); return original.apply(this, arguments); };
      window.__patchedStartFull = true;
    }
    if(typeof window.selectQuizAnswer === 'function' && !window.__patchedSelectQuizAnswer){
      const original = window.selectQuizAnswer;
      window.selectQuizAnswer = function(letter){
        const item = q();
        const correct = item && item.answer ? String(item.answer).trim().toUpperCase() : '';
        const isRight = letter===correct || letter==='✓' || (letter!=='✗' && letter===correct);
        const attempt = finalizeAttempt(letter, isRight ? 'correct' : 'wrong');
        const out = original.apply(this, arguments);
        const last = window.quizAnswers && window.quizAnswers[window.quizAnswers.length-1];
        if(last && attempt) last.attempt = attempt;
        return out;
      };
      window.__patchedSelectQuizAnswer = true;
    }
    if(typeof window.skipQuizQuestion === 'function' && !window.__patchedSkipQuiz){
      const original = window.skipQuizQuestion;
      window.skipQuizQuestion = function(){
        const attempt = finalizeAttempt('—', 'skipped');
        const out = original.apply(this, arguments);
        const last = window.quizAnswers && window.quizAnswers[window.quizAnswers.length-1];
        if(last && attempt) last.attempt = attempt;
        return out;
      };
      window.__patchedSkipQuiz = true;
    }
    if(typeof window.renderQuizReview === 'function' && !window.__patchedRenderQuizReview){
      const original = window.renderQuizReview;
      window.renderQuizReview = function(){ const out = original.apply(this, arguments); decorateReview(); return out; };
      window.__patchedRenderQuizReview = true;
    }
    if(typeof window.saveQuizResults === 'function' && !window.__patchedSaveQuizResults){
      const original = window.saveQuizResults;
      window.saveQuizResults = async function(){
        const attempts = (Array.isArray(window.quizAnswers) ? window.quizAnswers : []).map(a => a && a.attempt).filter(Boolean);
        await saveAttemptsBatch(attempts);
        return await original.apply(this, arguments);
      };
      window.__patchedSaveQuizResults = true;
    }
    if(typeof window.closeQuizModal === 'function' && !window.__patchedCloseQuiz){
      const original = window.closeQuizModal;
      window.closeQuizModal = function(force){ if(force) resetAttemptState(); return original.apply(this, arguments); };
      window.__patchedCloseQuiz = true;
    }
  }

  function init(){
    patchFunctions();
    injectSidebarEntry();
    simplifyChrome();
    window.setQuizStatusTag = setStatusTag;
    window.setQuizConfidence = setConfidence;
    window.openPracticeAttemptsModal = openPracticeAttemptsModal;
    window.refreshPracticeAttemptsModal = refreshPracticeAttemptsModal;
    window.exportPracticeAttemptsJson = exportPracticeAttemptsJson;
    window.openAttemptClosure = openAttemptClosure;
    window.syncAttemptLinkAfterSave = syncAttemptLinkAfterSave;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
