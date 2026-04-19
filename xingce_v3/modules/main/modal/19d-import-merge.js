// ============================================================
// Import merge / apply
// ============================================================

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
    showToast(`有 ${unresolvedCount} 条导入题目暂未挂到知识点，已保留，稍后可批量清理补挂`, 'warning');
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
    ensureKnowledgeState({ persist: false });
    saveData();
    closeModal('importModal');
    renderSidebar();
    renderAll();
    showToast(`已替换，共 ${errors.length} 条`, 'success');
  } else {
    const { added, updated } = mergeImport(data, 'error');
    ensureKnowledgeState({ persist: false });
    saveData();
    closeModal('importModal');
    renderSidebar();
    renderAll();
    showToast(`导入完成：更新 ${updated} 条，新增 ${added} 条`, 'success');
  }
  importKnowledgeNodeId = null;
  syncNotesWithErrors();
}
