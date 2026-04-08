// ============================================================
// Directory management
// ============================================================
const KEY_DIR_TREE = 'xc_dir_tree';
const FIXED_TYPES = ["???????", "????", "????", "????", "????", "??"];
const FIXED_KNOWLEDGE_ROOTS = ["???????", "????", "????", "????", "????"];
const DEFAULT_DIR_TREE = {
  "???????":{"????":["????", "????"]},
  "????":{"????":[]},
  "??":{},
};

let _dirSelType = '';
let _dirSelSub = '';

let _dirTree = null;
function loadDirTree() {
  if (_dirTree) return _dirTree;
  _dirTree = JSON.parse(JSON.stringify(DEFAULT_DIR_TREE));
  return _dirTree;
}
function saveDirTree() {
  syncWorkspaceOpsFromSnapshot();
  queuePersist(KEY_DIR_TREE, _dirTree);
  markIncrementalWorkspaceChange();
}
function openDirModal() {
  _dirTree = loadDirTree();
  _dirSelType = FIXED_TYPES[0];
  _dirSelSub = '';
  renderDirCols();
  openModal('dirModal');
}
window.openDirModal = openDirModal;
function renderDirCols() {
  // Level 1
  const col1 = document.getElementById('dirCol1');
  col1.innerHTML = FIXED_TYPES.map(t =>
    `<div class="dir-item ${t===_dirSelType?'active':''}" onclick="dirSelType('${escapeHtml(t)}')">${escapeHtml(t)}</div>`
  ).join('');
  // Level 2
  const subs = (_dirTree[_dirSelType] && Object.keys(_dirTree[_dirSelType])) || [];
  const col2 = document.getElementById('dirCol2');
  col2.innerHTML = subs.map(s =>
    `<div class="dir-item ${s===_dirSelSub?'active':''}" onclick="dirSelSub('${escapeHtml(s)}')">`
      + `<span>${escapeHtml(s)}</span>`
      + `<button class="dir-item-del" onclick="event.stopPropagation();dirDelSub('${escapeHtml(s)}')">?</button>`
      + `</div>`
  ).join('') || '<div style="color:#ccc;font-size:12px;padding:12px;text-align:center">' + "??????" + '</div>';
  // Level 3
  const sub2s = (_dirSelSub && _dirTree[_dirSelType] && _dirTree[_dirSelType][_dirSelSub]) || [];
  const col3 = document.getElementById('dirCol3');
  col3.innerHTML = sub2s.map(s2 =>
    `<div class="dir-item">`
      + `<span>${escapeHtml(s2)}</span>`
      + `<button class="dir-item-del" onclick="dirDelSub2('${escapeHtml(s2)}')">?</button>`
      + `</div>`
  ).join('') || `<div style="color:#ccc;font-size:12px;padding:12px;text-align:center">${_dirSelSub ? "??????" : "????????"}</div>`;
}
function dirSelType(t) { _dirSelType=t; _dirSelSub=''; renderDirCols(); }
function dirSelSub(s) { _dirSelSub=s; renderDirCols(); }
function dirAddItem(level) {
  if (level===2) {
    const v = document.getElementById('dirAddSub').value.trim();
    if (!v) return;
    if (!_dirTree[_dirSelType]) _dirTree[_dirSelType]={};
    if (!_dirTree[_dirSelType][v]) _dirTree[_dirSelType][v]=[];
    document.getElementById('dirAddSub').value='';
    _dirSelSub=v; saveDirTree(); renderDirCols();
  } else {
    if (!_dirSelSub) { showToast("????????", 'warning'); return; }
    const v = document.getElementById('dirAddSub2').value.trim();
    if (!v) return;
    if (!_dirTree[_dirSelType][_dirSelSub]) _dirTree[_dirSelType][_dirSelSub]=[];
    if (!_dirTree[_dirSelType][_dirSelSub].includes(v)) _dirTree[_dirSelType][_dirSelSub].push(v);
    document.getElementById('dirAddSub2').value='';
    saveDirTree(); renderDirCols();
  }
}
function dirDelSub(s) {
  if (!confirm("???????" + s + "???????????")) return;
  delete _dirTree[_dirSelType][s];
  if (_dirSelSub===s) _dirSelSub='';
  saveDirTree(); renderDirCols();
}
function dirDelSub2(s2) {
  const arr = _dirTree[_dirSelType][_dirSelSub];
  if (!arr) return;
  const idx=arr.indexOf(s2); if(idx>=0) arr.splice(idx,1);
  saveDirTree(); renderDirCols();
}
function resetDirTree() {
  if (!confirm("???????????????????")) return;
  _dirTree = JSON.parse(JSON.stringify(DEFAULT_DIR_TREE));
  saveDirTree(); renderDirCols();
}

