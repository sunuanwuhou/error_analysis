// ============================================================
// Persistence primitives and cloud save guards
// ============================================================
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

const persistTimers = new Map();
const persistPendingValues = new Map();
let suppressCloudAutoSave = 0;
let suppressIncrementalSync = 0;
let errorSyncSnapshot = new Map();
let workspaceSyncSnapshot = new Map();

function cancelPendingPersist(key) {
  const timer = persistTimers.get(key);
  if (timer) clearTimeout(timer);
  persistTimers.delete(key);
  persistPendingValues.delete(key);
}

function cancelAllPendingPersists() {
  Array.from(persistTimers.keys()).forEach(cancelPendingPersist);
}

function queuePersist(key, value, delay) {
  const wait = typeof delay === 'number' ? delay : 160;
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  const timer = persistTimers.get(key);
  if (timer) clearTimeout(timer);
  persistTimers.delete(key);
  persistPendingValues.set(key, encoded);
  const nextTimer = setTimeout(() => {
    const payload = persistPendingValues.get(key);
    if (payload !== undefined) {
      DB.set(key, payload).catch(reportLocalStorageFailure);
      persistPendingValues.delete(key);
    }
    persistTimers.delete(key);
  }, wait);
  persistTimers.set(key, nextTimer);
}

async function flushPendingPersists(keys) {
  const pendingKeys = keys
    ? (Array.isArray(keys) ? keys : [keys])
    : Array.from(persistTimers.keys());
  const writes = [];
  for (const key of pendingKeys) {
    const timer = persistTimers.get(key);
    if (timer) clearTimeout(timer);
    persistTimers.delete(key);
    const payload = persistPendingValues.get(key);
    if (payload === undefined) continue;
    persistPendingValues.delete(key);
    writes.push(DB.set(key, payload).catch(reportLocalStorageFailure));
  }
  if (writes.length) await Promise.all(writes);
}

function withCloudAutoSaveSuppressed(fn) {
  suppressCloudAutoSave += 1;
  try {
    return fn();
  } finally {
    suppressCloudAutoSave = Math.max(0, suppressCloudAutoSave - 1);
  }
}
