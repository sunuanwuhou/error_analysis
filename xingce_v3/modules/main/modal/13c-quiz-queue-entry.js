// ============================================================
// Quiz queue entry actions
// ============================================================
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
  quizIdx = 0; quizAnswers = []; quizSkipped = new Set(); resetQuizPauseState();
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
  quizIdx=0; quizAnswers=[]; quizSkipped=new Set(); resetQuizPauseState();
  closeModal('chapterFilterModal');
  document.getElementById('quizTitleText').textContent='📚 全量练习';
  openModal('quizModal');
  renderQuizQuestion();
}
