// ============================================================
// Cloud save actions
// ============================================================
async function saveCloudIncremental(opts) {
  opts = opts || {};
  if (!cloudUser) {
    if (!opts.silent) window.location.replace('/login');
    return;
  }
  if (incrementalSyncBusy) return;
  setCloudSyncState('saving', '正在上传本地增量到云端', '');
  try {
    await syncWithServer({ forceFullPull: Boolean(opts.forceFullPull), pushOnly: true });
    if (cloudSyncState !== 'error') {
      setCloudSyncState('synced', '本地增量已上传到云端（未自动下拉）', cloudSyncUpdatedAt || new Date().toISOString());
      showCloudInfo('Incremental upload completed', opts);
    }
  } catch (e) {
    setCloudSyncState('error', e.message || '增量同步失败', '');
    showCloudError(e, 'Incremental sync failed', opts);
  }
}

async function saveCloudBackup(opts) {
  opts = opts || {};
  if (!opts.forceOverwrite && !opts.forceFullBackup) {
    await saveCloudIncremental(opts);
    return;
  }
  if (!cloudUser) {
    if (!opts.silent) window.location.replace('/login');
    return;
  }
  if (!opts.silent && cloudConflictBlocked && !opts.forceOverwrite) {
    const shouldForceNow = confirm('当前同步已进入冲突保护。\n\n如果你要以当前页面为准覆盖云端，点击“确定”。\n如果你想先看云端版本，点击“取消”后再点 Cloud Load。');
    if (!shouldForceNow) return;
    opts = { ...opts, forceOverwrite: true };
  }
  if (opts.silent && cloudConflictBlocked && !opts.forceOverwrite) {
    cloudConflictBlocked = false;
  }
  if (cloudBusy) return;
  if (cloudSaveTimer) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }
  setNextCloudSaveAt('');
  pendingCloudSave = false;
  cloudBusy = true;
  const controller = new AbortController();
  const busyTimer = setTimeout(() => {
    cloudBusy = false;
    controller.abort();
  }, 180000);
  setCloudSyncState('saving', '正在后台保存本地改动', '');
  try {
    const res = await fetch('/api/backup', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...getFullBackupPayload(),
        forceOverwrite: Boolean(opts.forceOverwrite)
      }),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      updateCloudOriginStatuses(data.origins);
      if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
      if (data.currentUpdatedAt) {
        cloudMeta.lastSeenBackupAt = data.currentUpdatedAt;
        saveCloudMeta();
      }
      if (opts.silent) {
        cloudConflictBlocked = false;
        pendingCloudSave = true;
        setCloudSyncState('dirty', '云端有更新，已切换为后台慢同步，本地改动会稍后自动继续合并', data.currentUpdatedAt || '');
        scheduleDeferredSlowSync();
        setNextCloudSaveAt(new Date(Date.now() + AUTO_SYNC_DELAY_MS).toISOString());
        return;
      }
      cloudConflictBlocked = true;
      setCloudSyncState('dirty', '发现云端版本更新，已暂停自动覆盖，请先确认时间', data.currentUpdatedAt || '');
      if (!opts.silent) {
        const shouldForceOverwrite = confirm('检测到云端比当前基线更新。\n\n如果要以当前页面为准覆盖云端，点击“确定”。\n如果暂时不覆盖，点击“取消”。');
        if (shouldForceOverwrite) {
          clearTimeout(busyTimer);
          cloudBusy = false;
          await saveCloudBackup({ silent: false, forceOverwrite: true });
        } else {
          showCloudWarning('Local data was kept and the cloud was not overwritten');
        }
      }
      return;
    }
    if (!res.ok) throw new Error(data.detail || data.error || 'save failed');
    updateCloudOriginStatuses(data.origins);
    rememberCloudDecision(data.updatedAt || '', 'saved');
    cloudConflictBlocked = false;
    await syncWithServer({ fromManualAction: true });
    setCloudSyncState('synced', '本地改动已写入云端', data.updatedAt || '');
    showCloudInfo('Cloud backup saved', opts);
  } catch (e) {
    if (e.name === 'AbortError') {
      setCloudSyncState('error', '云端保存超时，请重试', '');
    } else {
      setCloudSyncState('error', e.message || '云端保存失败，请重试', '');
      showCloudError(e, 'Cloud save failed, please try again', opts);
    }
  } finally {
    clearTimeout(busyTimer);
    cloudBusy = false;
  }
}

