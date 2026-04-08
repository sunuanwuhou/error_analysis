// ============================================================
// 完整备份 / 恢复
// ============================================================
async function exportFullBackup() {
  const backup = await buildPortableBackupPayload(getFullBackupPayload());
  download('xingce_backup_' + today() + '.json', JSON.stringify(backup));
}

// 选文件后自动识别格式：完整备份 or 旧版错题数组
function doFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    let data;
    try { data = JSON.parse(e.target.result); }
    catch(err) { alert('文件解析失败，请确认是有效的 JSON 文件'); return; }

    if (data && data.xc_version === 2 && Array.isArray(data.errors)) {
      // 完整备份格式 → 弹选择
      openFullRestoreDialog(data);
    } else if (Array.isArray(data)) {
      // 旧版错题数组 → 填入文本框走原有流程
      document.getElementById('importText').value = JSON.stringify(data, null, 2);
      alert('已识别为错题 JSON，请选择导入模式后点击「开始导入」');
    } else if (data && Array.isArray(data.errors)) {
      document.getElementById('importText').value = JSON.stringify(data.errors, null, 2);
      alert('已识别为错题 JSON，请选择导入模式后点击「开始导入」');
    } else {
      alert('无法识别文件格式，请确认是由本工具导出的备份文件');
    }
  };
  reader.readAsText(file);
  // 重置 input，允许重复选同一文件
  event.target.value = '';
}

// 完整备份识别后，让用户选择「完整恢复」还是「合并」
function openFullRestoreDialog(data) {
  const errCount = data.errors.length;
  const noteCount = Object.keys(data.notesByType || {}).length;
  const info = `备份时间：${data.exportTime ? data.exportTime.slice(0,10) : '未知'}\n错题：${errCount} 条　笔记模块：${noteCount} 个`;
  const choice = confirm(
    `检测到完整备份文件\n${info}\n\n` +
    `点击「确定」→ 完整恢复（全部覆盖当前数据）\n` +
    `点击「取消」→ 合并导入（错题去重合并，笔记覆盖）`
  );
  if (choice) {
    importFullRestore(data);
  } else {
    importFullMerge(data);
  }
}

// 完整恢复：全覆盖
function importFullRestore(data) {
  if (!confirm(`⚠ 当前全部数据将被覆盖，无法撤销，确认继续？`)) return;
  _applyFullBackup(data, 'restore');
}

// 合并导入：错题去重合并，笔记覆盖，设置保持本地
function importFullMerge(data) {
  _applyFullBackup(data, 'merge');
}

function _applyFullBackup(data, mode, opts) {
  opts = opts || {};
  if (mode === 'restore') {
    errors = (data.errors || []).map((e) => ({
      ...e,
      entryKind: normalizeEntryKind(e.entryKind, 'error'),
      id: String(e.id || crypto.randomUUID()),
      addDate: e.addDate || today(),
      quiz: e.quiz || null,
      status: e.status || 'focus',
      updatedAt: e.updatedAt || new Date().toISOString(),
      masteryLevel: e.masteryLevel || 'not_mastered',
      masteryUpdatedAt: e.masteryUpdatedAt || null,
      lastPracticedAt: e.lastPracticedAt || null
    }));
    revealed = new Set((data.revealed || []).map(String));
    expTypes = new Set((data.expTypes || []).map(String));
    expMain = new Set((data.expMain || []).map(String));
    expMainSub = new Set((data.expMainSub || []).map(String));
    expMainSub2 = new Set((data.expMainSub2 || []).map(String));
    saveData();
    saveReveal();
    saveExpTypes();
    saveExpMain();
    _typeRules = data.typeRules || null;
    _dirTree = data.dirTree || null;
    globalNote = data.globalNote !== undefined ? data.globalNote : '';
    dailyJournalEntries = data.dailyJournalEntries && typeof data.dailyJournalEntries === 'object' ? data.dailyJournalEntries : {};
    knowledgeExpanded = new Set((data.knowledgeExpanded || []).map(String));
    knowledgeExpandedLoaded = true;
    todayDate = data.todayDate || today();
    todayDone = Number(data.todayDone || 0);
    _history = Array.isArray(data.history) ? data.history : [];
    DB.set(KEY_TYPE_RULES, JSON.stringify(_typeRules));
    DB.set(KEY_DIR_TREE, JSON.stringify(_dirTree));
    DB.set(KEY_GLOBAL_NOTE, globalNote);
    DB.set(KEY_DAILY_JOURNAL, JSON.stringify(dailyJournalEntries || {}));
    DB.set(KEY_KNOWLEDGE_EXPANDED, JSON.stringify(Array.from(knowledgeExpanded)));
    DB.set(KEY_TODAY_DATE, todayDate);
    DB.set(KEY_TODAY_DONE, String(todayDone));
    DB.set(KEY_HISTORY, JSON.stringify(_history));
  } else {
    // 合并错题
    const { added, updated } = mergeImport(data.errors || [], 'error');
    saveData();
    console.log(`[合并] 新增 ${added} 条，更新 ${updated} 条`);
  }

  // 笔记：备份直接覆盖本地（merge/restore 均如此）
  if (data.notesByType) {
    notesByType = data.notesByType;
    DB.set(KEY_NOTES_BY_TYPE, JSON.stringify(notesByType));
  }
  if (data.noteImages) {
    noteImages = data.noteImages;
    DB.set(KEY_NOTE_IMAGES, JSON.stringify(noteImages));
  }
  knowledgeTree = data.knowledgeTree || null;
  knowledgeNotes = data.knowledgeNotes || {};
  DB.set(KEY_KNOWLEDGE_TREE, JSON.stringify(knowledgeTree));
  DB.set(KEY_KNOWLEDGE_NOTES, JSON.stringify(knowledgeNotes));
  ensureKnowledgeState({ syncErrors: true, persist: true });

  closeModal('importModal');
  saveReveal();
  renderSidebar();
  renderAll();

  const errCount = errors.length;
  const noteCount = Object.keys(notesByType || {}).length;
  const knowledgeCount = collectKnowledgeNodes().length;
  if (!opts.skipCompletionAlert) {
    alert(mode === 'restore'
      ? `完整恢复完成！${errCount} 条错题、${noteCount} 个旧笔记模块、${knowledgeCount} 个知识点笔记已恢复。`
      : `合并完成！当前共 ${errCount} 条错题、${noteCount} 个旧笔记模块、${knowledgeCount} 个知识点笔记。`
    );
  }
}

