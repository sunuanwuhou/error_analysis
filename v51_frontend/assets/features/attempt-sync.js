(function () {
  let attemptsCache = [];

  function getCache() {
    return attemptsCache;
  }

  function setCache(next) {
    attemptsCache = Array.isArray(next) ? next : [];
    return attemptsCache;
  }

  async function saveAttemptsBatch(items) {
    if (!items || !items.length) return;
    const homeMetrics = window.V53HomeMetricsRenderer;
    try {
      const res = await window.fetchJsonWithAuth('/api/practice/attempts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      attemptsCache = Array.isArray(res.items) ? res.items.concat(attemptsCache).slice(0, 400) : attemptsCache;
      const touchedErrorIds = (Array.isArray(items) ? items : [])
        .map((it) => String((it && it.errorId) || '').trim())
        .filter(Boolean);
      if (touchedErrorIds.length && typeof window.invalidatePracticeAttemptSummaries === 'function') {
        window.invalidatePracticeAttemptSummaries(touchedErrorIds);
      }
      if (typeof window.invalidatePracticeWorkbench === 'function') {
        window.invalidatePracticeWorkbench();
      }
      homeMetrics?.refreshHomeMetricsIfVisible?.();
    } catch (error) {
      console.warn('save attempts failed:', error);
      if (window.showToast) window.showToast('做题记录同步失败，已保留在本地会话', 'warning');
    }
  }

  async function loadAttempts(limit) {
    const data = await window.fetchJsonWithAuth(`/api/practice/attempts?limit=${encodeURIComponent(limit || 120)}`);
    attemptsCache = Array.isArray(data.items) ? data.items : [];
    return attemptsCache;
  }

  async function exportAttemptsJson() {
    try {
      const items = attemptsCache.length ? attemptsCache : await loadAttempts(500);
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `practice_attempts_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (error) {
      if (window.showToast) window.showToast(error.message || '导出失败', 'error');
    }
  }

  async function syncAttemptLinkAfterSave(payload) {
    if (!payload || !payload.attemptId) {
      window.__pendingAttemptLink = null;
      return;
    }
    const idx = attemptsCache.findIndex((it) => String(it.id) === String(payload.attemptId));
    const base = idx >= 0 ? attemptsCache[idx] : null;
    const meta = Object.assign({}, base?.meta || {}, {
      mistakeType: payload.mistakeType || '',
      triggerPoint: payload.triggerPoint || '',
      correctModel: payload.correctModel || '',
      nextAction: payload.nextAction || '',
      closureDone: true,
    });
    const item = Object.assign({}, base || {}, {
      id: payload.attemptId,
      updatedAt: new Date().toISOString(),
      errorId: payload.errorId || base?.errorId || '',
      noteNodeId: payload.noteNodeId || base?.noteNodeId || '',
      meta,
    });
    await saveAttemptsBatch([item]);
    if (payload.errorId && typeof window.invalidatePracticeAttemptSummaries === 'function') {
      window.invalidatePracticeAttemptSummaries([payload.errorId]);
    }
    window.__pendingAttemptLink = null;
  }

  window.V53AttemptSync = {
    getCache,
    setCache,
    saveAttemptsBatch,
    loadAttempts,
    exportAttemptsJson,
    syncAttemptLinkAfterSave,
  };
})();