async function saveCloudFullBackup(opts) {
  opts = opts || {};
  if (!cloudUser) {
    if (!opts.silent) window.location.replace('/login');
    return;
  }
  if (cloudBusy || incrementalSyncBusy) return;
  if (cloudSaveTimer) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }
  setNextCloudSaveAt('');
  pendingCloudSave = false;
  cloudBusy = true;
  try {
    const payload = {
      ...getFullBackupPayload(),
      forceOverwrite: Boolean(opts.forceOverwrite)
    };
    const text = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(text);
    const totalBytes = bytes.length;
    const chunkSize = FULL_BACKUP_CHUNK_BYTES;
    const totalChunks = Math.max(1, Math.ceil(totalBytes / chunkSize));
    setCloudSyncState('saving', `全量备份上传中 0% (0/${totalChunks})`, '');

    const initData = await fetchJsonWithAuth('/api/backup/chunk/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalBytes: totalBytes,
        totalChunks: totalChunks,
        chunkSize: chunkSize,
        baseUpdatedAt: cloudMeta.lastSeenBackupAt || '',
        forceOverwrite: Boolean(opts.forceOverwrite),
        exportTime: payload.exportTime || ''
      })
    });
    const uploadId = String(initData.uploadId || '');
    if (!uploadId) throw new Error('chunk upload init failed');

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, totalBytes);
      const chunk = bytes.slice(start, end);
      let partData = {};
      let uploaded = false;
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);
          const partRes = await fetch(`/api/backup/chunk/${encodeURIComponent(uploadId)}/part?index=${index}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: chunk,
            signal: controller.signal
          });
          clearTimeout(timeout);
          partData = await partRes.json().catch(() => ({}));
          if (partRes.ok) {
            uploaded = true;
            break;
          }
          const status = Number(partRes.status || 0);
          const retriable = status >= 500 || status === 429 || status === 408;
          if (!retriable || attempt >= maxAttempts) {
            throw new Error(partData.detail || partData.error || `chunk upload failed: ${status}`);
          }
        } catch (err) {
          if (attempt >= maxAttempts) throw err;
        }
        setCloudSyncState('saving', `全量备份分块重试 ${attempt}/${maxAttempts}（第 ${index + 1}/${totalChunks} 块）`, '');
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
      if (!uploaded) {
        throw new Error(`chunk upload failed at part ${index}`);
      }
      const uploadedChunks = Number(partData.receivedChunks || (index + 1));
      const pct = Math.min(100, Math.round((uploadedChunks / totalChunks) * 100));
      setCloudSyncState('saving', `全量备份上传中 ${pct}% (${uploadedChunks}/${totalChunks})`, '');
    }

    const doneRes = await fetch('/api/backup/chunk/complete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId })
    });
    const data = await doneRes.json().catch(() => ({}));
    if (doneRes.status === 409) {
      updateCloudOriginStatuses(data.origins);
      if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
      if (data.currentUpdatedAt) {
        cloudMeta.lastSeenBackupAt = data.currentUpdatedAt;
        saveCloudMeta();
      }
      cloudConflictBlocked = true;
      setCloudSyncState('dirty', '云端版本已更新，请先确认时间后再执行全量覆盖', data.currentUpdatedAt || '');
      if (!opts.silent) {
        const shouldForce = confirm('检测到云端比当前基线更新。是否强制全量覆盖云端？');
        if (shouldForce) {
          cloudBusy = false;
          await saveCloudFullBackup({ ...opts, forceOverwrite: true });
        }
      }
      return;
    }
    if (!doneRes.ok) throw new Error(data.detail || data.error || 'full backup complete failed');

    updateCloudOriginStatuses(data.origins);
    rememberCloudDecision(data.updatedAt || '', 'saved');
    cloudConflictBlocked = false;
    await syncWithServer({ pushOnly: true });
    setCloudSyncState('synced', `全量备份完成（${formatBackupBytes(totalBytes)}）`, data.updatedAt || '');
    showCloudInfo('Full cloud backup completed', opts);
  } catch (e) {
    setCloudSyncState('error', e.message || '全量备份失败，请重试', '');
    showCloudError(e, 'Full cloud backup failed', opts);
  } finally {
    cloudBusy = false;
  }
}
