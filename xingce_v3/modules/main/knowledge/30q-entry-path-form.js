// ============================================================
// Entry form path and matching helpers
// ============================================================
function getEntryPathTitlesFromForm() {
  const level1 = document.getElementById('editType')?.value || '';
  const level2 = document.getElementById('editSubtype')?.value.trim() || '';
  const level3 = document.getElementById('editSubSubtype')?.value.trim() || '';
  const level4 = document.getElementById('editLevel4')?.value.trim() || '';
  const level5 = document.getElementById('editLevel5')?.value.trim() || '';
  return normalizeKnowledgePathTitles([level1, level2, level3, level4, level5], {
    fallbackTitles: [level1 || '其他', level2 || '未分类', level3 || '未细分']
  });
}

function getEntryClassificationTripleFromForm() {
  const titles = getEntryPathTitlesFromForm();
  return {
    type: titles[0] || '',
    subtype: titles[1] || '',
    subSubtype: titles[titles.length - 1] || ''
  };
}

function getKnowledgeNodePathTriple(nodeId) {
  const titles = collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId));
  return {
    type: titles[0] || '',
    subtype: titles[1] || '',
    subSubtype: titles[titles.length - 1] || ''
  };
}

function doesKnowledgeNodeMatchPathTitles(nodeId, pathTitles) {
  const actual = collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId));
  const target = normalizeKnowledgePathTitles(pathTitles);
  if (actual.length !== target.length) return false;
  return actual.every((title, index) => title === target[index]);
}

function doesKnowledgeNodeMatchEntryPath(nodeId, type, subtype, subSubtype) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return false;
  const target = getKnowledgePathConfig(type, subtype, subSubtype);
  const actual = getKnowledgeNodePathTriple(nodeId);
  return actual.type === target.rootTitle
    && actual.subtype === target.subTitle
    && actual.subSubtype === target.sub2Title;
}
