// ============================================================
// Workspace actions
// ============================================================

function loadMoreErrors() {
  errorRenderLimit += ERROR_RENDER_STEP;
  renderAll();
}

function toggleMain(t) {
  if (expMain.has(t)) expMain.delete(t);
  else expMain.add(t);
  saveExpMain();
  renderAll();
}

function toggleMainSub(t, s) {
  const k = 'sub:' + t + '::' + s;
  if (expMainSub.has(k)) expMainSub.delete(k);
  else expMainSub.add(k);
  saveExpMain();
  renderAll();
}

function toggleMainSub2(t, s, s2) {
  const k = 's2:' + t + '::' + s + '::' + s2;
  if (expMainSub2.has(k)) expMainSub2.delete(k);
  else expMainSub2.add(k);
  saveExpMain();
  renderAll();
}

function expandAll() {
  const list = getFiltered();
  const typeMap = {};
  list.forEach(e => {
    if (!typeMap[e.type]) typeMap[e.type] = {};
    const s = e.subtype || '未分类';
    if (!typeMap[e.type][s]) typeMap[e.type][s] = new Set();
    if (e.subSubtype) typeMap[e.type][s].add(e.subSubtype);
  });
  Object.keys(typeMap).forEach(t => {
    expMain.add(t);
    Object.keys(typeMap[t]).forEach(s => {
      expMainSub.add('sub:' + t + '::' + s);
      typeMap[t][s].forEach(s2 => expMainSub2.add('s2:' + t + '::' + s + '::' + s2));
    });
  });
  saveExpMain();
  renderAll();
}

function collapseAll() {
  expMain.clear();
  expMainSub.clear();
  expMainSub2.clear();
  saveExpMain();
  renderAll();
}

window.loadMoreErrors = loadMoreErrors;
