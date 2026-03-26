(function () {
  function renderSidebarKnowledgeTreeV2(nodes, depth) {
    return (nodes || []).map(function (node) {
      var active = selectedKnowledgeNodeId === node.id || knowledgeNodeFilter === node.id;
      var count = countErrorsForKnowledgeNode(node.id, true);
      var cls = depth === 0 ? "nav-item nav-type-header" : depth === 1 ? "nav-item nav-subtype" : "nav-item nav-sub2";
      var extraStyle = depth > 2 ? "padding-left:" + (60 + ((depth - 2) * 18)) + "px" : "";
      var hasChildren = !!(node.children && node.children.length);
      var expanded = hasChildren && isKnowledgeExpanded(node);
      var marker = hasChildren ? (expanded ? "▾" : "▸") : "·";
      var countClass = count > 0 ? "knowledge-tree-count" : "knowledge-tree-count is-empty";
      var html = "<div class=\"" + cls + " knowledge-tree-node " + (active ? "active is-active" : "") + " " + (hasChildren ? "is-branch" : "") + "\" style=\"" + extraStyle + "\" data-knowledge-node-id=\"" + node.id + "\" draggable=\"true\" ondragstart=\"startKnowledgeNodeDrag('" + node.id + "', event)\" ondragend=\"endKnowledgeNodeDrag()\" ondragover=\"allowKnowledgeDrop(event, '" + node.id + "')\" ondragleave=\"leaveKnowledgeDrop(event)\" ondrop=\"handleKnowledgeDrop('" + node.id + "', event)\" onclick=\"selectKnowledgeNodeFromSidebar('" + node.id + "')\">" +
        "<span class=\"knowledge-tree-row\">" +
          "<button type=\"button\" class=\"knowledge-tree-toggle" + (hasChildren ? "" : " placeholder") + "\" onclick=\"toggleKnowledgeExpanded('" + node.id + "', event)\" aria-label=\"" + (hasChildren ? "切换展开" : "无下级") + "\">" + marker + "</button>" +
          "<span class=\"knowledge-tree-title\">" + escapeHtml(node.title) + "</span>" +
        "</span>" +
        "<span class=\"" + countClass + "\">" + count + "</span>" +
      "</div>";
      if (hasChildren && expanded) {
        html += "<div class=\"knowledge-tree-children\">" + renderSidebarKnowledgeTreeV2(node.children, depth + 1) + "</div>";
      }
      return html;
    }).join("");
  }

  function setKnowledgeRelatedMode(mode) {
    if (mode !== "direct" && mode !== "all") return;
    knowledgeRelatedMode = mode;
    if (typeof renderNotesByType === "function") {
      renderNotesByType();
    }
  }

  function updateKnowledgeWorkspaceChrome() {
    return;
  }

  function renderKnowledgeNotesPanelRight() {
    var body = document.getElementById("notesPanelRightBody");
    if (body) body.innerHTML = "";
  }

  window.renderSidebarKnowledgeTreeV2 = renderSidebarKnowledgeTreeV2;
  window.setKnowledgeRelatedMode = setKnowledgeRelatedMode;
  window.updateKnowledgeWorkspaceChrome = updateKnowledgeWorkspaceChrome;
  window.renderKnowledgeNotesPanelRight = renderKnowledgeNotesPanelRight;
  window.renderNotesPanelRight = function () {
    renderKnowledgeNotesPanelRight();
  };
})();
