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
    correct: 'Correct',
    wrong: 'Wrong',
    skipped: 'Skipped',
    partial: 'Partial'
  };
  const bits = [];
  if(summary.lastResult) bits.push(`Last ${resultMap[summary.lastResult] || summary.lastResult}`);
  if(summary.lastConfidence) bits.push(`Confidence ${summary.lastConfidence}`);
  if(summary.lastDuration) bits.push(`Last ${summary.lastDuration}s`);
  if(summary.avgDuration) bits.push(`Avg ${summary.avgDuration}s`);
  if(summary.lastTime) bits.push(formatPracticeSummaryTime(summary.lastTime));
  return bits.join(' / ');
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
    let changed = false;
    ids.forEach(id => {
      const prevRaw = Object.prototype.hasOwnProperty.call(practiceAttemptSummaryByErrorId, id) ? practiceAttemptSummaryByErrorId[id] : null;
      const nextRaw = Object.prototype.hasOwnProperty.call(next, id) ? next[id] : null;
      if(JSON.stringify(prevRaw) !== JSON.stringify(nextRaw)) changed = true;
      if(nextRaw) practiceAttemptSummaryByErrorId[id] = nextRaw;
      else practiceAttemptSummaryByErrorId[id] = null;
    });
    if(changed && typeof renderAll === 'function') renderAll();
  }catch(err){
    console.warn('load practice attempt summaries failed', err);
  }finally{
    if(practiceAttemptSummaryRequestKey === requestKey) practiceAttemptSummaryLoading = false;
  }
}

function queueVisiblePracticeSummaryLoad(list){
  const ids = (list || []).map(e => normalizeErrorId(e && e.id)).filter(Boolean);
  if(!ids.length) return;
  const missing = ids.filter(id => !Object.prototype.hasOwnProperty.call(practiceAttemptSummaryByErrorId, id));
  if(!missing.length) return;
  fetchPracticeAttemptSummariesForErrors(ids);
}

function invalidatePracticeAttemptSummaries(errorIds){
  const ids = Array.from(new Set((errorIds || []).map(id => normalizeErrorId(id)).filter(Boolean)));
  if(!ids.length) return;
  ids.forEach(id => { delete practiceAttemptSummaryByErrorId[id]; });
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
  const practiceSummaryMeta = renderPracticeSummaryMeta(getPracticeSummaryForError(e));
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
      <span class="card-num">#${e.id}</span>
      <span class="status-tag ${normalizeErrorStatusValue(e.status)}">${escapeHtml(statusLabel)}</span>
      ${e.subSubtype?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f0f5ff;color:#4e8ef7">${escapeHtml(e.subSubtype)}</span>`:''}
      ${knowledgePathText?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(knowledgePathText)}">${escapeHtml(knowledgePathText)}</span>`:''}
      ${starHtml}
      ${e.problemType && e.problemType !== 'unknown' ? `<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe">${escapeHtml(problemTypeLabel)}</span>` : ''}
      <span style="font-size:11px;padding:1px 7px;border-radius:8px;background:${stageMeta.bg};color:${stageMeta.color};border:1px solid ${stageMeta.border}">Stage ${escapeHtml(stageMeta.shortLabel)}</span>
      ${practiceSummaryMeta?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#ecfeff;color:#155e75;border:1px solid #a5f3fc">${escapeHtml(practiceSummaryMeta)}</span>`:''}
      <span class="card-drag-handle" title="drag to change node" draggable="true" ondragstart='startErrorDrag(${idLit}, event)' ondragend="endErrorDrag()" onclick="event.preventDefault();event.stopPropagation()">⋮⋯ Move</span>
    </div>
    <div class="card-question-surface">
      <div class="card-question">${hl(e.question,searchKw)}</div>
      ${imgTag}
      ${processImageTag}
      ${opts ? `<div class="card-options">${opts}</div>` : ''}
    </div>
    ${isRev ? `<div class="card-lower-panel" data-error-id="${escapeHtml(normalizedId)}"><div class="card-detail-skeleton">Loading details...</div></div>` : ''}
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
    if (e) highlightNoteChapter(e.type, e.subtype, e.subSubtype);
  }
  saveReveal();
  renderAll();
}

function collapseCard(id){
  const targetId = normalizeErrorId(id);
  const ta=document.querySelector(`#card-${targetId} .card-note-ta`);
  if(ta) saveCardNote(targetId,ta.value);
  revealed.delete(targetId);
  saveReveal();
  renderAll();
}

function saveCardNote(id, val) {
  const e=findErrorById(id);
  if(!e) return;
  e.note=val;
  touchErrorUpdatedAt(e);
  recordErrorUpsert(e);
  refreshWorkspaceAfterErrorMutation({ save:true });
}

function updateStatus(id,s){
  const e=findErrorById(id);
  if(!e) return;
  e.status = normalizeErrorStatusValue(s);
  if(e.status === 'mastered') e.masteryLevel = 'mastered';
  if(e.status !== 'mastered' && normalizeMasteryLevelValue(e.masteryLevel) === 'mastered') e.masteryLevel = 'fuzzy';
  touchErrorUpdatedAt(e);
  recordErrorUpsert(e);
  refreshWorkspaceAfterErrorMutation({ save:true });
}

function updateWorkflowStage(id, stage) {
  const e = findErrorById(id);
  if (!e) return;
  e.workflowStage = normalizeWorkflowStageValue(stage);
  if (e.workflowStage === 'mastered') {
    e.status = 'mastered';
    e.masteryLevel = 'mastered';
  } else if (normalizeErrorStatusValue(e.status) === 'mastered') {
    e.status = 'review';
    if (normalizeMasteryLevelValue(e.masteryLevel) === 'mastered') e.masteryLevel = 'fuzzy';
  }
  touchErrorUpdatedAt(e);
  recordErrorUpsert(e);
  refreshWorkspaceAfterErrorMutation({ save:true });
}

function cyclemastery(id){
  const e=findErrorById(id);
  if(!e) return;
  const cycle={not_mastered:'fuzzy',fuzzy:'mastered',mastered:'not_mastered'};
  e.masteryLevel=cycle[normalizeMasteryLevelValue(e.masteryLevel)]||'not_mastered';
  e.masteryUpdatedAt=new Date().toISOString();
  if(e.masteryLevel==='mastered') e.status='mastered';
  else if(normalizeErrorStatusValue(e.status)==='mastered') e.status='review';
  touchErrorUpdatedAt(e);
  recordErrorUpsert(e);
  refreshWorkspaceAfterErrorMutation({ save:true });
}

function deleteError(id){
  const targetId = normalizeErrorId(id);
  if(!confirm(`Delete #${targetId}?`)) return;
  errors = errors.filter(e=>normalizeErrorId(e.id)!==targetId);
  revealed.delete(targetId);
  refreshWorkspaceAfterErrorMutation({ save:true, reveal:true, syncNotes:true });
}

function clearAllData(){
  if(!errors.length){
    showToast('No data to clear', 'warning');
    return;
  }
  if(!confirm(`Clear all ${errors.length} items?`)) return;
  errors = [];
  revealed = new Set();
  saveData();
  saveReveal();
  renderSidebar();
  renderAll();
}
