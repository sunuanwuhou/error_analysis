// ============================================================
// Workspace view and tab switching helpers
// ============================================================
function _showTabLoadingOverlay(msg) {
  const target = document.getElementById('tabContentNotes');
  if (!target) return;
  target.classList.add('active');
  let el = document.getElementById('_wsTabLoadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = '_wsTabLoadingOverlay';
    el.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:24px;color:#64748b;font-size:13px;line-height:1.8;background:var(--bg,#fff);z-index:2';
    target.style.position = 'relative';
    target.appendChild(el);
  }
  el.textContent = msg;
}

function _removeTabLoadingOverlay() {
  const el = document.getElementById('_wsTabLoadingOverlay');
  if (el) el.remove();
}
function getTypeCounts() {
  const typeCounts = {};
  errors.forEach(e => {
    const t = e.type || '其他';
    const s = e.subtype || 'Uncategorized';
    const s2 = e.subSubtype;
    const key = `${t}|${s}|${s2 || ''}`;
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  });
  return typeCounts;
}

function groupByType(displayData) {
  const grouped = {};
  displayData.forEach(e => {
    const key = `${e.type || 'Other'}|${e.subtype || 'Uncategorized'}|${e.subSubtype || ''}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });
  return grouped;
}

function syncAppViewChrome() {
  document.body.classList.toggle('app-view-workspace', appView === 'workspace');
  const workspaceView = document.getElementById('workspaceView');
  const sidebarWorkspaceBtn = document.getElementById('sidebarWorkspaceBtn');
  if (workspaceView) workspaceView.classList.toggle('active', appView === 'workspace');
  if (sidebarWorkspaceBtn) sidebarWorkspaceBtn.classList.toggle('active', appView === 'workspace');
}

function isWorkspaceRuntimeReady() {
  return typeof renderAll === 'function'
    && typeof renderNotesByType === 'function'
    && typeof renderSidebar === 'function';
}

function ensureWorkspaceRuntimeReady() {
  if (isWorkspaceRuntimeReady()) return Promise.resolve(true);
  const loader = (typeof window !== 'undefined') ? window.ensureLegacyWorkspaceBundleLoaded : null;
  const loadPromise = typeof loader === 'function' ? loader() : Promise.resolve();
  return loadPromise
    .then(() => new Promise(function(resolve) {
      if (isWorkspaceRuntimeReady()) return resolve(true);
      var ticks = 0;
      function check() {
        if (isWorkspaceRuntimeReady()) return resolve(true);
        if (ticks++ > 50) return resolve(false);
        setTimeout(check, 100);
      }
      setTimeout(check, 80);
    }))
    .catch(function(error) {
      console.warn('workspace bundle load failed', error);
      return false;
    });
}

function switchAppView(nextView, opts) {
  appView = 'workspace';
  syncAppViewChrome();
  ensureWorkspaceRuntimeReady().then((ready) => {
    if (!ready) return;
    switchTab('notes');
  });
}

function openWorkspaceView(tabName) {
  switchAppView('workspace', { tab: 'notes' });
}

function openWorkspaceTaskView(taskMode) {
  openWorkspaceView('notes');
}

function openWorkspaceQuickAdd() {
  openWorkspaceView('notes');
  openQuickAddModal();
}

function ensureErrorsListScrollable() {
  const workspace = document.getElementById('workspaceView');
  const tabErrors = document.getElementById('tabContentErrors');
  const errorsArea = tabErrors ? tabErrors.querySelector('.errors-area') : null;
  const errorsList = document.getElementById('errorList');
  if (!workspace || !tabErrors || !errorsArea || !errorsList) return;
  workspace.style.overflow = 'hidden';
  tabErrors.style.display = 'flex';
  tabErrors.style.flexDirection = 'column';
  tabErrors.style.flex = '1';
  tabErrors.style.minHeight = '0';
  tabErrors.style.overflow = 'hidden';
  errorsArea.style.display = 'flex';
  errorsArea.style.flexDirection = 'column';
  errorsArea.style.flex = '1';
  errorsArea.style.minHeight = '0';
  errorsArea.style.overflow = 'hidden';
  const occupiedHeight = Array.from(errorsArea.children || [])
    .filter(el => el !== errorsList)
    .reduce((sum, el) => sum + (el instanceof HTMLElement ? el.offsetHeight : 0), 0);
  const fallbackTopGap = 8;
  const availableHeight = Math.max(180, (errorsArea.clientHeight || 0) - occupiedHeight - fallbackTopGap);
  errorsList.style.flex = '0 0 auto';
  errorsList.style.minHeight = '180px';
  errorsList.style.height = `${availableHeight}px`;
  errorsList.style.maxHeight = `${availableHeight}px`;
  errorsList.style.overflowY = 'auto';
  errorsList.style.overflowX = 'hidden';
  errorsList.style.touchAction = 'pan-y';
}

function switchTab(tabName) {
  const activeTab = 'notes';
  if (appView !== 'workspace') {
    appView = 'workspace';
  }
  if (!isWorkspaceRuntimeReady()) {
    _showTabLoadingOverlay('Loading workspace bundle. This usually takes only a moment.');
    syncAppViewChrome();
    ensureWorkspaceRuntimeReady().then((ready) => {
      _removeTabLoadingOverlay();
      if (!ready) {
        if (typeof showToast === 'function') showToast('工作区加载失败，请刷新后重试', 'error');
        return;
      }
      switchTab(activeTab);
    });
    return;
  }
  if (typeof hasFullWorkspaceDataLoaded === 'function'
      && typeof ensureFullWorkspaceDataLoaded === 'function'
      && !hasFullWorkspaceDataLoaded()) {
    _showTabLoadingOverlay('Loading the full workspace data. This usually takes only a moment.');
    syncAppViewChrome();
    ensureFullWorkspaceDataLoaded()
      .then(() => { _removeTabLoadingOverlay(); switchTab(activeTab); })
      .catch((err) => {
        _removeTabLoadingOverlay();
        console.error('full workspace data load failed', err);
        fullDataLoading = false;
        if (typeof showToast === 'function') showToast('工作区数据加载失败，请刷新后重试', 'error');
      });
    return;
  }
  syncAppViewChrome();
  document.body.classList.toggle('tab-errors-active', activeTab === 'errors');
  document.body.classList.toggle('tab-notes-active', activeTab === 'notes');
  const tabErrors = document.getElementById('tabErrors');
  const tabNotes = document.getElementById('tabNotes');
  const tabContentErrors = document.getElementById('tabContentErrors');
  const tabContentNotes = document.getElementById('tabContentNotes');
  if (tabErrors) tabErrors.classList.toggle('active', false);
  if (tabNotes) tabNotes.classList.toggle('active', true);
  if (tabContentErrors) tabContentErrors.classList.toggle('active', false);
  if (tabContentNotes) tabContentNotes.classList.toggle('active', true);
  if (tabContentErrors) {
    tabContentErrors.style.display = 'none';
    tabContentErrors.setAttribute('aria-hidden', 'true');
  }
  if (tabContentNotes) {
    tabContentNotes.style.display = 'flex';
    tabContentNotes.style.flexDirection = 'column';
    tabContentNotes.style.flex = '1';
    tabContentNotes.style.minHeight = '0';
    tabContentNotes.style.overflow = 'hidden';
    tabContentNotes.setAttribute('aria-hidden', 'false');
  }
  renderSidebar();
  renderNotesByType();
}
