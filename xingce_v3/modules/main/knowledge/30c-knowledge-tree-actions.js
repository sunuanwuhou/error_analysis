// ============================================================
// Knowledge tree actions
// ============================================================

function openDirModal() {
  _dirTree = loadDirTree();
  _dirSelType = FIXED_TYPES[0];
  _dirSelSub = '';
  renderDirCols();
  openModal('dirModal');
}

function dirSelType(t) {
  _dirSelType = t;
  _dirSelSub = '';
  renderDirCols();
}

function dirSelSub(s) {
  _dirSelSub = s;
  renderDirCols();
}

function dirAddItem(level) {
  if (level === 2) {
    const v = document.getElementById('dirAddSub').value.trim();
    if (!v) return;
    if (!_dirTree[_dirSelType]) _dirTree[_dirSelType] = {};
    if (!_dirTree[_dirSelType][v]) _dirTree[_dirSelType][v] = [];
    document.getElementById('dirAddSub').value = '';
    _dirSelSub = v;
    saveDirTree();
    renderDirCols();
  } else {
    if (!_dirSelSub) { showToast("请先选择二级分类", 'warning'); return; }
    const v = document.getElementById('dirAddSub2').value.trim();
    if (!v) return;
    if (!_dirTree[_dirSelType][_dirSelSub]) _dirTree[_dirSelType][_dirSelSub] = [];
    if (!_dirTree[_dirSelType][_dirSelSub].includes(v)) _dirTree[_dirSelType][_dirSelSub].push(v);
    document.getElementById('dirAddSub2').value = '';
    saveDirTree();
    renderDirCols();
  }
}

function dirDelSub(s) {
  if (!confirm("确定删除二级分类「" + s + "」以及其下三级分类吗？")) return;
  delete _dirTree[_dirSelType][s];
  if (_dirSelSub === s) _dirSelSub = '';
  saveDirTree();
  renderDirCols();
}

function dirDelSub2(s2) {
  const arr = _dirTree[_dirSelType][_dirSelSub];
  if (!arr) return;
  const idx = arr.indexOf(s2);
  if (idx >= 0) arr.splice(idx, 1);
  saveDirTree();
  renderDirCols();
}

function resetDirTree() {
  if (!confirm("确定重置分类目录吗？这会清空你手动维护的分类层级。")) return;
  _dirTree = JSON.parse(JSON.stringify(DEFAULT_DIR_TREE));
  saveDirTree();
  renderDirCols();
}

function selectKnowledgeNodeModalTarget(nodeId) {
  knowledgeNodeModalState.targetId = nodeId;
  renderKnowledgeNodeTargetOptions();
}

function selectKnowledgeMoveTarget(nodeId) {
  pendingKnowledgeMoveTargetId = nodeId;
  renderKnowledgeMoveOptions();
}

function onTypeChange() {
  updateSubtypeOptions();
  document.getElementById('editSubtype').value = '';
  document.getElementById('editSubSubtype').value = '';
  const level4El = document.getElementById('editLevel4');
  if (level4El) level4El.value = '';
  const level5El = document.getElementById('editLevel5');
  if (level5El) level5El.value = '';
  refreshKnowledgePicker();
}

function onSubtypeInput() {
  updateSub2Options();
  refreshKnowledgePicker();
}

