// ============================================================
// Dashboard / home workbench
// ============================================================
let _dashTrendDays = 7;
let _practiceInsightsState = { loading: false, loaded: false, error: '', data: null };
let _practiceWorkbenchState = { loading: false, loaded: false, error: '', data: null };
let _recommendedNotesReturnEnabled = false;
let _homeLaunchActionConsumed = false;

function consumeHomeLaunchAction() {
  if (_homeLaunchActionConsumed) return;
  const params = new URLSearchParams(window.location.search || '');
  const action = String(params.get('home_action') || '').trim().toLowerCase();
  const recommendedNoteId = String(params.get('node_id') || '').trim();
  const editErrorId = String(params.get('error_id') || '').trim();
  const backupId = String(params.get('backup_id') || '').trim();
  if (!action) return;
  _homeLaunchActionConsumed = true;
  params.delete('home_action');
  params.delete('node_id');
  params.delete('error_id');
  params.delete('backup_id');
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
  window.history.replaceState({}, '', nextUrl);
  if (typeof switchAppView === 'function') switchAppView('home');
  setTimeout(() => {
    if (action === 'note') {
      openRecommendedNotesModal();
      return;
    }
    if (action === 'recommended_notes') {
      if (typeof openRecommendedNotesModal === 'function') openRecommendedNotesModal();
      return;
    }
    if (action === 'recommended_notes_return') {
      if (typeof returnToRecommendedNotes === 'function') returnToRecommendedNotes();
      return;
    }
    if (action === 'recommended_note') {
      if (recommendedNoteId && typeof openRecommendedNote === 'function') openRecommendedNote(recommendedNoteId);
      return;
    }
    if (action === 'direct' || action === 'speed' || action === 'daily') {
      startPracticeQueue(action === 'daily' ? 'daily' : action);
      return;
    }
    if (action === 'dashboard') {
      openDashboard();
      return;
    }
    if (action === 'cloud_load') {
      if (typeof loadCloudBackup === 'function') loadCloudBackup({ silent: false });
      return;
    }
    if (action === 'cloud_save') {
      if (typeof saveCloudBackup === 'function') saveCloudBackup({ silent: false });
      return;
    }
    if (action === 'workspace_notes') {
      if (typeof openWorkspaceView === 'function') openWorkspaceView('notes');
      return;
    }
    if (action === 'workspace_errors') {
      if (typeof openWorkspaceView === 'function') openWorkspaceView('errors');
      return;
    }
    if (action === 'taskview_errors') {
      if (typeof openWorkspaceTaskView === 'function') openWorkspaceTaskView('errors');
      return;
    }
    if (action === 'taskview_notes') {
      if (typeof openWorkspaceTaskView === 'function') openWorkspaceTaskView('notes');
      return;
    }
    if (action === 'codex') {
      if (typeof openCodexInboxModal === 'function') openCodexInboxModal();
      return;
    }
    if (action === 'history') {
      if (typeof openHistory === 'function') openHistory();
      return;
    }
    if (action === 'ai_tools') {
      if (typeof openAIToolsModal === 'function') openAIToolsModal();
      return;
    }
    if (action === 'local_backup') {
      if (typeof openLocalBackupModal === 'function') openLocalBackupModal();
      return;
    }
    if (action === 'local_backup_create') {
      if (typeof createManualLocalBackup === 'function') createManualLocalBackup();
      return;
    }
    if (action === 'local_backup_refresh') {
      if (typeof refreshLocalBackups === 'function') refreshLocalBackups();
      return;
    }
    if (action === 'local_backup_restore') {
      if (backupId && typeof restoreLocalBackup === 'function') restoreLocalBackup(backupId);
      return;
    }
    if (action === 'local_backup_delete') {
      if (backupId && typeof deleteLocalBackup === 'function') deleteLocalBackup(backupId);
      return;
    }
    if (action === 'export') {
      if (typeof openExportModal === 'function') openExportModal();
      return;
    }
    if (action === 'remark_list') {
      if (typeof openRemarkListModal === 'function') openRemarkListModal();
      return;
    }
    if (action === 'remark_daily_log') {
      if (typeof openRemarkListModal === 'function') openRemarkListModal();
      setTimeout(() => {
        if (typeof insertGlobalRemarkDailyLog === 'function') insertGlobalRemarkDailyLog();
      }, 40);
      return;
    }
    if (action === 'daily_journal') {
      if (typeof openDailyJournalModal === 'function') openDailyJournalModal();
      return;
    }
    if (action === 'daily_journal_today') {
      if (typeof jumpDailyJournalToToday === 'function') jumpDailyJournalToToday();
      return;
    }
    if (action === 'daily_journal_template') {
      if (typeof insertDailyJournalTemplate === 'function') insertDailyJournalTemplate();
      return;
    }
    if (action === 'global_search') {
      if (typeof openGlobalSearchModal === 'function') openGlobalSearchModal();
      return;
    }
    if (action === 'add_modal') {
      if (typeof openAddModal === 'function') openAddModal();
      return;
    }
    if (action === 'edit_error') {
      if (editErrorId && typeof openEditModal === 'function') openEditModal(editErrorId);
      return;
    }
    if (action === 'import') {
      if (typeof openImportModal === 'function') openImportModal();
      return;
    }
    if (action === 'quick_import') {
      if (typeof openQuickImportModal === 'function') openQuickImportModal();
      return;
    }
    if (action === 'dir_modal') {
      if (typeof openDirModal === 'function') openDirModal();
      return;
    }
    if (action === 'knowledge_move') {
      if (typeof openBatchKnowledgeMove === 'function') openBatchKnowledgeMove();
      return;
    }
    if (action === 'knowledge_node') {
      if (typeof openKnowledgeNodeModal === 'function') openKnowledgeNodeModal('create-root');
      return;
    }
    if (action === 'type_rules') {
      if (typeof openTypeRulesModal === 'function') openTypeRulesModal();
      return;
    }
    if (action === 'claude_helper') {
      if (typeof openClaudeHelper === 'function') openClaudeHelper();
      return;
    }
    if (action === 'claude_bank') {
      if (typeof openClaudeBankModal === 'function') openClaudeBankModal();
      return;
    }
    if (action === 'claude_bank_refresh') {
      if (typeof openClaudeBankModal === 'function') openClaudeBankModal();
      setTimeout(() => {
        if (typeof refreshClaudeBankModal === 'function') refreshClaudeBankModal();
      }, 40);
      return;
    }
    if (action === 'canvas') {
      if (typeof openCanvas === 'function') openCanvas();
      return;
    }
    if (action === 'full') {
      if (typeof startFullPractice === 'function') startFullPractice();
      return;
    }
    if (action === 'quickadd') {
      if (typeof openWorkspaceQuickAdd === 'function') {
        openWorkspaceQuickAdd();
        return;
      }
      if (typeof openQuickAddModal === 'function') openQuickAddModal();
    }
  }, 80);
}

