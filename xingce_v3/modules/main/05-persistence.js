// ============================================================
// 持久化（IndexedDB）
// ============================================================
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
    refreshSidebarErrorsAndNotesPanels();
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
window.shouldDeferFullDataLoadOnStartup = shouldDeferFullDataLoadOnStartup;
window.ensureFullWorkspaceDataLoaded = ensureFullWorkspaceDataLoaded;
window.scheduleDeferredFullWorkspaceLoad = scheduleDeferredFullWorkspaceLoad;
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
  const normalizeRootTitle = value => String(value || '')
    .replace(/\uFEFF/g, '')
    .replace(/\u200B/g, '')
    .replace(/\u00A0/g, '')
    .replace(/[()（）【】\[\]·•,，.:：;；!?！？]/g, '')
    .replace(/\s+/g, '')
    .trim();
  const noisyRootAlias = new Map([
    ['片段阅读', '言语理解与表达'],
    ['数字推理', '数量关系'],
    ['数学运算', '数量关系'],
    ['和差倍比', '数量关系'],
    ['核心思维-纯笔记', '数量关系'],
    ['比例法', '数量关系'],
    ['混合', '数量关系'],
    ['鸡兔', '数量关系'],
    ['年龄问题', '数量关系'],
    ['容斥', '数量关系'],
    ['数列', '数量关系'],
    ['数推', '数量关系'],
    ['植树问题', '数量关系'],
    ['最不利', '数量关系'],
    ['逻辑判断', '判断推理'],
    ['物理', '常识判断']
  ]);
  const resolveNoisyRootAlias = title => noisyRootAlias.get(normalizeRootTitle(title)) || '';
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
  const detachedRoots = [];
  map.forEach(node => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId).children.push(node);
      return;
    }
    roots.push(node);
    detachedRoots.push(node);
  });
  const rootByNormalizedTitle = new Map();
  roots.forEach(node => {
    const key = normalizeRootTitle(node && node.title);
    if (!key || rootByNormalizedTitle.has(key)) return;
    rootByNormalizedTitle.set(key, node);
  });
  detachedRoots.forEach(node => {
    if (!node || !node.title) return;
    const targetRootTitle = resolveNoisyRootAlias(node.title);
    if (!targetRootTitle) return;
    const targetRoot = rootByNormalizedTitle.get(normalizeRootTitle(targetRootTitle));
    if (!targetRoot || targetRoot.id === node.id) return;
    const rootIdx = roots.findIndex(item => item && item.id === node.id);
    if (rootIdx < 0) return;
    roots.splice(rootIdx, 1);
    targetRoot.children = targetRoot.children || [];
    const sameTitleNode = targetRoot.children.find(item => item && item.title === node.title);
    if (sameTitleNode) {
      sameTitleNode.children = (sameTitleNode.children || []).concat(node.children || []);
      if (!String(sameTitleNode.contentMd || '').trim() && String(node.contentMd || '').trim()) {
        sameTitleNode.contentMd = node.contentMd || '';
        sameTitleNode.updatedAt = node.updatedAt || sameTitleNode.updatedAt || '';
      }
      return;
    }
    targetRoot.children.push(node);
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
    if (typeof knowledgeNoteRenderCache !== 'undefined' && knowledgeNoteRenderCache && typeof knowledgeNoteRenderCache.clear === 'function') {
      knowledgeNoteRenderCache.clear();
    }
    if (typeof resetKnowledgeTreeRenderWindow === 'function') {
      resetKnowledgeTreeRenderWindow();
    }
    const allNodes = collectKnowledgeNodes();
    if ((!selectedKnowledgeNodeId || !getKnowledgeNodeById(selectedKnowledgeNodeId)) && allNodes.length > 0) {
      selectedKnowledgeNodeId = allNodes[0].id;
    }
    if (knowledgeNodeFilter && !getKnowledgeNodeById(knowledgeNodeFilter)) {
      knowledgeNodeFilter = '';
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
      if (typeof requestWorkspaceRender === 'function') {
        requestWorkspaceRender({ sidebar: true, notes: true, immediate: true });
      } else {
        refreshSidebarErrorsAndNotesPanels();
      }
      if (knowledgeChanged && typeof renderNotesPanelRight === 'function') {
        renderNotesPanelRight();
      }
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
