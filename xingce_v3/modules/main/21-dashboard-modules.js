// ============================================================
// Dashboard（Tab分模块版）
// ============================================================
let _dashTrendDays = 7; // 7 或 30
let _practiceInsightsState = { loading:false, loaded:false, error:'', data:null };

async function openDashboard() {
  const tabs = ['总览', ...new Set(getErrorEntries().map(e=>e.type))];
  const tabBtns = tabs.map((t,i) =>
    `<button class="dash-tab-btn ${i===0?'active':''}" id="dashtab_${i}" onclick="switchDashTab(${i})">${escapeHtml(t)}</button>`
  ).join('');
  const tabPanes = tabs.map((t,i) =>
    `<div class="dash-tab-pane ${i===0?'active':''}" id="dashpane_${i}"></div>`
  ).join('');
  document.getElementById('dashboardContent').innerHTML =
    `<div class="dash-tab-bar">${tabBtns}</div>${tabPanes}`;
  // 渲染总览
  renderDashOverview(0);
  openModal('dashboardModal');
  await ensurePracticeInsightsLoaded();
}


async function ensurePracticeInsightsLoaded(force) {
  if (_practiceInsightsState.loading) return;
  if (_practiceInsightsState.loaded && !force) return;
  _practiceInsightsState.loading = true;
  _practiceInsightsState.error = '';
  try {
    const data = await fetchJsonWithAuth('/api/practice/insights?limit=6');
    _practiceInsightsState.data = data || null;
    _practiceInsightsState.loaded = !!(data && data.ok !== false);
  } catch (err) {
    console.warn('practice insights load failed:', err);
    _practiceInsightsState.error = err?.message || '加载失败';
  } finally {
    _practiceInsightsState.loading = false;
    const pane = document.getElementById('dashpane_0');
    if (pane) {
      pane.dataset.rendered = '';
      renderDashOverview(0);
    }
  }
}

function renderPracticeInsightList(items, emptyText, reasonKey) {
  if (!Array.isArray(items) || !items.length) {
    return `<div style="color:#bbb;font-size:12px;padding:10px 0">${escapeHtml(emptyText)}</div>`;
  }
  return items.map((item, idx) => {
    const confidence = item.lastConfidence ? ` · 把握度${item.lastConfidence}` : '';
    const duration = item.lastDuration ? ` · ${item.lastDuration}s` : '';
    const queueReason = item[reasonKey] || '';
    return `<div class="dash-weak-item" style="align-items:flex-start">
      <span style="flex:1;font-size:12px;color:#333;line-height:1.5">${idx+1}. ${escapeHtml((item.question||'').slice(0,34))}${(item.question||'').length>34?'…':''}<br><span style="font-size:11px;color:#999">${escapeHtml(queueReason)}${escapeHtml(confidence)}${escapeHtml(duration)}</span></span>
      <button class="btn btn-sm btn-secondary" style="margin-left:8px;white-space:nowrap" onclick='revealCard(${idArg(''+(item.id||''))})'>查看</button>
    </div>`;
  }).join('');
}

function renderPracticeAdvice(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<div style="color:#bbb;font-size:12px;padding:10px 0">暂无行动建议</div>';
  }
  return items.map(item => `<div class="dash-weak-item" style="align-items:flex-start"><span style="flex:1"><div style="font-size:12px;color:#333;font-weight:600">${escapeHtml(item.title||'')}</div><div style="font-size:11px;color:#888;line-height:1.5">${escapeHtml(item.description||'')}</div></span></div>`).join('');
}

function renderInsightChips(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<div style="color:#bbb;font-size:12px;padding:10px 0">暂无可用数据</div>';
  }
  return items.map(item => `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:#f5f5f5;color:#555;font-size:12px;margin:0 8px 8px 0">${escapeHtml(item.name||'')}<strong style="color:#111">${Number(item.count||0)}</strong></span>`).join('');
}

