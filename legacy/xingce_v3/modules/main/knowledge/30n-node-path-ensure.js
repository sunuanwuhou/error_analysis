// ============================================================
// Ensure knowledge node paths and leaves
// ============================================================
function ensureKnowledgePathByTitles(pathTitles) {
  const normalizeRootTitle = title => {
    const raw = normalizeKnowledgeTitle(title, '');
    if (!raw) return '';
    if (Array.isArray(FIXED_KNOWLEDGE_ROOTS) && FIXED_KNOWLEDGE_ROOTS.includes(raw)) return raw;
    if (typeof resolveLegacyKnowledgeRootAlias === 'function') {
      const alias = resolveLegacyKnowledgeRootAlias(raw);
      if (alias && FIXED_KNOWLEDGE_ROOTS.includes(alias)) return alias;
    }
    const normalized = typeof normalizeKnowledgeRootTitleForCleanup === 'function'
      ? normalizeKnowledgeRootTitleForCleanup(raw)
      : raw;
    const fixedRoots = Array.isArray(FIXED_KNOWLEDGE_ROOTS) ? FIXED_KNOWLEDGE_ROOTS : [];
    for (let i = 0; i < fixedRoots.length; i += 1) {
      const item = fixedRoots[i];
      const itemNormalized = typeof normalizeKnowledgeRootTitleForCleanup === 'function'
        ? normalizeKnowledgeRootTitleForCleanup(item)
        : item;
      if (normalized === itemNormalized) return item;
    }
    return '常识判断';
  };
  const normalizeCreationTitles = titles => {
    const list = Array.isArray(titles) ? titles.map(item => normalizeKnowledgeTitle(item, '')).filter(Boolean) : [];
    if (!list.length) return [];
    const firstRaw = list[0];
    const rootTitle = normalizeRootTitle(firstRaw);
    const output = [rootTitle];
    // If incoming first title is an alias (e.g. 片段阅读), keep it as level-2 topic under canonical root.
    if (firstRaw && firstRaw !== rootTitle) output.push(firstRaw);
    for (let i = 1; i < list.length; i += 1) {
      const title = list[i];
      if (!title || title === output[output.length - 1]) continue;
      output.push(title);
    }
    return output;
  };
  const titles = normalizeCreationTitles(normalizeKnowledgePathTitles(pathTitles));
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
