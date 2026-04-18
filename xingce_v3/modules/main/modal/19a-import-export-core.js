// ============================================================
// Import / export core pipeline
// ============================================================

function getKnowledgeContextDepth(context) {
  if (!context) return 0;
  if (context.subSubtype) return 3;
  if (context.subtype) return 2;
  if (context.type) return 1;
  return 0;
}

function extractImportedKnowledgePathTitles(item) {
  const rawPath = item?.knowledgePath || item?.notePath || item?.knowledgeNodePath || item?.knowledgePathTitles || null;
  if (Array.isArray(rawPath)) {
    return rawPath.map(part => String(part || '').trim()).filter(Boolean);
  }
  if (typeof rawPath === 'string') {
    return rawPath.split(/>|\/|→/).map(part => String(part || '').trim()).filter(Boolean);
  }
  return [];
}

function getImportedErrorTargetNodeId(item, context) {
  const importedPathTitles = extractImportedKnowledgePathTitles(item);
  if (importedPathTitles.length >= 3) {
    const importedNode = ensureKnowledgePathByTitles(importedPathTitles);
    if (importedNode) {
      ensureKnowledgeNoteRecord(importedNode);
      return importedNode.id;
    }
  }
  if (item?.noteNodeId && getKnowledgeNodeById(item.noteNodeId)) {
    if (!item?.type && !item?.subtype && !item?.subSubtype) return item.noteNodeId;
    if (doesKnowledgeNodeMatchEntryPath(item.noteNodeId, item.type || '', item.subtype || '', item.subSubtype || '')) {
      return item.noteNodeId;
    }
  }
  const explicitType = String(item?.type || '').trim();
  const explicitSubtype = String(item?.subtype || '').trim();
  const explicitSubSubtype = String(item?.subSubtype || '').trim();
  if (explicitType || explicitSubtype || explicitSubSubtype) {
    const branch = ensureKnowledgeBranchPath(
      explicitType || context?.type || '其他',
      explicitSubtype || context?.subtype || '未分类',
      explicitSubSubtype || context?.subSubtype || ''
    );
    ensureKnowledgeNoteRecord(branch.sub2);
    return branch.sub2.id;
  }
  return '';
}

function getKnowledgeContextForEntry(nodeId) {
  const node = nodeId ? getKnowledgeNodeById(nodeId) : null;
  const titles = node ? collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)) : [];
  return {
    node,
    type: titles[0] || '',
    subtype: titles[1] || '',
    subSubtype: node && node.isLeaf ? (titles[titles.length - 1] || node.title || '') : (titles[titles.length - 1] || '')
  };
}

function updateEntryFlowBanner(context) {
  const banner = document.getElementById('entryFlowBanner');
  if (!banner) return;
  const node = context && context.node ? context.node : null;
  const path = node ? collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' / ') : '';
  const modeLabel = editingId ? '编辑模式' : '新增模式';
  const quickActions = node ? `
    <div class="entry-quick-row">
      <button type="button" class="btn btn-secondary btn-sm" onclick="refreshKnowledgePicker('${node.isLeaf ? node.id : ''}')">使用当前路径</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="createKnowledgeLeafFromModal()">当前路径下新建节点</button>
    </div>
  ` : `
    <div class="entry-inline-tip">当前未锁定知识点，保存时会按题型和当前上下文自动挂载。</div>
  `;
  banner.innerHTML = `
    <div class="entry-flow-title">
      <strong>${modeLabel}：先把题目放进来，再补答案与原因</strong>
      <span class="entry-inline-tip">${path ? `当前路径：${escapeHtml(path)}` : '当前路径：未固定'}</span>
    </div>
    <div class="entry-flow-steps">
      <span class="entry-flow-chip"><strong>1</strong> 贴题目或识别题图</span>
      <span class="entry-flow-chip"><strong>2</strong> 确认选项与答案</span>
      <span class="entry-flow-chip"><strong>3</strong> AI 辅助补错因与分析</span>
      <span class="entry-flow-chip"><strong>4</strong> 保存后继续复盘</span>
    </div>
    <div class="entry-flow-sub">
      录题优先保证题干、选项、答案正确；根因、直接原因和解析可以稍后再补，别在第一步卡太久。
    </div>
    ${quickActions}
  `;
  banner.style.display = '';
}