function switchDashTab(idx) {
  document.querySelectorAll('.dash-tab-btn').forEach((b,i)=>b.classList.toggle('active',i===idx));
  document.querySelectorAll('.dash-tab-pane').forEach((p,i)=>p.classList.toggle('active',i===idx));
  const pane = document.getElementById('dashpane_'+idx);
  if (pane && !pane.dataset.rendered) {
    if (idx===0) renderDashOverview(idx);
    else {
      const type = document.getElementById('dashtab_'+idx).textContent;
      renderDashModule(idx, type);
    }
    pane.dataset.rendered='1';
  }
}

function buildTrendBars(days) {
  const hist = loadHistory();
  const dayMap = {};
  for (let i=days-1;i>=0;i--) { const d=addDays(today(),-i); dayMap[d]=0; }
  hist.forEach(h=>{
    const d=h.date?h.date.split(' ')[0]:'';
    if(dayMap[d]!==undefined) dayMap[d]+=h.total||0;
  });
  const maxDay=Math.max(...Object.values(dayMap),1);
  // 超过 14 天时压缩显示
  const entries = Object.entries(dayMap);
  const step = days>14 ? Math.ceil(entries.length/14) : 1;
  return entries.filter((_,i)=>i%step===0 || i===entries.length-1).map(([d,cnt])=>{
    const pct=Math.round(cnt/maxDay*100);
    const label = days>14 ? d.slice(5) : d.slice(5);
    return `<div class="dash-trend-bar-wrap">
      <div class="dash-trend-count" style="font-size:9px">${cnt||''}</div>
      <div class="dash-trend-bar" style="height:${Math.max(pct,2)}%"></div>
      <div class="dash-trend-date" style="font-size:9px">${label}</div>
    </div>`;
  }).join('');
}

