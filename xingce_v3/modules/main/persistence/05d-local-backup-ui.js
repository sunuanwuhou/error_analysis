// ============================================================
// Local backup UI and restore controls
// ============================================================

const KEY_LOCAL_BACKUP_LAST_AUTO_DAY = 'xc_local_backup_last_auto_day';

const LOCAL_BACKUP_STATUS_STYLE = {
  info: '#667085',
  success: '#067647',
  warning: '#b54708',
  error: '#b42318'
};

const localBackupUiState = {
  list: [],
  busy: false,
  busyAction: '',
  busyBackupId: '',
  message: '',
  tone: 'info',
  listBound: false
};

function escapeLocalBackupText(value) {
  return escapeHtml(String(value == null ? '' : value));
}

function formatLocalBackupSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return '0 B';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function formatLocalBackupTime(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  const stamp = Date.parse(text);
  if (!Number.isFinite(stamp)) return text;
  const d = new Date(stamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function backupKindLabel(kind) {
  const value = String(kind || '');
  if (value === 'auto') return '自动备份';
  if (value === 'manual') return '手动备份';
  if (value === 'before_restore') return '恢复前安全备份';
  return value || '备份';
}

function getLocalBackupSummaryText(items) {
  const list = Array.isArray(items) ? items : [];
  const totalSize = list.reduce((sum, item) => sum + Number((item && item.sizeBytes) || 0), 0);
  return `共 ${list.length} 份备份，合计 ${formatLocalBackupSize(totalSize)}。自动备份只保留最新 1 份。`;
}

function setLocalBackupStatus(message, tone) {
  const summaryEl = document.getElementById('localBackupSummary');
  localBackupUiState.message = String(message || '');
  localBackupUiState.tone = String(tone || 'info');
  if (!summaryEl) return;
  summaryEl.textContent = localBackupUiState.message || getLocalBackupSummaryText(localBackupUiState.list);
  summaryEl.style.color = LOCAL_BACKUP_STATUS_STYLE[localBackupUiState.tone] || LOCAL_BACKUP_STATUS_STYLE.info;
}

function setLocalBackupBusy(busy, action, backupId) {
  localBackupUiState.busy = !!busy;
  localBackupUiState.busyAction = busy ? String(action || '') : '';
  localBackupUiState.busyBackupId = busy ? String(backupId || '') : '';
}

function syncLocalBackupButtons() {
  const listEl = document.getElementById('localBackupList');
  if (!listEl) return;
  listEl.querySelectorAll('button[data-local-backup-action]').forEach((btn) => {
    const action = btn.getAttribute('data-local-backup-action') || '';
    const backupId = btn.getAttribute('data-backup-id') || '';
    const label = btn.getAttribute('data-label-default') || btn.textContent || '';
    const isBusy = !!localBackupUiState.busy;
    const isCurrent = isBusy
      && localBackupUiState.busyAction === action
      && localBackupUiState.busyBackupId === backupId;
    const disableForBusy = isBusy && action !== 'download';
    btn.disabled = disableForBusy;
    btn.style.opacity = disableForBusy ? '0.65' : '';
    btn.style.cursor = disableForBusy ? 'not-allowed' : '';
    if (isCurrent && action === 'restore') {
      btn.textContent = '恢复中...';
    } else if (isCurrent && action === 'delete') {
      btn.textContent = '删除中...';
    } else {
      btn.textContent = label;
    }
  });

  document.querySelectorAll('#localBackupModal [data-local-backup-global]').forEach((btn) => {
    const action = btn.getAttribute('data-local-backup-global') || '';
    const label = btn.getAttribute('data-label-default') || btn.textContent || '';
    const isBusy = !!localBackupUiState.busy;
    btn.disabled = isBusy;
    btn.style.opacity = isBusy ? '0.65' : '';
    btn.style.cursor = isBusy ? 'not-allowed' : '';
    btn.textContent = isBusy && action === 'create' ? '备份中...' : label;
  });
}

function ensureLocalBackupListBinding() {
  const listEl = document.getElementById('localBackupList');
  if (!listEl || localBackupUiState.listBound) return;
  listEl.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button[data-local-backup-action]') : null;
    if (!target || target.disabled) return;
    const action = String(target.getAttribute('data-local-backup-action') || '').trim();
    const backupId = String(target.getAttribute('data-backup-id') || '').trim();
    if (!action || !backupId) return;
    event.preventDefault();
    event.stopPropagation();
    if (action === 'download') {
      downloadLocalBackupById(backupId);
      return;
    }
    if (action === 'restore') {
      void restoreLocalBackupById(backupId);
      return;
    }
    if (action === 'delete') {
      void deleteLocalBackupById(backupId);
    }
  });
  localBackupUiState.listBound = true;
}

function ensureLocalBackupMenuButton() {
  const panel = document.getElementById('moreMenuPanel');
  if (!panel) return;
  if (panel.querySelector('[data-onclick*="openLocalBackupModalFromMore"]')) return;
  const cloudSaveBtn = panel.querySelector('[data-onclick*="saveCloudFullBackupFromMore"]');
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.setAttribute('data-onclick', 'openLocalBackupModalFromMore()');
  btn.textContent = '备份数据列表';
  if (cloudSaveBtn && cloudSaveBtn.nextSibling) {
    cloudSaveBtn.insertAdjacentElement('afterend', btn);
  } else {
    panel.appendChild(btn);
  }
}

