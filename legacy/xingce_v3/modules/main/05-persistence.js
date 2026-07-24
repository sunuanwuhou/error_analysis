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
function knowledgeStateHasNoteContent(tree, notes) {
  function treeHasContent(nodes) {
    return (nodes || []).some((node) => {
      if (!node) return false;
      if (String(node.contentMd || '').trim()) return true;
      return treeHasContent(node.children);
    });
  }
  const mapHasContent = Object.values(notes || {}).some(
    (item) => item && String(item.content || '').trim()
  );
  return mapHasContent || treeHasContent(tree && tree.roots);
}

function mergeKnowledgeContentFromSources(sourceTree, sourceNotes) {
  if (!sourceTree || !Array.isArray(sourceTree.roots)) return false;
  if (!knowledgeTree || typeof knowledgeTree !== 'object') knowledgeTree = { version: 1, roots: [] };
  if (!Array.isArray(knowledgeTree.roots)) knowledgeTree.roots = [];
  if (!knowledgeNotes || typeof knowledgeNotes !== 'object') knowledgeNotes = {};
  const sourceNoteMap = sourceNotes && typeof sourceNotes === 'object' ? sourceNotes : {};
  const sourceTreeById = new Map();
  function walkSource(nodes) {
    (nodes || []).forEach((node) => {
      if (!node || !node.id) return;
      sourceTreeById.set(String(node.id), node);
      walkSource(node.children);
    });
  }
  walkSource(sourceTree.roots);
  let changed = false;
  function walkTarget(nodes) {
    (nodes || []).forEach((node) => {
      if (!node || !node.id) return;
      const nodeId = String(node.id);
      const sourceNode = sourceTreeById.get(nodeId);
      const sourceNote = sourceNoteMap[nodeId];
      const sourceContent = String(
        (sourceNode && sourceNode.contentMd)
        || (sourceNote && sourceNote.content)
        || ''
      ).trim();
      const nodeContent = String(node.contentMd || '').trim();
      const stored = knowledgeNotes[nodeId];
      const storedContent = stored && typeof stored.content === 'string' ? stored.content.trim() : '';
      if (sourceContent && !nodeContent) {
        node.contentMd = (sourceNode && sourceNode.contentMd) || (sourceNote && sourceNote.content) || sourceContent;
        node.updatedAt = String(
          node.updatedAt
          || (sourceNode && sourceNode.updatedAt)
          || (sourceNote && sourceNote.updatedAt)
          || ''
        );
        changed = true;
      }
      if (sourceContent && !storedContent) {
        knowledgeNotes[nodeId] = {
          title: String(node.title || (stored && stored.title) || (sourceNote && sourceNote.title) || ''),
          content: (sourceNote && sourceNote.content) || (sourceNode && sourceNode.contentMd) || sourceContent,
          updatedAt: String(
            node.updatedAt
            || (stored && stored.updatedAt)
            || (sourceNote && sourceNote.updatedAt)
            || (sourceNode && sourceNode.updatedAt)
            || ''
          ),
        };
        changed = true;
      }
      walkTarget(node.children);
    });
  }
  walkTarget(knowledgeTree.roots);
  Object.keys(sourceNoteMap).forEach((nodeId) => {
    const sourceNote = sourceNoteMap[nodeId];
    const sourceContent = sourceNote && typeof sourceNote.content === 'string' ? sourceNote.content.trim() : '';
    if (!sourceContent) return;
    const existing = knowledgeNotes[nodeId];
    const existingContent = existing && typeof existing.content === 'string' ? existing.content.trim() : '';
    if (existingContent) return;
    knowledgeNotes[nodeId] = {
      title: String((existing && existing.title) || (sourceNote && sourceNote.title) || ''),
      content: sourceNote.content,
      updatedAt: String((existing && existing.updatedAt) || (sourceNote && sourceNote.updatedAt) || ''),
    };
    changed = true;
  });
  return changed;
}

