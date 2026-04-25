// ============================================================
// Error card rendering
// ============================================================

function getPracticeSummaryForError(errorLike){
  const errorId = normalizeErrorId(errorLike && errorLike.id);
  if(errorId && practiceAttemptSummaryByErrorId && practiceAttemptSummaryByErrorId[errorId]) return practiceAttemptSummaryByErrorId[errorId];
  const questionId = String((errorLike && errorLike.id) || '').trim();
  if(questionId && practiceAttemptSummaryByErrorId && practiceAttemptSummaryByErrorId[questionId]) return practiceAttemptSummaryByErrorId[questionId];
  return null;
}

function formatPracticeSummaryTime(raw){
  if(!raw) return '';
  const d = new Date(raw);
  if(Number.isNaN(d.getTime())) return String(raw);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const dateText = sameYear ? `${d.getMonth()+1}/${d.getDate()}` : `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  return `${dateText} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function renderPracticeSummaryMeta(summary){
  if(!summary) return '';
  const resultMap = {
    correct: '正确',
    wrong: '错误',
    skipped: '跳过',
    partial: '部分正确'
  };
  const bits = [];
  if(summary.lastResult) bits.push(`最近结果 ${resultMap[summary.lastResult] || summary.lastResult}`);
  if(Number(summary.recentWrongCount || 0) > 0) bits.push(`错 ${Number(summary.recentWrongCount)} 次`);
  if(summary.lastConfidence) bits.push(`信心 ${summary.lastConfidence}`);
  if(summary.lastDuration) bits.push(`上次用时 ${formatDurationSecondsLabel(summary.lastDuration) || `${summary.lastDuration}秒`}`);
  if(summary.avgDuration) bits.push(`平均用时 ${formatDurationSecondsLabel(summary.avgDuration) || `${summary.avgDuration}秒`}`);
  if(summary.lastTime) bits.push(formatPracticeSummaryTime(summary.lastTime));
  return bits.join(' / ');
}

function formatDurationSecondsLabel(raw){
  const seconds = Number(raw || 0);
  if(!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  if(total < 60) return `${total}秒`;
  const mins = Math.floor(total / 60);
  const remain = total % 60;
  return remain ? `${mins}分${remain}秒` : `${mins}分钟`;
}

function getErrorWrongCount(errorItem, summary){
  const summaryWrong = Number(summary && (summary.recentWrongCount ?? summary.wrongCount ?? 0));
  const quizWrong = Number(errorItem && errorItem.quiz && errorItem.quiz.wrongCount);
  const directWrong = Number(errorItem && (errorItem.recentWrongCount ?? errorItem.wrongCount));
  const values = [summaryWrong, quizWrong, directWrong].filter(v => Number.isFinite(v) && v >= 0).map(v => Math.floor(v));
  if(!values.length) return 0;
  return Math.max.apply(null, values);
}

function getRecentDurationSeconds(errorItem, summary){
  const summarySeconds = Number(summary && summary.lastDuration);
  if(Number.isFinite(summarySeconds) && summarySeconds > 0) return summarySeconds;
  const actualSeconds = Number(errorItem && errorItem.actualDurationSec);
  if(Number.isFinite(actualSeconds) && actualSeconds > 0) return actualSeconds;
  const legacySeconds = Number(errorItem && errorItem.lastDuration);
  if(Number.isFinite(legacySeconds) && legacySeconds > 0) return legacySeconds;
  return 0;
}

function getTargetDurationSeconds(errorItem){
  const targetSeconds = Number(errorItem && errorItem.targetDurationSec);
  if(Number.isFinite(targetSeconds) && targetSeconds > 0) return targetSeconds;
  return 0;
}

function renderCardPracticeMetaChips(errorItem, summary){
  const practiceSummary = summary || getPracticeSummaryForError(errorItem);
  let practiceSummaryMeta = renderPracticeSummaryMeta(practiceSummary);
  const wrongCount = getErrorWrongCount(errorItem, practiceSummary);
  const recentDurationSec = getRecentDurationSeconds(errorItem, practiceSummary);
  const targetDurationSec = getTargetDurationSeconds(errorItem);
  if(!practiceSummaryMeta && wrongCount > 0) practiceSummaryMeta = `Wrong x${wrongCount}`;
  const chips = [];
  chips.push(`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#fff1f2;color:#be123c;border:1px solid #fecdd3">错 ${wrongCount} 次</span>`);
  if (recentDurationSec > 0) {
    chips.push(`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0">最近用时 ${escapeHtml(formatDurationSecondsLabel(recentDurationSec) || `${Math.round(recentDurationSec)}秒`)}</span>`);
  }
  if (targetDurationSec > 0) {
    chips.push(`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe">预计用时 ${escapeHtml(formatDurationSecondsLabel(targetDurationSec) || `${Math.round(targetDurationSec)}秒`)}</span>`);
  }
  if (practiceSummaryMeta) {
    chips.push(`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#ecfeff;color:#155e75;border:1px solid #a5f3fc">${escapeHtml(practiceSummaryMeta)}</span>`);
  }
  return chips.join('');
}

function refreshRenderedPracticeSummaryUi(errorIds){
  const ids = Array.from(new Set((errorIds || []).map(id => normalizeErrorId(id)).filter(Boolean)));
  if(!ids.length) return 0;
  let touched = 0;
  ids.forEach(id => {
    const errorItem = findErrorById(id);
    if (!errorItem) return;
    const card = document.getElementById(`card-${id}`);
    if (!card) return;
    const practiceMetaHost = card.querySelector('.card-practice-meta');
    if (practiceMetaHost) {
      practiceMetaHost.innerHTML = renderCardPracticeMetaChips(errorItem);
      touched += 1;
    }
    const lowerPanel = card.querySelector('.card-lower-panel');
    if (lowerPanel && revealed.has(id)) {
      lowerPanel.innerHTML = buildCardLowerPanelHtml(errorItem, searchKw);
      lowerPanel.dataset.hydrated = 'true';
      touched += 1;
    }
  });
  return touched;
}

function renderPracticeSummaryBlock(summary){
  const metaLine = renderPracticeSummaryMeta(summary);
  if(!metaLine) return '';
  const extras = [];
  if(summary.lastMistakeType){
    extras.push(`<span class="detail-pill" style="background:#fff7e6;color:#ad6800;border:1px solid #ffd591;font-size:11px">Mistake ${escapeHtml(summary.lastMistakeType)}</span>`);
  }
  if(summary.lastTriggerPoint){
    extras.push(`<span class="detail-pill" style="background:#f6ffed;color:#237804;border:1px solid #b7eb8f;font-size:11px">Trigger ${escapeHtml(summary.lastTriggerPoint)}</span>`);
  }
  if(summary.lastNextAction){
    extras.push(`<span class="detail-pill meta-pill">Next ${escapeHtml(summary.lastNextAction)}</span>`);
  }
  return `<div class="detail-analysis" style="margin-top:8px;background:#f8fafc;border:1px solid #e2e8f0">
    <strong>Practice summary:</strong> ${escapeHtml(metaLine)}
    ${extras.length ? `<div class="detail-meta-row" style="margin-top:8px">${extras.join('')}</div>` : ''}
  </div>`;
}

const practiceSummaryPendingIds = new Set();
let practiceSummaryBatchTimer = 0;

function flushPracticeSummaryBatchLoad(){
  practiceSummaryBatchTimer = 0;
  if (practiceAttemptSummaryLoading) return;
  const ids = Array.from(practiceSummaryPendingIds);
  practiceSummaryPendingIds.clear();
  if (!ids.length) return;
  fetchPracticeAttemptSummariesForErrors(ids);
}

async function fetchPracticeAttemptSummariesForErrors(errorIds){
  const ids = Array.from(new Set((errorIds || []).map(id => normalizeErrorId(id)).filter(Boolean)));
  if(!ids.length || typeof fetchJsonWithAuth !== 'function') return;
  const requestKey = ids.join(',');
  if(practiceAttemptSummaryLoading && practiceAttemptSummaryRequestKey === requestKey) return;
  practiceAttemptSummaryLoading = true;
  practiceAttemptSummaryRequestKey = requestKey;
  try{
    const data = await fetchJsonWithAuth(`/api/practice/attempts/summary?error_ids=${encodeURIComponent(requestKey)}`);
    const next = (data && data.items && typeof data.items === 'object') ? data.items : {};
    const changedIds = [];
    ids.forEach(id => {
      const prevRaw = Object.prototype.hasOwnProperty.call(practiceAttemptSummaryByErrorId, id) ? practiceAttemptSummaryByErrorId[id] : null;
      const nextRaw = Object.prototype.hasOwnProperty.call(next, id) ? next[id] : null;
      if(JSON.stringify(prevRaw) !== JSON.stringify(nextRaw)) changedIds.push(id);
      if(nextRaw) practiceAttemptSummaryByErrorId[id] = nextRaw;
      else practiceAttemptSummaryByErrorId[id] = null;
    });
    if(changedIds.length){
      const patched = refreshRenderedPracticeSummaryUi(changedIds);
      if (!patched) {
        if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:false });
        else if (typeof renderAll === 'function') renderAll();
      }
    }
  }catch(err){
    console.warn('load practice attempt summaries failed', err);
  }finally{
    if(practiceAttemptSummaryRequestKey === requestKey) practiceAttemptSummaryLoading = false;
    if (!practiceAttemptSummaryLoading && practiceSummaryPendingIds.size > 0 && !practiceSummaryBatchTimer) {
      practiceSummaryBatchTimer = setTimeout(flushPracticeSummaryBatchLoad, 40);
    }
  }
}

