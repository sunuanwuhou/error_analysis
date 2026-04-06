(function(){
  const STORAGE_KEY = 'process_canvas_activity_v1';
  const MAX_EVENTS = 400;
  const DEFAULT_COLOR = '#dc2626';
  const DEFAULT_WIDTH = 3;
  const stateMap = new Map();
  let statsBtnInjected = false;
  let quizCanvasCardId = '';

  function nowIso(){ return new Date().toISOString(); }
  function esc(s){ return typeof window.escapeHtml === 'function' ? window.escapeHtml(String(s ?? '')) : String(s ?? ''); }
  function normalizeId(v){ return v == null ? '' : String(v); }
  function getErrors(){
    try {
      if (typeof window.getErrorEntries === 'function') {
        const list = window.getErrorEntries();
        if (Array.isArray(list)) return list;
      }
    } catch (e) {}
    return Array.isArray(window.errors) ? window.errors : [];
  }
  function getErrorItem(id){
    const targetId = normalizeId(id);
    if (!targetId) return null;
    try {
      if (typeof window.findErrorById === 'function') {
        const hit = window.findErrorById(targetId);
        if (hit) return hit;
      }
    } catch (e) {}
    return getErrors().find(item => normalizeId(item?.id || item?.questionId) === targetId) || null;
  }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function saveAll(){
    if (typeof window.saveData === 'function') window.saveData();
  }
  function upsert(item){
    item.updatedAt = nowIso();
    if (typeof window.recordErrorUpsert === 'function') window.recordErrorUpsert(item);
    saveAll();
  }
  function buildStage(card){
    let stage = card.querySelector('.pc-stage');
    if (stage) return stage;
    const questionSurface = card.querySelector('.card-question-surface');
    const quizSheetPanel = card.querySelector('.quiz-sheet-panel');
    const quizImageWrap = card.querySelector('.quiz-image-wrap');
    const anchors = questionSurface
      ? [questionSurface]
      : quizSheetPanel
      ? [quizSheetPanel]
      : quizImageWrap
        ? [quizImageWrap]
        : [
            card.querySelector('.card-question'),
            ...card.querySelectorAll(':scope > .cuoti-img, :scope > .process-image-preview-block, :scope > .card-options')
          ].filter(Boolean);
    if (!anchors.length) return null;
    stage = document.createElement('div');
    stage.className = 'pc-stage';
    if (questionSurface || quizSheetPanel) stage.classList.add('pc-stage-question-sheet');
    else if (quizImageWrap) stage.classList.add('pc-stage-image-only');
    const toolbar = document.createElement('div');
    toolbar.className = 'pc-toolbar';
    toolbar.innerHTML = `
      <span class="pc-badge" data-pc-status-badge>未标注</span>
      <button type="button" class="pc-tool-btn" data-pc-action="undo">撤销</button>
      <button type="button" class="pc-tool-btn" data-pc-action="clear">清空</button>
      <button type="button" class="pc-tool-btn" data-pc-action="export">导出图片</button>
      <button type="button" class="pc-tool-btn is-primary" data-pc-action="exit">退出</button>
    `;
    const toast = document.createElement('div');
    toast.className = 'pc-toast';
    toast.textContent = '已保存';
    const content = document.createElement('div');
    content.className = 'pc-stage-content';
    anchors[0].parentNode.insertBefore(stage, anchors[0]);
    stage.appendChild(toolbar);
    stage.appendChild(content);
    stage.appendChild(toast);
    anchors.forEach(node => content.appendChild(node));
    const canvas = document.createElement('canvas');
    canvas.className = 'pc-canvas-layer';
    stage.appendChild(canvas);
    return stage;
  }
  function fitCanvas(stage){
    const canvas = stage.querySelector('.pc-canvas-layer');
    const content = stage.querySelector('.pc-stage-content');
    if (!canvas || !content) return;
    const rect = content.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(content.scrollHeight || content.offsetHeight || rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function defaultCanvasState(item){
    const data = item?.processCanvas || {};
    return {
      version: 'v5',
      strokes: Array.isArray(data.strokes) ? clone(data.strokes) : [],
      redoStack: [],
      tool: 'pen',
      color: DEFAULT_COLOR,
      width: DEFAULT_WIDTH,
      dirty: false,
      saving: false,
      savedAt: data.savedAt || '',
      updatedAt: data.updatedAt || '',
      stageWidth: data.canvasSize?.width || 0,
      stageHeight: data.canvasSize?.height || 0,
      previewDataUrl: data.previewDataUrl || '',
      reviewMeta: clone(item?.reviewMeta || {}),
      stats: clone(data.stats || { openCount:0, saveCount:0, editSec:0, strokeCount:0 }),
    };
  }
  function getUiState(card){
    const id = normalizeId(card.dataset.errorId || card.id.replace(/^card-/, ''));
    if (!id) return null;
    let state = stateMap.get(id);
    if (!state) {
      const item = getErrorItem(id);
      state = defaultCanvasState(item || {});
      stateMap.set(id, state);
    }
    return state;
  }
  function getStatusText(item, state){
    if (state?.saving || state?.dirty) return '自动保存中';
    if (item?.processCanvas?.savedAt) return '已保存';
    return '未标注';
  }
  function updateToolbarState(card){
    const state = getUiState(card);
    const item = getErrorItem(card.dataset.errorId || card.id.replace(/^card-/, ''));
    const stage = card.querySelector('.pc-stage');
    if (stage && state) {
      const badge = stage.querySelector('[data-pc-status-badge]');
      if (badge) badge.textContent = getStatusText(item, state);
    }
    const wrap = card.querySelector('.pc-entry-wrap');
    if (wrap && state) {
      const status = wrap.querySelector('.pc-entry-status');
      if (status) {
        status.textContent = getStatusText(item, state);
        status.classList.toggle('is-dirty', !!state.dirty || !!state.saving);
      }
      const btn = wrap.querySelector('.pc-entry-btn');
      if (btn) btn.textContent = card.classList.contains('pc-editing') ? '退出画布' : '画布';
      const preview = wrap.querySelector('.pc-preview-chip');
      if (preview) preview.style.display = item?.processCanvas?.previewDataUrl ? '' : 'none';
    }
  }
  function drawStroke(ctx, stroke, width, height){
    if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color || DEFAULT_COLOR;
    ctx.lineWidth = Number(stroke.width) || DEFAULT_WIDTH;
    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = .65;
    }
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = Math.max(10, Number(stroke.width) || 12);
    }
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      const x = (point[0] || 0) * width;
      const y = (point[1] || 0) * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
  function redraw(card){
    const stage = card.querySelector('.pc-stage');
    const canvas = stage?.querySelector('.pc-canvas-layer');
    const state = getUiState(card);
    if (!canvas || !state) { updateToolbarState(card); return; }
    fitCanvas(stage);
    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    ctx.clearRect(0, 0, width, height);
    state.strokes.forEach(stroke => drawStroke(ctx, stroke, width, height));
    updateToolbarState(card);
  }
  function stagePoint(canvas, event){
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width);
    const y = ((event.clientY - rect.top) / rect.height);
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
  }
  function persistEvent(item, type, extra){
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    list.unshift({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ts: nowIso(),
      type,
      errorId: normalizeId(item?.id),
      typeLabel: item?.type || '',
      subLabel: [item?.subtype, item?.subSubtype].filter(Boolean).join(' / '),
      question: String(item?.question || '').slice(0, 80),
      ...extra,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_EVENTS)));
  }
  function updateReviewMeta(item, state){
    item.reviewMeta = item.reviewMeta || {};
    item.reviewMeta.canvas = {
      lastSavedAt: state.savedAt || '',
      saveCount: Number(state.stats?.saveCount || 0),
      strokeCount: Number(state.stats?.strokeCount || 0),
      editSec: Number(state.stats?.editSec || 0),
    };
  }
  function snapshotPreview(card){
    const stage = card.querySelector('.pc-stage');
    const canvas = stage?.querySelector('.pc-canvas-layer');
    if (!canvas) return '';
    try {
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, 0, 0);
      return out.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  }
  function syncShellAfterSave(card){
    try { if (typeof window.renderSidebar === 'function') window.renderSidebar(); } catch (e) {}
    try { updateToolbarState(card); } catch (e) {}
    try {
      const modal = document.getElementById('processCanvasSummaryModal');
      if (modal?.classList.contains('open')) openSummaryModal();
    } catch (e) {}
  }
  function saveCanvas(card, reason){
    const id = normalizeId(card.dataset.errorId || card.id.replace(/^card-/, ''));
    const item = getErrorItem(id);
    const state = getUiState(card);
    const stage = card.querySelector('.pc-stage');
    const canvas = stage?.querySelector('.pc-canvas-layer');
    if (!state || !canvas) return;
    if (!item) {
      showToast(card, '画布保存失败：未找到题目数据');
      showGlobalToast('画布保存失败：未找到题目数据');
      return;
    }
    clearTimeout(state.autoTimer);
    state.saving = false;
    state.updatedAt = nowIso();
    state.stats = state.stats || {};
    state.stats.saveCount = Number(state.stats.saveCount || 0) + 1;
    state.stats.strokeCount = state.strokes.length;
    if (state.strokes.length) {
      state.savedAt = state.updatedAt;
      item.processCanvas = {
        version: 'v5',
        strokes: clone(state.strokes),
        canvasSize: { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 },
        updatedAt: state.updatedAt,
        savedAt: state.savedAt,
        previewDataUrl: snapshotPreview(card),
        stats: clone(state.stats),
      };
    } else {
      state.savedAt = '';
      delete item.processCanvas;
    }
    state.dirty = false;
    updateReviewMeta(item, state);
    upsert(item);
    showToast(card, state.strokes.length ? '画布已自动保存' : '画布已清空');
    showGlobalToast(state.strokes.length ? '画布已自动保存' : '画布已清空');
    syncShellAfterSave(card);
    persistEvent(item, 'canvas_save', { reason: reason || 'auto', strokeCount: state.strokes.length });
    redraw(card);
  }
  function normalizeOptionsText(value){
    return String(value || '')
      .split(/\n|\|/)
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n');
  }
  function textBlocksFromCard(card, content){
    const blocks = [];
    const id = normalizeId(card?.dataset?.errorId || card?.id?.replace(/^card-/, ''));
    const item = getErrorItem(id);
    if (item) {
      const q = String(item.question || '').trim();
      const o = normalizeOptionsText(item.options);
      const a = [item.answer ? `答案：${item.answer}` : '', item.analysis ? `解析：${item.analysis}` : '']
        .filter(Boolean)
        .join('\n');
      if (q) blocks.push({ label: '题目', text: q });
      if (o) blocks.push({ label: '选项', text: o });
      if (a) blocks.push({ label: '答案/解析', text: a });
      if (blocks.length) return blocks;
    }
    const root = content || card;
    const question = root.querySelector('.card-question, .question-text, .question-content, .cuoti-question') || root;
    const options = root.querySelector('.card-options, .option-list, .options, .cuoti-options');
    const analysis = root.querySelector('.card-analysis, .analysis-content, .card-answer, .answer-analysis, .answer-text');
    const pushText = (label, node) => {
      if (!node) return;
      const text = (node.innerText || node.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (text) blocks.push({ label, text });
    };
    pushText('题目', question);
    pushText('选项', options);
    pushText('答案/解析', analysis);
    if (!blocks.length && root) {
      const fallbackText = (root.innerText || root.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (fallbackText) blocks.push({ label: '题目', text: fallbackText });
    }
    return blocks;
  }
  function wrapTextLines(ctx, text, maxWidth){
    const paragraphs = String(text || '').split(/\n/);
    const lines = [];
    paragraphs.forEach((para) => {
      if (!para.trim()) {
        lines.push('');
        return;
      }
      let line = '';
      Array.from(para).forEach((ch) => {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      });
      if (line) lines.push(line);
    });
    return lines;
  }
  function renderTextFallback(card, content, width, height){
    const out = document.createElement('canvas');
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    out.width = Math.round(width * dpr);
    out.height = Math.round(height * dpr);
    out.style.width = width + 'px';
    out.style.height = height + 'px';
    const ctx = out.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    let y = 26;
    const blocks = textBlocksFromCard(card, content);
    blocks.forEach((block, index) => {
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(block.label, 20, y);
      y += 14;
      ctx.strokeStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.moveTo(20, y + 8);
      ctx.lineTo(width - 20, y + 8);
      ctx.stroke();
      y += 28;
      ctx.fillStyle = '#1e293b';
      ctx.font = '14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const lines = wrapTextLines(ctx, block.text, width - 40);
      lines.forEach((line) => {
        if (y > height - 24) return;
        ctx.fillText(line, 20, y);
        y += line ? 24 : 14;
      });
      if (index !== blocks.length - 1) y += 10;
    });
    return out;
  }

  function canvasLooksBlank(canvas){
    if (!canvas) return true;
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const width = Math.max(1, Math.min(canvas.width || 0, 240));
      const height = Math.max(1, Math.min(canvas.height || 0, 240));
      const sample = ctx.getImageData(0, 0, width, height).data;
      let meaningful = 0;
      for (let i = 0; i < sample.length; i += 16) {
        const a = sample[i + 3];
        const r = sample[i];
        const g = sample[i + 1];
        const b = sample[i + 2];
        if (a > 8 && !(r > 246 && g > 246 && b > 246)) meaningful += 1;
        if (meaningful > 30) return false;
      }
      return meaningful <= 30;
    } catch (e) {
      return false;
    }
  }
  function countMeaningfulPixels(canvas){
    if (!canvas) return 0;
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const width = Math.max(1, Math.min(canvas.width || 0, 480));
      const height = Math.max(1, Math.min(canvas.height || 0, 480));
      const sample = ctx.getImageData(0, 0, width, height).data;
      let meaningful = 0;
      for (let i = 0; i < sample.length; i += 4) {
        const a = sample[i + 3];
        const r = sample[i];
        const g = sample[i + 1];
        const b = sample[i + 2];
        if (a > 8 && !(r > 246 && g > 246 && b > 246)) meaningful += 1;
      }
      return meaningful;
    } catch (e) {
      return 0;
    }
  }
  function inlineStyles(source, target){
    const sourceEls = [source, ...source.querySelectorAll('*')];
    const targetEls = [target, ...target.querySelectorAll('*')];
    for (let i = 0; i < sourceEls.length; i++) {
      const src = sourceEls[i];
      const dst = targetEls[i];
      if (!src || !dst) continue;
      const computed = window.getComputedStyle(src);
      let styleText = '';
      for (const prop of computed) {
        styleText += `${prop}:${computed.getPropertyValue(prop)};`;
      }
      dst.setAttribute('style', styleText);
      if (dst instanceof HTMLImageElement && dst.src) {
        dst.src = new URL(dst.getAttribute('src') || dst.src, window.location.href).href;
      }
    }
  }
  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  async function renderContentByForeignObject(content, width, height){
    const cloneRoot = content.cloneNode(true);
    inlineStyles(content, cloneRoot);
    cloneRoot.querySelectorAll('script').forEach(n => n.remove());
    const wrapper = document.createElement('div');
    wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    wrapper.style.width = width + 'px';
    wrapper.style.height = height + 'px';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.background = '#ffffff';
    wrapper.appendChild(cloneRoot);
    const serialized = new XMLSerializer().serializeToString(wrapper);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject>
      </svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const out = document.createElement('canvas');
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      out.width = Math.round(width * dpr);
      out.height = Math.round(height * dpr);
      out.style.width = width + 'px';
      out.style.height = height + 'px';
      const ctx = out.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      return out;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function buildExportCanvas(card){
    const stage = card.querySelector('.pc-stage');
    const content = stage?.querySelector('.pc-stage-content');
    const overlay = stage?.querySelector('.pc-canvas-layer');
    if (!content || !overlay) throw new Error('stage_missing');
    const width = Math.max(1, Math.round(content.getBoundingClientRect().width));
    const height = Math.max(1, Math.round(content.scrollHeight || content.offsetHeight || overlay.clientHeight || content.getBoundingClientRect().height));
    let base = renderTextFallback(card, content, width, height);
    let mode = 'full';
    const textScore = countMeaningfulPixels(base);
    try {
      const richBase = await renderContentByForeignObject(content, width, height);
      const richScore = countMeaningfulPixels(richBase);
      const richLooksUsable = !canvasLooksBlank(richBase) && richScore >= Math.max(120, Math.round(textScore * 0.45));
      if (richLooksUsable) {
        base = richBase;
      } else {
        mode = 'text';
      }
    } catch (e) {
      mode = 'text';
    }
    const ctx = base.getContext('2d');
    ctx.drawImage(overlay, 0, 0, width, height);
    return { canvas: base, mode };
  }
  async function exportCanvasImage(card){
    const id = normalizeId(card.dataset.errorId || card.id.replace(/^card-/, ''));
    const item = getErrorItem(id);
    try {
      const { canvas, mode } = await buildExportCanvas(card);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `canvas_${id || 'question'}.png`;
      a.click();
      persistEvent(item || { id }, 'canvas_export_image', { mode });
      const msg = mode === 'full' ? '已导出题目+画布' : '已导出题目+画布（简化版）';
      showToast(card, msg);
      showGlobalToast(msg);
    } catch (e) {
      const stage = card.querySelector('.pc-stage');
      const overlay = stage?.querySelector('.pc-canvas-layer');
      if (!overlay) return;
      const a = document.createElement('a');
      a.href = overlay.toDataURL('image/png');
      a.download = `canvas_${id || 'question'}.png`;
      a.click();
      persistEvent(item || { id }, 'canvas_export_image', { mode: 'canvas_only_fallback' });
      showToast(card, '已导出画布');
      showGlobalToast('已导出画布');
    }
  }
  function debounceAutoSave(card){
    const state = getUiState(card);
    if (!state) return;
    clearTimeout(state.autoTimer);
    state.saving = true;
    updateToolbarState(card);
    state.autoTimer = setTimeout(() => saveCanvas(card, 'auto'), 700);
  }
  function ensureGlobalToast(){
    let node = document.getElementById('pcGlobalToast');
    if (node) return node;
    node = document.createElement('div');
    node.id = 'pcGlobalToast';
    node.className = 'pc-global-toast';
    document.body.appendChild(node);
    return node;
  }
  function showGlobalToast(message){
    const toast = ensureGlobalToast();
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 1400);
  }
  function showToast(card, message){
    const toast = card.querySelector('.pc-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 1200);
  }
  function setDirty(card){
    const state = getUiState(card);
    if (!state) return;
    state.dirty = true;
    state.saving = true;
    state.updatedAt = nowIso();
    updateToolbarState(card);
  }
  function bindCanvas(card){
    const stage = card.querySelector('.pc-stage');
    const canvas = stage?.querySelector('.pc-canvas-layer');
    if (!canvas || canvas.dataset.bound === '1') return;
    canvas.dataset.bound = '1';
    let current = null;
    const down = (event) => {
      if (!card.classList.contains('pc-editing')) return;
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      const state = getUiState(card);
      current = {
        tool: 'pen',
        color: state.color || DEFAULT_COLOR,
        width: state.width || DEFAULT_WIDTH,
        points: [stagePoint(canvas, event)],
      };
    };
    const move = (event) => {
      if (!current || !card.classList.contains('pc-editing')) return;
      event.preventDefault();
      current.points.push(stagePoint(canvas, event));
      redraw(card);
      const ctx = canvas.getContext('2d');
      drawStroke(ctx, current, canvas.clientWidth || 1, canvas.clientHeight || 1);
    };
    const up = (event) => {
      if (!current) return;
      event.preventDefault();
      if (current.points.length === 1) current.points.push(current.points[0]);
      const state = getUiState(card);
      state.strokes.push(current);
      state.redoStack = [];
      state.stats = state.stats || {};
      state.stats.strokeCount = state.strokes.length;
      setDirty(card);
      redraw(card);
      debounceAutoSave(card);
      current = null;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }
  function bindToolbar(card){
    const stage = card.querySelector('.pc-stage');
    if (!stage || stage.dataset.toolbarBound === '1') return;
    stage.dataset.toolbarBound = '1';
    stage.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('[data-pc-action]');
      const state = getUiState(card);
      if (!actionBtn || !state) return;
      const action = actionBtn.dataset.pcAction;
      if (action === 'undo') {
        const stroke = state.strokes.pop();
        if (stroke) state.redoStack.push(stroke);
        setDirty(card); redraw(card); debounceAutoSave(card);
      }
      if (action === 'clear') {
        state.redoStack = state.strokes.slice();
        state.strokes = [];
        setDirty(card); redraw(card); debounceAutoSave(card);
      }
      if (action === 'export') {
        exportCanvasImage(card);
      }
      if (action === 'exit') {
        closeEditor(card, true);
      }
    });
  }
  function openEditor(card){
    buildStage(card);
    bindCanvas(card);
    bindToolbar(card);
    const stage = card.querySelector('.pc-stage');
    if (stage) stage.classList.add('is-editing');
    afterOpenEditor(stage);
    fitCanvas(stage);
    redraw(card);
    card.classList.add('pc-editing');
    const state = getUiState(card);
    state.openedAt = Date.now();
    state.stats = state.stats || {};
    state.stats.openCount = Number(state.stats.openCount || 0) + 1;
    updateToolbarState(card);
  }
  function closeEditor(card, autosave){
    const state = getUiState(card);
    const stage = card.querySelector('.pc-stage');
    clearTimeout(state?.autoTimer);
    if (autosave && state?.dirty) saveCanvas(card, 'exit_auto');
    if (state?.openedAt) {
      const secs = Math.max(0, Math.round((Date.now() - state.openedAt) / 1000));
      state.stats = state.stats || {};
      state.stats.editSec = Number(state.stats.editSec || 0) + secs;
      state.openedAt = 0;
    }
    card.classList.remove('pc-editing');
    if (stage) {
      stage.classList.remove('is-editing');
      stage.setAttribute('aria-hidden', 'true');
    }
    if (state) {
      state.dirty = false;
      state.saving = false;
    }
    if (card?.classList?.contains('quiz-process-canvas-host')) {
      toggleQuizCanvasButton(false);
    }
    const closingId = normalizeId(card?.dataset?.errorId || card?.id?.replace(/^card-/, ''));
    if (closingId && closingId === quizCanvasCardId) {
      quizCanvasCardId = '';
      syncQuizUnderlay(false);
    }
    updateToolbarState(card);
  }
  function afterOpenEditor(stage){
    if (stage) stage.removeAttribute('aria-hidden');
  }
  function ensureEntry(card){
    const top = card.querySelector('.card-top');
    const actions = card.querySelector('.card-actions');
    const host = top || actions;
    if (!host || host.querySelector('.pc-entry-wrap')) return;
    const id = normalizeId(card.dataset.errorId || card.id.replace(/^card-/, ''));
    card.dataset.errorId = id;
    const wrap = document.createElement('span');
    wrap.className = 'pc-entry-wrap';
    wrap.innerHTML = `<span class="pc-entry-status">未标注</span><span class="pc-preview-chip" style="display:none">已生成预览</span><button type="button" class="pc-entry-btn">画布</button>`;
    wrap.querySelector('.pc-entry-btn').addEventListener('click', () => {
      if (card.classList.contains('pc-editing')) closeEditor(card, true);
      else openEditor(card);
    });
    host.appendChild(wrap);
  }
  function patchLegacyButtons(card){
    card.classList.add('pc-hidden-old-process');
    card.querySelectorAll('.card-actions .btn').forEach(btn => {
      const txt = (btn.textContent || '').trim();
      if (txt.includes('过程图')) btn.classList.add('pc-hide-legacy-process');
    });
  }
  function hydrateCard(card){
    if (!card || !card.id || !/^card-/.test(card.id)) return;
    if (!card.dataset.errorId) card.dataset.errorId = normalizeId(card.id.replace(/^card-/, ''));
    ensureEntry(card);
    patchLegacyButtons(card);
    updateToolbarState(card);
  }
  function syncQuizUnderlay(active){
    const quizModal = document.getElementById('quizModal');
    if (!quizModal) return;
    quizModal.classList.toggle('process-canvas-underlay', !!active);
  }
  function getQuizCanvasHost(errorId){
    const targetId = normalizeId(errorId);
    if (!targetId) return null;
    try {
      return document.querySelector(`.quiz-process-canvas-host[data-error-id="${CSS.escape(targetId)}"]`);
    } catch (e) {
      return document.querySelector('.quiz-process-canvas-host');
    }
  }
  function toggleQuizCanvasButton(isEditing, btn){
    const target = btn || document.getElementById('quizCanvasToggleBtn');
    if (!target) return;
    target.textContent = isEditing ? '退出画布' : '画布';
  }
  function toggleQuizProcessCanvas(errorId, btn){
    const host = getQuizCanvasHost(errorId);
    if (!host) {
      if (typeof window.showToast === 'function') window.showToast('当前题目还没有可画区域', 'warning');
      return false;
    }
    host.dataset.errorId = normalizeId(errorId);
    if (host.classList.contains('pc-editing')) {
      closeEditor(host, true);
      toggleQuizCanvasButton(false, btn);
      return true;
    }
    openEditor(host);
    toggleQuizCanvasButton(true, btn);
    host.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  function openEditorByErrorId(errorId, opts){
    const targetId = normalizeId(errorId);
    if (!targetId) return false;
    const options = opts || {};
    if (typeof window.openWorkspaceView === 'function') window.openWorkspaceView('errors');
    else if (typeof window.switchTab === 'function') window.switchTab('errors');
    const openAttempt = (attempt) => {
      const card = document.getElementById(`card-${targetId}`);
      if (!card) {
        if (attempt === 0) {
          if (typeof window.setTaskFilter === 'function') window.setTaskFilter('all');
          if (typeof window.renderAll === 'function') window.renderAll();
        }
        if (attempt < 8) {
          setTimeout(() => openAttempt(attempt + 1), 90);
          return;
        }
        if (typeof window.showToast === 'function') window.showToast('未找到对应题目的画布入口', 'warning');
        if (options.fromQuiz) syncQuizUnderlay(false);
      return;
      }
      if (options.fromQuiz) {
        quizCanvasCardId = targetId;
        syncQuizUnderlay(true);
      }
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (card.classList.contains('pc-editing')) {
        closeEditor(card, true);
        if (options.fromQuiz) {
          quizCanvasCardId = targetId;
          syncQuizUnderlay(true);
        }
      }
      openEditor(card);
    };
    openAttempt(0);
    return true;
  }
  function allCards(){ return Array.from(document.querySelectorAll('.error-card[id^="card-"]')); }
  function openSummaryModal(){
    let mask = document.getElementById('processCanvasSummaryModal');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'processCanvasSummaryModal';
      mask.className = 'modal-mask';
      mask.innerHTML = `<div class="modal" style="width:min(980px,96vw);max-width:96vw;max-height:90vh;overflow:auto"><button class="modal-close" type="button">✕</button><h2>画布联动总览</h2><div id="pcSummaryBody"></div></div>`;
      document.body.appendChild(mask);
      mask.addEventListener('click', (e) => { if (e.target === mask) mask.classList.remove('open'); });
      mask.querySelector('.modal-close').addEventListener('click', () => mask.classList.remove('open'));
    }
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const errors = getErrors();
    const withCanvas = errors.filter(item => item?.processCanvas?.savedAt);
    const totalStrokes = withCanvas.reduce((sum, item) => sum + Number(item?.processCanvas?.stats?.strokeCount || item?.processCanvas?.strokes?.length || 0), 0);
    const totalSave = withCanvas.reduce((sum, item) => sum + Number(item?.processCanvas?.stats?.saveCount || 0), 0);
    const body = mask.querySelector('#pcSummaryBody');
    body.innerHTML = `
      <div class="pc-summary-grid">
        <div class="pc-summary-card"><h4>已有画布题目</h4><div class="num">${withCanvas.length}</div></div>
        <div class="pc-summary-card"><h4>累计保存次数</h4><div class="num">${totalSave}</div></div>
        <div class="pc-summary-card"><h4>累计笔迹</h4><div class="num">${totalStrokes}</div></div>
        <div class="pc-summary-card"><h4>最近事件</h4><div class="num">${events.length}</div></div>
      </div>
      <div class="pc-event-list">${events.slice(0,60).map(ev => `<div class="pc-event-item"><div><strong>${esc(ev.type)}</strong> · ${esc(ev.typeLabel)} ${ev.subLabel ? ' / ' + esc(ev.subLabel) : ''}</div><div style="margin-top:4px;color:#64748b">${esc(ev.question || '')}</div><div style="margin-top:4px;color:#94a3b8">${esc(ev.ts)}</div></div>`).join('') || '<div class="pc-event-item">暂无画布联动记录</div>'}</div>
    `;
    mask.classList.add('open');
  }
  function injectStatsEntry(){
    return;
  }
  function patchQuizPanel(){
    return;
  }
  function openCanvasFromQuizFlow(){
    return;
  }
  function patchQuizQuestionActions(){
    return;
  }
  function patchExportModal(){
    const modal = document.querySelector('#exportModal #exportJsonOpts');
    if (!modal || modal.querySelector('[data-pc-export-note]')) return;
    const note = document.createElement('div');
    note.setAttribute('data-pc-export-note','1');
    note.style.cssText = 'margin-top:8px;padding:8px 10px;font-size:12px;color:#7c2d12;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;';
    note.textContent = '画布 V2 说明：JSON 导出 / 模块备份会同时带出 processCanvas 原始数据、预览图和联动统计字段。';
    modal.appendChild(note);
  }
  function ensureQuizRenderHooks(){
    const hook = (name) => {
      const original = window[name];
      if (typeof original !== 'function' || original.__pcWrapped) return;
      const wrapped = function(...args){
        const result = original.apply(this, args);
        requestAnimationFrame(() => {
          patchQuizQuestionActions();
          patchQuizPanel();
        });
        return result;
      };
      wrapped.__pcWrapped = true;
      window[name] = wrapped;
    };
    hook('renderQuizQuestion');
    hook('renderQuizReview');
  }
  let flushScheduled = false;
  const pendingCards = new Set();
  let supportPatchNeeded = false;
  function scheduleSupportPatches(){
    supportPatchNeeded = true;
    scheduleFlush();
  }
  function queueCard(card){
    if (!card || !card.id || !/^card-/.test(card.id)) return;
    pendingCards.add(card);
    scheduleFlush();
  }
  function scheduleFlush(){
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
      flushScheduled = false;
      if (supportPatchNeeded) {
        ensureQuizRenderHooks();
        injectStatsEntry();
        patchQuizPanel();
        patchQuizQuestionActions();
        patchExportModal();
        supportPatchNeeded = false;
      }
      if (pendingCards.size) {
        Array.from(pendingCards).forEach(card => hydrateCard(card));
        pendingCards.clear();
      }
    });
  }
  function scheduleResizeSync(){
    if (scheduleResizeSync._raf) return;
    scheduleResizeSync._raf = requestAnimationFrame(() => {
      scheduleResizeSync._raf = 0;
      allCards().forEach(card => {
        if (card.querySelector('.pc-stage')) redraw(card);
      });
    });
  }
  function scanNodeForCards(node){
    if (!node || node.nodeType !== 1) return;
    if (node.matches?.('.error-card[id^="card-"]')) queueCard(node);
    node.querySelectorAll?.('.error-card[id^="card-"]').forEach(queueCard);
    if (
      node.id === 'quizContent' ||
      node.id === 'quizAttemptPanel' ||
      node.id === 'exportModal' ||
      node.matches?.('.quiz-block') ||
      node.querySelector?.('#quizContent, #quizAttemptPanel, #exportModal, .quiz-block')
    ) {
      scheduleSupportPatches();
    }
  }
  function init(){
    allCards().forEach(queueCard);
    scheduleSupportPatches();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(scanNodeForCards);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleResizeSync);
    window.__processCanvasUltimate = {
      getEvents: () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
      getStats: () => getErrors().filter(item => item?.processCanvas?.savedAt).map(item => ({ id: item.id, type: item.type, sub: item.subtype, stats: item.processCanvas.stats || {} })),
      openSummary: openSummaryModal,
      openEditorByErrorId,
      toggleQuizProcessCanvas,
      refreshCards: () => { allCards().forEach(queueCard); scheduleSupportPatches(); },
    };
    window.openProcessCanvasForQuiz = function openProcessCanvasForQuiz(errorId){
      return openEditorByErrorId(errorId, { fromQuiz: true });
    };
    window.toggleQuizProcessCanvas = toggleQuizProcessCanvas;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