function renderDashOverview(idx) {
  const hist = loadHistory();
  const errorEntries = getErrorEntries();
  const total = errorEntries.length;
  const masteredN = errorEntries.filter(e=>e.status==='mastered').length;
  const focusN = errorEntries.filter(e=>e.status==='focus').length;
  const reviewN = errorEntries.filter(e=>e.status==='review').length;
  const totalReviews = errorEntries.reduce((s,e)=>s+(e.quiz&&e.quiz.reviewCount||0),0);
  const mastPct = total ? Math.round(masteredN/total*100) : 0;

  // 各模块对比
  const typeMap={};
  errorEntries.forEach(e=>{
    if(!typeMap[e.type])typeMap[e.type]={total:0,mastered:0,focus:0};
    typeMap[e.type].total++;
    if(e.status==='mastered') typeMap[e.type].mastered++;
    if(e.status==='focus') typeMap[e.type].focus++;
  });
  const typeBars = Object.entries(typeMap).sort((a,b)=>b[1].total-a[1].total).map(([type,info])=>{
    const pct=info.total?Math.round(info.mastered/info.total*100):0;
    const barColor=pct>=80?'#52c41a':pct>=50?'#4e8ef7':'#e74c3c';
    return `<div class="dash-progress-row">
      <span class="dash-progress-label" title="${escapeHtml(type)}">${escapeHtml(type)}</span>
      <div class="dash-progress-bg"><div class="dash-progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
      <span class="dash-progress-val">${info.mastered}/${info.total} (${pct}%)</span>
    </div>`;
  }).join('');

  // 全局错因 Top5
  const reasonMap={};
  errorEntries.forEach(e=>{const r=e.errorReason||'（未填写）';reasonMap[r]=(reasonMap[r]||0)+1;});
  const maxR=Math.max(...Object.values(reasonMap),1);
  const reasonBars=Object.entries(reasonMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([r,n],ci)=>{
    const pct=Math.round(n/maxR*100);
    const colors=['#fa8c16','#e74c3c','#4e8ef7','#52c41a','#722ed1'];
    return `<div class="dash-progress-row">
      <span class="dash-progress-label" title="${escapeHtml(r)}">${escapeHtml(r)}</span>
      <div class="dash-progress-bg"><div class="dash-progress-fill" style="width:${pct}%;background:${colors[ci%5]}"></div></div>
      <span class="dash-progress-val">${n} 题</span>
    </div>`;
  }).join('');

  // 全局Top3薄弱题
  const weakList=errorEntries.filter(e=>e.quiz&&e.quiz.reviewCount>0)
    .map(e=>({q:e.question.slice(0,28),type:e.type,wrong:e.quiz.wrongCount||0,review:e.quiz.reviewCount,ratio:(e.quiz.wrongCount||0)/e.quiz.reviewCount}))
    .sort((a,b)=>b.ratio-a.ratio).slice(0,3);
  const weakHtml=weakList.length
    ?weakList.map(w=>`<div class="dash-weak-item"><span style="flex:1;font-size:12px;color:#333">${escapeHtml(w.q)}…</span><span style="font-size:11px;color:#e74c3c;white-space:nowrap;margin-left:8px">${escapeHtml(w.type)}·${w.wrong}/${w.review}错</span></div>`).join('')
    :'<div style="color:#ccc;font-size:12px;text-align:center;padding:12px">暂无复习记录</div>';

  const trendBars = buildTrendBars(_dashTrendDays);
  const localTaskPack = typeof buildPracticeTaskPack === 'function' ? buildPracticeTaskPack(12) : null;
  const taskMissionHtml = localTaskPack ? `
    <div class="dash-section">
      <div class="dash-section-title">🎒 今日任务包</div>
      <div class="dash-summary-row" style="margin-top:0">
        <div class="dash-summary-card"><div class="dash-summary-num">${localTaskPack.mission.total}</div><div class="dash-summary-label">今日任务</div></div>
        <div class="dash-summary-card"><div class="dash-summary-num" style="color:#d46b08">${localTaskPack.mission.reviewCount}</div><div class="dash-summary-label">待复盘</div></div>
        <div class="dash-summary-card"><div class="dash-summary-num" style="color:#722ed1">${localTaskPack.mission.retrainCount}</div><div class="dash-summary-label">待复训</div></div>
        <div class="dash-summary-card"><div class="dash-summary-num blue">${localTaskPack.behavior.accuracy}%</div><div class="dash-summary-label">近7日正确率</div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn btn-sm btn-primary" onclick="startPracticeQueue('daily')">开始今日任务（${localTaskPack.mission.suggestedDailyCount}）</button>
        <button class="btn btn-sm btn-secondary" onclick="startPracticeQueue('review')">先补待复盘（${localTaskPack.mission.suggestedReviewCount}）</button>
        <button class="btn btn-sm btn-secondary" onclick="startPracticeQueue('retrain')">先做待复训（${localTaskPack.mission.suggestedRetrainCount}）</button>
      </div>
    </div>` : '';

  document.getElementById('dashpane_'+idx).innerHTML=`
    <div class="dash-summary-row">
      <div class="dash-summary-card"><div class="dash-summary-num">${total}</div><div class="dash-summary-label">总题数</div></div>
      <div class="dash-summary-card"><div class="dash-summary-num green">${masteredN}</div><div class="dash-summary-label">已掌握 ${mastPct}%</div></div>
      <div class="dash-summary-card"><div class="dash-summary-num">${focusN}</div><div class="dash-summary-label">重点复习</div></div>
      <div class="dash-summary-card"><div class="dash-summary-num" style="color:#fa8c16">${reviewN}</div><div class="dash-summary-label">待复习</div></div>
      <div class="dash-summary-card"><div class="dash-summary-num" style="color:#4e8ef7">${totalReviews}</div><div class="dash-summary-label">总复习次</div></div>
    </div>
    ${taskMissionHtml}
    <div class="dash-section">
      <div class="dash-section-title">📚 各模块掌握度对比</div>
      ${typeBars||'<div style="color:#ccc;font-size:12px">暂无数据</div>'}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">📈 练习趋势
        <span class="trend-toggle" style="margin-left:8px;display:inline-flex">
          <button class="trend-toggle-btn ${_dashTrendDays===7?'active':''}" onclick="switchTrend(7,${idx})">7日</button>
          <button class="trend-toggle-btn ${_dashTrendDays===30?'active':''}" onclick="switchTrend(30,${idx})">30日</button>
        </span>
      </div>
      <div class="dash-trend-row" id="trendRow_${idx}">${trendBars}</div>
    </div>
    <div class="dash-section">
      <div class="dash-section-title">⚠️ 全局错因 Top5</div>
      ${reasonBars||'<div style="color:#ccc;font-size:12px">暂无数据</div>'}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">🎯 Top3 薄弱题</div>
      ${weakHtml}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">🧭 今日行动建议</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">正在生成建议...</div>' : renderPracticeAdvice(_practiceInsightsState.data?.advice || [])}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">🗂 今日待复盘</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">加载中...</div>' : renderPracticeInsightList(_practiceInsightsState.data?.reviewQueue || [], '暂无待复盘队列', 'queueReason')}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">🔁 今日待复训</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">加载中...</div>' : renderPracticeInsightList(_practiceInsightsState.data?.retrainQueue || [], '暂无待复训队列', 'queueReason')}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">📌 当前高频错因</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">加载中...</div>' : renderInsightChips(_practiceInsightsState.data?.weakestReasons || [])}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">📚 当前高频薄弱模块</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">加载中...</div>' : renderInsightChips(_practiceInsightsState.data?.weakestTypes || [])}
      ${_practiceInsightsState.error ? `<div style="color:#cf1322;font-size:12px;margin-top:8px">调度数据加载失败：${escapeHtml(_practiceInsightsState.error)}</div>` : ''}
    </div>`;
}

