// ============================================================
// Cloud backup fetch helpers
// ============================================================
async function fetchCloudBackupDataSingle(opts) {
  opts = opts || {};
  const res = await fetch(opts.metaOnly ? '/api/backup?meta=1' : '/api/backup', { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || 'load failed');
  updateCloudOriginStatuses(data.origins);
  return data;
}

async function fetchCloudBackupDataChunked(opts) {
  opts = opts || {};
  const chunkSize = Number(opts.chunkSize || FULL_BACKUP_DOWNLOAD_CHUNK_BYTES);
  const initRes = await fetch('/api/backup/chunk/download/init', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chunkSize })
  });
  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok) {
    const error = new Error(initData.detail || initData.error || `chunk load init failed: ${initRes.status}`);
    error.status = Number(initRes.status || 0);
    throw error;
  }
  updateCloudOriginStatuses(initData.origins);
  if (!initData.exists) return initData;
  const downloadId = String(initData.downloadId || '');
  const totalChunks = Number(initData.totalChunks || 0);
  const totalBytes = Number(initData.totalBytes || initData.payloadBytes || 0);
  if (!downloadId || totalChunks <= 0 || totalBytes <= 0) throw new Error('chunk load init invalid');

  const parts = [];
  for (let index = 0; index < totalChunks; index += 1) {
    const partRes = await fetch(`/api/backup/chunk/download/${encodeURIComponent(downloadId)}/part?index=${index}`, {
      credentials: 'include'
    });
    if (!partRes.ok) {
      let partError = {};
      try { partError = await partRes.json(); } catch (e) {}
      throw new Error(partError.detail || partError.error || `chunk load failed: ${partRes.status}`);
    }
    const buffer = await partRes.arrayBuffer();
    parts.push(new Uint8Array(buffer));
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const item = parts[i];
    merged.set(item, offset);
    offset += item.length;
  }
  if (offset !== totalBytes) throw new Error('chunk load byte size mismatch');

  const backupText = new TextDecoder().decode(merged);
  const backupData = JSON.parse(backupText || '{}');
  return {
    exists: true,
    currentOrigin: initData.currentOrigin || '',
    updatedAt: initData.updatedAt || backupData.exportTime || '',
    payloadBytes: totalBytes,
    summary: initData.summary || {},
    payload: backupData,
    backup: backupData,
    origins: initData.origins || []
  };
}

async function fetchCloudBackupData(opts) {
  opts = opts || {};
  if (opts.metaOnly) return fetchCloudBackupDataSingle(opts);
  if (opts.chunked === false) return fetchCloudBackupDataSingle(opts);
  try {
    return await fetchCloudBackupDataChunked(opts);
  } catch (error) {
    const status = Number(error && error.status || 0);
    if (status && status !== 404 && status !== 405) throw error;
    return fetchCloudBackupDataSingle(opts);
  }
}

async function fetchCloudBackupMeta() {
  return fetchCloudBackupData({ metaOnly: true });
}