async function rehydrateKnowledgeContentFromIdb() {
  let storedTree = null;
  let storedNotes = {};
  try { storedTree = JSON.parse(await DB.get(KEY_KNOWLEDGE_TREE) || 'null'); }
  catch (e) { storedTree = null; }
  try { storedNotes = JSON.parse(await DB.get(KEY_KNOWLEDGE_NOTES) || '{}') || {}; }
  catch (e) { storedNotes = {}; }
  if (!knowledgeStateHasNoteContent(storedTree, storedNotes)) return false;
  return mergeKnowledgeContentFromSources(storedTree, storedNotes);
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
  if (!knowledgeTree || typeof knowledgeTree !== 'object') knowledgeTree = { version: 1, roots: [] };
  if (!Array.isArray(knowledgeTree.roots)) knowledgeTree.roots = [];
  knowledgeNotes = knowledgeNotes && typeof knowledgeNotes === 'object' ? knowledgeNotes : {};
  const loadedTreeSnapshot = JSON.parse(JSON.stringify(knowledgeTree || { version: 1, roots: [] }));
  const loadedNotesSnapshot = JSON.parse(JSON.stringify(knowledgeNotes || {}));
  const loadedHasNoteContent = knowledgeStateHasNoteContent(loadedTreeSnapshot, loadedNotesSnapshot);
  ensureKnowledgeNotesHydratedIntoTree();
  syncKnowledgeNotesFromTreeSafe();
  if (loadedHasNoteContent && !knowledgeStateHasNoteContent(knowledgeTree, knowledgeNotes)) {
    mergeKnowledgeContentFromSources(loadedTreeSnapshot, loadedNotesSnapshot);
    ensureKnowledgeNotesHydratedIntoTree();
    syncKnowledgeNotesFromTreeSafe();
  }
  if (knowledgeStateHasNoteContent(knowledgeTree, knowledgeNotes)) {
    await persistKnowledgeNotesOnlyNow();
  }
  restoreSelectedKnowledgeNodeId();
}

function getKnowledgeRootNodesForSync() {
  if (typeof getKnowledgeRootNodes === 'function') {
    return getKnowledgeRootNodes();
  }
  if (knowledgeTree && Array.isArray(knowledgeTree.roots)) {
    return knowledgeTree.roots;
  }
  return [];
}

function syncKnowledgeNotesFromTreeSafe() {
  if (typeof syncKnowledgeNotesFromTree === 'function') {
    syncKnowledgeNotesFromTree();
    return;
  }
  rebuildKnowledgeNotesFromTreeInline();
}

function rebuildKnowledgeNotesFromTreeInline() {
  if (!knowledgeTree || !Array.isArray(knowledgeTree.roots)) return;
  const next = {};
  function walk(nodes) {
    (nodes || []).forEach((node) => {
      if (!node || !node.id) return;
      const stored = knowledgeNotes && knowledgeNotes[node.id];
      const storedContent = stored && typeof stored.content === 'string' ? stored.content.trim() : '';
      const nodeContent = String(node.contentMd || '').trim();
      const content = nodeContent || storedContent || '';
      if (!nodeContent && storedContent) {
        node.contentMd = stored.content;
        if (stored.updatedAt && !node.updatedAt) node.updatedAt = stored.updatedAt;
      }
      next[node.id] = {
        title: String(node.title || (stored && stored.title) || ''),
        content,
        updatedAt: String(node.updatedAt || (stored && stored.updatedAt) || ''),
      };
      walk(node.children);
    });
  }
  walk(knowledgeTree.roots);
  Object.keys(knowledgeNotes || {}).forEach((nodeId) => {
    if (next[nodeId]) return;
    const stored = knowledgeNotes[nodeId];
    const storedContent = stored && typeof stored.content === 'string' ? stored.content.trim() : '';
    if (!storedContent) return;
    next[nodeId] = {
      title: String((stored && stored.title) || ''),
      content: stored.content,
      updatedAt: String((stored && stored.updatedAt) || ''),
    };
  });
  knowledgeNotes = next;
}

function hydrateKnowledgeContentFromStoredNotes() {
  if (!knowledgeTree || !Array.isArray(knowledgeTree.roots)) return false;
  let changed = false;
  function walk(nodes) {
    (nodes || []).forEach((node) => {
      if (!node || !node.id) return;
      const stored = knowledgeNotes && knowledgeNotes[node.id];
      const storedContent = stored && typeof stored.content === 'string' ? stored.content.trim() : '';
      const nodeContent = String(node.contentMd || '').trim();
      if (!nodeContent && storedContent) {
        node.contentMd = stored.content;
        if (stored.updatedAt) node.updatedAt = stored.updatedAt;
        changed = true;
      }
      walk(node.children);
    });
  }
  walk(knowledgeTree.roots);
  if (changed) rebuildKnowledgeNotesFromTreeInline();
  return changed;
}

