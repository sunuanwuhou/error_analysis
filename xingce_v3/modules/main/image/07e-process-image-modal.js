// ============================================================
// Process image modal and persistence helpers
// ============================================================
function getProcessImageUrl(errorItem) {
  const processImage = errorItem && errorItem.processImage;
  return processImage && typeof processImage.imageUrl === 'string' ? processImage.imageUrl : '';
}

function getProcessImagePayload(errorId) {
  const errorItem = findErrorById(errorId);
  if (!errorItem) return null;
  const parts = getErrorKnowledgePathTitles(errorItem);
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
      <img src="${escapeHtml(imageUrl)}" class="process-image-preview-thumb" loading="lazy" decoding="async" onclick="this.classList.toggle('expanded')" title="click to zoom">
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
  const quizModal = document.getElementById('quizModal');
  if (quizModal && quizModal.classList.contains('open')) {
    quizModal.classList.add('process-image-underlay');
  }
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
  document.getElementById('quizModal')?.classList.remove('process-image-underlay');
}
