// ============================================================
// Knowledge path title helpers
// ============================================================
function splitKnowledgePathText(rawPath) {
  return String(rawPath || '')
    .split(/>|\/|→/)
    .map(part => String(part || '').trim())
    .filter(Boolean);
}

function collapseKnowledgePathTitles(titles) {
  return (titles || [])
    .map(title => String(title || '').trim())
    .filter((title, idx, arr) => title && (idx === 0 || title !== arr[idx - 1]));
}

function normalizeKnowledgePathTitles(pathTitles, opts) {
  const options = opts || {};
  const maxDepth = Number(options.maxDepth || 5);
  const fallbackTitles = Array.isArray(options.fallbackTitles) ? options.fallbackTitles : [];
  const seed = Array.isArray(pathTitles) ? pathTitles : [];
  const normalized = collapseKnowledgePathTitles(
    seed
      .map(item => String(item || '').trim())
      .filter(Boolean)
  ).slice(0, Math.max(1, maxDepth));
  if (normalized.length) return normalized;
  return collapseKnowledgePathTitles(
    fallbackTitles
      .map(item => String(item || '').trim())
      .filter(Boolean)
  ).slice(0, Math.max(1, maxDepth));
}

function getEntryTypePathTitles(item) {
  const record = item && typeof item === 'object' ? item : {};
  return normalizeKnowledgePathTitles([
    record.type,
    record.subtype,
    record.subSubtype,
    record.level4 || record.fourthLevel || record.levelFour || record.topic4,
    record.level5 || record.fifthLevel || record.levelFive || record.topic5
  ]);
}

function getEntryKnowledgePathTitles(item, opts) {
  const record = item && typeof item === 'object' ? item : {};
  const options = opts || {};
  const fromType = getEntryTypePathTitles(record);
  if (fromType.length) return fromType;
  const titles = record.knowledgePathTitles;
  if (Array.isArray(titles) || typeof titles === 'string') {
    const fromTitles = normalizeKnowledgePathTitles(
      Array.isArray(titles) ? titles : splitKnowledgePathText(titles),
      { fallbackTitles: options.fallbackTitles || [] }
    );
    if (fromTitles.length) return fromTitles;
  }
  const legacyText = record.knowledgePath || record.knowledgeNodePath || record.notePath || '';
  if (options.allowLegacyPathText !== false && String(legacyText || '').trim()) {
    const fromLegacyText = normalizeKnowledgePathTitles(splitKnowledgePathText(legacyText), {
      fallbackTitles: options.fallbackTitles || []
    });
    if (fromLegacyText.length) return fromLegacyText;
  }
  return normalizeKnowledgePathTitles([], { fallbackTitles: options.fallbackTitles || [] });
}
