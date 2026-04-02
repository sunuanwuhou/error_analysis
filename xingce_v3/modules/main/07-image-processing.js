// ============================================================
// 图片处理（直接 base64 存在 e.imgData，无 IndexedDB）
// ============================================================
function setEditImgPreview(b64) {
  editImgBase64 = b64;
  document.getElementById('imgPreview').src = b64;
  document.getElementById('imgFormGroup').style.display = 'block';
  const currentBtn = document.getElementById('ocrCurrentImgBtn');
  if (currentBtn) currentBtn.style.display = '';
}
function clearEditImg(isUserAction) {
  editImgBase64 = null;
  if(isUserAction) editImgDeleted = true;
  document.getElementById('imgFormGroup').style.display = 'none';
  document.getElementById('imgPreview').src = '';
  const currentBtn = document.getElementById('ocrCurrentImgBtn');
  if (currentBtn) currentBtn.style.display = 'none';
}
function readFileAsBase64(file) {
  return new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(file);});
}
function isRemoteImageRef(value) {
  return typeof value === 'string' && value.startsWith('/api/images/');
}
function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl || '').split(',');
  if (parts.length < 2) throw new Error('invalid data url');
  const mimeMatch = parts[0].match(/^data:([^;]+);base64$/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime, bytes };
}
async function uploadImageValue(value) {
  if (!value || !String(value).startsWith('data:')) return value;
  try {
    const { mime, bytes } = dataUrlToBytes(value);
    const res = await fetch('/api/images', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': mime },
      body: bytes
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || 'image upload failed');
    return data.url || value;
  } catch (e) {
    console.warn('[uploadImageValue] fallback to inline image', e);
    return value;
  }
}
async function imageValueToBytes(value) {
  if (!value) throw new Error('image is empty');
  if (String(value).startsWith('data:')) {
    const { mime, bytes } = dataUrlToBytes(value);
    return { mime, bytes };
  }
  if (isRemoteImageRef(value)) {
    const res = await fetch(value, { credentials: 'include' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || data.error || 'image fetch failed');
    }
    const mime = res.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { mime, bytes };
  }
  throw new Error('unsupported image reference');
}
function normalizeOCRText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}
function parseOCRQuestionPayload(text) {
  const normalized = normalizeOCRText(text)
    .replace(/\s([A-D])[\.、]/g, '\n$1.')
    .replace(/([（(][A-D][）)])/g, '\n$1');
  const compact = normalized.split('\n').map(line => line.trim()).filter(Boolean);
  const optionStart = compact.findIndex(line => /^[A-D][\.\u3001]/.test(line) || /^[（(][A-D][）)]/.test(line));
  if (optionStart === -1) {
    return { question: normalized, options: '' };
  }
  const question = compact.slice(0, optionStart).join('\n').trim();
  const options = compact.slice(optionStart).join('|').trim();
  return { question, options };
}
parseOCRQuestionPayload = function(text) {
  const normalized = normalizeOCRText(text)
    .replace(/\s+([A-D])[\.\u3001]/g, '\n$1.')
    .replace(/\s+([A-D])\s+/g, '\n$1. ');
  const compact = normalized.split('\n').map(line => line.trim()).filter(Boolean);
  const optionStart = compact.findIndex(line => /^[A-D][\.\u3001]/.test(line));
  if (optionStart !== -1) {
    const question = compact.slice(0, optionStart).join('\n').trim();
    const options = compact.slice(optionStart).join('|').trim();
    return { question, options };
  }
  if (compact.length >= 3) {
    const numericOptionLines = compact.slice(1).filter(line => /^-?\d+(?:\.\d+)?$/.test(line.replace(/\s+/g, '')));
    if (numericOptionLines.length >= 2) {
      const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
      const options = numericOptionLines
        .slice(0, labels.length)
        .map((line, idx) => `${labels[idx]}. ${line.replace(/\s+/g, '')}`)
        .join('|');
      return { question: compact[0], options };
    }
  }
  return { question: normalized, options: '' };
};

