// ============================================================
// Knowledge tree state
// ============================================================
const KEY_DIR_TREE = 'xc_dir_tree';
const FIXED_TYPES = ["???????", "????", "????", "????", "????", "??"];
const FIXED_KNOWLEDGE_ROOTS = ["???????", "????", "????", "????", "????"];
const DEFAULT_DIR_TREE = {
  "???????": { "????": ["????", "????"] },
  "????": { "????": [] },
  "??": {},
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

function getDirSubs(type) {
  const tree = loadDirTree();
  return tree[type] ? Object.keys(tree[type]) : [];
}

function getDirSub2s(type, sub) {
  const tree = loadDirTree();
  return (tree[type] && tree[type][sub]) ? tree[type][sub] : [];
}