function queueVisiblePracticeSummaryLoad(list){
  const ids = (list || []).map(e => normalizeErrorId(e && e.id)).filter(Boolean);
  if(!ids.length) return;
  const missing = ids.filter(id => !Object.prototype.hasOwnProperty.call(practiceAttemptSummaryByErrorId, id));
  if(!missing.length) return;
  missing.forEach(id => practiceSummaryPendingIds.add(id));
  if (practiceSummaryBatchTimer) return;
  practiceSummaryBatchTimer = setTimeout(flushPracticeSummaryBatchLoad, 80);
}

function invalidatePracticeAttemptSummaries(errorIds){
  const ids = Array.from(new Set((errorIds || []).map(id => normalizeErrorId(id)).filter(Boolean)));
  if(!ids.length) return;
  ids.forEach(id => {
    delete practiceAttemptSummaryByErrorId[id];
    practiceSummaryPendingIds.delete(id);
  });
  practiceAttemptSummaryRequestKey = '';
}

window.queueVisiblePracticeSummaryLoad = queueVisiblePracticeSummaryLoad;
window.invalidatePracticeAttemptSummaries = invalidatePracticeAttemptSummaries;

function buildCardLowerPanelHtml(e, searchKeyword){
  const problemTypeLabelMap = {
    cognition: 'Cognition',
    execution: 'Execution',
    mixed: 'Mixed',
    unknown: 'Observe'
  };
  const nextActionLabelMap = {
    review_note: 'Read note',
    retrain: 'Retrain',
    mixed_train: 'Note then train',
    observe: 'Observe'
  };
  const pills = [];
  const practiceSummary = getPracticeSummaryForError(e);
  const problemTypeLabel = problemTypeLabelMap[e.problemType] || 'Observe';
  const nextActionTypeLabel = nextActionLabelMap[e.nextActionType] || '';

  if(e.myAnswer) pills.push(`<span class="detail-pill wrong-pill">Mine ${escapeHtml(e.myAnswer)}</span>`);
  pills.push(`<span class="detail-pill correct-pill">Answer ${escapeHtml(e.answer || '-')}</span>`);
  if(Number(e.actualDurationSec) > 0 || Number(e.targetDurationSec) > 0){
    const durationBits = [];
    if(Number(e.actualDurationSec) > 0) durationBits.push(`Now ${Number(e.actualDurationSec)}s`);
    if(Number(e.targetDurationSec) > 0) durationBits.push(`Target ${Number(e.targetDurationSec)}s`);
    pills.push(`<span class="detail-pill meta-pill">${escapeHtml(durationBits.join(' / '))}</span>`);
  }
  if(e.problemType && e.problemType !== 'unknown') pills.push(`<span class="detail-pill meta-pill">${escapeHtml(problemTypeLabel)}</span>`);
  if(Number(e.confidence || 0) > 0) pills.push(`<span class="detail-pill meta-pill">Confidence ${escapeHtml(String(e.confidence))}/5</span>`);
  if(nextActionTypeLabel) pills.push(`<span class="detail-pill meta-pill">Next ${escapeHtml(nextActionTypeLabel)}</span>`);
  if(e.tip || e.nextAction) pills.push(`<span class="detail-pill meta-pill">Tip ${escapeHtml(e.tip || e.nextAction || '')}</span>`);

  return `<div class="card-detail">
    <div class="detail-meta-row">${pills.join('')}</div>
    ${e.analysis ? `<div class="detail-analysis"><strong>Analysis:</strong>${renderAnalysis(e.analysis, searchKeyword)}</div>` : ''}
    ${(e.tip || e.nextAction) ? `<div class="detail-analysis"><strong>Tip:</strong>${renderAnalysis(e.tip || e.nextAction, searchKeyword)}</div>` : ''}
    ${renderPracticeSummaryBlock(practiceSummary)}
    ${e.analysisImgData ? `<img src="${escapeHtml(e.analysisImgData)}" class="cuoti-img" loading="lazy" decoding="async" onclick="this.classList.toggle('expanded')" title="toggle zoom" style="border:1px solid #e0e4ff;margin-top:6px">` : ''}
  </div>
  <div class="card-note-area">
    <div class="card-note-label">Note</div>
    <textarea class="card-note-ta" placeholder="Add note..." onblur='saveCardNote(${idArg(e.id)},this.value)'>${escapeHtml(e.note || '')}</textarea>
  </div>`;
}

