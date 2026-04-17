// ============================================================
// Claude 助手
// ============================================================
function openClaudeHelper(){
  document.getElementById('rawQuestion').value='';
  document.getElementById('claudeResult').value='';
  document.getElementById('templateArea').style.display='none';
  openModal('claudeModal');
}
function genClaudeTemplate(){
  const raw=document.getElementById('rawQuestion').value.trim();
  if(!raw){showToast('请先粘贴题目', 'warning');return;}
  const tmpl=`请分析以下行测错题，只返回 JSON 数组，供错题系统直接导入。

【错题内容】
${raw}

【核心要求】
1. rootReason = 根本原因，必须提炼本质，写深层能力短板，不要复述题面，不要写过程。
2. errorReason = 表象原因，必须提炼当次失误现象，不要展开解释。
3. rootReason 限制在 20 个字以内。
4. errorReason 限制在 8 个字以内。
5. rootReason 和 errorReason 都必须短句化、结论化，禁止空话、套话。
6. analysis 里先写【根本主因分析】，再写【解题思路】。
7. actualDurationSec = 当前这道题实际用时，单位秒；也就是“实际用时”。如果题面里没有明确时间，就填 0。
8. targetDurationSec = 这道题理想用时，单位秒；也就是“预计用时/应该用时”。如果无法合理判断，就按题型经验估计，不要留空。
9. problemType = 问题类型，只能填以下英文值，并按对应中文含义理解：
   - cognition = 认知问题
   - execution = 执行问题
   - mixed = 混合问题
   - unknown = 待观察 / 暂不确定
10. workflowStage = 当前阶段，只能填以下英文值，并按对应中文含义理解：
   - captured = 新录入
   - diagnosing = 待补原因
   - review_ready = 待复盘
   - retrain_due = 待复训
   - mastered = 已掌握
11. tip = 给下次做题的提醒或技巧，短句化，也就是“下次提醒 / 技巧总结”。
12. nextActionType = 下一步建议，只能填以下英文值，并按对应中文含义理解：
   - review_note = 回看笔记
   - retrain = 继续复训
   - mixed_train = 先看笔记再训练
   - observe = 继续观察
13. confidence = 当前把握度，取值 0-5，不清楚填 0；可理解为“你对这题有多大把握”。

【errorReason 可选范围】
审题：粗心看错题目 / 题目没读完 / 选项没看全 / 关键词漏看
知识：公式/方法不会 / 知识点遗忘 / 概念理解错误 / 概念混淆 / 常识知识空白
言语：词义/语义理解偏差 / 主旨提炼失误 / 过度推断/绝对化 / 语境分析错误 / 近义词辨析失误
推理：逻辑推理出错 / 充分必要条件混淆 / 矛盾/反对关系混淆 / 论证结构误判 / 加强/削弱方向判反 / 图形规律识别失误 / 类比关系判断错误 / 定义关键要素未抓住
资料分析：读数/找数出错 / 增长率与增长量混淆 / 倍数与百分比混淆 / 计算量大估算偏差
计算：粗心计算错误 / 方程列错
方法：方法不熟练 / 解题思路错误 / 题型识别错误 / 代入排除法未用
状态：没时间/蒙的 / 会做但慌了

【返回格式】
[
  {
    "type": "判断推理",
    "subtype": "逻辑判断",
    "subSubtype": "条件推理",
    "question": "题目原文",
    "options": "A. 选项一|B. 选项二|C. 选项三|D. 选项四",
    "answer": "A",
    "myAnswer": "B",
    "actualDurationSec": 95,
    "targetDurationSec": 60,
    "problemType": "cognition",
    "rootReason": "条件链提炼能力不稳",
    "errorReason": "逆命题误判",
    "analysis": "【根本主因分析】......\n\n【解题思路】......",
    "tip": "先把条件链顺着写清，再判断能否逆推。",
    "nextActionType": "review_note",
    "confidence": 2,
    "workflowStage": "review_ready",
    "difficulty": 2,
    "status": "focus"
  }
]

【再次强调】
- rootReason：必须写本质短板，20 字内
- errorReason：必须写表象失误，8 字内
- actualDurationSec：实际用时，单位秒，没有就填 0
- targetDurationSec：预计用时/应该用时，单位秒，必须返回数字
- problemType：只能是 cognition / execution / mixed / unknown
  - cognition = 认知问题
  - execution = 执行问题
  - mixed = 混合问题
  - unknown = 待观察
- workflowStage：只能是 captured / diagnosing / review_ready / retrain_due / mastered
  - captured = 新录入
  - diagnosing = 待补原因
  - review_ready = 待复盘
  - retrain_due = 待复训
  - mastered = 已掌握
- nextActionType：只能是 review_note / retrain / mixed_train / observe
  - review_note = 回看笔记
  - retrain = 继续复训
  - mixed_train = 先看笔记再训练
  - observe = 继续观察
- confidence：0-5 的整数，表示把握度
- tip：短句提醒，给下次做题用
- 只返回 JSON，不要任何额外说明`;
  const extraPathGuide = [
    '【4级路径补充】',
    '如果题目知识点是4级结构，请继续返回以下字段：',
    '"knowledgePathTitles": ["1级","2级","3级","4级"]',
    '"knowledgePath": "1级 > 2级 > 3级 > 4级"',
    '"knowledgeNodePath": "1级 > 2级 > 3级 > 4级"',
    '"notePath": "1级 > 2级 > 3级 > 4级"',
    '',
    '兼容规则：',
    '- type = 1级',
    '- subtype = 2级',
    '- subSubtype = 最终叶子（3级或4级）',
    '- 如果是4级题目，必须同时返回 knowledgePathTitles 等完整路径字段',
    '',
    '4级示例：',
    '{',
    '  "type": "判断推理",',
    '  "subtype": "图形推理",',
    '  "subSubtype": "九宫格样式规律",',
    '  "knowledgePathTitles": ["判断推理","图形推理","组成相似","九宫格样式规律"],',
    '  "knowledgePath": "判断推理 > 图形推理 > 组成相似 > 九宫格样式规律"',
    '}'
  ].join('\n');
  document.getElementById('templateText').value = `${tmpl}\n\n${extraPathGuide}`;
  document.getElementById('templateArea').style.display='block';
}
function copyTemplate(){
  const text=document.getElementById('templateText').value;
  navigator.clipboard.writeText(text).then(()=>{
    const h=document.getElementById('copyHint');h.style.display='inline';
    setTimeout(()=>h.style.display='none',2000);
  }).catch(()=>{ document.getElementById('templateText').select();document.execCommand('copy'); });
}
function importFromClaude(){
  const raw=document.getElementById('claudeResult').value.trim();
  if(!raw){showToast('请先粘贴 JSON', 'warning');return;}
  // 安全化：确保 analysis 等字段的换行和引号不破坏 JSON
  const safeRaw = raw.replace(/"analysis"\s*:\s*"((?:(?!"})[^"]|\\")*)"/g, (_, s) => {
    return `"analysis":"${s.replace(/\r?\n/g,'\\n').replace(/\\"/g,'\\\\"')}"`;
  });
  const data=tryParseJson(safeRaw);
  if(!data){showToast('JSON 解析失败，请确认内容是完整的 JSON 数组', 'error');return;}
  if(!Array.isArray(data)){showToast('应为数组格式 [...]', 'error');return;}
  const normalized = normalizeImportedErrorsForCurrentKnowledge(data, 'claude_bank');
  const{added,updated}=mergeImport(normalized, 'claude_bank');
  saveData();document.getElementById('claudeResult').value='';
  closeModal('claudeModal');renderSidebar();renderAll();
  openClaudeBankModal();
  showToast(`Claude 题库导入完成：新增 ${added} 题，更新 ${updated} 题`, 'success');
}

