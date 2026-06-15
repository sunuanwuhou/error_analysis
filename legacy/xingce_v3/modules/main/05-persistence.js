// ============================================================
// 持久化（IndexedDB）
// ============================================================
function saveData()    {
  knowledgeErrorCountCacheVersion += 1;
  DB.set(KEY_ERRORS, JSON.stringify(errors))
    .catch(reportLocalStorageFailure);
  scheduleCloudSave();
}
function saveReveal()  { DB.set(KEY_REVEALED, JSON.stringify([...revealed])); scheduleCloudSave(); }
function saveExpMain() {
  DB.set(KEY_EXP_MAIN, JSON.stringify([...expMain,...expMainSub]));
  DB.set(KEY_EXP_SUB2, JSON.stringify([...expMainSub2]));
  scheduleCloudSave();
}
function saveExpTypes(){ DB.set(KEY_EXP_TYPES, JSON.stringify([...expTypes])); scheduleCloudSave(); }
// 笔记数据加载
let noteImages = {}; // { imgId: base64DataUrl }
async function loadNotesByType() {
  const data = await DB.get(KEY_NOTES_BY_TYPE);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      const migrated = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (val && typeof val === 'object') {
          migrated[key] = {
            content: val.content || '',
            updatedAt: val.updatedAt || ''
          };
        }
      }
      notesByType = migrated;
    } catch (e) { notesByType = {}; }
  } else {
    notesByType = {};
  }
  try { noteImages = JSON.parse(await DB.get(KEY_NOTE_IMAGES)||'{}'); }
  catch(e) { noteImages = {}; }
}
async function loadKnowledgeState() {
  try { knowledgeTree = JSON.parse(await DB.get(KEY_KNOWLEDGE_TREE) || 'null'); }
  catch(e) { knowledgeTree = null; }
  try { knowledgeNotes = JSON.parse(await DB.get(KEY_KNOWLEDGE_NOTES) || '{}') || {}; }
  catch(e) { knowledgeNotes = {}; }
  try { knowledgeBaselineNodes = JSON.parse(await DB.get(KEY_KNOWLEDGE_BASELINE_NODES) || 'null'); }
  catch(e) { knowledgeBaselineNodes = null; }
  try { knowledgeBaselineVersion = String(await DB.get(KEY_KNOWLEDGE_BASELINE_VERSION) || ''); }
  catch(e) { knowledgeBaselineVersion = ''; }
  try {
    const rawExpanded = await DB.get(KEY_KNOWLEDGE_EXPANDED);
    knowledgeExpanded = new Set(JSON.parse(rawExpanded || '[]') || []);
    knowledgeExpandedLoaded = !!rawExpanded;
  } catch(e) {
    knowledgeExpanded = new Set();
    knowledgeExpandedLoaded = false;
  }
  try { noteReviewTracking = JSON.parse(await DB.get(KEY_NOTE_REVIEW_TRACKING) || '{}') || {}; }
  catch(e) { noteReviewTracking = {}; }
}
function saveNotesByType() {
  DB.set(KEY_NOTES_BY_TYPE, JSON.stringify(notesByType));
  DB.set(KEY_NOTE_IMAGES, JSON.stringify(noteImages));
  scheduleCloudSave();
}
function saveKnowledgeState() {
  syncKnowledgeNotesFromTree();
  knowledgeErrorCountCacheVersion += 1;
  DB.set(KEY_KNOWLEDGE_TREE, JSON.stringify(knowledgeTree));
  DB.set(KEY_KNOWLEDGE_NOTES, JSON.stringify(knowledgeNotes));
  scheduleCloudSave();
}
function saveKnowledgeExpanded() {
  DB.set(KEY_KNOWLEDGE_EXPANDED, JSON.stringify(Array.from(knowledgeExpanded)));
}
saveData = function() {
  const changed = syncErrorOpsFromSnapshot();
  const encodedErrors = JSON.stringify(errors);
  queuePersist(KEY_ERRORS, encodedErrors);
  persistStartupSummary(encodedErrors);
  if (changed) markIncrementalWorkspaceChange();
};
saveReveal = function() {
  const changed = syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_REVEALED, [...revealed]);
  if (changed) markIncrementalWorkspaceChange();
};
saveExpMain = function() {
  const changed = syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_EXP_MAIN, [...expMain, ...expMainSub]);
  queuePersist(KEY_EXP_SUB2, [...expMainSub2]);
  if (changed) markIncrementalWorkspaceChange();
};
saveExpTypes = function() {
  const changed = syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_EXP_TYPES, [...expTypes]);
  if (changed) markIncrementalWorkspaceChange();
};
saveNotesByType = function() {
  const changed = syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_NOTES_BY_TYPE, notesByType);
  queuePersist(KEY_NOTE_IMAGES, noteImages);
  if (changed) markIncrementalWorkspaceChange();
};
saveKnowledgeState = function(options) {
  const opts = options || {};
  if (!opts.preserveTreeShape) {
    mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes());
    collapseDuplicateKnowledgeWrappers(getKnowledgeRootNodes());
  }
  syncKnowledgeNotesFromTree();
  const changed = syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_KNOWLEDGE_TREE, knowledgeTree);
  queuePersist(KEY_KNOWLEDGE_NOTES, knowledgeNotes);
  if (changed) markIncrementalWorkspaceChange();
};
saveKnowledgeExpanded = function() {
  const changed = syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_KNOWLEDGE_EXPANDED, Array.from(knowledgeExpanded));
  if (changed) markIncrementalWorkspaceChange();
};
function saveNoteReviewTracking() {
  queuePersist(KEY_NOTE_REVIEW_TRACKING, noteReviewTracking || {});
}
let cloudUser = null;
let cloudSaveTimer = null;
let cloudBusy = false;
let incrementalSyncBusy = false;
let pendingCloudSave = false;
let cloudConflictBlocked = false;
let cloudSyncState = 'idle';
let cloudSyncMessage = '';
let cloudSyncUpdatedAt = '';
let cloudOriginStatuses = [];
let cloudOriginStatusTimer = null;
let cloudDetailsExpanded = false;
let cloudMeta = getDefaultCloudMeta();
const LARGE_CLOUD_BACKUP_BYTES = 1.5 * 1024 * 1024;
const MOBILE_DEFERRED_RESTORE_BYTES = 600 * 1024;
const INCREMENTAL_ONLY_AUTO_SAVE_BYTES = 1.5 * 1024 * 1024;
const AUTO_SYNC_DELAY_MS = 5 * 60 * 1000;
const STARTUP_CLOUD_META_TTL_MS = 5 * 60 * 1000;
const STARTUP_INCREMENTAL_SYNC_TTL_MS = 5 * 60 * 1000;
const FOREGROUND_CLOUD_CHECK_TTL_MS = 5 * 60 * 1000;
const CLOUD_MANUAL_SYNC_ONLY = false;
const FULL_BACKUP_CHUNK_BYTES = 1024 * 1024;
const FULL_BACKUP_DOWNLOAD_CHUNK_BYTES = 1024 * 1024;
const SYNC_PUSH_BATCH_SIZE = 30;
const SYNC_FETCH_TIMEOUT_MS = 120000;
let deferredCloudRestorePromise = null;
let deferredCloudRestoreUpdatedAt = '';
let backgroundCloudBootstrapTimer = null;