function hydrateRenderedErrorCardDetails(list){
  const expanded = (list || []).filter(item => revealed.has(normalizeErrorId(item && item.id)));
  if(!expanded.length) return;
  const run = () => {
    expanded.forEach(item => {
      const host = document.querySelector(`#card-${normalizeErrorId(item.id)} .card-lower-panel`);
      if(!host || host.dataset.hydrated === 'true') return;
      host.innerHTML = buildCardLowerPanelHtml(item, searchKw);
      host.dataset.hydrated = 'true';
    });
  };
  if(typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 300 });
  else setTimeout(run, 0);
}

window.hydrateRenderedErrorCardDetails = hydrateRenderedErrorCardDetails;

if (typeof window.openCanvas !== 'function') {
  window.openCanvas = function openCanvas(){
    let canvas = document.getElementById('canvas-layer');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'canvas-layer';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '9999';
      canvas.style.background = 'rgba(0,0,0,0.1)';
      document.body.appendChild(canvas);
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    let drawing = false;
    canvas.onmousedown = () => { drawing = true; };
    canvas.onmouseup = () => { drawing = false; };
    canvas.onmouseleave = () => { drawing = false; };
    canvas.onmousemove = (e) => {
      if (!drawing) return;
      ctx.fillRect(e.clientX, e.clientY, 4, 4);
    };
    window.onkeydown = (e) => {
      if (e.key === 'Escape') canvas.remove();
    };
  };
}

