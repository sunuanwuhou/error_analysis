// ============================================================
// Cloud UI rendering helpers
// ============================================================
function renderCloudUi() {
  const badge = document.getElementById('cloudUserBadge');
  const syncBadge = document.getElementById('cloudSyncBadge');
  const syncHint = document.getElementById('cloudSyncHint');
  const originStatus = document.getElementById('cloudOriginStatus');
  const detailsToggle = document.getElementById('cloudDetailsToggle');
  const logoutBtn = document.getElementById('cloudLogoutBtn');
  if (!badge || !logoutBtn || !syncBadge || !syncHint || !originStatus || !detailsToggle) return;
  if (cloudUser) {
    badge.textContent = 'Cloud: ' + cloudUser.username;
    logoutBtn.style.display = '';
  } else {
    badge.textContent = 'Cloud: offline';
    logoutBtn.style.display = '';
  }
  syncBadge.className = `cloud-status-badge ${cloudSyncState}`;
  syncBadge.textContent = ({
    idle: 'idle',
    dirty: 'local changed',
    saving: 'syncing',
    synced: 'synced',
    error: 'sync failed'
  })[cloudSyncState] || cloudSyncState;
  const currentOrigin = mergeCurrentOriginStatus();
  const originText = currentOrigin.origin || getCloudOriginKey();
  const timeText = formatCloudTime(cloudSyncUpdatedAt || cloudMeta.lastSavedAt || cloudMeta.lastLoadedAt || '');
  const cloudUpdatedText = formatCloudTime(cloudMeta.lastSeenBackupAt || currentOrigin.lastBackupUpdatedAt || '');
  const localUpdatedText = formatCloudTime(currentOrigin.lastLocalChangeAt || currentOrigin.lastSavedAt || currentOrigin.lastLoadedAt || '');
  syncHint.textContent = [
    `账号: ${cloudUser ? cloudUser.username : 'offline'}`,
    `当前域名: ${originText}`,
    cloudSyncMessage || '',
    timeText ? `Last event: ${timeText}` : '',
    localUpdatedText ? `当前最后修改: ${localUpdatedText}` : '',
    cloudUpdatedText ? `云端备份: ${cloudUpdatedText}` : '',
    'Local cache is per origin.'
  ].filter(Boolean).join(' | ');
  const currentMs = toCloudTimeMs(getOriginDisplayTime(currentOrigin));
  const newerOrigins = (cloudOriginStatuses || []).filter(item => item.origin !== originText).filter(item => currentMs && currentMs > toCloudTimeMs(getOriginDisplayTime(item)));
  const lines = [];
  if (newerOrigins.length) lines.push(`<div class="cloud-origin-alert">当前域名修改时间更新，已晚于其他 ${newerOrigins.length} 个入口</div>`);
  const mergedItems = [currentOrigin].concat((cloudOriginStatuses || []).filter(item => item.origin !== originText));
  mergedItems.forEach(item => {
    const label = item.origin === originText ? '当前' : '其他';
    const localText = formatCloudTime(item.lastLocalChangeAt || item.lastSavedAt || item.lastLoadedAt || '');
    const cloudText = formatCloudTime(item.lastBackupUpdatedAt || '');
    const suffix = [
      localText ? `本地: ${localText}` : '',
      cloudText ? `云端: ${cloudText}` : ''
    ].filter(Boolean).join(' | ');
    lines.push(`<div>${escapeHtml(label)} ${escapeHtml(item.origin)}${suffix ? ` | ${escapeHtml(suffix)}` : ''}</div>`);
  });
  originStatus.innerHTML = lines.join('');
}

function getCloudSyncBadgeLabel(state) {
  return ({
    idle: '就绪',
    dirty: '本地较新',
    saving: '后台处理中',
    synced: '已对齐',
    error: '需处理'
  })[state] || state;
}

function getCloudFreshnessText(localIso, cloudIso) {
  const localMs = toCloudTimeMs(localIso);
  const cloudMs = toCloudTimeMs(cloudIso);
  if (!localMs && !cloudMs) return '';
  if (localMs && !cloudMs) return '当前只有本地记录，云端还没有备份';
  if (!localMs && cloudMs) return '当前只有云端记录，本地还没有记录';
  if (localMs > cloudMs) return '本地时间更新，后续会在后台继续对齐';
  if (cloudMs > localMs) return '云端时间更新，建议先确认后再覆盖';
  return '本地与云端时间一致';
}

function getCloudActionHint(state) {
  const manual = typeof isManualCloudSyncOnly === 'function' && isManualCloudSyncOnly();
  if (state === 'error') return '可点 Cloud Load 或 Cloud Save 重新处理';
  if (manual) {
    if (state === 'dirty') return '本地改动已记录，点击 Cloud Save 上传到云端';
    if (state === 'saving') return '正在处理，请稍候';
    if (state === 'synced') return '当前入口和云端已经对齐';
    return '默认使用本地数据，需要时再点 Cloud Load 或 Cloud Save';
  }
  if (state === 'dirty') return '本地改动已记住，系统会在后台继续处理';
  if (state === 'saving') return '正在后台处理，不需要重复点击';
  if (state === 'synced') return '当前入口和云端已经对齐';
  return '默认先使用本地数据，必要时再后台检查云端';
}

