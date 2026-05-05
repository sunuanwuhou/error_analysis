// ============================================================
// Full backup payload helpers
// ============================================================
function toggleCloudDetails() {
  cloudDetailsExpanded = !cloudDetailsExpanded;
  renderCloudUi();
}

function getFullBackupPayload() {
  return {
    xc_version: 2,
    exportTime: new Date().toISOString(),
    baseUpdatedAt: cloudMeta.lastSeenBackupAt || '',
    forceOverwrite: false,
    errors: errors,
    revealed: [...revealed],
    expTypes: [...expTypes],
    expMain: [...expMain],
    expMainSub: [...expMainSub],
    expMainSub2: [...expMainSub2],
    notesByType: notesByType,
    noteImages: noteImages,
    typeRules: _typeRules,
    dirTree: _dirTree,
    globalNote: globalNote,
    knowledgeTree: knowledgeTree,
    knowledgeNotes: knowledgeNotes,
    knowledgeExpanded: Array.from(knowledgeExpanded || []),
    todayDate: todayDate || '',
    todayDone: Number(todayDone || 0),
    history: _history || []
  };
}
