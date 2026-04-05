// ============================================================
// AI 工具台增强函数
// ============================================================
function switchAITab(tab) {
  ['diagnose','chat','generate','summary'].forEach(t => {
    document.getElementById('aiTabContent_'+t).style.display = t===tab ? '' : 'none';
    const btn = document.getElementById('aiTab_'+t);
    if (btn) btn.classList.toggle('active', t===tab);
  });
  // 打开诊断tab时自动渲染本地统计
  if (tab === 'diagnose') renderLocalStatsCards();
}

function renderLocalStatsCards() {
  const el = document.getElementById('localStatsCards');
  if (!el) return;
  const list = getFiltered().length ? getFiltered() : getErrorEntries();
  if (!list.length) { el.innerHTML = ''; return; }
  // 统计 rootReason 频次
  const reasonMap = {};
  list.forEach(e => {
    const r = e.rootReason || e.errorReason || '';
    if (r) reasonMap[r] = (reasonMap[r]||0)+1;
  });
  const top3 = Object.entries(reasonMap).sort((a,b)=>b[1]-a[1]).slice(0,3);
  // 统计题型
  const typeMap = {};
  list.forEach(e => { const t=e.type||'未知'; typeMap[t]=(typeMap[t]||0)+1; });
  const topType = Object.entries(typeMap).sort((a,b)=>b[1]-a[1])[0] || ['—',0];
  // focus状态数量
  const focusN = list.filter(e=>e.status==='focus').length;
  const total = list.length;
  el.innerHTML = `
    <div style="padding:10px 12px;background:#fff3cd;border-radius:10px;border:1px solid #ffd666">
      <div style="font-size:11px;color:#856404;font-weight:700;margin-bottom:4px">🔴 重点待复习</div>
      <div style="font-size:22px;font-weight:800;color:#b45309">${focusN}</div>
      <div style="font-size:11px;color:#92400e">共${total}题中</div>
    </div>
    <div style="padding:10px 12px;background:#fef2f2;border-radius:10px;border:1px solid #fca5a5">
      <div style="font-size:11px;color:#991b1b;font-weight:700;margin-bottom:4px">📌 最高频根因</div>
      <div style="font-size:13px;font-weight:700;color:#7f1d1d;line-height:1.4">${escapeHtml(top3[0]?top3[0][0]:'暂无数据')}</div>
      <div style="font-size:11px;color:#b91c1c">${top3[0]?top3[0][1]+'次':''}</div>
    </div>
    <div style="padding:10px 12px;background:#f0fdf4;border-radius:10px;border:1px solid #86efac">
      <div style="font-size:11px;color:#166534;font-weight:700;margin-bottom:4px">📚 最多错误题型</div>
      <div style="font-size:13px;font-weight:700;color:#14532d;line-height:1.4">${escapeHtml(topType[0])}</div>
      <div style="font-size:11px;color:#16a34a">${topType[1]}题</div>
    </div>`;
  // 渲染Top5根因列表
  if (top3.length) {
    const listHtml = Object.entries(reasonMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([r,c]) => {
      const pct = Math.round(c/total*100);
      const bar = `<div style="height:4px;background:#e5e7eb;border-radius:2px;margin-top:3px"><div style="height:4px;background:#e74c3c;border-radius:2px;width:${pct}%"></div></div>`;
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6">
        <span style="font-size:12px;color:#374151;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r)}</span>
        <span style="font-size:12px;font-weight:700;color:#e74c3c;margin-left:8px;flex-shrink:0">${c}次</span>
      </div>`;
    }).join('');
    el.insertAdjacentHTML('afterend', `<div style="margin-top:10px;padding:10px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;grid-column:1/-1">
      <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px">根因频次（即你的真实弱点清单）</div>
      ${listHtml}
    </div>`);
  }
}

function quickAsk(msg) {
  switchAITab('chat');
  const input = document.getElementById('aiChatInput');
  if (input) { input.value = msg; submitAIChat(); }
}

function markAllWrongAsFocus() {
  const wrongIds = quizAnswers.filter(a=>!a.correct&&!a.skipped).map(a=>a.id);
  if (!wrongIds.length) { showToast('没有答错的题', 'info'); return; }
  wrongIds.forEach(id => {
    const e = errors.find(x=>x.id===id);
    if (e) e.status = 'focus';
  });
  saveData();
  showToast(`已将 ${wrongIds.length} 道错题标为重点复习`, 'success');
}

async function runPostQuizAI() {
  const btn = document.getElementById('postQuizAiBtn');
  const output = document.getElementById('postQuizAiOutput');
  if (!btn || !output) return;
  btn.disabled = true; btn.textContent = '分析中...';
  const wrongItems = quizAnswers.filter(a=>!a.correct&&!a.skipped).map(a=>{
    const e = errors.find(x=>x.id===a.id);
    return e ? {type:e.type,subtype:e.subtype,rootReason:e.rootReason,errorReason:e.errorReason} : null;
  }).filter(Boolean);
  const correctN = quizAnswers.filter(a=>a.correct).length;
  const total = quizAnswers.filter(a=>!a.skipped).length;
  try {
    const data = await fetchJsonWithAuth('/api/ai/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        message: `我刚完成了一次练习，${total}题答对${correctN}题。答错的题如下：${JSON.stringify(wrongItems)}。请用3-4句话分析这次练习暴露的主要问题，并给出今天接下来应该做的1件具体的事。`,
        history: []
      })
    });
    output.textContent = data.reply || '暂无分析';
  } catch(e) {
    output.textContent = '分析失败，请重试';
  }
  btn.disabled = false; btn.textContent = '重新生成';
}

async function generateFromWeakpoint() {
  const output = document.getElementById('aiGenerateOutput');
  const type = document.getElementById('genTypeSelect').value;
  const subtype = document.getElementById('genSubtypeSelect').value;
  // 找该题型下的错题做参考
  const refErrors = getErrorEntries().filter(e =>
    (!type || e.type===type) && (!subtype || e.subtype===subtype) && e.status==='focus'
  ).slice(0,3);
  if (!type && !refErrors.length) { showToast('请先选择题型', 'warning'); return; }
  if (output) output.innerHTML = '<span style="color:#888">出题中...</span>';
  // 优先用当前选中的知识节点
  const node = getCurrentKnowledgeNodeSummary && getCurrentKnowledgeNodeSummary();
  try {
    const data = await fetchJsonWithAuth('/api/ai/generate-question', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        nodeTitle: node ? node.title : (subtype || type || '行测'),
        nodeSummary: node ? (node.contentMd||'') : '',
        referenceError: refErrors[0] || {},
        count: 3
      })
    });
    const items = data.items || [];
    if (!items.length) { if(output) output.textContent='未能生成题目，请重试'; return; }
    if (output) output.innerHTML = items.map((item,i) => {
      const opts = (item.options||'').split('|').map(o=>o.trim()).filter(Boolean);
      const optHtml = opts.map(o=>`<div style="padding:3px 0;color:#374151">${escapeHtml(o)}</div>`).join('');
      return `<div style="margin-bottom:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff">
        <div style="font-size:12px;color:#6b7280;margin-bottom:6px">第${i+1}题</div>
        <div style="font-size:13px;color:#111827;line-height:1.7;margin-bottom:8px">${escapeHtml(item.question||'')}</div>
        <div style="margin-bottom:8px">${optHtml}</div>
        <div style="font-size:12px;padding:6px 10px;background:#f0fdf4;border-radius:6px;color:#166534">
          答案：${escapeHtml(item.answer||'—')}
        </div>
        <div style="font-size:12px;padding:6px 10px;background:#f8faff;border-radius:6px;color:#1e40af;margin-top:6px;line-height:1.6" id="genAnalysis_${i}" style="display:none">
          ${renderAnalysis(item.analysis||'')}
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top:6px" onclick="this.style.display='none';document.getElementById('genAnalysis_${i}').style.display='block'">查看解析</button>
      </div>`;
    }).join('');
  } catch(e) {
    if(output) output.textContent = '出题失败：'+e.message;
  }
}

function copyAISummary() {
  const ta = document.getElementById('aiModuleSummaryOutput');
  if (!ta || !ta.value) return;
  navigator.clipboard.writeText(ta.value).then(()=>showToast('已复制，去粘贴给Claude吧', 'success')).catch(()=>{
    ta.select(); document.execCommand('copy'); showToast('已复制', 'success');
  });
}

async function openCCSummaryFromMore() {
  openAIToolsModal();
  switchAITab('summary');
  const hasScopedContext = !!(typeFilter || reasonFilter || (statusFilter && statusFilter !== 'all') || dateFrom || dateTo || knowledgeNodeFilter || selectedKnowledgeNodeId);
  if (hasScopedContext) await buildClaudeSummaryFiltered();
  else await buildClaudeSummary();
}

async function buildClaudeSummaryFiltered() {
  // 用当前筛选状态生成摘要
  const output = document.getElementById('aiModuleSummaryOutput');
  const copyBtn = document.getElementById('copySummaryBtn');
  if(output) output.value = '生成中...';
  try {
    const data = await fetchJsonWithAuth('/api/ai/module-summary-for-claude', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        type: typeFilter && typeFilter.level==='type' ? typeFilter.value : '',
        subtype: typeFilter && typeFilter.level==='subtype' ? typeFilter.value : '',
        rootReason: reasonFilter||'',
        status: statusFilter && statusFilter!=='all' ? statusFilter : '',
        masteryLevel:'', dateFrom:dateFrom||'', dateTo:dateTo||'', limit:60
      })
    });
    const result = data.result||{};
    const text = [
      '# 我的行测错题摘要（发给AI用）',
      '',
      result.overview||'',
      '',
      '## 弱点标签',
      (result.weaknessTags||[]).join('、'),
      '',
      '## 建议你这样提问',
      result.recommendedPrompt||'',
      '',
      '## 错题详情',
      JSON.stringify(result.items||[], null, 2)
    ].join('\n');
    if(output) output.value = text;
    if(copyBtn) copyBtn.style.display='';
  } catch(e) {
    if(output) output.value = '生成失败：'+e.message;
  }
}

function openAIToolsModal(){
  openModal('aiToolsModal');
  switchAITab('diagnose');
  renderLocalStatsCards();
}

function clearAIChat(){
  aiChatHistory = [];
  const input = document.getElementById('aiChatInput');
  const output = document.getElementById('aiChatOutput');
  const status = document.getElementById('aiChatStatus');
  if(input) input.value = '';
  if(output) output.textContent = '';
  if(status) status.textContent = '';
}

async function submitAIChat(){
  const input = document.getElementById('aiChatInput');
  const output = document.getElementById('aiChatOutput');
  const status = document.getElementById('aiChatStatus');
  const message = (input && input.value || '').trim();
  if(!message){ showToast('请先输入问题', 'warning'); return; }
  if(status) status.textContent = 'AI 正在思考...';
  try{
    const data = await fetchJsonWithAuth('/api/ai/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message, history: aiChatHistory.slice(-6) })
    });
    aiChatHistory.push({ role:'user', content: message });
    aiChatHistory.push({ role:'assistant', content: data.reply || '' });
    if(output) output.textContent = data.reply || '暂无回复';
    if(status) status.textContent = data.model || 'done';
  }catch(e){
    if(status) status.textContent = '失败';
    if(output) output.textContent = e.message || 'AI 助手调用失败';
    showToast(e.message || 'AI 助手调用失败', 'error');
  }
}

async function runAIDiagnosis(){
  const output = document.getElementById('aiDiagnoseOutput');
  if(output) output.textContent = '诊断生成中...';
  try{
    const data = await fetchJsonWithAuth('/api/ai/diagnose', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ errors: getFiltered().slice(0, 120) })
    });
    const result = data.result || {};
    const weakPoints = (result.weakPoints || []).map((item, idx) =>
      `${idx+1}. ${item.area || '未命名'} [${item.priority || 'normal'}]\n${item.description || ''}\n建议：${item.suggestion || ''}`
    ).join('\n\n');
    if(output) output.textContent = `${result.summary || '暂无总结'}\n\n${weakPoints}`.trim();
  }catch(e){
    if(output) output.textContent = e.message || 'AI 诊断失败';
    showToast(e.message || 'AI 诊断失败', 'error');
  }
}

async function buildClaudeSummary(){
  const output = document.getElementById('aiModuleSummaryOutput');
  if(output) output.value = '生成中...';
  try{
    const data = await fetchJsonWithAuth('/api/ai/module-summary-for-claude', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        type: typeFilter && typeFilter.level === 'type' ? typeFilter.value : '',
        subtype: typeFilter && typeFilter.level === 'subtype' ? typeFilter.value : '',
        rootReason: reasonFilter || '',
        status: statusFilter && statusFilter !== 'all' ? statusFilter : '',
        masteryLevel: '',
        dateFrom: dateFrom || '',
        dateTo: dateTo || '',
        limit: 80
      })
    });
    const result = data.result || {};
    const text = [
      result.overview || '',
      '',
      'Weakness Tags:',
      JSON.stringify(result.weaknessTags || [], null, 2),
      '',
      'Recommended Prompt:',
      result.recommendedPrompt || '',
      '',
      'Items:',
      JSON.stringify(result.items || [], null, 2)
    ].join('\n');
    if(output) output.value = text.trim();
    const copyBtn = document.getElementById('copySummaryBtn');
    if(copyBtn) copyBtn.style.display='';
  }catch(e){
    if(output) output.value = e.message || '生成失败';
    showToast(e.message || '生成 Claude 摘要失败', 'error');
  }
}

async function generateNodePractice(){
  const output = document.getElementById('aiGenerateOutput');
  const node = getCurrentKnowledgeNodeSummary();
  if(!node){ showToast('请先选中一个知识点', 'warning'); return; }
  if(output) output.textContent = '相似题生成中...';
  try{
    const data = await fetchJsonWithAuth('/api/ai/generate-question', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        nodeTitle: node.title,
        nodeSummary: node.contentMd || node.path,
        referenceError: node.linkedErrors[0] || {},
        count: 3
      })
    });
    const items = (data.items || []).map((item, idx) =>
      `第 ${idx+1} 题\n题目：${item.question || ''}\n选项：${item.options || ''}\n答案：${item.answer || ''}\n解析：${item.analysis || ''}`
    ).join('\n\n');
    if(output) output.textContent = items || '暂无结果';
  }catch(e){
    if(output) output.textContent = e.message || '相似题生成失败';
    showToast(e.message || '相似题生成失败', 'error');
  }
}
