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
  return isLikelyMobileLikeDevice() && bytes >= 2 * 1024 * 1024;
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
  try { dailyJournalEntries = JSON.parse(await DB.get(KEY_DAILY_JOURNAL) || '{}') || {}; }
  catch(e) { dailyJournalEntries = {}; }
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
  const run = () => { ensureFullWorkspaceDataLoaded(); };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 1200);
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
    ['daily_journal', dailyJournalEntries || {}],
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
  if (suppressIncrementalSync > 0) {
    errorSyncSnapshot = nextSnapshot;
    return;
  }
  for (const [id, payloadText] of nextSnapshot.entries()) {
    if (errorSyncSnapshot.get(id) === payloadText) continue;
    recordOp('error_upsert', id, JSON.parse(payloadText), { skipSnapshotUpdate: true });
  }
  for (const id of errorSyncSnapshot.keys()) {
    if (nextSnapshot.has(id)) continue;
    recordOp('error_delete', id, {}, { skipSnapshotUpdate: true });
  }
  errorSyncSnapshot = nextSnapshot;
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
  if (suppressIncrementalSync > 0) {
    workspaceSyncSnapshot = nextSnapshot;
    return;
  }
  for (const [entityKey, payloadText] of nextSnapshot.entries()) {
    if (workspaceSyncSnapshot.get(entityKey) === payloadText) continue;
    const opTypes = getSyncOpTypesForEntityKey(entityKey);
    if (!opTypes) continue;
    recordOp(opTypes.upsert, getEntityIdFromSyncKey(entityKey), JSON.parse(payloadText), { skipSnapshotUpdate: true, silentState: true });
  }
  for (const entityKey of workspaceSyncSnapshot.keys()) {
    if (nextSnapshot.has(entityKey)) continue;
    const opTypes = getSyncOpTypesForEntityKey(entityKey);
    if (!opTypes) continue;
    recordOp(opTypes.delete, getEntityIdFromSyncKey(entityKey), {}, { skipSnapshotUpdate: true, silentState: true });
  }
  workspaceSyncSnapshot = nextSnapshot;
}
function markIncrementalWorkspaceChange() {
  if (suppressIncrementalSync === 0) markLocalChange();
}
saveData = function() {
  syncErrorOpsFromSnapshot();
  const encodedErrors = JSON.stringify(errors);
  queuePersist(KEY_ERRORS, encodedErrors);
  persistStartupSummary(encodedErrors);
  markIncrementalWorkspaceChange();
};
saveReveal = function() {
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_REVEALED, [...revealed]);
  markIncrementalWorkspaceChange();
};
saveExpMain = function() {
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_EXP_MAIN, [...expMain, ...expMainSub]);
  queuePersist(KEY_EXP_SUB2, [...expMainSub2]);
  markIncrementalWorkspaceChange();
};
saveExpTypes = function() {
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_EXP_TYPES, [...expTypes]);
  markIncrementalWorkspaceChange();
};
saveNotesByType = function() {
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_NOTES_BY_TYPE, notesByType);
  queuePersist(KEY_NOTE_IMAGES, noteImages);
  markIncrementalWorkspaceChange();
};
saveKnowledgeState = function() {
  mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes());
  collapseDuplicateKnowledgeWrappers(getKnowledgeRootNodes());
  pruneKnowledgeGhostNodes(getKnowledgeRootNodes(), getKnowledgeDirectErrorCountMap());
  syncKnowledgeNotesFromTree();
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_KNOWLEDGE_TREE, knowledgeTree);
  queuePersist(KEY_KNOWLEDGE_NOTES, knowledgeNotes);
  markIncrementalWorkspaceChange();
};
saveKnowledgeExpanded = function() {
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_KNOWLEDGE_EXPANDED, Array.from(knowledgeExpanded));
  markIncrementalWorkspaceChange();
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
    dailyJournalEntries: dailyJournalEntries || {},
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
function getDefaultCloudMeta() {
  return {
    restoreDecisions: {},
    lastSeenBackupAt: '',
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
  cloudMeta.lastIncrementalSyncAt = String(at || new Date().toISOString());
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
function scheduleDeferredSlowSync() {
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
  const run = () => { runBackgroundCloudBootstrap(strategy); };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => { run(); }, { timeout: 1200 });
    return;
  }
  setTimeout(() => { run(); }, 120);
}
function scheduleForegroundCloudWakeCheck() {
  if (backgroundCloudBootstrapTimer) clearTimeout(backgroundCloudBootstrapTimer);
  backgroundCloudBootstrapTimer = setTimeout(() => {
    backgroundCloudBootstrapTimer = null;
    scheduleBackgroundCloudBootstrap('foreground');
  }, 180);
}
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
  return Number(a.errors || 0) === Number(b.errors || 0)
    && Number(a.notesByType || 0) === Number(b.notesByType || 0)
    && Number(a.noteImages || 0) === Number(b.noteImages || 0)
    && Number(a.knowledgeNodes || 0) === Number(b.knowledgeNodes || 0)
    && Number(a.knowledgeNotes || 0) === Number(b.knowledgeNotes || 0);
}
async function clearWorkspaceStorageForRemoteRestore() {
  errors = [];
  revealed = new Set();
  expTypes = new Set();
  expMain = new Set();
  expMainSub = new Set();
  expMainSub2 = new Set();
  notesByType = {};
  noteImages = {};
  globalNote = '';
  _typeRules = null;
  _dirTree = null;
  knowledgeTree = null;
  knowledgeNotes = {};
  knowledgeExpanded = new Set();
  knowledgeExpandedLoaded = true;
  todayDate = today();
  todayDone = 0;
  _history = [];
  selectedKnowledgeNodeId = null;
  knowledgeNodeFilter = null;
  noteEditing = false;
  await Promise.all([
    DB.set(KEY_ERRORS, '[]'),
    DB.set(KEY_REVEALED, '[]'),
    DB.set(KEY_EXP_TYPES, '[]'),
    DB.set(KEY_EXP_MAIN, '[]'),
    DB.set(KEY_EXP_SUB2, '[]'),
    DB.set(KEY_NOTES_BY_TYPE, '{}'),
    DB.set(KEY_NOTE_IMAGES, '{}'),
    DB.set(KEY_GLOBAL_NOTE, ''),
    DB.set(KEY_TYPE_RULES, 'null'),
    DB.set(KEY_DIR_TREE, 'null'),
    DB.set(KEY_KNOWLEDGE_TREE, 'null'),
    DB.set(KEY_KNOWLEDGE_NOTES, '{}'),
    DB.set(KEY_KNOWLEDGE_EXPANDED, '[]'),
    DB.set(KEY_TODAY_DATE, todayDate),
    DB.set(KEY_TODAY_DONE, '0'),
    DB.set(KEY_HISTORY, '[]')
  ]);
  setErrorSyncSnapshot();
  setWorkspaceSyncSnapshot();
}
function clearLocalSyncMarkers() {
  try {
    localStorage.removeItem('pendingOps');
    localStorage.removeItem('lastSyncTime');
  } catch (e) {
    console.warn('clearLocalSyncMarkers failed:', e);
  }
}
function resetCurrentOriginRestoreDecision() {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  const originKey = getCloudOriginKey();
  cloudMeta.restoreDecisions = cloudMeta.restoreDecisions || {};
  delete cloudMeta.restoreDecisions[originKey];
  saveCloudMeta();
}
function getCloudOriginKey() {
  return window.location.origin || 'unknown';
}
function isLocalDebugOrigin(origin) {
  const value = String(origin || getCloudOriginKey() || '').toLowerCase();
  return value.includes('127.0.0.1') || value.includes('localhost');
}
function formatCloudTime(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}:${ss}`;
}
function toCloudTimeMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function getOriginDisplayTime(item) {
  if (!item) return '';
  return item.lastLocalChangeAt || item.lastSavedAt || item.lastLoadedAt || item.lastBackupUpdatedAt || item.updatedAt || '';
}
function mergeCurrentOriginStatus() {
  const origin = getCloudOriginKey();
  const current = (cloudOriginStatuses || []).find(item => item.origin === origin) || { origin };
  return {
    ...current,
    lastLocalChangeAt: cloudMeta.lastLocalChangeAt || current.lastLocalChangeAt || '',
    lastLoadedAt: cloudMeta.lastLoadedAt || current.lastLoadedAt || '',
    lastSavedAt: cloudMeta.lastSavedAt || current.lastSavedAt || '',
    lastBackupUpdatedAt: cloudMeta.lastSeenBackupAt || current.lastBackupUpdatedAt || ''
  };
}
function updateCloudOriginStatuses(items) {
  cloudOriginStatuses = Array.isArray(items) ? items : [];
}
async function pushOriginStatus(update) {
  if (!cloudUser) return;
  try {
    const res = await fetch('/api/origin-status', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update || {})
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) updateCloudOriginStatuses(data.origins);
  } catch (e) {
    console.warn('origin status sync skipped:', e);
  } finally {
    renderCloudUi();
  }
}
function scheduleOriginStatusSync(update) {
  if (!cloudUser) return;
  clearTimeout(cloudOriginStatusTimer);
  cloudOriginStatusTimer = setTimeout(() => {
    pushOriginStatus(update);
  }, 350);
}
function markLocalChange() {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  cloudMeta.lastLocalChangeAt = new Date().toISOString();
  saveCloudMeta();
  scheduleOriginStatusSync({ localChangedAt: cloudMeta.lastLocalChangeAt });
}
function setCloudSyncState(state, message, at) {
  cloudSyncState = state || 'idle';
  cloudSyncMessage = message || '';
  if (at) cloudSyncUpdatedAt = at;
  renderCloudUi();
}
function hasLocalWorkspaceData() {
  return Boolean(
    (errors && errors.length) ||
    Object.keys(notesByType || {}).length ||
    Object.keys(noteImages || {}).length ||
    Object.keys(knowledgeNotes || {}).length ||
    (globalNote || '').trim() ||
    _dirTree ||
    _typeRules
  );
}
function rememberCloudDecision(updatedAt, action) {
  if (!cloudMeta || typeof cloudMeta !== 'object') cloudMeta = getDefaultCloudMeta();
  const originKey = getCloudOriginKey();
  cloudMeta.restoreDecisions = cloudMeta.restoreDecisions || {};
  if (updatedAt) {
    cloudMeta.lastSeenBackupAt = updatedAt;
    cloudMeta.restoreDecisions[originKey] = {
      updatedAt,
      action,
      at: new Date().toISOString()
    };
  }
  if (action === 'loaded') {
    cloudMeta.lastLoadedAt = updatedAt || new Date().toISOString();
    cloudMeta.lastLocalChangeAt = updatedAt || cloudMeta.lastLocalChangeAt || '';
  }
  if (action === 'saved') {
    cloudMeta.lastSavedAt = updatedAt || new Date().toISOString();
    cloudMeta.lastLocalChangeAt = updatedAt || cloudMeta.lastLocalChangeAt || '';
  }
  saveCloudMeta();
}
async function fetchCloudBackupData(opts) {
  opts = opts || {};
  const res = await fetch(opts.metaOnly ? '/api/backup?meta=1' : '/api/backup', { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || 'load failed');
  updateCloudOriginStatuses(data.origins);
  return data;
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
    localChangedAt: updatedAt || data.exportTime || '',
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
  const currentCloudIso = cloudMeta.lastSeenBackupAt || currentOrigin.lastBackupUpdatedAt || '';
  const cloudUpdatedText = formatCloudTime(currentCloudIso);
  const localUpdatedText = formatCloudTime(currentLocalIso);
  const freshnessText = getCloudFreshnessText(currentLocalIso, currentCloudIso);
  const hintLines = [
    localUpdatedText ? `本地最后修改: ${localUpdatedText}` : '本地最后修改: 暂无',
    cloudUpdatedText ? `云端最后备份: ${cloudUpdatedText}` : '云端最后备份: 暂无',
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
  lines.push(`<div>云端最后备份: ${escapeHtml(cloudUpdatedText || '暂无')}</div>`);
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
  setCloudSyncState('idle', '已登录，默认优先显示本地数据', '');
  renderCloudUi();
  scheduleBackgroundCloudBootstrap();
}
async function logoutCloud() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (e) {}
  cloudUser = null;
  renderCloudUi();
  window.location.replace('/login');
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
async function saveCloudBackup(opts) {
  opts = opts || {};
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
  }, 30000);
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
function scheduleCloudSave() {
  if (suppressCloudAutoSave > 0) return;
  markLocalChange();
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
    case 'daily_journal':
      dailyJournalEntries = value && typeof value === 'object' ? value : {};
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
        knowledgeRecordMap.set(nodeId, {
          id: nodeId,
          parentId: String(remote.parentId || ''),
          title: String(remote.title || ''),
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
        queuePersist(KEY_DAILY_JOURNAL, dailyJournalEntries || {});
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
    if (pending.length > 0) {
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
function noteImgId() {
  return 'ni' + Math.random().toString(36).slice(2, 8);
}
function setNoteImageRef(id, value) {
  const key = String(id || '').trim();
  if (!key) return '';
  noteImages[key] = value || '';
  saveNotesByType();
  return noteImages[key];
}
function getNoteImageRef(id) {
  const key = String(id || '').trim();
  return key ? (noteImages[key] || '') : '';
}
// 解析笔记图片引用（noteimg:xxx → base64）
function resolveNoteImgs(text) {
  return text.replace(/noteimg:([a-z0-9]+)/g, (_, id) => noteImages[id] || '');
}
// 笔记目录联动：确保每个题型有笔记条目
function syncNotesWithErrors() {
  const errorEntries = getErrorEntries();
  // 收集所有题型
  const types = [...new Set(errorEntries.map(e => e.type).filter(Boolean))];
  // 新建缺失的题型，并自动生成子类型标题
  types.forEach(t => {
    if (!notesByType[t] || !notesByType[t].content) {
      const subtypes = [...new Set(errorEntries.filter(e => e.type === t).map(e => e.subtype).filter(Boolean))];
      const autoContent = subtypes.length > 0 ? subtypes.map(s => `## ${s}\n\n`).join('') : '';
      notesByType[t] = { content: autoContent, updatedAt: '' };
    }
  });
  saveNotesByType();
  ensureKnowledgeState({ persist: true });
}
// 新增：点击笔记标题筛选功能（同时切换到错题Tab）
function filterByNoteTitle(type, subtype, subSubtype) {
    knowledgeNodeFilter = null;
    if (subSubtype && subSubtype !== '未分类') {
        typeFilter = {level:'sub2', type: type, subtype: subtype, value: subSubtype};
    } else if (subtype && subtype !== '未分类') {
        typeFilter = {level:'subtype', type: type, value: subtype};
    } else {
        typeFilter = {level:'type', value: type};
    }
    switchTab('errors');
    renderSidebar();
    renderAll();
}
// 新增：同步题目类型名称修改
function syncNoteTypeNames() {
    const newNotesByType = {};
    const typeMap = new Map(); // 用于收集当前使用的类型名称
    // 收集所有题目中使用的类型名称
    errors.forEach(err => {
        if (err.type) typeMap.set(err.type, true);
        if (err.subtype) typeMap.set(err.subtype, true);
        if (err.subSubtype) typeMap.set(err.subSubtype, true);
    });
    // 遍历现有笔记结构，只保留题目中存在的类型
    Object.keys(notesByType).forEach(noteType => {
        if (typeMap.has(noteType)) {
            newNotesByType[noteType] = notesByType[noteType];
        }
    });
    notesByType = newNotesByType;
    saveNotesByType();
    renderNotesByType();
}
function saveTodayDone(){
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_TODAY_DATE, todayDate || '');
  queuePersist(KEY_TODAY_DONE, String(todayDone || 0));
  markIncrementalWorkspaceChange();
}
function saveDailyJournalEntries() {
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_DAILY_JOURNAL, dailyJournalEntries || {}, 120);
  markIncrementalWorkspaceChange();
}
let _history = [];
function loadHistory(){ return _history; }
function pushHistory(rec){ _history.unshift(rec); if(_history.length>30)_history.length=30; syncWorkspaceOpsFromSnapshot(); queuePersist(KEY_HISTORY, _history, 220); markIncrementalWorkspaceChange(); }
let aiChatHistory = [];
let codexThreads = [];
let codexMessages = [];
let codexActiveThreadId = null;
let codexInboxBusy = false;
let codexMessageBusy = false;

