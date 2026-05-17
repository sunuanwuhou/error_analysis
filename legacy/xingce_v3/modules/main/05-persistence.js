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
const CLOUD_MANUAL_SYNC_ONLY = true;
const FULL_BACKUP_CHUNK_BYTES = 1024 * 1024;
const FULL_BACKUP_DOWNLOAD_CHUNK_BYTES = 1024 * 1024;
let deferredCloudRestorePromise = null;
let deferredCloudRestoreUpdatedAt = '';
let backgroundCloudBootstrapTimer = null;
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
    const pending = getPendingOps();
    let pushed = false;
    let latestSnapshotAt = '';
    if (!options.pullOnly && pending.length > 0) {
      const pushRes = await fetch('/api/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ops: pending }),
      });
      const pushData = await pushRes.json().catch(() => ({}));
      if (!pushRes.ok) throw new Error(pushData.detail || pushData.error || 'sync push failed');
      localStorage.removeItem('pendingOps');
      pushed = true;
      latestSnapshotAt = pushData.snapshotUpdatedAt || latestSnapshotAt;
      if (Array.isArray(pushData.origins)) updateCloudOriginStatuses(pushData.origins);
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
    let cursorAt = options.forceFullPull ? '' : (syncCursor.cursorAt || '');
    let cursorId = options.forceFullPull ? '' : (syncCursor.cursorId || '');
    let pulled = 0;
    let serverTime = syncCursor.since || '';
    while (true) {
      const params = new URLSearchParams();
      params.set('since', baseSince);
      if (cursorAt) params.set('cursorAt', cursorAt);
      if (cursorId) params.set('cursorId', cursorId);
      const pullRes = await fetch(`/api/sync?${params.toString()}`, { credentials: 'include' });
      const pullData = await pullRes.json().catch(() => ({}));
      if (!pullRes.ok) throw new Error(pullData.detail || pullData.error || 'sync pull failed');
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
      cursorId = pullData.nextCursorId || (ops.length ? String(ops[ops.length - 1].id || '') : cursorId);
      if (!cursorAt) break;
      try {
        localStorage.setItem('lastSyncCursorAt', cursorAt);
        localStorage.setItem('lastSyncCursorId', cursorId);
      } catch (e) {}
    }
    rememberLastSyncCursor(serverTime);
    markIncrementalSyncChecked(serverTime || new Date().toISOString());
    setNextIncrementalSyncAt('');
    if (latestSnapshotAt) {
      cloudMeta.lastSeenBackupAt = latestSnapshotAt;
      saveCloudMeta();
    }
    if (pushed || pulled > 0) {
      setCloudSyncState('synced', '错题增量同步完成', latestSnapshotAt || serverTime || '');
    }
  } catch (e) {
    setCloudSyncState('error', e.message || '错题增量同步失败', '');
    console.warn('[syncWithServer] failed', e);
  } finally {
    incrementalSyncBusy = false;
  }
}