function getLastIncrementalAlignedIso() {
  return String((cloudMeta && cloudMeta.lastIncrementalAlignedAt) || '').trim();
}

renderCloudUi = function() {
  const badge = document.getElementById('cloudUserBadge');
  const syncBadge = document.getElementById('cloudSyncBadge');
  const syncHint = document.getElementById('cloudSyncHint');
  const originStatus = document.getElementById('cloudOriginStatus');
  const detailsToggle = document.getElementById('cloudDetailsToggle');
  const logoutBtn = document.getElementById('cloudLogoutBtn');
  if (!badge || !logoutBtn || !syncBadge || !syncHint || !originStatus || !detailsToggle) return;
  if (cloudUser) {
    badge.textContent = 'Cloud: ' + cloudUser.username;
    logoutBtn.style.display = '';
  } else {
    badge.textContent = 'Cloud: offline';
    logoutBtn.style.display = '';
  }
  syncBadge.className = `cloud-status-badge ${cloudSyncState}`;
  syncBadge.textContent = getCloudSyncBadgeLabel(cloudSyncState);
  const currentOrigin = mergeCurrentOriginStatus();
  const originText = currentOrigin.origin || getCloudOriginKey();
  const currentLocalIso = currentOrigin.lastLocalChangeAt || currentOrigin.lastSavedAt || currentOrigin.lastLoadedAt || '';
  const currentCloudBackupIso = currentOrigin.lastBackupUpdatedAt || cloudMeta.lastSeenBackupAt || '';
  const currentIncrementalIso = getLastIncrementalAlignedIso();
  const cloudIncrementalText = formatCloudTime(currentIncrementalIso);
  const cloudBackupText = formatCloudTime(currentCloudBackupIso);
  const currentCloudIsoForFreshness = currentIncrementalIso || currentCloudBackupIso;
  const localUpdatedText = formatCloudTime(currentLocalIso);
  const freshnessText = getCloudFreshnessText(currentLocalIso, currentCloudIsoForFreshness);
  const hintLines = [
    localUpdatedText ? `本地最后修改: ${localUpdatedText}` : '本地最后修改: 暂无',
    cloudIncrementalText ? `云端最后增量同步: ${cloudIncrementalText}` : '云端最后增量同步: 暂无',
    cloudBackupText ? `云端最后全量备份: ${cloudBackupText}` : '云端最后全量备份: 暂无',
    freshnessText,
    cloudSyncMessage || '',
    getCloudActionHint(cloudSyncState)
  ].filter(Boolean);
  syncHint.innerHTML = hintLines.map(line => `<div>${escapeHtml(line)}</div>`).join('');
  const currentMs = toCloudTimeMs(getOriginDisplayTime(currentOrigin));
  const newerOrigins = (cloudOriginStatuses || []).filter(item => item.origin !== originText).filter(item => currentMs && currentMs > toCloudTimeMs(getOriginDisplayTime(item)));
  const lines = [];
  if (newerOrigins.length) lines.push(`<div class="cloud-origin-alert">当前入口比其他 ${newerOrigins.length} 个入口更新，保存前请确认是否要覆盖云端</div>`);
  lines.push(`<div>当前入口: ${escapeHtml(originText)}</div>`);
  lines.push(`<div>本地最后修改: ${escapeHtml(localUpdatedText || '暂无')}</div>`);
  lines.push(`<div>云端最后增量同步: ${escapeHtml(cloudIncrementalText || '暂无')}</div>`);
  lines.push(`<div>云端最后全量备份: ${escapeHtml(cloudBackupText || '暂无')}</div>`);
  const mergedItems = [currentOrigin].concat((cloudOriginStatuses || []).filter(item => item.origin !== originText));
  mergedItems.forEach(item => {
    const label = item.origin === originText ? '当前' : '其他';
    const localText = formatCloudTime(item.lastLocalChangeAt || item.lastSavedAt || item.lastLoadedAt || '');
    const cloudText = formatCloudTime(item.lastBackupUpdatedAt || '');
    const suffix = [
      localText ? `本地: ${localText}` : '',
      cloudText ? `云端: ${cloudText}` : ''
    ].filter(Boolean).join(' | ');
    lines.push(`<div>${escapeHtml(label)} ${escapeHtml(item.origin)}${suffix ? ` | ${escapeHtml(suffix)}` : ''}</div>`);
  });
  detailsToggle.textContent = cloudDetailsExpanded ? '收起' : '详情';
  originStatus.classList.toggle('expanded', cloudDetailsExpanded);
  originStatus.innerHTML = lines.join('');
};
