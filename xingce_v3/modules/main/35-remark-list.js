// ============================================================
// Global remark + daily journal
// ============================================================
function getTodayLocalDateText() {
  try {
    return new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
  } catch (error) {
    return new Date().toISOString().slice(0, 10);
  }
}

function countDoneItems(raw) {
  return (String(raw || '').match(/\[x\]|（已完成.*?）|\(已完成.*?\)/g) || []).length;
}

function buildMarkdownPreview(raw, emptyText) {
  const content = String(raw || '');
  if (!content.trim()) {
    return `<div class="remark-preview-empty">${escapeHtml(emptyText || '暂无内容')}</div>`;
  }
  return renderMd(content);
}

function updateGlobalRemarkMeta() {
  const textarea = document.getElementById('globalNoteTA');
  const meta = document.getElementById('globalRemarkMeta');
  if (!textarea || !meta) return;
  const raw = String(textarea.value || '');
  const lines = raw ? raw.replace(/\r/g, '').split('\n').length : 0;
  meta.textContent = `共 ${raw.length} 字 · ${lines} 行 · 已完成 ${countDoneItems(raw)} 项`;
}

function bindSaveHotkey(textarea, saver) {
  if (!textarea || textarea.dataset.saveBound === '1') return;
  textarea.dataset.saveBound = '1';
  textarea.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 's') {
      event.preventDefault();
      saver();
    }
  });
}

