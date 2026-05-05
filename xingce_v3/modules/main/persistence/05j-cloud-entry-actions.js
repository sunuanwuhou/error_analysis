// ============================================================
// Cloud entry actions
// ============================================================
async function refreshCloudSession() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    const data = await res.json();
    cloudUser = data && data.authenticated ? data.user : null;
  } catch (e) {
    cloudUser = null;
  }
  renderCloudUi();
  if (!cloudUser) {
    window.location.replace('/login');
    return;
  }
  if (isManualCloudSyncOnly()) {
    setCloudSyncState('idle', '已登录，当前为手动同步模式（仅点击 Cloud Save 才会增量同步）', '');
    renderCloudUi();
    return;
  }
  setCloudSyncState('idle', '已登录，默认优先显示本地数据', '');
  renderCloudUi();
  scheduleBackgroundCloudBootstrap();
}

async function clearClientCacheOnLogout() {
  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB && typeof indexedDB.deleteDatabase === 'function') {
      indexedDB.deleteDatabase('xingce_db');
    }
  } catch (e) {}
  try {
    if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
  } catch (e) {}
  try {
    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
    }
  } catch (e) {}
}

async function logoutCloud() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (e) {}
  await clearClientCacheOnLogout();
  cloudUser = null;
  renderCloudUi();
  window.location.replace('/login?fresh=1');
}

async function loadCloudBackup(opts) {
  opts = opts || {};
  if (!cloudUser) {
    window.location.replace('/login');
    return;
  }
  if (cloudBusy) return;
  cloudBusy = true;
  setCloudSyncState('saving', '正在检查云端备份', '');
  try {
    const meta = await fetchCloudBackupMeta();
    if (!meta.exists) {
      showCloudWarning('Cloud backup is empty', opts);
      return;
    }
    const updatedAt = meta.updatedAt || '';
    const hasLocalData = (errors && errors.length) || Object.keys(notesByType || {}).length || Object.keys(knowledgeNotes || {}).length;
    if (opts.askBeforeRestore && hasLocalData) {
      const ok = confirm('Cloud backup found. Restore it to current device?');
      if (!ok) return;
    }
    if (shouldUseDeferredCloudRestore(meta)) {
      setCloudSyncState('saving', `云端数据较大（${formatBackupBytes(getCloudBackupBytes(meta))}），已切换为后台缓慢同步`, updatedAt);
      queueDeferredCloudRestore(meta, { ...opts, forceOverwriteLocal: true });
      showCloudInfo('Switched to background sync mode', opts);
      return;
    }
    const data = await fetchCloudBackupData();
    if (!data.exists || !data.backup) {
      showCloudWarning('Cloud backup is empty', opts);
      return;
    }
    await applyCloudBackup({ ...data.backup, summary: data.summary || {} }, updatedAt || data.backup.exportTime || '', { ...opts, forceOverwriteLocal: true, staged: true, skipCompletionAlert: true });
    cloudConflictBlocked = false;
  } catch (e) {
    setCloudSyncState('error', e.message || '云端检查失败，请稍后重试', '');
    showCloudError(e, 'Cloud load failed, please try again later', opts);
  } finally {
    cloudBusy = false;
  }
}

async function loadCloudIncrementalFromSidebar(opts) {
  opts = opts || {};
  if (!cloudUser) {
    window.location.replace('/login');
    return;
  }
  if (incrementalSyncBusy || cloudBusy) return;
  setCloudSyncState('saving', '正在从云端拉取增量更新', '');
  try {
    await syncWithServer({
      pullOnly: true,
      forceFullPull: Boolean(opts.forceFullPull),
      resetCursor: Boolean(opts.resetCursor)
    });
    if (cloudSyncState !== 'error') {
      setCloudSyncState('synced', '云端增量同步完成', cloudSyncUpdatedAt || new Date().toISOString());
      if (!opts.silent) showCloudInfo('Incremental cloud pull completed', opts);
    }
  } catch (e) {
    setCloudSyncState('error', e.message || '云端增量同步失败，请稍后重试', '');
    showCloudError(e, 'Cloud incremental pull failed', opts);
  }
}

async function loadCloudFullBackupFromMore() {
  if (!cloudUser) {
    window.location.replace('/login');
    return;
  }
  if (cloudBusy || incrementalSyncBusy) {
    showCloudWarning('当前已有云同步任务在执行，请稍等完成后再试');
    return;
  }
  const ok = confirm('将从云端全量同步并覆盖当前本地数据。继续吗？');
  if (!ok) return;
  setCloudSyncState('saving', '正在从云端全量覆盖本地，请稍候', '');
  await loadCloudBackup({ silent: false, askBeforeRestore: false, forceOverwriteLocal: true });
  if (cloudSyncState === 'synced') {
    if (typeof refreshWorkspaceAfterKnowledgeDataChange === 'function') {
      refreshWorkspaceAfterKnowledgeDataChange({ sidebar: true, notes: true, rightPanel: true });
    } else {
      if (typeof invalidateKnowledgeTreeRenderState === 'function') invalidateKnowledgeTreeRenderState();
      renderSidebar();
      renderAll();
      renderNotesByType();
      if (typeof renderNotesPanelRight === 'function') renderNotesPanelRight();
    }
    showCloudInfo('云端全量覆盖已完成，当前页面已刷新为云端数据');
  }
}
