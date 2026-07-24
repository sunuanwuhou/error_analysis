// ============================================================
// Knowledge tree sort modal (up/down reorder for siblings)
// ============================================================
let knowledgeTreeSortParentId = '';

function isKnowledgeTreeSortModalOpen() {
  const mask = document.getElementById('knowledgeTreeSortModal');
  return !!(mask && mask.classList.contains('open'));
}

function getKnowledgeTreeSortParentNode(parentId) {
  if (!parentId) return null;
  const node = getKnowledgeNodeById(parentId);
  if (!node) return null;
  const displayNode = typeof getKnowledgeDisplayNode === 'function' ? getKnowledgeDisplayNode(node) : node;
  return displayNode || node;
}

function getKnowledgeTreeSortList(parentId) {
  if (!parentId) return getKnowledgeRootNodes();
  const parent = getKnowledgeTreeSortParentNode(parentId);
  return parent ? (parent.children || []) : [];
}

function refreshKnowledgeTreeSortModalIfOpen() {
  if (!isKnowledgeTreeSortModalOpen()) return;
  renderKnowledgeTreeSortModal();
}

function getKnowledgeTreeSortAncestorChain(parentId) {
  const chain = [{ id: '', title: '根目录' }];
  if (!parentId) return chain;
  const titles = getKnowledgePathTitles(parentId);
  let currentList = getKnowledgeRootNodes();
  for (const title of titles) {
    const node = (currentList || []).find(item => String(item.title || '') === String(title || ''));
    if (!node) break;
    chain.push({ id: node.id, title: node.title });
    currentList = node.children || [];
  }
  return chain;
}

function resolveKnowledgeTreeSortParentId() {
  const selected = String(selectedKnowledgeNodeId || '');
  if (!selected) return '';
  const node = getKnowledgeNodeById(selected);
  if (!node) return '';
  if (node.children && node.children.length) return node.id;
  const parent = findKnowledgeParent(selected);
  return parent ? parent.id : '';
}

