// ============================================================
// Knowledge cleanup helpers
// ============================================================
function cleanupNoisyRootNodes() {
  const roots = getKnowledgeRootNodes();
  if (!Array.isArray(roots) || !roots.length) return false;
  const remap = new Map([
    ['片段阅读', '言语理解与表达'],
    ['数字推理', '数量关系'],
    ['数学运算', '数量关系'],
    ['和差倍比', '数量关系'],
    ['核心思维-纯笔记', '数量关系'],
    ['比例法', '数量关系'],
    ['混合', '数量关系'],
    ['鸡兔', '数量关系'],
    ['年龄问题', '数量关系'],
    ['容斥', '数量关系'],
    ['数列', '数量关系'],
    ['数推', '数量关系'],
    ['植树问题', '数量关系'],
    ['最不利', '数量关系'],
    ['逻辑判断', '判断推理'],
    ['物理', '常识判断'],
    ['未细分', '其他'],
    ['未分类', '其他']
  ]);
  let changed = false;

  const moveRootIntoCanonicalBranch = (source, targetRootTitle, branchTitle) => {
    if (!source) return false;
    const sourceId = String(source.id || '');
    const branch = ensureKnowledgePathByTitles([targetRootTitle, branchTitle]);
    if (!branch) return false;
    mergeKnowledgeNodeIntoTarget(branch, source);
    branch.level = 2;
    branch.isLeaf = (branch.children || []).length === 0;
    return true;
  };

  const getCanonicalNodeByTitle = title => {
    const normalized = normalizeKnowledgeRootTitleForCleanup(title);
    return roots.find(node => normalizeKnowledgeRootTitleForCleanup(node && node.title) === normalized) || null;
  };
  const isNoisyRoot = (title, noisyTitle) => {
    const text = normalizeKnowledgeRootTitleForCleanup(title);
    const target = normalizeKnowledgeRootTitleForCleanup(noisyTitle);
    return !!text && (text === target || text.includes(target));
  };

  remap.forEach((targetTitle, noisyTitle) => {
    const sourceIdx = roots.findIndex(node => isNoisyRoot(node && node.title, noisyTitle));
    if (sourceIdx < 0) return;
    const source = roots[sourceIdx];
    const sourceId = String(source && source.id || '');
    const shouldNestUnderTarget = noisyTitle !== '未细分' && noisyTitle !== '未分类' && targetTitle !== '其他';

    if (shouldNestUnderTarget && moveRootIntoCanonicalBranch(source, targetTitle, noisyTitle)) {
      roots.splice(sourceIdx, 1);
      removeKnowledgeNoteEntry(sourceId);
      knowledgeExpanded.delete(sourceId);
      changed = true;
      return;
    }

    const target = getCanonicalNodeByTitle(targetTitle);
    const targetId = target ? String(target.id || '') : '';

    (errors || []).forEach(item => {
      if (String((item && item.noteNodeId) || '') === sourceId) {
        rebindErrorToKnowledgeNodeId(item, targetId || '');
      }
    });

    if (target && Array.isArray(source.children) && source.children.length) {
      target.children = (target.children || []).concat(source.children);
      target.isLeaf = false;
    } else if (Array.isArray(source.children) && source.children.length) {
      const insertAt = Math.max(0, sourceIdx + 1);
      roots.splice(insertAt, 0, ...source.children);
    }

    roots.splice(sourceIdx, 1);
    removeKnowledgeNoteEntry(sourceId);
    knowledgeExpanded.delete(sourceId);
    if (selectedKnowledgeNodeId === sourceId) selectedKnowledgeNodeId = targetId || null;
    if (knowledgeNodeFilter === sourceId) knowledgeNodeFilter = targetId || null;
    changed = true;
  });

  return changed;
}

function cleanupForcedKnowledgeNodeByPath(pathTitles) {
  const titles = (pathTitles || []).map(item => String(item || '').trim()).filter(Boolean);
  if (!titles.length) return false;
  const targetNode = getKnowledgeNodeByPathTitles(titles);
  if (!targetNode) return false;
  const parent = findKnowledgeParent(targetNode.id);
  if (!parent || !Array.isArray(parent.children)) return false;

  const siblings = parent.children;
  const idx = siblings.findIndex(item => item && item.id === targetNode.id);
  if (idx < 0) return false;

  const promotedChildren = unwrapPromotedKnowledgeChildren(targetNode.children || [], targetNode.title);
  const fallbackTargetId = parent.id || promotedChildren[0]?.id || siblings[idx - 1]?.id || siblings[idx + 1]?.id || '';

  (errors || []).forEach(item => {
    if (String((item && item.noteNodeId) || '') !== String(targetNode.id || '')) return;
    rebindErrorToKnowledgeNodeId(item, fallbackTargetId || '');
  });

  siblings.splice(idx, 1, ...promotedChildren);
  parent.isLeaf = siblings.length === 0;
  removeKnowledgeNoteEntry(targetNode.id);
  knowledgeExpanded.delete(targetNode.id);

  if (selectedKnowledgeNodeId === targetNode.id) {
    selectedKnowledgeNodeId = fallbackTargetId || promotedChildren[0]?.id || parent.id || null;
  }
  if (knowledgeNodeFilter === targetNode.id) {
    knowledgeNodeFilter = parent.id || null;
  }
  return true;
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
