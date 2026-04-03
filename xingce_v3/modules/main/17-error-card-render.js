// ============================================================
// 错题卡片渲染
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
  const resultMap = { correct:'做对', wrong:'做错', skipped:'跳过', partial:'部分正确' };
  const bits = [];
  if(summary.lastResult) bits.push(`最近练习：${resultMap[summary.lastResult] || summary.lastResult}`);
  if(summary.lastConfidence) bits.push(`把握度 ${summary.lastConfidence}`);
  if(summary.lastDuration) bits.push(`用时 ${summary.lastDuration}s`);
  if(summary.lastTime) bits.push(`时间 ${formatPracticeSummaryTime(summary.lastTime)}`);
  return bits.join(' · ');
}

function renderPracticeSummaryBlock(summary){
  const metaLine = renderPracticeSummaryMeta(summary);
  if(!metaLine) return '';
  const extras = [];
  if(summary.lastMistakeType) extras.push(`<span class="detail-pill" style="background:#fff7e6;color:#ad6800;border:1px solid #ffd591;font-size:11px">最近错误类型：${escapeHtml(summary.lastMistakeType)}</span>`);
  if(summary.lastTriggerPoint) extras.push(`<span class="detail-pill" style="background:#f6ffed;color:#237804;border:1px solid #b7eb8f;font-size:11px">最近触发点：${escapeHtml(summary.lastTriggerPoint)}</span>`);
  if(summary.lastNextAction) extras.push(`<span class="detail-pill meta-pill">最近动作：${escapeHtml(summary.lastNextAction)}</span>`);
  return `<div class="detail-analysis" style="margin-top:8px;background:#f8fafc;border:1px solid #e2e8f0">
    <strong>最近练习摘要：</strong>${escapeHtml(metaLine)}
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
    if(changed) renderAll();
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
  const resultMap = { correct:'做对', wrong:'做错', skipped:'跳过', partial:'部分正确' };
  const bits = [];
  if(summary.lastResult) bits.push(`最近练习：${resultMap[summary.lastResult] || summary.lastResult}`);
  if(summary.lastConfidence) bits.push(`把握度 ${summary.lastConfidence}`);
  if(summary.lastDuration) bits.push(`用时 ${summary.lastDuration}s`);
  if(summary.lastTime) bits.push(`时间 ${formatPracticeSummaryTime(summary.lastTime)}`);
  return bits.join(' · ');
}

function renderPracticeSummaryBlock(summary){
  const metaLine = renderPracticeSummaryMeta(summary);
  if(!metaLine) return '';
  const extras = [];
  if(summary.lastMistakeType) extras.push(`<span class="detail-pill" style="background:#fff7e6;color:#ad6800;border:1px solid #ffd591;font-size:11px">最近错误类型：${escapeHtml(summary.lastMistakeType)}</span>`);
  if(summary.lastTriggerPoint) extras.push(`<span class="detail-pill" style="background:#f6ffed;color:#237804;border:1px solid #b7eb8f;font-size:11px">最近触发点：${escapeHtml(summary.lastTriggerPoint)}</span>`);
  if(summary.lastNextAction) extras.push(`<span class="detail-pill meta-pill">最近动作：${escapeHtml(summary.lastNextAction)}</span>`);
  return `<div class="detail-analysis" style="margin-top:8px;background:#f8fafc;border:1px solid #e2e8f0">
    <strong>最近练习摘要：</strong>${escapeHtml(metaLine)}
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
    if(changed) renderAll();
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
if (typeof window.openCanvas !== 'function') {
  window.openCanvas = function openCanvas(id) {
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

function renderCard(e){
  normalizeErrorForWorkflow(e);
  const stageMeta = getErrorWorkflowStageMeta(e);
  const opts=e.options?e.options.split(/\n|\|/).map(o=>`<p>${hl(o.trim(),searchKw)}</p>`).join(''):'';  
  const normalizedId = normalizeErrorId(e.id);
  const isRev=revealed.has(normalizedId);
  const idLit = idArg(e.id);
  const noteNodeLit = noteNodeArg(e.noteNodeId || '');
  const practiceSummary = getPracticeSummaryForError(e);
  const practiceSummaryMeta = renderPracticeSummaryMeta(practiceSummary);
  const statusLabel = getErrorStatusLabel(e.status);

  // 复习信息
  let quizInfoStr='';
  if(e.quiz&&e.quiz.reviewCount>0){
    const d=daysBetween(e.quiz.lastReview,today());
    quizInfoStr=`复习${e.quiz.reviewCount}次 · 上次${d===0?'今天':d+'天前'} · 错${e.quiz.wrongCount||0}次`;
    if(e.quiz.nextReview) quizInfoStr+=` · 下次：${e.quiz.nextReview}`;
  }

  // 详情区（点击查看才显示）—— 横向 pill 布局
  let detailHtml='';
  if(isRev){
    const pills=[];
    if(e.myAnswer) pills.push(`<span class="detail-pill wrong-pill">我选 ${escapeHtml(e.myAnswer)} ✗</span>`);
    pills.push(`<span class="detail-pill correct-pill">正确答案 ${escapeHtml(e.answer||'—')} ✓</span>`);
    const _mistakeType = e.mistakeType || e.rootReason || '';
    const _triggerPoint = e.triggerPoint || e.errorReason || '';
    const _correctModel = e.correctModel || e.analysis || '';
    if(_mistakeType){
      pills.push(`<span class="detail-pill" style="background:#fff0f6;color:#c41d7f;border:1px solid #ffadd2;font-size:11px">⚡ 错误类型：${escapeHtml(_mistakeType)}</span>`);
    }
    if(_triggerPoint){
      pills.push(`<span class="detail-pill reason-pill">🎯 触发点：${escapeHtml(_triggerPoint)}</span>`);
    }
    if(e.nextAction){
      pills.push(`<span class="detail-pill meta-pill">➡ 下次动作：${escapeHtml(e.nextAction)}</span>`);
    }
    if(quizInfoStr) pills.push(`<span class="detail-pill meta-pill">${escapeHtml(quizInfoStr)}</span>`);
    if(practiceSummaryMeta) pills.push(`<span class="detail-pill meta-pill">${escapeHtml(practiceSummaryMeta)}</span>`);
    // 错误历史
    const hist='';
    detailHtml=`<div class="card-detail">
      <div class="detail-meta-row">${pills.join('')}</div>
      ${_correctModel?`<div class="detail-analysis"><strong>正确模型：</strong>${renderAnalysis(_correctModel,searchKw)}</div>`:''}
      ${renderPracticeSummaryBlock(practiceSummary)}
      ${e.analysisImgData?`<img src="${escapeHtml(e.analysisImgData)}" class="cuoti-img" onclick="this.classList.toggle('expanded')" title="点击放大/缩小" style="border:1px solid #e0e4ff;margin-top:6px">`:''}
      ${hist}
    </div>`;
  }

  const imgTag = e.imgData ? `<img src="${escapeHtml(e.imgData)}" class="cuoti-img" onclick="this.classList.toggle('expanded')" title="点击放大/缩小">` : '';
  const processImageTag = renderProcessImagePreview(e, 'card');
  const noteArea = isRev ? `<div class="card-note-area">
    <div class="card-note-label">📝 我的笔记</div>
    <textarea class="card-note-ta" placeholder="添加笔记..." onblur='saveCardNote(${idLit},this.value)'>${escapeHtml(e.note||'')}</textarea>
  </div>` : '';
  // 内联做题区渲染
  const iqState = inlineQuizState[normalizedId];
  let iqHtml = '';
  if (iqState) {
    const opts2 = e.options ? e.options.split(/\n|\|/).map(o=>o.trim()).filter(Boolean) : [];
    if (!iqState.answered) {
      const optBtns = opts2.length
        ? opts2.map((o,i)=>{
            const letter=String.fromCharCode(65+i);
            return `<button class="iq-opt" id="iqopt_${e.id}_${letter}" onclick='selectInlineAnswer(${idLit},"${letter}")'>${escapeHtml(o)}</button>`;
          }).join('')
        : ['A','B','C','D'].map(l=>`<button class="iq-opt" id="iqopt_${e.id}_${l}" onclick='selectInlineAnswer(${idLit},"${l}")' style="text-align:center;font-weight:700">${l}</button>`).join('');
      iqHtml = `<div class="iq-area">
        <div class="iq-hint">📝 选择你的答案：</div>
        <div class="iq-opts">${optBtns}</div>
        <div class="iq-actions">
          <button class="btn btn-sm btn-secondary" onclick='closeInlineQuiz(${idLit})'>取消</button>
        </div>
      </div>`;
    } else {
      const cls = iqState.correct ? 'ok' : 'fail';
      const icon = iqState.correct ? '✅' : '❌';
      const anaHtml = e.analysis ? `<div style="margin-top:6px;font-size:12px;color:#555;padding:6px 10px;background:#f6f8ff;border-radius:6px;border-left:3px solid #4e8ef7">${renderAnalysis(e.analysis)}</div>` : '';
      iqHtml = `<div class="iq-area">
        <div class="iq-result ${cls}">${icon} 你选了 <strong>${escapeHtml(iqState.userAnswer)}</strong>，正确答案 <strong>${escapeHtml(e.answer||'—')}</strong></div>
        ${anaHtml}
        <div class="iq-actions" style="margin-top:8px">
          <button class="btn btn-sm btn-primary" onclick='saveInlineResult(${idLit})'>💾 保存记录</button>
          <button class="btn btn-sm btn-secondary" onclick='closeInlineQuiz(${idLit})'>关闭</button>
        </div>
      </div>`;
    }
  }

  // 难度星显示
  const diff = e.difficulty || 0;
  const starHtml = `<span class="star-disp" title="点击修改难度">${[1,2,3].map(i=>`<span class="s${i<=diff?' on':''}" onclick='setCardDifficulty(${idLit},${i},event)'>★</span>`).join('')}</span>`;
  // 批量复选框
  const cbHtml = batchMode ? `<input type="checkbox" class="batch-cb" id="bcb_${e.id}" ${batchSelected.has(e.id)?'checked':''} onclick='toggleBatchSelect(${idLit},event)'>` : '';

  return `<div class="error-card" id="card-${e.id}" ${isRev?`onmouseleave='collapseCard(${idLit})'`:''} >
    ${cbHtml}
    <div class="card-top">
      <span class="card-num">#${e.id}</span>
      <span class="status-tag ${normalizeErrorStatusValue(e.status)}">${escapeHtml(statusLabel)}</span>
      ${e.subSubtype?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f0f5ff;color:#4e8ef7">${escapeHtml(e.subSubtype)}</span>`:''}
      ${starHtml}
      ${(e.srcYear||e.srcProvince||e.srcOrigin)?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f6ffed;color:#52c41a;border:1px solid #b7eb8f" title="出处">📌 ${[e.srcYear,e.srcProvince,e.srcOrigin].filter(Boolean).join(' · ')}</span>`:''}
      ${e.addDate?`<span style="font-size:11px;color:#999">${e.addDate}</span>`:''}
      ${practiceSummaryMeta?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#ecfeff;color:#155e75;border:1px solid #a5f3fc" title="最近练习">🧾 ${escapeHtml(practiceSummaryMeta)}</span>`:''}
      <span style="font-size:11px;padding:1px 7px;border-radius:8px;background:${stageMeta.bg};color:${stageMeta.color};border:1px solid ${stageMeta.border}" title="阶段状态">阶段：${escapeHtml(stageMeta.shortLabel)}</span>
      ${practiceSummaryMeta?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#ecfeff;color:#155e75;border:1px solid #a5f3fc" title="最近练习">🧾 ${escapeHtml(practiceSummaryMeta)}</span>`:''}
      <span class="card-drag-handle" title="拖到左侧知识点可改挂载" draggable="true" ondragstart='startErrorDrag(${idLit}, event)' ondragend="endErrorDrag()" onclick="event.preventDefault();event.stopPropagation()">⋮⋮ 拖挂载</span>
    </div>
    <div class="card-question">${hl(e.question,searchKw)}</div>
    ${imgTag}
    ${processImageTag}
    ${opts?`<div class="card-options">${opts}</div>`:''}
    ${isRev ? detailHtml+noteArea : ''}
    <button class="card-reveal-btn" onclick='revealCard(${idLit})' style="${isRev?'color:#bbb;border-color:#eee;font-size:11px;margin-top:6px':''}">
      ${isRev ? '▲ 收起' : '👁 查看答案与解析'}
    </button>
    ${iqHtml}
    <div class="card-actions">
      <button class="btn btn-sm btn-secondary" onclick='openKnowledgeForError(${idLit})'>知识点</button>
      <button class="btn btn-sm btn-secondary" onclick='moveErrorToKnowledgeNode(${idLit}, ${noteNodeLit})'>改挂载</button>
      <select class="status-select" onchange='updateStatus(${idLit},this.value)'>
        <option value="focus" ${normalizeErrorStatusValue(e.status)==='focus'?'selected':''}>重点复习</option>
        <option value="review" ${normalizeErrorStatusValue(e.status)==='review'?'selected':''}>待复习</option>
        <option value="mastered" ${normalizeErrorStatusValue(e.status)==='mastered'?'selected':''}>已掌握</option>
      </select>
      ${(()=>{
        const ml=e.masteryLevel||'not_mastered';
        const cfg={not_mastered:{label:'未掌握',color:'#ff7875',bg:'#fff2f0',border:'#ffa39e'},fuzzy:{label:'模糊',color:'#fa8c16',bg:'#fff7e6',border:'#ffd591'},mastered:{label:'已掌握',color:'#52c41a',bg:'#f6ffed',border:'#b7eb8f'}};
        const c=cfg[ml]||cfg.not_mastered;
        return `<button class="btn btn-sm" style="color:${c.color};background:${c.bg};border:1px solid ${c.border}" onclick='cyclemastery(${idLit})' title="点击切换掌握状态">◎ ${c.label}</button>`;
      })()}
      <button class="btn btn-sm btn-secondary" onclick='openCanvas(${idLit})'>画布</button>
      <button class="btn btn-sm btn-secondary" onclick='openProcessImageEditor(${idLit},"card")'>&#36807;&#31243;&#22270;</button>
      <button class="btn btn-sm btn-secondary" onclick='openEditModal(${idLit})'>✏ 编辑</button>
      <button class="btn btn-sm btn-secondary" style="color:#4e8ef7;border-color:#adc6ff" onclick='startInlineQuiz(${idLit})'>📝 做题</button>
      <button class="del-btn del-btn-danger" onclick='deleteError(${idLit})'>🗑 删除</button>
    </div>
  </div>`;
}

window.renderCard = renderCard;

function revealCard(id){
  const targetId = normalizeErrorId(id);
  if(revealed.has(targetId)) revealed.delete(targetId);
  else {
    revealed.add(targetId);
    // 展开时高亮右侧面板对应章节
    const e = findErrorById(targetId);
    if (e) highlightNoteChapter(e.type, e.subtype, e.subSubtype);
  }
  saveReveal();renderAll();
}
function collapseCard(id){
  const targetId = normalizeErrorId(id);
  // 先把笔记 textarea 的内容存下来（mouseleave 时 blur 可能还没触发）
  const ta=document.querySelector('#card-'+targetId+' .card-note-ta');
  if(ta) saveCardNote(targetId,ta.value);
  revealed.delete(targetId);saveReveal();renderAll();
  // 强制刷新图片，避免某些浏览器缓存导致不显示
  setTimeout(() => {
    const el = document.getElementById('card-' + targetId);
    if (el) {
      const img = el.querySelector('.cuoti-img');
      if (img && img.src) img.src = img.src; // 触发重载
    }
  }, 50);
}
function saveCardNote(id, val) {
  const e=findErrorById(id);if(!e)return;
  e.note=val;
  touchErrorUpdatedAt(e);
  recordErrorUpsert(e);
  refreshWorkspaceAfterErrorMutation({ save:true });
}
function updateStatus(id,s){ const e=findErrorById(id); if(!e) return; e.status = normalizeErrorStatusValue(s); if(e.status === 'mastered') e.masteryLevel = 'mastered'; if(e.status !== 'mastered' && normalizeMasteryLevelValue(e.masteryLevel) === 'mastered') e.masteryLevel = 'fuzzy'; touchErrorUpdatedAt(e); recordErrorUpsert(e); refreshWorkspaceAfterErrorMutation({ save:true }); }
function cyclemastery(id){
  const e=findErrorById(id);if(!e)return;
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
  if(!confirm(`确认删除 #${targetId}？`))return;
  errors=errors.filter(e=>normalizeErrorId(e.id)!==targetId);revealed.delete(targetId);
  refreshWorkspaceAfterErrorMutation({ save:true, reveal:true, syncNotes:true });
}
function clearAllData(){
  if(!errors.length){showToast('当前没有可清空的数据', 'warning');return;}
  if(!confirm(`确认清空全部 ${errors.length} 条？`))return;
  errors=[];revealed=new Set();
  saveData();saveReveal();
  renderSidebar();renderAll();
}
