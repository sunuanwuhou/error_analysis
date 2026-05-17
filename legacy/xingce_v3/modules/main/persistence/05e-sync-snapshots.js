// ============================================================
// Incremental sync snapshots
// ============================================================
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
