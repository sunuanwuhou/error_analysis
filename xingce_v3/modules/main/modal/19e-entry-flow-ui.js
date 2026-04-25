// ============================================================
// Entry flow UI helpers
// ============================================================

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
  const pathTitles = Array.isArray(context.knowledgePathTitles) ? context.knowledgePathTitles : [];
  if (context.type) document.getElementById('editType').value = context.type;
  updateSubtypeOptions();
  document.getElementById('editSubtype').value = pathTitles[1] || context.subtype || '';
  document.getElementById('editSubSubtype').value = pathTitles[2] || '';
  const level4El = document.getElementById('editLevel4');
  if (level4El) level4El.value = pathTitles[3] || '';
  const level5El = document.getElementById('editLevel5');
  if (level5El) level5El.value = pathTitles[4] || '';
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
  importKnowledgeNodeId = selectedKnowledgeNodeId || null;
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