function ensureKnowledgeNotesHydratedIntoTree() {
  if (!knowledgeTree || !Array.isArray(knowledgeTree.roots)) return false;
  hydrateKnowledgeContentFromStoredNotes();
  let changed = false;
  function walk(nodes) {
    (nodes || []).forEach((node) => {
      if (!node || !node.id) return;
      const nodeContent = String(node.contentMd || '').trim();
      if (!knowledgeNotes || typeof knowledgeNotes !== 'object') knowledgeNotes = {};
      const stored = knowledgeNotes[node.id];
      const storedContent = stored && typeof stored.content === 'string' ? stored.content.trim() : '';
      if (nodeContent && !storedContent) {
        knowledgeNotes[node.id] = {
          title: String(node.title || (stored && stored.title) || ''),
          content: node.contentMd || '',
          updatedAt: String(node.updatedAt || (stored && stored.updatedAt) || ''),
        };
        changed = true;
      }
      walk(node.children);
    });
  }
  walk(knowledgeTree.roots);
  return changed;
}

function rememberSelectedKnowledgeNodeId(nodeId) {
  const id = String(nodeId || '').trim();
  if (!id) return;
  try {
    localStorage.setItem(UI_KEY_LAST_KNOWLEDGE_NODE, id);
  } catch (e) {}
}

