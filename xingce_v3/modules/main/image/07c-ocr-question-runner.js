// ============================================================
// OCR question execution helpers
// ============================================================
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