const WORKSPACE_PERSIST_KEYS = [
  KEY_ERRORS, KEY_NOTES_BY_TYPE, KEY_NOTE_IMAGES,
  KEY_KNOWLEDGE_TREE, KEY_KNOWLEDGE_NOTES,
  KEY_REVEALED, KEY_EXP_TYPES, KEY_EXP_MAIN, KEY_EXP_SUB2,
  KEY_GLOBAL_NOTE, KEY_TYPE_RULES, KEY_DIR_TREE, KEY_HISTORY,
  KEY_KNOWLEDGE_EXPANDED
];

async function flushWorkspacePersistsNow() {
  if (typeof flushPendingPersists !== 'function') return;
  await flushPendingPersists(WORKSPACE_PERSIST_KEYS);
}

async function fetchSyncJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...(options || {}), signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || data.error || `sync request failed (${res.status})`);
    }
    return data;
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw new Error('云端同步超时（公网较慢或数据量较大），请稍后重试');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function rememberPartialSyncCursor(cursorAt, cursorEntityType, cursorId) {
  try {
    if (cursorAt) localStorage.setItem('lastSyncCursorAt', cursorAt);
    if (cursorEntityType) localStorage.setItem('lastSyncCursorEntityType', cursorEntityType);
    if (cursorId) localStorage.setItem('lastSyncCursorId', cursorId);
  } catch (e) {}
}