function newKnowledgeNodeId() {
  return 'kn_' + Math.random().toString(36).slice(2, 10);
}
function normalizeKnowledgeTitle(value, fallback) {
  const text = (value || '').trim();
  return text || fallback;
}
function createKnowledgeNode(title, level, isLeaf) {
  return {
    id: newKnowledgeNodeId(),
    title,
    level,
    contentMd: '',
    updatedAt: '',
    isLeaf: !!isLeaf,
    children: []
  };
}
function createDefaultKnowledgeTree() {
  const roots = FIXED_KNOWLEDGE_ROOTS.map(type => createKnowledgeNode(type, 1, false));
  if (!roots.some(node => node.title === '未分类')) {
    roots.push(createKnowledgeNode('未分类', 1, false));
  }
  return { version: 1, roots };
}
function ensureFixedKnowledgeRoots() {
  const roots = getKnowledgeRootNodes();
  const desiredTitles = [...FIXED_KNOWLEDGE_ROOTS, '未分类'];
  const orderMap = new Map(desiredTitles.map((title, index) => [title, index]));
  let changed = false;
  desiredTitles.forEach(title => {
    if (!roots.some(node => String(node.title || '') === title)) {
      roots.push(createKnowledgeNode(title, 1, false));
      changed = true;
    }
  });
  const sortedRoots = roots.slice().sort((a, b) => {
    const left = orderMap.has(String(a.title || '')) ? orderMap.get(String(a.title || '')) : desiredTitles.length + 100;
    const right = orderMap.has(String(b.title || '')) ? orderMap.get(String(b.title || '')) : desiredTitles.length + 100;
    if (left !== right) return left - right;
    return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN');
  });
  if (sortedRoots.some((node, index) => node !== roots[index])) {
    knowledgeTree.roots = sortedRoots;
    changed = true;
  }
  return changed;
}
function getKnowledgeRootNodes() {
  if (!knowledgeTree || !Array.isArray(knowledgeTree.roots)) {
    knowledgeTree = createDefaultKnowledgeTree();
  }
  return knowledgeTree.roots;
}
function findKnowledgeNodeById(nodeId, nodes) {
  const list = nodes || getKnowledgeRootNodes();
  for (const node of list) {
    if (node.id === nodeId) return node;
    const found = findKnowledgeNodeById(nodeId, node.children || []);
    if (found) return found;
  }
  return null;
}
function getKnowledgeNodeById(nodeId) {
  if (!nodeId) return null;
  return findKnowledgeNodeById(nodeId, getKnowledgeRootNodes());
}
function findKnowledgeParent(nodeId, nodes, parent) {
  const list = nodes || getKnowledgeRootNodes();
  for (const node of list) {
    if (node.id === nodeId) return parent || null;
    const found = findKnowledgeParent(nodeId, node.children || [], node);
    if (found) return found;
  }
  return null;
}
function ensureKnowledgeChild(children, title, level, isLeaf) {
  let node = (children || []).find(item => item.title === title);
  if (!node) {
    node = createKnowledgeNode(title, level, isLeaf);
    children.push(node);
  }
  if (!Array.isArray(node.children)) node.children = [];
  if (typeof node.contentMd !== 'string') node.contentMd = '';
  if (typeof node.updatedAt !== 'string') node.updatedAt = '';
  node.level = level;
  node.isLeaf = node.children.length === 0;
  return node;
}
function walkKnowledgeNodes(nodes, visitor, trail) {
  (nodes || []).forEach(node => {
    const nextTrail = (trail || []).concat(node);
    visitor(node, nextTrail);
    walkKnowledgeNodes(node.children || [], visitor, nextTrail);
  });
}
function syncKnowledgeNotesFromTree() {
  const next = {};
  walkKnowledgeNodes(getKnowledgeRootNodes(), node => {
    next[node.id] = {
      title: node.title,
      content: node.contentMd || '',
      updatedAt: node.updatedAt || ''
    };
  });
  knowledgeNotes = next;
}
function getLegacyKnowledgeNoteSnapshot(nodeId) {
  if (!knowledgeNotes || typeof knowledgeNotes !== 'object' || !nodeId) return null;
  const legacy = knowledgeNotes[nodeId];
  if (!legacy || typeof legacy !== 'object') return null;
  return {
    title: String(legacy.title || ''),
    content: String(legacy.content || ''),
    updatedAt: String(legacy.updatedAt || '')
  };
}
function removeKnowledgeNoteEntry(nodeId) {
  if (!nodeId || !knowledgeNotes || typeof knowledgeNotes !== 'object') return;
  delete knowledgeNotes[nodeId];
}
function migrateKnowledgeNodeReference(oldId, newId) {
  if (!oldId || !newId || oldId === newId) return;
  errors.forEach(item => {
    if (item.noteNodeId === oldId) {
      item.noteNodeId = newId;
      item.updatedAt = new Date().toISOString();
    }
  });
  if (selectedKnowledgeNodeId === oldId) selectedKnowledgeNodeId = newId;
  if (knowledgeNodeFilter === oldId) knowledgeNodeFilter = newId;
  if (knowledgeExpanded.has(oldId)) {
    knowledgeExpanded.delete(oldId);
    knowledgeExpanded.add(newId);
  }
  const legacy = getLegacyKnowledgeNoteSnapshot(oldId);
  if (legacy) {
    const current = getLegacyKnowledgeNoteSnapshot(newId) || { title: '', content: '', updatedAt: '' };
    if (!String(current.content || '').trim() && String(legacy.content || '').trim()) {
      knowledgeNotes[newId] = {
        title: current.title || legacy.title || '',
        content: legacy.content || '',
        updatedAt: legacy.updatedAt || current.updatedAt || ''
      };
    }
    removeKnowledgeNoteEntry(oldId);
  }
}
function getKnowledgeDirectErrorCountMap() {
  const counts = new Map();
  (errors || []).forEach(item => {
    const nodeId = String((item && item.noteNodeId) || '');
    if (!nodeId) return;
    counts.set(nodeId, (counts.get(nodeId) || 0) + 1);
  });
  return counts;
}
function mergeKnowledgeNodeIntoTarget(target, source) {
  if (!target || !source || target === source) return;
  const targetContent = String(target.contentMd || '').trim();
  const sourceContent = String(source.contentMd || '').trim();
  if (!targetContent && sourceContent) {
    target.contentMd = source.contentMd || '';
    target.updatedAt = source.updatedAt || target.updatedAt || '';
  } else if (sourceContent && String(source.updatedAt || '') > String(target.updatedAt || '')) {
    target.contentMd = source.contentMd || target.contentMd || '';
    target.updatedAt = source.updatedAt || target.updatedAt || '';
  }
  target.children = (target.children || []).concat(source.children || []);
  migrateKnowledgeNodeReference(String(source.id || ''), String(target.id || ''));
}
function mergeDuplicateKnowledgeSiblings(nodes) {
  let changed = false;
  const list = Array.isArray(nodes) ? nodes : [];
  list.forEach(node => {
    if (mergeDuplicateKnowledgeSiblings(node.children || [])) changed = true;
  });
  const next = [];
  const seen = new Map();
  list.forEach(node => {
    if (!node || typeof node !== 'object') return;
    const key = String(node.title || '').trim();
    if (!key) {
      next.push(node);
      return;
    }
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, node);
      next.push(node);
      return;
    }
    mergeKnowledgeNodeIntoTarget(existing, node);
    changed = true;
  });
  if (changed && Array.isArray(nodes)) {
    nodes.splice(0, nodes.length, ...next);
  }
  return changed;
}
function pruneKnowledgeGhostNodes(nodes, directCountMap) {
  let changed = false;
  const list = Array.isArray(nodes) ? nodes : [];
  const next = [];
  list.forEach(node => {
    if (!node || typeof node !== 'object') return;
    if (pruneKnowledgeGhostNodes(node.children || [], directCountMap)) changed = true;
    node.children = Array.isArray(node.children) ? node.children : [];
    const nodeId = String(node.id || '');
    const directCount = directCountMap.get(nodeId) || 0;
    const hasContent = !!String(node.contentMd || '').trim();
    const isProtectedRoot = Number(node.level || 0) === 1 && FIXED_KNOWLEDGE_ROOTS.includes(String(node.title || ''));
    if (isProtectedRoot) {
      next.push(node);
      return;
    }
    if (!hasContent && directCount === 0) {
      if (node.children.length === 0) {
        knowledgeExpanded.delete(nodeId);
        removeKnowledgeNoteEntry(nodeId);
        changed = true;
        return;
      }
      if (node.children.length === 1) {
        const child = node.children[0];
        if (child && typeof child === 'object') {
          child.level = node.level;
          migrateKnowledgeNodeReference(nodeId, String(child.id || ''));
          next.push(child);
          changed = true;
          return;
        }
      }
    }
    next.push(node);
  });
  if (Array.isArray(nodes)) {
    nodes.splice(0, nodes.length, ...next);
  }
  return changed;
}
function collapseDuplicateKnowledgeWrappers(nodes) {
  let changed = false;
  const list = Array.isArray(nodes) ? nodes : [];
  for (let idx = 0; idx < list.length; idx += 1) {
    let node = list[idx];
    if (!node) continue;
    if (collapseDuplicateKnowledgeWrappers(node.children || [])) changed = true;
    while (
      node &&
      Array.isArray(node.children) &&
      node.children.length === 1 &&
      node.children[0] &&
      node.children[0].title === node.title
    ) {
      const child = node.children[0];
      if (!String(child.contentMd || '').trim() && String(node.contentMd || '').trim()) {
        child.contentMd = node.contentMd;
        child.updatedAt = child.updatedAt || node.updatedAt || '';
      }
      child.level = node.level;
      migrateKnowledgeNodeReference(node.id, child.id);
      list[idx] = child;
      node = child;
      changed = true;
    }
  }
  return changed;
}
function normalizeKnowledgeNodes(nodes, level) {
  (nodes || []).forEach(node => {
    if (!node.id) node.id = newKnowledgeNodeId();
    node.title = normalizeKnowledgeTitle(node.title, `知识点${node.id.slice(-4)}`);
    node.level = level;
    if (!Array.isArray(node.children)) node.children = [];
    const legacy = getLegacyKnowledgeNoteSnapshot(node.id);
    if (typeof node.contentMd !== 'string') {
      node.contentMd = legacy && typeof legacy.content === 'string' ? legacy.content : '';
    }
    if (typeof node.updatedAt !== 'string') {
      node.updatedAt = legacy && typeof legacy.updatedAt === 'string' ? legacy.updatedAt : '';
    }
    normalizeKnowledgeNodes(node.children, level + 1);
    node.isLeaf = node.children.length === 0;
  });
}
function getKnowledgePathConfig(type, subtype, subSubtype) {
  return {
    rootTitle: normalizeKnowledgeTitle(type, '未分类'),
    subTitle: normalizeKnowledgeTitle(subtype, '未分类'),
    sub2Title: normalizeKnowledgeTitle(subSubtype, '未细分')
  };
}
function ensureKnowledgePathByTitles(pathTitles) {
  const titles = (pathTitles || []).map(item => String(item || '').trim()).filter(Boolean);
  if (!titles.length) return null;
  let siblings = getKnowledgeRootNodes();
  let node = null;
  titles.forEach((title, index) => {
    node = ensureKnowledgeChild(siblings, title, index + 1, false);
    siblings = node.children;
  });
  return node;
}
function ensureKnowledgeBranchPath(type, subtype, subSubtype) {
  const path = getKnowledgePathConfig(type, subtype, subSubtype);
  const root = ensureKnowledgePathByTitles([path.rootTitle]);
  const sub = ensureKnowledgePathByTitles([path.rootTitle, path.subTitle]);
  const sub2 = ensureKnowledgePathByTitles([path.rootTitle, path.subTitle, path.sub2Title]);
  return { root, sub, sub2 };
}
function ensureKnowledgeNoteRecord(leafNode) {
  if (!leafNode) return false;
  let changed = false;
  if (typeof leafNode.contentMd !== 'string') {
    leafNode.contentMd = '';
    changed = true;
  }
  if (typeof leafNode.updatedAt !== 'string') {
    leafNode.updatedAt = '';
    changed = true;
  }
  if (!knowledgeNotes[leafNode.id]) {
    knowledgeNotes[leafNode.id] = {
      title: leafNode.title,
      content: leafNode.contentMd || '',
      updatedAt: leafNode.updatedAt || ''
    };
    changed = true;
  }
  return changed;
}
function getKnowledgeLeafDefaultTitle(type, subtype, subSubtype) {
  return normalizeKnowledgeTitle(subSubtype, normalizeKnowledgeTitle(subtype, normalizeKnowledgeTitle(type, '未分类')));
}
function ensureKnowledgeLeaf(type, subtype, subSubtype, leafTitle) {
  const path = ensureKnowledgeBranchPath(type, subtype, subSubtype);
  const title = normalizeKnowledgeTitle(leafTitle, getKnowledgeLeafDefaultTitle(type, subtype, subSubtype));
  const leaf = ensureKnowledgeChild(path.sub2.children, title, 4, true);
  if (!leaf.contentMd) {
    leaf.contentMd = `# ${leaf.title}\n\n`;
    leaf.updatedAt = new Date().toISOString();
  }
  ensureKnowledgeNoteRecord(leaf);
  return leaf;
}
function collectKnowledgeLeaves(nodes, bucket) {
  const list = nodes || getKnowledgeRootNodes();
  const acc = bucket || [];
  list.forEach(node => {
    if (!node.children || node.children.length === 0) acc.push(node);
    collectKnowledgeLeaves(node.children || [], acc);
  });
  return acc;
}
function collectKnowledgeNodes(nodes, bucket) {
  const list = nodes || getKnowledgeRootNodes();
  const acc = bucket || [];
  list.forEach(node => {
    acc.push(node);
    collectKnowledgeNodes(node.children || [], acc);
  });
  return acc;
}
function getKnowledgeDescendantNodeIds(node) {
  if (!node) return [];
  let ids = [node.id];
  (node.children || []).forEach(child => {
    ids = ids.concat(getKnowledgeDescendantNodeIds(child));
  });
  return ids;
}
function getKnowledgeErrorCountMaps() {
  if (knowledgeErrorCountCache.version === knowledgeErrorCountCacheVersion) {
    return knowledgeErrorCountCache;
  }
  const direct = new Map();
  getErrorEntries().forEach(item => {
    const nodeId = String(item && item.noteNodeId || '');
    if (!nodeId) return;
    direct.set(nodeId, (direct.get(nodeId) || 0) + 1);
  });
  const aggregate = new Map();
  function walk(node) {
    if (!node || !node.id) return 0;
    let total = direct.get(node.id) || 0;
    (node.children || []).forEach(child => {
      total += walk(child);
    });
    aggregate.set(node.id, total);
    return total;
  }
  getKnowledgeRootNodes().forEach(root => walk(root));
  knowledgeErrorCountCache = {
    version: knowledgeErrorCountCacheVersion,
    direct,
    aggregate
  };
  return knowledgeErrorCountCache;
}
function countErrorsForKnowledgeNode(nodeId, includeDescendants) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return 0;
  const maps = getKnowledgeErrorCountMaps();
  return includeDescendants === false
    ? (maps.direct.get(node.id) || 0)
    : (maps.aggregate.get(node.id) || 0);
}
function getKnowledgeAssignableNodesForPath(type, subtype, subSubtype) {
  const path = getKnowledgePathConfig(type, subtype, subSubtype);
  const root = getKnowledgeRootNodes().find(node => node.title === path.rootTitle);
  const sub = root && (root.children || []).find(node => node.title === path.subTitle);
  const sub2 = sub && (sub.children || []).find(node => node.title === path.sub2Title);
  if (!sub2) return [];
  const list = [sub2];
  walkKnowledgeNodes(sub2.children || [], node => list.push(node));
  return list;
}
function getKnowledgeNodeByPathTitles(pathTitles) {
  const titles = (pathTitles || []).map(item => String(item || '').trim()).filter(Boolean);
  if (!titles.length) return null;
  let siblings = getKnowledgeRootNodes();
  let node = null;
  for (const title of titles) {
    node = (siblings || []).find(item => String(item.title || '').trim() === title);
    if (!node) return null;
    siblings = node.children || [];
  }
  return node;
}
function getKnowledgeAssignableNodesForTitles(pathTitles) {
  const baseNode = getKnowledgeNodeByPathTitles(pathTitles);
  if (!baseNode) return [];
  const list = [baseNode];
  walkKnowledgeNodes(baseNode.children || [], node => list.push(node));
  return list;
}
function getKnowledgePathTitles(nodeId) {
  function walk(nodes, parentTrail) {
    for (const node of nodes) {
      const next = parentTrail.concat(node.title);
      if (node.id === nodeId) return next;
      const found = walk(node.children || [], next);
      if (found) return found;
    }
    return null;
  }
  return walk(getKnowledgeRootNodes(), []) || [];
}
function collapseKnowledgePathTitles(titles) {
  return (titles || []).filter((title, idx, arr) => idx === 0 || title !== arr[idx - 1]);
}
function getEntryPathTitlesFromForm() {
  const level1 = document.getElementById('editType')?.value || '';
  const level2 = document.getElementById('editSubtype')?.value.trim() || '';
  const level3 = document.getElementById('editSubSubtype')?.value.trim() || '';
  const level4 = document.getElementById('editLevel4')?.value.trim() || '';
  return [level1, level2, level3, level4].filter(Boolean);
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
  const target = collapseKnowledgePathTitles((pathTitles || []).map(item => String(item || '').trim()).filter(Boolean));
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
function getErrorKnowledgePathTitles(errorItem) {
  const nodeId = String(errorItem && errorItem.noteNodeId || '').trim();
  if (nodeId) {
    const titles = collapseKnowledgePathTitles(getKnowledgePathTitles(nodeId));
    if (titles.length) return titles;
  }
  return collapseKnowledgePathTitles([
    String(errorItem && errorItem.type || '').trim(),
    String(errorItem && errorItem.subtype || '').trim(),
    String(errorItem && errorItem.subSubtype || '').trim()
  ].filter(Boolean));
}
function getErrorKnowledgePathText(errorItem) {
  return getErrorKnowledgePathTitles(errorItem).join(' > ');
}
function getKnowledgeDisplayNode(node) {
  return node || null;
}
function resolveKnowledgeDisplayNodeId(nodeId) {
  return nodeId;
}
function getCurrentKnowledgeNode() {
  return getKnowledgeNodeById(selectedKnowledgeNodeId);
}
function ensureKnowledgeBindingForError(errorItem) {
  if (!errorItem) return false;
  const bound = getKnowledgeNodeById(errorItem.noteNodeId);
  if (bound && doesKnowledgeNodeMatchEntryPath(bound.id, errorItem.type, errorItem.subtype, errorItem.subSubtype)) {
    return ensureKnowledgeNoteRecord(bound);
  }
  const branch = ensureKnowledgeBranchPath(errorItem.type, errorItem.subtype, errorItem.subSubtype);
  ensureKnowledgeNoteRecord(branch.sub2);
  errorItem.noteNodeId = branch.sub2.id;
  return true;
}
function ensureKnowledgeState(opts) {
  const options = opts || {};
  getKnowledgeRootNodes();
  knowledgeNotes = knowledgeNotes && typeof knowledgeNotes === 'object' ? knowledgeNotes : {};
  let changed = ensureFixedKnowledgeRoots();
  if (mergeDuplicateKnowledgeSiblings(getKnowledgeRootNodes())) changed = true;
  if (collapseDuplicateKnowledgeWrappers(getKnowledgeRootNodes())) changed = true;
  if (pruneKnowledgeGhostNodes(getKnowledgeRootNodes(), getKnowledgeDirectErrorCountMap())) changed = true;
  normalizeKnowledgeNodes(getKnowledgeRootNodes(), 1);
  ensureKnowledgeExpandedDefaults();
  errors.forEach(item => {
    if (ensureKnowledgeBindingForError(item)) changed = true;
  });
  const allNodes = collectKnowledgeNodes();
  if ((!selectedKnowledgeNodeId || !getKnowledgeNodeById(selectedKnowledgeNodeId)) && allNodes.length > 0) {
    selectedKnowledgeNodeId = allNodes[0].id;
  }
  if (changed) {
    knowledgeErrorCountCacheVersion += 1;
  }
  syncKnowledgeNotesFromTree();
  if (options.persist && changed) {
    saveData();
  }
  if (options.persist) {
    saveKnowledgeState();
  }
}
function findKnowledgeBranchForModal(createIfMissing) {
  const pathTitles = getEntryPathTitlesFromForm();
  if (!pathTitles.length) return null;
  if (createIfMissing) {
    return ensureKnowledgePathByTitles(pathTitles);
  }
  return getKnowledgeNodeByPathTitles(pathTitles);
}
function ensureKnowledgeExpandedDefaults() {
  if (knowledgeExpandedLoaded) return;
  knowledgeExpandedLoaded = true;
}
function expandKnowledgePath(nodeId) {
  let current = getKnowledgeNodeById(nodeId);
  while (current) {
    knowledgeExpanded.add(current.id);
    current = findKnowledgeParent(current.id);
  }
  saveKnowledgeExpanded();
}
function isKnowledgeExpanded(node) {
  if (!node || !node.children || !node.children.length) return false;
  return knowledgeExpanded.has(node.id);
}
function toggleKnowledgeExpanded(nodeId, event) {
  if (event) event.stopPropagation();
  const node = getKnowledgeNodeById(nodeId);
  if (!node || !node.children || !node.children.length) return;
  if (knowledgeExpanded.has(node.id)) knowledgeExpanded.delete(node.id);
  else knowledgeExpanded.add(node.id);
  saveKnowledgeExpanded();
  renderSidebar();
}
function syncKnowledgePickerHint(selectedLeafId) {
  const hint = document.getElementById('editKnowledgeHint');
  if (!hint) return;
  const baseTitles = getEntryPathTitlesFromForm();
  const node = selectedLeafId ? getKnowledgeNodeById(selectedLeafId) : null;
  const activeNode = node;
  const pathTitles = activeNode ? collapseKnowledgePathTitles(getKnowledgePathTitles(activeNode.id)).join(' > ') : (baseTitles.join(' > ') || '未分类 > 未分类 > 未细分');
  hint.textContent = activeNode ? `${pathTitles}（已手动选择具体节点）` : `${pathTitles}（保存时按题目分类自动挂载）`;
}
function refreshKnowledgePicker(preferredId) {
  ensureKnowledgeState();
  const select = document.getElementById('editKnowledgeLeaf');
  if (!select) return;
  const nodes = getKnowledgeAssignableNodesForTitles(getEntryPathTitlesFromForm());
  const options = ['<option value="">默认按1-4级自动挂载</option>']
    .concat(nodes.map(node => `<option value="${node.id}">${escapeHtml(collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' > '))}</option>`));
  select.innerHTML = options.join('');
  if (preferredId && nodes.some(node => node.id === preferredId)) {
    select.value = preferredId;
  } else if (nodes.length === 1) {
    select.value = nodes[0].id;
  } else {
    select.value = '';
  }
  syncKnowledgePickerHint(select.value);
}
function createKnowledgeLeafFromModal() {
  const branch = findKnowledgeBranchForModal(true);
  if (!branch) {
    showToast('请先填写至少 1级 和 2级', 'warning');
    return;
  }
  const fallback = getKnowledgeLeafDefaultTitle(
    getEntryClassificationTripleFromForm().type,
    getEntryClassificationTripleFromForm().subtype,
    getEntryClassificationTripleFromForm().subSubtype
  );
  openKnowledgeNodeModal('create-child', {
    parentId: branch.id,
    fallbackTitle: fallback,
    afterSubmit: node => refreshKnowledgePicker(node.id)
  });
}
function resolveKnowledgeNodeIdForSave(pathTitles) {
  const select = document.getElementById('editKnowledgeLeaf');
  const selectedId = select ? select.value : '';
  const selectedNode = selectedId ? getKnowledgeNodeById(selectedId) : null;
  if (selectedNode && doesKnowledgeNodeMatchPathTitles(selectedNode.id, pathTitles)) {
    ensureKnowledgeNoteRecord(selectedNode);
    selectedKnowledgeNodeId = selectedNode.id;
    return selectedNode.id;
  }
  const targetNode = ensureKnowledgePathByTitles(pathTitles);
  ensureKnowledgeNoteRecord(targetNode);
  selectedKnowledgeNodeId = targetNode.id;
  if (select) refreshKnowledgePicker(targetNode.id);
  return targetNode.id;
}
function setCurrentKnowledgeNode(nodeId, opts) {
  const options = opts || {};
  if (!nodeId) return;
  const resolvedId = resolveKnowledgeDisplayNodeId(nodeId);
  if (options.expandPath !== false) {
    expandKnowledgePath(resolvedId);
  }
  selectedKnowledgeNodeId = resolvedId;
  knowledgeNodeFilter = options.applyFilter === false ? knowledgeNodeFilter : resolvedId;
  typeFilter = null;
  noteEditing = false;
  if (options.switchTab !== false) {
    switchTab('notes');
  } else {
    renderSidebar();
    renderAll();
    renderNotesByType();
  }
}
function filterByKnowledgeNode(nodeId) {
  setCurrentKnowledgeNode(nodeId, { switchTab: true });
}
function selectKnowledgeNodeFromSidebar(nodeId) {
  setCurrentKnowledgeNode(nodeId, { switchTab: true });
}
function selectKnowledgeLeaf(nodeId) {
  if (!nodeId) return;
  saveNoteTypeContent();
  setCurrentKnowledgeNode(nodeId, { switchTab: false });
}
function selectKnowledgeBranch(nodeId, event) {
  if (event) event.stopPropagation();
  if (!nodeId) return;
  saveNoteTypeContent();
  setCurrentKnowledgeNode(nodeId, { switchTab: false, expandPath: false });
}
function addKnowledgeLeafUnderSelected() {
  ensureKnowledgeState();
  const current = getKnowledgeNodeById(selectedKnowledgeNodeId);
  const parent = current || findKnowledgeBranchForModal(true);
  const fallback = parent && parent.title ? `${parent.title}补充` : '新知识点';
  openKnowledgeNodeModal('create-child', { parentId: parent.id, fallbackTitle: fallback });
}
function getKnowledgePathOptions(leafOnly, excludeNodeId) {
  const options = [];
  function walk(nodes, trail) {
    (nodes || []).forEach(node => {
      const currentTrail = collapseKnowledgePathTitles(trail.concat(node.title));
      const pathLabel = currentTrail.join(' > ');
      if ((!leafOnly || node.isLeaf) && node.id !== excludeNodeId) {
        options.push({ id: node.id, label: pathLabel, node });
      }
      if (node.children && node.children.length) {
        walk(node.children, currentTrail);
      }
    });
  }
  walk(getKnowledgeRootNodes(), []);
  return options;
}
function chooseKnowledgeNodeByPrompt(leafOnly, excludeNodeId) {
  const options = getKnowledgePathOptions(leafOnly, excludeNodeId);
  if (!options.length) {
    showToast(leafOnly ? '暂无可选知识点叶子' : '暂无可选知识点节点', 'warning');
    return null;
  }
  const text = options.map((item, idx) => `${idx + 1}. ${item.label}`).join('\n');
  const answer = prompt(`输入编号选择${leafOnly ? '目标叶子' : '目标父节点'}：\n\n${text}`, '1');
  if (answer === null) return null;
  const picked = options[Number(answer) - 1];
  if (!picked) {
    showToast('选择无效', 'error');
    return null;
  }
  return picked;
}
function isKnowledgeDescendant(nodeId, targetId) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return false;
  return getKnowledgeDescendantNodeIds(node).includes(targetId);
}
function getKnowledgeNodeModalTargetOptions(nodeId) {
  return getKnowledgePathOptions(false, nodeId).filter(item => !isKnowledgeDescendant(nodeId, item.id));
}
function openKnowledgeNodeModal(mode, opts) {
  ensureKnowledgeState();
  knowledgeNodeModalState = Object.assign({
    mode,
    nodeId: null,
    parentId: null,
    targetId: null,
    fallbackTitle: '',
    afterSubmit: null
  }, opts || {});
  const titleEl = document.getElementById('knowledgeNodeModalTitle');
  const subtitleEl = document.getElementById('knowledgeNodeModalSubtitle');
  const titleGroup = document.getElementById('knowledgeNodeTitleGroup');
  const titleLabel = document.getElementById('knowledgeNodeTitleLabel');
  const titleInput = document.getElementById('knowledgeNodeTitleInput');
  const targetGroup = document.getElementById('knowledgeNodeTargetGroup');
  const searchInput = document.getElementById('knowledgeNodeTargetSearch');
  if (!titleEl || !subtitleEl || !titleGroup || !titleLabel || !titleInput || !targetGroup || !searchInput) return;

  const node = knowledgeNodeModalState.nodeId ? getKnowledgeNodeById(knowledgeNodeModalState.nodeId) : null;
  const parent = knowledgeNodeModalState.parentId ? getKnowledgeNodeById(knowledgeNodeModalState.parentId) : null;

  if (mode === 'rename') {
    if (!node) return;
    titleEl.textContent = '重命名知识点';
    subtitleEl.textContent = `当前节点：${collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' > ')}`;
    titleLabel.textContent = '新的节点名称';
    titleInput.value = node ? node.title : '';
    titleGroup.style.display = '';
    targetGroup.style.display = 'none';
  } else if (mode === 'move') {
    if (!node) return;
    titleEl.textContent = '移动知识点';
    subtitleEl.textContent = `当前节点：${collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' > ')}。请选择新的父节点。`;
    titleGroup.style.display = 'none';
    targetGroup.style.display = '';
    searchInput.value = '';
    knowledgeNodeModalState.targetId = null;
    renderKnowledgeNodeTargetOptions();
  } else {
    if (!parent) return;
    titleEl.textContent = '新建下级知识点';
    subtitleEl.textContent = `父节点：${collapseKnowledgePathTitles(getKnowledgePathTitles(parent.id)).join(' > ')}`;
    titleLabel.textContent = '知识点名称';
    titleInput.value = knowledgeNodeModalState.fallbackTitle || '';
    titleGroup.style.display = '';
    targetGroup.style.display = 'none';
  }

  openModal('knowledgeNodeModal');
  setTimeout(() => {
    if (mode === 'move') searchInput.focus();
    else titleInput.focus();
    if (mode !== 'move') titleInput.select();
  }, 10);
}
window.openKnowledgeNodeModal = openKnowledgeNodeModal;
function closeKnowledgeNodeModal() {
  knowledgeNodeModalState = { mode: '', nodeId: null, parentId: null, targetId: null, fallbackTitle: '' };
  closeModal('knowledgeNodeModal');
}
function handleKnowledgeNodeTitleKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitKnowledgeNodeModal();
  }
}
function renderKnowledgeNodeTargetOptions() {
  const list = document.getElementById('knowledgeNodeTargetList');
  const searchInput = document.getElementById('knowledgeNodeTargetSearch');
  if (!list || !searchInput || knowledgeNodeModalState.mode !== 'move') return;
  const keyword = searchInput.value.trim().toLowerCase();
  const filtered = getKnowledgeNodeModalTargetOptions(knowledgeNodeModalState.nodeId).filter(item => {
    if (!keyword) return true;
    return item.label.toLowerCase().includes(keyword) || item.node.title.toLowerCase().includes(keyword);
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="knowledge-move-empty">没有匹配的目标知识点</div>';
    return;
  }
  list.innerHTML = filtered.map(item => {
    const active = knowledgeNodeModalState.targetId === item.id ? ' active' : '';
    return `<div class="knowledge-move-item${active}" onclick="selectKnowledgeNodeModalTarget('${item.id}')">
      <div class="knowledge-move-item-title">${escapeHtml(item.node.title)}</div>
      <div class="knowledge-move-item-path">${escapeHtml(item.label)}</div>
    </div>`;
  }).join('');
}
function selectKnowledgeNodeModalTarget(nodeId) {
  knowledgeNodeModalState.targetId = nodeId;
  renderKnowledgeNodeTargetOptions();
}
function submitKnowledgeNodeModal() {
  const state = knowledgeNodeModalState || {};
  if (state.mode === 'rename') {
    const node = getKnowledgeNodeById(state.nodeId);
    if (!node) return;
    const nextTitle = document.getElementById('knowledgeNodeTitleInput')?.value || '';
    const title = normalizeKnowledgeTitle(nextTitle, node.title);
    if (title === node.title) {
      closeKnowledgeNodeModal();
      return;
    }
    const parent = findKnowledgeParent(node.id);
    const siblings = parent ? (parent.children || []) : getKnowledgeRootNodes();
    if (siblings.some(item => item.id !== node.id && item.title === title)) {
      showToast('同级下已存在同名节点', 'error');
      return;
    }
    node.title = title;
    node.updatedAt = new Date().toISOString();
    saveKnowledgeState();
    closeKnowledgeNodeModal();
    showToast('节点已重命名', 'success');
    renderSidebar();
    renderNotesByType();
    return;
  }
  if (state.mode === 'move') {
    if (!state.targetId) {
      showToast('请选择目标父节点', 'warning');
      return;
    }
    const moved = moveKnowledgeNodeToTarget(state.nodeId, state.targetId, { silent: false });
    if (moved) closeKnowledgeNodeModal();
    return;
  }
  const parent = getKnowledgeNodeById(state.parentId);
  if (!parent) return;
  const rawTitle = document.getElementById('knowledgeNodeTitleInput')?.value || '';
  const title = normalizeKnowledgeTitle(rawTitle, state.fallbackTitle || '新知识点');
  if ((parent.children || []).some(item => item.title === title)) {
    showToast('同级下已存在同名节点', 'error');
    return;
  }
  const child = ensureKnowledgeChild(parent.children, title, (parent.level || 1) + 1, true);
  if (!child.contentMd) {
    child.contentMd = `# ${child.title}\n\n`;
    child.updatedAt = new Date().toISOString();
  }
  parent.isLeaf = false;
  ensureKnowledgeNoteRecord(child);
  expandKnowledgePath(parent.id);
  saveKnowledgeState();
  closeKnowledgeNodeModal();
  if (typeof state.afterSubmit === 'function') state.afterSubmit(child);
  setCurrentKnowledgeNode(child.id, { switchTab: false });
  showToast(`已新建知识点：${child.title}`, 'success');
}
function renameKnowledgeNode(nodeId) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return;
  openKnowledgeNodeModal('rename', { nodeId: node.id });
}
function moveKnowledgeNodeToTarget(nodeId, targetId, opts) {
  const node = getKnowledgeNodeById(nodeId);
  const target = getKnowledgeNodeById(targetId);
  if (!node || !target) return false;
  if (node.id === target.id) {
    showToast('不能移动到自己', 'warning');
    return false;
  }
  if (isKnowledgeDescendant(node.id, target.id)) {
    showToast('不能移动到自己的下级节点', 'error');
    return false;
  }
  const oldParent = findKnowledgeParent(node.id);
  if (!oldParent) {
    showToast('一级节点暂不支持移动', 'warning');
    return false;
  }
  target.children = target.children || [];
  if (target.children.some(item => item.id !== node.id && item.title === node.title)) {
    showToast('目标节点下已存在同名节点', 'error');
    return false;
  }
  const oldList = oldParent.children || [];
  const idx = oldList.findIndex(item => item.id === node.id);
  if (idx < 0) return false;
  oldList.splice(idx, 1);
  target.children.push(node);
  oldParent.isLeaf = oldList.length === 0;
  target.isLeaf = false;
  expandKnowledgePath(target.id);
  saveKnowledgeState();
  if (!opts || !opts.silent) showToast(`节点已移动到：${collapseKnowledgePathTitles(getKnowledgePathTitles(target.id)).join(' > ')}`, 'success');
  setCurrentKnowledgeNode(node.id, { switchTab: false });
  return true;
}
function moveKnowledgeNode(nodeId) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return;
  if (!getKnowledgeNodeModalTargetOptions(nodeId).length) {
    showToast('暂无可移动到的目标节点', 'warning');
    return;
  }
  openKnowledgeNodeModal('move', { nodeId: node.id });
}
function deleteSelectedKnowledgeNode() {
  const currentNode =
    getCurrentKnowledgeNode() ||
    (selectedKnowledgeNodeId ? getKnowledgeNodeById(selectedKnowledgeNodeId) : null) ||
    getKnowledgeRootNodes()[0];
  if (!currentNode) {
    showToast('当前没有可删除的知识点', 'warning');
    return;
  }
  deleteKnowledgeNode(currentNode.id);
}
function shouldAutoUnwrapKnowledgeNode(node, expectedTitle) {
  if (!node || node.title !== expectedTitle) return false;
  if (!Array.isArray(node.children) || !node.children.length) return false;
  const hasOwnContent = !!String(node.contentMd || '').trim();
  const hasOwnDirectErrors = errors.some(item => item.noteNodeId === node.id);
  return !hasOwnContent && !hasOwnDirectErrors;
}
function unwrapPromotedKnowledgeChildren(children, removedTitle) {
  let next = Array.isArray(children) ? children.slice() : [];
  while (next.length === 1 && shouldAutoUnwrapKnowledgeNode(next[0], removedTitle)) {
    const wrapper = next[0];
    knowledgeExpanded.delete(wrapper.id);
    removeKnowledgeNoteEntry(wrapper.id);
    next = (wrapper.children || []).slice();
  }
  return next;
}
function deleteKnowledgeNode(nodeId) {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return;
  const parent = findKnowledgeParent(nodeId);
  const isRootNode = !parent;
  const roots = getKnowledgeRootNodes();
  const siblings = parent ? (parent.children || []) : roots;
  const directErrors = errors.filter(item => item.noteNodeId === node.id);
  const childCount = (node.children || []).length;
  const noteFlag = (node.contentMd || '').trim() ? '\n- 当前节点有笔记内容' : '';
  const childFlag = childCount ? `\n- 当前节点有 ${childCount} 个下级，删除后会自动提升到当前层级` : '';
  const errorFlag = directErrors.length ? `\n- 当前节点直属挂了 ${directErrors.length} 道错题，删除后会自动改挂到其他知识点或未归属` : '';
  const ok = confirm(`确认删除知识点「${node.title}」吗？${noteFlag}${childFlag}${errorFlag}\n\n此操作不可撤销。`);
  if (!ok) return;
  if (isRootNode) {
    const secondOk = confirm(`你正在删除一级知识点「${node.title}」。\n\n这会影响整组知识树结构和挂载错题，请再次确认。`);
    if (!secondOk) return;
  }
  const idx = siblings.findIndex(item => item.id === node.id);
  if (idx < 0) return;
  const promotedChildren = unwrapPromotedKnowledgeChildren(node.children || [], node.title);
  const fallbackTargetId = parent
    ? parent.id
    : (promotedChildren[0]?.id || siblings[idx - 1]?.id || siblings[idx + 1]?.id || '');
  directErrors.forEach(item => {
    item.noteNodeId = fallbackTargetId || '';
    item.updatedAt = new Date().toISOString();
  });
  siblings.splice(idx, 1, ...promotedChildren);
  if (parent) {
    parent.isLeaf = siblings.length === 0;
  }
  removeKnowledgeNoteEntry(node.id);
  knowledgeExpanded.delete(node.id);
  saveKnowledgeExpanded();
  if (knowledgeNodeFilter === node.id) knowledgeNodeFilter = null;
  if (selectedKnowledgeNodeId === node.id) {
    selectedKnowledgeNodeId = fallbackTargetId || promotedChildren[0]?.id || siblings[0]?.id || null;
  }
  saveData();
  saveKnowledgeState();
  renderSidebar();
  renderAll();
  renderNotesByType();
  showToast(`已删除知识点：${node.title}`, 'success');
}
function assignErrorToKnowledgeNode(errorId, targetNodeId, opts) {
  const errorItem = errors.find(item => item.id === errorId);
  const targetNode = getKnowledgeNodeById(targetNodeId);
  if (!errorItem || !targetNode) return false;
  const previousNodeId = errorItem.noteNodeId || null;
  errorItem.noteNodeId = targetNode.id;
  errorItem.updatedAt = new Date().toISOString();
  recordErrorUpsert(errorItem);
  saveData();
  saveKnowledgeState();
  if (opts && opts.focusNode) {
    setCurrentKnowledgeNode(targetNode.id, { switchTab: false });
  } else {
    renderSidebar();
    renderAll();
    renderNotesByType();
  }
  if (!opts || !opts.silent) {
    if (previousNodeId && knowledgeNodeFilter === previousNodeId && previousNodeId !== targetNode.id) {
      showToast(`已改挂载到：${collapseKnowledgePathTitles(getKnowledgePathTitles(targetNode.id)).join(' > ')}，该题已移出原知识点视图。`, 'success');
    } else {
      showToast(`已改挂载到：${collapseKnowledgePathTitles(getKnowledgePathTitles(targetNode.id)).join(' > ')}`, 'success');
    }
  }
  return true;
}
function startKnowledgeNodeDrag(nodeId, event) {
  draggingKnowledgeNodeId = nodeId;
  draggingErrorId = null;
  if (event && event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `knowledge-node:${nodeId}`);
  }
  const el = document.querySelector(`[data-knowledge-node-id="${nodeId}"]`);
  if (el) el.classList.add('knowledge-dragging');
}
function endKnowledgeNodeDrag() {
  draggingKnowledgeNodeId = null;
  document.querySelectorAll('.knowledge-dragging').forEach(el => el.classList.remove('knowledge-dragging'));
  document.querySelectorAll('.knowledge-drop-over').forEach(el => el.classList.remove('knowledge-drop-over'));
}
function startErrorDrag(errorId, event) {
  draggingErrorId = errorId;
  draggingKnowledgeNodeId = null;
  if (event && event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `knowledge-error:${errorId}`);
  }
}
function endErrorDrag() {
  draggingErrorId = null;
  document.querySelectorAll('.knowledge-drop-over').forEach(el => el.classList.remove('knowledge-drop-over'));
}
function allowKnowledgeDrop(event, nodeId) {
  if (!draggingKnowledgeNodeId && !draggingErrorId) return;
  event.preventDefault();
  const el = document.querySelector(`[data-knowledge-node-id="${nodeId}"]`);
  if (el) el.classList.add('knowledge-drop-over');
}
function leaveKnowledgeDrop(event) {
  if (event && event.currentTarget) event.currentTarget.classList.remove('knowledge-drop-over');
}
function handleKnowledgeDrop(nodeId, event) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll('.knowledge-drop-over').forEach(el => el.classList.remove('knowledge-drop-over'));
  if (draggingKnowledgeNodeId) {
    moveKnowledgeNodeToTarget(draggingKnowledgeNodeId, nodeId);
    endKnowledgeNodeDrag();
    return;
  }
  if (draggingErrorId) {
    assignErrorToKnowledgeNode(draggingErrorId, nodeId, { focusNode: true });
    endErrorDrag();
  }
}
function moveErrorToKnowledgeNode(errorId, preferredNodeId) {
  const targetId = normalizeErrorId(errorId);
  const errorItem = findErrorById(targetId);
  if (!errorItem) return;
  pendingKnowledgeMoveErrorIds = [targetId];
  pendingKnowledgeMoveErrorId = targetId;
  pendingKnowledgeMoveTargetId = preferredNodeId || errorItem.noteNodeId || null;
  const currentText = errorItem.noteNodeId
    ? collapseKnowledgePathTitles(getKnowledgePathTitles(errorItem.noteNodeId)).join(' > ')
    : '未关联知识点';
  const currentEl = document.getElementById('knowledgeMoveCurrent');
  if (currentEl) currentEl.textContent = `当前知识点：${currentText}`;
  const search = document.getElementById('knowledgeMoveSearch');
  if (search) search.value = '';
  renderKnowledgeMoveOptions();
  openModal('knowledgeMoveModal');
}
function openBatchKnowledgeMove() {
  if (!batchSelected.size) {
    showToast('请先勾选题目', 'warning');
    return;
  }
  pendingKnowledgeMoveErrorIds = Array.from(batchSelected).map(id => normalizeErrorId(id));
  pendingKnowledgeMoveErrorId = pendingKnowledgeMoveErrorIds[0] || null;
  pendingKnowledgeMoveTargetId = pendingKnowledgeMoveErrorId ? (getErrorKnowledgeNodeId(pendingKnowledgeMoveErrorId) || null) : null;
  const currentEl = document.getElementById('knowledgeMoveCurrent');
  if (currentEl) currentEl.textContent = `已选 ${pendingKnowledgeMoveErrorIds.length} 题，确认后将统一改挂载`;
  const search = document.getElementById('knowledgeMoveSearch');
  if (search) search.value = '';
  renderKnowledgeMoveOptions();
  openModal('knowledgeMoveModal');
}
window.openBatchKnowledgeMove = openBatchKnowledgeMove;
function closeKnowledgeMoveModal() {
  pendingKnowledgeMoveErrorIds = [];
  pendingKnowledgeMoveErrorId = null;
  pendingKnowledgeMoveTargetId = null;
  closeModal('knowledgeMoveModal');
}
function renderKnowledgeMoveOptions() {
  const list = document.getElementById('knowledgeMoveList');
  if (!list) return;
  const search = (document.getElementById('knowledgeMoveSearch')?.value || '').trim().toLowerCase();
  const options = getKnowledgePathOptions(false, null).filter(item => {
    if (!search) return true;
    return item.label.toLowerCase().includes(search) || item.node.title.toLowerCase().includes(search);
  });
  if (!options.length) {
    list.innerHTML = '<div class="knowledge-move-empty">没有匹配的知识点</div>';
    return;
  }
  list.innerHTML = options.map(item => `
    <div class="knowledge-move-item ${item.id === pendingKnowledgeMoveTargetId ? 'active' : ''}" onclick="selectKnowledgeMoveTarget('${item.id}')">
      <div class="knowledge-move-item-title">${escapeHtml(item.node.title)}</div>
      <div class="knowledge-move-item-path">${escapeHtml(item.label)}</div>
      ${item.id === getErrorKnowledgeNodeId(pendingKnowledgeMoveErrorId) ? '<div class="knowledge-move-item-current">当前挂载</div>' : ''}
    </div>
  `).join('');
}
function selectKnowledgeMoveTarget(nodeId) {
  pendingKnowledgeMoveTargetId = nodeId;
  renderKnowledgeMoveOptions();
}
function getErrorKnowledgeNodeId(errorId) {
  const errorItem = errors.find(item => item.id === errorId);
  return errorItem ? (errorItem.noteNodeId || null) : null;
}
function applyKnowledgeMove() {
  const targetIds = pendingKnowledgeMoveErrorIds.length
    ? pendingKnowledgeMoveErrorIds.slice()
    : (pendingKnowledgeMoveErrorId ? [pendingKnowledgeMoveErrorId] : []);
  const matched = errors.filter(item => targetIds.includes(normalizeErrorId(item.id)));
  if (!matched.length) {
    closeKnowledgeMoveModal();
    return;
  }
  if (!pendingKnowledgeMoveTargetId) {
    showToast('请选择目标知识点', 'warning');
    return;
  }
  const targetNode = getKnowledgeNodeById(pendingKnowledgeMoveTargetId);
  if (!targetNode) {
    showToast('目标知识点无效', 'error');
    return;
  }
  closeKnowledgeMoveModal();
  if (matched.length === 1) {
    assignErrorToKnowledgeNode(matched[0].id, targetNode.id, { focusNode: true });
    return;
  }
  const now = new Date().toISOString();
  matched.forEach(errorItem => {
    errorItem.noteNodeId = targetNode.id;
    errorItem.updatedAt = now;
    recordErrorUpsert(errorItem);
  });
  batchSelected.clear();
  saveData();
  saveKnowledgeState();
  renderSidebar();
  renderAll();
  renderNotesByType();
  updateBatchBar();
  showToast(`已批量改挂载 ${matched.length} 题`, 'success');
}
function openKnowledgeForError(errorId) {
  const errorItem = findErrorById(errorId);
  if (!errorItem || !errorItem.noteNodeId) {
    showToast('当前题目还没有关联知识点', 'warning');
    return;
  }
  setCurrentKnowledgeNode(errorItem.noteNodeId, { switchTab: true });
}
function jumpToErrorInList(errorId) {
  switchTab('errors');
  revealed.add(errorId);
  saveReveal();
  renderAll();
  setTimeout(() => {
    const el = document.getElementById(`card-${errorId}`);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }, 50);
}
function updateKnowledgeWorkspaceChrome(currentNode, linkedCount) {
  const titleEl = document.querySelector('.notes-header h2');
  if (titleEl) titleEl.textContent = currentNode ? `知识工作区 · ${currentNode.title}` : '知识工作区';

  const actionWrap = document.querySelector('.notes-header > div:last-child');
  if (actionWrap) {
    actionWrap.innerHTML = `
      <button class="btn btn-secondary" onclick="openGlobalSearchModal()">全局搜索</button>
      <button class="btn btn-secondary" onclick="switchTab('errors')">题目列表</button>
      <button class="btn btn-secondary" onclick="addKnowledgeLeafUnderSelected()">+ 新建知识点</button>
      ${currentNode ? `<button class="btn btn-secondary" onclick="renameKnowledgeNode('${currentNode.id}')">重命名</button>` : ''}
      ${currentNode && findKnowledgeParent(currentNode.id) ? `<button class="btn btn-secondary" onclick="moveKnowledgeNode('${currentNode.id}')">移动</button>` : ''}
      ${currentNode ? `<button class="btn btn-secondary" onclick="deleteKnowledgeNode('${currentNode.id}')">删除知识点</button>` : ''}
      ${currentNode ? `<button class="btn btn-secondary" onclick="clearNotes()">清空</button>` : ''}
    `;
  }

  const rightHeader = document.querySelector('.notes-panel-right-header h3');
  if (rightHeader) {
    const count = currentNode
      ? countErrorsForKnowledgeNode(currentNode.id, knowledgeRelatedMode !== 'direct')
      : 0;
    const suffix = knowledgeRelatedMode === 'direct' ? '直属' : '含下级';
    rightHeader.textContent = currentNode ? `关联错题 · ${suffix} ${count}` : '关联错题';
  }

  const rightActions = document.querySelector('.notes-panel-right-header > div:last-child');
  if (rightActions) {
    rightActions.innerHTML = `
      <button class="btn btn-sm ${knowledgeRelatedMode === 'direct' ? 'btn-primary' : 'btn-secondary'}" onclick="setKnowledgeRelatedMode('direct')" title="只看直接挂在当前节点的错题">直属</button>
      <button class="btn btn-sm ${knowledgeRelatedMode === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="setKnowledgeRelatedMode('all')" title="查看当前节点及下级节点的错题">含下级</button>
      <button class="btn btn-sm btn-secondary" onclick="knowledgeNodeFilter=null;renderSidebar();renderAll();renderNotesPanelRight()" title="清除节点筛选">全部</button>
      ${currentNode ? `<button class="btn btn-sm btn-secondary" onclick="switchTab('notes')" title="查看当前知识点笔记">笔记</button>` : ''}
    `;
  }
}
function setKnowledgeRelatedMode(mode) {
  if (mode !== 'direct' && mode !== 'all') return;
  if (knowledgeRelatedMode === mode) return;
  knowledgeRelatedMode = mode;
  renderKnowledgeNotesViewV2();
}

