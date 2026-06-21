// ============================================================
// 导出升级
// ============================================================
let _exportFmt = 'json';
function openExportModal() {
  _exportFmt = 'json';
  document.getElementById('efmt_json').classList.add('active');
  document.getElementById('efmt_print').classList.remove('active');
  document.getElementById('efmt_full').classList.remove('active');
  document.getElementById('exportJsonOpts').style.display = '';
  document.getElementById('exportPrintOpts').style.display = 'none';
  const modeDefault = document.querySelector('input[name="exportDataMode"][value="questions"]');
  const scopeDefault = document.querySelector('input[name="exportDataScope"][value="all"]');
  if (modeDefault) modeDefault.checked = true;
  if (scopeDefault) scopeDefault.checked = true;
  openModal('exportModal');
}
function selectExportFmt(fmt) {
  _exportFmt = fmt;
  document.getElementById('efmt_json').classList.toggle('active', fmt==='json');
  document.getElementById('efmt_print').classList.toggle('active', fmt==='print');
  document.getElementById('efmt_full').classList.toggle('active', fmt==='full');
  document.getElementById('exportJsonOpts').style.display = fmt==='json' ? '' : 'none';
  document.getElementById('exportPrintOpts').style.display = fmt==='print' ? '' : 'none';
  if (fmt === 'print') refreshPrintModuleList();
}
function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
function getExportDataMode() {
  return (document.querySelector('input[name="exportDataMode"]:checked') || {}).value || 'questions';
}
function getExportDataScope() {
  return (document.querySelector('input[name="exportDataScope"]:checked') || {}).value || 'all';
}
function getCurrentExportScopeContext() {
  if (knowledgeNodeFilter || selectedKnowledgeNodeId) {
    const nodeId = knowledgeNodeFilter || selectedKnowledgeNodeId;
    const node = getKnowledgeNodeById(nodeId);
    const nodeIds = node ? getKnowledgeDescendantNodeIds(node) : [nodeId];
    return {
      label: node ? `knowledge_${node.title}` : 'knowledge_scope',
      displayLabel: node ? `知识点：${node.title}` : '当前知识点',
      nodeIds
    };
  }
  if (typeFilter) {
    const list = getFiltered();
    return {
      label: typeFilter.level === 'type'
        ? `type_${typeFilter.value}`
        : typeFilter.level === 'subtype'
          ? `module_${typeFilter.type}_${typeFilter.value}`
          : `module_${typeFilter.type}_${typeFilter.subtype}_${typeFilter.value}`,
      displayLabel: typeFilter.level === 'type'
        ? `题型：${typeFilter.value}`
        : typeFilter.level === 'subtype'
          ? `模块：${typeFilter.type} / ${typeFilter.value}`
          : `模块：${typeFilter.type} / ${typeFilter.subtype} / ${typeFilter.value}`,
      nodeIds: [...new Set(list.map(item => item.noteNodeId).filter(Boolean))]
    };
  }
  const scope = resolveCurrentErrorScope();
  if (scope) {
    const list = getErrorEntries().filter(scope.predicate);
    return {
      label: 'current_scope',
      displayLabel: scope.label || '当前范围',
      nodeIds: [...new Set(list.map(item => item.noteNodeId).filter(Boolean))]
    };
  }
  return null;
}
function getExportErrorListByScope(scopeMode) {
  if (scopeMode === 'all') {
    return { list: getErrorEntries(), label: 'all_errors', displayLabel: '全部错题' };
  }
  if (scopeMode === 'filtered') {
    return { list: getFiltered(), label: 'filtered', displayLabel: '当前筛选' };
  }
  const context = getCurrentExportScopeContext();
  if (!context) return null;
  const scope = resolveCurrentErrorScope();
  const list = scope ? getErrorEntries().filter(scope.predicate) : getFiltered();
  return { list, label: context.label, displayLabel: context.displayLabel, nodeIds: context.nodeIds };
}
function buildNotesByTypeSubset(errorList) {
  const types = [...new Set((errorList || []).map(item => item.type).filter(Boolean))];
  const subset = {};
  types.forEach(type => {
    if (notesByType[type]) subset[type] = cloneJson(notesByType[type]);
  });
  return subset;
}
function buildKnowledgeSubset(nodeIds) {
  const includeIds = new Set((nodeIds || []).filter(Boolean));
  if (!includeIds.size) return { knowledgeTree: null, knowledgeNotes: {} };
  function walkKnowledgeSubsetNodes(nodes) {
    return (nodes || []).reduce((acc, node) => {
      const children = walkKnowledgeSubsetNodes(node.children || []);
      if (!includeIds.has(node.id) && !children.length) return acc;
      acc.push({
        ...cloneJson(node),
        children
      });
      return acc;
    }, []);
  }
  const tree = walkKnowledgeSubsetNodes(getKnowledgeRootNodes());
  const notes = {};
  includeIds.forEach(id => {
    const node = getKnowledgeNodeById(id);
    if (node && ((node.contentMd || '').trim() || knowledgeNotes[id])) {
      notes[id] = cloneJson(knowledgeNotes[id] || {
        title: node.title || '',
        content: node.contentMd || '',
        updatedAt: node.updatedAt || ''
      });
    }
  });
  return {
    knowledgeTree: tree.length ? tree : null,
    knowledgeNotes: notes
  };
}
function buildScopedExportPayload(mode, scopeInfo) {
  const errorsSubset = (scopeInfo.list || []).map(item => cloneJson(item));
  const noteNodeIds = scopeInfo.nodeIds && scopeInfo.nodeIds.length
    ? scopeInfo.nodeIds
    : [...new Set(errorsSubset.map(item => item.noteNodeId).filter(Boolean))];
  const knowledgeSubset = buildKnowledgeSubset(noteNodeIds);
  const notesSubset = buildNotesByTypeSubset(errorsSubset);
  if (mode === 'questions') {
    return errorsSubset;
  }
  const base = {
    xc_version: 2,
    exportTime: new Date().toISOString(),
    exportKind: mode,
    exportScope: scopeInfo.displayLabel,
    errors: errorsSubset,
    notesByType: notesSubset,
    noteImages: cloneJson(noteImages),
    knowledgeTree: knowledgeSubset.knowledgeTree,
    knowledgeNotes: knowledgeSubset.knowledgeNotes
  };
  if (mode === 'module_backup') {
    return {
      ...getFullBackupPayload(),
      ...base,
      errors: errorsSubset,
      notesByType: notesSubset,
      noteImages: cloneJson(noteImages),
      knowledgeTree: knowledgeSubset.knowledgeTree,
      knowledgeNotes: knowledgeSubset.knowledgeNotes
    };
  }
  return base;
}
function sanitizeExportLabel(value) {
  return String(value || 'export')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 48) || 'export';
}
function refreshPrintModuleList() {
  const mode = (document.querySelector('input[name="printContent"]:checked') || {}).value || 'q';
  if (mode === 'notes') {
    // 笔记模式：显示有内容的题型
    const types = Object.keys(notesByType).filter(k => notesByType[k] && notesByType[k].content && notesByType[k].content.trim());
    document.getElementById('exportModuleList').innerHTML = types.length
      ? types.map(t => `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;cursor:pointer">
          <input type="checkbox" class="export-mod-cb" data-type="${escapeHtml(t)}" checked>
          ${escapeHtml(t)} <span style="color:#aaa;font-size:11px">有笔记</span>
        </label>`).join('')
      : '<div style="font-size:12px;color:#aaa;padding:8px">暂无笔记内容</div>';
  } else {
    // 题目模式：显示错题题型（基于当前筛选结果）
    const filtered = getFiltered();
    const typeMap = {};
    filtered.forEach(e => { typeMap[e.type] = (typeMap[e.type]||0)+1; });
    const allErrors = getErrorEntries();
    const hint = filtered.length < allErrors.length
      ? `<div style="font-size:11px;color:#fa8c16;margin-bottom:8px">⚠ 当前有筛选条件，仅显示 ${filtered.length}/${allErrors.length} 题</div>` : '';
    document.getElementById('exportModuleList').innerHTML = hint + Object.entries(typeMap).map(([t,n]) =>
      `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;cursor:pointer">
        <input type="checkbox" class="export-mod-cb" data-type="${escapeHtml(t)}" checked>
        ${escapeHtml(t)} <span style="color:#aaa;font-size:11px">(${n}题)</span>
      </label>`).join('');
  }
}
function exportSelectAll(v) {
  document.querySelectorAll('.export-mod-cb').forEach(cb => cb.checked = v);
}