function applyOCRQuestionField(field) {
  if (!questionOCRResult) return;
  if (field === 'question') {
    const el = document.getElementById('editQuestion');
    if (el && questionOCRResult.question) {
      el.value = questionOCRResult.question;
      autoDetectType(el.value);
    }
  } else if (field === 'options') {
    const el = document.getElementById('editOptions');
    if (el && questionOCRResult.options) el.value = questionOCRResult.options;
  } else if (field === 'all') {
    applyOCRQuestionField('question');
    applyOCRQuestionField('options');
  } else if (field === 'append') {
    const el = document.getElementById('editQuestion');
    if (el && questionOCRResult.rawText) {
      el.value = `${el.value.trim()}\n${questionOCRResult.rawText}`.trim();
      autoDetectType(el.value);
    }
  }
  updateQuestionOCRStatus('已回填，可继续修改', 'success');
}
function renderQuestionOCRPanel() {
  const panel = document.getElementById('ocrQuestionPanel');
  if (!panel) return;
  if (!questionOCRResult) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }
  const rawText = escapeHtml(questionOCRResult.rawText || '');
  const questionText = escapeHtml(questionOCRResult.question || '');
  const optionsText = escapeHtml(questionOCRResult.options || '');
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <div style="font-weight:700;color:#475569">OCR 识别结果</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyOCRQuestionField('question')">回填题干</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyOCRQuestionField('options')" ${questionOCRResult.options ? '' : 'disabled'}>回填选项</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyOCRQuestionField('all')" ${questionOCRResult.options ? '' : 'disabled'}>全部回填</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyOCRQuestionField('append')">追加原文</button>
      </div>
    </div>
    <div style="display:grid;gap:8px">
      <div style="padding:8px 10px;background:#fff;border:1px solid #eceff3;border-radius:8px">
        <div style="font-weight:600;color:#334155;margin-bottom:4px">拆分后的题干</div>
        <div style="white-space:pre-wrap;word-break:break-word">${questionText || '<span style="color:#94a3b8">未拆出题干</span>'}</div>
      </div>
      <div style="padding:8px 10px;background:#fff;border:1px solid #eceff3;border-radius:8px">
        <div style="font-weight:600;color:#334155;margin-bottom:4px">拆分后的选项</div>
        <div style="white-space:pre-wrap;word-break:break-word">${optionsText || '<span style="color:#94a3b8">未识别出标准选项结构</span>'}</div>
      </div>
      <div style="padding:8px 10px;background:#fff;border:1px solid #eceff3;border-radius:8px">
        <div style="font-weight:600;color:#334155;margin-bottom:4px">原始识别文本</div>
        <div style="white-space:pre-wrap;word-break:break-word">${rawText || '<span style="color:#94a3b8">无结果</span>'}</div>
      </div>
    </div>
  `;
  panel.style.display = '';
}
function useQuestionOCRAlternative(index) {
  if (!questionOCRResult || !Array.isArray(questionOCRResult.alternatives)) return;
  const alt = questionOCRResult.alternatives[index];
  if (!alt) return;
  const normalized = normalizeOCRText(alt.text || '');
  const parsed = parseOCRQuestionPayload(normalized);
  questionOCRResult.rawText = normalized;
  questionOCRResult.question = parsed.question || '';
  questionOCRResult.options = parsed.options || '';
  questionOCRResult.lineCount = Number(alt.lineCount || questionOCRResult.lineCount || 0);
  questionOCRResult.variant = alt.variant || questionOCRResult.variant || '';
  renderQuestionOCRPanel();
  updateQuestionOCRStatus('已切换识别候选，请确认后回填', 'success');
}

renderQuestionOCRPanel = function() {
  const panel = document.getElementById('ocrQuestionPanel');
  if (!panel) return;
  if (!questionOCRResult) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }
  const rawText = escapeHtml(questionOCRResult.rawText || '');
  const questionText = escapeHtml(questionOCRResult.question || '');
  const optionsText = escapeHtml(questionOCRResult.options || '');
  const hintText = escapeHtml(questionOCRResult.hint || '');
  const metaText = [questionOCRResult.engine || '', questionOCRResult.variant || '', questionOCRResult.lineCount ? `${questionOCRResult.lineCount} lines` : '']
    .filter(Boolean)
    .join(' / ');
  const alternatives = (Array.isArray(questionOCRResult.alternatives) ? questionOCRResult.alternatives : [])
    .map((alt, idx) => {
      const text = escapeHtml(normalizeOCRText(alt.text || '')).replace(/\n/g, '<br>');
      const variant = escapeHtml(alt.variant || `candidate-${idx + 1}`);
      const isActive = (alt.variant || '') === (questionOCRResult.variant || '');
      const quality = Number(alt.quality || 0);
      return `
        <div class="ocr-alt-card${isActive ? ' active' : ''}">
          <div class="ocr-alt-head">
            <div>
              <div style="font-weight:600;color:#334155">${variant}</div>
              <div class="ocr-alt-meta">${quality ? `score ${quality.toFixed(2)}` : 'candidate'}</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="useQuestionOCRAlternative(${idx})">使用这条</button>
          </div>
          <div style="font-size:12px;line-height:1.6;color:#475569;max-height:120px;overflow:auto;white-space:normal">${text || '<span style="color:#94a3b8">empty</span>'}</div>
        </div>
      `;
    })
    .join('');
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <div>
        <div style="font-weight:700;color:#475569">OCR 识别结果</div>
        <div style="font-size:12px;color:#64748b">${escapeHtml(metaText || 'tesseract')}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyOCRQuestionField('question')">回填题干</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyOCRQuestionField('options')" ${questionOCRResult.options ? '' : 'disabled'}>回填选项</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyOCRQuestionField('all')" ${questionOCRResult.options ? '' : 'disabled'}>全部回填</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyOCRQuestionField('append')">追加原文</button>
      </div>
    </div>
    <div style="display:grid;gap:10px">
      <div style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff">
        <div style="font-weight:600;color:#334155;margin-bottom:4px">题干</div>
        <div style="white-space:pre-wrap;color:#0f172a">${questionText || '<span style="color:#94a3b8">未识别到题干</span>'}</div>
      </div>
      <div style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff">
        <div style="font-weight:600;color:#334155;margin-bottom:4px">选项</div>
        <div style="white-space:pre-wrap;color:#0f172a">${optionsText || '<span style="color:#94a3b8">未拆出选项</span>'}</div>
      </div>
      <div style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff">
        <div style="font-weight:600;color:#334155;margin-bottom:4px">原始识别文本</div>
        <div style="white-space:pre-wrap;color:#475569;max-height:160px;overflow:auto">${rawText || '<span style="color:#94a3b8">empty</span>'}</div>
      </div>
      ${hintText ? `<div style="padding:10px 12px;border:1px solid #fde68a;border-radius:10px;background:#fffbeb;color:#92400e;font-size:12px;line-height:1.7">${hintText}</div>` : ''}
      ${alternatives ? `<div class="ocr-alt-grid"><div style="font-weight:600;color:#334155">候选结果</div>${alternatives}</div>` : ''}
    </div>
  `;
  panel.style.display = '';
};