async function fetchJsonWithAuth(url, options){
  const res = await fetch(url, { credentials:'include', ...(options||{}) });
  let data = null;
  try { data = await res.json(); } catch(e) {}
  if(!res.ok){
    throw new Error((data && (data.detail || data.error)) || `Request failed: ${res.status}`);
  }
  return data;
}

let localBackupState = { loading:false, items:[], loaded:false };
let localBackupBusy = false;

function formatLocalBackupTime(raw){
  if(!raw) return '';
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(String(raw)) ? raw : `${raw}Z`;
  const d = new Date(normalized);
  if(Number.isNaN(d.getTime())) return raw;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatBytesSimple(bytes){
  const value = Number(bytes || 0);
  if(value <= 0) return '0 B';
  if(value < 1024) return `${value} B`;
  if(value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if(value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function renderLocalBackupList(items){
  const summary = document.getElementById('localBackupSummary');
  const list = document.getElementById('localBackupList');
  if(!summary || !list) return;
  const arr = Array.isArray(items) ? items : [];
  summary.textContent = arr.length
    ? `共 ${arr.length} 份快照，自动备份默认一天一次。恢复前会再自动补一份安全备份。`
    : '当前还没有本地快照，建议先点一次“立即备份”。';
  if(!arr.length){
    list.innerHTML = '<div style="padding:18px;border:1px dashed #d0d5dd;border-radius:12px;color:#667085">暂无备份快照</div>';
    return;
  }
  list.innerHTML = arr.map(item => {
    const summaryObj = item.summary || {};
    const badgeMap = {
      manual:'手动',
      auto:'自动',
      before_restore:'恢复前',
      before_import:'导入前'
    };
    const kindLabel = badgeMap[item.kind] || item.kind || '快照';
    return `
      <div style="padding:14px 16px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;margin-bottom:10px;box-shadow:0 6px 18px rgba(15,23,42,.05)">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div style="flex:1;min-width:240px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
              <strong style="font-size:14px;color:#111827">${escapeHtml(formatLocalBackupTime(item.createdAt) || item.id || '未命名快照')}</strong>
              <span style="display:inline-flex;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px">${escapeHtml(kindLabel)}</span>
            </div>
            <div style="font-size:12px;color:#667085;line-height:1.8">
              ${item.label ? `<div>备注：${escapeHtml(item.label)}</div>` : ''}
              <div>错题 ${Number(summaryObj.errors || item.errorCount || 0)} 条 · 知识点 ${Number(summaryObj.knowledgeNodes || item.knowledgeNodeCount || 0)} 个 · 知识笔记 ${Number(summaryObj.knowledgeNotes || item.knowledgeNoteCount || 0)} 条</div>
              <div>旧笔记模块 ${Number(summaryObj.notesByType || item.noteModuleCount || 0)} 个 · 图片引用 ${Number(summaryObj.noteImages || item.noteImageRefCount || 0)} 个 · 文件大小 ${escapeHtml(formatBytesSimple(item.sizeBytes || 0))}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" data-onclick="restoreLocalBackup('${String(item.id || '')}')">恢复</button>
            <button class="btn btn-secondary btn-sm" data-onclick="deleteLocalBackup('${String(item.id || '')}')">删除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function ensureLocalBackupMenuButton(){
  const panel = document.getElementById('moreMenuPanel');
  if(!panel || panel.querySelector('[data-role="local-backup-entry"]')) return;
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.setAttribute('data-role', 'local-backup-entry');
  btn.setAttribute('data-onclick', "closeMoreMenu();openLocalBackupModal()");
  btn.textContent = '数据备份';
  const exportBtn = panel.querySelector('[data-onclick="closeMoreMenu();openExportModal()"]');
  if(exportBtn && exportBtn.nextSibling){
    panel.insertBefore(btn, exportBtn.nextSibling);
  }else if(exportBtn){
    exportBtn.insertAdjacentElement('afterend', btn);
  }else{
    panel.appendChild(btn);
  }
}

async function refreshLocalBackups(opts){
  opts = opts || {};
  if(localBackupState.loading && !opts.force) return localBackupState.items;
  localBackupState.loading = true;
  try{
    const data = await fetchJsonWithAuth('/api/local-backups');
    localBackupState.items = Array.isArray(data.items) ? data.items : [];
    localBackupState.loaded = true;
    renderLocalBackupList(localBackupState.items);
    return localBackupState.items;
  }catch(e){
    const summary = document.getElementById('localBackupSummary');
    const list = document.getElementById('localBackupList');
    if(summary) summary.textContent = e.message || '备份列表加载失败';
    if(list) list.innerHTML = `<div style="padding:18px;border:1px dashed #fecaca;border-radius:12px;color:#b91c1c">${escapeHtml(String(e.message || e))}</div>`;
    if(!opts.silent) showToast(e.message || '备份列表加载失败', 'error');
    throw e;
  }finally{
    localBackupState.loading = false;
  }
}

async function openLocalBackupModal(){
  ensureLocalBackupMenuButton();
  openModal('localBackupModal');
  await refreshLocalBackups({ force:true, silent:true });
}

async function createLocalBackup(kind, label, opts){
  opts = opts || {};
  if(localBackupBusy) return;
  localBackupBusy = true;
  try{
    const data = await fetchJsonWithAuth('/api/local-backups/create', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        kind: kind || 'manual',
        label: label || '',
        skipRecentHours: Number(opts.skipRecentHours || 0)
      })
    });
    localBackupState.items = Array.isArray(data.items) ? data.items : localBackupState.items;
    renderLocalBackupList(localBackupState.items);
    if(!opts.silent){
      showToast(data.created === false ? '已存在最近自动备份，本次跳过' : '本地快照已创建', 'success');
    }
    return data;
  }catch(e){
    if(!opts.silent) showToast(e.message || '创建备份失败', 'error');
    throw e;
  }finally{
    localBackupBusy = false;
  }
}

async function createManualLocalBackup(){
  await createLocalBackup('manual', '手动备份', {});
}

async function restoreLocalBackup(backupId){
  if(!backupId) return;
  const ok = confirm('恢复这份备份后，当前账号的数据会回到该时间点。\n\n恢复前会自动再做一份安全备份，确认继续吗？');
  if(!ok) return;
  try{
    const data = await fetchJsonWithAuth('/api/local-backups/restore', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ backupId, createSafetyBackup:true })
    });
    localBackupState.items = Array.isArray(data.items) ? data.items : localBackupState.items;
    renderLocalBackupList(localBackupState.items);
    if(typeof loadCloudBackup === 'function'){
      await loadCloudBackup({ silent:true });
    } else {
      window.location.reload();
      return;
    }
    showToast('数据已恢复到所选快照', 'success');
  }catch(e){
    showToast(e.message || '恢复失败', 'error');
  }
}

async function deleteLocalBackup(backupId){
  if(!backupId) return;
  if(!confirm('确认删除这份备份快照？此操作无法撤销。')) return;
  try{
    const data = await fetchJsonWithAuth(`/api/local-backups/${encodeURIComponent(backupId)}`, {
      method:'DELETE'
    });
    localBackupState.items = Array.isArray(data.items) ? data.items : [];
    renderLocalBackupList(localBackupState.items);
    showToast('备份快照已删除', 'success');
  }catch(e){
    showToast(e.message || '删除备份失败', 'error');
  }
}

async function ensureDailyLocalBackup(){
  if(!cloudUser) return;
  try{
    await createLocalBackup('auto', '每日自动备份', { silent:true, skipRecentHours:20 });
  }catch(e){
    console.warn('daily local backup skipped:', e);
  }
}

window.openLocalBackupModal = openLocalBackupModal;
window.refreshLocalBackups = refreshLocalBackups;
window.createManualLocalBackup = createManualLocalBackup;
window.restoreLocalBackup = restoreLocalBackup;
window.deleteLocalBackup = deleteLocalBackup;
window.ensureDailyLocalBackup = ensureDailyLocalBackup;
window.ensureLocalBackupMenuButton = ensureLocalBackupMenuButton;
window.saveNoteReviewTracking = saveNoteReviewTracking;

function formatCodexTime(raw){
  if(!raw) return '';
  const d = new Date(raw);
  if(Number.isNaN(d.getTime())) return raw;
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function getCurrentAppTab(){
  return document.body.classList.contains('tab-notes-active') ? 'notes' : 'errors';
}

function summarizeCodexContext(context){
  if(!context || typeof context !== 'object') return '未附带上下文';
  const parts = [];
  if(context.currentTab) parts.push(`当前页：${context.currentTab === 'notes' ? '知识工作区' : '错题列表'}`);
  if(context.selectedKnowledgeNode && context.selectedKnowledgeNode.path){
    parts.push(`知识点：${context.selectedKnowledgeNode.path}`);
  }
  if(context.filteredCount !== undefined) parts.push(`当前筛选题数：${context.filteredCount}`);
  if(context.focusCount !== undefined) parts.push(`重点复习：${context.focusCount}`);
  return parts.length ? parts.join(' | ') : '未附带上下文';
}

function buildCodexContextSnapshot(){
  const filtered = getFiltered();
  const currentNode = getCurrentKnowledgeNodeSummary();
  return {
    generatedAt: new Date().toISOString(),
    currentTab: getCurrentAppTab(),
    selectedKnowledgeNode: currentNode ? {
      id: currentNode.id,
      title: currentNode.title,
      path: currentNode.path
    } : null,
    filters: {
      status: statusFilter || 'all',
      reason: reasonFilter || '',
      typeFilter: typeFilter || null,
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
      search: searchKw || ''
    },
    totalErrors: errors.length,
    filteredCount: filtered.length,
    focusCount: filtered.filter(item=>item.status==='focus').length,
    sampleErrors: filtered.slice(0, 8).map(item=>({
      id: item.id,
      type: item.type || '',
      subtype: item.subtype || '',
      subSubtype: item.subSubtype || '',
      question: (item.question || '').slice(0, 120),
      status: item.status || '',
      noteNodeId: item.noteNodeId || ''
    }))
  };
}

function renderCodexThreads(){
  const list = document.getElementById('codexThreadList');
  if(!list) return;
  if(!codexThreads.length){
    list.innerHTML = '<div class="codex-empty">还没有会话。点右上角“新建”，或者直接发送第一条留言。</div>';
    return;
  }
  list.innerHTML = codexThreads.map(thread => `
    <button class="codex-thread-item ${thread.id===codexActiveThreadId?'active':''}" onclick="selectCodexThread('${thread.id}')">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="codex-thread-title">${escapeHtml(thread.title || 'Codex 收件箱')}</div>
        ${thread.pendingCount ? `<span class="codex-pending-badge">${thread.pendingCount}</span>` : ''}
      </div>
      <div class="codex-thread-meta">
        <div>${escapeHtml(thread.lastMessagePreview || '暂无留言')}</div>
        <div style="margin-top:4px">更新于 ${escapeHtml(formatCodexTime(thread.updatedAt) || '—')} · 共 ${thread.messageCount || 0} 条</div>
      </div>
    </button>
  `).join('');
}

function renderCodexMessages(){
  const titleEl = document.getElementById('codexThreadTitle');
  const hintEl = document.getElementById('codexThreadHint');
  const list = document.getElementById('codexMessageList');
  if(!titleEl || !hintEl || !list) return;
  const thread = codexThreads.find(item=>item.id===codexActiveThreadId);
  titleEl.textContent = thread ? (thread.title || 'Codex 收件箱') : 'Codex 收件箱';
  hintEl.textContent = thread
    ? `最近更新 ${formatCodexTime(thread.updatedAt) || '—'} · 待处理 ${thread.pendingCount || 0} 条`
    : '还没有会话';
  if(!codexMessages.length){
    list.innerHTML = '<div class="codex-empty">这条会话里还没有消息。可以直接给 Codex 留言，比如“根据当前筛选题帮我出 3 天复习方案”。</div>';
    return;
  }
  list.innerHTML = codexMessages.map(message => {
    const statusLabel = {
      pending:'待扫描',
      processing:'处理中',
      done:'已回写',
      failed:'失败'
    }[message.status] || message.status || '';
    const contextLine = message.role === 'user' && message.context && Object.keys(message.context).length
      ? `<div class="codex-message-context">${escapeHtml(summarizeCodexContext(message.context))}</div>`
      : (message.errorText ? `<div class="codex-message-context" style="color:#cf1322">失败原因：${escapeHtml(message.errorText)}</div>` : '');
    return `
      <div class="codex-message ${message.role === 'assistant' ? 'assistant' : 'user'}">
        <div class="codex-message-meta">
          <span class="codex-message-role">${message.role === 'assistant' ? 'Codex' : '我'}</span>
          <span>${escapeHtml(formatCodexTime(message.createdAt) || '—')}</span>
          ${message.role === 'user' ? `<span class="codex-message-status ${escapeHtml(message.status || 'done')}">${escapeHtml(statusLabel || '已发送')}</span>` : ''}
        </div>
        <div class="codex-message-body">${escapeHtml(message.content || '')}</div>
        ${contextLine}
      </div>
    `;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

function renderCodexContextLine(){
  const line = document.getElementById('codexContextLine');
  if(!line) return;
  const snapshot = buildCodexContextSnapshot();
  line.textContent = '默认附带上下文：' + summarizeCodexContext(snapshot);
}

async function loadCodexThreads(opts){
  if(codexInboxBusy) return;
  codexInboxBusy = true;
  try{
    const data = await fetchJsonWithAuth('/api/codex/threads');
    codexThreads = Array.isArray(data.threads) ? data.threads : [];
    if(!codexThreads.length && (!opts || opts.createDefault !== false)){
      const created = await fetchJsonWithAuth('/api/codex/threads', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title:'Codex 收件箱' })
      });
      codexThreads = created.thread ? [created.thread] : [];
    }
    if(codexThreads.length){
      if(!codexActiveThreadId || !codexThreads.some(item=>item.id===codexActiveThreadId)){
        codexActiveThreadId = codexThreads[0].id;
      }
      renderCodexThreads();
      await loadCodexThread(codexActiveThreadId);
    }else{
      codexActiveThreadId = null;
      codexMessages = [];
      renderCodexThreads();
      renderCodexMessages();
    }
  }catch(e){
    showToast(e.message || 'Codex 留言加载失败', 'error');
  }finally{
    codexInboxBusy = false;
  }
}

async function loadCodexThread(threadId){
  if(!threadId) return;
  const data = await fetchJsonWithAuth(`/api/codex/threads/${encodeURIComponent(threadId)}`);
  codexActiveThreadId = threadId;
  codexMessages = Array.isArray(data.messages) ? data.messages : [];
  if(data.thread){
    codexThreads = codexThreads.map(item=>item.id===data.thread.id ? data.thread : item);
  }
  renderCodexThreads();
  renderCodexMessages();
}

async function refreshCodexInbox(){
  await loadCodexThreads({ createDefault:false });
  renderCodexContextLine();
}

async function openCodexInboxModal(){
  openModal('codexInboxModal');
  renderCodexContextLine();
  await loadCodexThreads();
}

async function createCodexThread(){
  const raw = prompt('给这次会话起个标题（可留空）', '');
  if(raw === null) return;
  try{
    const created = await fetchJsonWithAuth('/api/codex/threads', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title: raw || 'Codex 收件箱' })
    });
    if(created.thread){
      codexActiveThreadId = created.thread.id;
      await refreshCodexInbox();
    }
  }catch(e){
    showToast(e.message || '创建 Codex 会话失败', 'error');
  }
}

async function selectCodexThread(threadId){
  try{
    await loadCodexThread(threadId);
  }catch(e){
    showToast(e.message || '加载会话失败', 'error');
  }
}

async function submitCodexMessage(){
  if(codexMessageBusy) return;
  const input = document.getElementById('codexMessageInput');
  const includeContext = document.getElementById('codexIncludeContext');
  const sendBtn = document.getElementById('codexSendBtn');
  const content = (input && input.value || '').trim();
  if(!content){
    showToast('请先输入留言内容', 'warning');
    return;
  }
  codexMessageBusy = true;
  if(sendBtn) sendBtn.disabled = true;
  try{
    if(!codexActiveThreadId){
      const created = await fetchJsonWithAuth('/api/codex/threads', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title:'Codex 收件箱' })
      });
      codexActiveThreadId = created.thread && created.thread.id;
    }
    const payload = {
      content,
      context: includeContext && includeContext.checked ? buildCodexContextSnapshot() : {}
    };
    await fetchJsonWithAuth(`/api/codex/threads/${encodeURIComponent(codexActiveThreadId)}/messages`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(input) input.value = '';
    await refreshCodexInbox();
    showToast('留言已进入待处理队列', 'success');
  }catch(e){
    showToast(e.message || '留言发送失败', 'error');
  }finally{
    codexMessageBusy = false;
    if(sendBtn) sendBtn.disabled = false;
  }
}

function getCurrentKnowledgeNodeSummary(){
  const node = selectedKnowledgeNodeId ? getKnowledgeNodeById(selectedKnowledgeNodeId) : null;
  if(!node) return null;
  const path = (getKnowledgePathTitles(node.id) || []).join(' > ');
  return {
    id: node.id,
    title: node.title || '',
    path,
    contentMd: node.contentMd || '',
    linkedErrors: getErrorEntries().filter(e => e.noteNodeId === node.id).slice(0, 20)
  };
}
