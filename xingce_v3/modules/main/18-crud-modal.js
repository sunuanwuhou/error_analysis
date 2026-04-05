// ============================================================
// 添加/编辑
// ============================================================
function openAddModal(){
  editingId=null; editImgBase64=null; editImgDeleted=false; editAnalysisImgBase64=null; editAnalysisImgDeleted=false;
  setSaveErrorBusyState(false);
  modalKnowledgeNodeId = null;
  resetAIAnalyzeState();
  document.getElementById('addModalTitle').textContent='添加错题';
  ['editSubtype','editSubSubtype','editQuestion','editOptions','editAnswer','editMyAnswer','editRootReason','editErrorReason','editAnalysis','editNextAction','editSrcOrigin'].forEach(id=>document.getElementById(id).value='');
  const classicEl = document.getElementById('editIsClassic');
  if (classicEl) classicEl.checked = false;
  document.getElementById('editSrcYear').value='';
  document.getElementById('editSrcProvince').value='';
  document.getElementById('editActualDurationSec').value='';
  document.getElementById('editTargetDurationSec').value='';
  document.getElementById('editType').value='言语理解与表达';
  document.getElementById('editStatus').value='focus';
  clearEditImg();
  clearEditAnalysisImg();
  _modalDiff = 0;
  updateModalDiffStars();
  updateSubtypeOptions();
  setReasonFormValue('');
  refreshKnowledgePicker();
  setEntryAdvancedOpen(false);
  updateEntryFlowBanner(getKnowledgeContextForEntry(selectedKnowledgeNodeId));
  openModal('addModal');
  focusPrimaryEntryField();
}
function openEditModal(id){
  const e=findErrorById(id);if(!e)return;
  editingId=normalizeErrorId(id); editImgBase64=null; editImgDeleted=false; editAnalysisImgBase64=null; editAnalysisImgDeleted=false;
  setSaveErrorBusyState(false);
  modalKnowledgeNodeId = null;
  resetAIAnalyzeState();
  document.getElementById('addModalTitle').textContent = isClaudeBankEntry(e) ? '编辑题库题' : '编辑错题';
  document.getElementById('editType').value=e.type||'其他';
  document.getElementById('editSubtype').value=e.subtype||'';
  document.getElementById('editSubSubtype').value=e.subSubtype||'';
  document.getElementById('editQuestion').value=e.question||'';
  document.getElementById('editOptions').value=(e.options||'').replace(/\n/g,'|');
  document.getElementById('editAnswer').value=e.answer||'';
  document.getElementById('editMyAnswer').value=e.myAnswer||'';
  document.getElementById('editAnalysis').value=e.analysis||'';
  document.getElementById('editStatus').value=e.status||'focus';
  clearEditImg();
  clearEditAnalysisImg();
  if(e.imgData) setEditImgPreview(e.imgData);
  if(e.analysisImgData) setEditAnalysisImgPreview(e.analysisImgData);
  document.getElementById('editSrcYear').value=e.srcYear||'';
  document.getElementById('editSrcProvince').value=e.srcProvince||'';
  document.getElementById('editActualDurationSec').value = Number.isFinite(Number(e.actualDurationSec)) && Number(e.actualDurationSec) > 0 ? Number(e.actualDurationSec) : '';
  document.getElementById('editTargetDurationSec').value = Number.isFinite(Number(e.targetDurationSec)) && Number(e.targetDurationSec) > 0 ? Number(e.targetDurationSec) : '';
  const classicEl = document.getElementById('editIsClassic');
  if (classicEl) classicEl.checked = !!e.isClassic;
  document.getElementById('editSrcOrigin').value=e.srcOrigin||'';
  _modalDiff = e.difficulty || 0;
  updateModalDiffStars();
  document.getElementById('editRootReason').value = e.mistakeType || e.rootReason || '';
  setReasonFormValue(e.triggerPoint || e.errorReason || '');
  document.getElementById('editAnalysis').value = e.correctModel || e.analysis || '';
  const _nextActionEl = document.getElementById('editNextAction'); if(_nextActionEl) _nextActionEl.value = e.nextAction || e.tip || '';
  refreshKnowledgePicker(e.noteNodeId || '');
  setEntryAdvancedOpen(Boolean((e.status && e.status !== 'focus') || e.difficulty || e.srcYear || e.srcProvince || e.srcOrigin));
  updateEntryFlowBanner(getKnowledgeContextForEntry(e.noteNodeId || selectedKnowledgeNodeId));
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