function updateQuestionOCRStatus(text, tone) {
  const el = document.getElementById('ocrQuestionStatus');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = tone === 'error' ? '#dc2626' : tone === 'success' ? '#047857' : '#888';
}
async function runQuestionOCRFromBytes(fileName, mime, bytes, previewBase64) {
  if (questionOCRBusy) return;
  questionOCRBusy = true;
  const btn = document.getElementById('ocrQuestionBtn');
  const currentBtn = document.getElementById('ocrCurrentImgBtn');
  if (btn) btn.disabled = true;
  if (currentBtn) currentBtn.disabled = true;
  updateQuestionOCRStatus('识别中...', 'muted');
  try {
    const form = new FormData();
    const blob = new Blob([bytes], { type: mime || 'image/jpeg' });
    form.append('file', blob, fileName || 'question-image');
    const res = await fetch('/api/ai/ocr-image', {
      method: 'POST',
      credentials: 'include',
      body: form
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || 'OCR failed');
    const result = data.result || {};
    const parsed = parseOCRQuestionPayload(result.text || '');
    questionOCRResult = {
      rawText: normalizeOCRText(result.text || ''),
      question: parsed.question || '',
      options: parsed.options || '',
      lineCount: Number(result.lineCount || 0),
      engine: result.engine || '',
      variant: result.variant || '',
      alternatives: Array.isArray(result.alternatives) ? result.alternatives : [],
      hint: result.hint || ''
    };
    renderQuestionOCRPanel();
    if (previewBase64) {
      editImgDeleted = false;
      setEditImgPreview(previewBase64);
    }
    const lineCount = Number(result.lineCount || 0);
    updateQuestionOCRStatus(`已识别 ${lineCount} 段，先确认后回填`, 'success');
  } catch (e) {
    questionOCRResult = null;
    renderQuestionOCRPanel();
    updateQuestionOCRStatus(e.message || 'OCR 失败', 'error');
    showToast(e.message || 'OCR 失败', 'error');
  } finally {
    questionOCRBusy = false;
    if (btn) btn.disabled = false;
    if (currentBtn) currentBtn.disabled = false;
  }
}
async function handleQuestionOCRFile(event) {
  const input = event && event.target;
  const file = input && input.files && input.files[0];
  if (!file) return;
  const previewBase64 = await readFileAsBase64(file);
  editImgDeleted = false;
  setEditImgPreview(previewBase64);
  const bytes = new Uint8Array(await file.arrayBuffer());
  await runQuestionOCRFromBytes(file.name || 'question-image', file.type || 'image/jpeg', bytes, previewBase64);
  if (input) input.value = '';
}
async function runQuestionOCRFromCurrentImage() {
  try {
    const source = editImgBase64 || document.getElementById('imgPreview')?.src || '';
    if (!source) {
      showToast('当前没有题图可识别', 'warning');
      return;
    }
    const { mime, bytes } = await imageValueToBytes(source);
    await runQuestionOCRFromBytes('current-question-image', mime, bytes, editImgBase64 || null);
  } catch (e) {
    updateQuestionOCRStatus(e.message || 'OCR 失败', 'error');
    showToast(e.message || 'OCR 失败', 'error');
  }
}
async function unrefImageValue(value) {
  if (!isRemoteImageRef(value)) return;
  try {
    await fetch(`${value}/unref`, { method: 'DELETE', credentials: 'include' });
  } catch (e) {
    console.warn('[unrefImageValue] failed', e);
  }
}
// 解析图片
function getProcessImageUrl(errorItem) {
  const processImage = errorItem && errorItem.processImage;
  return processImage && typeof processImage.imageUrl === 'string' ? processImage.imageUrl : '';
}
function noteContentHasImage(content) {
  const text = String(content || '');
  return /noteimg:/i.test(text) || /!\[[^\]]*\]\([^)]+\)/.test(text) || /<img\b/i.test(text);
}
function getGlobalSearchPayload() {
  ensureKnowledgeState();
  const questions = getErrorEntries().map(errorItem => {
    const node = errorItem.noteNodeId ? getKnowledgeNodeById(errorItem.noteNodeId) : null;
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
function activateGlobalSearchResult(result) {
  if (!result || !result.kind || !result.id) return false;
  if (result.kind === 'question') {
    closeGlobalSearchModal(true);
    jumpToErrorInList(result.id);
    return true;
  }
  if (result.kind === 'note') {
    closeGlobalSearchModal(true);
    setCurrentKnowledgeNode(result.id, { switchTab: true });
    return true;
  }
  return false;
}
function getProcessImagePayload(errorId) {
  const errorItem = findErrorById(errorId);
  if (!errorItem) return null;
  const parts = [errorItem.type, errorItem.subtype, errorItem.subSubtype].filter(Boolean);
  return {
    id: errorItem.id,
    title: parts.join(' / ') || `#${errorItem.id}`,
    question: errorItem.question || '',
    imageUrl: getProcessImageUrl(errorItem),
    updatedAt: errorItem.processImage && errorItem.processImage.updatedAt ? errorItem.processImage.updatedAt : ''
  };
}
async function saveProcessImageValue(errorId, nextValue) {
  const errorItem = findErrorById(errorId);
  if (!errorItem) throw new Error('question not found');
  const previousUrl = getProcessImageUrl(errorItem);
  let finalUrl = nextValue || '';
  if (finalUrl) finalUrl = await uploadImageValue(finalUrl);
  if (previousUrl && previousUrl !== finalUrl) {
    await unrefImageValue(previousUrl);
  }
  if (finalUrl) {
    errorItem.processImage = { imageUrl: finalUrl, updatedAt: new Date().toISOString() };
  } else {
    delete errorItem.processImage;
  }
  errorItem.updatedAt = new Date().toISOString();
  recordErrorUpsert(errorItem);
  saveData();
  renderAll();
  if (typeof renderNotesPanelRight === 'function') renderNotesPanelRight();
  if (document.getElementById('quizModal')?.classList.contains('open')) {
    const currentQuiz = quizQueue[quizIdx];
    if (currentQuiz && normalizeErrorId(currentQuiz.id) === normalizeErrorId(errorItem.id)) renderQuizQuestion();
  }
  showToast(finalUrl ? '过程图已保存' : '过程图已移除', 'success');
  return errorItem.processImage || null;
}
function renderProcessImagePreview(errorItem, source) {
  const imageUrl = getProcessImageUrl(errorItem);
  if (!imageUrl) return '';
  const idLit = idArg(errorItem.id);
  const sourceText = JSON.stringify(source || 'card');
  const updatedAt = errorItem.processImage && errorItem.processImage.updatedAt
    ? new Date(errorItem.processImage.updatedAt).toLocaleString()
    : '';
  return `<details class="process-image-preview-block ${source === 'quiz' ? 'process-image-preview-quiz' : ''}">
    <summary class="process-image-preview-toggle">
      <div>
        <div class="process-image-preview-label">&#36807;&#31243;&#22270;</div>
        ${updatedAt ? `<div class="process-image-preview-meta">${escapeHtml(updatedAt)}</div>` : ''}
      </div>
    </summary>
    <div class="process-image-preview-body">
      <button class="btn btn-sm btn-secondary process-image-action-btn" onclick='openProcessImageEditor(${idLit}, ${sourceText})'>&#32534;&#36753;&#36807;&#31243;&#22270;</button>
      <img src="${escapeHtml(imageUrl)}" class="process-image-preview-thumb" onclick="this.classList.toggle('expanded')" title="click to zoom">
    </div>
  </details>`;
}
function ensureProcessImageEditorModal() {
  let mask = document.getElementById('processImageEditorModal');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'processImageEditorModal';
  mask.className = 'modal-mask process-image-modal-mask';
  mask.innerHTML = '' +
    '<div class="process-image-modal" role="dialog" aria-modal="true" aria-label="process image editor">' +
      '<button class="process-image-modal-close" type="button" aria-label="Close">&times;</button>' +
      '<iframe id="processImageEditorFrame" class="process-image-modal-frame" title="process image editor"></iframe>' +
    '</div>';
  function requestClose() {
    const frame = document.getElementById('processImageEditorFrame');
    const child = frame && frame.contentWindow;
    if (child && typeof child.requestProcessImageEditorClose === 'function') {
      if (child.requestProcessImageEditorClose(false) === false) return;
    }
    closeProcessImageEditorModal(true);
  }
  mask.addEventListener('click', function (event) {
    if (event.target === mask) requestClose();
  });
  mask.querySelector('.process-image-modal-close').addEventListener('click', requestClose);
  document.body.appendChild(mask);
  return mask;
}
function openProcessImageEditor(errorId, source) {
  const payload = getProcessImagePayload(errorId);
  if (!payload) {
    showToast('未找到对应题目', 'warning');
    return;
  }
  const mask = ensureProcessImageEditorModal();
  const frame = document.getElementById('processImageEditorFrame');
  frame.src = `/assets/process_image_editor.html?errorId=${encodeURIComponent(payload.id)}&embed=1&source=${encodeURIComponent(source || 'card')}`;
  mask.classList.add('open');
  document.body.classList.add('process-image-modal-open');
}
function closeProcessImageEditorModal(force) {
  const mask = document.getElementById('processImageEditorModal');
  if (!mask) return;
  if (!force) {
    const frame = document.getElementById('processImageEditorFrame');
    const child = frame && frame.contentWindow;
    if (child && typeof child.requestProcessImageEditorClose === 'function') {
      if (child.requestProcessImageEditorClose(false) === false) return;
    }
  }
  mask.classList.remove('open');
  document.body.classList.remove('process-image-modal-open');
}
function ensureGlobalSearchModal() {
  let mask = document.getElementById('globalSearchModal');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'globalSearchModal';
  mask.className = 'modal-mask global-search-modal-mask';
  mask.innerHTML = '' +
    '<div class="global-search-modal" role="dialog" aria-modal="true" aria-label="global search">' +
      '<button class="global-search-modal-close" type="button" aria-label="Close">&times;</button>' +
      '<iframe id="globalSearchFrame" class="global-search-modal-frame" title="global search"></iframe>' +
    '</div>';
  mask.addEventListener('click', function(event) {
    if (event.target === mask) closeGlobalSearchModal(true);
  });
  mask.querySelector('.global-search-modal-close').addEventListener('click', function() {
    closeGlobalSearchModal(true);
  });
  document.body.appendChild(mask);
  return mask;
}
function openGlobalSearchModal(initialQuery) {
  const mask = ensureGlobalSearchModal();
  const frame = document.getElementById('globalSearchFrame');
  const nextQuery = typeof initialQuery === 'string' ? initialQuery : (searchKw || '');
  frame.src = `/assets/global_search.html?embed=1&q=${encodeURIComponent(nextQuery)}`;
  mask.classList.add('open');
  document.body.classList.add('global-search-modal-open');
}
function closeGlobalSearchModal(force) {
  const mask = document.getElementById('globalSearchModal');
  if (!mask) return;
  mask.classList.remove('open');
  document.body.classList.remove('global-search-modal-open');
  if (force) {
    const frame = document.getElementById('globalSearchFrame');
    if (frame) frame.src = 'about:blank';
  }
}
function setEditAnalysisImgPreview(b64) {
  editAnalysisImgBase64 = b64;
  document.getElementById('analysisImgPreview').src = b64;
  document.getElementById('analysisImgFormGroup').style.display = 'block';
}
function clearEditAnalysisImg(isUserAction) {
  editAnalysisImgBase64 = null;
  if(isUserAction) editAnalysisImgDeleted = true;
  document.getElementById('analysisImgFormGroup').style.display = 'none';
  document.getElementById('analysisImgPreview').src = '';
}

// 搜索框 X 按钮
function updateSearchClear() {
  const v = document.getElementById('searchInput').value;
  document.getElementById('searchClear').style.display = v ? 'block' : 'none';
}
function clearSearchInput() {
  document.getElementById('searchInput').value = '';
  updateSearchClear();
  searchKw = '';
  renderAll();
}

// 日期筛选
function applyDateFilter() {
  dateFrom = document.getElementById('dateFrom').value;
  dateTo   = document.getElementById('dateTo').value;
  renderAll();
}
function clearDateFilter() {
  dateFrom = ''; dateTo = '';
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value = '';
  renderAll();
}

// 在题目/解析文本框中粘贴图片
document.addEventListener('paste', async e=>{
  const items=Array.from(e.clipboardData.items||[]);
  const imgItem = items.find(i=>i.type.startsWith('image/'));

  // 笔记 textarea 图片粘贴：存入 noteImages，插入短引用
  if(e.target.id === 'noteTypeTextarea'){
    if(!imgItem) return;
    e.preventDefault();
    const b64=await readFileAsBase64(imgItem.getAsFile());
    const id=noteImgId();
    noteImages[id]=await uploadImageValue(b64);
    saveNotesByType(); // 持久化图片
    const ta=e.target;
    const start=ta.selectionStart, end=ta.selectionEnd;
    const insertion=`![图片](noteimg:${id})`;
    ta.value=ta.value.substring(0,start)+insertion+ta.value.substring(end);
    ta.selectionStart=ta.selectionEnd=start+insertion.length;
    liveNotePreview();
    return;
  }

  // 题目/解析文本框图片粘贴
  if(!document.getElementById('addModal').classList.contains('open')) return;
  if(!imgItem) return;
  if(e.target.id === 'editQuestion'){
    e.preventDefault();
    const b64=await readFileAsBase64(imgItem.getAsFile());
    setEditImgPreview(b64);
  } else if(e.target.id === 'editAnalysis'){
    e.preventDefault();
    const b64=await readFileAsBase64(imgItem.getAsFile());
    setEditAnalysisImgPreview(b64);
  }
});

// checkStorageUsage 已在上方 IndexedDB 层定义