function ensureGlobalRemarkModal() {
  let modal = document.getElementById('globalRemarkModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.id = 'globalRemarkModal';
  modal.innerHTML = `
    <div class="modal remark-list-modal remark-md-modal">
      <button class="modal-close" type="button" onclick="closeModal('globalRemarkModal')">×</button>
      <h2>备注</h2>
      <div class="remark-list-toolbar">
        <div>
          <div class="remark-list-summary">整个系统共用一个备注字段，支持 Markdown、实时预览和完成标记。</div>
          <div class="remark-list-meta" id="globalRemarkMeta"></div>
        </div>
        <div class="remark-list-actions">
          <button class="btn btn-secondary btn-sm" type="button" onclick="normalizeGlobalRemarkChecklist()">转任务清单</button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="markGlobalRemarkSelectionDone()">标记做完</button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="insertGlobalRemarkDailyLog()">插入日志模板</button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="clearGlobalRemarkModal()">清空</button>
          <button class="btn btn-primary btn-sm" type="button" onclick="saveGlobalRemarkModal()">保存</button>
        </div>
      </div>
      <div class="remark-md-toolbar">
        <button class="btn btn-secondary btn-sm" type="button" onclick="mdInsert('heading')">标题</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="mdInsert('bold')">加粗</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="mdInsert('italic')">斜体</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="mdInsert('list')">列表</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="mdInsert('code')">行内代码</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="mdInsert('codeblock')">代码块</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="mdInsert('table')">表格</button>
      </div>
      <div class="remark-md-layout">
        <div class="remark-md-pane">
          <div class="remark-md-pane-title">编辑</div>
          <textarea id="globalNoteTA" class="remark-item-textarea remark-global-textarea" placeholder="# 系统备注&#10;&#10;- [ ] 要做的事&#10;- [x] 做完的事（已完成 2026-04-08）" oninput="liveNotePreview();updateGlobalRemarkMeta()"></textarea>
        </div>
        <div class="remark-md-pane">
          <div class="remark-md-pane-title">预览</div>
          <div id="noteEditPreview" class="remark-md-preview notes-content"></div>
        </div>
      </div>
    </div>
  `;
  modal.addEventListener('click', function(event) {
    if (event.target === modal) closeModal('globalRemarkModal');
  });
  document.body.appendChild(modal);
  bindSaveHotkey(modal.querySelector('#globalNoteTA'), saveGlobalRemarkModal);
  return modal;
}

function openRemarkListModal() {
  ensureGlobalRemarkModal();
  const textarea = document.getElementById('globalNoteTA');
  if (textarea) {
    textarea.value = String(globalNote || '');
    liveNotePreview();
    updateGlobalRemarkMeta();
    setTimeout(function() {
      textarea.focus();
      const len = textarea.value.length;
      try { textarea.setSelectionRange(len, len); } catch (error) {}
    }, 20);
  }
  openModal('globalRemarkModal');
}

function clearGlobalRemarkModal() {
  const textarea = document.getElementById('globalNoteTA');
  if (!textarea) return;
  textarea.value = '';
  liveNotePreview();
  updateGlobalRemarkMeta();
  textarea.focus();
}

function normalizeGlobalRemarkLine(line) {
  const raw = String(line || '');
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (/^#{1,6}\s/.test(trimmed)) return raw;
  if (/^>\s/.test(trimmed)) return raw;
  if (/^[-*]\s\[[ xX]\]\s/.test(trimmed)) return raw;
  const ordered = trimmed.match(/^\d+[.)、]\s*(.+)$/);
  if (ordered) return `- [ ] ${ordered[1].trim()}`;
  const bullet = trimmed.match(/^[-*]\s+(.+)$/);
  if (bullet) return `- [ ] ${bullet[1].trim()}`;
  return `- [ ] ${trimmed}`;
}

function normalizeGlobalRemarkChecklist() {
  const textarea = document.getElementById('globalNoteTA');
  if (!textarea) return;
  textarea.value = String(textarea.value || '').replace(/\r/g, '').split('\n').map(normalizeGlobalRemarkLine).join('\n');
  liveNotePreview();
  updateGlobalRemarkMeta();
  showToast('已整理为 Markdown 任务清单', 'success');
}

function markGlobalRemarkSelectionDone() {
  const textarea = document.getElementById('globalNoteTA');
  if (!textarea) return;
  const value = String(textarea.value || '').replace(/\r/g, '');
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const selected = value.slice(lineStart, lineEnd);
  const today = getTodayLocalDateText();
  const next = selected.split('\n').map(function(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return line;
    if (/^#{1,6}\s/.test(trimmed)) return line;
    const text = trimmed
      .replace(/^[-*]\s\[[ xX]\]\s*/, '')
      .replace(/^\d+[.)、]\s*/, '')
      .replace(/^[-*]\s+/, '')
      .replace(/\s*[（(]已完成.*?[)）]\s*$/, '')
      .trim();
    return `- [x] ${text}（已完成 ${today}）`;
  }).join('\n');
  textarea.value = value.slice(0, lineStart) + next + value.slice(lineEnd);
  textarea.selectionStart = lineStart;
  textarea.selectionEnd = lineStart + next.length;
  liveNotePreview();
  updateGlobalRemarkMeta();
  textarea.focus();
}

function insertGlobalRemarkDailyLog() {
  const textarea = document.getElementById('globalNoteTA');
  if (!textarea) return;
  const today = getTodayLocalDateText();
  const block = `\n## 每日日志 ${today}\n- 今天做了什么：\n- 遇到的问题：\n- 下一步：\n`;
  const start = textarea.selectionStart || textarea.value.length;
  const end = textarea.selectionEnd || start;
  textarea.value = textarea.value.slice(0, start) + block + textarea.value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + block.length;
  liveNotePreview();
  updateGlobalRemarkMeta();
  textarea.focus();
}

function saveGlobalRemarkModal() {
  const textarea = document.getElementById('globalNoteTA');
  if (!textarea) return;
  globalNote = String(textarea.value || '');
  try {
    queuePersist(KEY_GLOBAL_NOTE, globalNote, 60);
    if (typeof markIncrementalWorkspaceChange === 'function') markIncrementalWorkspaceChange();
    if (typeof recordSettingUpsert === 'function') recordSettingUpsert('global_note', globalNote);
    updateGlobalRemarkMeta();
    showToast('备注已保存', 'success');
  } catch (error) {
    showToast((error && error.message) || '备注保存失败', 'error');
  }
}

function getDailyJournalEntry(dateText) {
  const key = String(dateText || '').trim();
  const map = dailyJournalEntries && typeof dailyJournalEntries === 'object' ? dailyJournalEntries : {};
  return map[key] && typeof map[key] === 'object' ? map[key] : { content: '', updatedAt: '' };
}

function getDailyJournalDates() {
  return Object.keys(dailyJournalEntries || {}).sort().reverse();
}

function ensureDailyJournalState() {
  if (!dailyJournalEntries || typeof dailyJournalEntries !== 'object') dailyJournalEntries = {};
  if (!window.dailyJournalSelectedDate) window.dailyJournalSelectedDate = getTodayLocalDateText();
  if (!dailyJournalEntries[window.dailyJournalSelectedDate]) {
    dailyJournalEntries[window.dailyJournalSelectedDate] = { content: '', updatedAt: '' };
  }
}

function renderDailyJournalPreview() {
  const textarea = document.getElementById('dailyJournalTA');
  const preview = document.getElementById('dailyJournalPreview');
  if (!textarea || !preview) return;
  preview.innerHTML = buildMarkdownPreview(textarea.value, '这一天还没有记录');
  requestAnimationFrame(function() {
    renderMathInElement(preview);
  });
}

function updateDailyJournalMeta() {
  const textarea = document.getElementById('dailyJournalTA');
  const meta = document.getElementById('dailyJournalMeta');
  const selected = document.getElementById('dailyJournalSelectedDate');
  if (!textarea || !meta || !selected) return;
  const raw = String(textarea.value || '');
  const entry = getDailyJournalEntry(window.dailyJournalSelectedDate);
  selected.textContent = window.dailyJournalSelectedDate || getTodayLocalDateText();
  meta.textContent = `共 ${raw.length} 字 · 上次保存 ${entry.updatedAt ? formatPracticeSummaryTime(entry.updatedAt) : '未保存'}`;
}

function renderDailyJournalDateList() {
  const host = document.getElementById('dailyJournalDateList');
  if (!host) return;
  ensureDailyJournalState();
  const dates = Array.from(new Set([getTodayLocalDateText()].concat(getDailyJournalDates())));
  host.innerHTML = dates.map(function(dateText) {
    const active = dateText === window.dailyJournalSelectedDate;
    const entry = getDailyJournalEntry(dateText);
    const snippet = String(entry.content || '').replace(/\s+/g, ' ').trim().slice(0, 24) || '这一天还没有记录';
    return `<button type="button" class="daily-journal-date-item${active ? ' active' : ''}" onclick="selectDailyJournalDate('${escapeHtml(dateText)}')">
      <span class="daily-journal-date-title">${escapeHtml(dateText)}</span>
      <span class="daily-journal-date-snippet">${escapeHtml(snippet)}</span>
    </button>`;
  }).join('');
}

function ensureDailyJournalModal() {
  let modal = document.getElementById('dailyJournalModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.id = 'dailyJournalModal';
  modal.innerHTML = `
    <div class="modal remark-list-modal remark-md-modal daily-journal-modal">
      <button class="modal-close" type="button" onclick="closeModal('dailyJournalModal')">×</button>
      <h2>每日日记</h2>
      <div class="remark-list-toolbar">
        <div>
          <div class="remark-list-summary">按日期记录今天做了什么、遇到了什么问题、下一步准备做什么。</div>
          <div class="remark-list-meta" id="dailyJournalMeta"></div>
        </div>
        <div class="remark-list-actions">
          <button class="btn btn-secondary btn-sm" type="button" onclick="jumpDailyJournalToToday()">回到今天</button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="insertDailyJournalTemplate()">插入模板</button>
          <button class="btn btn-primary btn-sm" type="button" onclick="saveDailyJournalModal()">保存</button>
        </div>
      </div>
      <div class="daily-journal-layout">
        <aside class="daily-journal-sidebar">
          <div class="daily-journal-sidebar-title">日期</div>
          <div id="dailyJournalDateList" class="daily-journal-date-list"></div>
        </aside>
        <div class="remark-md-pane">
          <div class="remark-md-pane-title">编辑 <span id="dailyJournalSelectedDate"></span></div>
          <textarea id="dailyJournalTA" class="remark-item-textarea remark-global-textarea" placeholder="## 今天做了什么&#10;- ...&#10;&#10;## 遇到的问题&#10;- ...&#10;&#10;## 下一步&#10;- ..." oninput="renderDailyJournalPreview();updateDailyJournalMeta()"></textarea>
        </div>
        <div class="remark-md-pane">
          <div class="remark-md-pane-title">预览</div>
          <div id="dailyJournalPreview" class="remark-md-preview notes-content"></div>
        </div>
      </div>
    </div>
  `;
  modal.addEventListener('click', function(event) {
    if (event.target === modal) closeModal('dailyJournalModal');
  });
  document.body.appendChild(modal);
  bindSaveHotkey(modal.querySelector('#dailyJournalTA'), saveDailyJournalModal);
  return modal;
}

function selectDailyJournalDate(dateText) {
  ensureDailyJournalState();
  window.dailyJournalSelectedDate = String(dateText || getTodayLocalDateText());
  const entry = getDailyJournalEntry(window.dailyJournalSelectedDate);
  const textarea = document.getElementById('dailyJournalTA');
  if (textarea) textarea.value = String(entry.content || '');
  renderDailyJournalDateList();
  renderDailyJournalPreview();
  updateDailyJournalMeta();
}

function jumpDailyJournalToToday() {
  selectDailyJournalDate(getTodayLocalDateText());
}

function insertDailyJournalTemplate() {
  const textarea = document.getElementById('dailyJournalTA');
  if (!textarea) return;
  const today = window.dailyJournalSelectedDate || getTodayLocalDateText();
  if (!String(textarea.value || '').trim()) {
    textarea.value = `## ${today}\n\n### 今天做了什么\n- \n\n### 遇到的问题\n- \n\n### 下一步\n- \n`;
  } else {
    const insertion = `\n\n### 补充记录\n- `;
    const pos = textarea.selectionEnd || textarea.value.length;
    textarea.value = textarea.value.slice(0, pos) + insertion + textarea.value.slice(pos);
    textarea.selectionStart = textarea.selectionEnd = pos + insertion.length;
  }
  renderDailyJournalPreview();
  updateDailyJournalMeta();
  textarea.focus();
}

function openDailyJournalModal() {
  ensureDailyJournalModal();
  ensureDailyJournalState();
  renderDailyJournalDateList();
  selectDailyJournalDate(window.dailyJournalSelectedDate || getTodayLocalDateText());
  openModal('dailyJournalModal');
}

function saveDailyJournalModal() {
  ensureDailyJournalState();
  const textarea = document.getElementById('dailyJournalTA');
  if (!textarea) return;
  dailyJournalEntries[window.dailyJournalSelectedDate] = {
    content: String(textarea.value || ''),
    updatedAt: new Date().toISOString()
  };
  try {
    if (typeof saveDailyJournalEntries === 'function') saveDailyJournalEntries();
    if (typeof recordSettingUpsert === 'function') recordSettingUpsert('daily_journal', dailyJournalEntries);
    renderDailyJournalDateList();
    updateDailyJournalMeta();
    showToast('每日日记已保存', 'success');
  } catch (error) {
    showToast((error && error.message) || '每日日记保存失败', 'error');
  }
}

window.ensureGlobalRemarkModal = ensureGlobalRemarkModal;
window.openRemarkListModal = openRemarkListModal;
window.clearGlobalRemarkModal = clearGlobalRemarkModal;
window.saveGlobalRemarkModal = saveGlobalRemarkModal;
window.normalizeGlobalRemarkChecklist = normalizeGlobalRemarkChecklist;
window.markGlobalRemarkSelectionDone = markGlobalRemarkSelectionDone;
window.insertGlobalRemarkDailyLog = insertGlobalRemarkDailyLog;
window.updateGlobalRemarkMeta = updateGlobalRemarkMeta;
window.ensureDailyJournalModal = ensureDailyJournalModal;
window.openDailyJournalModal = openDailyJournalModal;
window.selectDailyJournalDate = selectDailyJournalDate;
window.saveDailyJournalModal = saveDailyJournalModal;
window.insertDailyJournalTemplate = insertDailyJournalTemplate;
window.jumpDailyJournalToToday = jumpDailyJournalToToday;