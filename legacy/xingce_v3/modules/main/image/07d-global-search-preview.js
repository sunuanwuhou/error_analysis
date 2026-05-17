// ============================================================
// Global search preview and actions
// ============================================================
function noteContentHasImage(content) {
  const text = String(content || '');
  return /noteimg:/i.test(text) || /!\[[^\]]*\]\([^)]+\)/.test(text) || /<img\b/i.test(text);
}

function getGlobalSearchPayload() {
  ensureKnowledgeState();
  const questions = getErrorEntries().map(errorItem => {
    const node = errorItem.noteNodeId ? getKnowledgeNodeById(errorItem.noteNodeId) : null;
    const wrongCount = Math.max(
      Number(errorItem.recentWrongCount || 0),
      Number(errorItem.wrongCount || 0),
      Number(errorItem.quiz && errorItem.quiz.wrongCount || 0),
    );
    return {
      kind: 'question',
      id: String(errorItem.id),
      type: errorItem.type || '',
      subtype: errorItem.subtype || '',
      subSubtype: errorItem.subSubtype || '',
      question: errorItem.question || '',
      options: errorItem.options || '',
      analysis: errorItem.analysis || '',
      reason: errorItem.rootReason || errorItem.errorReason || '',
      status: errorItem.status || '',
      knowledgePath: node ? collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' > ') : '',
      sourceYear: errorItem.srcYear || '',
      sourceProvince: errorItem.srcProvince || '',
      sourceOrigin: errorItem.srcOrigin || '',
      status: errorItem.status || '',
      updatedAt: String(errorItem.updatedAt || errorItem.lastPracticedAt || errorItem.addDate || ''),
      wrongCount: Number.isFinite(wrongCount) ? wrongCount : 0,
      targetDurationSec: Number(errorItem.targetDurationSec || 0) || 0,
      lastDurationSec: Number(errorItem.lastDuration || errorItem.actualDurationSec || 0) || 0,
      hasQuestionImage: !!errorItem.imgData,
      hasAnalysisImage: !!errorItem.analysisImgData,
      hasProcessImage: !!getProcessImageUrl(errorItem)
    };
  });
  const notes = collectKnowledgeNodes().map(node => {
    const content = String(node.contentMd || '');
    return {
      kind: 'note',
      id: String(node.id),
      title: node.title || '',
      path: collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' > '),
      content,
      headings: extractMdHeadings(content).map(item => item.text),
      linkedCount: countErrorsForKnowledgeNode(node.id, true),
      hasNoteImage: noteContentHasImage(content)
    };
  }).filter(item => item.content.trim() || item.hasNoteImage);
  return {
    generatedAt: new Date().toISOString(),
    query: searchKw || '',
    questions,
    notes
  };
}

function ensureGlobalSearchQuestionPreviewModal() {
  let mask = document.getElementById('globalSearchQuestionPreviewModal');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'globalSearchQuestionPreviewModal';
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal" style="width:900px;max-width:96vw;max-height:90vh;overflow:auto">
      <button class="modal-close" type="button" onclick="closeGlobalSearchQuestionPreview()">×</button>
      <h2 style="margin-bottom:8px">错题预览</h2>
      <div id="globalSearchQuestionPreviewBody"></div>
    </div>
  `;
  mask.addEventListener('click', function(event) {
    if (event.target === mask) closeGlobalSearchQuestionPreview();
  });
  document.body.appendChild(mask);
  return mask;
}

function closeGlobalSearchQuestionPreview() {
  const mask = document.getElementById('globalSearchQuestionPreviewModal');
  if (!mask) return;
  mask.classList.remove('open');
}

function formatGlobalSearchTimeLabel(value) {
  if (!value) return '未记录';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatGlobalSearchDurationLabel(seconds) {
  const sec = Number(seconds || 0);
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const n = Math.round(sec);
  if (n < 60) return `${n} 秒`;
  const m = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${m} 分 ${r} 秒` : `${m} 分钟`;
}

