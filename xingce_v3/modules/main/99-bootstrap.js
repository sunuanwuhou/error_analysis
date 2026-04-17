// 引导 & 移动端壳层
function openMobileSidebar() {
  if (!isMobileViewport()) return;
  document.body.classList.add('mobile-sidebar-open');
}
function closeMobileSidebar() {
  document.body.classList.remove('mobile-sidebar-open');
}
function toggleMobileSidebar() {
  if (!isMobileViewport()) return;
  document.body.classList.toggle('mobile-sidebar-open');
}
function syncMobileSidebarState() {
  if (!isMobileViewport()) {
    document.body.classList.remove('mobile-sidebar-open');
  }
}

async function refreshRuntimeBadge() {
  const badge = document.getElementById('runtimeBadge');
  if (!badge) return;
  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = setTimeout(() => {
    try { controller && controller.abort(); } catch (e) {}
  }, 1200);
  try {
    const res = await fetch('/api/runtime-info', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    });
    if (!res.ok) throw new Error('runtime-info failed');
    const data = await res.json();
    const mode = String(data.mode || 'unknown');
    const label = String(data.label || 'Unknown runtime');
    const origin = String(data.origin || '');
    badge.dataset.mode = mode;
    badge.textContent = label;
    badge.title = origin ? `${label}\n${origin}` : label;
  } catch (error) {
    badge.dataset.mode = 'unknown';
    badge.textContent = 'Runtime: unknown';
    badge.title = 'Failed to load runtime info';
  } finally {
    clearTimeout(timer);
  }
}

function scheduleStartupNoteSync() {
  const run = () => {
    try {
      if (typeof syncNotesWithErrors === 'function') syncNotesWithErrors();
    } catch (error) {
      console.warn('startup note sync failed', error);
    }
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 1500 });
    return;
  }
  setTimeout(run, 300);
}

function scheduleWorkspaceWarmup() {
  if (typeof hasFullWorkspaceDataLoaded === 'function' && !hasFullWorkspaceDataLoaded()) return;
  const run = () => {
    if (appView !== 'home') return;
    try {
      renderAll();
      renderNotesByType();
    } catch (error) {
      console.warn('workspace warmup failed', error);
    }
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 1800 });
    return;
  }
  setTimeout(run, 900);
}

(async () => {
  const ALL_KEYS = [
    KEY_ERRORS, KEY_REVEALED, KEY_EXP_TYPES, KEY_EXP_MAIN, KEY_EXP_SUB2,
    KEY_GLOBAL_NOTE, KEY_TODAY_DATE, KEY_TODAY_DONE, KEY_HISTORY,
    KEY_TYPE_RULES, KEY_NOTES_BY_TYPE, KEY_NOTE_IMAGES, KEY_DIR_TREE,
    KEY_KNOWLEDGE_TREE, KEY_KNOWLEDGE_NOTES
  ];
  await DB.migrateFromLocalStorage(ALL_KEYS);
  const deferErrorsOnStartup = typeof shouldDeferFullDataLoadOnStartup === 'function'
    ? shouldDeferFullDataLoadOnStartup()
    : false;
  await loadData({ deferErrors: deferErrorsOnStartup });
  ensureKnowledgeState({ persist: true });
  if (typeof hasFullWorkspaceDataLoaded !== 'function' || hasFullWorkspaceDataLoaded()) {
    const allTypes = [...new Set(errors.map(e => e.type))];
    allTypes.forEach(t => expMain.add(t));
    errors.forEach(e => {
      expMainSub.add('sub:' + (e.type || '') + '::' + ((e.subtype) || '未分类'));
      if (e.subSubtype) expMainSub2.add('s2:' + (e.type || '') + '::' + ((e.subtype) || '未分类') + '::' + e.subSubtype);
    });
    saveExpMain();
    scheduleStartupNoteSync();
  }
  initUiChromePrefs();
  syncMobileSidebarState();
  window.addEventListener('resize', syncMobileSidebarState);
  document.getElementById('navScroll')?.addEventListener('click', () => { if (isMobileViewport()) closeMobileSidebar(); });
  renderSidebar();
  if (typeof ensureLocalBackupMenuButton === 'function') ensureLocalBackupMenuButton();
  if (typeof ensureCloudFullBackupMenuButton === 'function') ensureCloudFullBackupMenuButton();
  if (typeof ensureCloudFullRestoreMenuButton === 'function') ensureCloudFullRestoreMenuButton();
  if (typeof syncAppViewChrome === 'function') syncAppViewChrome();
  if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
  refreshRuntimeBadge().catch(() => {});
  refreshCloudSession().catch(() => {});
  if (deferErrorsOnStartup && typeof scheduleDeferredFullWorkspaceLoad === 'function') {
    scheduleDeferredFullWorkspaceLoad();
  }
  scheduleWorkspaceWarmup();
  checkStorageUsage();
  setTimeout(() => {
    if (typeof ensureDailyLocalBackup === 'function') ensureDailyLocalBackup();
  }, 4000);

  window.addEventListener('beforeunload', () => {
    if (typeof isManualCloudSyncOnly === 'function' && isManualCloudSyncOnly()) return;
    if (cloudSaveTimer) {
      clearTimeout(cloudSaveTimer);
      saveCloudBackup({ silent: true });
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (typeof isManualCloudSyncOnly === 'function' && isManualCloudSyncOnly()) return;
    if (document.visibilityState === 'visible' && typeof scheduleForegroundCloudWakeCheck === 'function') {
      scheduleForegroundCloudWakeCheck();
    }
    if (document.visibilityState === 'hidden' && cloudSaveTimer) {
      clearTimeout(cloudSaveTimer);
      saveCloudBackup({ silent: true });
    }
  });
  window.addEventListener('focus', () => {
    if (typeof isManualCloudSyncOnly === 'function' && isManualCloudSyncOnly()) return;
    if (typeof scheduleForegroundCloudWakeCheck === 'function') {
      scheduleForegroundCloudWakeCheck();
    }
  });
  setInterval(() => {
    if (typeof isManualCloudSyncOnly === 'function' && isManualCloudSyncOnly()) return;
    if (document.visibilityState !== 'visible') return;
    if (typeof scheduleForegroundCloudWakeCheck === 'function') {
      scheduleForegroundCloudWakeCheck();
    }
  }, 3 * 60 * 1000);
})();