function switchTrend(days, paneIdx) {
  _dashTrendDays = days;
  // 重新渲染总览的趋势部分
  const pane = document.getElementById('dashpane_'+paneIdx);
  if (!pane) return;
  pane.dataset.rendered = '';
  renderDashOverview(paneIdx);
}

function renderDashModule(idx, type) {
  const list = getErrorEntries().filter(e=>e.type===type);
  if (!list.length) {
    document.getElementById('dashpane_'+idx).innerHTML='<div style="color:#ccc;text-align:center;padding:40px;font-size:13px">该模块暂无错题</div>';
    return;
  }
  const total=list.length;
  const mastered=list.filter(e=>e.status==='mastered').length;
  const focus=list.filter(e=>e.status==='focus').length;
  const review=list.filter(e=>e.status==='review').length;
  const mastPct=total?Math.round(mastered/total*100):0;
  const reviews=list.reduce((s,e)=>s+(e.quiz&&e.quiz.reviewCount||0),0);

  // 子类型分布
  const subMap={};
  list.forEach(e=>{const s=e.subtype||'未分类';if(!subMap[s])subMap[s]={total:0,mastered:0};subMap[s].total++;if(e.status==='mastered')subMap[s].mastered++;});
  const maxSub=Math.max(...Object.values(subMap).map(v=>v.total),1);
  const subBars=Object.entries(subMap).sort((a,b)=>b[1].total-a[1].total).map(([s,info])=>{
    const pct=info.total?Math.round(info.mastered/info.total*100):0;
    const barColor=pct>=80?'#52c41a':pct>=50?'#4e8ef7':'#e74c3c';
    return `<div class="dash-progress-row">
      <span class="dash-progress-label">${escapeHtml(s)}</span>
      <div class="dash-progress-bg"><div class="dash-progress-fill" style="width:${Math.round(info.total/maxSub*100)}%;background:${barColor}"></div></div>
      <span class="dash-progress-val">${info.mastered}/${info.total} (${pct}%)</span>
    </div>`;
  }).join('');

  // 模块错因
  const rMap={};
  list.forEach(e=>{const r=e.errorReason||'（未填写）';rMap[r]=(rMap[r]||0)+1;});
  const maxR=Math.max(...Object.values(rMap),1);
  const rBars=Object.entries(rMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([r,n],ci)=>{
    const colors=['#fa8c16','#e74c3c','#4e8ef7','#52c41a','#722ed1'];
    return `<div class="dash-progress-row">
      <span class="dash-progress-label">${escapeHtml(r)}</span>
      <div class="dash-progress-bg"><div class="dash-progress-fill" style="width:${Math.round(n/maxR*100)}%;background:${colors[ci%5]}"></div></div>
      <span class="dash-progress-val">${n} 题</span>
    </div>`;
  }).join('');

  // 模块薄弱题 Top3
  const weakList=list.filter(e=>e.quiz&&e.quiz.reviewCount>0)
    .map(e=>({q:e.question.slice(0,28),sub:e.subtype||'',wrong:e.quiz.wrongCount||0,review:e.quiz.reviewCount,ratio:(e.quiz.wrongCount||0)/e.quiz.reviewCount}))
    .sort((a,b)=>b.ratio-a.ratio).slice(0,3);
  const weakHtml=weakList.length
    ?weakList.map(w=>`<div class="dash-weak-item"><span style="flex:1;font-size:12px;color:#333">${escapeHtml(w.q)}…</span><span style="font-size:11px;color:#aaa;white-space:nowrap;margin-left:8px">${escapeHtml(w.sub)}·${w.wrong}/${w.review}错</span></div>`).join('')
    :'<div style="color:#ccc;font-size:12px;text-align:center;padding:12px">暂无复习记录</div>';

  document.getElementById('dashpane_'+idx).innerHTML=`
    <div class="dash-module-stat-row">
      <div class="dash-module-stat"><div class="dash-module-num">${total}</div><div class="dash-module-label">题数</div></div>
      <div class="dash-module-stat"><div class="dash-module-num green">${mastered}</div><div class="dash-module-label">已掌握 ${mastPct}%</div></div>
      <div class="dash-module-stat"><div class="dash-module-num">${focus}</div><div class="dash-module-label">重点</div></div>
      <div class="dash-module-stat"><div class="dash-module-num" style="color:#fa8c16">${review}</div><div class="dash-module-label">待复习</div></div>
      <div class="dash-module-stat"><div class="dash-module-num blue">${reviews}</div><div class="dash-module-label">复习次</div></div>
    </div>
    <div class="dash-section">
      <div class="dash-section-title">📊 子类型分布与掌握度</div>
      ${subBars||'<div style="color:#ccc;font-size:12px">暂无数据</div>'}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">⚠️ 错因分布</div>
      ${rBars||'<div style="color:#ccc;font-size:12px">暂无错因数据</div>'}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">🎯 Top3 薄弱题</div>
      ${weakHtml}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">🧭 今日行动建议</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">正在生成建议...</div>' : renderPracticeAdvice(_practiceInsightsState.data?.advice || [])}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">🗂 今日待复盘</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">加载中...</div>' : renderPracticeInsightList(_practiceInsightsState.data?.reviewQueue || [], '暂无待复盘队列', 'queueReason')}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">🔁 今日待复训</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">加载中...</div>' : renderPracticeInsightList(_practiceInsightsState.data?.retrainQueue || [], '暂无待复训队列', 'queueReason')}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">📌 当前高频错因</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">加载中...</div>' : renderInsightChips(_practiceInsightsState.data?.weakestReasons || [])}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">📚 当前高频薄弱模块</div>
      ${_practiceInsightsState.loading ? '<div style="color:#999;font-size:12px;padding:10px 0">加载中...</div>' : renderInsightChips(_practiceInsightsState.data?.weakestTypes || [])}
      ${_practiceInsightsState.error ? `<div style="color:#cf1322;font-size:12px;margin-top:8px">调度数据加载失败：${escapeHtml(_practiceInsightsState.error)}</div>` : ''}
    </div>`;
}
