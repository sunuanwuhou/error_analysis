// ============================================================
// Workspace list render helpers
// ============================================================

function renderGroupedErrorListHtml(visibleList) {
  const typeMap = {};
  (visibleList || []).forEach(e => {
    if (!typeMap[e.type]) typeMap[e.type] = {};
    const s = e.subtype || '未分类';
    if (!typeMap[e.type][s]) typeMap[e.type][s] = [];
    typeMap[e.type][s].push(e);
  });

  let html = '';
  Object.entries(typeMap).forEach(([type, subs]) => {
    const open = expMain.has(type);
    const total = Object.values(subs).reduce((s, a) => s + a.length, 0);
    html += `<div class="type-group">
      <div class="type-header" onclick="toggleMain('${escapeHtml(type)}')">
        <div class="type-title">
          <span class="type-arrow ${open ? 'open' : ''}">▶</span>
          ${escapeHtml(type)}<span class="type-badge">${total}</span>
        </div>
      </div>`;
    if (open) {
      Object.entries(subs).forEach(([sub, cards]) => {
        const sk = 'sub:' + type + '::' + sub;
        const sopen = expMainSub.has(sk);
        const sub2Map = {};
        cards.forEach(item => {
          const s2 = item.subSubtype || '';
          if (!sub2Map[s2]) sub2Map[s2] = [];
          sub2Map[s2].push(item);
        });
        const hasSub2 = Object.keys(sub2Map).some(k => k !== '');
        html += `<div class="subtype-group">
          <div class="subtype-header" onclick="toggleMainSub('${escapeHtml(type)}','${escapeHtml(sub)}')">
            <div class="subtype-title">
              <span class="subtype-arrow ${sopen ? 'open' : ''}">▶</span>
              ${escapeHtml(sub)}
              <span style="font-size:11px;color:#aaa;background:#f0f0f0;padding:1px 6px;border-radius:8px">${cards.length}</span>
            </div>
          </div>`;
        if (sopen) {
          if (hasSub2) {
            (sub2Map[''] || []).forEach(item => { html += renderCard(item); });
            Object.entries(sub2Map).forEach(([s2, s2cards]) => {
              if (!s2) return;
              const s2k = 's2:' + type + '::' + sub + '::' + s2;
              const s2open = expMainSub2.has(s2k);
              html += `<div class="sub2-group">
                <div class="sub2-header" onclick="toggleMainSub2('${escapeHtml(type)}','${escapeHtml(sub)}','${escapeHtml(s2)}')">
                  <div class="sub2-title">
                    <span class="sub2-arrow ${s2open ? 'open' : ''}">▶</span>
                    ${escapeHtml(s2)}
                    <span style="font-size:10px;color:#bbb;background:#f5f5f5;padding:0 5px;border-radius:5px">${s2cards.length}</span>
                  </div>
                </div>`;
              if (s2open) s2cards.forEach(item => { html += renderCard(item); });
              html += '</div>';
            });
          } else {
            cards.forEach(item => { html += renderCard(item); });
          }
        }
        html += '</div>';
      });
    }
    html += '</div>';
  });
  return html;
}

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
