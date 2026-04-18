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
    if (!_dirSelSub) { showToast("????????", 'warning'); return; }
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
  if (!confirm("???????" + s + "???????????")) return;
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
  if (!confirm("???????????????????")) return;
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
  refreshKnowledgePicker();
}

function onSubtypeInput() {
  updateSub2Options();
  refreshKnowledgePicker();
}