function openGlobalSearchQuestionPreview(errorId) {
  const errorItem = findErrorById(errorId);
  if (!errorItem) {
    showToast('未找到错题', 'warning');
    return false;
  }
  const mask = ensureGlobalSearchQuestionPreviewModal();
  const body = document.getElementById('globalSearchQuestionPreviewBody');
  if (!body) return false;
  const node = errorItem.noteNodeId ? getKnowledgeNodeById(errorItem.noteNodeId) : null;
  const knowledgePath = node ? collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' > ') : [errorItem.type, errorItem.subtype, errorItem.subSubtype].filter(Boolean).join(' > ');
  const wrongCount = Math.max(
    Number(errorItem.recentWrongCount || 0),
    Number(errorItem.wrongCount || 0),
    Number(errorItem.quiz && errorItem.quiz.wrongCount || 0),
  );
  const updatedAt = String(errorItem.updatedAt || errorItem.lastPracticedAt || errorItem.addDate || '');
  const targetDuration = formatGlobalSearchDurationLabel(errorItem.targetDurationSec);
  const recentDuration = formatGlobalSearchDurationLabel(errorItem.lastDuration || errorItem.actualDurationSec);
  body.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <span class="pill" style="background:#fff1f2;border-color:#fecdd3;color:#be123c">错 ${Math.max(0, wrongCount)} 次</span>
      ${recentDuration ? `<span class="pill" style="background:#ecfeff;border-color:#a5f3fc;color:#155e75">最近用时 ${escapeHtml(recentDuration)}</span>` : ''}
      ${targetDuration ? `<span class="pill" style="background:#eef2ff;border-color:#c7d2fe;color:#3730a3">预计用时 ${escapeHtml(targetDuration)}</span>` : ''}
      <span class="pill">更新时间 ${escapeHtml(formatGlobalSearchTimeLabel(updatedAt))}</span>
    </div>
    <div style="font-size:12px;color:#64748b;line-height:1.8;margin-bottom:8px">${escapeHtml(knowledgePath || '未分类')}</div>
    <div style="font-size:16px;font-weight:700;line-height:1.8;color:#0f172a;margin-bottom:8px;word-break:break-word">${escapeHtml(errorItem.question || '')}</div>
    ${errorItem.options ? `<div style="font-size:13px;line-height:1.8;color:#334155;margin-bottom:8px;white-space:pre-wrap">${escapeHtml(String(errorItem.options || '').replace(/\|/g, '\n'))}</div>` : ''}
    <div style="font-size:13px;line-height:1.8;color:#0f172a;margin-bottom:8px"><strong>答案：</strong>${escapeHtml(errorItem.answer || '-')}</div>
    ${errorItem.analysis ? `<div style="font-size:13px;line-height:1.9;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;white-space:pre-wrap">${renderAnalysis(errorItem.analysis)}</div>` : ''}
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">
      <button class="btn btn-secondary" type="button" onclick='closeGlobalSearchQuestionPreview();openEditModal(${idArg(errorItem.id)})'>编辑这题</button>
      <button class="btn btn-secondary" type="button" onclick='startSingleQuestionPracticeFromSearch(${idArg(errorItem.id)})'>单题练习</button>
      <button class="btn btn-primary" type="button" onclick='jumpToQuestionKnowledgeFromSearch(${idArg(errorItem.id)})'>跳到知识点</button>
    </div>
  `;
  mask.classList.add('open');
  return true;
}

async function startSingleQuestionPracticeFromSearch(errorId) {
  const errorItem = findErrorById(errorId);
  if (!errorItem) {
    showToast('未找到错题', 'warning');
    return;
  }
  if (typeof ensureQuizModalReady === 'function') {
    const ready = await ensureQuizModalReady();
    if (!ready) return;
  }
  quizQueue = [errorItem];
  quizIdx = 0;
  quizAnswers = [];
  quizSkipped = new Set();
  quizSessionMode = 'direct';
  closeGlobalSearchQuestionPreview();
  document.getElementById('quizTitleText').textContent = '错题速练（单题）';
  openModal('quizModal');
  renderQuizQuestion();
}

function jumpToQuestionKnowledgeFromSearch(errorId) {
  const errorItem = findErrorById(errorId);
  if (!errorItem) {
    showToast('未找到错题', 'warning');
    return;
  }
  closeGlobalSearchQuestionPreview();
  if (!errorItem.noteNodeId) {
    if (typeof openEditModal === 'function') openEditModal(errorId);
    return;
  }
  if (typeof setCurrentKnowledgeNode === 'function') {
    setCurrentKnowledgeNode(errorItem.noteNodeId, { switchTab: true });
  }
}

function activateGlobalSearchResult(result) {
  if (!result || !result.kind || !result.id) return false;
  if (result.kind === 'question') {
    closeGlobalSearchModal(true);
    if (typeof switchAppView === 'function') switchAppView('workspace');
    return openGlobalSearchQuestionPreview(result.id);
  }
  if (result.kind === 'note') {
    closeGlobalSearchModal(true);
    setCurrentKnowledgeNode(result.id, { switchTab: true });
    return true;
  }
  return false;
}