function getNoteReviewRecord(nodeId) {
  return (noteReviewTracking && noteReviewTracking[nodeId]) || {};
}

function markRecommendedNoteViewed(nodeId, meta) {
  const nowIso = new Date().toISOString();
  const todayKey = today();
  noteReviewTracking = noteReviewTracking || {};
  const current = getNoteReviewRecord(nodeId);
  noteReviewTracking[nodeId] = {
    ...current,
    nodeId,
    lastViewedAt: nowIso,
    lastViewedDate: todayKey,
    lastRecommendedAt: current.lastRecommendedAt || nowIso,
    lastRecommendedDate: current.lastRecommendedDate || todayKey,
    lastSource: (meta && meta.source) || current.lastSource || 'recommended_notes',
    viewCount: Number(current.viewCount || 0) + 1,
  };
  if (typeof saveNoteReviewTracking === 'function') saveNoteReviewTracking();
}

function markRecommendedNoteReminder(nodeId) {
  if (!nodeId) return;
  noteReviewTracking = noteReviewTracking || {};
  const current = getNoteReviewRecord(nodeId);
  noteReviewTracking[nodeId] = {
    ...current,
    nodeId,
    lastRecommendedAt: new Date().toISOString(),
    lastRecommendedDate: today(),
  };
  if (typeof saveNoteReviewTracking === 'function') saveNoteReviewTracking();
}

function wasRecommendedNoteViewedToday(nodeId) {
  return String(getNoteReviewRecord(nodeId).lastViewedDate || '') === today();
}