async function openLocalBackupModalFromMore() {
  if (typeof closeMoreMenu === 'function') closeMoreMenu();
  if (typeof ensureDeferredPartialsLoaded === 'function') {
    try { await ensureDeferredPartialsLoaded(); } catch (e) {}
  }
  if (typeof ensureLegacyModalBundleLoaded === 'function') {
    try { await ensureLegacyModalBundleLoaded(); } catch (e) {}
  }
  if (typeof openModal === 'function') {
    openModal('localBackupModal');
  } else {
    const modal = document.getElementById('localBackupModal');
    if (modal) modal.style.display = 'flex';
  }
  ensureLocalBackupListBinding();
  await refreshLocalBackups();
}

function renderLocalBackupList(items) {
  const listEl = document.getElementById('localBackupList');
  if (!listEl) return;

  const list = Array.isArray(items) ? items.slice() : [];
  localBackupUiState.list = list;

  if (!localBackupUiState.message || localBackupUiState.tone === 'info') {
    setLocalBackupStatus(getLocalBackupSummaryText(list), localBackupUiState.tone || 'info');
  }

  if (!list.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:#94a3b8;border:1px dashed #d1d5db;border-radius:10px;padding:12px">暂无本地备份</div>';
    syncLocalBackupButtons();
    return;
  }

  listEl.innerHTML = list.map((item) => {
    const id = String((item && item.id) || '');
    const summary = item && typeof item.summary === 'object' ? item.summary : {};
    const label = String((item && item.label) || '');
    const title = label ? `${backupKindLabel(item && item.kind)} · ${label}` : backupKindLabel(item && item.kind);
    const backupArg = escapeLocalBackupText(id);
    return `
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin-bottom:10px;background:#fff">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <div style="font-weight:600;color:#111827">${escapeLocalBackupText(title)}</div>
            <div style="font-size:12px;color:#667085;margin-top:4px">
              时间：${escapeLocalBackupText(formatLocalBackupTime(item && item.createdAt))} · 大小：${escapeLocalBackupText(formatLocalBackupSize(item && item.sizeBytes))}
            </div>
            <div style="font-size:12px;color:#667085;margin-top:2px">
              错题 ${Number(summary.errors || 0)} · 笔记 ${Number(summary.notesByType || 0)} · 知识点 ${Number(summary.knowledgeNodes || 0)}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" type="button" data-local-backup-action="download" data-backup-id="${backupArg}" data-label-default="下载到本地">下载到本地</button>
            <button class="btn btn-secondary btn-sm" type="button" data-local-backup-action="restore" data-backup-id="${backupArg}" data-label-default="恢复备份">恢复备份</button>
            <button class="btn btn-secondary btn-sm" type="button" data-local-backup-action="delete" data-backup-id="${backupArg}" data-label-default="删除" style="color:#b42318;border-color:#fda29b">删除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  syncLocalBackupButtons();
}

async function refreshLocalBackups() {
  setLocalBackupStatus('正在加载备份列表...', 'info');
  try {
    const data = await fetchJsonWithAuth('/api/local-backups', { method: 'GET' });
    localBackupUiState.message = '';
    localBackupUiState.tone = 'info';
    renderLocalBackupList(data && data.items ? data.items : []);
  } catch (error) {
    setLocalBackupStatus('加载失败，请稍后重试', 'error');
    showToast(`加载本地备份失败：${(error && error.message) || 'unknown error'}`, 'error');
  }
}

async function createLocalBackupByKind(kind, label, opts) {
  const options = opts || {};
  const skipRecentHours = Number(options.skipRecentHours || 0);
  const silent = !!options.silent;
  const data = await fetchJsonWithAuth('/api/local-backups/create', {
    method: 'POST',
    body: {
      kind: String(kind || 'manual'),
      label: String(label || ''),
      skipRecentHours: skipRecentHours > 0 ? skipRecentHours : 0
    }
  });

  if (document.getElementById('localBackupModal')) {
    localBackupUiState.message = '';
    localBackupUiState.tone = 'info';
    renderLocalBackupList(data && data.items ? data.items : []);
  }

  if (!silent) {
    if (data && data.created) {
      setLocalBackupStatus('手动备份已创建成功。', 'success');
      showToast(`${backupKindLabel(kind)}已创建`, 'success');
    } else if (data && data.skipped) {
      setLocalBackupStatus('本次自动备份已跳过，因为近期已经创建过备份。', 'warning');
      showToast(`${backupKindLabel(kind)}跳过（时间间隔未到）`, 'warning');
    }
  }

  return data;
}

async function createManualLocalBackup() {
  setLocalBackupBusy(true, 'create', '');
  setLocalBackupStatus('正在创建手动备份...', 'info');
  syncLocalBackupButtons();
  try {
    await createLocalBackupByKind('manual', '手动备份', { skipRecentHours: 0, silent: false });
  } catch (error) {
    setLocalBackupStatus(`手动备份失败：${(error && error.message) || 'unknown error'}`, 'error');
    showToast(`手动备份失败：${(error && error.message) || 'unknown error'}`, 'error');
  } finally {
    setLocalBackupBusy(false, '', '');
    syncLocalBackupButtons();
  }
}

function downloadLocalBackupById(backupId) {
  const id = String(backupId || '').trim();
  if (!id) return;
  const url = `/api/local-backups/${encodeURIComponent(id)}/download`;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setLocalBackupStatus(`已开始下载备份 ${id}，浏览器会保存为 tar.gz 文件。`, 'success');
}

async function restoreLocalBackupById(backupId) {
  const id = String(backupId || '').trim();
  if (!id) return;
  const ok = confirm('恢复该备份会覆盖当前数据，恢复前会自动创建一份安全备份，确认继续？');
  if (!ok) return;

  setLocalBackupBusy(true, 'restore', id);
  setLocalBackupStatus(`正在恢复备份 ${id}，请稍候...`, 'warning');
  syncLocalBackupButtons();

  try {
    const restoreData = await fetchJsonWithAuth('/api/local-backups/restore', {
      method: 'POST',
      body: { backupId: id, createSafetyBackup: true }
    });
    const restoredBackup = restoreData && restoreData.backup ? restoreData.backup : null;
    if (!restoredBackup) {
      throw new Error('restored snapshot payload missing after restore');
    }
    await applyCloudBackup(
      { ...restoredBackup, summary: restoreData.summary || restoredBackup.summary || {} },
      restoreData.updatedAt || restoredBackup.exportTime || '',
      {
        silent: true,
        forceOverwriteLocal: true,
        staged: true,
        skipCompletionAlert: true
      }
    );
    if (typeof refreshWorkspaceAfterKnowledgeDataChange === 'function') {
      refreshWorkspaceAfterKnowledgeDataChange({ sidebar: true, notes: true, rightPanel: true });
    } else {
      if (typeof invalidateKnowledgeTreeRenderState === 'function') invalidateKnowledgeTreeRenderState();
      renderSidebar();
      renderAll();
      renderNotesByType();
      if (typeof renderNotesPanelRight === 'function') renderNotesPanelRight();
    }
    await refreshLocalBackups();
    setLocalBackupStatus(`恢复成功：已切回备份 ${id}，本地数据已刷新。`, 'success');
    showToast('本地备份恢复成功，本地数据已刷新', 'success');
  } catch (error) {
    setLocalBackupStatus(`恢复失败：${(error && error.message) || 'unknown error'}`, 'error');
    showToast(`恢复失败：${(error && error.message) || 'unknown error'}`, 'error');
  } finally {
    setLocalBackupBusy(false, '', '');
    syncLocalBackupButtons();
  }
}

async function deleteLocalBackupById(backupId) {
  const id = String(backupId || '').trim();
  if (!id) return;
  if (!confirm('确认删除这份本地备份？')) return;

  setLocalBackupBusy(true, 'delete', id);
  setLocalBackupStatus(`正在删除备份 ${id}...`, 'warning');
  syncLocalBackupButtons();

  try {
    const data = await fetchJsonWithAuth(`/api/local-backups/${encodeURIComponent(id)}`, { method: 'DELETE' });
    localBackupUiState.message = '';
    localBackupUiState.tone = 'info';
    renderLocalBackupList(data && data.items ? data.items : []);
    setLocalBackupStatus(`删除成功：备份 ${id} 已移除。`, 'success');
    showToast('本地备份已删除', 'success');
  } catch (error) {
    setLocalBackupStatus(`删除失败：${(error && error.message) || 'unknown error'}`, 'error');
    showToast(`删除失败：${(error && error.message) || 'unknown error'}`, 'error');
  } finally {
    setLocalBackupBusy(false, '', '');
    syncLocalBackupButtons();
  }
}

async function ensureDailyLocalBackup() {
  const todayKey = today();
  try {
    const last = localStorage.getItem(KEY_LOCAL_BACKUP_LAST_AUTO_DAY) || '';
    if (last === todayKey) return;
  } catch (e) {}
  try {
    await createLocalBackupByKind('auto', '每日自动备份', {
      skipRecentHours: 20,
      silent: true
    });
    try { localStorage.setItem(KEY_LOCAL_BACKUP_LAST_AUTO_DAY, todayKey); } catch (e) {}
  } catch (error) {
    console.warn('daily local backup failed', error);
  }
}

window.ensureLocalBackupMenuButton = ensureLocalBackupMenuButton;
window.openLocalBackupModalFromMore = openLocalBackupModalFromMore;
window.refreshLocalBackups = refreshLocalBackups;
window.createManualLocalBackup = createManualLocalBackup;
window.downloadLocalBackupById = downloadLocalBackupById;
window.restoreLocalBackupById = restoreLocalBackupById;
window.deleteLocalBackupById = deleteLocalBackupById;
window.ensureDailyLocalBackup = ensureDailyLocalBackup;
