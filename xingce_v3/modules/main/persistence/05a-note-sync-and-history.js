// ============================================================
// Persistence helpers: note image refs, note sync, history
// ============================================================

function noteImgId() {
  return 'ni' + Math.random().toString(36).slice(2, 8);
}

function setNoteImageRef(id, value) {
  const key = String(id || '').trim();
  if (!key) return '';
  noteImages[key] = value || '';
  saveNotesByType();
  return noteImages[key];
}

function getNoteImageRef(id) {
  const key = String(id || '').trim();
  return key ? (noteImages[key] || '') : '';
}

// 解析笔记图片引用（noteimg:xxx → base64）
function resolveNoteImgs(text) {
  return text.replace(/noteimg:([a-z0-9]+)/g, (_, id) => noteImages[id] || '');
}

// 笔记目录联动：确保每个题型有笔记条目
function syncNotesWithErrors() {
  const errorEntries = getErrorEntries();
  // 收集所有题型
  const types = [...new Set(errorEntries.map(e => e.type).filter(Boolean))];
  // 新建缺失的题型，并自动生成子类型标题
  types.forEach(t => {
    if (!notesByType[t] || !notesByType[t].content) {
      const subtypes = [...new Set(errorEntries.filter(e => e.type === t).map(e => e.subtype).filter(Boolean))];
      const autoContent = subtypes.length > 0 ? subtypes.map(s => `## ${s}\n\n`).join('') : '';
      notesByType[t] = { content: autoContent, updatedAt: '' };
    }
  });
  saveNotesByType();
  ensureKnowledgeState({ persist: true });
}

// 新增：点击笔记标题筛选功能（同时切换到错题Tab）
function filterByNoteTitle(type, subtype, subSubtype) {
    knowledgeNodeFilter = null;
    if (subSubtype && subSubtype !== '未分类') {
        typeFilter = {level:'sub2', type: type, subtype: subtype, value: subSubtype};
    } else if (subtype && subtype !== '未分类') {
        typeFilter = {level:'subtype', type: type, value: subtype};
    } else {
        typeFilter = {level:'type', value: type};
    }
    switchTab('notes');
}

// 新增：同步题目类型名称修改
function syncNoteTypeNames() {
    const newNotesByType = {};
    const typeMap = new Map(); // 用于收集当前使用的类型名称
    // 收集所有题目中使用的类型名称
    errors.forEach(err => {
        if (err.type) typeMap.set(err.type, true);
        if (err.subtype) typeMap.set(err.subtype, true);
        if (err.subSubtype) typeMap.set(err.subSubtype, true);
    });
    // 遍历现有笔记结构，只保留题目中存在的类型
    Object.keys(notesByType).forEach(noteType => {
        if (typeMap.has(noteType)) {
            newNotesByType[noteType] = notesByType[noteType];
        }
    });
    notesByType = newNotesByType;
    saveNotesByType();
    renderNotesByType();
}

function saveTodayDone(){
  const changed = syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_TODAY_DATE, todayDate || '');
  queuePersist(KEY_TODAY_DONE, String(todayDone || 0));
  if (changed) markIncrementalWorkspaceChange();
}

let _history = [];

function loadHistory(){ return _history; }

function pushHistory(rec){
  _history.unshift(rec);
  if(_history.length>30)_history.length=30;
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_HISTORY, _history, 220);
  markIncrementalWorkspaceChange();
}

let aiChatHistory = [];

function getCurrentKnowledgeNodeSummary(){
  const node = selectedKnowledgeNodeId ? getKnowledgeNodeById(selectedKnowledgeNodeId) : null;
  if(!node) return null;
  const path = (getKnowledgePathTitles(node.id) || []).join(' > ');
  return {
    id: node.id,
    title: node.title || '',
    path,
    contentMd: node.contentMd || '',
    linkedErrors: getErrorEntries().filter(e => e.noteNodeId === node.id).slice(0, 20)
  };
}
