// ============================================================
// Notes view rendering helpers (TOC / layout / workspace header)
// ============================================================

function extractMdHeadings(content) {
  const headings = [];
  const lines = String(content || '').replace(/\r/g, '').split('\n');
  let headingIndex = 0;
  for (const line of lines) {
    const parsed = parseLooseNoteHeading(line);
    const m = parsed ? [line, '#'.repeat(parsed.level), parsed.text] : null;
    if (m) {
      headings.push({ level: m[1].length, text: m[2].trim(), headingIndex });
      headingIndex++;
    }
  }
  return headings;
}

function prependNodeHeading(headings, nodeTitle) {
  const title = String(nodeTitle || '').trim();
  const list = Array.isArray(headings) ? headings : [];
  if (!title) return list;
  const normalized = title.replace(/\s+/g, '');
  const first = list[0];
  if (first && String(first.text || '').replace(/\s+/g, '') === normalized) {
    return list;
  }
  return [{ level: 1, text: title, headingIndex: 0 }].concat(
    list.map(item => ({ ...item, headingIndex: Number(item.headingIndex || 0) + 1 }))
  );
}

function renderNotePreviewLayout(previewHtml, tocHtml) {
  const article = `<div class="note-preview-article-scroll"><article class="note-preview-article">${previewHtml || ''}</article></div>`;
  if (!tocHtml) {
    return `<div class="note-preview-layout note-preview-layout-no-toc">${article}</div>`;
  }
  return `<div class="note-preview-layout"><aside class="note-preview-toc">${tocHtml}</aside>${article}</div>`;
}

function renderKnowledgeWorkspaceHeader(node, pathText, directCount, linkedCount, noteEditing) {
  if (!node) return '';
  return `<div class="knowledge-workspace-meta">
      <div class="note-page-breadcrumb">${escapeHtml(pathText || '')}</div>
      <div class="knowledge-workspace-title">${escapeHtml(node.title || '')}</div>
      <div class="knowledge-page-meta">
        <span class="knowledge-page-pill">直属 ${directCount || 0}</span>
        <span class="knowledge-page-pill">含下级 ${linkedCount || 0}</span>
      </div>
    </div>
    <div class="knowledge-page-actions">
      <button class="btn btn-primary btn-sm" onclick="noteEditing=${noteEditing ? 'false' : 'true'};renderNotesByType()">${noteEditing ? '完成' : '编辑'}</button>
      <button class="btn btn-secondary btn-sm" onclick="openImportModalForCurrentKnowledge()">导入错题</button>
      <details class="note-more-menu">
        <summary class="btn btn-secondary btn-sm">更多</summary>
        <div class="note-more-menu-panel">
          <button class="btn btn-secondary btn-sm" onclick="renameKnowledgeNode('${node.id}')">重命名</button>
          ${findKnowledgeParent(node.id) ? `<button class="btn btn-secondary btn-sm" onclick="moveKnowledgeNode('${node.id}')">移动</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="selectedKnowledgeNodeId='${node.id}';addKnowledgeLeafUnderSelected()">新建下级</button>
          <button class="btn btn-secondary btn-sm" onclick="openAddModalForCurrentKnowledge()">录入题目</button>
          <button class="btn btn-secondary btn-sm" onclick="openImportModalForCurrentKnowledge()">导入错题</button>
          <button class="btn btn-secondary btn-sm" onclick="deleteKnowledgeNode('${node.id}')">删除节点</button>
        </div>
      </details>
    </div>`;
}

function decorateKnowledgeNotesView(contentEl, currentNode, pathText, directCount, linkedCount, summaryHtml, noteEditing) {
  if (!contentEl) return;
  const header = contentEl.querySelector('.knowledge-workspace-bar');
  if (header) {
    header.innerHTML = renderKnowledgeWorkspaceHeader(currentNode, pathText, directCount, linkedCount, noteEditing);
  }
  const splitArea = contentEl.querySelector('.note-split-area');
  if (splitArea) {
    let intro = contentEl.querySelector('.note-page-intro');
    if (!intro) {
      intro = document.createElement('div');
      intro.className = 'note-page-intro';
      splitArea.parentNode.insertBefore(intro, splitArea);
    }
    intro.innerHTML = summaryHtml || '';
    contentEl.querySelectorAll('.note-split-area .knowledge-children-bar, .note-split-area .knowledge-node-hint').forEach(node => node.remove());
  }
  contentEl.querySelectorAll('.note-split-label').forEach(label => {
    const text = (label.textContent || '').trim();
    if (!noteEditing || text.indexOf('预览') >= 0 || text.indexOf('当前笔记') >= 0) {
      label.remove();
    }
  });
}

function ensureGlobalNoteTocDock() {
  let dock = document.getElementById('globalNoteTocDock');
  if (!dock) {
    dock = document.createElement('div');
    dock.id = 'globalNoteTocDock';
    dock.className = 'global-note-toc-dock';
    document.body.appendChild(dock);
  }
  return dock;
}

function clearGlobalNoteTocDock() {
  const dock = document.getElementById('globalNoteTocDock');
  if (!dock) return;
  dock.innerHTML = '';
  dock.style.display = 'none';
}

function updateGlobalNoteTocDock(headings, anchorPrefix) {
  clearGlobalNoteTocDock();
}

function renderNoteToc(content, anchorPrefix) {
  const raw = (content || '').trim();
  if (!anchorPrefix) return '';
  if (!raw) {
    return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录</div><div class="note-toc-list"><div class="note-toc-item">当前笔记为空</div></div></div>`;
  }
  const headings = extractMdHeadings(content).filter(item => item.level >= 1 && item.level <= 4);
  if (!headings.length) {
    return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录</div><div class="note-toc-list"><div class="note-toc-item">还没有 Markdown 标题，使用 # 或 ## 添加</div></div></div>`;
  }
  const items = headings.map(item => {
    const anchorId = getNoteHeadingAnchorId(anchorPrefix, item.headingIndex);
    return `<div class="note-toc-item lv${Math.min(item.level, 4)}" onclick="jumpToRenderedAnchor('${anchorId}')">${escapeHtml(item.text)}</div>`;
  }).join('');
  return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录</div><div class="note-toc-list">${items}</div></div>`;
}

function renderNoteTocFromHeadings(headings, anchorPrefix) {
  if (!anchorPrefix) return '';
  const list = Array.isArray(headings) ? headings : [];
  if (!list.length) {
    return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录</div><div class="note-toc-list"><div class="note-toc-item">还没有 Markdown 标题，使用 # 或 ## 添加</div></div></div>`;
  }
  const items = list.map(item => {
    const anchorId = getNoteHeadingAnchorId(anchorPrefix, item.headingIndex);
    return `<div class="note-toc-item lv${Math.min(item.level, 4)}" onclick="jumpToRenderedAnchor('${anchorId}')">${escapeHtml(item.text)}</div>`;
  }).join('');
  return `<div class="note-toc note-toc-floating"><div class="note-toc-title">本页笔记目录（${list.length}）</div><div class="note-toc-list">${items}</div></div>`;
}

