// ============================================================
// Cloud bootstrap / schedule policy helpers
// ============================================================

function getDefaultCloudMeta() {
  return {
    restoreDecisions: {},
    lastSeenBackupAt: '',
    lastIncrementalAlignedAt: '',
    lastLoadedAt: '',
    lastSavedAt: '',
    lastLocalChangeAt: '',
    lastMetaCheckAt: '',
    lastIncrementalSyncAt: '',
    nextCloudSaveAt: '',
    nextIncrementalSyncAt: ''
  };
}

function saveCloudMeta() {
  DB.set(KEY_CLOUD_META, JSON.stringify(cloudMeta || getDefaultCloudMeta()));
}

function getIsoAgeMs(isoText) {
  const value = Date.parse(String(isoText || '').trim());
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - value);
}

function markCloudMetaChecked(at) {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  cloudMeta.lastMetaCheckAt = String(at || new Date().toISOString());
  saveCloudMeta();
}

function markIncrementalSyncChecked(at) {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  const value = String(at || new Date().toISOString());
  cloudMeta.lastIncrementalSyncAt = value;
  cloudMeta.lastIncrementalAlignedAt = value;
  saveCloudMeta();
}

function setNextCloudSaveAt(at) {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  cloudMeta.nextCloudSaveAt = String(at || '');
  saveCloudMeta();
}

function setNextIncrementalSyncAt(at) {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  cloudMeta.nextIncrementalSyncAt = String(at || '');
  saveCloudMeta();
}

function isManualCloudSyncOnly() {
  return CLOUD_MANUAL_SYNC_ONLY;
}

function scheduleDeferredSlowSync() {
  if (isManualCloudSyncOnly()) return;
  const dueAt = new Date(Date.now() + AUTO_SYNC_DELAY_MS).toISOString();
  setNextIncrementalSyncAt(dueAt);
  if (incrementalSyncTimer) clearTimeout(incrementalSyncTimer);
  incrementalSyncTimer = setTimeout(() => {
    incrementalSyncTimer = null;
    syncWithServer({ forceFullPull: true });
  }, AUTO_SYNC_DELAY_MS);
}

function isScheduledAtDue(isoText) {
  const value = Date.parse(String(isoText || '').trim());
  if (!Number.isFinite(value)) return false;
  return Date.now() >= value;
}

function shouldRunCloudSaveDue() {
  return Boolean(cloudMeta && cloudMeta.nextCloudSaveAt) && isScheduledAtDue(cloudMeta.nextCloudSaveAt);
}

function shouldUseIncrementalOnlyAutoSave() {
  const summary = startupSummaryCache || {};
  const bytes = Number(summary.errorsBytes || 0);
  if (bytes >= INCREMENTAL_ONLY_AUTO_SAVE_BYTES) return true;
  return isLikelyMobileLikeDevice() && bytes >= MOBILE_DEFERRED_RESTORE_BYTES;
}

function shouldRunIncrementalSyncDue() {
  return Boolean(cloudMeta && cloudMeta.nextIncrementalSyncAt) && isScheduledAtDue(cloudMeta.nextIncrementalSyncAt);
}

function hasPendingIncrementalOps() {
  return getPendingOps().length > 0;
}

function shouldCheckCloudMetaOnStartup() {
  if (!hasLocalWorkspaceData()) return true;
  return getIsoAgeMs(cloudMeta && cloudMeta.lastMetaCheckAt) >= STARTUP_CLOUD_META_TTL_MS;
}

function shouldRunIncrementalSyncOnStartup() {
  if (hasPendingIncrementalOps()) return shouldRunIncrementalSyncDue();
  return getIsoAgeMs(cloudMeta && cloudMeta.lastIncrementalSyncAt) >= STARTUP_INCREMENTAL_SYNC_TTL_MS;
}

function shouldCheckCloudMetaInForeground() {
  if (!hasLocalWorkspaceData()) return true;
  return getIsoAgeMs(cloudMeta && cloudMeta.lastMetaCheckAt) >= FOREGROUND_CLOUD_CHECK_TTL_MS;
}

function shouldRunIncrementalSyncInForeground() {
  if (hasPendingIncrementalOps()) return shouldRunIncrementalSyncDue();
  return getIsoAgeMs(cloudMeta && cloudMeta.lastIncrementalSyncAt) >= FOREGROUND_CLOUD_CHECK_TTL_MS;
}

async function runBackgroundCloudBootstrap(strategy) {
  if (isManualCloudSyncOnly()) {
    renderCloudUi();
    return;
  }
  const run = async () => {
    if (!cloudUser) return;
    try {
      const mode = String(strategy || 'startup');
      const checkMeta = mode === 'startup' ? shouldCheckCloudMetaOnStartup() : shouldCheckCloudMetaInForeground();
      const checkIncremental = mode === 'startup' ? shouldRunIncrementalSyncOnStartup() : shouldRunIncrementalSyncInForeground();
      const checkCloudSave = shouldRunCloudSaveDue();
      const incrementalOnlyAutoSave = shouldUseIncrementalOnlyAutoSave();
      if (checkMeta) {
        await maybeRestoreCloudBackup();
      }
      if (checkCloudSave) {
        if (incrementalOnlyAutoSave) {
          setNextCloudSaveAt('');
          await syncWithServer();
        } else {
          await saveCloudBackup({ silent: true });
        }
      } else if (checkIncremental) {
        await syncWithServer();
      }
    } finally {
      renderCloudUi();
      if (pendingCloudSave) {
        pendingCloudSave = false;
        scheduleCloudSave();
      }
    }
  };
  return run();
}

function scheduleBackgroundCloudBootstrap(strategy) {
  if (isManualCloudSyncOnly()) return;
  const run = () => { runBackgroundCloudBootstrap(strategy); };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => { run(); }, { timeout: 1200 });
    return;
  }
  setTimeout(() => { run(); }, 120);
}

function scheduleForegroundCloudWakeCheck() {
  if (isManualCloudSyncOnly()) return;
  if (backgroundCloudBootstrapTimer) clearTimeout(backgroundCloudBootstrapTimer);
  backgroundCloudBootstrapTimer = setTimeout(() => {
    backgroundCloudBootstrapTimer = null;
    scheduleBackgroundCloudBootstrap('foreground');
  }, 180);
}