function getFilteredClaudeBankEntries() {
  const keyword = (document.getElementById('claudeBankSearch')?.value || '').trim().toLowerCase();
  const list = getClaudeBankEntries();
  if (!keyword) return list;
  const terms = keyword.split(/\s+/).filter(Boolean);
  return list.filter(item => {
    const haystack = [
      item.type,
      item.subtype,
      item.subSubtype,
      item.question,
      item.options,
      item.answer,
      item.analysis,
      item.rootReason,
      item.errorReason
    ].join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}
function getClaudeBankKnowledgePathText(item) {
  if (item && item.noteNodeId && typeof getKnowledgePathTitles === 'function' && typeof collapseKnowledgePathTitles === 'function') {
    const titles = collapseKnowledgePathTitles(getKnowledgePathTitles(item.noteNodeId));
    if (titles && titles.length) return titles.join(' > ');
  }
  if (item?.knowledgePath) return String(item.knowledgePath);
  if (Array.isArray(item?.knowledgePathTitles) && item.knowledgePathTitles.length) return item.knowledgePathTitles.join(' > ');
  if (item?.knowledgeNodePath) return String(item.knowledgeNodePath);
  if (item?.notePath) return String(item.notePath);
  return [item?.type, item?.subtype, item?.subSubtype].filter(Boolean).join(' > ');
}
function renderClaudeBankCard(item) {
  const normalizedId = normalizeErrorId(item.id);
  const idLit = idArg(item.id);
  const noteNodeLit = noteNodeArg(item.noteNodeId || '');
  const isRev = revealed.has(normalizedId);
  const knowledgePathText = getClaudeBankKnowledgePathText(item);
  const opts = item.options ? item.options.split(/\n|\|/).map(o => `<p>${escapeHtml(o.trim())}</p>`).join('') : '';
  const imgTag = item.imgData ? `<img src="${escapeHtml(item.imgData)}" class="cuoti-img" onclick="this.classList.toggle('expanded')" title="点击放大/缩小">` : '';
  const processImageTag = renderProcessImagePreview(item, 'card');
  let detailHtml = '';
  if (isRev) {
    const tipText = item.tip || item.nextAction || '';
    detailHtml = `<div class="card-detail">
      <div class="detail-meta-row">
        <span class="detail-pill correct-pill">正确答案 ${escapeHtml(item.answer || '未填写')}</span>
        ${item.rootReason ? `<span class="detail-pill" style="background:#fff0f6;color:#c41d7f;border:1px solid #ffadd2;font-size:11px">根因：${escapeHtml(item.rootReason)}</span>` : ''}
        ${item.errorReason ? `<span class="detail-pill reason-pill">表象：${escapeHtml(item.errorReason)}</span>` : ''}
        ${tipText ? `<span class="detail-pill meta-pill">💡 技巧：${escapeHtml(tipText)}</span>` : ''}
      </div>
      ${item.analysis ? `<div class="detail-analysis">${renderAnalysis(item.analysis)}</div>` : '<div style="font-size:12px;color:#bbb">暂无解析</div>'}
      ${tipText ? `<div class="detail-analysis"><strong>技巧：</strong>${renderAnalysis(tipText)}</div>` : ''}
      ${item.analysisImgData ? `<img src="${escapeHtml(item.analysisImgData)}" class="cuoti-img" onclick="this.classList.toggle('expanded')" title="点击放大/缩小" style="border:1px solid #e0e4ff;margin-top:6px">` : ''}
    </div>`;
  }
  const iqState = inlineQuizState[normalizedId];
  let iqHtml = '';
  if (iqState) {
    const options = item.options ? item.options.split(/\n|\|/).map(o => o.trim()).filter(Boolean) : [];
    if (!iqState.answered) {
      const optBtns = options.length
        ? options.map((opt, index) => {
            const letter = String.fromCharCode(65 + index);
            return `<button class="iq-opt" onclick='selectInlineAnswer(${idLit},"${letter}")'>${escapeHtml(opt)}</button>`;
          }).join('')
        : ['A','B','C','D'].map(letter => `<button class="iq-opt" onclick='selectInlineAnswer(${idLit},"${letter}")' style="text-align:center;font-weight:700">${letter}</button>`).join('');
      iqHtml = `<div class="iq-area">
        <div class="iq-hint">选择你的答案</div>
        <div class="iq-opts">${optBtns}</div>
        <div class="iq-actions">
          <button class="btn btn-sm btn-secondary" onclick='closeInlineQuiz(${idLit})'>取消</button>
        </div>
      </div>`;
    } else {
      const ok = iqState.correct;
      iqHtml = `<div class="iq-area">
        <div class="iq-result ${ok ? 'ok' : 'fail'}">${ok ? '答对了' : '答错了'}，你选了 <strong>${escapeHtml(iqState.userAnswer)}</strong>，正确答案是 <strong>${escapeHtml(item.answer || '未填写')}</strong></div>
        ${item.analysis ? `<div style="margin-top:6px;font-size:12px;color:#555;padding:6px 10px;background:#f6f8ff;border-radius:6px;border-left:3px solid #4e8ef7">${renderAnalysis(item.analysis)}</div>` : ''}
        <div class="iq-actions" style="margin-top:8px">
          <button class="btn btn-sm btn-primary" onclick='convertClaudeBankToError(${idLit})'>转为错题</button>
          <button class="btn btn-sm btn-secondary" onclick='closeInlineQuiz(${idLit})'>关闭</button>
        </div>
      </div>`;
    }
  }
  return `<div class="error-card" id="claude-bank-card-${normalizedId}" style="margin-bottom:14px">
    <div class="card-top">
      <span class="card-num">#${escapeHtml(String(item.id || ''))}</span>
      <span style="font-size:11px;padding:1px 8px;border-radius:999px;background:#f0f5ff;color:#1d4ed8;border:1px solid #bfdbfe">Claude题库</span>
      ${item.type ? `<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f6ffed;color:#389e0d;border:1px solid #b7eb8f">${escapeHtml(item.type)}</span>` : ''}
      ${item.subtype ? `<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#fff7e6;color:#d46b08;border:1px solid #ffd591">${escapeHtml(item.subtype)}</span>` : ''}
      ${item.subSubtype ? `<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f9f0ff;color:#722ed1;border:1px solid #d3adf7">${escapeHtml(item.subSubtype)}</span>` : ''}
      ${knowledgePathText ? `<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(knowledgePathText)}">${escapeHtml(knowledgePathText)}</span>` : ''}
      ${item.addDate ? `<span style="font-size:11px;color:#999">${escapeHtml(item.addDate)}</span>` : ''}
    </div>
    <div class="card-question">${escapeHtml(item.question || '')}</div>
    ${imgTag}
    ${processImageTag}
    ${opts ? `<div class="card-options">${opts}</div>` : ''}
    ${isRev ? detailHtml : ''}
    <button class="card-reveal-btn" onclick='revealCard(${idLit})' style="${isRev ? 'color:#bbb;border-color:#eee;font-size:11px;margin-top:6px':''}">
      ${isRev ? '收起' : '查看答案与解析'}
    </button>
    ${iqHtml}
    <div class="card-actions">
      <button class="btn btn-sm btn-secondary" onclick='openKnowledgeForError(${idLit})'>知识点</button>
      <button class="btn btn-sm btn-secondary" onclick='moveErrorToKnowledgeNode(${idLit}, ${noteNodeLit})'>改挂载</button>
      <button class="btn btn-sm btn-secondary" onclick='openProcessImageEditor(${idLit},"card")'>&#36807;&#31243;&#22270;</button>
      <button class="btn btn-sm btn-secondary" onclick='openEditModal(${idLit})'>编辑</button>
      <button class="btn btn-sm btn-secondary" style="color:#4e8ef7;border-color:#adc6ff" onclick='startInlineQuiz(${idLit})'>做题</button>
      <button class="btn btn-sm btn-primary" onclick='convertClaudeBankToError(${idLit})'>转为错题</button>
      <button class="del-btn del-btn-danger" onclick='deleteError(${idLit})'>🗑 删除</button>
    </div>
  </div>`;
}
function renderClaudeBankModal() {
  const listEl = document.getElementById('claudeBankList');
  const summaryEl = document.getElementById('claudeBankSummary');
  if (!listEl || !summaryEl) return;
  const all = getClaudeBankEntries();
  const list = getFilteredClaudeBankEntries();
  const keyword = (document.getElementById('claudeBankSearch')?.value || '').trim();
  summaryEl.textContent = keyword
    ? `Claude 题库共 ${all.length} 题，当前搜索命中 ${list.length} 题`
    : `Claude 题库共 ${all.length} 题，不参与错题统计与复习`;
  if (!list.length) {
    listEl.innerHTML = `<div class="empty"><div class="emoji">📚</div><p>${all.length ? '没有匹配的题库题' : 'Claude 题库还是空的，先去导入一批题目'}</p></div>`;
    return;
  }
  listEl.innerHTML = list.map(renderClaudeBankCard).join('');
}
function openClaudeBankModal() {
  openModal('claudeBankModal');
  renderClaudeBankModal();
}
function convertClaudeBankToError(id) {
  const item = findErrorById(id);
  if (!item || !isClaudeBankEntry(item)) return;
  item.entryKind = 'error';
  item.status = item.status || 'focus';
  item.masteryLevel = item.masteryLevel || 'not_mastered';
  item.updatedAt = new Date().toISOString();
  item.addDate = item.addDate || today();
  recordErrorUpsert(item);
  saveData();
  syncNotesWithErrors();
  renderSidebar();
  renderAll();
  renderNotesByType();
  renderClaudeBankModal();
  showToast('已转为错题', 'success');
}
window.refreshClaudeBankModal = function () {
  const modal = document.getElementById('claudeBankModal');
  if (modal && modal.classList.contains('open')) {
    renderClaudeBankModal();
  }
};
