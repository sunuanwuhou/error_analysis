// ============================================================
// Legacy knowledge path normalization helpers
// ============================================================
function normalizeKnowledgeRootTitleForCleanup(title) {
  return String(title || '')
    .replace(/\uFEFF/g, '')
    .replace(/\u200B/g, '')
    .replace(/\u00A0/g, '')
    .replace(/[()（）【】\[\]·•,，.:：;；!?！？]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

const LEGACY_KNOWLEDGE_ROOT_ALIAS_ENTRIES = [
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
  ['物理', '常识判断']
];

function getLegacyKnowledgeRootAliasMap(includePlaceholderRoots) {
  const aliases = new Map(LEGACY_KNOWLEDGE_ROOT_ALIAS_ENTRIES);
  if (includePlaceholderRoots) {
    aliases.set('未细分', '其他');
    aliases.set('未分类', '其他');
  }
  return aliases;
}

function resolveLegacyKnowledgeRootAlias(title) {
  const aliases = getLegacyKnowledgeRootAliasMap(false);
  return aliases.get(normalizeKnowledgeRootTitleForCleanup(title)) || '';
}

function isPlaceholderKnowledgeRootTitle(title) {
  const normalized = normalizeKnowledgeRootTitleForCleanup(title);
  return normalized === '未细分' || normalized === '未分类';
}

function normalizeLegacyKnowledgePathConfig(type, subtype, subSubtype) {
  let rootTitle = normalizeKnowledgeTitle(type, '未分类');
  let subTitle = normalizeKnowledgeTitle(subtype, '未分类');
  let sub2Title = normalizeKnowledgeTitle(subSubtype, '未细分');

  const rootAlias = resolveLegacyKnowledgeRootAlias(rootTitle);
  if (rootAlias) {
    rootTitle = rootAlias;
    if (!String(subtype || '').trim() || isPlaceholderKnowledgeRootTitle(subTitle)) {
      subTitle = normalizeKnowledgeTitle(type, '未分类');
    }
  }

  if (isPlaceholderKnowledgeRootTitle(rootTitle) || !FIXED_TYPES.includes(rootTitle)) {
    const subAlias = resolveLegacyKnowledgeRootAlias(subTitle);
    if (subAlias) {
      rootTitle = subAlias;
    }
  }

  if ((isPlaceholderKnowledgeRootTitle(rootTitle) || rootTitle === '其他') && isPlaceholderKnowledgeRootTitle(subTitle)) {
    const sub2Alias = resolveLegacyKnowledgeRootAlias(sub2Title);
    if (sub2Alias) {
      rootTitle = sub2Alias;
      subTitle = normalizeKnowledgeTitle(subSubtype, '未分类');
    }
  }

  if (isPlaceholderKnowledgeRootTitle(rootTitle)) {
    rootTitle = '其他';
  }

  return { rootTitle, subTitle, sub2Title };
}

function getKnowledgePathConfig(type, subtype, subSubtype) {
  return normalizeLegacyKnowledgePathConfig(type, subtype, subSubtype);
}