const AI_EXPORT_SUGGESTED_PROMPT = '请根据以下知识笔记和错题数据，分析我还有哪些知识点遗漏、笔记哪些地方需要补充完善，并给出按优先级排序的复习建议。';
let _knowledgeScopeExportFmt = 'json';

function selectKnowledgeScopeExportFmt(fmt) {
  _knowledgeScopeExportFmt = fmt === 'md' ? 'md' : 'json';
  document.getElementById('ksExportFmt_json')?.classList.toggle('active', _knowledgeScopeExportFmt === 'json');
  document.getElementById('ksExportFmt_md')?.classList.toggle('active', _knowledgeScopeExportFmt === 'md');
}

function formatKnowledgeScopeExportDateTime(iso) {
  try {
    return new Date(iso || Date.now()).toLocaleString('zh-CN', { hour12: false });
  } catch (e) {
    return today();
  }
}

function formatErrorStatusLabelForExport(status) {
  const value = String(status || '').trim();
  if (value === 'focus') return '重点复习';
  if (value === 'mastered') return '已掌握';
  return value || '—';
}

function resolveNoteImagesInMarkdown(md, noteImagesMap) {
  let text = String(md || '');
  text = text.replace(/!\[([^\]]*)\]\(noteimg:([a-z0-9-]+)\)/gi, (_, alt, id) => {
    const src = (noteImagesMap && noteImagesMap[id]) || '';
    return src ? `![${alt}](${src})` : `![${alt}](noteimg:${id})`;
  });
  text = text.replace(/\(noteimg:([a-z0-9-]+)\)/gi, (_, id) => {
    const src = (noteImagesMap && noteImagesMap[id]) || '';
    return src ? `(${src})` : `(noteimg:${id})`;
  });
  return text;
}