function renderInlineHeadingPanel(headings, anchorPrefix) {
  const list = Array.isArray(headings) ? headings : [];
  if (!anchorPrefix) return '';
  if (!list.length) {
    return `<div style="margin:0 0 14px;padding:10px 12px;border:1px solid #f0e2cf;border-radius:10px;background:#fffaf3;color:#7c5a2f;font-size:12px;line-height:1.7"><strong>本页笔记目录</strong><br>还没有 Markdown 标题</div>`;
  }
  const items = list.map(item => {
    const anchorId = getNoteHeadingAnchorId(anchorPrefix, item.headingIndex);
    const pad = 8 + Math.max(0, item.level - 1) * 14;
    return `<div onclick="jumpToRenderedAnchor('${anchorId}')" style="padding:4px 8px 4px ${pad}px;border-radius:6px;cursor:pointer;color:#7c5a2f">${escapeHtml(item.text)}</div>`;
  }).join('');
  return `<div style="margin:0 0 14px;padding:10px 12px;border:1px solid #f0e2cf;border-radius:10px;background:#fffaf3;color:#7c5a2f;font-size:12px;line-height:1.7"><strong>本页笔记目录（${list.length}）</strong>${items}</div>`;
}

function renderFloatingHeadingPanel(headings, anchorPrefix) {
  const list = Array.isArray(headings) ? headings : [];
  if (!anchorPrefix) return '';
  if (!list.length) {
    return `<div class="note-toc note-toc-floating"><div class="note-toc-title"><span>本页笔记目录</span><span>0</span></div><div class="note-toc-list"><div class="note-toc-item">还没有 Markdown 标题，使用 # 概括 或 ## 方法</div></div></div>`;
  }
  const items = list.map(item => {
    const anchorId = getNoteHeadingAnchorId(anchorPrefix, item.headingIndex);
    return `<div class="note-toc-item lv${Math.min(item.level, 4)}" data-anchor-id="${anchorId}" onclick="jumpToRenderedAnchor('${anchorId}')">${escapeHtml(item.text)}</div>`;
  }).join('');
  return `<div class="note-toc note-toc-floating"><div class="note-toc-title"><span>本页笔记目录</span><span>${list.length}</span></div><div class="note-toc-list">${items}</div></div>`;
}
