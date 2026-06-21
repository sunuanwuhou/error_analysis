// ============================================================
// Apply remote sync ops
// ============================================================
function buildKnowledgeTreeFromSyncRecords(records) {
  const rows = Array.isArray(records) ? records : [];
  const map = new Map();
  const normalizeRootTitle = value => typeof normalizeKnowledgeRootTitleForCleanup === 'function'
    ? normalizeKnowledgeRootTitleForCleanup(value)
    : String(value || '').trim();
  const noisyRootAlias = typeof getLegacyKnowledgeRootAliasMap === 'function'
    ? getLegacyKnowledgeRootAliasMap(false)
    : new Map();
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

function applyRemoteKnowledgeNodeContent(remote) {
  if (!remote || !remote.id || typeof getKnowledgeNodeById !== 'function') return false;
  const node = getKnowledgeNodeById(String(remote.id));
  if (!node) return false;
  const remoteUpdated = String(remote.updatedAt || '').trim();
  const localUpdated = String(node.updatedAt || '').trim();
  const remoteWins = !localUpdated || (remoteUpdated && remoteUpdated >= localUpdated);
  let changed = false;
  const remoteContent = String(remote.contentMd || '');
  const localContent = String(node.contentMd || '');
  if (remoteContent.trim() && (remoteWins || !localContent.trim()) && localContent !== remoteContent) {
    node.contentMd = remoteContent;
    changed = true;
  }
  const remoteTitle = String(remote.title || '').trim();
  const localTitle = String(node.title || '').trim();
  const titleCorrupted = /^\?+$/.test(localTitle);
  if (remoteTitle && remoteWins && (!localTitle || titleCorrupted) && localTitle !== remoteTitle) {
    node.title = remoteTitle;
    changed = true;
  }
  if (remoteUpdated && remoteUpdated > localUpdated) {
    node.updatedAt = remoteUpdated;
    changed = true;
  }
  return changed;
}

function preserveKnowledgeTreeContentFromLocal(rebuilt) {
  if (!rebuilt || !Array.isArray(rebuilt.roots)) return rebuilt;
  hydrateKnowledgeContentFromStoredNotes();
  const localRecords = typeof flattenKnowledgeNodesForSync === 'function'
    ? flattenKnowledgeNodesForSync(
      typeof getKnowledgeRootNodesForSync === 'function'
        ? getKnowledgeRootNodesForSync()
        : (typeof getKnowledgeRootNodes === 'function' ? getKnowledgeRootNodes() : []),
      '',
      []
    )
    : [];
  const localById = new Map(localRecords.map(record => [String(record.id), record]));
  function walk(nodes) {
    (nodes || []).forEach((node) => {
      if (!node || !node.id) return;
      const local = localById.get(String(node.id));
      const stored = knowledgeNotes && knowledgeNotes[node.id];
      const localContent = String((local && local.contentMd) || (stored && stored.content) || '').trim();
      const nodeContent = String(node.contentMd || '').trim();
      if (localContent && !nodeContent) {
        node.contentMd = (local && local.contentMd) || (stored && stored.content) || '';
        node.updatedAt = String(node.updatedAt || (local && local.updatedAt) || (stored && stored.updatedAt) || '');
      }
      walk(node.children);
    });
  }
  walk(rebuilt.roots);
  return rebuilt;
}

function applyOps(ops) {
  let errorChanged = false;
  let notesChanged = false;
  let noteImagesChanged = false;
  let knowledgeChanged = false;
  let settingsChanged = false;
  const batchKnowledgeRecords = [];
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
        const nextValue = remote.value || {};
        const existing = notesByType[key];
        const remoteUpdated = String(remote.updatedAt || (nextValue && nextValue.updatedAt) || '').trim();
        const localUpdated = String((existing && existing.updatedAt) || '').trim();
        if (!existing || !localUpdated || (remoteUpdated && remoteUpdated >= localUpdated)) {
          const remoteContent = String((nextValue && nextValue.content) || '').trim();
          const localContent = String((existing && existing.content) || '').trim();
          if (!remoteContent && localContent) continue;
          notesByType[key] = nextValue;
          notesChanged = true;
        }
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
      const remote = parseSyncPayload(op.payload);
      if (remote && remote.id) {
        remote.id = String(remote.id);
        batchKnowledgeRecords.push(remote);
        if (applyRemoteKnowledgeNodeContent(remote)) {
          knowledgeChanged = true;
        }
      }
      continue;
    }
    if (op.op_type === 'knowledge_node_delete') {
      // Preserve local tree shape: ignore remote deletes during incremental pull.
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
  if (batchKnowledgeRecords.length) {
    hydrateKnowledgeContentFromStoredNotes();
    const existingRecords = typeof flattenKnowledgeNodesForSync === 'function'
      ? flattenKnowledgeNodesForSync(
        typeof getKnowledgeRootNodesForSync === 'function'
          ? getKnowledgeRootNodesForSync()
          : (typeof getKnowledgeRootNodes === 'function' ? getKnowledgeRootNodes() : []),
        '',
        []
      )
      : [];
    existingRecords.forEach((record) => {
      if (!record || !record.id) return;
      const stored = knowledgeNotes && knowledgeNotes[String(record.id)];
      const storedContent = stored && typeof stored.content === 'string' ? stored.content.trim() : '';
      if (!String(record.contentMd || '').trim() && storedContent) {
        record.contentMd = stored.content;
        if (stored.updatedAt) record.updatedAt = stored.updatedAt;
      }
    });
    const byId = new Map(existingRecords.map(record => [String(record.id), record]));
    batchKnowledgeRecords.forEach(record => {
      if (!record || !record.id) return;
      const id = String(record.id);
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, record);
        return;
      }
      const remoteUpdated = String(record.updatedAt || '').trim();
      const localUpdated = String(existing.updatedAt || '').trim();
      const remoteWins = !localUpdated || (remoteUpdated && remoteUpdated >= localUpdated);
      const remoteContent = String(record.contentMd || '').trim();
      const localContent = String(existing.contentMd || '').trim();
      byId.set(id, {
        ...existing,
        ...record,
        title: remoteWins && String(record.title || '').trim()
          ? String(record.title || '')
          : String(existing.title || record.title || ''),
        contentMd: remoteContent && (remoteWins || !localContent)
          ? String(record.contentMd || '')
          : String(existing.contentMd || record.contentMd || ''),
        updatedAt: remoteUpdated > localUpdated ? remoteUpdated : (localUpdated || remoteUpdated),
        parentId: String(record.parentId !== undefined ? record.parentId : existing.parentId || ''),
        sort: Number(record.sort !== undefined ? record.sort : existing.sort || 0),
      });
    });
    const rebuilt = buildKnowledgeTreeFromSyncRecords(Array.from(byId.values()));
    if (rebuilt && Array.isArray(rebuilt.roots)) {
      knowledgeTree = preserveKnowledgeTreeContentFromLocal(rebuilt);
      knowledgeChanged = true;
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
      if (knowledgeChanged) {
        if (typeof ensureKnowledgeState === 'function') {
          ensureKnowledgeState({ persist: false, preserveTreeShape: true, repair: false });
        }
        saveKnowledgeState({ preserveTreeShape: true });
      }
      if (errorChanged && typeof syncNotesWithErrors === 'function') {
        syncNotesWithErrors();
      }
      if (typeof requestWorkspaceRender === 'function') {
        requestWorkspaceRender({ sidebar: true, notes: true, immediate: true });
      } else {
        refreshSidebarErrorsAndNotesPanels();
      }
      if (knowledgeChanged && typeof renderNotesPanelRight === 'function') {
        renderNotesPanelRight();
      }
    });
    if (knowledgeChanged || notesChanged || noteImagesChanged) {
      persistKnowledgeWorkspaceNow().catch((e) => {
        console.warn('[applyOps] persist knowledge workspace failed', e);
      });
    }
  }
}