function mdBlockquote(text) {
  const lines = String(text || '').trim().split('\n').filter(Boolean);
  if (!lines.length) return '';
  return lines.map(line => `> ${line}`).join('\n');
}

function mdTableRow(label, value) {
  const cell = String(value || '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return `| ${label} | ${cell || '—'} |`;
}

function formatErrorOptionsMarkdown(options) {
  const lines = String(options || '').split(/\n|\|/).map(item => item.trim()).filter(Boolean);
  if (!lines.length) return '';
  return lines.map(item => (item.startsWith('-') ? item : `- ${item}`)).join('\n');
}

function mdImageLine(alt, src) {
  if (!src) return '';
  return `\n![${alt || '图片'}](${src})\n`;
}

function groupErrorsForMarkdown(errorsList) {
  const map = new Map();
  (errorsList || []).forEach(item => {
    const type = item.type || '未分类';
    const subtype = item.subtype || '未分类';
    const key = `${type}::${subtype}`;
    if (!map.has(key)) map.set(key, { type, subtype, items: [] });
    map.get(key).items.push(item);
  });
  return Array.from(map.values());
}

function buildKnowledgeScopeMarkdown(context, notesList, portableErrors, materializedNoteImages) {
  const sortedNotes = [...(notesList || [])].sort((a, b) => String(a.path || '').localeCompare(String(b.path || ''), 'zh-CN'));
  const groupedErrors = groupErrorsForMarkdown(portableErrors || []);
  const lines = [];
  lines.push(`# 行测学习资料 · ${context.title || '知识节点'}`);
  lines.push('');
  lines.push('> **知识范围**：' + (context.path || context.title || '—'));
  lines.push('> **导出时间**：' + formatKnowledgeScopeExportDateTime(new Date().toISOString()));
  lines.push(`> **内容统计**：${sortedNotes.length} 条笔记 · ${(portableErrors || []).length} 道题目`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 一、知识笔记');
  lines.push('');
  if (!sortedNotes.length) {
    lines.push('_（本节暂无笔记）_');
  } else {
    sortedNotes.forEach(note => {
      lines.push(`### ${note.title || '未命名笔记'}`);
      lines.push('');
      lines.push('| 项目 | 内容 |');
      lines.push('| --- | --- |');
      lines.push(mdTableRow('路径', note.path || '—'));
      lines.push(mdTableRow('更新', String(note.updatedAt || '').slice(0, 10) || '—'));
      lines.push('');
      lines.push(resolveNoteImagesInMarkdown(note.contentMd, materializedNoteImages));
      lines.push('');
      lines.push('---');
      lines.push('');
    });
  }
  lines.push('## 二、题目');
  lines.push('');
  if (!groupedErrors.length) {
    lines.push('_（本节暂无题目）_');
  } else {
    groupedErrors.forEach(group => {
      lines.push(`### ${group.type} · ${group.subtype}`);
      lines.push('');
      group.items.forEach((item, index) => {
        lines.push(`#### 题目 ${index + 1}`);
        lines.push('');
        if (item.question) {
          lines.push(mdBlockquote(item.question));
          lines.push('');
        }
        if (item.imgData) lines.push(mdImageLine('题目图片', item.imgData));
        const optionsMd = formatErrorOptionsMarkdown(item.options);
        if (optionsMd) {
          lines.push(optionsMd);
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      });
    });
  }
  lines.push('---');
  lines.push('');
  lines.push('_由行测学习笔记导出 · ' + today() + '_');
  return lines.join('\n');
}

function downloadKnowledgeScopeExportFile(name, content, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime || 'application/octet-stream' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function previewKnowledgeScopeExportSummary(context, notesList, errorsList) {
  const el = document.getElementById('knowledgeScopeExportSummary');
  if (!el) return;
  el.textContent = `范围：${context.path || context.title} · ${notesList.length} 条笔记 · ${errorsList.length} 道错题`;
}

async function gatherKnowledgeScopeExportData() {
  const context = buildKnowledgeScopeExportContext();
  if (!context) return { error: '请先在左侧知识树选中一个节点' };
  const errorsList = collectErrorsForKnowledgeNodeIds(context.nodeIds);
  const notesList = buildNotesArrayForAI(context.nodeIds);
  if (!errorsList.length && !notesList.length) {
    return { error: `「${context.title}」范围内没有可导出的笔记或错题` };
  }
  const noteImagesSubset = collectScopedNoteImages(context.nodeIds, notesList);
  const materializedNoteImages = await materializeNoteImagesSubset(noteImagesSubset);
  const portableErrors = typeof buildPortableErrorExport === 'function'
    ? await Promise.all(errorsList.map(item => buildPortableErrorExport(item)))
    : errorsList.map(item => cloneJson(item));
  return { context, errorsList, notesList, noteImagesSubset, materializedNoteImages, portableErrors };
}

async function openKnowledgeScopeExportModal() {
  if (typeof ensureLegacyModalBundleLoaded === 'function') {
    await ensureLegacyModalBundleLoaded();
  }
  _knowledgeScopeExportFmt = 'json';
  selectKnowledgeScopeExportFmt('json');
  const context = buildKnowledgeScopeExportContext();
  if (!context) {
    showToast('请先在左侧知识树选中一个节点', 'warning');
    return;
  }
  const errorsList = collectErrorsForKnowledgeNodeIds(context.nodeIds);
  const notesList = buildNotesArrayForAI(context.nodeIds);
  if (!errorsList.length && !notesList.length) {
    showToast(`「${context.title}」范围内没有可导出的笔记或错题`, 'warning');
    return;
  }
  previewKnowledgeScopeExportSummary(context, notesList, errorsList);
  openModal('knowledgeScopeExportModal');
}

async function confirmKnowledgeScopeExport() {
  const confirmBtn = document.getElementById('knowledgeScopeExportConfirmBtn');
  const headerBtn = document.getElementById('exportKnowledgeScopeBtn');
  if (confirmBtn && confirmBtn.dataset.exporting === '1') return;
  if (confirmBtn) {
    confirmBtn.dataset.exporting = '1';
    confirmBtn.disabled = true;
    confirmBtn.textContent = '导出中…';
  }
  if (headerBtn) {
    headerBtn.disabled = true;
    headerBtn.textContent = '导出中…';
  }
  try {
    const data = await gatherKnowledgeScopeExportData();
    if (data.error) {
      showToast(data.error, 'warning');
      return;
    }
    const { context, notesList, errorsList, noteImagesSubset, materializedNoteImages, portableErrors } = data;
    const imageCount = Object.keys(noteImagesSubset || {}).length;
    if (_knowledgeScopeExportFmt === 'md') {
      const mdErrors = await Promise.all(errorsList.map(async item => ({
        type: item.type,
        subtype: item.subtype,
        question: item.question,
        options: item.options,
        imgData: await materializePortableImageValue(item.imgData || ''),
      })));
      const markdown = buildKnowledgeScopeMarkdown(context, notesList, mdErrors, materializedNoteImages);
      const fileName = `xingce_export_${context.label}_${today()}.md`;
      downloadKnowledgeScopeExportFile(fileName, markdown, 'text/markdown;charset=utf-8');
    } else {
      let payload = buildKnowledgeScopeForAIPayload(context, errorsList, notesList, noteImagesSubset);
      payload = await buildPortableBackupPayload(payload);
      payload.noteImages = materializedNoteImages;
      const fileName = `xingce_ai_export_${context.label}_${today()}.json`;
      downloadKnowledgeScopeExportFile(fileName, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    }
    closeModal('knowledgeScopeExportModal');
    showToast(`已导出：${notesList.length} 条笔记、${errorsList.length} 道错题、${imageCount} 张图片`, 'success');
  } catch (err) {
    console.error('[confirmKnowledgeScopeExport]', err);
    showToast('导出失败：' + (err && err.message ? err.message : String(err)), 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.dataset.exporting = '0';
      confirmBtn.disabled = false;
      confirmBtn.textContent = '导出';
    }
    if (headerBtn) {
      headerBtn.disabled = false;
      headerBtn.textContent = '导出';
    }
  }
}

async function exportKnowledgeScopeForAI() {
  await openKnowledgeScopeExportModal();
}

if (typeof window !== 'undefined') {
  window.openKnowledgeScopeExportModal = openKnowledgeScopeExportModal;
  window.selectKnowledgeScopeExportFmt = selectKnowledgeScopeExportFmt;
  window.confirmKnowledgeScopeExport = confirmKnowledgeScopeExport;
  window.exportKnowledgeScopeForAI = exportKnowledgeScopeForAI;
}

function collectNoteImageIdsFromText(text) {
  const ids = new Set();
  String(text || '').replace(/\(noteimg:([a-z0-9-]+)\)/gi, (_, id) => { ids.add(id); });
  String(text || '').replace(/!\[[^\]]*\]\(noteimg:([a-z0-9-]+)\)/gi, (_, id) => { ids.add(id); });
  return ids;
}

function resolveKnowledgeExportNodeId() {
  return knowledgeNodeFilter || selectedKnowledgeNodeId || null;
}

function buildKnowledgeScopeExportContext() {
  const nodeId = resolveKnowledgeExportNodeId();
  if (!nodeId) return null;
  if (typeof ensureKnowledgeState === 'function') ensureKnowledgeState();
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return null;
  const nodeIds = getKnowledgeDescendantNodeIds(node);
  const pathTitles = typeof getKnowledgePathTitles === 'function' && typeof collapseKnowledgePathTitles === 'function'
    ? collapseKnowledgePathTitles(getKnowledgePathTitles(node.id))
    : [node.title || ''];
  return {
    nodeId: node.id,
    node,
    nodeIds,
    title: node.title || '',
    path: pathTitles.join(' > '),
    label: sanitizeExportLabel(`knowledge_${node.title || 'scope'}`),
    displayLabel: `知识点：${node.title || '当前节点'}`
  };
}

function collectErrorsForKnowledgeNodeIds(nodeIds) {
  const idSet = new Set((nodeIds || []).filter(Boolean));
  if (!idSet.size) return [];
  const resolveId = typeof resolveErrorKnowledgeNodeId === 'function'
    ? resolveErrorKnowledgeNodeId
    : (item) => String(item.noteNodeId || '');
  return getErrorEntries().filter(item => idSet.has(resolveId(item)));
}

function buildNotesArrayForAI(nodeIds) {
  const notes = [];
  (nodeIds || []).forEach(id => {
    const node = getKnowledgeNodeById(id);
    if (!node) return;
    const stored = knowledgeNotes[id];
    const content = String(node.contentMd || (stored && (stored.content || stored.contentMd)) || '').trim();
    if (!content) return;
    const pathTitles = typeof getKnowledgePathTitles === 'function' && typeof collapseKnowledgePathTitles === 'function'
      ? collapseKnowledgePathTitles(getKnowledgePathTitles(id))
      : [node.title || ''];
    notes.push({
      nodeId: id,
      title: node.title || '',
      path: pathTitles.join(' > '),
      contentMd: content,
      updatedAt: node.updatedAt || (stored && stored.updatedAt) || ''
    });
  });
  return notes;
}

function collectScopedNoteImages(nodeIds, notesList) {
  const ids = new Set();
  (nodeIds || []).forEach(id => {
    const node = getKnowledgeNodeById(id);
    const stored = knowledgeNotes[id];
    const md = String((node && node.contentMd) || (stored && (stored.content || stored.contentMd)) || '');
    collectNoteImageIdsFromText(md).forEach(imgId => ids.add(imgId));
  });
  (notesList || []).forEach(note => collectNoteImageIdsFromText(note.contentMd).forEach(imgId => ids.add(imgId)));
  const subset = {};
  ids.forEach(id => {
    if (noteImages[id]) subset[id] = noteImages[id];
  });
  return subset;
}

async function materializeNoteImagesSubset(subset) {
  const result = {};
  for (const [key, value] of Object.entries(subset || {})) {
    result[key] = await materializePortableImageValue(value || '');
  }
  return result;
}

function buildKnowledgeScopeForAIPayload(context, errorsList, notesList, noteImagesSubset) {
  const knowledgeSubset = buildKnowledgeSubset(context.nodeIds);
  return {
    xc_version: 3,
    exportTime: new Date().toISOString(),
    exportKind: 'knowledge_scope_for_ai',
    exportScope: context.displayLabel,
    scope: {
      nodeId: context.nodeId,
      title: context.title,
      path: context.path
    },
    suggestedPrompt: AI_EXPORT_SUGGESTED_PROMPT,
    stats: {
      noteCount: notesList.length,
      errorCount: errorsList.length,
      imageCount: Object.keys(noteImagesSubset || {}).length
    },
    notes: notesList,
    errors: errorsList.map(item => cloneJson(item)),
    noteImages: cloneJson(noteImagesSubset),
    knowledgeTree: knowledgeSubset.knowledgeTree,
    knowledgeNotes: knowledgeSubset.knowledgeNotes
  };
}

function exportKnowledgeTreeSnapshot() {
  ensureKnowledgeState();
  const roots = cloneJson(getKnowledgeRootNodes() || []);
  const rows = [];
  function walkTreeSnapshot(nodes, parentPath) {
    (nodes || []).forEach(node => {
      const path = collapseKnowledgePathTitles((parentPath || []).concat(node.title || ''));
      rows.push({
        id: node.id || '',
        parentId: findKnowledgeParent(node.id)?.id || '',
        level: Number(node.level || 0),
        title: node.title || '',
        path: path.join(' > ')
      });
      walkTreeSnapshot(node.children || [], path);
    });
  }
  walkTreeSnapshot(roots, []);
  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'legacy-workspace-runtime',
    rootCount: roots.length,
    nodeCount: rows.length,
    roots: roots.map(node => ({ id: node.id || '', title: node.title || '' })),
    nodes: rows
  };
  download(`knowledge_tree_snapshot_${today()}.json`, JSON.stringify(payload, null, 2));
  showToast(`知识树快照已导出（${rows.length} 节点）`, 'success');
}

async function doExport() {
  if (_exportFmt === 'full') {
    await exportFullBackup();
    closeModal('exportModal');
    return;
  }
  if (_exportFmt === 'json') {
    const scopeMode = getExportDataScope();
    const contentMode = getExportDataMode();
    const scopeInfo = getExportErrorListByScope(scopeMode);
    if (!scopeInfo) {
      showToast('当前没有可导出的模块范围，请先选中一个模块或知识点', 'warning');
      return;
    }
    if (!scopeInfo.list.length) {
      showToast('当前范围内没有可导出的错题', 'warning');
      return;
    }
    const payload = await buildPortableBackupPayload(buildScopedExportPayload(contentMode, scopeInfo));
    const suffix = sanitizeExportLabel(scopeInfo.label);
    const fileName = contentMode === 'module_backup'
      ? `xingce_module_backup_${suffix}_${today()}.json`
      : contentMode === 'questions_notes'
        ? `xingce_questions_notes_${suffix}_${today()}.json`
        : `cuoti_questions_${suffix}_${today()}.json`;
    download(fileName, JSON.stringify(payload, null, 2));
    closeModal('exportModal');
  } else {
    const contentMode = document.querySelector('input[name="printContent"]:checked').value;
    // 笔记打印
    if (contentMode === 'notes') {
      doPrintNotes();
      closeModal('exportModal');
      return;
    }
    // 打印 PDF
    const selectedTypes = new Set();
    document.querySelectorAll('.export-mod-cb:checked').forEach(cb => selectedTypes.add(cb.dataset.type));
    if (!selectedTypes.size) { showToast('请至少选择一个模块', 'warning'); return; }
    const list = getFiltered().filter(e => selectedTypes.has(e.type));
    if (!list.length) { showToast('所选模块暂无错题', 'warning'); return; }
    doPrintExport(list, contentMode);
    closeModal('exportModal');
  }
}
function doPrintExport(list, mode) {
  // 按 type/subtype 分组
  const typeMap = {};
  list.forEach(e => {
    if (!typeMap[e.type]) typeMap[e.type] = {};
    const s = e.subtype || '未分类';
    if (!typeMap[e.type][s]) typeMap[e.type][s] = [];
    typeMap[e.type][s].push(e);
  });
  let body = `<div style="font-size:20px;font-weight:bold;text-align:center;padding:16px 0;margin-bottom:12px;border-bottom:2px solid #333">错题整理 - ${today()}</div>`;
  let num = 1;
  Object.entries(typeMap).forEach(([type, subs]) => {
    body += `<div style="font-size:16px;font-weight:bold;margin:16px 0 8px;padding:6px 10px;background:#f5f5f5;border-left:4px solid #e74c3c">${escapeHtml(type)}</div>`;
    Object.entries(subs).forEach(([sub, cards]) => {
      if (sub !== '未分类') body += `<div style="font-size:13px;font-weight:600;color:#666;margin:8px 0 4px;padding-left:8px">▶ ${escapeHtml(sub)}</div>`;
      cards.forEach(e => {
        const opts = e.options ? e.options.split(/\n|\|/).map(o => `<div style="margin:2px 0 2px 12px;font-size:12px;color:#444">${escapeHtml(o.trim())}</div>`).join('') : '';
        const imgTag = e.imgData ? `<img src="${e.imgData}" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:4px;margin:6px 0;display:block">` : '';
        const ansLine = (mode==='qa'||mode==='qaa') ? `<div style="margin-top:6px;font-size:12px"><span style="background:#e6f7ff;padding:1px 8px;border-radius:3px;color:#1890ff">答案：${escapeHtml(e.answer||'—')}</span></div>` : '';
        const anaImgTag = (mode==='qaa') && e.analysisImgData ? `<img src="${e.analysisImgData}" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:4px;margin-top:6px;display:block">` : '';
        const anaLine = (mode==='qaa') && e.analysis ? `<div style="margin-top:6px;font-size:12px;color:#555;padding:6px 10px;background:#f6f8ff;border-left:3px solid #4e8ef7">${renderAnalysis(e.analysis)}</div>` : '';
        body += `<div style="margin-bottom:12px;padding:10px 12px;border:1px solid #eee;border-radius:6px;page-break-inside:avoid">
          <div style="font-size:11px;color:#aaa;margin-bottom:4px">#${num++} ${escapeHtml(e.type)} · ${escapeHtml(e.subtype||'')}</div>
          <div style="font-size:14px;color:#333;line-height:1.7">${escapeHtml(e.question)}</div>
          ${imgTag}${opts}
          ${ansLine}${anaLine}${anaImgTag}
        </div>`;
      });
    });
  });
  const win = window.open('', '_blank');
  if (!win) { alert('请允许弹出窗口'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>错题打印</title>
    <style>body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;margin:20px 30px;color:#333}
    @media print{body{margin:10px 20px}}</style></head>
    <body>${body}<script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close();
}

function doPrintNotes() {
  const selectedTypes = new Set();
  document.querySelectorAll('.export-mod-cb:checked').forEach(cb => selectedTypes.add(cb.dataset.type));
  const types = Object.keys(notesByType).filter(k =>
    selectedTypes.has(k) && notesByType[k] && notesByType[k].content && notesByType[k].content.trim()
  );
  if (!types.length) { alert('所选模块暂无笔记内容'); return; }
  let body = `<div style="font-size:20px;font-weight:bold;text-align:center;padding:16px 0;margin-bottom:12px;border-bottom:2px solid #333">学习笔记 - ${today()}</div>`;
  types.forEach(t => {
    body += `<div style="font-size:16px;font-weight:bold;margin:20px 0 8px;padding:6px 10px;background:#e6f4ff;border-left:4px solid #1890ff">${escapeHtml(t)}</div>`;
    // 打印前将 noteimg: 短引用替换为真实 base64（新窗口无法访问 noteImages）
    const resolved = (notesByType[t].content || '').replace(/\(noteimg:([a-z0-9]+)\)/g,
      (_, id) => `(${noteImages[id] || ''})`);
    body += `<div style="font-size:14px;line-height:1.8;color:#333">${renderMd(resolved)}</div>`;
  });
  const win = window.open('', '_blank');
  if (!win) { alert('请允许弹出窗口'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>学习笔记打印</title>
    <style>
      body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;margin:20px 30px;color:#333}
      @media print{body{margin:10px 20px}}
      img{max-width:100%;max-height:400px;object-fit:contain;display:block;margin:6px 0;border-radius:4px}
      pre{background:#f5f5f5;padding:10px;border-radius:4px;overflow-x:auto;font-size:12px}
      code{background:#f5f5f5;padding:2px 4px;border-radius:3px;font-size:12px}
      table{border-collapse:collapse;width:100%;margin:6px 0}
      th,td{border:1px solid #ddd;padding:6px 10px;font-size:13px}
      th{background:#f0f0f0}
      ul{margin:4px 0;padding-left:20px}
      li{margin:2px 0;font-size:14px;line-height:1.7}
      h2,h3,h4{margin:8px 0 4px;color:#222}
      strong{font-weight:700}
    </style></head>
    <body>${body}<script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close();
}