function renderActionList(items, emptyText) {
  if (!Array.isArray(items) || !items.length) {
    return `<div class="home-action-item"><strong>暂无</strong><span>${escapeHtml(emptyText)}</span></div>`;
  }
  return items.map(item => `
    <div class="home-action-item">
      <strong>${escapeHtml(item.title || item.name || '')}</strong>
      <span>${escapeHtml(item.description || item.taskReason || '')}</span>
    </div>
  `).join('');
}

function renderTaskPreview(items, emptyTitle, emptyDesc) {
  if (!Array.isArray(items) || !items.length) {
    return `<div class="home-note-item"><strong>${escapeHtml(emptyTitle)}</strong><span>${escapeHtml(emptyDesc)}</span></div>`;
  }
  return items.slice(0, 3).map(item => `
    <div class="home-note-item">
      <strong>${escapeHtml((item.question || '').slice(0, 42) || '待处理题目')}</strong>
      <span>${escapeHtml(item.taskReason || (item.priorityReasons || []).join(' / ') || '按当前优先级处理')}</span>
    </div>
  `).join('');
}

function renderInsightChips(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<div style="color:#bbb;font-size:12px;padding:10px 0">暂无可用数据</div>';
  }
  return items.map(item => `
    <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:#f5f5f5;color:#555;font-size:12px;margin:0 8px 8px 0">
      ${escapeHtml(item.name || '')}
      <strong style="color:#111">${Number(item.count || 0)}</strong>
    </span>
  `).join('');
}