function focusPrimaryEntryField() {
  setTimeout(() => {
    const target = document.getElementById('editQuestion');
    if (!target) return;
    target.focus();
    const len = target.value.length;
    try { target.setSelectionRange(len, len); } catch (e) {}
  }, 40);
}

function setEntryAdvancedOpen(open) {
  const details = document.getElementById('entryAdvancedDetails');
  if (!details) return;
  details.open = !!open;
}

function openAddModalForCurrentKnowledge() {
  const context = getKnowledgeContextForEntry(selectedKnowledgeNodeId);
  openAddModal();
  modalKnowledgeNodeId = null;
  if (context.type) document.getElementById('editType').value = context.type;
  updateSubtypeOptions();
  if (context.subtype) document.getElementById('editSubtype').value = context.subtype;
  if (context.subSubtype) document.getElementById('editSubSubtype').value = context.subSubtype;
  refreshKnowledgePicker();
  updateEntryFlowBanner(getKnowledgeContextForEntry(null));
}

function openQuickAddModal() {
  const notesTab = document.getElementById('tabContentNotes');
  if (notesTab && notesTab.classList.contains('active') && selectedKnowledgeNodeId) {
    openAddModalForCurrentKnowledge();
    return;
  }
  openAddModal();
}

function openImportModalForCurrentKnowledge() {
  importKnowledgeNodeId = null;
  document.getElementById('importText').value = '';
  selectImportMode('merge');
  openModal('importModal');
}

function openQuickImportModal() {
  const notesTab = document.getElementById('tabContentNotes');
  if (notesTab && notesTab.classList.contains('active') && selectedKnowledgeNodeId) {
    openImportModalForCurrentKnowledge();
    return;
  }
  openImportModal();
}

function normalizeImportedErrorsForCurrentKnowledge(list, defaultKind) {
  const context = importKnowledgeNodeId ? getKnowledgeContextForEntry(importKnowledgeNodeId) : null;
  return (list || []).map(item => {
    const normalizedType = item.type || context?.type || '其他';
    const normalizedSubtype = item.subtype || context?.subtype || '未分类';
    const normalizedSubSubtype = item.subSubtype || context?.subSubtype || '';
    return {
      ...normalizeEntryRecord(item, defaultKind || 'error'),
      id: item.id ? normalizeErrorId(item.id) : newId(),
      type: normalizedType,
      subtype: normalizedSubtype,
      subSubtype: normalizedSubSubtype,
      noteNodeId: getImportedErrorTargetNodeId({
        ...item,
        type: normalizedType,
        subtype: normalizedSubtype,
        subSubtype: normalizedSubSubtype
      }, context),
      addDate: item.addDate || today(),
      quiz: item.quiz || null,
      status: item.status || 'focus',
      masteryLevel: item.masteryLevel || 'not_mastered',
      masteryUpdatedAt: item.masteryUpdatedAt || null,
      lastPracticedAt: item.lastPracticedAt || null
    };
  });
}

function tryParseJson(text) {
  try { return JSON.parse(text); } catch (e) {}
  try {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
  } catch (e) {}
  try {
    const fixed = text.replace(/"((?:[^"\\]|\\.)*)"/g, (_, s) => '"' + s.replace(/\r?\n/g, '\\n') + '"');
    const m = fixed.match(/\[[\s\S]*\]/);
    return JSON.parse(m ? m[0] : fixed);
  } catch (e) {}
  return null;
}

