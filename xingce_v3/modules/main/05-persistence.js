// ============================================================
// 持久化（IndexedDB）
// ============================================================
function isLikelyMobileLikeDevice() {
  try {
    if (window.matchMedia && window.matchMedia('(max-width: 1024px)').matches) return true;
    if (typeof navigator !== 'undefined') {
      if (Number(navigator.maxTouchPoints || 0) >= 2 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
      const ua = String(navigator.userAgent || '').toLowerCase();
      if (/iphone|ipad|android|mobile|tablet/.test(ua)) return true;
    }
  } catch (e) {}
  return false;
}
function shouldDeferFullDataLoadOnStartup() {
  const summary = startupSummaryCache || {};
  const bytes = Number(summary.errorsBytes || 0);
  const totalErrors = Number(summary.totalErrors || 0);
  // On large datasets, eager JSON parse blocks the main thread during refresh.
  // Always defer full-load and enter with lightweight summary first.
  if (bytes >= 1024 * 1024 || totalErrors >= 1200) return true;
  return isLikelyMobileLikeDevice() && bytes >= 512 * 1024;
}
async function loadStartupSummaryCacheFromDb() {
  try {
    startupSummaryCache = JSON.parse(await DB.get(KEY_STARTUP_SUMMARY) || 'null');
  } catch (e) {
    startupSummaryCache = null;
  }
  return startupSummaryCache;
}
function buildStartupSummary(errorsBytes) {
  const summary = {
    builtAt: new Date().toISOString(),
    errorsBytes: Number(errorsBytes || 0),
    totalErrors: 0,
    fullPracticeCount: 0,
    todayDone: Number(todayDone || 0),
    todayDue: 0,
    noteFirstCount: 0,
    directDoCount: 0,
    speedDrillCount: 0,
    accuracy: 0,
    weakestReasons: [],
    workflowAdvice: []
  };
  if (typeof buildPracticeTaskPack === 'function') {
    const taskPack = buildPracticeTaskPack(24);
    summary.totalErrors = getErrorEntries().length;
    summary.fullPracticeCount = getErrorEntries().filter(e => !isEffectivelyMastered(e)).length;
    summary.todayDue = Number((taskPack.dailyQueue || []).length || 0);
    summary.noteFirstCount = Number((taskPack.noteFirstQueue || []).length || 0);
    summary.directDoCount = Number((taskPack.directDoQueue || []).length || 0);
    summary.speedDrillCount = Number((taskPack.speedDrillQueue || []).length || 0);
    summary.weakestReasons = (taskPack.weakestReasons || []).slice(0, 5);
    summary.workflowAdvice = (taskPack.advice || []).slice(0, 4);
  }
  if (typeof getPracticeBehaviorSnapshot === 'function') {
    const behavior = getPracticeBehaviorSnapshot(7) || {};
    summary.accuracy = Number(behavior.accuracy || 0);
  }
  startupSummaryCache = summary;
  return summary;
}
function persistStartupSummary(errorsText) {
  try {
    const summary = buildStartupSummary(String(errorsText || '').length);
    queuePersist(KEY_STARTUP_SUMMARY, summary, 80);
  } catch (e) {
    console.warn('[persistStartupSummary] failed', e);
  }
}
async function loadFullErrorsFromDb() {
  try {
    errors = (JSON.parse(await DB.get(KEY_ERRORS)) || getInitialData()).map(item => normalizeEntryRecord(item, 'error'));
  } catch (e) {
    errors = getInitialData();
  }
  fullDataLoaded = true;
  fullDataLoading = false;
  try {
    buildStartupSummary(JSON.stringify(errors).length);
  } catch (e) {}
}
async function loadData(options) {
  const opts = options || {};
  await loadStartupSummaryCacheFromDb();
  const deferErrors = !!opts.deferErrors;
  if (deferErrors) {
    errors = [];
    fullDataLoaded = false;
    fullDataLoading = false;
  } else {
    await loadFullErrorsFromDb();
  }
  try { revealed = new Set(JSON.parse(await DB.get(KEY_REVEALED)||'[]')); }
  catch(e) { revealed = new Set(); }
  try { expTypes = new Set(JSON.parse(await DB.get(KEY_EXP_TYPES)||'[]')); }
  catch(e) { expTypes = new Set(); }
  try {
    const a = JSON.parse(await DB.get(KEY_EXP_MAIN)||'[]');
    expMain    = new Set(a.filter(x=>!x.startsWith('sub:')));
    expMainSub = new Set(a.filter(x=>x.startsWith('sub:')));
  } catch(e) { expMain = new Set(); expMainSub = new Set(); }
  try { expMainSub2 = new Set(JSON.parse(await DB.get(KEY_EXP_SUB2)||'[]')); }
  catch(e) { expMainSub2 = new Set(); }
  globalNote = await DB.get(KEY_GLOBAL_NOTE)||'';
  todayDate = today();
  const sd = await DB.get(KEY_TODAY_DATE);
  todayDone = sd===todayDate ? parseInt(await DB.get(KEY_TODAY_DONE)||'0') : 0;
  // 加载 typeRules / dirTree 缓存
  try { _typeRules = JSON.parse(await DB.get(KEY_TYPE_RULES)) || null; } catch(e) { _typeRules = null; }
  try { _dirTree   = JSON.parse(await DB.get(KEY_DIR_TREE))   || null; } catch(e) { _dirTree   = null; }
  // 加载 history 缓存
  try { _history = JSON.parse(await DB.get(KEY_HISTORY)||'[]'); } catch(e) { _history = []; }
  try { cloudMeta = { ...getDefaultCloudMeta(), ...(JSON.parse(await DB.get(KEY_CLOUD_META)||'{}') || {}) }; }
  catch(e) { cloudMeta = getDefaultCloudMeta(); }
  await loadNotesByType();
  await loadKnowledgeState();
  await migrateIntegerIds();
  if (fullDataLoaded) setErrorSyncSnapshot();
  setWorkspaceSyncSnapshot();
}
let fullWorkspaceDataPromise = null;
async function ensureFullWorkspaceDataLoaded() {
  if (fullDataLoaded) return true;
  if (fullWorkspaceDataPromise) return fullWorkspaceDataPromise;
  fullDataLoading = true;
  fullWorkspaceDataPromise = (async () => {
    await loadFullErrorsFromDb();
    await migrateIntegerIds();
    setErrorSyncSnapshot();
    if (typeof syncNotesWithErrors === 'function') syncNotesWithErrors();
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderAll === 'function') renderAll();
    if (typeof renderNotesByType === 'function') renderNotesByType();
    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
    return true;
  })().finally(() => {
    fullWorkspaceDataPromise = null;
  });
  return fullWorkspaceDataPromise;
}
function scheduleDeferredFullWorkspaceLoad() {
  if (fullDataLoaded || fullDataLoading) return;
  const run = () => {
    // Keep refresh smooth: only hydrate full workspace when user enters workspace.
    if (typeof appView !== 'undefined' && appView !== 'workspace') return;
    ensureFullWorkspaceDataLoaded();
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 5000 });
  } else {
    setTimeout(run, 3000);
  }
}
function reportLocalStorageFailure(error) {
  showToast('Local storage failed: ' + (error && error.message ? error.message : 'Unknown error'), 'error');
}
function showCloudInfo(message, opts) {
  if (opts && opts.silent) return;
  showToast(message, 'success');
}
function showCloudWarning(message, opts) {
  if (opts && opts.silent) return;
  showToast(message, 'warning');
}
function showCloudError(error, fallbackMessage, opts) {
  if (opts && opts.silent) return;
  showToast((error && error.message) || fallbackMessage, 'error');
}
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
const persistTimers = new Map();
let suppressCloudAutoSave = 0;
let suppressIncrementalSync = 0;
let errorSyncSnapshot = new Map();
let workspaceSyncSnapshot = new Map();
function queuePersist(key, value, delay) {
  const wait = typeof delay === 'number' ? delay : 160;
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  clearTimeout(persistTimers.get(key));
  const timer = setTimeout(() => {
    DB.set(key, encoded).catch(reportLocalStorageFailure);
    persistTimers.delete(key);
  }, wait);
  persistTimers.set(key, timer);
}
function withCloudAutoSaveSuppressed(fn) {
  suppressCloudAutoSave += 1;
  try {
    return fn();
  } finally {
    suppressCloudAutoSave = Math.max(0, suppressCloudAutoSave - 1);
  }
}
function buildErrorSyncSnapshot() {
  const snapshot = new Map();
  getErrorEntries().forEach(item => {
    const normalized = normalizeEntryRecord(item, 'error');
    snapshot.set(String(normalized.id), JSON.stringify(normalized));
  });
  return snapshot;
}
function buildExpansionStateSyncValue() {
  return {
    main: [...expMain],
    sub: [...expMainSub],
    sub2: [...expMainSub2]
  };
}
function flattenKnowledgeNodesForSync(nodes, parentId, bucket) {
  const list = Array.isArray(nodes) ? nodes : [];
  const acc = bucket || [];
  list.forEach((node, idx) => {
    if (!node) return;
    acc.push({
      id: String(node.id || newKnowledgeNodeId()),
      parentId: String(parentId || ''),
      title: String(node.title || ''),
      contentMd: String(node.contentMd || ''),
      updatedAt: String(node.updatedAt || ''),
      sort: idx
    });
    flattenKnowledgeNodesForSync(node.children || [], node.id, acc);
  });
  return acc;
}
function buildKnowledgeNodeSyncSnapshot() {
  const snapshot = new Map();
  flattenKnowledgeNodesForSync(getKnowledgeRootNodes(), '', []).forEach(record => {
    snapshot.set(`knowledge_node:${record.id}`, JSON.stringify(record));
  });
  return snapshot;
}
function buildWorkspaceSyncSnapshot() {
  const snapshot = new Map();
  Object.entries(notesByType || {}).forEach(([key, value]) => {
    snapshot.set(`note_type:${String(key)}`, JSON.stringify({
      key: String(key),
      value: value || {},
      updatedAt: String((value && value.updatedAt) || '')
    }));
  });
  Object.entries(noteImages || {}).forEach(([id, data]) => {
    snapshot.set(`note_image:${String(id)}`, JSON.stringify({
      id: String(id),
      data: data || ''
    }));
  });
  buildKnowledgeNodeSyncSnapshot().forEach((value, key) => snapshot.set(key, value));
  [
    ['revealed', [...revealed]],
    ['exp_types', [...expTypes]],
    ['expansion_state', buildExpansionStateSyncValue()],
    ['global_note', globalNote || ''],
    ['type_rules', _typeRules || null],
    ['dir_tree', _dirTree || null],
    ['knowledge_expanded', Array.from(knowledgeExpanded || [])],
    ['today_progress', { date: todayDate || '', done: Number(todayDone || 0) }],
    ['history', _history || []]
  ].forEach(([key, value]) => {
    snapshot.set(`setting:${key}`, JSON.stringify({
      key,
      value,
      updatedAt: ''
    }));
  });
  return snapshot;
}
function setErrorSyncSnapshot(snapshot) {
  errorSyncSnapshot = snapshot instanceof Map ? snapshot : buildErrorSyncSnapshot();
}
function setWorkspaceSyncSnapshot(snapshot) {
  workspaceSyncSnapshot = snapshot instanceof Map ? snapshot : buildWorkspaceSyncSnapshot();
}
function withIncrementalSyncSuppressed(fn) {
  suppressIncrementalSync += 1;
  try {
    return fn();
  } finally {
    suppressIncrementalSync = Math.max(0, suppressIncrementalSync - 1);
    setErrorSyncSnapshot();
    setWorkspaceSyncSnapshot();
  }
}
function syncErrorOpsFromSnapshot() {
  const nextSnapshot = buildErrorSyncSnapshot();
  let changed = false;
  if (suppressIncrementalSync > 0) {
    errorSyncSnapshot = nextSnapshot;
    return changed;
  }
  for (const [id, payloadText] of nextSnapshot.entries()) {
    if (errorSyncSnapshot.get(id) === payloadText) continue;
    recordOp('error_upsert', id, JSON.parse(payloadText), { skipSnapshotUpdate: true });
    changed = true;
  }
  for (const id of errorSyncSnapshot.keys()) {
    if (nextSnapshot.has(id)) continue;
    recordOp('error_delete', id, {}, { skipSnapshotUpdate: true });
    changed = true;
  }
  errorSyncSnapshot = nextSnapshot;
  return changed;
}
function getSyncEntityBase(opType) {
  return String(opType || '').replace(/_(upsert|delete)$/, '');
}
function getSyncOpTypesForEntityKey(entityKey) {
  const [kind] = String(entityKey || '').split(':');
  if (kind === 'note_type') return { upsert: 'note_type_upsert', delete: 'note_type_delete' };
  if (kind === 'note_image') return { upsert: 'note_image_upsert', delete: 'note_image_delete' };
  if (kind === 'knowledge_node') return { upsert: 'knowledge_node_upsert', delete: 'knowledge_node_delete' };
  if (kind === 'setting') return { upsert: 'setting_upsert', delete: 'setting_delete' };
  return null;
}
function getEntityIdFromSyncKey(entityKey) {
  const parts = String(entityKey || '').split(':');
  return parts.slice(1).join(':');
}
function syncWorkspaceOpsFromSnapshot() {
  const nextSnapshot = buildWorkspaceSyncSnapshot();
  let changed = false;
  if (suppressIncrementalSync > 0) {
    workspaceSyncSnapshot = nextSnapshot;
    return changed;
  }
  for (const [entityKey, payloadText] of nextSnapshot.entries()) {
    if (workspaceSyncSnapshot.get(entityKey) === payloadText) continue;
    const opTypes = getSyncOpTypesForEntityKey(entityKey);
    if (!opTypes) continue;
    recordOp(opTypes.upsert, getEntityIdFromSyncKey(entityKey), JSON.parse(payloadText), { skipSnapshotUpdate: true, silentState: true });
    changed = true;
  }
  for (const entityKey of workspaceSyncSnapshot.keys()) {
    if (nextSnapshot.has(entityKey)) continue;
    const opTypes = getSyncOpTypesForEntityKey(entityKey);
    if (!opTypes) continue;
    recordOp(opTypes.delete, getEntityIdFromSyncKey(entityKey), {}, { skipSnapshotUpdate: true, silentState: true });
    changed = true;
  }
  workspaceSyncSnapshot = nextSnapshot;
  return changed;
}
function markIncrementalWorkspaceChange() {
  if (suppressIncrementalSync === 0) markLocalChange();
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
saveKnowledgeState = function() {
  mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes());
  collapseDuplicateKnowledgeWrappers(getKnowledgeRootNodes());
  pruneKnowledgeGhostNodes(getKnowledgeRootNodes(), getKnowledgeDirectErrorCountMap());
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
function toggleCloudDetails() {
  cloudDetailsExpanded = !cloudDetailsExpanded;
  renderCloudUi();
}
function getFullBackupPayload() {
  return {
    xc_version: 2,
    exportTime: new Date().toISOString(),
    baseUpdatedAt: cloudMeta.lastSeenBackupAt || '',
    forceOverwrite: false,
    errors: errors,
    revealed: [...revealed],
    expTypes: [...expTypes],
    expMain: [...expMain],
    expMainSub: [...expMainSub],
    expMainSub2: [...expMainSub2],
    notesByType: notesByType,
    noteImages: noteImages,
    typeRules: _typeRules,
    dirTree: _dirTree,
    globalNote: globalNote,
    knowledgeTree: knowledgeTree,
    knowledgeNotes: knowledgeNotes,
    knowledgeExpanded: Array.from(knowledgeExpanded || []),
    todayDate: todayDate || '',
    todayDone: Number(todayDone || 0),
    history: _history || []
  };
}
function isPortableImageApiRef(value) {
  return typeof value === 'string' && /^\/api\/images\/[a-f0-9]{32,64}$/i.test(value.trim());
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read blob failed'));
    reader.readAsDataURL(blob);
  });
}
const portableImageCache = new Map();
async function materializePortableImageValue(value) {
  if (!value || typeof value !== 'string') return value || '';
  const trimmed = value.trim();
  if (!isPortableImageApiRef(trimmed)) return trimmed;
  if (portableImageCache.has(trimmed)) return portableImageCache.get(trimmed);
  try {
    const res = await fetch(trimmed, { credentials: 'include' });
    if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
    const dataUrl = await blobToDataUrl(await res.blob());
    const portable = dataUrl || trimmed;
    portableImageCache.set(trimmed, portable);
    return portable;
  } catch (err) {
    console.warn('[materializePortableImageValue] fallback to original ref', trimmed, err);
    return trimmed;
  }
}
async function buildPortableErrorExport(errorLike) {
  const item = cloneJson(errorLike || {});
  item.imgData = await materializePortableImageValue(item.imgData || '');
  item.analysisImgData = await materializePortableImageValue(item.analysisImgData || '');
  if (item && item.noteNodeId && typeof getKnowledgePathTitles === 'function' && typeof collapseKnowledgePathTitles === 'function') {
    const titles = collapseKnowledgePathTitles(getKnowledgePathTitles(item.noteNodeId));
    if (titles && titles.length) {
      item.knowledgePathTitles = titles.slice();
      item.knowledgePath = titles.join(' > ');
      item.knowledgeNodePath = titles.join(' > ');
      item.notePath = titles.join(' > ');
    }
  }
  return item;
}
async function buildPortableBackupPayload(payload) {
  if (Array.isArray(payload)) {
    return Promise.all((payload || []).map(buildPortableErrorExport));
  }
  const backup = cloneJson(payload || {});
  backup.errors = await Promise.all(((backup.errors || [])).map(buildPortableErrorExport));
  return backup;
}
window.buildPortableBackupPayload = buildPortableBackupPayload;
window.shouldDeferFullDataLoadOnStartup = shouldDeferFullDataLoadOnStartup;
window.ensureFullWorkspaceDataLoaded = ensureFullWorkspaceDataLoaded;
window.scheduleDeferredFullWorkspaceLoad = scheduleDeferredFullWorkspaceLoad;
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
async function applyCloudBackup(data, updatedAt, opts) {
  opts = opts || {};
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
  if (typeof hasFullWorkspaceDataLoaded === 'function' && !hasFullWorkspaceDataLoaded()) return;
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
    const ok = confirm('检测到该账号已有云端备份。是否恢复到当前入口？\n\n选择“取消”会保留当前入口本地数据，你仍可稍后点击 Cloud Load 手动恢复。');
    if (!ok) {
      rememberCloudDecision(updatedAt, 'kept_local');
      setCloudSyncState('dirty', 'Keeping local entry data; cloud backup not loaded', updatedAt);
      showCloudWarning('Local data was kept. Use Cloud Load any time to restore the cloud copy.');
      return;
    }
    if (shouldUseDeferredCloudRestore(meta)) {
      setCloudSyncState('saving', `云端数据较大（${formatBackupBytes(getCloudBackupBytes(meta))}），已切换为后台缓慢同步`, updatedAt);
      queueDeferredCloudRestore(meta, { forceOverwriteLocal: true });
      showCloudInfo('Started restoring the cloud backup in the background');
      return;
    }
    const data = await fetchCloudBackupData();
    if (!data.exists || !data.backup) return;
    await applyCloudBackup({ ...data.backup, summary: data.summary || {} }, updatedAt || data.backup.exportTime || '', { silent: true, forceOverwriteLocal: true, staged: true, skipCompletionAlert: true });
    showCloudInfo('Cloud backup restored to the current entry');
  } catch (e) {
    console.warn('cloud restore skipped:', e);
  } finally {
    cloudBusy = false;
  }
}
function renderCloudUi() {
  const badge = document.getElementById('cloudUserBadge');
  const syncBadge = document.getElementById('cloudSyncBadge');
  const syncHint = document.getElementById('cloudSyncHint');
  const originStatus = document.getElementById('cloudOriginStatus');
  const detailsToggle = document.getElementById('cloudDetailsToggle');
  const logoutBtn = document.getElementById('cloudLogoutBtn');
  if (!badge || !logoutBtn || !syncBadge || !syncHint || !originStatus || !detailsToggle) return;
  if (cloudUser) {
    badge.textContent = 'Cloud: ' + cloudUser.username;
    logoutBtn.style.display = '';
  } else {
    badge.textContent = 'Cloud: offline';
    logoutBtn.style.display = '';
  }
  syncBadge.className = `cloud-status-badge ${cloudSyncState}`;
  syncBadge.textContent = ({
    idle: 'idle',
    dirty: 'local changed',
    saving: 'syncing',
    synced: 'synced',
    error: 'sync failed'
  })[cloudSyncState] || cloudSyncState;
  const currentOrigin = mergeCurrentOriginStatus();
  const originText = currentOrigin.origin || getCloudOriginKey();
  const timeText = formatCloudTime(cloudSyncUpdatedAt || cloudMeta.lastSavedAt || cloudMeta.lastLoadedAt || '');
  const cloudUpdatedText = formatCloudTime(cloudMeta.lastSeenBackupAt || currentOrigin.lastBackupUpdatedAt || '');
  const localUpdatedText = formatCloudTime(currentOrigin.lastLocalChangeAt || currentOrigin.lastSavedAt || currentOrigin.lastLoadedAt || '');
  syncHint.textContent = [
    `账号: ${cloudUser ? cloudUser.username : 'offline'}`,
    `当前域名: ${originText}`,
    cloudSyncMessage || '',
    timeText ? `Last event: ${timeText}` : '',
    localUpdatedText ? `当前最后修改: ${localUpdatedText}` : '',
    cloudUpdatedText ? `云端备份: ${cloudUpdatedText}` : '',
    'Local cache is per origin.'
  ].filter(Boolean).join(' | ');
  const currentMs = toCloudTimeMs(getOriginDisplayTime(currentOrigin));
  const newerOrigins = (cloudOriginStatuses || []).filter(item => item.origin !== originText).filter(item => currentMs && currentMs > toCloudTimeMs(getOriginDisplayTime(item)));
  const lines = [];
  if (newerOrigins.length) lines.push(`<div class="cloud-origin-alert">当前域名修改时间更新，已晚于其他 ${newerOrigins.length} 个入口</div>`);
  const mergedItems = [currentOrigin].concat((cloudOriginStatuses || []).filter(item => item.origin !== originText));
  mergedItems.forEach(item => {
    const label = item.origin === originText ? '当前' : '其他';
    const localText = formatCloudTime(item.lastLocalChangeAt || item.lastSavedAt || item.lastLoadedAt || '');
    const cloudText = formatCloudTime(item.lastBackupUpdatedAt || '');
    const suffix = [
      localText ? `本地: ${localText}` : '',
      cloudText ? `云端: ${cloudText}` : ''
    ].filter(Boolean).join(' | ');
    lines.push(`<div>${escapeHtml(label)} ${escapeHtml(item.origin)}${suffix ? ` | ${escapeHtml(suffix)}` : ''}</div>`);
  });
  originStatus.innerHTML = lines.join('');
}
function getCloudSyncBadgeLabel(state) {
  return ({
    idle: '就绪',
    dirty: '本地较新',
    saving: '后台处理中',
    synced: '已对齐',
    error: '需处理'
  })[state] || state;
}
function getCloudFreshnessText(localIso, cloudIso) {
  const localMs = toCloudTimeMs(localIso);
  const cloudMs = toCloudTimeMs(cloudIso);
  if (!localMs && !cloudMs) return '';
  if (localMs && !cloudMs) return '当前只有本地记录，云端还没有备份';
  if (!localMs && cloudMs) return '当前只有云端记录，本地还没有记录';
  if (localMs > cloudMs) return '本地时间更新，后续会在后台继续对齐';
  if (cloudMs > localMs) return '云端时间更新，建议先确认后再覆盖';
  return '本地与云端时间一致';
}
function getCloudActionHint(state) {
  if (state === 'error') return '可点 Cloud Load 或 Cloud Save 重新处理';
  if (state === 'dirty') return '本地改动已记住，系统会在后台继续处理';
  if (state === 'saving') return '正在后台处理，不需要重复点击';
  if (state === 'synced') return '当前入口和云端已经对齐';
  return '默认先使用本地数据，必要时再后台检查云端';
}
function getLastIncrementalAlignedIso() {
  return String((cloudMeta && cloudMeta.lastIncrementalAlignedAt) || '').trim();
}
renderCloudUi = function() {
  const badge = document.getElementById('cloudUserBadge');
  const syncBadge = document.getElementById('cloudSyncBadge');
  const syncHint = document.getElementById('cloudSyncHint');
  const originStatus = document.getElementById('cloudOriginStatus');
  const detailsToggle = document.getElementById('cloudDetailsToggle');
  const logoutBtn = document.getElementById('cloudLogoutBtn');
  if (!badge || !logoutBtn || !syncBadge || !syncHint || !originStatus || !detailsToggle) return;
  if (cloudUser) {
    badge.textContent = 'Cloud: ' + cloudUser.username;
    logoutBtn.style.display = '';
  } else {
    badge.textContent = 'Cloud: offline';
    logoutBtn.style.display = '';
  }
  syncBadge.className = `cloud-status-badge ${cloudSyncState}`;
  syncBadge.textContent = getCloudSyncBadgeLabel(cloudSyncState);
  const currentOrigin = mergeCurrentOriginStatus();
  const originText = currentOrigin.origin || getCloudOriginKey();
  const currentLocalIso = currentOrigin.lastLocalChangeAt || currentOrigin.lastSavedAt || currentOrigin.lastLoadedAt || '';
  const currentCloudBackupIso = currentOrigin.lastBackupUpdatedAt || cloudMeta.lastSeenBackupAt || '';
  const currentIncrementalIso = getLastIncrementalAlignedIso();
  const cloudIncrementalText = formatCloudTime(currentIncrementalIso);
  const cloudBackupText = formatCloudTime(currentCloudBackupIso);
  const currentCloudIsoForFreshness = currentIncrementalIso || currentCloudBackupIso;
  const localUpdatedText = formatCloudTime(currentLocalIso);
  const freshnessText = getCloudFreshnessText(currentLocalIso, currentCloudIsoForFreshness);
  const hintLines = [
    localUpdatedText ? `本地最后修改: ${localUpdatedText}` : '本地最后修改: 暂无',
    cloudIncrementalText ? `云端最后增量同步: ${cloudIncrementalText}` : '云端最后增量同步: 暂无',
    cloudBackupText ? `云端最后全量备份: ${cloudBackupText}` : '云端最后全量备份: 暂无',
    freshnessText,
    cloudSyncMessage || '',
    getCloudActionHint(cloudSyncState)
  ].filter(Boolean);
  syncHint.innerHTML = hintLines.map(line => `<div>${escapeHtml(line)}</div>`).join('');
  const currentMs = toCloudTimeMs(getOriginDisplayTime(currentOrigin));
  const newerOrigins = (cloudOriginStatuses || []).filter(item => item.origin !== originText).filter(item => currentMs && currentMs > toCloudTimeMs(getOriginDisplayTime(item)));
  const lines = [];
  if (newerOrigins.length) lines.push(`<div class="cloud-origin-alert">当前入口比其他 ${newerOrigins.length} 个入口更新，保存前请确认是否要覆盖云端</div>`);
  lines.push(`<div>当前入口: ${escapeHtml(originText)}</div>`);
  lines.push(`<div>本地最后修改: ${escapeHtml(localUpdatedText || '暂无')}</div>`);
  lines.push(`<div>云端最后增量同步: ${escapeHtml(cloudIncrementalText || '暂无')}</div>`);
  lines.push(`<div>云端最后全量备份: ${escapeHtml(cloudBackupText || '暂无')}</div>`);
  const mergedItems = [currentOrigin].concat((cloudOriginStatuses || []).filter(item => item.origin !== originText));
  mergedItems.forEach(item => {
    const label = item.origin === originText ? '当前' : '其他';
    const localText = formatCloudTime(item.lastLocalChangeAt || item.lastSavedAt || item.lastLoadedAt || '');
    const cloudText = formatCloudTime(item.lastBackupUpdatedAt || '');
    const suffix = [
      localText ? `本地: ${localText}` : '',
      cloudText ? `云端: ${cloudText}` : ''
    ].filter(Boolean).join(' | ');
    lines.push(`<div>${escapeHtml(label)} ${escapeHtml(item.origin)}${suffix ? ` | ${escapeHtml(suffix)}` : ''}</div>`);
  });
  detailsToggle.textContent = cloudDetailsExpanded ? '收起' : '详情';
  originStatus.classList.toggle('expanded', cloudDetailsExpanded);
  originStatus.innerHTML = lines.join('');
};
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
  const ok = confirm('将从云端全量同步并覆盖当前本地数据。继续吗？');
  if (!ok) return;
  await loadCloudBackup({ silent: false, askBeforeRestore: false, forceOverwriteLocal: true });
}
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
    await syncWithServer();
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
// 生成笔记图片短 ID
async function migrateIntegerIds() {
  if (!Array.isArray(errors) || !errors.length) return;
  const hasIntegerId = errors.some(item => Number.isInteger(item.id));
  if (!hasIntegerId) return;
  const idMap = {};
  errors.forEach(item => {
    if (Number.isInteger(item.id)) {
      const oldId = item.id;
      const nextId = crypto.randomUUID();
      idMap[String(oldId)] = nextId;
      item.id = nextId;
      item.updatedAt = item.updatedAt || new Date().toISOString();
    } else {
      item.id = String(item.id);
    }
  });
  revealed = new Set(
    [...revealed]
      .map(id => idMap[String(id)] || (typeof id === 'string' ? id : null))
      .filter(Boolean)
  );
  await Promise.all([
    DB.set(KEY_ERRORS, JSON.stringify(errors)),
    DB.set(KEY_REVEALED, JSON.stringify([...revealed]))
  ]);
  setErrorSyncSnapshot();
  setWorkspaceSyncSnapshot();
  console.log('[migrate] integer IDs converted to UUIDs:', Object.keys(idMap).length);
}
function getPendingOps() {
  try {
    return JSON.parse(localStorage.getItem('pendingOps') || '[]');
  } catch (e) {
    console.warn('[pendingOps] read failed', e);
    return [];
  }
}
function savePendingOps(pending) {
  try {
    localStorage.setItem('pendingOps', JSON.stringify(pending));
  } catch (e) {
    console.warn('[pendingOps] write failed', e);
  }
}
function isIncrementalSyncOp(opType) {
  return /_(upsert|delete)$/.test(String(opType || ''));
}
function recordOp(opType, entityId, payload, opts) {
  opts = opts || {};
  const op = {
    id: crypto.randomUUID(),
    op_type: opType,
    entity_id: String(entityId),
    payload: payload || {},
    created_at: new Date().toISOString(),
  };
  let pending = getPendingOps();
  if (isIncrementalSyncOp(opType)) {
    const base = getSyncEntityBase(opType);
    pending = pending.filter(item => !(getSyncEntityBase(item.op_type) === base && String(item.entity_id) === op.entity_id));
  }
  pending.push(op);
  savePendingOps(pending);
  if (!opts.silentState) {
    if (cloudUser) {
      setCloudSyncState('dirty', '错题改动已记录，稍后会在后台处理', op.created_at);
    } else {
      setCloudSyncState('dirty', '本地错题改动已记录，登录后可继续处理', op.created_at);
    }
  }
  scheduleIncrementalSync();
}
let incrementalSyncTimer = null;
function scheduleIncrementalSync() {
  if (!cloudUser) return;
  clearTimeout(incrementalSyncTimer);
  setNextIncrementalSyncAt(new Date(Date.now() + AUTO_SYNC_DELAY_MS).toISOString());
  incrementalSyncTimer = setTimeout(() => {
    incrementalSyncTimer = null;
    syncWithServer();
  }, AUTO_SYNC_DELAY_MS);
}
function recordErrorUpsert(errorItem) {
  if (!errorItem) return;
  errorSyncSnapshot.set(String(errorItem.id), JSON.stringify(normalizeEntryRecord(errorItem, 'error')));
  recordOp('error_upsert', errorItem.id, errorItem);
}
function recordErrorDelete(errorId) {
  errorSyncSnapshot.delete(String(errorId));
  recordOp('error_delete', errorId, {});
}
function parseSyncPayload(payload) {
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch (e) { return {}; }
  }
  return payload || {};
}
function buildKnowledgeTreeFromSyncRecords(records) {
  const rows = Array.isArray(records) ? records : [];
  const map = new Map();
  rows.forEach(raw => {
    if (!raw || !raw.id) return;
    map.set(String(raw.id), {
      id: String(raw.id),
      title: String(raw.title || ''),
      level: 1,
      contentMd: String(raw.contentMd || ''),
      updatedAt: String(raw.updatedAt || ''),
      isLeaf: true,
      children: [],
      sort: Number(raw.sort || 0),
      parentId: String(raw.parentId || '')
    });
  });
  const roots = [];
  map.forEach(node => {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId).children.push(node);
    else roots.push(node);
  });
  function finalize(nodes, level) {
    return (nodes || [])
      .sort((a, b) => (a.sort - b.sort) || String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN'))
      .map(node => {
        const children = finalize(node.children || [], level + 1);
        return {
          id: node.id,
          title: node.title,
          level,
          contentMd: node.contentMd || '',
          updatedAt: node.updatedAt || '',
          isLeaf: children.length === 0,
          children
        };
      });
  }
  return { version: 1, roots: finalize(roots, 1) };
}
function applySettingSyncValue(key, value) {
  switch (String(key || '')) {
    case 'revealed':
      revealed = new Set(Array.isArray(value) ? value.map(String) : []);
      return true;
    case 'exp_types':
      expTypes = new Set(Array.isArray(value) ? value.map(String) : []);
      return true;
    case 'expansion_state': {
      const data = value && typeof value === 'object' ? value : {};
      expMain = new Set(Array.isArray(data.main) ? data.main.map(String) : []);
      expMainSub = new Set(Array.isArray(data.sub) ? data.sub.map(String) : []);
      expMainSub2 = new Set(Array.isArray(data.sub2) ? data.sub2.map(String) : []);
      return true;
    }
    case 'global_note':
      globalNote = typeof value === 'string' ? value : '';
      return true;
    case 'type_rules':
      _typeRules = value || null;
      return true;
    case 'dir_tree':
      _dirTree = value || null;
      return true;
    case 'knowledge_expanded':
      knowledgeExpanded = new Set(Array.isArray(value) ? value.map(String) : []);
      knowledgeExpandedLoaded = true;
      return true;
    case 'today_progress': {
      const data = value && typeof value === 'object' ? value : {};
      todayDate = String(data.date || today());
      todayDone = Number(data.done || 0);
      return true;
    }
    case 'history':
      _history = Array.isArray(value) ? value : [];
      return true;
  }
  return false;
}
function applyRemoteError(remote) {
  const idx = errors.findIndex(e => String(e.id) === String(remote.id));
  if (idx === -1) {
    errors.push(remote);
    return true;
  }
  if ((remote.updatedAt || '') > (errors[idx].updatedAt || '')) {
    errors[idx] = { ...errors[idx], ...remote };
    return true;
  }
  return false;
}
function applyOps(ops) {
  let errorChanged = false;
  let notesChanged = false;
  let noteImagesChanged = false;
  let knowledgeChanged = false;
  let settingsChanged = false;
  let knowledgeRecordMap = null;
  const isCorruptedKnowledgeTitle = (title) => {
    const text = String(title || '').trim();
    if (!text) return true;
    return /^\?+$/.test(text);
  };
  for (const op of ops) {
    if (op.op_type === 'error_upsert') {
      const remote = parseSyncPayload(op.payload);
      if (remote && remote.id) {
        remote.id = String(remote.id);
        errorChanged = applyRemoteError(remote) || errorChanged;
      }
      continue;
    }
    if (op.op_type === 'error_delete') {
      const before = errors.length;
      errors = errors.filter(e => String(e.id) !== String(op.entity_id));
      revealed.delete(String(op.entity_id));
      errorChanged = errorChanged || errors.length !== before;
      settingsChanged = true;
      continue;
    }
    if (op.op_type === 'note_type_upsert') {
      const remote = parseSyncPayload(op.payload);
      const key = String(remote.key || op.entity_id || '');
      if (key) {
        notesByType[key] = remote.value || {};
        notesChanged = true;
      }
      continue;
    }
    if (op.op_type === 'note_type_delete') {
      if (notesByType[String(op.entity_id)] !== undefined) {
        delete notesByType[String(op.entity_id)];
        notesChanged = true;
      }
      continue;
    }
    if (op.op_type === 'note_image_upsert') {
      const remote = parseSyncPayload(op.payload);
      const key = String(remote.id || op.entity_id || '');
      noteImages[key] = remote.data || '';
      noteImagesChanged = true;
      continue;
    }
    if (op.op_type === 'note_image_delete') {
      if (noteImages[String(op.entity_id)] !== undefined) {
        delete noteImages[String(op.entity_id)];
        noteImagesChanged = true;
      }
      continue;
    }
    if (op.op_type === 'knowledge_node_upsert') {
      if (!knowledgeRecordMap) {
        knowledgeRecordMap = new Map(flattenKnowledgeNodesForSync(getKnowledgeRootNodes(), '', []).map(item => [String(item.id), { ...item }]));
      }
      const remote = parseSyncPayload(op.payload);
      const nodeId = String(remote.id || op.entity_id || '');
      if (nodeId) {
        const remoteTitle = String(remote.title || '');
        if (isCorruptedKnowledgeTitle(remoteTitle)) {
          continue;
        }
        knowledgeRecordMap.set(nodeId, {
          id: nodeId,
          parentId: String(remote.parentId || ''),
          title: remoteTitle,
          contentMd: String(remote.contentMd || ''),
          updatedAt: String(remote.updatedAt || op.created_at || ''),
          sort: Number(remote.sort || 0)
        });
        knowledgeChanged = true;
      }
      continue;
    }
    if (op.op_type === 'knowledge_node_delete') {
      if (!knowledgeRecordMap) {
        knowledgeRecordMap = new Map(flattenKnowledgeNodesForSync(getKnowledgeRootNodes(), '', []).map(item => [String(item.id), { ...item }]));
      }
      if (knowledgeRecordMap.delete(String(op.entity_id))) knowledgeChanged = true;
      continue;
    }
    if (op.op_type === 'setting_upsert') {
      const remote = parseSyncPayload(op.payload);
      const key = String(remote.key || op.entity_id || '');
      settingsChanged = applySettingSyncValue(key, remote.value) || settingsChanged;
      continue;
    }
    if (op.op_type === 'setting_delete') {
      settingsChanged = applySettingSyncValue(String(op.entity_id || ''), null) || settingsChanged;
    }
  }
  if (knowledgeChanged && knowledgeRecordMap) {
    knowledgeTree = buildKnowledgeTreeFromSyncRecords([...knowledgeRecordMap.values()]);
    syncKnowledgeNotesFromTree();
    const allNodes = collectKnowledgeNodes();
    if ((!selectedKnowledgeNodeId || !getKnowledgeNodeById(selectedKnowledgeNodeId)) && allNodes.length > 0) {
      selectedKnowledgeNodeId = allNodes[0].id;
    }
  }
  if (errorChanged || notesChanged || noteImagesChanged || knowledgeChanged || settingsChanged) {
    withIncrementalSyncSuppressed(() => {
      if (errorChanged) saveData();
      if (settingsChanged) {
        saveReveal();
        saveExpTypes();
        saveExpMain();
        saveKnowledgeExpanded();
        saveTodayDone();
        queuePersist(KEY_GLOBAL_NOTE, globalNote || '');
        queuePersist(KEY_TYPE_RULES, _typeRules);
        queuePersist(KEY_DIR_TREE, _dirTree);
        queuePersist(KEY_HISTORY, _history || [], 220);
      }
      if (notesChanged || noteImagesChanged) saveNotesByType();
      if (knowledgeChanged) saveKnowledgeState();
      syncNotesWithErrors();
      renderSidebar();
      renderAll();
      renderNotesByType();
    });
  }
}
function getLastSyncCursor() {
  try {
    return {
      since: localStorage.getItem('lastSyncTime') || '',
      cursorAt: localStorage.getItem('lastSyncCursorAt') || '',
      cursorId: localStorage.getItem('lastSyncCursorId') || ''
    };
  } catch (e) {
    return { since: '', cursorAt: '', cursorId: '' };
  }
}
function clearLastSyncCursor() {
  try {
    localStorage.removeItem('lastSyncTime');
    localStorage.removeItem('lastSyncCursorAt');
    localStorage.removeItem('lastSyncCursorId');
  } catch (e) {}
}
function rememberLastSyncCursor(serverTime) {
  try {
    if (serverTime) localStorage.setItem('lastSyncTime', serverTime);
    localStorage.removeItem('lastSyncCursorAt');
    localStorage.removeItem('lastSyncCursorId');
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