function ensureRecommendedNotesModal() {
  let mask = document.getElementById('recommendedNotesModal');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'recommendedNotesModal';
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal" style="width:760px;max-width:96vw;max-height:88vh;overflow-y:auto">
      <button class="modal-close" type="button" data-onclick="closeModal('recommendedNotesModal')">×</button>
      <h2 style="margin-bottom:6px">推荐笔记</h2>
      <div style="font-size:12px;color:#888;margin-bottom:14px">按最近错题和知识点聚合，帮助你决定今天先看哪条笔记。</div>
      <div id="recommendedNotesBody"></div>
    </div>
  `;
  document.body.appendChild(mask);
  return mask;
}

function buildRecommendedNoteGroups(items) {
  const groups = new Map();
  (items || []).forEach(item => {
    const nodeId = String(item.noteNodeId || '').trim();
    if (!nodeId || typeof getKnowledgeNodeById !== 'function') return;
    const node = getKnowledgeNodeById(nodeId);
    if (!node) return;
    if (!groups.has(nodeId)) {
      const pathTitles = typeof getKnowledgePathTitles === 'function' ? getKnowledgePathTitles(nodeId) : [node.title || ''];
      groups.set(nodeId, {
        nodeId,
        title: node.title || '未命名笔记',
        pathText: Array.isArray(pathTitles) ? pathTitles.join(' > ') : String(node.title || ''),
        contentMd: String(node.contentMd || ''),
        items: [],
        seenToday: wasRecommendedNoteViewedToday(nodeId),
      });
    }
    groups.get(nodeId).items.push(item);
  });
  return Array.from(groups.values()).sort((a, b) => {
    if (a.seenToday !== b.seenToday) return a.seenToday ? 1 : -1;
    return b.items.length - a.items.length;
  });
}

function buildMissingNoteItems(items) {
  return (items || []).filter(item => {
    const nodeId = String(item.noteNodeId || '').trim();
    if (!nodeId) return true;
    if (typeof getKnowledgeNodeById !== 'function') return false;
    const node = getKnowledgeNodeById(nodeId);
    return !node || !String(node.contentMd || '').trim();
  });
}

function filterPendingRecommendedGroups(groups) {
  return (groups || []).filter(group => !group.seenToday);
}

function getRiskWarningText(item) {
  const wrongCount = Number(item.recentWrongCount || item.recentWrong || 0);
  const confidence = Number(item.lastConfidence || item.confidence || 0);
  if (wrongCount >= 2) return '这类错题已经重复出现，要特别警惕。';
  if (confidence && confidence <= 2) return '这类题当前把握度仍低，建议看完后尽快验证。';
  return item.taskReason || '先看这条笔记，再进入相关题目。';
}

function openRecommendedNote(nodeId) {
  closeModal('recommendedNotesModal');
  _recommendedNotesReturnEnabled = true;
  window.__recommendedNotesReturnEnabled = true;
  markRecommendedNoteViewed(nodeId, { source: 'recommended_notes' });
  if (typeof setCurrentKnowledgeNode === 'function') {
    setCurrentKnowledgeNode(nodeId, { switchTab: true, mode: 'note' });
    return;
  }
  if (typeof openWorkspaceView === 'function') {
    openWorkspaceView('notes');
  }
}

function returnToRecommendedNotes() {
  _recommendedNotesReturnEnabled = false;
  window.__recommendedNotesReturnEnabled = false;
  if (typeof switchAppView === 'function') {
    switchAppView('home');
  }
  setTimeout(() => {
    openRecommendedNotesModal();
  }, 30);
}

function openRecommendedNotesModal() {
  const taskPack = typeof buildPracticeTaskPack === 'function' ? buildPracticeTaskPack(12) : null;
  const remotePack = _practiceWorkbenchState.loaded ? (_practiceWorkbenchState.data || {}) : null;
  const rawGroups = buildRecommendedNoteGroups(remotePack?.noteFirstQueue || taskPack?.noteFirstQueue || []);
  const pendingGroups = filterPendingRecommendedGroups(rawGroups);
  const missingNoteItems = buildMissingNoteItems(remotePack?.noteFirstQueue || taskPack?.noteFirstQueue || []);

  rawGroups.forEach(group => markRecommendedNoteReminder(group.nodeId));
  ensureRecommendedNotesModal();

  const body = document.getElementById('recommendedNotesBody');
  if (!body) return;
  if (!pendingGroups.length && !missingNoteItems.length) {
    body.innerHTML = `
      <div class="home-note-item">
        <strong>今天需要先看的笔记已经看过了</strong>
        <span>今天先不用重复看；如果明天还没处理对应错题，系统会继续提醒。</span>
      </div>`;
  } else {
    const missingHtml = missingNoteItems.length ? `
      <div class="home-dashboard-card" style="margin-bottom:12px;border:1px solid #fecaca;background:#fff7f7">
        <h3 style="margin-bottom:6px;color:#b42318">缺笔记提醒</h3>
        <div style="font-size:12px;color:#7a271a;line-height:1.8">
          有 ${missingNoteItems.length} 道需要“先看笔记”的题还没有可看的笔记内容。建议先补一条简短规则总结，不然明天还会继续提醒。
        </div>
      </div>` : '';

    const groupsHtml = pendingGroups.map(group => {
      const summary = String(group.contentMd || '').replace(/[#>*`\-\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
      const riskText = getRiskWarningText(group.items[0] || {});
      return `
        <div class="home-dashboard-card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
            <div style="flex:1;min-width:0">
              <h3 style="margin-bottom:6px">${escapeHtml(group.title)}</h3>
              <div style="font-size:12px;color:#888;line-height:1.6">${escapeHtml(group.pathText)}</div>
              <div style="font-size:12px;color:#b42318;line-height:1.7;margin-top:8px">${escapeHtml(riskText)}</div>
              <div style="font-size:12px;color:#666;line-height:1.7;margin-top:8px">${escapeHtml(summary || '这条笔记还没有内容，建议先补一条简短规则总结。')}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
              <span class="knowledge-tree-count">${group.items.length} 题</span>
              <button class="btn btn-secondary btn-sm" type="button" onclick="openRecommendedNote('${escapeHtml(group.nodeId)}')">打开笔记</button>
            </div>
          </div>
        </div>`;
    }).join('');

    body.innerHTML = missingHtml + groupsHtml;
  }
  openModal('recommendedNotesModal');
}