function mergeImport(data, defaultKind, opts) {
  opts = opts || {};
  const normalizeKey = (kind, q) => `${kind}::${(q || '').trim().slice(0, 100)}`;
  const questionMap = {};
  const idMap = {};
  errors.forEach((e, i) => {
    const kind = normalizeEntryKind(e.entryKind, 'error');
    questionMap[normalizeKey(kind, e.question)] = i;
    if (e && e.id !== undefined && e.id !== null && e.id !== '') {
      idMap[normalizeErrorId(e.id)] = i;
    }
  });
  let added = 0;
  let updated = 0;
  data.forEach(raw => {
    const imp = {
      ...normalizeEntryRecord(raw, defaultKind || 'error'),
      id: raw.id ? normalizeErrorId(raw.id) : newId(),
      addDate: raw.addDate || today(),
      quiz: raw.quiz || null,
      status: raw.status || 'focus',
      masteryLevel: raw.masteryLevel || 'not_mastered',
      masteryUpdatedAt: raw.masteryUpdatedAt || null,
      lastPracticedAt: raw.lastPracticedAt || null
    };
    const kind = normalizeEntryKind(imp.entryKind, defaultKind || 'error');
    const k = normalizeKey(kind, imp.question);
    const targetIndex = idMap[imp.id] !== undefined ? idMap[imp.id] : questionMap[k];
    if (targetIndex !== undefined) {
      const old = errors[targetIndex];
      const preservedNoteNodeId = opts.preserveExistingNoteNodeId ? String(old.noteNodeId || '').trim() : '';
      errors[targetIndex] = {
        ...old,
        ...imp,
        id: old.id ? normalizeErrorId(old.id) : imp.id,
        entryKind: normalizeEntryKind(old.entryKind, kind),
        quiz: old.quiz || imp.quiz,
        addDate: old.addDate || imp.addDate,
        updatedAt: imp.updatedAt || old.updatedAt || '',
        masteryUpdatedAt: imp.masteryUpdatedAt || old.masteryUpdatedAt || null,
        createdAt: imp.createdAt || old.createdAt || old.sentAt || '',
        sentAt: imp.sentAt || old.sentAt || old.createdAt || '',
        sharedAt: imp.sharedAt || old.sharedAt || old.createdAt || '',
        noteNodeId: preservedNoteNodeId || imp.noteNodeId || old.noteNodeId || ''
      };
      questionMap[k] = targetIndex;
      idMap[errors[targetIndex].id] = targetIndex;
      updated++;
    } else {
      const newIndex = errors.push(imp) - 1;
      questionMap[k] = newIndex;
      idMap[imp.id] = newIndex;
      added++;
    }
  });
  return { added, updated };
}

function doImport() {
  const raw = document.getElementById('importText').value.trim();
  if (!raw) { showToast('请先粘贴 JSON 内容', 'warning'); return; }
  const parsed = tryParseJson(raw);
  if (!parsed) { showToast('JSON 格式错误，请检查内容', 'error'); return; }
  let data;
  if (Array.isArray(parsed)) data = parsed;
  else if (parsed.errors && Array.isArray(parsed.errors)) data = parsed.errors;
  else { showToast('应为数组或含 errors 字段的对象', 'error'); return; }
  data = normalizeImportedErrorsForCurrentKnowledge(data, 'error');
  const unresolvedCount = data.filter(item => !String(item.noteNodeId || '').trim()).length;
  if (unresolvedCount) {
    showToast(`有 ${unresolvedCount} 条导入题目缺少可用挂载路径，请补全 type / subtype / subSubtype 后再导入`, 'warning');
    return;
  }
  if (importMode === 'replace') {
    if (!confirm(`清空现有 ${errors.length} 条，替换为 ${data.length} 条？`)) return;
    errors = data.map(e => ({
      id: e.id ? normalizeErrorId(e.id) : newId(),
      entryKind: normalizeEntryKind(e.entryKind, 'error'),
      addDate: e.addDate || today(),
      quiz: e.quiz || null,
      status: e.status || 'focus',
      masteryLevel: e.masteryLevel || 'not_mastered',
      masteryUpdatedAt: e.masteryUpdatedAt || null,
      lastPracticedAt: e.lastPracticedAt || null,
      ...e
    }));
    saveData();
    closeModal('importModal');
    renderSidebar();
    renderAll();
    showToast(`已替换，共 ${errors.length} 条`, 'success');
  } else {
    const { added, updated } = mergeImport(data, 'error');
    saveData();
    closeModal('importModal');
    renderSidebar();
    renderAll();
    showToast(`导入完成：更新 ${updated} 条，新增 ${added} 条`, 'success');
  }
  importKnowledgeNodeId = null;
  syncNotesWithErrors();
}