function renderInlineQuizArea(e, normalizedId, idLit){
  const iqState = inlineQuizState[normalizedId];
  if(!iqState) return '';
  const opts = e.options ? e.options.split(/\n|\|/).map(o=>o.trim()).filter(Boolean) : [];
  if(!iqState.answered){
    const optBtns = opts.length
      ? opts.map((o,i)=>{
          const letter=String.fromCharCode(65+i);
          return `<button class="iq-opt" id="iqopt_${e.id}_${letter}" onclick='selectInlineAnswer(${idLit},"${letter}")'>${escapeHtml(o)}</button>`;
        }).join('')
      : ['A','B','C','D'].map(l=>`<button class="iq-opt" id="iqopt_${e.id}_${l}" onclick='selectInlineAnswer(${idLit},"${l}")' style="text-align:center;font-weight:700">${l}</button>`).join('');
    return `<div class="iq-area">
      <div class="iq-hint">Select your answer</div>
      <div class="iq-opts">${optBtns}</div>
      <div class="iq-actions">
        <button class="btn btn-sm btn-secondary" onclick='closeInlineQuiz(${idLit})'>Cancel</button>
      </div>
    </div>`;
  }
  const cls = iqState.correct ? 'ok' : 'fail';
  const icon = iqState.correct ? '✓' : '✕';
  const anaHtml = e.analysis ? `<div style="margin-top:6px;font-size:12px;color:#555;padding:6px 10px;background:#f6f8ff;border-radius:6px;border-left:3px solid #4e8ef7">${renderAnalysis(e.analysis)}</div>` : '';
  return `<div class="iq-area">
    <div class="iq-result ${cls}">${icon} Mine <strong>${escapeHtml(iqState.userAnswer)}</strong>, answer <strong>${escapeHtml(e.answer || '-')}</strong></div>
    ${anaHtml}
    <div class="iq-actions" style="margin-top:8px">
      <button class="btn btn-sm btn-primary" onclick='saveInlineResult(${idLit})'>Save</button>
      <button class="btn btn-sm btn-secondary" onclick='closeInlineQuiz(${idLit})'>Close</button>
    </div>
  </div>`;
}