async function openDashboard() {
  const mount = document.getElementById('dashboardContent');
  if (!mount) return;
  openModal('dashboardModal');
  mount.innerHTML = '<div style="color:#888;font-size:13px;padding:18px 0">正在整理任务统计...</div>';
  await ensurePracticeInsightsLoaded();
  const taskPack = typeof buildPracticeTaskPack === 'function' ? buildPracticeTaskPack(18) : null;
  const workbench = _practiceWorkbenchState.data || {};
  const insights = _practiceInsightsState.data || {};
  const noteFirstQueue = workbench.noteFirstQueue || taskPack?.noteFirstQueue || [];
  const directDoQueue = workbench.directDoQueue || taskPack?.directDoQueue || [];
  const speedDrillQueue = workbench.speedDrillQueue || taskPack?.speedDrillQueue || [];
  const weakestReasons = workbench.weakestReasons || insights.weakestReasons || taskPack?.weakestReasons || [];
  const weakestTypes = workbench.weakestTypes || insights.weakestTypes || taskPack?.weakestTypes || [];
  const behavior = workbench.behavior || taskPack?.behavior || {};
  mount.innerHTML = `
    <div class="dash-section">
      <div class="dash-section-title">今日主线</div>
      <div class="dash-summary-row">
        <div class="dash-summary-card"><div class="dash-summary-num">${filterPendingRecommendedGroups(buildRecommendedNoteGroups(noteFirstQueue)).length}</div><div class="dash-summary-label">待看笔记</div></div>
        <div class="dash-summary-card"><div class="dash-summary-num">${directDoQueue.length}</div><div class="dash-summary-label">直接开做</div></div>
        <div class="dash-summary-card"><div class="dash-summary-num">${speedDrillQueue.length}</div><div class="dash-summary-label">限时复训</div></div>
        <div class="dash-summary-card"><div class="dash-summary-num">${behavior.accuracy || 0}%</div><div class="dash-summary-label">近 7 日正确率</div></div>
      </div>
    </div>
    <div class="dash-section">
      <div class="dash-section-title">当前动作建议</div>
      ${renderActionList(workbench.workflowAdvice || workbench.advice || taskPack?.advice || [], '继续录题或进入工作台整理。')}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">高频弱点</div>
      ${renderInsightChips(weakestReasons)}
    </div>
    <div class="dash-section">
      <div class="dash-section-title">高频模块</div>
      ${renderInsightChips(weakestTypes)}
    </div>
  `;
}

async function ensurePracticeInsightsLoaded(force) {
  if (_practiceInsightsState.loading) return;
  if (_practiceInsightsState.loaded && !force) return;
  _practiceInsightsState.loading = true;
  _practiceInsightsState.error = '';
  try {
    const data = await fetchJsonWithAuth('/api/practice/insights?limit=6');
    _practiceInsightsState.data = data || null;
    _practiceInsightsState.loaded = !!(data && data.ok !== false);
  } catch (err) {
    console.warn('practice insights load failed:', err);
    _practiceInsightsState.error = err?.message || '加载失败';
  } finally {
    _practiceInsightsState.loading = false;
  }
}

async function ensurePracticeWorkbenchLoaded(force) {
  if (_practiceWorkbenchState.loading) return;
  if (_practiceWorkbenchState.loaded && !force) return;
  _practiceWorkbenchState.loading = true;
  _practiceWorkbenchState.error = '';
  try {
    const data = await fetchJsonWithAuth('/api/practice/workbench?limit=6');
    _practiceWorkbenchState.data = data || null;
    _practiceWorkbenchState.loaded = !!(data && data.ok !== false);
  } catch (err) {
    console.warn('practice workbench load failed:', err);
    _practiceWorkbenchState.error = err?.message || '工作台加载失败';
  } finally {
    _practiceWorkbenchState.loading = false;
    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
  }
}

function invalidatePracticeWorkbench() {
  _practiceWorkbenchState.loaded = false;
  _practiceWorkbenchState.loading = false;
  _practiceWorkbenchState.error = '';
  _practiceWorkbenchState.data = null;
}

