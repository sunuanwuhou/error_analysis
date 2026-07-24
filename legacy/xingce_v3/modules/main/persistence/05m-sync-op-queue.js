// ============================================================
// Sync op queue and id migration helpers
// ============================================================
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
    if (isManualCloudSyncOnly()) {
      pendingCloudSave = true;
      if (cloudUser) {
        setCloudSyncState('dirty', '本地改动已记录；点击 Cloud Save 上传到云端', op.created_at);
      } else {
        setCloudSyncState('dirty', '本地改动已记录，登录后点击 Cloud Save 上传', op.created_at);
      }
    } else if (cloudUser) {
      setCloudSyncState('dirty', '错题改动已记录，稍后会在后台处理', op.created_at);
    } else {
      setCloudSyncState('dirty', '本地错题改动已记录，登录后可继续处理', op.created_at);
    }
  }
  if (isManualCloudSyncOnly()) {
    pendingCloudSave = true;
    return;
  }
  scheduleIncrementalSync();
}

let incrementalSyncTimer = null;

function scheduleIncrementalSync() {
  if (isManualCloudSyncOnly()) return;
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
