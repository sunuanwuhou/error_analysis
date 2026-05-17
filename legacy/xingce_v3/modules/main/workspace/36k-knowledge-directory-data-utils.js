// ============================================================
// Knowledge workspace directory data helpers
// ============================================================
function kwCollectNodeErrors(currentNode, filteredItems) {
  if (!currentNode) return [];
  var nodeIds = getKnowledgeDescendantNodeIds(currentNode);
  return (filteredItems || []).filter(function (item) {
    var nodeId = typeof resolveErrorKnowledgeNodeId === "function"
      ? resolveErrorKnowledgeNodeId(item)
      : String(item.noteNodeId || "");
    return nodeIds.includes(nodeId);
  });
}

function kwIsTopLevelKnowledgeNode(node) {
  if (!node || !node.id) return false;
  return !findKnowledgeParent(node.id);
}

function kwCollectDirectorySections(currentNode, normalizeMarkdown) {
  if (!currentNode) return [];
  var sections = [];
  var childNodes = (currentNode.children || []).slice();
  childNodes.forEach(function (node) {
    if (!node) return;
    var markdown = typeof normalizeMarkdown === "function"
      ? normalizeMarkdown(node.contentMd).trim()
      : String(node.contentMd || "").trim();
    var childCount = countErrorsForKnowledgeNode(node.id, true);
    var hasChildren = !!(node.children && node.children.length);
    if (!markdown && !hasChildren) return;
    sections.push({
      nodeId: node.id,
      title: node.title || "",
      pathText: collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(" > "),
      hasContent: !!markdown,
      hasChildren: hasChildren,
      childCount: childCount
    });
  });
  return sections;
}

function kwBuildDirectoryTree(node, normalizeMarkdown) {
  if (!node) return null;
  var markdown = typeof normalizeMarkdown === "function"
    ? normalizeMarkdown(node.contentMd).trim()
    : String(node.contentMd || "").trim();
  var children = (node.children || []).map(function (child) {
    return kwBuildDirectoryTree(child, normalizeMarkdown);
  }).filter(Boolean);
  var childCount = countErrorsForKnowledgeNode(node.id, true);
  if (!markdown && !children.length) return null;
  return {
    nodeId: node.id,
    title: node.title || "",
    pathText: collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(" > "),
    hasContent: !!markdown,
    childCount: childCount,
    children: children
  };
}

function kwFlattenDirectoryTree(tree) {
  var list = [];
  (tree || []).forEach(function walkTree(node, depth) {
    if (!node) return;
    list.push({
      nodeId: node.nodeId,
      title: node.title,
      pathText: node.pathText,
      hasContent: node.hasContent,
      childCount: node.childCount,
      depth: depth || 0
    });
    (node.children || []).forEach(function (child) {
      walkTree(child, (depth || 0) + 1);
    });
  });
  return list;
}

function kwPickDirectoryPreviewNodeId(sections, preferredId) {
  var preferred = String(preferredId || "").trim();
  if (preferred) {
    var hit = (sections || []).find(function (section) { return section.nodeId === preferred; });
    if (hit) return hit.nodeId;
  }
  var firstWithContent = (sections || []).find(function (section) { return section.hasContent; });
  var fallback = firstWithContent || (sections || [])[0];
  return fallback ? String(fallback.nodeId || "") : "";
}