function ensureKnowledgeTreeSortModal() {
  let mask = document.getElementById('knowledgeTreeSortModal');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'knowledgeTreeSortModal';
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal kts-modal" style="width:min(560px,96vw);max-height:90vh;display:flex;flex-direction:column">
      <button class="modal-close" type="button" data-onclick="closeModal('knowledgeTreeSortModal')">×</button>
      <h2 style="margin-bottom:6px">知识树排序</h2>
      <p class="kts-sub">用上下箭头调整同级节点顺序；有下级的节点可点「进入」继续排子节点。侧栏也支持拖拽到节点上/下边缘排序。</p>
      <div id="knowledgeTreeSortBody" class="kts-body"></div>
      <div class="kts-footer">
        <button class="btn btn-primary" type="button" data-onclick="closeModal('knowledgeTreeSortModal')">完成</button>
      </div>
    </div>`;
  document.body.appendChild(mask);
  return mask;
}

function renderKnowledgeTreeSortModal() {
  ensureKnowledgeTreeSortModal();
  const body = document.getElementById('knowledgeTreeSortBody');
  if (!body) return;

  const list = getKnowledgeTreeSortList(knowledgeTreeSortParentId);
  const chain = getKnowledgeTreeSortAncestorChain(knowledgeTreeSortParentId);
  const isRootLevel = !knowledgeTreeSortParentId;
  const breadcrumb = chain.map((item, index) => {
    const active = index === chain.length - 1;
    const idLit = item.id ? `'${escapeAttrStr(item.id)}'` : "''";
    if (active) return `<span class="kts-crumb active">${escapeHtml(item.title)}</span>`;
    return `<button type="button" class="kts-crumb" data-onclick="setKnowledgeTreeSortParent(${idLit})">${escapeHtml(item.title)}</button>`;
  }).join('<span class="kts-crumb-sep">›</span>');

  let rowsHtml = '';
  if (!list.length) {
    rowsHtml = '<div class="kts-empty">当前层级没有可排序的子节点</div>';
  } else {
    rowsHtml = list.map((node, index) => {
      const hasChildren = !!(node.children && node.children.length);
      const count = typeof countErrorsForKnowledgeNode === 'function'
        ? countErrorsForKnowledgeNode(node.id, true)
        : 0;
      const idLit = `'${escapeAttrStr(node.id)}'`;
      const upDisabled = (isRootLevel || index <= 0) ? 'disabled' : '';
      const downDisabled = (isRootLevel || index >= list.length - 1) ? 'disabled' : '';
      const enterBtn = hasChildren
        ? `<button type="button" class="btn btn-sm btn-secondary kts-enter-btn" data-onclick="setKnowledgeTreeSortParent('${escapeAttrStr(node.id)}')">进入</button>`
        : '';
      return `<div class="kts-row">
        <div class="kts-row-main">
          <span class="kts-title">${escapeHtml(node.title || '未命名')}</span>
          <span class="kts-count">${count}</span>
        </div>
        <div class="kts-row-actions">
          <button type="button" class="btn btn-sm btn-secondary kts-move-btn" ${upDisabled} data-onclick="moveKnowledgeTreeSortSibling(${idLit}, -1)">↑</button>
          <button type="button" class="btn btn-sm btn-secondary kts-move-btn" ${downDisabled} data-onclick="moveKnowledgeTreeSortSibling(${idLit}, 1)">↓</button>
          ${enterBtn}
        </div>
      </div>`;
    }).join('');
  }

  const rootHint = isRootLevel
    ? '<div class="kts-hint">一级模块顺序由系统固定；请点「进入」调整各模块下的子节点。</div>'
    : '';

  body.innerHTML = `
    <div class="kts-breadcrumb">${breadcrumb}</div>
    ${rootHint}
    <div class="kts-list">${rowsHtml}</div>`;
}

function setKnowledgeTreeSortParent(parentId) {
  knowledgeTreeSortParentId = String(parentId || '');
  renderKnowledgeTreeSortModal();
}

function moveKnowledgeTreeSortSibling(nodeId, delta) {
  const list = getKnowledgeTreeSortList(knowledgeTreeSortParentId);
  const idx = list.findIndex(item => item.id === nodeId);
  const nextIdx = idx + Number(delta || 0);
  if (idx < 0 || nextIdx < 0 || nextIdx >= list.length) return;

  if (!knowledgeTreeSortParentId) {
    showToast('一级模块顺序固定，请进入具体模块后排序', 'warning');
    return;
  }

  const moved = list.splice(idx, 1)[0];
  list.splice(nextIdx, 0, moved);
  if (moved) moved.updatedAt = new Date().toISOString();

  saveKnowledgeState();
  refreshKnowledgeTreeSortModalIfOpen();
  try {
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderNotesByType === 'function') renderNotesByType();
  } catch (error) {
    console.warn('knowledge tree sort sidebar refresh failed', error);
  }
  refreshKnowledgeTreeSortModalIfOpen();
  if (typeof showToast === 'function') showToast('顺序已更新', 'success');
}

async function openKnowledgeTreeSortModal() {
  if (typeof ensureLegacyModalBundleLoaded === 'function') {
    await ensureLegacyModalBundleLoaded();
  }
  knowledgeTreeSortParentId = resolveKnowledgeTreeSortParentId();
  ensureKnowledgeTreeSortModal();
  renderKnowledgeTreeSortModal();
  if (typeof openModal === 'function') {
    openModal('knowledgeTreeSortModal');
  } else {
    document.getElementById('knowledgeTreeSortModal')?.classList.add('open');
  }
}

window.openKnowledgeTreeSortModal = openKnowledgeTreeSortModal;
window.setKnowledgeTreeSortParent = setKnowledgeTreeSortParent;
window.moveKnowledgeTreeSortSibling = moveKnowledgeTreeSortSibling;
window.renderKnowledgeTreeSortModal = renderKnowledgeTreeSortModal;
window.refreshKnowledgeTreeSortModalIfOpen = refreshKnowledgeTreeSortModalIfOpen;
window.isKnowledgeTreeSortModalOpen = isKnowledgeTreeSortModalOpen;
