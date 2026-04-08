// ============================================================
// 添加 / 编辑
// ============================================================
function ensureEntryLevelFieldUi() {
  const typeEl = document.getElementById('editType');
  const subtypeEl = document.getElementById('editSubtype');
  const level3El = document.getElementById('editSubSubtype');
  if (typeEl) {
    const label = typeEl.closest('.form-group')?.querySelector('label');
    if (label) label.textContent = '1级';
  }
  if (subtypeEl) {
    const label = subtypeEl.closest('.form-group')?.querySelector('label');
    if (label) label.innerHTML = '2级 <span style="color:#e74c3c">*</span>';
    subtypeEl.placeholder = '请输入2级（必填）';
  }
  if (level3El) {
    const label = level3El.closest('.form-group')?.querySelector('label');
    if (label) label.innerHTML = '3级 <span style="font-size:11px;color:#aaa">（可选）</span>';
    level3El.placeholder = '请输入3级';
    const group = level3El.closest('.form-group');
    if (!document.getElementById('editLevel4') && group && group.parentNode) {
      const wrapper = document.createElement('div');
      wrapper.className = 'form-group';
      wrapper.innerHTML = '<label>4级 <span style="font-size:11px;color:#aaa">（可选，最终叶子）</span></label><input data-oninput="refreshKnowledgePicker()" id="editLevel4" placeholder="请输入4级" type="text">';
      group.parentNode.insertBefore(wrapper, group.nextSibling);
    }
  }
}

function openAddModal() {
  editingId = null;
  editImgBase64 = null;
  editImgDeleted = false;
  editAnalysisImgBase64 = null;
  editAnalysisImgDeleted = false;
  setSaveErrorBusyState(false);
  modalKnowledgeNodeId = null;
  resetAIAnalyzeState();
  ensureEntryLevelFieldUi();
  document.getElementById('addModalTitle').textContent = '添加错题';
  ['editSubtype', 'editSubSubtype', 'editLevel4', 'editQuestion', 'editOptions', 'editAnswer', 'editMyAnswer', 'editRootReason', 'editErrorReason', 'editAnalysis', 'editNextAction', 'editSrcOrigin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const classicEl = document.getElementById('editIsClassic');
  if (classicEl) classicEl.checked = false;
  document.getElementById('editSrcYear').value = '';
  document.getElementById('editSrcProvince').value = '';
  document.getElementById('editActualDurationSec').value = '';
  document.getElementById('editTargetDurationSec').value = '';
  document.getElementById('editType').value = '言语理解与表达';
  document.getElementById('editStatus').value = 'focus';
  clearEditImg();
  clearEditAnalysisImg();
  _modalDiff = 0;
  updateModalDiffStars();
  updateSubtypeOptions();
  setReasonFormValue('');
  refreshKnowledgePicker();
  setEntryAdvancedOpen(false);
  updateEntryFlowBanner(getKnowledgeContextForEntry(null));
  openModal('addModal');
  focusPrimaryEntryField();
}

function openEditModal(id) {
  const e = findErrorById(id);
  if (!e) return;
  editingId = normalizeErrorId(id);
  editImgBase64 = null;
  editImgDeleted = false;
  editAnalysisImgBase64 = null;
  editAnalysisImgDeleted = false;
  setSaveErrorBusyState(false);
  modalKnowledgeNodeId = null;
  resetAIAnalyzeState();
  ensureEntryLevelFieldUi();
  document.getElementById('addModalTitle').textContent = isClaudeBankEntry(e) ? '编辑题库题' : '编辑错题';
  const pathTitles = (typeof getErrorKnowledgePathTitles === 'function' ? getErrorKnowledgePathTitles(e) : []).filter(Boolean);
  const fallbackTitles = [e.type || '其他', e.subtype || '', e.subSubtype || ''].filter(Boolean);
  const resolvedTitles = pathTitles.length ? pathTitles : fallbackTitles;
  document.getElementById('editType').value = resolvedTitles[0] || '其他';
  document.getElementById('editSubtype').value = resolvedTitles[1] || '';
  document.getElementById('editSubSubtype').value = resolvedTitles[2] || '';
  const level4El = document.getElementById('editLevel4');
  if (level4El) level4El.value = resolvedTitles[3] || '';
  document.getElementById('editQuestion').value = e.question || '';
  document.getElementById('editOptions').value = (e.options || '').replace(/\n/g, '|');
  document.getElementById('editAnswer').value = e.answer || '';
  document.getElementById('editMyAnswer').value = e.myAnswer || '';
  document.getElementById('editAnalysis').value = e.analysis || '';
  document.getElementById('editStatus').value = e.status || 'focus';
  clearEditImg();
  clearEditAnalysisImg();
  if (e.imgData) setEditImgPreview(e.imgData);
  if (e.analysisImgData) setEditAnalysisImgPreview(e.analysisImgData);
  document.getElementById('editSrcYear').value = e.srcYear || '';
  document.getElementById('editSrcProvince').value = e.srcProvince || '';
  document.getElementById('editActualDurationSec').value = Number.isFinite(Number(e.actualDurationSec)) && Number(e.actualDurationSec) > 0 ? Number(e.actualDurationSec) : '';
  document.getElementById('editTargetDurationSec').value = Number.isFinite(Number(e.targetDurationSec)) && Number(e.targetDurationSec) > 0 ? Number(e.targetDurationSec) : '';
  const classicEl = document.getElementById('editIsClassic');
  if (classicEl) classicEl.checked = !!e.isClassic;
  document.getElementById('editSrcOrigin').value = e.srcOrigin || '';
  _modalDiff = e.difficulty || 0;
  updateModalDiffStars();
  document.getElementById('editRootReason').value = e.mistakeType || e.rootReason || '';
  setReasonFormValue(e.triggerPoint || e.errorReason || '');
  document.getElementById('editAnalysis').value = e.correctModel || e.analysis || '';
  const nextActionEl = document.getElementById('editNextAction');
  if (nextActionEl) nextActionEl.value = e.nextAction || e.tip || '';
  refreshKnowledgePicker(e.noteNodeId || '');
  setEntryAdvancedOpen(Boolean((e.status && e.status !== 'focus') || e.difficulty || e.srcYear || e.srcProvince || e.srcOrigin));
  updateEntryFlowBanner(getKnowledgeContextForEntry(e.noteNodeId || null));
  openModal('addModal');
  focusPrimaryEntryField();
}

const _openAddModalBase = openAddModal;
openAddModal = function() {
  questionOCRBusy = false;
  questionOCRResult = null;
  const fileInput = document.getElementById('ocrQuestionFileInput');
  if (fileInput) fileInput.value = '';
  updateQuestionOCRStatus('', 'muted');
  renderQuestionOCRPanel();
  _openAddModalBase();
};

const _openEditModalBase = openEditModal;
openEditModal = function(id) {
  questionOCRBusy = false;
  questionOCRResult = null;
  const fileInput = document.getElementById('ocrQuestionFileInput');
  if (fileInput) fileInput.value = '';
  updateQuestionOCRStatus('', 'muted');
  renderQuestionOCRPanel();
  _openEditModalBase(id);
};

window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