function restoreSelectedKnowledgeNodeId() {
  try {
    const stored = String(localStorage.getItem(UI_KEY_LAST_KNOWLEDGE_NODE) || '').trim();
    if (!stored) return false;
    if (typeof getKnowledgeNodeById === 'function') {
      if (!getKnowledgeNodeById(stored)) return false;
      selectedKnowledgeNodeId = stored;
      return true;
    }
    if (knowledgeTree && Array.isArray(knowledgeTree.roots)) {
      let found = false;
      function walk(nodes) {
        (nodes || []).forEach((node) => {
          if (!node || found) return;
          if (String(node.id || '') === stored) found = true;
          walk(node.children);
        });
      }
      walk(knowledgeTree.roots);
      if (found) {
        selectedKnowledgeNodeId = stored;
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function flushKnowledgeNoteDraftFromDom() {
  const ta = document.getElementById('noteTypeTextarea');
  if (!ta || !selectedKnowledgeNodeId) return false;
  const node = typeof getKnowledgeNodeById === 'function'
    ? getKnowledgeNodeById(selectedKnowledgeNodeId)
    : null;
  if (!node) return false;
  const next = String(ta.value || '');
  const prev = String(node.contentMd || '');
  if (next === prev) return false;
  node.contentMd = next;
  node.updatedAt = new Date().toISOString();
  syncKnowledgeNotesFromTreeSafe();
  persistKnowledgeStateNow();
  rememberSelectedKnowledgeNodeId(node.id);
  return true;
}

let knowledgeNoteAutoPersistTimer = null;
function scheduleKnowledgeNoteAutoPersist() {
  if (knowledgeNoteAutoPersistTimer) clearTimeout(knowledgeNoteAutoPersistTimer);
  knowledgeNoteAutoPersistTimer = setTimeout(() => {
    knowledgeNoteAutoPersistTimer = null;
    flushKnowledgeNoteDraftFromDom();
  }, 900);
}

async function persistKnowledgeStateNow() {
  ensureKnowledgeNotesHydratedIntoTree();
  syncKnowledgeNotesFromTreeSafe();
  if (!knowledgeStateHasNoteContent(knowledgeTree, knowledgeNotes)) {
    await rehydrateKnowledgeContentFromIdb();
    ensureKnowledgeNotesHydratedIntoTree();
    syncKnowledgeNotesFromTreeSafe();
  }
  if (!knowledgeStateHasNoteContent(knowledgeTree, knowledgeNotes)) {
    let storedTree = null;
    let storedNotes = {};
    try { storedTree = JSON.parse(await DB.get(KEY_KNOWLEDGE_TREE) || 'null'); }
    catch (e) { storedTree = null; }
    try { storedNotes = JSON.parse(await DB.get(KEY_KNOWLEDGE_NOTES) || '{}') || {}; }
    catch (e) { storedNotes = {}; }
    if (knowledgeStateHasNoteContent(storedTree, storedNotes)) {
      console.warn('[persistKnowledgeStateNow] blocked empty overwrite of stored knowledge notes');
      return;
    }
  }
  if (typeof cancelPendingPersist === 'function') {
    cancelPendingPersist(KEY_KNOWLEDGE_TREE);
    cancelPendingPersist(KEY_KNOWLEDGE_NOTES);
  }
  return Promise.all([
    DB.set(KEY_KNOWLEDGE_TREE, JSON.stringify(knowledgeTree || { version: 1, roots: [] })),
    DB.set(KEY_KNOWLEDGE_NOTES, JSON.stringify(knowledgeNotes || {})),
  ].map((promise) => promise.catch(reportLocalStorageFailure)));
}

async function persistKnowledgeNotesOnlyNow() {
  await persistKnowledgeStateNow();
}

if (typeof window !== 'undefined') {
  window.rememberSelectedKnowledgeNodeId = rememberSelectedKnowledgeNodeId;
  window.restoreSelectedKnowledgeNodeId = restoreSelectedKnowledgeNodeId;
  window.flushKnowledgeNoteDraftFromDom = flushKnowledgeNoteDraftFromDom;
  window.scheduleKnowledgeNoteAutoPersist = scheduleKnowledgeNoteAutoPersist;
  window.persistKnowledgeStateNow = persistKnowledgeStateNow;
}

function ensureKnowledgeStateBootstrap(opts) {
  opts = opts || {};
  ensureKnowledgeNotesHydratedIntoTree();
  if (opts.persist) {
    persistKnowledgeNotesOnlyNow().catch((e) => {
      console.warn('[ensureKnowledgeStateBootstrap] persist failed', e);
    });
  }
}

if (typeof ensureKnowledgeState !== 'function') {
  var ensureKnowledgeState = ensureKnowledgeStateBootstrap;
  if (typeof window !== 'undefined') window.ensureKnowledgeState = ensureKnowledgeStateBootstrap;
}

async function persistKnowledgeWorkspaceNow() {
  ensureKnowledgeNotesHydratedIntoTree();
  syncKnowledgeNotesFromTreeSafe();
  const keys = [KEY_KNOWLEDGE_TREE, KEY_KNOWLEDGE_NOTES, KEY_NOTES_BY_TYPE, KEY_NOTE_IMAGES];
  if (typeof cancelPendingPersist === 'function') {
    keys.forEach((key) => cancelPendingPersist(key));
  }
  await Promise.all([
    DB.set(KEY_KNOWLEDGE_TREE, JSON.stringify(knowledgeTree)),
    DB.set(KEY_KNOWLEDGE_NOTES, JSON.stringify(knowledgeNotes)),
    DB.set(KEY_NOTES_BY_TYPE, JSON.stringify(notesByType || {})),
    DB.set(KEY_NOTE_IMAGES, JSON.stringify(noteImages || {})),
  ].map((promise) => promise.catch(reportLocalStorageFailure)));
}

let knowledgeWorkspacePersistTimer = null;
function cancelWorkspacePendingPersists() {
  if (typeof cancelAllPendingPersists === 'function') {
    cancelAllPendingPersists();
  } else if (typeof cancelPendingPersist === 'function') {
    WORKSPACE_PERSIST_KEYS.forEach((key) => cancelPendingPersist(key));
  }
  if (knowledgeWorkspacePersistTimer) {
    clearTimeout(knowledgeWorkspacePersistTimer);
    knowledgeWorkspacePersistTimer = null;
  }
}
function scheduleKnowledgeWorkspacePersist() {
  if (knowledgeWorkspacePersistTimer) clearTimeout(knowledgeWorkspacePersistTimer);
  knowledgeWorkspacePersistTimer = setTimeout(() => {
    knowledgeWorkspacePersistTimer = null;
    persistKnowledgeWorkspaceNow().catch((e) => {
      console.warn('[scheduleKnowledgeWorkspacePersist] failed', e);
    });
  }, 120);
}
function saveNotesByType() {
  DB.set(KEY_NOTES_BY_TYPE, JSON.stringify(notesByType));
  DB.set(KEY_NOTE_IMAGES, JSON.stringify(noteImages));
  scheduleCloudSave();
}
function saveKnowledgeState() {
  hydrateKnowledgeContentFromStoredNotes();
  syncKnowledgeNotesFromTreeSafe();
  knowledgeErrorCountCacheVersion += 1;
  persistKnowledgeStateNow();
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
  if (!opts.preserveTreeShape && typeof getKnowledgeRootNodes === 'function') {
    mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes());
    collapseDuplicateKnowledgeWrappers(getKnowledgeRootNodes());
  }
  hydrateKnowledgeContentFromStoredNotes();
  syncKnowledgeNotesFromTreeSafe();
  const changed = syncWorkspaceOpsFromSnapshot();
  persistKnowledgeStateNow();
  scheduleKnowledgeWorkspacePersist();
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

async function persistFullWorkspaceNow() {
  if (typeof cancelWorkspacePendingPersists === 'function') {
    cancelWorkspacePendingPersists();
  }
  ensureKnowledgeNotesHydratedIntoTree();
  syncKnowledgeNotesFromTreeSafe();
  const canWriteErrors = typeof hasFullWorkspaceDataLoaded !== 'function' || hasFullWorkspaceDataLoaded();
  const writes = [
    DB.set(KEY_KNOWLEDGE_TREE, JSON.stringify(knowledgeTree)),
    DB.set(KEY_KNOWLEDGE_NOTES, JSON.stringify(knowledgeNotes || {})),
    DB.set(KEY_NOTES_BY_TYPE, JSON.stringify(notesByType || {})),
    DB.set(KEY_NOTE_IMAGES, JSON.stringify(noteImages || {})),
    DB.set(KEY_KNOWLEDGE_EXPANDED, JSON.stringify(Array.from(knowledgeExpanded || []))),
    DB.set(KEY_CLOUD_META, JSON.stringify(cloudMeta || getDefaultCloudMeta())),
  ];
  if (canWriteErrors) {
    writes.unshift(
      DB.set(KEY_ERRORS, JSON.stringify(errors)),
      DB.set(KEY_REVEALED, JSON.stringify([...revealed])),
      DB.set(KEY_EXP_TYPES, JSON.stringify([...expTypes])),
      DB.set(KEY_EXP_MAIN, JSON.stringify([...expMain, ...expMainSub])),
      DB.set(KEY_EXP_SUB2, JSON.stringify([...expMainSub2])),
      DB.set(KEY_GLOBAL_NOTE, globalNote || ''),
      DB.set(KEY_TODAY_DATE, todayDate),
      DB.set(KEY_TODAY_DONE, String(todayDone)),
      DB.set(KEY_HISTORY, JSON.stringify(_history || [])),
      DB.set(KEY_TYPE_RULES, JSON.stringify(_typeRules)),
      DB.set(KEY_DIR_TREE, JSON.stringify(_dirTree)),
    );
  }
  await Promise.all(writes.map((promise) => promise.catch(reportLocalStorageFailure)));
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
  if (isManualCloudSyncOnly()
    && !options.pushOnly
    && !options.pullOnly
    && !options.fromManualAction
    && !options._backupRecovery) {
    return;
  }
  const hadLocalWorkspaceDataAtStart = typeof hasLocalWorkspaceData === 'function'
    ? hasLocalWorkspaceData()
    : false;
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
      await flushWorkspacePersistsNow();
      await persistKnowledgeWorkspaceNow();
      if (pushed) {
        setCloudSyncState('synced', '本地增量已上传到云端（未自动下拉）', latestSnapshotAt || '');
      }
      return;
    }
    if (!options.forcePull
      && typeof shouldBlockSyncPullAfterFullRestore === 'function'
      && shouldBlockSyncPullAfterFullRestore()) {
      await flushWorkspacePersistsNow();
      if (typeof persistFullWorkspaceNow === 'function') {
        await persistFullWorkspaceNow();
      } else {
        await persistKnowledgeWorkspaceNow();
      }
      setCloudSyncState(
        'synced',
        '全量恢复后已保护本地数据，已跳过自动云端下拉',
        getLastFullBackupRestoreAt ? getLastFullBackupRestoreAt() : ''
      );
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
    let maxOpCreatedAt = '';
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
        ops.forEach((op) => {
          const at = String(op.created_at || '').trim();
          if (at && at > maxOpCreatedAt) maxOpCreatedAt = at;
        });
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
    const syncCursorAt = latestSnapshotAt || maxOpCreatedAt || serverTime;
    rememberLastSyncCursor(syncCursorAt);
    markIncrementalSyncChecked(syncCursorAt || new Date().toISOString());
    setNextIncrementalSyncAt('');
    if (latestSnapshotAt) {
      cloudMeta.lastSeenBackupAt = latestSnapshotAt;
      saveCloudMeta();
    }
    if (pushed || pulled > 0) {
      await flushWorkspacePersistsNow();
      await persistKnowledgeWorkspaceNow();
      let syncMessage = '';
      if (pushed && pulled > 0) {
        syncMessage = isSnapshotPull
          ? `已与云端同步（已上传本地改动，对齐 ${pulled} 条云端实体）`
          : `已与云端同步（已上传本地改动，合并 ${pulled} 条云端增量）`;
      } else if (pushed) {
        syncMessage = '本地改动已上传到云端';
      } else {
        syncMessage = isSnapshotPull
          ? `已与云端全量对齐（${pulled} 条实体记录，非本地改动）`
          : `已合并 ${pulled} 条云端增量改动`;
      }
      setCloudSyncState('synced', syncMessage, latestSnapshotAt || syncCursorAt || '');
    } else if (options.pullOnly) {
      setCloudSyncState('synced', '云端无新增改动', latestSnapshotAt || serverTime || new Date().toISOString());
    }
    if (!options._backupRecovery
      && !hadLocalWorkspaceDataAtStart
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
