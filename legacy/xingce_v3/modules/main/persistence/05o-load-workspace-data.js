// ============================================================
// Load and hydrate workspace data
// ============================================================
async function loadFullErrorsFromDb() {
  if (typeof cancelPendingPersist === 'function') cancelPendingPersist(KEY_ERRORS);
  try {
    const raw = await DB.get(KEY_ERRORS);
    errors = raw
      ? (JSON.parse(raw) || []).map(item => normalizeEntryRecord(item, 'error'))
      : [];
  } catch (e) {
    errors = [];
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
  try { _typeRules = JSON.parse(await DB.get(KEY_TYPE_RULES)) || null; } catch(e) { _typeRules = null; }
  try { _dirTree   = JSON.parse(await DB.get(KEY_DIR_TREE))   || null; } catch(e) { _dirTree   = null; }
  try { _history = JSON.parse(await DB.get(KEY_HISTORY)||'[]'); } catch(e) { _history = []; }
  try { cloudMeta = { ...getDefaultCloudMeta(), ...(JSON.parse(await DB.get(KEY_CLOUD_META)||'{}') || {}) }; }
  catch(e) { cloudMeta = getDefaultCloudMeta(); }
  await loadNotesByType();
  await loadKnowledgeState();
  restoreSelectedKnowledgeNodeId();
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
    try {
      await loadFullErrorsFromDb();
      await migrateIntegerIds();
      setErrorSyncSnapshot();
      if (typeof ensureKnowledgeState === 'function') {
        ensureKnowledgeState({ persist: true, syncErrors: true, repair: false, preserveTreeShape: true });
      }
      if (typeof syncNotesWithErrors === 'function') syncNotesWithErrors();
      refreshSidebarErrorsAndNotesPanels();
      return true;
    } catch (err) {
      fullDataLoading = false;
      console.error('[ensureFullWorkspaceDataLoaded] failed', err);
      throw err;
    }
  })().finally(() => {
    fullWorkspaceDataPromise = null;
  });
  return fullWorkspaceDataPromise;
}

function scheduleDeferredFullWorkspaceLoad() {
  if (fullDataLoaded || fullDataLoading) return;
  const run = () => {
    if (typeof appView !== 'undefined' && appView !== 'workspace') return;
    ensureFullWorkspaceDataLoaded();
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 5000 });
  } else {
    setTimeout(run, 3000);
  }
}

window.shouldDeferFullDataLoadOnStartup = shouldDeferFullDataLoadOnStartup;
window.ensureFullWorkspaceDataLoaded = ensureFullWorkspaceDataLoaded;
window.scheduleDeferredFullWorkspaceLoad = scheduleDeferredFullWorkspaceLoad;
