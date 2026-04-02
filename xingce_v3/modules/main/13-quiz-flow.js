// ============================================================
// 答题流程（新版：选项点击 → 全部完成 → 批量回顾 → 保存）
// ============================================================
async function startQuiz() {
  let serverItems = [];
  try{
    const data = await fetchJsonWithAuth('/api/practice/daily?limit=12');
    serverItems = data.items || [];
  }catch(e){
    console.warn('daily practice fallback:', e);
  }
  quizQueue = serverItems.length
    ? serverItems.map(item => ({ ...findErrorById(item.id), ...item })).filter(isErrorEntry)
    : getDueList();
  if (!quizQueue.length) { showToast('今日暂无需要复习的题目', 'warning'); return; }
  quizSessionMode = 'daily';
  quizIdx = 0; quizAnswers = []; quizSkipped = new Set();
  document.getElementById('quizTitleText').textContent = '📝 今日复习';
  openModal('quizModal');
  renderQuizQuestion();
}

function startFullPractice() {
  const all = getErrorEntries().filter(e => e.status !== 'mastered');
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
  const selected=new Set();
  document.querySelectorAll('.cf-sub:checked').forEach(cb=>{
    selected.add(cb.getAttribute('data-type')+'::::'+(cb.getAttribute('data-sub')||'未分类'));
  });
  if(!selected.size){showToast('请至少选择一个章节', 'warning');return;}
  quizQueue = getErrorEntries().filter(e=>{
    if(e.status==='mastered') return false;
    const key=e.type+'::::'+(e.subtype||'未分类');
    return selected.has(key);
  }).slice().sort((a,b)=>{
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

function renderQuizQuestion() {
  const total = quizQueue.length;
  document.getElementById('quizProgress').textContent = `${quizIdx+1} / ${total}`;
  document.getElementById('quizProgFill').style.width = `${(quizIdx/total)*100}%`;
  const e = quizQueue[quizIdx];
  const idLit = idArg(e.id);
  const opts = e.options ? e.options.split(/\n|\|/).map(o=>o.trim()).filter(Boolean) : [];
  const optBtns = opts.map((o,i) => {
    const letter = String.fromCharCode(65+i);
    return `<button class="quiz-opt-btn" id="qopt_${letter}" onclick="selectQuizAnswer('${letter}')">${escapeHtml(o)}</button>`;
  }).join('');
  const chapterTag = `<div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap">
    <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#f0f5ff;color:#4e8ef7;font-weight:600">${escapeHtml(e.type||'')}</span>
    ${e.subtype?`<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#f5f5f5;color:#888">${escapeHtml(e.subtype)}</span>`:''}
  </div>`;
  const imgTag = e.imgData ? `<img src="${escapeHtml(e.imgData)}" class="cuoti-img" onclick="this.classList.toggle('expanded')" title="点击放大/缩小" style="margin-bottom:10px">` : '';
  const processImageTag = renderProcessImagePreview(e, 'quiz');
  document.getElementById('quizContent').innerHTML = `
    ${chapterTag}
    <div class="quiz-question-box">${escapeHtml(e.question)}</div>
    ${imgTag}
    ${processImageTag}
    <div class="quiz-opt-grid">${optBtns || (e.imgData ? '' : '<p style="color:#aaa;font-size:13px">（无选项，直接点下方判断）</p>')}</div>
    ${!opts.length ? (e.imgData ? `
      <div class="quiz-opt-grid">
        ${['A','B','C','D'].map(l=>`<button class="quiz-opt-btn" id="qopt_${l}" onclick="selectQuizAnswer('${l}')" style="text-align:center;font-size:16px;font-weight:700">${l}</button>`).join('')}
      </div>` : `
      <div style="display:flex;gap:12px">
        <button class="quiz-opt-btn" style="flex:1;text-align:center;border-color:#52c41a;color:#52c41a" onclick="selectQuizAnswer('✓')">✅ 答对了</button>
        <button class="quiz-opt-btn" style="flex:1;text-align:center;border-color:#e74c3c;color:#e74c3c" onclick="selectQuizAnswer('✗')">❌ 答错了</button>
      </div>`) : ''}
    <div class="quiz-bottom-row">
      <button class="quiz-skip-btn" type="button" onclick='openProcessImageEditor(${idLit},"quiz")' style="background:#fff7ed;color:#c2410c;border-color:#fdba74">&#36807;&#31243;&#22270;</button>
      <button class="quiz-skip-btn" id="quizSkipBtn" onclick="skipQuizQuestion()">跳过 ⏭</button>
      <button class="quiz-next-btn" id="quizNextBtn" onclick="nextQuizQuestion()" style="display:none;flex:1">
        ${quizIdx+1 < quizQueue.length ? '下一题 →' : '查看结果 →'}
      </button>
    </div>`;
}

function selectQuizAnswer(letter) {
  // 禁止重复点击
  document.querySelectorAll('.quiz-opt-btn').forEach(b=>b.disabled=true);
  const e = quizQueue[quizIdx];
  const correct = e.answer ? e.answer.trim().toUpperCase() : '';
  const isRight = letter===correct || letter==='✓' || (letter!=='✗' && letter===correct);
  // 标记选中和正确
  const selBtn = document.getElementById('qopt_'+letter);
  if (selBtn) selBtn.classList.add(isRight ? 'correct' : 'wrong');
  if (!isRight && correct) {
    const corrBtn = document.getElementById('qopt_'+correct);
    if (corrBtn) corrBtn.classList.add('correct');
  }
  quizAnswers.push({id:e.id, userAnswer:letter, correct:isRight, skipped:false});
  const skipBtn = document.getElementById('quizSkipBtn');
  if(skipBtn) skipBtn.style.display='none';
  const nextBtn = document.getElementById('quizNextBtn');
  if(nextBtn){
    nextBtn.style.display='block';
    nextBtn.textContent = quizIdx+1 < quizQueue.length ? '下一题 →' : '查看结果 →';
  }
}

function skipQuizQuestion() {
  const e = quizQueue[quizIdx];
  quizAnswers.push({id:e.id, userAnswer:'—', correct:false, skipped:true});
  quizSkipped.add(quizIdx);
  quizIdx++;
  if(quizIdx >= quizQueue.length) renderQuizReview();
  else renderQuizQuestion();
}

function nextQuizQuestion() {
  quizIdx++;
  if (quizIdx >= quizQueue.length) {
    renderQuizReview();
  } else {
    renderQuizQuestion();
  }
}

function renderQuizReview() {
  const realAnswers = quizAnswers.filter(a=>!a.skipped);
  const total = realAnswers.length;
  const correctN = realAnswers.filter(a=>a.correct).length;
  const wrongN = total - correctN;
  const skippedN = quizAnswers.filter(a=>a.skipped).length;
  document.getElementById('quizProgress').textContent = '回顾';
  document.getElementById('quizProgFill').style.width = '100%';
  document.getElementById('quizTitleText').textContent = '📋 答题回顾';

  // 章节统计
  const chapterMap = {};
  quizAnswers.forEach(a=>{
    const e=errors.find(x=>x.id===a.id);if(!e)return;
    const key=e.type+(e.subtype?'/'+e.subtype:'');
    if(!chapterMap[key]) chapterMap[key]={name:key,correct:0,total:0,skipped:0};
    if(a.skipped){chapterMap[key].skipped++;chapterMap[key].total++;}
    else{chapterMap[key].total++;if(a.correct)chapterMap[key].correct++;}
  });
  const chapterStats = Object.values(chapterMap).sort((a,b)=>b.total-a.total).map(c=>{
    const rate=c.total>0?Math.round(c.correct/c.total*100):0;
    const barColor=rate>=80?'#52c41a':rate>=50?'#fa8c16':'#e74c3c';
    return `<div class="chapter-stat-row">
      <span class="chapter-stat-name">${escapeHtml(c.name)}</span>
      <div class="chapter-stat-bar-wrap"><div class="chapter-stat-bar" style="width:${rate}%;background:${barColor}"></div></div>
      <span class="chapter-stat-val">${c.correct}/${c.total} (${rate}%)</span>
    </div>`;
  }).join('');

  const items = quizAnswers.map(a => {
    const e = errors.find(x=>x.id===a.id);
    if (!e) return '';
    if(a.skipped) return `<div class="quiz-review-item" style="border-left:4px solid #fa8c16;background:#fff9f0">
      <div class="review-meta">
        <span class="review-verdict" style="color:#fa8c16">⏭ 跳过</span>
        <span style="font-size:12px;color:#888">${escapeHtml(e.type)} · ${escapeHtml(e.subtype||'')}</span>
      </div>
      <div style="font-size:13px;color:#333;line-height:1.6">${escapeHtml(e.question)}</div>
    </div>`;
    const cls = a.correct ? 'right' : 'wrong';
    const verdict = a.correct ? '✅ 答对' : '❌ 答错';
    return `<div class="quiz-review-item ${cls}">
      <div class="review-meta">
        <span class="review-verdict ${cls}">${verdict}</span>
        <span style="font-size:12px;color:#888">${escapeHtml(e.type)} · ${escapeHtml(e.subtype||'')}</span>
      </div>
      <div style="font-size:13px;color:#333;line-height:1.6;margin-bottom:8px">${escapeHtml(e.question)}</div>
      <div class="review-answer-row">
        <span class="my-ans ${a.correct?'ok':''}">我选：${escapeHtml(a.userAnswer)}</span>
        <span class="correct-ans">正确：${escapeHtml(e.answer||'—')}</span>
      </div>
      ${e.analysis ? `<div class="review-analysis">📌 ${renderAnalysis(e.analysis)}</div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('quizContent').innerHTML = `
    <div class="quiz-review-title">本次练习完成</div>
    <div class="quiz-summary-bar">
      <div class="sum-stat"><div class="sum-num green">${correctN}</div><div class="sum-label">答对</div></div>
      <div class="sum-stat"><div class="sum-num">${wrongN}</div><div class="sum-label">答错</div></div>
      <div class="sum-stat"><div class="sum-num" style="color:#888">${total}</div><div class="sum-label">作答</div></div>
      ${skippedN?`<div class="sum-stat"><div class="sum-num" style="color:#fa8c16">${skippedN}</div><div class="sum-label">跳过</div></div>`:''}
    </div>
    ${chapterStats?`<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;color:#555;margin-bottom:8px">📊 章节统计</div>${chapterStats}</div>`:''}
    ${items}
    <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn btn-primary" onclick="saveQuizResults()">💾 保存并关闭</button>
        <button class="btn btn-secondary" onclick="markAllWrongAsFocus()">🔴 错题全标重点</button>
        <button class="btn btn-secondary" onclick="requestCloseQuizModal('notes')">📚 去知识树</button>
      </div>
      <div id="quizPostAiArea" style="padding:10px 12px;border-radius:10px;background:#f0f5ff;border:1px solid #bfdbfe;display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12px;font-weight:700;color:#1d4ed8">🤖 本次练习AI分析</span>
          <button class="btn btn-sm btn-secondary" onclick="runPostQuizAI()" id="postQuizAiBtn">生成分析</button>
        </div>
        <div id="postQuizAiOutput" style="font-size:13px;color:#334155;line-height:1.7;white-space:pre-wrap;min-height:40px"></div>
      </div>
      <button class="btn btn-secondary btn-sm" style="align-self:center;color:#888" onclick="document.getElementById('quizPostAiArea').style.display='block';document.getElementById('postQuizAiBtn').click()" id="showPostQuizAiBtn">✨ AI分析本次练习</button>
    </div>`;
}

async function saveQuizResults() {
  const realAnswers = quizAnswers.filter(a=>!a.skipped);
  realAnswers.forEach(a => {
    const e = errors.find(x=>x.id===a.id);
    if (!e) return;
    if (!e.quiz) e.quiz = {streak:0,wrongCount:0,reviewCount:0,lastReview:null,nextReview:null};
    e.quiz.reviewCount++;
    e.quiz.lastReview = today();
    if (!e.quiz.history) e.quiz.history = [];
    e.quiz.history.push({date:today(), answer:a.userAnswer, correct:a.correct});
    if (a.correct) {
      e.quiz.streak = (e.quiz.streak||0) + 1;
      if (e.quiz.streak>=6) e.status = 'mastered';
      else if (e.quiz.streak>=3) e.status = 'review';
    } else {
      e.quiz.streak = 0;
      e.quiz.wrongCount = (e.quiz.wrongCount||0)+1;
      e.status = 'focus';
      e.myAnswer = a.userAnswer;
    }
    e.quiz.nextReview = addDays(today(), INTERVALS[Math.min(e.quiz.streak||0, INTERVALS.length-1)]);
  });
  // 记录练习历史
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
  todayDone += realAnswers.length;
  saveTodayDone();
  saveData();
  closeQuizModal(true);
  renderSidebar();
  renderAll();
  showToast('记录已保存', 'success');
}
