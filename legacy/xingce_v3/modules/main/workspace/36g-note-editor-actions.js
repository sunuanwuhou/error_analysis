// ============================================================
// Notes tab filtering and editor actions
// ============================================================
function filterNoteErrorList() {
  const searchInput = document.getElementById('noteSearchInput');
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const list = document.getElementById('noteErrorList');
  if (!list) return;

  const filteredErrors = getErrorEntries().filter(e => {
    const pathText = typeof getErrorKnowledgePathText === 'function' ? getErrorKnowledgePathText(e) : '';
    const text = `${pathText} ${e.type || ''} ${e.subtype || ''} ${e.subSubtype || ''} ${e.question || ''}`.toLowerCase();
    return text.includes(searchTerm);
  });

  list.innerHTML = filteredErrors.map(e => `
    <div class="error-card" id="card-${escapeHtml(String(e.id || ''))}" data-error-id="${escapeHtml(String(e.id || ''))}" onclick="highlightNoteChapter('${escapeHtml(String((typeof resolveErrorKnowledgeNodeId === 'function' ? resolveErrorKnowledgeNodeId(e) : (e.noteNodeId || '')) || ''))}')">
      <div class="card-question">${escapeHtml(e.question)}</div>
      <div class="card-options">${escapeHtml(e.options)}</div>
      <div class="card-actions">
        <span class="badge">路径: ${escapeHtml(typeof getErrorKnowledgePathText === 'function' ? getErrorKnowledgePathText(e) : '')}</span>
      </div>
    </div>
  `).join('');
}

function highlightNoteChapter(type, subtype, subSubtype) {
  document.querySelectorAll('.note-panel-item-header').forEach(el => el.classList.remove('note-chapter-highlight'));
  let nodeId = '';
  if (type && !subtype && !subSubtype && typeof getKnowledgeNodeById === 'function' && getKnowledgeNodeById(type)) {
    nodeId = type;
  } else if (type || subtype || subSubtype) {
    const titles = [type || '', subtype || '', subSubtype || ''].filter(Boolean);
    if (titles.length && typeof getKnowledgeNodeByPathTitles === 'function') {
      const node = getKnowledgeNodeByPathTitles(titles);
      nodeId = node && node.id ? node.id : '';
    }
  }
  if (!nodeId) return;
  const target = document.querySelector(`[data-knowledge-node-id="${nodeId}"] .note-panel-item-header`);
  if (!target) return;
  target.classList.add('note-chapter-highlight');
  target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function toggleTablePicker() {
  const panel = document.getElementById('tablePickerPanel');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : '';
  if (!visible) {
    setTimeout(() => {
      const close = e => {
        if (!panel.contains(e.target) && e.target.id !== 'tablePickerBtn') {
          panel.style.display = 'none';
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 0);
  }
}

function insertMdTable() {
  const rows = Math.min(20, Math.max(1, parseInt(document.getElementById('tblRows').value) || 3));
  const cols = Math.min(10, Math.max(1, parseInt(document.getElementById('tblCols').value) || 3));
  const ta = document.getElementById('noteTypeTextarea');
  if (!ta) return;
  const header = '| ' + Array.from({length: cols}, (_, i) => `列${i + 1}`).join(' | ') + ' |';
  const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |';
  const row = '| ' + Array(cols).fill('    ').join(' | ') + ' |';
  const table = '\n' + [header, separator, ...Array(rows).fill(row)].join('\n') + '\n';
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.substring(0, start) + table + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + table.length;
  ta.focus();
  liveNotePreview();
  document.getElementById('tablePickerPanel').style.display = 'none';
}

function insertQuickMdTable(rows, cols) {
  const ta = document.getElementById('noteTypeTextarea');
  if (!ta) return;
  const safeRows = Math.min(20, Math.max(1, parseInt(rows, 10) || 3));
  const safeCols = Math.min(10, Math.max(1, parseInt(cols, 10) || 3));
  const header = '| ' + Array.from({ length: safeCols }, (_, i) => `Col${i + 1}`).join(' | ') + ' |';
  const separator = '| ' + Array(safeCols).fill('---').join(' | ') + ' |';
  const row = '| ' + Array(safeCols).fill('    ').join(' | ') + ' |';
  const table = '\n' + [header, separator, ...Array(safeRows).fill(row)].join('\n') + '\n';
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  ta.value = ta.value.substring(0, start) + table + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + table.length;
  ta.focus();
  liveNotePreview();
  const panel = document.getElementById('tablePickerPanel');
  if (panel) panel.style.display = 'none';
}

function liveNotePreview() {
  const ta = document.getElementById('noteTypeTextarea');
  const preview = document.getElementById('noteSplitPreview');
  if (ta && preview) {
    const anchorPrefix = getKnowledgeNoteAnchorPrefix(selectedKnowledgeNodeId);
    const liveHeadings = extractMdHeadings(ta.value);
    const tocHtml = renderFloatingHeadingPanel(liveHeadings, anchorPrefix);
    preview.innerHTML = ta.value
      ? renderNotePreviewLayout(renderMd(ta.value, { anchorPrefix }), tocHtml)
      : '<span style="color:#ccc;font-size:12px;font-style:italic">输入 Markdown 后在此预览</span>';
  }
  if (preview) {
    requestAnimationFrame(() => {
      syncActiveNoteToc(preview);
      renderMathInElement(preview);
    });
  }
  const gta = document.getElementById('globalNoteTA');
  const gpv = document.getElementById('noteEditPreview');
  if (gta && gpv) requestAnimationFrame(() => renderMathInElement(gpv));
  if (gta && gpv) gpv.innerHTML = renderMd(gta.value) || '<span style="color:#ccc;font-size:12px;font-style:italic">右侧实时预览</span>';
}

function saveNoteTypeContent() {
  const ta = document.getElementById('noteTypeTextarea');
  if (!ta) return;
  ensureKnowledgeState({ preserveTreeShape: true, repair: false, persist: false });
  if (!selectedKnowledgeNodeId) return;
  const node = getKnowledgeNodeById(selectedKnowledgeNodeId);
  if (!node) return;
  node.contentMd = ta.value;
  node.updatedAt = new Date().toISOString();
  rememberSelectedKnowledgeNodeId(node.id);
  saveKnowledgeState({ preserveTreeShape: true });
  if (typeof persistKnowledgeStateNow === 'function') {
    persistKnowledgeStateNow().catch((e) => {
      console.warn('[saveNoteTypeContent] persist failed', e);
    });
  }
}

function setKnowledgeRelatedMode(mode) {
  knowledgeRelatedMode = mode === 'direct' ? 'direct' : 'all';
  renderKnowledgeNotesViewV2();
}
