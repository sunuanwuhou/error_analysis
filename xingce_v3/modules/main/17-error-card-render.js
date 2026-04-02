// ============================================================
// 错题卡片渲染
// ============================================================
function renderCard(e){
  const statusMap={focus:'重点复习',review:'待复习',mastered:'已掌握'};
  const opts=e.options?e.options.split(/\n|\|/).map(o=>`<p>${hl(o.trim(),searchKw)}</p>`).join(''):'';  
  const normalizedId = normalizeErrorId(e.id);
  const isRev=revealed.has(normalizedId);
  const idLit = idArg(e.id);
  const noteNodeLit = noteNodeArg(e.noteNodeId || '');

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
    // 错误历史
    const hist='';
    detailHtml=`<div class="card-detail">
      <div class="detail-meta-row">${pills.join('')}</div>
      ${_correctModel?`<div class="detail-analysis"><strong>正确模型：</strong>${renderAnalysis(_correctModel,searchKw)}</div>`:''}
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
      <span class="status-tag ${e.status}">${statusMap[e.status]||e.status}</span>
      ${e.subSubtype?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f0f5ff;color:#4e8ef7">${escapeHtml(e.subSubtype)}</span>`:''}
      ${starHtml}
      ${(e.srcYear||e.srcProvince||e.srcOrigin)?`<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f6ffed;color:#52c41a;border:1px solid #b7eb8f" title="出处">📌 ${[e.srcYear,e.srcProvince,e.srcOrigin].filter(Boolean).join(' · ')}</span>`:''}
      ${e.addDate?`<span style="font-size:11px;color:#999">${e.addDate}</span>`:''}
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
        <option value="focus" ${e.status==='focus'?'selected':''}>重点复习</option>
        <option value="review" ${e.status==='review'?'selected':''}>待复习</option>
        <option value="mastered" ${e.status==='mastered'?'selected':''}>已掌握</option>
      </select>
      ${(()=>{
        const ml=e.masteryLevel||'not_mastered';
        const cfg={not_mastered:{label:'未掌握',color:'#ff7875',bg:'#fff2f0',border:'#ffa39e'},fuzzy:{label:'模糊',color:'#fa8c16',bg:'#fff7e6',border:'#ffd591'},mastered:{label:'已掌握',color:'#52c41a',bg:'#f6ffed',border:'#b7eb8f'}};
        const c=cfg[ml]||cfg.not_mastered;
        return `<button class="btn btn-sm" style="color:${c.color};background:${c.bg};border:1px solid ${c.border}" onclick='cyclemastery(${idLit})' title="点击切换掌握状态">◎ ${c.label}</button>`;
      })()}
      <button class="btn btn-sm btn-secondary" onclick='openProcessImageEditor(${idLit},"card")'>&#36807;&#31243;&#22270;</button>
      <button class="btn btn-sm btn-secondary" onclick='openEditModal(${idLit})'>✏ 编辑</button>
      <button class="btn btn-sm btn-secondary" style="color:#4e8ef7;border-color:#adc6ff" onclick='startInlineQuiz(${idLit})'>📝 做题</button>
      <button class="del-btn del-btn-danger" onclick='deleteError(${idLit})'>🗑 删除</button>
    </div>
  </div>`;
}

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
  e.updatedAt=new Date().toISOString();
  recordErrorUpsert(e);
  saveData();
}
function updateStatus(id,s){ const e=findErrorById(id);if(e){e.status=s;e.updatedAt=new Date().toISOString();recordErrorUpsert(e);saveData();renderSidebar();renderAll();} }
function cyclemastery(id){
  const e=findErrorById(id);if(!e)return;
  const cycle={not_mastered:'fuzzy',fuzzy:'mastered',mastered:'not_mastered'};
  e.masteryLevel=cycle[e.masteryLevel||'not_mastered']||'not_mastered';
  e.masteryUpdatedAt=new Date().toISOString();
  e.updatedAt=new Date().toISOString();
  recordErrorUpsert(e);
  saveData();renderAll();
}
function deleteError(id){
  const targetId = normalizeErrorId(id);
  if(!confirm(`确认删除 #${targetId}？`))return;
  errors=errors.filter(e=>normalizeErrorId(e.id)!==targetId);revealed.delete(targetId);
  saveData();saveReveal();renderSidebar();renderAll();
  syncNotesWithErrors(); // 同步笔记与错题
}
function clearAllData(){
  if(!errors.length){showToast('当前没有可清空的数据', 'warning');return;}
  if(!confirm(`确认清空全部 ${errors.length} 条？`))return;
  errors=[];revealed=new Set();
  saveData();saveReveal();
  renderSidebar();renderAll();
}
