// ============================================================
// Cloud restore and origin status utility helpers
// ============================================================

function getCloudBackupBytes(meta) {
  return Number(meta && meta.payloadBytes || 0);
}

function formatBackupBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 B';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function isLikelyMobileClient() {
  const ua = String((navigator && navigator.userAgent) || '').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|harmony/.test(ua);
}

function shouldUseDeferredCloudRestore(meta) {
  const bytes = getCloudBackupBytes(meta);
  if (!bytes) return false;
  if (bytes >= LARGE_CLOUD_BACKUP_BYTES) return true;
  return isLikelyMobileClient() && bytes >= MOBILE_DEFERRED_RESTORE_BYTES;
}

function delayCloudRestore(ms) {
  return new Promise(resolve => setTimeout(resolve, ms || 0));
}

function getBackupSummary(meta) {
  const summary = meta && typeof meta.summary === 'object' ? meta.summary : {};
  return {
    errors: Number(summary.errors || 0),
    notesByType: Number(summary.notesByType || 0),
    noteImages: Number(summary.noteImages || 0),
    knowledgeNodes: Number(summary.knowledgeNodes || 0),
    knowledgeNotes: Number(summary.knowledgeNotes || 0)
  };
}

function getLocalWorkspaceSummary() {
  return {
    errors: getErrorEntries().length,
    notesByType: Object.keys(notesByType || {}).length,
    noteImages: Object.keys(noteImages || {}).length,
    knowledgeNodes: typeof collectKnowledgeNodes === 'function' ? collectKnowledgeNodes().length : 0,
    knowledgeNotes: Object.keys(knowledgeNotes || {}).length
  };
}

function isSameBackupSummary(left, right) {
  const a = left || {};
  const b = right || {};
  return ['errors', 'notesByType', 'noteImages', 'knowledgeNodes', 'knowledgeNotes']
    .every(key => Number(a[key] || 0) === Number(b[key] || 0));
}

async function clearWorkspaceStorageForRemoteRestore() {
  const keys = [
    KEY_ERRORS, KEY_REVEALED, KEY_EXP_TYPES, KEY_EXP_MAIN, KEY_EXP_SUB2,
    KEY_GLOBAL_NOTE, KEY_TODAY_DATE, KEY_TODAY_DONE, KEY_HISTORY,
    KEY_TYPE_RULES, KEY_NOTES_BY_TYPE, KEY_NOTE_IMAGES,
    KEY_DIR_TREE, KEY_KNOWLEDGE_TREE, KEY_KNOWLEDGE_NOTES
  ];
  await Promise.all(keys.map(key => DB.remove(key)));
  ['lastSyncCursorAt', 'lastSyncCursorId'].forEach(key => {
    try { localStorage.removeItem(key); } catch (e) {}
  });
}

function clearLocalSyncMarkers() {
  ['lastSyncCursorAt', 'lastSyncCursorId'].forEach(key => {
    try { localStorage.removeItem(key); } catch (e) {}
  });
  setErrorSyncSnapshot(new Map());
  setWorkspaceSyncSnapshot(new Map());
}

function resetCurrentOriginRestoreDecision() {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  const key = getCloudOriginKey();
  if (cloudMeta.restoreDecisions && cloudMeta.restoreDecisions[key]) {
    delete cloudMeta.restoreDecisions[key];
    saveCloudMeta();
  }
}

function getCloudOriginKey() {
  return (window.location && window.location.origin) ? window.location.origin : 'origin:unknown';
}

function isLocalDebugOrigin(origin) {
  const text = String(origin || '').toLowerCase();
  return text.includes('127.0.0.1') || text.includes('localhost');
}

function normalizeCloudIso(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toISOString();
}

function formatCloudTime(value) {
  const iso = normalizeCloudIso(value);
  if (!iso) return '-';
  const date = new Date(iso);
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return local;
}

function toCloudTimeMs(value) {
  const iso = normalizeCloudIso(value);
  if (!iso) return 0;
  return Date.parse(iso) || 0;
}

function getOriginDisplayTime(item) {
  const latest = item && item.lastSyncedAt ? item.lastSyncedAt : (item && item.updatedAt ? item.updatedAt : '');
  return formatCloudTime(latest);
}

function mergeCurrentOriginStatus() {
  const key = getCloudOriginKey();
  const statuses = Array.isArray(cloudOriginStatuses) ? cloudOriginStatuses.slice() : [];
  let current = statuses.find(item => item && item.origin === key) || null;
  if (!current) {
    current = {
      origin: key,
      originLabel: key,
      status: cloudSyncState,
      updatedAt: cloudSyncUpdatedAt || new Date().toISOString(),
      payloadBytes: 0
    };
    statuses.push(current);
  }
  cloudOriginStatuses = statuses;
  return current;
}

function updateCloudOriginStatuses(items) {
  cloudOriginStatuses = Array.isArray(items) ? items.slice() : [];
}

async function pushOriginStatus(update) {
  if (!cloudUser) return;
  try {
    const body = {
      origin: getCloudOriginKey(),
      status: update && update.status ? String(update.status) : cloudSyncState,
      updatedAt: normalizeCloudIso(update && update.updatedAt ? update.updatedAt : cloudSyncUpdatedAt) || new Date().toISOString(),
      payloadBytes: Number(update && update.payloadBytes || 0),
      summary: update && update.summary ? update.summary : undefined
    };
    await fetchJsonWithAuth('/api/origin-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.warn('push origin status failed', e);
  }
}

function scheduleOriginStatusSync(update) {
  if (cloudOriginStatusTimer) clearTimeout(cloudOriginStatusTimer);
  cloudOriginStatusTimer = setTimeout(() => {
    cloudOriginStatusTimer = null;
    pushOriginStatus(update);
  }, 120);
}

function markLocalChange() {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  cloudMeta.lastLocalChangeAt = new Date().toISOString();
  saveCloudMeta();
}

function setCloudSyncState(state, message, at) {
  cloudSyncState = String(state || 'idle');
  cloudSyncMessage = String(message || '');
  cloudSyncUpdatedAt = normalizeCloudIso(at) || (cloudSyncState === 'idle' ? '' : new Date().toISOString());
  renderCloudUi();
}

function hasLocalWorkspaceData() {
  return getErrorEntries().length > 0
    || Object.keys(notesByType || {}).length > 0
    || Object.keys(noteImages || {}).length > 0
    || Object.keys(knowledgeNotes || {}).length > 0
    || (typeof collectKnowledgeNodes === 'function' && collectKnowledgeNodes().length > 0)
    || (_history && _history.length > 0)
    || !!(globalNote || '').trim();
}

function rememberCloudDecision(updatedAt, action) {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  if (!cloudMeta.restoreDecisions || typeof cloudMeta.restoreDecisions !== 'object') {
    cloudMeta.restoreDecisions = {};
  }
  cloudMeta.restoreDecisions[getCloudOriginKey()] = {
    updatedAt: normalizeCloudIso(updatedAt) || '',
    action: String(action || ''),
    decidedAt: new Date().toISOString()
  };
  saveCloudMeta();
}
