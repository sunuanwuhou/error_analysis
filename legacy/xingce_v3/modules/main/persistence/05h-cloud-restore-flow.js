// ============================================================
// Cloud backup restore flow
// ============================================================
async function applyCloudBackup(data, updatedAt, opts) {
  opts = opts || {};
  if (typeof cancelWorkspacePendingPersists === 'function') {
    cancelWorkspacePendingPersists();
  }
  if (opts.forceOverwriteLocal !== false) {
    await clearWorkspaceStorageForRemoteRestore();
    clearLocalSyncMarkers();
    resetCurrentOriginRestoreDecision();
  }
  if (opts.staged !== false) {
    await _applyCloudBackupStaged(data, updatedAt, opts);
  } else {
    withCloudAutoSaveSuppressed(() => withIncrementalSyncSuppressed(() => {
      _applyFullBackup(data, 'restore', opts);
    }));
  }
  rememberCloudDecision(updatedAt || data.exportTime || '', 'loaded');
  if (typeof markFullBackupRestoreCompleted === 'function') {
    await markFullBackupRestoreCompleted();
  } else if (typeof markIncrementalSyncChecked === 'function') {
    markIncrementalSyncChecked(new Date().toISOString());
  }
  if (typeof ensureKnowledgeNotesHydratedIntoTree === 'function') {
    ensureKnowledgeNotesHydratedIntoTree();
  }
  if (typeof persistFullWorkspaceNow === 'function') {
    await persistFullWorkspaceNow();
  }
  scheduleOriginStatusSync({
    lastLoadedAt: updatedAt || data.exportTime || '',
    lastBackupUpdatedAt: updatedAt || data.exportTime || ''
  });
  setCloudSyncState('synced', 'Cloud backup loaded into this entry', updatedAt || data.exportTime || '');
  showCloudInfo('Cloud backup loaded', opts);
}

async function queueDeferredCloudRestore(meta, opts) {
  opts = opts || {};
  const updatedAt = String(meta && meta.updatedAt || '');
  if (deferredCloudRestorePromise && deferredCloudRestoreUpdatedAt === updatedAt) return deferredCloudRestorePromise;
  deferredCloudRestoreUpdatedAt = updatedAt;
  deferredCloudRestorePromise = (async () => {
    await delayCloudRestore(180);
    setCloudSyncState('saving', `云端数据较大（${formatBackupBytes(getCloudBackupBytes(meta))}），正在后台缓慢同步`, updatedAt);
    const fullData = await fetchCloudBackupData();
    if (!fullData.exists || !fullData.backup) return;
    await applyCloudBackup({ ...fullData.backup, summary: fullData.summary || {} }, fullData.updatedAt || fullData.backup.exportTime || updatedAt, {
      ...opts,
      silent: true,
      staged: true,
      skipCompletionAlert: true
    });
    showCloudInfo('Cloud data synced in the background', opts);
  })().catch(error => {
    console.warn('deferred cloud restore failed:', error);
    setCloudSyncState('error', error.message || '后台同步失败，请稍后重试', updatedAt);
  }).finally(() => {
    deferredCloudRestorePromise = null;
    deferredCloudRestoreUpdatedAt = '';
  });
  return deferredCloudRestorePromise;
}

async function maybeRestoreCloudBackup() {
  if (typeof isManualCloudSyncOnly === 'function' && isManualCloudSyncOnly()) return;
  // If full workspace data is not yet loaded (deferred mode), do not attempt restore.
  // Deferred loading means IndexedDB already has valid data; we must wait for it to load
  // before deciding whether local is truly empty, otherwise we risk clearing IndexedDB
  // and then racing against the deferred loader which reads an empty KEY_ERRORS.
  if (typeof hasFullWorkspaceDataLoaded === 'function'
    && !hasFullWorkspaceDataLoaded()) return;
  if (!cloudUser || cloudBusy) return;
  cloudBusy = true;
  try {
    const meta = await fetchCloudBackupMeta();
    markCloudMetaChecked();
    if (!meta.exists) return;
    const updatedAt = meta.updatedAt || '';
    const originKey = getCloudOriginKey();
    const existingDecision = cloudMeta.restoreDecisions && cloudMeta.restoreDecisions[originKey];
    if (!hasLocalWorkspaceData()) {
      if (shouldUseDeferredCloudRestore(meta)) {
        setCloudSyncState('saving', `云端数据较大（${formatBackupBytes(getCloudBackupBytes(meta))}），已切换为后台缓慢同步`, updatedAt);
        queueDeferredCloudRestore(meta, { forceOverwriteLocal: true });
        showCloudInfo('Large cloud data detected, switched to background sync');
        return;
      }
      const data = await fetchCloudBackupData();
      if (!data.exists || !data.backup) return;
      await applyCloudBackup({ ...data.backup, summary: data.summary || {} }, updatedAt || data.backup.exportTime || '', { silent: true, forceOverwriteLocal: true, staged: true, skipCompletionAlert: true });
      showCloudInfo('Cloud backup restored to this entry');
      return;
    }
    if (existingDecision && existingDecision.updatedAt === updatedAt) return;
    const currentOrigin = mergeCurrentOriginStatus();
    const localSummary = getLocalWorkspaceSummary();
    const remoteSummary = getBackupSummary(meta);
    const sameBackupVersion = !!updatedAt && [
      currentOrigin.lastBackupUpdatedAt,
      currentOrigin.lastLoadedAt,
      currentOrigin.lastSavedAt,
      cloudMeta.lastSeenBackupAt
    ].some(value => String(value || '') === updatedAt);
    if (sameBackupVersion && isSameBackupSummary(localSummary, remoteSummary)) {
      rememberCloudDecision(updatedAt, 'loaded');
      setCloudSyncState('synced', '当前入口已与云端对齐', updatedAt);
      return;
    }
    // Keep local data by default; user can restore manually via Cloud Load.
    rememberCloudDecision(updatedAt, 'kept_local');
    setCloudSyncState('dirty', 'Keeping local entry data; cloud backup not loaded', updatedAt);
    return;
  } catch (e) {
    console.warn('cloud restore skipped:', e);
  } finally {
    cloudBusy = false;
  }
}