function renderHomeDashboard() {
  const mount = document.getElementById('homeDashboardContent');
  if (!mount) return;
  if (!_practiceWorkbenchState.loaded && !_practiceWorkbenchState.loading) {
    ensurePracticeWorkbenchLoaded();
  }

  const hasFullData = typeof hasFullWorkspaceDataLoaded === 'function' ? hasFullWorkspaceDataLoaded() : true;
  const startupSummary = typeof getStartupSummaryCache === 'function' ? (getStartupSummaryCache() || {}) : {};
  const taskPack = (hasFullData && typeof buildPracticeTaskPack === 'function') ? buildPracticeTaskPack(12) : null;
  if (!taskPack && !_practiceWorkbenchState.loaded) {
    const startupAdvice = Array.isArray(startupSummary.workflowAdvice) ? startupSummary.workflowAdvice.slice(0, 4) : [];
    const todayDue = Number(startupSummary.todayDue || 0);
    const noteFirstCount = Number(startupSummary.noteFirstCount || 0);
    const directDoCount = Number(startupSummary.directDoCount || 0);
    const speedDrillCount = Number(startupSummary.speedDrillCount || 0);
    const accuracy = Number(startupSummary.accuracy || 0);
    const fullPracticeCount = Number(startupSummary.fullPracticeCount || 0);
    const weakestReasons = Array.isArray(startupSummary.weakestReasons) ? startupSummary.weakestReasons : [];
    mount.innerHTML = `
      <div class="home-dashboard-grid">
        <div class="home-dashboard-card">
          <h3>今天做什么</h3>
          <div class="home-metric-row">
            <div class="home-metric"><strong>${noteFirstCount}</strong><span>待看笔记</span></div>
            <div class="home-metric"><strong>${directDoCount}</strong><span>直接开做</span></div>
            <div class="home-metric"><strong>${speedDrillCount}</strong><span>限时复训</span></div>
            <div class="home-metric"><strong>${accuracy}%</strong><span>近 7 日正确率</span></div>
          </div>
          <div class="home-shell-actions" style="margin-top:14px">
            <button class="btn btn-primary" data-onclick="openRecommendedNotesModal()">先看笔记</button>
            <button class="btn btn-secondary" data-onclick="startPracticeQueue('direct')">直接开做</button>
            <button class="btn btn-secondary" data-onclick="startPracticeQueue('speed')">限时复训</button>
            <button class="btn btn-secondary" data-onclick="openDashboard()">看完整统计</button>
          </div>
          <div class="home-action-list" style="margin-top:16px">
            ${startupAdvice.length
              ? renderActionList(startupAdvice, '')
              : '<div class="home-action-item"><strong>正在轻启动</strong><span>首页先展示摘要，完整错题和笔记会在后台分批整理，进入工作台时再补齐。</span></div>'}
          </div>
        </div>
        <div class="home-dashboard-card">
          <h3>当前摘要</h3>
          <div class="home-note-list">
            <div class="home-note-item"><strong>今日任务池 ${todayDue} 道</strong><span>首页先按轻量摘要启动，避免手机和 iPad 一刷新就加载全量题库。</span></div>
            <div class="home-note-item"><strong>完整练习池 ${fullPracticeCount} 道</strong><span>进入工作台后才会补齐完整数据和细项队列。</span></div>
            <div class="home-note-item"><strong>工作台数据后台整理中</strong><span>${_practiceWorkbenchState.loading ? '正在刷新服务器任务摘要。' : '等待你进入工作台时再加载完整错题。'}</span></div>
          </div>
        </div>
        <div class="home-dashboard-card">
          <h3>当前高频弱点</h3>
          <div class="home-action-list">
            ${renderActionList(weakestReasons.map(item => ({ title: item.name, description: `最近出现 ${Number(item.count || 0)} 次` })), '完整弱点明细会在工作台或统计页继续展开。')}
          </div>
        </div>
      </div>`;
    return;
  }

  if (!taskPack && !_practiceWorkbenchState.loaded) {
    mount.innerHTML = '<div class="home-dashboard-card">首页数据暂不可用</div>';
    return;
  }

  const remotePack = _practiceWorkbenchState.loaded ? (_practiceWorkbenchState.data || {}) : null;
  const noteFirstQueue = remotePack?.noteFirstQueue || taskPack?.noteFirstQueue || [];
  const directDoQueue = remotePack?.directDoQueue || taskPack?.directDoQueue || [];
  const speedDrillQueue = remotePack?.speedDrillQueue || taskPack?.speedDrillQueue || [];
  const dailyQueue = remotePack?.dailyQueue || taskPack?.dailyQueue || [];
  const weakestReasons = remotePack?.weakestReasons || taskPack?.weakestReasons || [];
  const behavior = remotePack?.behavior || taskPack?.behavior || {};
  const workflowAdvice = (remotePack?.workflowAdvice || remotePack?.advice || taskPack?.advice || []).slice(0, 4);
  const pendingRecommendedGroups = filterPendingRecommendedGroups(buildRecommendedNoteGroups(noteFirstQueue));
  const missingNoteItems = buildMissingNoteItems(noteFirstQueue);

  const loadingHint = _practiceWorkbenchState.loading
    ? '<div class="home-action-item"><strong>任务工作台已接入</strong><span>正在后台刷新三类任务和弱点摘要。</span></div>'
    : '';

  mount.innerHTML = `
    <div class="home-dashboard-grid">
      <div class="home-dashboard-card">
        <h3>今天做什么</h3>
        <div class="home-metric-row">
          <div class="home-metric"><strong>${pendingRecommendedGroups.length}</strong><span>待看笔记</span></div>
          <div class="home-metric"><strong>${directDoQueue.length}</strong><span>直接开做</span></div>
          <div class="home-metric"><strong>${speedDrillQueue.length}</strong><span>限时复训</span></div>
          <div class="home-metric"><strong>${behavior ? (behavior.accuracy || 0) : 0}%</strong><span>近 7 日正确率</span></div>
        </div>
        <div class="home-shell-actions" style="margin-top:14px">
          <button class="btn btn-primary" data-onclick="openRecommendedNotesModal()">先看笔记</button>
          <button class="btn btn-secondary" data-onclick="startPracticeQueue('direct')">直接开做</button>
          <button class="btn btn-secondary" data-onclick="startPracticeQueue('speed')">限时复训</button>
          <button class="btn btn-secondary" data-onclick="openDashboard()">看完整统计</button>
        </div>
        <div class="home-action-list" style="margin-top:16px">
          ${workflowAdvice.length ? renderActionList(workflowAdvice, '') : (loadingHint || '<div class="home-action-item"><strong>暂无任务建议</strong><span>可以先进入工作台整理题目，系统会再逐步调度。</span></div>')}
        </div>
      </div>
      <div class="home-dashboard-card">
        <h3>待看笔记</h3>
        <div class="home-note-list">
          ${renderTaskPreview(pendingRecommendedGroups.flatMap(group => group.items), '今天需要先看的笔记已经看过了', '如果今天没做对应题，明天系统还会继续推荐。')}
        </div>
        <h3 style="margin-top:18px">直接开做</h3>
        <div class="home-note-list">
          ${renderTaskPreview(directDoQueue, '当前没有适合直接开的题', '可以先去整理错题或切到限时复训。')}
        </div>
        <h3 style="margin-top:18px">限时复训</h3>
        <div class="home-note-list">
          ${renderTaskPreview(speedDrillQueue, '当前没有需要压时间的题', '这批题目前没有明显的耗时风险。')}
        </div>
      </div>
      <div class="home-dashboard-card">
        <h3>当前高频弱点</h3>
        <div class="home-action-list">
          ${renderActionList(weakestReasons.map(item => ({ title: item.name, description: `最近出现 ${Number(item.count || 0)} 次` })), '继续保持当前节奏即可。')}
        </div>
        <h3 style="margin-top:18px">额外提醒</h3>
        <div class="home-action-list">
          ${missingNoteItems.length
            ? `<div class="home-action-item"><strong>有 ${missingNoteItems.length} 道题缺笔记</strong><span>这类题即使需要先看笔记，也暂时没有内容可看，建议尽快补规则总结。</span></div>`
            : '<div class="home-action-item"><strong>当前没有缺笔记提醒</strong><span>需要先看笔记的题目前都有对应内容。</span></div>'}
          <div class="home-action-item"><strong>总任务池 ${dailyQueue.length} 道</strong><span>首页负责调度今天先看什么、做什么、压哪一批时间。</span></div>
        </div>
      </div>
    </div>`;
}

window.renderHomeDashboard = renderHomeDashboard;
window.invalidatePracticeWorkbench = invalidatePracticeWorkbench;
window.openRecommendedNotesModal = openRecommendedNotesModal;
window.openRecommendedNote = openRecommendedNote;
window.returnToRecommendedNotes = returnToRecommendedNotes;
window.consumeHomeLaunchAction = consumeHomeLaunchAction;
