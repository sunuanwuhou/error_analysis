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