function renderCard(e){
  normalizeErrorForWorkflow(e);
  const stageMeta = getErrorWorkflowStageMeta(e);
  const problemTypeLabelMap = {
    cognition:'Cognition',
    execution:'Execution',
    mixed:'Mixed',
    unknown:'Observe'
  };
  const workflowStageOptions = [
    { value:'captured', label:'Captured' },
    { value:'diagnosing', label:'Diagnose' },
    { value:'review_ready', label:'Review' },
    { value:'retrain_due', label:'Retrain' },
    { value:'mastered', label:'Mastered' }
  ];
  const normalizedId = normalizeErrorId(e.id);
  const isRev = revealed.has(normalizedId);
  const idLit = idArg(e.id);
  const noteNodeLit = noteNodeArg(e.noteNodeId || '');
  const practiceSummary = getPracticeSummaryForError(e);
  const statusLabel = getErrorStatusLabel(e.status);
  const problemTypeLabel = problemTypeLabelMap[e.problemType] || 'Observe';
  const knowledgePathText = typeof getErrorKnowledgePathText === 'function'
    ? getErrorKnowledgePathText(e)
    : [e.type, e.subtype, e.subSubtype].filter(Boolean).join(' > ');
  const opts = e.options ? e.options.split(/\n|\|/).map(o => `<p>${hl(o.trim(),searchKw)}</p>`).join('') : '';
  const imgTag = e.imgData ? `<img src="${escapeHtml(e.imgData)}" class="cuoti-img" loading="lazy" decoding="async" onclick="this.classList.toggle('expanded')" title="toggle zoom">` : '';
  const processImageTag = renderProcessImagePreview(e, 'card');
  const diff = e.difficulty || 0;
  const starHtml = `<span class="star-disp" title="change difficulty">${[1,2,3].map(i=>`<span class="s${i<=diff?' on':''}" onclick='setCardDifficulty(${idLit},${i},event)'>★</span>`).join('')}</span>`;
  const cbHtml = batchMode ? `<input type="checkbox" class="batch-cb" id="bcb_${e.id}" ${batchSelected.has(e.id)?'checked':''} onclick='toggleBatchSelect(${idLit},event)'>` : '';
  const inlineQuizHtml = renderInlineQuizArea(e, normalizedId, idLit);

  return `<div class="error-card" id="card-${e.id}" ${isRev?`onmouseleave='collapseCard(${idLit})'`:''}>
    ${cbHtml}
    <div class="card-top">
      <span class="status-tag ${normalizeErrorStatusValue(e.status)}">${escapeHtml(statusLabel)}</span>
      ${e.subSubtype?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f0f5ff;color:#4e8ef7">${escapeHtml(e.subSubtype)}</span>`:''}
      ${knowledgePathText?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(knowledgePathText)}">${escapeHtml(knowledgePathText)}</span>`:''}
      ${starHtml}
      ${e.problemType && e.problemType !== 'unknown' ? `<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe">${escapeHtml(problemTypeLabel)}</span>` : ''}
      <span style="font-size:11px;padding:1px 7px;border-radius:8px;background:${stageMeta.bg};color:${stageMeta.color};border:1px solid ${stageMeta.border}">Stage ${escapeHtml(stageMeta.shortLabel)}</span>
      <span class="card-practice-meta">${renderCardPracticeMetaChips(e, practiceSummary)}</span>
      <span class="card-drag-handle" title="drag to change node" draggable="true" ondragstart='startErrorDrag(${idLit}, event)' ondragend="endErrorDrag()" onclick="event.preventDefault();event.stopPropagation()">⋮⋯ Move</span>
    </div>
    <div class="card-question-surface">
      <div class="card-question">${hl(e.question,searchKw)}</div>
      ${imgTag}
      ${processImageTag}
      ${opts ? `<div class="card-options">${opts}</div>` : ''}
    </div>
    ${isRev ? `<div class="card-lower-panel" data-error-id="${escapeHtml(normalizedId)}" data-hydrated="true">${buildCardLowerPanelHtml(e, searchKw)}</div>` : ''}
    <button class="card-reveal-btn" onclick='revealCard(${idLit})' style="${isRev?'color:#bbb;border-color:#eee;font-size:11px;margin-top:6px':''}">${isRev ? 'Collapse' : 'View details'}</button>
    ${inlineQuizHtml}
    <div class="card-actions card-actions-soft">
      <button class="btn btn-sm btn-secondary" onclick='moveErrorToKnowledgeNode(${idLit}, ${noteNodeLit})'>Move</button>
      <select class="status-select" onchange='updateStatus(${idLit},this.value)'>
        <option value="focus" ${normalizeErrorStatusValue(e.status)==='focus'?'selected':''}>Focus</option>
        <option value="review" ${normalizeErrorStatusValue(e.status)==='review'?'selected':''}>Review</option>
        <option value="mastered" ${normalizeErrorStatusValue(e.status)==='mastered'?'selected':''}>Mastered</option>
      </select>
      <select class="status-select" onchange='updateWorkflowStage(${idLit},this.value)' title="workflow stage">
        ${workflowStageOptions.map(item => `<option value="${item.value}" ${String(e.workflowStage||'')===item.value?'selected':''}>${item.label}</option>`).join('')}
      </select>
      ${(()=>{
        const ml=e.masteryLevel||'not_mastered';
        const cfg={
          not_mastered:{label:'Not mastered',color:'#ff7875',bg:'#fff2f0',border:'#ffa39e'},
          fuzzy:{label:'Fuzzy',color:'#fa8c16',bg:'#fff7e6',border:'#ffd591'},
          mastered:{label:'Mastered',color:'#52c41a',bg:'#f6ffed',border:'#b7eb8f'}
        };
        const c=cfg[ml]||cfg.not_mastered;
        return `<button class="btn btn-sm" style="color:${c.color};background:${c.bg};border:1px solid ${c.border}" onclick='cyclemastery(${idLit})' title="toggle mastery">● ${c.label}</button>`;
      })()}
      <button class="btn btn-sm btn-secondary" onclick='copyErrorMarkdown(${idLit})'>复制MD</button>
      <button class="btn btn-sm btn-secondary" onclick='openEditModal(${idLit})'>Edit</button>
      <button class="btn btn-sm btn-secondary" style="color:#4e8ef7;border-color:#adc6ff" onclick='startInlineQuiz(${idLit})'>Quiz</button>
      <button class="del-btn del-btn-danger" onclick='deleteError(${idLit})'>Delete</button>
    </div>
  </div>`;
}

window.renderCard = renderCard;

function revealCard(id){
  const targetId = normalizeErrorId(id);
  if(revealed.has(targetId)) revealed.delete(targetId);
  else {
    revealed.add(targetId);
    const e = findErrorById(targetId);
    if (e) {
      const nodeId = typeof resolveErrorKnowledgeNodeId === 'function'
        ? resolveErrorKnowledgeNodeId(e)
        : String(e.noteNodeId || '').trim();
      if (nodeId) {
        const target = document.querySelector(`[data-knowledge-node-id="${nodeId}"] .note-panel-item-header`);
        if (target) {
          document.querySelectorAll('.note-panel-item-header').forEach(el => el.classList.remove('note-chapter-highlight'));
          target.classList.add('note-chapter-highlight');
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }
  saveReveal();
  if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:false });
  else renderAll();
}

function collapseCard(id){
  const targetId = normalizeErrorId(id);
  const ta=document.querySelector(`#card-${targetId} .card-note-ta`);
  if(ta) saveCardNote(targetId,ta.value);
  revealed.delete(targetId);
  saveReveal();
  if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar:false });
  else renderAll();
}

window.revealCard = revealCard;
window.collapseCard = collapseCard;

