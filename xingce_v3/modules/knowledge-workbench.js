(function () {
  function renderRelatedErrorOptions(options) {
    const raw = (options || "").trim();
    if (!raw) return "";
    const parts = raw.split(/\s*\|\s*/).map(item => item.trim()).filter(Boolean);
    if (!parts.length) return "";
    return `<div class="related-error-options">${parts.map(item => `<div class="related-error-option">${escapeHtml(item)}</div>`).join("")}</div>`;
  }

  function renderRelatedErrorMeta(label, value) {
    const text = (value || "").trim();
    if (!text) return "";
    return `<div class="related-error-meta"><strong>${escapeHtml(label)}</strong>${escapeHtml(text)}</div>`;
  }

  function renderSidebarKnowledgeTreeV2(nodes, depth) {
    return (nodes || []).map(node => {
      const active = selectedKnowledgeNodeId === node.id || knowledgeNodeFilter === node.id;
      const count = countErrorsForKnowledgeNode(node.id, true);
      const cls = depth === 0 ? "nav-item nav-type-header" : depth === 1 ? "nav-item nav-subtype" : "nav-item nav-sub2";
      const extraStyle = depth > 2 ? `padding-left:${60 + ((depth - 2) * 18)}px` : "";
      const hasChildren = !!(node.children && node.children.length);
      const expanded = hasChildren && isKnowledgeExpanded(node);
      const marker = hasChildren ? (expanded ? "▾" : "▸") : "•";
      const countClass = count > 0 ? "knowledge-tree-count" : "knowledge-tree-count is-empty";
      let html = `<div class="${cls} knowledge-tree-node ${active ? "active is-active" : ""} ${hasChildren ? "is-branch" : ""}" style="${extraStyle}" data-knowledge-node-id="${node.id}" draggable="true" ondragstart="startKnowledgeNodeDrag('${node.id}', event)" ondragend="endKnowledgeNodeDrag()" ondragover="allowKnowledgeDrop(event, '${node.id}')" ondragleave="leaveKnowledgeDrop(event)" ondrop="handleKnowledgeDrop('${node.id}', event)" onclick="selectKnowledgeNodeFromSidebar('${node.id}')">
        <span class="knowledge-tree-row">
          <button type="button" class="knowledge-tree-toggle${hasChildren ? "" : " placeholder"}" onclick="toggleKnowledgeExpanded('${node.id}', event)" aria-label="${hasChildren ? "切换展开" : "无下级"}">${marker}</button>
          <span class="knowledge-tree-title">${escapeHtml(node.title)}</span>
        </span>
        <span class="${countClass}">${count}</span></div>`;
      if (hasChildren && expanded) {
        html += `<div class="knowledge-tree-children">${renderSidebarKnowledgeTreeV2(node.children, depth + 1)}</div>`;
      }
      return html;
    }).join("");
  }

  function setKnowledgeRelatedMode(mode) {
    if (mode !== "direct" && mode !== "all") return;
    knowledgeRelatedMode = mode;
  }

  function updateKnowledgeWorkspaceChrome(currentNode, linkedCount) {
    const titleEl = document.querySelector(".notes-header h2");
    if (titleEl) titleEl.textContent = currentNode ? `知识工作区 · ${currentNode.title}` : "知识工作区";

    const actionWrap = document.querySelector(".notes-header > div:last-child");
    if (actionWrap) {
      actionWrap.innerHTML = `
        <button class="btn btn-secondary" onclick="switchTab('errors')">题目列表</button>
        <button class="btn btn-secondary" onclick="openAIToolsModal();setTimeout(runAIDiagnosis, 0)">AI诊断</button>
        <button class="btn btn-secondary" onclick="openAIToolsModal();setTimeout(distillCurrentNodeRule, 0)">AI提炼</button>
        <button class="btn btn-secondary" onclick="addKnowledgeLeafUnderSelected()">+ 新建知识点</button>
        ${currentNode ? `<button class="btn btn-secondary" onclick="renameKnowledgeNode('${currentNode.id}')">重命名</button>` : ""}
        ${currentNode && findKnowledgeParent(currentNode.id) ? `<button class="btn btn-secondary" onclick="moveKnowledgeNode('${currentNode.id}')">移动</button>` : ""}
      `;
    }
  }

  function renderKnowledgeNotesPanelRight() {
    return;
  }

  window.renderSidebarKnowledgeTreeV2 = renderSidebarKnowledgeTreeV2;
  window.setKnowledgeRelatedMode = setKnowledgeRelatedMode;
  window.updateKnowledgeWorkspaceChrome = updateKnowledgeWorkspaceChrome;
  window.renderKnowledgeNotesPanelRight = renderKnowledgeNotesPanelRight;
  window.renderNotesPanelRight = function () {};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (typeof renderSidebar === "function") renderSidebar();
      if (typeof renderAll === "function") renderAll();
      if (typeof renderNotesByType === "function") renderNotesByType();
      window.renderNotesPanelRight();
    });
  } else {
    if (typeof renderSidebar === "function") renderSidebar();
    if (typeof renderAll === "function") renderAll();
    if (typeof renderNotesByType === "function") renderNotesByType();
    window.renderNotesPanelRight();
  }
})();
