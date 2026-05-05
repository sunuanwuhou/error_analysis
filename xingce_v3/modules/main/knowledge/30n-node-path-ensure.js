// ============================================================
// Ensure knowledge node paths and leaves
// ============================================================
function ensureKnowledgePathByTitles(pathTitles) {
  const titles = normalizeKnowledgePathTitles(pathTitles);
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
