// ============================================================
// Cloud save scheduling actions
// ============================================================
async function saveCloudFullBackupFromMore() {
  if (!cloudUser) {
    window.location.replace('/login');
    return;
  }
  const ok = confirm('将把当前本地完整数据分块上传到云端。继续吗？');
  if (!ok) return;
  await saveCloudFullBackup({ silent: false, forceOverwrite: false });
}

function scheduleCloudSave() {
  if (suppressCloudAutoSave > 0) return;
  markLocalChange();
  if (isManualCloudSyncOnly()) {
    pendingCloudSave = true;
    setCloudSyncState('dirty', '本地改动已记录；仅在点击 Cloud Save 时执行增量同步', '');
    return;
  }
  if (!cloudUser) {
    setCloudSyncState('dirty', '本地改动已记录，登录后再继续处理', '');
    pendingCloudSave = true;
    return;
  }
  if (shouldUseIncrementalOnlyAutoSave()) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
    pendingCloudSave = false;
    setNextCloudSaveAt('');
    setCloudSyncState('dirty', '检测到大数据量，自动流程已切换为增量同步；整包 Cloud Save 改为手动使用', '');
    scheduleDeferredSlowSync();
    return;
  }
  clearTimeout(cloudSaveTimer);
  pendingCloudSave = false;
  const dueAt = new Date(Date.now() + AUTO_SYNC_DELAY_MS).toISOString();
  setNextCloudSaveAt(dueAt);
  setCloudSyncState('dirty', '检测到改动，约 5 分钟后自动同步', '');
  cloudSaveTimer = setTimeout(() => {
    cloudSaveTimer = null;
    saveCloudBackup({ silent: true });
  }, AUTO_SYNC_DELAY_MS);
}
