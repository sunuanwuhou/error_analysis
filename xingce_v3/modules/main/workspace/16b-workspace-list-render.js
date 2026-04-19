// ============================================================
// Workspace list render helpers
// ============================================================

function getKnowledgeGroupStateSet() {
  if (typeof window === 'undefined') return new Set();
  if (!(window.expKnowledgePathGroups instanceof Set)) {
    window.expKnowledgePathGroups = new Set();
  }
  return window.expKnowledgePathGroups;
}

function toggleKnowledgePathGroup(groupKey) {
  const key = String(groupKey || '').trim();
  if (!key) return;
  const set = getKnowledgeGroupStateSet();
  if (set.has(key)) set.delete(key);
  else set.add(key);
  if (typeof requestWorkspaceRender === 'function') requestWorkspaceRender({ sidebar: false });
  else renderAll();
}

function getErrorPathTitlesForGrouping(errorItem) {
  if (typeof getErrorKnowledgePathTitles === 'function') {
    const titles = getErrorKnowledgePathTitles(errorItem);
    if (Array.isArray(titles) && titles.length) return titles;
  }
  return [errorItem?.type || '其他', errorItem?.subtype || '未分类', errorItem?.subSubtype || '未细分'].filter(Boolean);
}

function buildKnowledgePathGroupTree(list) {
  const root = [];
  (list || []).forEach(item => {
    const titles = getErrorPathTitlesForGrouping(item);
    let bucket = root;
    let parentKey = '';
    titles.forEach((title, index) => {
      const groupKey = parentKey ? `${parentKey} > ${title}` : String(title || '');
      let group = bucket.find(node => node.title === title);
      if (!group) {
        group = { title, key: groupKey, level: index, children: [], items: [] };
        bucket.push(group);
      }
      parentKey = groupKey;
      bucket = group.children;
    });
    if (!titles.length) {
      let fallback = root.find(node => node.title === '未归类');
      if (!fallback) {
        fallback = { title: '未归类', key: '未归类', level: 0, children: [], items: [] };
        root.push(fallback);
      }
      fallback.items.push(item);
      return;
    }
    let leaf = root;
    let current = null;
    titles.forEach(title => {
      current = leaf.find(node => node.title === title);
      leaf = current.children;
    });
    if (current) current.items.push(item);
  });
  return root;
}

function countKnowledgePathGroupItems(group) {
  if (!group) return 0;
  return (group.items || []).length + (group.children || []).reduce((sum, child) => sum + countKnowledgePathGroupItems(child), 0);
}

function renderKnowledgePathGroupNodes(nodes) {
  const set = getKnowledgeGroupStateSet();
  return (nodes || []).map(group => {
    const total = countKnowledgePathGroupItems(group);
    const isOpen = group.level >= 3 || set.has(group.key) || group.level === 0;
    const cls = group.level === 0
      ? 'type'
      : group.level === 1
        ? 'subtype'
        : 'sub2';
    const arrowCls = cls === 'type' ? 'type-arrow' : cls === 'subtype' ? 'subtype-arrow' : 'sub2-arrow';
    const titleCls = cls === 'type' ? 'type-title' : cls === 'subtype' ? 'subtype-title' : 'sub2-title';
    const wrapCls = cls === 'type' ? 'type-group' : cls === 'subtype' ? 'subtype-group' : 'sub2-group';
    const headCls = cls === 'type' ? 'type-header' : cls === 'subtype' ? 'subtype-header' : 'sub2-header';
    const badge = group.level <= 1
      ? `<span style="font-size:11px;color:#aaa;background:#f0f0f0;padding:1px 6px;border-radius:8px">${total}</span>`
      : `<span style="font-size:10px;color:#bbb;background:#f5f5f5;padding:0 5px;border-radius:5px">${total}</span>`;
    const cardsHtml = (group.items || []).map(item => renderCard(item)).join('');
    const childrenHtml = renderKnowledgePathGroupNodes(group.children || []);
    return `<div class="${wrapCls}">
      <div class="${headCls}" onclick="toggleKnowledgePathGroup('${escapeHtml(group.key)}')">
        <div class="${titleCls}">
          <span class="${arrowCls} ${isOpen ? 'open' : ''}">▶</span>
          ${escapeHtml(group.title)}
          ${badge}
        </div>
      </div>
      ${isOpen ? `${cardsHtml}${childrenHtml}` : ''}
    </div>`;
  }).join('');
}

function renderGroupedErrorListHtml(visibleList) {
  return renderKnowledgePathGroupNodes(buildKnowledgePathGroupTree(visibleList));
}

window.toggleKnowledgePathGroup = toggleKnowledgePathGroup;

function renderProgressiveLoadHint(list, visibleList) {
  if (!Array.isArray(list) || !Array.isArray(visibleList) || list.length <= visibleList.length) return '';
  return `<div class="home-dashboard-card" style="margin:16px 0 8px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="font-size:13px;color:#64748b">已渲染 ${visibleList.length} / ${list.length} 题，继续加载更多可以避免手机和 iPad 一次性卡住。</div>
      <button class="btn btn-secondary" type="button" onclick="loadMoreErrors()">继续加载 ${Math.min(ERROR_RENDER_STEP, list.length - visibleList.length)} 题</button>
    </div>
    <div id="errorListAutoPager" style="height:1px"></div>
  </div>`;
}
