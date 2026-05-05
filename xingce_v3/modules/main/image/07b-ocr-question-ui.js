// ============================================================
// OCR question panel and field actions
// ============================================================
function applyOCRQuestionField(field) {
  if (!questionOCRResult) return;
  if (field === 'question') {
    const el = document.getElementById('editQuestion');
    if (el) el.value = questionOCRResult.question || '';
  } else if (field === 'options') {
    const el = document.getElementById('editOptions');
    if (el) el.value = questionOCRResult.options || '';
  } else if (field === 'all') {
    const qEl = document.getElementById('editQuestion');
    const oEl = document.getElementById('editOptions');
    if (qEl) qEl.value = questionOCRResult.question || '';
    if (oEl) oEl.value = questionOCRResult.options || '';
  } else if (field === 'append') {
    const el = document.getElementById('editAnalysis');
    if (el) {
      const base = String(el.value || '');
      const text = String(questionOCRResult.rawText || '').trim();
      el.value = base ? `${base}\n\n${text}` : text;
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

function updateQuestionOCRStatus(text, tone) {
  const el = document.getElementById('ocrQuestionStatus');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = tone === 'error' ? '#dc2626' : tone === 'success' ? '#047857' : '#888';
}
