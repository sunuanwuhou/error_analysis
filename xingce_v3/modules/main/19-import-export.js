// ============================================================
// 导出 / 导入
// ============================================================
async function exportAll(){
  const payload = await buildPortableBackupPayload(errors.map(sanitizeExportRecord));
  download('cuoti_all_'+today()+'.json',JSON.stringify(payload,null,2));
}
async function exportFiltered(){
  const list=getFiltered();
  const payload = await buildPortableBackupPayload(list.map(sanitizeExportRecord));
  download('cuoti_filtered_'+today()+'.json',JSON.stringify(payload,null,2));
}
function download(name,content){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  a.download=name;a.click();URL.revokeObjectURL(a.href);
}
function sanitizeExportRecord(item) {
  const kind = normalizeEntryKind(item && item.entryKind, 'error');
  const record = normalizeEntryRecord(item, kind);
  const createdAt = String(record.createdAt || record.sentAt || record.sharedAt || record.ccSentAt || record.claudeSentAt || '').trim();
  return {
    ...record,
    tip: String(record.tip || record.nextAction || '').trim(),
    workflowStage: String(record.workflowStage || ''),
    problemType: String(record.problemType || ''),
    nextActionType: String(record.nextActionType || ''),
    confidence: Number(record.confidence || 0) || 0,
    isClassic: !!record.isClassic,
    addDate: String(record.addDate || ''),
    updatedAt: String(record.updatedAt || record.modifiedAt || record.lastModifiedAt || ''),
    masteryUpdatedAt: String(record.masteryUpdatedAt || record.masteredAt || ''),
    createdAt,
    sentAt: String(record.sentAt || createdAt || ''),
    sharedAt: String(record.sharedAt || createdAt || '')
  };
}
function selectImportMode(m){
  importMode=m;
  ['merge','replace'].forEach(x=>document.getElementById('modeBtn_'+x).classList.toggle('active',x===m));
}
function openImportModal(){ importKnowledgeNodeId = null; document.getElementById('importText').value='';selectImportMode('merge');openModal('importModal'); }
