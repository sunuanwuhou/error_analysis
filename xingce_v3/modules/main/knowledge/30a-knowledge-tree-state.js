// ============================================================
// Knowledge tree state
// ============================================================
// KEY_DIR_TREE / FIXED_TYPES / FIXED_KNOWLEDGE_ROOTS / DEFAULT_DIR_TREE: shared defaults live in `01-state.js`.
// Split bundles load home before workspace (`v53-bootstrap.js`), so those globals exist before this file runs.

const BAD_KNOWLEDGE_TITLE_RE = /^(?:\?{2,}|未分类\?|未细分\?|知识点\?)$/;

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

function newKnowledgeNodeId() {
  return 'kn_' + Math.random().toString(36).slice(2, 10);
}

function normalizeKnowledgeTitle(value, fallback) {
  const normalizedFallback = String(fallback || '').trim() || '未分类';
  const raw = String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .trim();
  if (!raw) return normalizedFallback;

  let text = raw
    .replace(/^[“”"'‘’`]+/, '')
    .replace(/[“”"'‘’`]+$/, '')
    .trim();
  if (!text) text = raw;

  if (/^\?+$/.test(text)) return normalizedFallback;
  if (BAD_KNOWLEDGE_TITLE_RE.test(text)) return normalizedFallback;
  return text;
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
  // 一级节点允许手动删除：这里只做排序，不再强制补回缺失根节点。
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

function getDirSubs(type) {
  const tree = loadDirTree();
  return tree[type] ? Object.keys(tree[type]) : [];
}

function getDirSub2s(type, sub) {
  const tree = loadDirTree();
  return (tree[type] && tree[type][sub]) ? tree[type][sub] : [];
}
