(function () {
  function formatDuration(sec) {
    const value = Math.max(0, Number(sec) || 0);
    const m = Math.floor(value / 60);
    const s = value % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function ensureModal() {
    let mask = document.getElementById('practiceAttemptsModal');
    if (mask) return mask;
    mask = document.createElement('div');
    mask.id = 'practiceAttemptsModal';
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="width:980px;max-width:96vw;max-height:92vh;overflow:auto">
        <button class="modal-close" type="button" onclick="closeModal('practiceAttemptsModal')">✕</button>
        <h2 style="margin-bottom:8px">做题记录</h2>
        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
          <div id="practiceAttemptsMeta" style="font-size:12px;color:#64748b">加载中...</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="refreshPracticeAttemptsModal()">刷新</button>
            <button class="btn btn-secondary btn-sm" onclick="exportPracticeAttemptsJson()">导出 JSON</button>
          </div>
        </div>
        <div id="practiceAttemptsList"></div>
      </div>`;
    document.body.appendChild(mask);
    return mask;
  }

  function render(items) {
    const list = document.getElementById('practiceAttemptsList');
    const meta = document.getElementById('practiceAttemptsMeta');
    if (!list || !meta) return;
    const arr = Array.isArray(items) ? items : [];
    const avg = arr.length ? Math.round(arr.reduce((sum, it) => sum + (Number(it.durationSec) || 0), 0) / arr.length) : 0;
    meta.textContent = `共 ${arr.length} 条 · 平均用时 ${formatDuration(avg)}`;
    if (!arr.length) {
      list.innerHTML = '<div style="padding:18px;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b">暂无做题记录</div>';
      return;
    }
    const cardRenderer = window.V53AttemptCardRenderer;
    list.innerHTML = arr.map((it) => cardRenderer.renderAttemptCard(it, formatDuration)).join('');
  }

  async function open() {
    const sync = window.V53AttemptSync;
    ensureModal();
    window.openModal('practiceAttemptsModal');
    try {
      render(await sync.loadAttempts(120));
    } catch (error) {
      const message = String(error.message || error);
      const safe = window.escapeHtml ? window.escapeHtml(message) : message;
      document.getElementById('practiceAttemptsMeta').textContent = message || '加载失败';
      document.getElementById('practiceAttemptsList').innerHTML = `<div style="padding:18px;border:1px dashed #fecaca;border-radius:12px;color:#b91c1c">${safe}</div>`;
    }
  }

  async function refresh() {
    const sync = window.V53AttemptSync;
    try {
      render(await sync.loadAttempts(120));
    } catch (error) {
      if (window.showToast) window.showToast(error.message || '刷新失败', 'error');
    }
  }

  window.V53AttemptModal = {
    ensureModal,
    render,
    open,
    refresh,
  };
})();
