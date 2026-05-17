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

function renderRandomNoteReview() {
  ensureRandomNoteReviewModal();
  const body = document.getElementById('randomNoteReviewBody');
  if (!body) return;
  if (!randomNoteReviewQueue.length || randomNoteReviewIndex < 0 || randomNoteReviewIndex >= randomNoteReviewQueue.length) {
    body.innerHTML = '<div class="home-note-item"><strong>暂无可复习笔记</strong><span>请先在知识点下补充笔记内容。</span></div>';
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
  const canPrev = randomNoteReviewIndex > 0;
  const canNext = randomNoteReviewIndex < randomNoteReviewQueue.length - 1;
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="knowledge-tree-count">${randomNoteReviewIndex + 1} / ${randomNoteReviewQueue.length}</span>
        <span style="font-size:12px;padding:3px 10px;border-radius:999px;background:#fff7e6;color:#ad6800;border:1px solid #ffd591">${escapeHtml(whyText)}</span>
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
      <button class="btn btn-secondary" type="button" onclick="startRandomNoteHighValuePractice(5)">练高价值错题(5题)</button>
      <button class="btn btn-primary" type="button" onclick="openRandomNoteInWorkspace()">打开到知识树</button>
    </div>
  `;
}