// 获取某题型下所有子类型（供添加弹窗下拉用）
function getDirSubs(type) {
  const tree = loadDirTree();
  return tree[type] ? Object.keys(tree[type]) : [];
}
// 获取某子类型下所有三级（供添加弹窗下拉用）
function getDirSub2s(type, sub) {
  const tree = loadDirTree();
  return (tree[type] && tree[type][sub]) ? tree[type][sub] : [];
}

// 添加弹窗：题型切换时刷新子类型下拉
function onTypeChange() {
  updateSubtypeOptions();
  document.getElementById('editSubtype').value='';
  document.getElementById('editSubSubtype').value='';
  refreshKnowledgePicker();
}
function onSubtypeInput() {
  updateSub2Options();
  refreshKnowledgePicker();
}
function updateSubtypeOptions() {
  const type = document.getElementById('editType').value;
  const subs = getDirSubs(type);
  const existing = getExistingSubtypes().subtypes;
  const merged = Array.from(new Set([...subs, ...existing])).sort();
  const el = document.getElementById('editSubtype');
  let dl = document.getElementById('subtypeDatalist');
  if (!dl) { dl=document.createElement('datalist'); dl.id='subtypeDatalist'; document.body.appendChild(dl); }
  dl.innerHTML = merged.map(s=>`<option value="${escapeHtml(s)}">`).join('');
  el.setAttribute('list','subtypeDatalist');
}
function updateSub2Options() {
  const type = document.getElementById('editType').value;
  const sub  = document.getElementById('editSubtype').value.trim();
  const sub2s = getDirSub2s(type, sub);
  const existing = getExistingSubtypes().subSubtypes;
  const merged2 = Array.from(new Set([...sub2s, ...existing])).sort();
  let dl = document.getElementById('sub2Datalist');
  if (!dl) { dl=document.createElement('datalist'); dl.id='sub2Datalist'; document.body.appendChild(dl); }
  dl.innerHTML = merged2.map(s=>`<option value="${escapeHtml(s)}">`).join('');
  document.getElementById('editSubSubtype').setAttribute('list','sub2Datalist');
  refreshKnowledgePicker();
}