function mergeBackupMapPreservingCurrent(currentValue, incomingValue) {
  const currentMap = currentValue && typeof currentValue === 'object' ? currentValue : {};
  const incomingMap = incomingValue && typeof incomingValue === 'object' ? incomingValue : {};
  return { ...incomingMap, ...currentMap };
}

function _applyFullBackup(data, mode, opts) {
  opts = opts || {};
  if (mode === 'restore') {
    errors = (data.errors || []).map((e) => ({
      ...e,
      entryKind: normalizeEntryKind(e.entryKind, 'error'),
      id: String(e.id || crypto.randomUUID()),
      addDate: e.addDate || today(),
      quiz: e.quiz || null,
      status: e.status || 'focus',
      updatedAt: e.updatedAt || new Date().toISOString(),
      masteryLevel: e.masteryLevel || 'not_mastered',
      masteryUpdatedAt: e.masteryUpdatedAt || null,
      lastPracticedAt: e.lastPracticedAt || null
    }));
    revealed = new Set((data.revealed || []).map(String));
    expTypes = new Set((data.expTypes || []).map(String));
    expMain = new Set((data.expMain || []).map(String));
    expMainSub = new Set((data.expMainSub || []).map(String));
    expMainSub2 = new Set((data.expMainSub2 || []).map(String));
    saveData();
    saveReveal();
    saveExpTypes();
    saveExpMain();
    _typeRules = data.typeRules || null;
    _dirTree = data.dirTree || null;
    globalNote = data.globalNote !== undefined ? data.globalNote : '';
    dailyJournalEntries = data.dailyJournalEntries && typeof data.dailyJournalEntries === 'object' ? data.dailyJournalEntries : {};
    knowledgeExpanded = new Set((data.knowledgeExpanded || []).map(String));
    knowledgeExpandedLoaded = true;
    todayDate = data.todayDate || today();
    todayDone = Number(data.todayDone || 0);
    _history = Array.isArray(data.history) ? data.history : [];
    DB.set(KEY_TYPE_RULES, JSON.stringify(_typeRules));
    DB.set(KEY_DIR_TREE, JSON.stringify(_dirTree));
    DB.set(KEY_GLOBAL_NOTE, globalNote);
    DB.set(KEY_DAILY_JOURNAL, JSON.stringify(dailyJournalEntries || {}));
    DB.set(KEY_KNOWLEDGE_EXPANDED, JSON.stringify(Array.from(knowledgeExpanded)));
    DB.set(KEY_TODAY_DATE, todayDate);
    DB.set(KEY_TODAY_DONE, String(todayDone));
    DB.set(KEY_HISTORY, JSON.stringify(_history));
  } else {
    const { added, updated } = mergeImport(data.errors || [], 'error', {
      preserveExistingNoteNodeId: true
    });
    saveData();
    console.log(`[merge] added ${added}, updated ${updated}`);
  }

  if (data.notesByType) {
    notesByType = mode === 'restore'
      ? data.notesByType
      : mergeBackupMapPreservingCurrent(notesByType, data.notesByType);
    DB.set(KEY_NOTES_BY_TYPE, JSON.stringify(notesByType));
  }
  if (data.noteImages) {
    noteImages = mode === 'restore'
      ? data.noteImages
      : mergeBackupMapPreservingCurrent(noteImages, data.noteImages);
    DB.set(KEY_NOTE_IMAGES, JSON.stringify(noteImages));
  }
  if (mode === 'restore') {
    knowledgeTree = data.knowledgeTree || null;
    knowledgeNotes = data.knowledgeNotes || {};
  }
  DB.set(KEY_KNOWLEDGE_TREE, JSON.stringify(knowledgeTree));
  DB.set(KEY_KNOWLEDGE_NOTES, JSON.stringify(knowledgeNotes));
  ensureKnowledgeState({ syncErrors: true, persist: true });

  closeModal('importModal');
  saveReveal();
  renderSidebar();
  renderAll();

  const errCount = errors.length;
  const noteCount = Object.keys(notesByType || {}).length;
  const knowledgeCount = collectKnowledgeNodes().length;
  if (!opts.skipCompletionAlert) {
    alert(mode === 'restore'
      ? `完整恢复完成：${errCount} 条错题，${noteCount} 个笔记模块，${knowledgeCount} 个知识点`
      : `合并完成：当前共 ${errCount} 条错题，${noteCount} 个笔记模块，${knowledgeCount} 个知识点`
    );
  }
}