async function syncWithServer(opts) {
  const options = opts || {};
  if (!cloudUser) return;
  if (incrementalSyncBusy) return;
  if (incrementalSyncTimer) {
    clearTimeout(incrementalSyncTimer);
    incrementalSyncTimer = null;
  }
  incrementalSyncBusy = true;
  try {
    let pending = getPendingOps();
    let pushed = false;
    let latestSnapshotAt = '';
    if (!options.pullOnly && pending.length > 0) {
      while (pending.length > 0) {
        const batch = pending.slice(0, SYNC_PUSH_BATCH_SIZE);
        setCloudSyncState('saving', `正在上传本地改动（剩余 ${pending.length} 条）`, '');
        const pushData = await fetchSyncJson('/api/sync', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ops: batch }),
        });
        const acceptedOps = Number(pushData.acceptedOps || 0);
        const skippedOps = Number(pushData.skippedOps || 0);
        if (acceptedOps === 0 && skippedOps > 0) {
          throw new Error(`云端未接受本地改动（${skippedOps} 条跳过）`);
        }
        if (acceptedOps > 0) {
          pending = pending.slice(Math.min(batch.length, acceptedOps));
          savePendingOps(pending);
          pushed = true;
        }
        latestSnapshotAt = pushData.snapshotUpdatedAt || latestSnapshotAt;
        if (Array.isArray(pushData.origins)) updateCloudOriginStatuses(pushData.origins);
        if (acceptedOps < batch.length) break;
      }
      if (!pending.length) {
        try { localStorage.removeItem('pendingOps'); } catch (e) {}
      }
    }
    if (options.pushOnly) {
      markIncrementalSyncChecked(latestSnapshotAt || new Date().toISOString());
      setNextIncrementalSyncAt('');
      if (latestSnapshotAt) {
        cloudMeta.lastSeenBackupAt = latestSnapshotAt;
        saveCloudMeta();
      }
      if (pushed) {
        setCloudSyncState('synced', '本地增量已上传到云端（未自动下拉）', latestSnapshotAt || '');
      }
      return;
    }
    if (options.resetCursor) clearLastSyncCursor();
    const syncCursor = getLastSyncCursor();
    const baseSince = options.forceFullPull ? '' : (syncCursor.since || '');
    const isSnapshotPull = !baseSince;
    let cursorAt = options.forceFullPull ? '' : (syncCursor.cursorAt || '');
    let cursorEntityType = options.forceFullPull ? '' : (syncCursor.cursorEntityType || '');
    let cursorId = options.forceFullPull ? '' : (syncCursor.cursorId || '');
    let pulled = 0;
    let serverTime = syncCursor.since || '';
    while (true) {
      const params = new URLSearchParams();
      params.set('since', baseSince);
      if (cursorAt) params.set('cursorAt', cursorAt);
      if (cursorEntityType) params.set('cursorEntityType', cursorEntityType);
      if (cursorId) params.set('cursorId', cursorId);
      setCloudSyncState('saving', pulled > 0
        ? (isSnapshotPull
          ? `正在与云端全量对齐（已处理 ${pulled} 条实体）`
          : `正在合并云端增量改动（已处理 ${pulled} 条）`)
        : (isSnapshotPull ? '正在与云端全量对齐' : '正在检查云端增量改动'), '');
      const pullData = await fetchSyncJson(`/api/sync?${params.toString()}`, { credentials: 'include' });
      const ops = Array.isArray(pullData.ops) ? pullData.ops : [];
      if (ops.length) {
        applyOps(ops);
        pulled += ops.length;
      }
      latestSnapshotAt = pullData.snapshotUpdatedAt || latestSnapshotAt;
      if (Array.isArray(pullData.origins)) updateCloudOriginStatuses(pullData.origins);
      serverTime = pullData.serverTime || serverTime;
      if (!pullData.hasMore) break;
      cursorAt = pullData.nextCursorAt || (ops.length ? String(ops[ops.length - 1].created_at || '') : cursorAt);
      cursorEntityType = pullData.nextCursorEntityType || cursorEntityType;
      cursorId = pullData.nextCursorId || (ops.length ? String(ops[ops.length - 1].entity_id || ops[ops.length - 1].id || '') : cursorId);
      if (!cursorAt) break;
      rememberPartialSyncCursor(cursorAt, cursorEntityType, cursorId);
    }
    rememberLastSyncCursor(serverTime);
    markIncrementalSyncChecked(serverTime || new Date().toISOString());
    setNextIncrementalSyncAt('');
    if (latestSnapshotAt) {
      cloudMeta.lastSeenBackupAt = latestSnapshotAt;
      saveCloudMeta();
    }
    if (pushed || pulled > 0) {
      await flushWorkspacePersistsNow();
      const syncMessage = isSnapshotPull
        ? `已与云端全量对齐（${pulled} 条实体记录，非本地改动）`
        : `已合并 ${pulled} 条云端增量改动`;
      setCloudSyncState('synced', syncMessage, latestSnapshotAt || serverTime || '');
    } else if (options.pullOnly) {
      setCloudSyncState('synced', '云端无新增改动', latestSnapshotAt || serverTime || new Date().toISOString());
    }
    if (!options._backupRecovery
      && typeof hasLocalWorkspaceData === 'function'
      && !hasLocalWorkspaceData()
      && typeof loadCloudBackup === 'function') {
      await loadCloudBackup({
        silent: true,
        askBeforeRestore: false,
        skipCompletionAlert: true,
        _backupRecovery: true,
      });
    }
  } catch (e) {
    setCloudSyncState('error', e.message || '云端增量同步失败', '');
    console.warn('[syncWithServer] failed', e);
  } finally {
    incrementalSyncBusy = false;
  }
}
