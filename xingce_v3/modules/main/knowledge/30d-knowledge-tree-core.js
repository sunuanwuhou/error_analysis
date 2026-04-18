// ============================================================
// Knowledge tree core helpers
// ============================================================

function getKnowledgePathOptions(leafOnly, excludeNodeId) {
  const options = [];
  function walkPathNodes(nodes, trail) {
    (nodes || []).forEach(node => {
      const currentTrail = collapseKnowledgePathTitles(trail.concat(node.title));
      const pathLabel = currentTrail.join(' > ');
      if ((!leafOnly || node.isLeaf) && node.id !== excludeNodeId) {
        options.push({ id: node.id, label: pathLabel, node });
      }
      if (node.children && node.children.length) {
        walkPathNodes(node.children, currentTrail);
      }
    });
  }
  walkPathNodes(getKnowledgeRootNodes(), []);
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
