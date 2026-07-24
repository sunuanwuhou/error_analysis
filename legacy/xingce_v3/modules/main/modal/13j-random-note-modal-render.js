// ============================================================
// Random note review modal render
// ============================================================
function ensureRandomNoteReviewModal() {
  let mask = document.getElementById('randomNoteReviewModal');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'randomNoteReviewModal';
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal" style="width:860px;max-width:96vw;max-height:90vh;overflow-y:auto">
      <button class="modal-close" type="button" onclick="closeModal('randomNoteReviewModal')">×</button>
      <h2 style="margin-bottom:6px">随机笔记复习</h2>
      <div style="font-size:12px;color:#888;margin-bottom:12px">按“越久未编辑 + 越久未查看”加权抽取，避免只看熟悉内容。</div>
      <div id="randomNoteReviewBody"></div>
    </div>
  `;
  document.body.appendChild(mask);
  return mask;
}

function _renderRandomNoteModeButton(mode, label) {
  const active = randomNoteQueueMode === mode;
  const style = active
    ? 'background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd'
    : 'background:#fff;color:#64748b;border:1px solid #e2e8f0';
  return `<button class="btn btn-secondary" type="button" style="padding:4px 12px;font-size:12px;${style}" onclick="setRandomNoteQueueMode('${mode}')">${label}</button>`;
}

function _renderRandomNoteRootFilter() {
  const options = (typeof getRandomNoteRootFilterOptions === 'function')
    ? getRandomNoteRootFilterOptions()
    : [];
  const optionHtml = [
    '<option value="">全部模块</option>',
    ...options.map(item => `<option value="${escapeAttrStr(item.id)}"${String(randomNoteRootFilter || '') === item.id ? ' selected' : ''}>${escapeHtml(item.title)}</option>`),
  ].join('');
  return `<select class="btn btn-secondary" style="padding:4px 10px;font-size:12px;min-width:140px" onchange="setRandomNoteRootFilter(this.value)">${optionHtml}</select>`;
}

function renderRandomNoteReview() {
  ensureRandomNoteReviewModal();
  const body = document.getElementById('randomNoteReviewBody');
  if (!body) return;
  const todayReviewedCount = (typeof getRandomNoteTodayReviewedCount === 'function')
    ? getRandomNoteTodayReviewedCount()
    : 0;
  const controlsHtml = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:12px;color:#64748b">排序模式</span>
        ${_renderRandomNoteModeButton('weighted', '加权随机')}
        ${_renderRandomNoteModeButton('priority', '按优先级')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${_renderRandomNoteRootFilter()}
        <span style="font-size:12px;padding:3px 10px;border-radius:999px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0">今日已复习 ${todayReviewedCount} 条</span>
      </div>
    </div>
  `;
  if (!randomNoteReviewQueue.length || randomNoteReviewIndex < 0 || randomNoteReviewIndex >= randomNoteReviewQueue.length) {
    body.innerHTML = `${controlsHtml}<div class="home-note-item"><strong>暂无可复习笔记</strong><span>请先在知识点下补充笔记内容，或调整模块筛选。</span></div>`;
    return;
  }
  const item = randomNoteReviewQueue[randomNoteReviewIndex];
  _markRandomNoteViewed(item.nodeId);
  const liveNode = (typeof getKnowledgeNodeById === 'function') ? getKnowledgeNodeById(item.nodeId) : null;
  const liveTracking = (noteReviewTracking && noteReviewTracking[item.nodeId]) || {};
  const liveUpdatedAt = String((liveNode && liveNode.updatedAt) || item.updatedAt || '');
  const liveLastViewedAt = String(liveTracking.lastViewedAt || item.lastViewedAt || '');
  const liveEditGapDays = _daysSince(liveUpdatedAt, null);
  const liveViewGapDays = _daysSince(liveLastViewedAt, null);
  const pathTitles = (typeof getKnowledgePathTitles === 'function') ? getKnowledgePathTitles(item.nodeId) : [item.title];
  const pathText = Array.isArray(pathTitles) ? pathTitles.join(' > ') : String(item.title || '');
  const noteAnchorPrefix = (typeof getKnowledgeNoteAnchorPrefix === 'function')
    ? getKnowledgeNoteAnchorPrefix(item.nodeId)
    : `rnd-note-${escapeAttrStr(item.nodeId)}`;
  const noteHeadings = (typeof extractMdHeadings === 'function') ? extractMdHeadings(item.contentMd) : [];
  const noteTocHtml = (typeof renderFloatingHeadingPanel === 'function')
    ? renderFloatingHeadingPanel(noteHeadings, noteAnchorPrefix)
    : '';
  const notePreviewHtml = (typeof renderMd === 'function')
    ? renderMd(item.contentMd, { anchorPrefix: noteAnchorPrefix })
    : `<pre style="white-space:pre-wrap;line-height:1.8">${escapeHtml(item.contentMd)}</pre>`;
  const contentHtml = (typeof renderNotePreviewLayout === 'function')
    ? renderNotePreviewLayout(notePreviewHtml, noteTocHtml)
    : notePreviewHtml;
  const editGapText = Number.isFinite(liveEditGapDays) ? _formatGapDays(liveEditGapDays) : '未知';
  const viewGapText = liveLastViewedAt
    ? (Number.isFinite(liveViewGapDays) ? _formatGapDays(liveViewGapDays) : '未知')
    : '从未';
  const whyText = `距上次编辑 ${editGapText}，距上次查看 ${viewGapText}`;
  const scoreText = Number(item.score || 0).toFixed(1);
  const errorCount = (typeof getRandomNoteErrorCount === 'function')
    ? getRandomNoteErrorCount(item.nodeId)
    : 0;
  const canPrev = randomNoteReviewIndex > 0;
  const canNext = randomNoteReviewIndex < randomNoteReviewQueue.length - 1;
  body.innerHTML = `
    ${controlsHtml}
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="knowledge-tree-count">${randomNoteReviewIndex + 1} / ${randomNoteReviewQueue.length}</span>
        <span style="font-size:12px;padding:3px 10px;border-radius:999px;background:#fff7e6;color:#ad6800;border:1px solid #ffd591">${escapeHtml(whyText)}</span>
        <span style="font-size:12px;padding:3px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe">优先级 ${escapeHtml(scoreText)}</span>
        <span style="font-size:12px;padding:3px 10px;border-radius:999px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca">错题 ${errorCount} 道</span>
      </div>
      <div style="font-size:12px;color:#888">最后编辑：${escapeHtml(_formatIsoTime(liveUpdatedAt))} · 上次查看：${escapeHtml(liveLastViewedAt ? _formatIsoTime(liveLastViewedAt) : '从未')}</div>
    </div>
    <div class="home-dashboard-card" style="margin-bottom:12px">
      <h3 style="margin-bottom:6px">${escapeHtml(item.title)}</h3>
      <div style="font-size:12px;color:#888;line-height:1.7">${escapeHtml(pathText)}</div>
    </div>
    <div class="note-preview-scroll notes-content" style="border:1px solid #e5e7eb;border-radius:12px;background:#fff;max-height:48vh;overflow:auto;padding:14px;line-height:1.9;font-size:14px">
      ${contentHtml}
    </div>
    <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      <button class="btn btn-secondary" type="button" onclick="randomNoteReviewPrev()" ${canPrev ? '' : 'disabled'}>上一个</button>
      <button class="btn btn-secondary" type="button" onclick="randomNoteReviewNext()" ${canNext ? '' : 'disabled'}>下一个</button>
      <button class="btn btn-secondary" type="button" onclick="randomNoteReviewShuffle()">换一条</button>
      <button class="btn btn-secondary" type="button" onclick="randomNoteReviewSkip()">跳过</button>
      <button class="btn btn-secondary" type="button" onclick="startRandomNoteHighValuePractice(5)">练高价值错题(5题)</button>
      <button class="btn btn-secondary" type="button" onclick="startRandomNoteAllPractice()" ${errorCount > 0 ? '' : 'disabled'}>练全部错题(${errorCount}题)</button>
      <button class="btn btn-primary" type="button" onclick="openRandomNoteInWorkspace()">打开到知识树</button>
    </div>
  `;
  requestAnimationFrame(function() {
    const preview = body.querySelector('.note-preview-scroll');
    if (preview && typeof renderMathInElement === 'function') {
      renderMathInElement(preview);
    }
  });
}