async function _applyCloudBackupStaged(data, updatedAt, opts) {
  opts = opts || {};
  const syncAt = updatedAt || data.exportTime || '';
  const summary = getBackupSummary(data);
  withCloudAutoSaveSuppressed(() => withIncrementalSyncSuppressed(() => {
    errors = (data.errors || []).map((e) => ({
      ...e,
      entryKind: normalizeEntryKind(e.entryKind, 'error'),
      id: String(e.id || crypto.randomUUID()),
      addDate: e.addDate || today(),
      quiz: e.quiz || null,
      status: e.status || 'focus',
      updatedAt: e.updatedAt || new Date().toISOString(),
      masteryLevel: e.masteryLevel || 'not_mastered',
      masteryUpdatedAt: e.masteryUpdatedAt || null,
      lastPracticedAt: e.lastPracticedAt || null
    }));
    revealed = new Set((data.revealed || []).map(String));
    expTypes = new Set((data.expTypes || []).map(String));
    expMain = new Set((data.expMain || []).map(String));
    expMainSub = new Set((data.expMainSub || []).map(String));
    expMainSub2 = new Set((data.expMainSub2 || []).map(String));
    saveData();
    saveReveal();
    saveExpTypes();
    saveExpMain();
  }));
  setCloudSyncState('saving', `正在同步云端错题 ${summary.errors || errors.length} 条`, syncAt);
  await delayCloudRestore(0);

  withCloudAutoSaveSuppressed(() => withIncrementalSyncSuppressed(() => {
    _typeRules = data.typeRules || null;
    _dirTree = data.dirTree || null;
    globalNote = data.globalNote !== undefined ? data.globalNote : '';
    dailyJournalEntries = data.dailyJournalEntries && typeof data.dailyJournalEntries === 'object' ? data.dailyJournalEntries : {};
    knowledgeExpanded = new Set((data.knowledgeExpanded || []).map(String));
    knowledgeExpandedLoaded = true;
    todayDate = data.todayDate || today();
    todayDone = Number(data.todayDone || 0);
    _history = Array.isArray(data.history) ? data.history : [];
    DB.set(KEY_TYPE_RULES, JSON.stringify(_typeRules));
    DB.set(KEY_DIR_TREE, JSON.stringify(_dirTree));
    DB.set(KEY_GLOBAL_NOTE, globalNote);
    DB.set(KEY_DAILY_JOURNAL, JSON.stringify(dailyJournalEntries || {}));
    DB.set(KEY_KNOWLEDGE_EXPANDED, JSON.stringify(Array.from(knowledgeExpanded)));
    DB.set(KEY_TODAY_DATE, todayDate);
    DB.set(KEY_TODAY_DONE, String(todayDone));
    DB.set(KEY_HISTORY, JSON.stringify(_history));
    if (data.notesByType) {
      notesByType = data.notesByType;
      DB.set(KEY_NOTES_BY_TYPE, JSON.stringify(notesByType));
    }
    if (data.noteImages) {
      noteImages = data.noteImages;
      DB.set(KEY_NOTE_IMAGES, JSON.stringify(noteImages));
    }
  }));
  setCloudSyncState('saving', `正在同步笔记与图片 ${summary.notesByType + summary.noteImages} 项`, syncAt);
  await delayCloudRestore(0);

  withCloudAutoSaveSuppressed(() => withIncrementalSyncSuppressed(() => {
    knowledgeTree = data.knowledgeTree || null;
    knowledgeNotes = data.knowledgeNotes || {};
    DB.set(KEY_KNOWLEDGE_TREE, JSON.stringify(knowledgeTree));
    DB.set(KEY_KNOWLEDGE_NOTES, JSON.stringify(knowledgeNotes));
    ensureKnowledgeState({ syncErrors: true, persist: true });
  }));
  setCloudSyncState('saving', `正在同步知识点 ${summary.knowledgeNodes || collectKnowledgeNodes().length} 个`, syncAt);
  await delayCloudRestore(0);

  closeModal('importModal');
  saveReveal();
  renderSidebar();
  renderAll();
  if (!opts.skipCompletionAlert) {
    const errCount = errors.length;
    const noteCount = Object.keys(notesByType || {}).length;
    const knowledgeCount = collectKnowledgeNodes().length;
    alert(`完整恢复完成！${errCount} 条错题、${noteCount} 个旧笔记模块、${knowledgeCount} 个知识点笔记已恢复。`);
  }
}
