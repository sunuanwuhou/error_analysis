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
    if (knowledgeRelatedMode === mode) return;
    knowledgeRelatedMode = mode;
    renderNotesPanelRight();
    const currentNode = getCurrentKnowledgeNode();
    updateKnowledgeWorkspaceChrome(currentNode, currentNode ? countErrorsForKnowledgeNode(currentNode.id, true) : 0);
  }

  function updateKnowledgeWorkspaceChrome(currentNode, linkedCount) {
    const titleEl = document.querySelector(".notes-header h2");
    if (titleEl) titleEl.textContent = currentNode ? `知识工作区 · ${currentNode.title}` : "知识工作区";

    const actionWrap = document.querySelector(".notes-header > div:last-child");
    if (actionWrap) {
      actionWrap.innerHTML = `
        <button class="btn btn-secondary" onclick="switchTab('errors')">题目列表</button>
        <button class="btn btn-secondary" onclick="addKnowledgeLeafUnderSelected()">+ 新建知识点</button>
        ${currentNode ? `<button class="btn btn-secondary" onclick="renameKnowledgeNode('${currentNode.id}')">重命名</button>` : ""}
        ${currentNode && findKnowledgeParent(currentNode.id) ? `<button class="btn btn-secondary" onclick="moveKnowledgeNode('${currentNode.id}')">移动</button>` : ""}
      `;
    }

    const rightHeader = document.querySelector(".notes-panel-right-header h3");
    if (rightHeader) {
      const count = currentNode ? countErrorsForKnowledgeNode(currentNode.id, knowledgeRelatedMode !== "direct") : 0;
      const suffix = knowledgeRelatedMode === "direct" ? "直属" : "含下级";
      rightHeader.textContent = currentNode ? `关联错题 · ${suffix} ${count}` : "关联错题";
    }

    const rightActions = document.querySelector(".notes-panel-right-header > div:last-child");
    if (rightActions) {
      rightActions.innerHTML = `
        <button class="btn btn-sm ${knowledgeRelatedMode === "direct" ? "btn-primary" : "btn-secondary"}" onclick="setKnowledgeRelatedMode('direct')" title="只看直接挂在当前节点的错题">直属</button>
        <button class="btn btn-sm ${knowledgeRelatedMode === "all" ? "btn-primary" : "btn-secondary"}" onclick="setKnowledgeRelatedMode('all')" title="查看当前节点及下级节点的错题">含下级</button>
        <button class="btn btn-sm btn-secondary" onclick="knowledgeNodeFilter=null;renderSidebar();renderAll();renderNotesPanelRight()" title="清除节点筛选">全部</button>
        ${currentNode ? `<button class="btn btn-sm btn-secondary" onclick="switchTab('notes')" title="查看当前知识点笔记">笔记</button>` : ""}
      `;
    }
  }

  function renderKnowledgeNotesPanelRight() {
    ensureKnowledgeState();
    const body = document.getElementById("notesPanelRightBody");
    if (!body) return;
    const header = document.querySelector(".notes-panel-right-header h3");
    if (header) {
      const suffix = knowledgeRelatedMode === "direct" ? "直属" : "含下级";
      header.textContent = `关联错题 · ${suffix}`;
    }
    const currentNode = getCurrentKnowledgeNode();
    if (!currentNode) {
      body.innerHTML = '<div style="color:#ccc;font-size:12px;padding:20px;text-align:center">暂无关联错题</div>';
      return;
    }
    const nodeIds = knowledgeRelatedMode === "direct" ? [currentNode.id] : getKnowledgeDescendantNodeIds(currentNode);
    const related = getFiltered().filter(item => nodeIds.includes(item.noteNodeId));
    const pathText = collapseKnowledgePathTitles(getKnowledgePathTitles(currentNode.id)).join(" > ");
    if (!related.length) {
      const emptyText = knowledgeRelatedMode === "direct"
        ? "当前节点下暂无直属错题或筛选结果为空。"
        : "当前节点及下级节点下暂无错题或筛选结果为空。";
      body.innerHTML = `<div style="padding:14px 12px;color:#888;font-size:12px;line-height:1.7">${escapeHtml(pathText)}<br>${emptyText}</div>`;
      return;
    }
    const summaryText = knowledgeRelatedMode === "direct"
      ? `当前节点直属错题 ${related.length} 道`
      : `当前节点及下级共 ${related.length} 道关联错题`;
    body.innerHTML = `<div class="related-errors-summary"><strong>${escapeHtml(pathText)}</strong><br>${summaryText}</div>` + related.map(e => {
      const notePath = collapseKnowledgePathTitles(getKnowledgePathTitles(e.noteNodeId)).join(" > ");
      const questionText = (e.question || "").trim();
      const questionHtml = questionText
        ? `<div class="related-error-question">${hl(questionText, searchKw)}</div>`
        : '<div class="related-error-question">图片题</div>';
      const questionImg = e.imgData ? `<img class="related-error-image" src="${e.imgData}" alt="题目图片">` : "";
      const analysisImg = e.analysisImgData ? `<img class="related-error-image" src="${e.analysisImgData}" alt="解析图片">` : "";
      const optionsHtml = renderRelatedErrorOptions(e.options);
      const metaHtml = [
        renderRelatedErrorMeta("正确答案", e.answer),
        renderRelatedErrorMeta("我的答案", e.myAnswer),
        renderRelatedErrorMeta("根本主因", e.rootReason),
        renderRelatedErrorMeta("直接原因", e.errorReason)
      ].filter(Boolean).join("");
      const analysisHtml = e.analysis ? `<div class="related-error-analysis">${escapeHtml(e.analysis)}</div>` : "";
      return `<div class="error-card related-error-card" draggable="true" ondragstart="startErrorDrag(${e.id}, event)" ondragend="endErrorDrag()">
        <div class="card-top">
          <span class="status-tag ${escapeHtml(e.status || "focus")}">${escapeHtml((e.status === "review" ? "待复习" : e.status === "mastered" ? "已掌握" : "重点复习"))}</span>
          <span class="card-num">#${e.id}</span>
        </div>
        <div class="related-error-path"><strong>知识点</strong> ${escapeHtml(notePath)}</div>
        <div class="related-error-detail">
          ${questionHtml}
          ${questionImg}
          ${optionsHtml}
          ${metaHtml ? `<div class="related-error-meta-grid">${metaHtml}</div>` : ""}
          ${analysisHtml}
          ${analysisImg}
        </div>
        <div class="card-actions related-error-actions">
          <button class="btn btn-secondary btn-sm" onclick="moveErrorToKnowledgeNode(${e.id}, '${e.noteNodeId || ""}')">改挂载</button>
          <button class="btn btn-secondary btn-sm" onclick="openEditModal(${e.id})">编辑</button>
        </div>
      </div>`;
    }).join("");
  }

  window.renderSidebarKnowledgeTreeV2 = renderSidebarKnowledgeTreeV2;
  window.setKnowledgeRelatedMode = setKnowledgeRelatedMode;
  window.updateKnowledgeWorkspaceChrome = updateKnowledgeWorkspaceChrome;
  window.renderKnowledgeNotesPanelRight = renderKnowledgeNotesPanelRight;
  window.renderNotesPanelRight = function () {
    renderKnowledgeNotesPanelRight();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (typeof renderSidebar === "function") renderSidebar();
      if (typeof renderAll === "function") renderAll();
      if (typeof renderNotesByType === "function") renderNotesByType();
      renderKnowledgeNotesPanelRight();
    });
  } else {
    if (typeof renderSidebar === "function") renderSidebar();
    if (typeof renderAll === "function") renderAll();
    if (typeof renderNotesByType === "function") renderNotesByType();
    renderKnowledgeNotesPanelRight();
  }
})();
