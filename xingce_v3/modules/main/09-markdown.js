// ============================================================
// Markdown 渲染
// ============================================================
function makeStableDomId(prefix, seed) {
  const text = String(seed || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return `${prefix}-${Math.abs(hash)}`;
}
function getKnowledgeNoteAnchorPrefix(nodeId) {
  return makeStableDomId('knowledge-note', nodeId || 'default');
}
function getNoteHeadingAnchorId(anchorPrefix, headingIndex) {
  return `${anchorPrefix}-h-${headingIndex}`;
}
function encodeInlineValue(value) {
  return encodeURIComponent(String(value || ''));
}
function scrollToRenderedAnchor(anchorId, opts) {
  const target = document.getElementById(anchorId);
  if (!target) return false;
  const scroller = target.closest('.note-preview-article-scroll') || target.closest('.note-preview-scroll');
  if (scroller) {
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
    scroller.scrollTo({ top: top < 0 ? 0 : top, behavior: (opts && opts.behavior) || 'smooth' });
  } else {
    target.scrollIntoView({ behavior: (opts && opts.behavior) || 'smooth', block: 'start' });
  }
  setActiveNoteTocItem(anchorId);
  target.style.background = '#fff3cd';
  setTimeout(() => { target.style.background = ''; }, 1800);
  return true;
}
function jumpToRenderedAnchor(anchorId) {
  scrollToRenderedAnchor(anchorId, { behavior: 'smooth' });
}
function setActiveNoteTocItem(anchorId) {
  const items = document.querySelectorAll('.note-toc-item[data-anchor-id]');
  items.forEach(item => item.classList.toggle('active', item.getAttribute('data-anchor-id') === anchorId));
  const active = document.querySelector(`.note-toc-item[data-anchor-id="${anchorId}"]`);
  if (!active) return;
  const container = active.closest('.note-toc-list') || active.closest('.note-toc-floating');
  if (!container) return;
  const top = active.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  const bottom = top + active.offsetHeight;
  const viewTop = container.scrollTop;
  const viewBottom = viewTop + container.clientHeight;
  if (top < viewTop + 12) {
    container.scrollTo({ top: Math.max(top - 12, 0), behavior: 'smooth' });
  } else if (bottom > viewBottom - 12) {
    container.scrollTo({ top: bottom - container.clientHeight + 12, behavior: 'smooth' });
  }
}
function syncActiveNoteToc(previewEl) {
  if (!previewEl) return;
  const headings = Array.from(previewEl.querySelectorAll('.note-md-heading[id]'));
  if (!headings.length) return;
  const current = headings.reduce((found, heading) => {
    return previewEl.scrollTop + 24 >= heading.offsetTop ? heading : found;
  }, headings[0]);
  if (current && current.id) setActiveNoteTocItem(current.id);
}
function bindNotePreviewScrollTracking(contentEl) {
  if (!contentEl) return;
  const preview = contentEl.querySelector('#noteSplitPreview .note-preview-article-scroll') || contentEl.querySelector('#noteSplitPreview');
  if (!preview || preview.dataset.tocBound === '1') return;
  preview.dataset.tocBound = '1';
  preview.addEventListener('scroll', function() {
    syncActiveNoteToc(preview);
  }, { passive: true });
  requestAnimationFrame(function() {
    syncActiveNoteToc(preview);
    renderMathInElement(preview);
  });
}
function renderMathInElement(element) {
  if (!element) return;
  const mathJax = window.MathJax;
  if (!mathJax || typeof mathJax.typesetPromise !== 'function') {
    const retryCount = Number(element.dataset.mathRetryCount || '0');
    if (retryCount < 40) {
      element.dataset.mathRetryCount = String(retryCount + 1);
      setTimeout(function() {
        renderMathInElement(element);
      }, 180);
    }
    return;
  }
  element.dataset.mathRetryCount = '0';
  if (typeof mathJax.typesetClear === 'function') {
    mathJax.typesetClear([element]);
  }
  mathJax.typesetPromise([element]).catch(function(err) {
    console.warn('MathJax typeset failed', err);
  });
}
function renderMd(raw, opts) {
  if (!raw||!raw.trim()) return '';
  const lines = raw.split('\n');
  const out = [];
  let i = 0;
  let headingIndex = Number((opts && opts.headingIndexOffset) || 0);
  const anchorPrefix = opts && opts.anchorPrefix ? opts.anchorPrefix : '';
  while (i < lines.length) {
    const line = lines[i];
    // 代码块
    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      i++; continue;
    }
    const singleLineBlockMath = line.trim().match(/^\$\$(.+)\$\$$/);
    if (singleLineBlockMath) {
      out.push(`<div class="note-math-block">\\[${escapeHtml(singleLineBlockMath[1].trim())}\\]</div>`);
      i++;
      continue;
    }
    if (line.trim() === '$$') {
      const mathLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim() === '$$') i++;
      out.push(`<div class="note-math-block">\\[${escapeHtml(mathLines.join('\n'))}\\]</div>`);
      continue;
    }
    if (line.trim() === '\\[') {
      const mathLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '\\]') {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim() === '\\]') i++;
      out.push(`<div class="note-math-block">\\[${escapeHtml(mathLines.join('\n'))}\\]</div>`);
      continue;
    }
    // 表格（第二行是 --- 分隔行）
    if (line.includes('|') && i+1 < lines.length && /^\|?[\s\-:|]+\|/.test(lines[i+1])) {
      const heads = mdTblCells(line).map(c=>`<th>${mdInline(c)}</th>`).join('');
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(`<tr>${mdTblCells(lines[i]).map(c=>`<td>${mdInline(c)}</td>`).join('')}</tr>`);
        i++;
      }
      out.push(`<table><thead><tr>${heads}</tr></thead><tbody>${rows.join('')}</tbody></table>`);
      continue;
    }
    // 标题
      const parsedHeading = parseLooseNoteHeading(line);
      const hm = parsedHeading ? [line, '#'.repeat(parsedHeading.level), parsedHeading.text] : null;
      if (hm) {
        const lv=Math.min(hm[1].length+1,4);
        const anchorId = anchorPrefix ? getNoteHeadingAnchorId(anchorPrefix, headingIndex) : '';
        const anchorHtml = anchorId ? `<a class="note-md-anchor" href="javascript:void(0)" onclick="jumpToRenderedAnchor('${anchorId}')" title="Jump to heading">#</a>` : '';
        const attr = anchorId ? ` id="${anchorId}" data-heading-index="${headingIndex}"` : '';
        out.push(`<h${lv} class="note-md-heading"${attr} onclick="${anchorId ? `jumpToRenderedAnchor('${anchorId}')` : ''}" style="${anchorId ? 'cursor:pointer' : ''}">${anchorHtml}${mdInline(hm[2])}</h${lv}>`);
        if (parsedHeading && parsedHeading.rest) {
          out.push(`<p style="margin:2px 0">${mdInline(parsedHeading.rest)}</p>`);
        }
        headingIndex++;
        i++;
        continue;
      }
    // 列表（连续收集成 ul）
    if (/^[-•] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-•] /.test(lines[i])) {
        items.push(`<li>${mdInline(lines[i].replace(/^[-•] /,''))}</li>`); i++;
      }
      out.push(`<ul>${items.join('')}</ul>`); continue;
    }
    // 空行
    if (!line.trim()) { out.push('<div style="height:5px"></div>'); i++; continue; }
    // 普通行
    out.push(`<p style="margin:2px 0">${mdInline(line)}</p>`); i++;
  }
  return out.join('');
}
function mdTblCells(line) {
  return line.replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
}
function parseLooseNoteHeading(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;
  const markdownMatch = raw.match(/^(#{1,4})(?:\s+)?(.+?)\s*$/);
  return markdownMatch ? { level: markdownMatch[1].length, text: markdownMatch[2].trim(), rest: '' } : null;
}
function mdInline(text) {
  const mathTokens = [];
  // 先把图片语法提取为占位符（保留原始URL，不被 escapeHtml 处理）
  const imgs = [];
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_,alt,url) => {
    // 解析 noteimg: 短引用
    const src = url.startsWith('noteimg:') ? (noteImages[url.slice(8)] || '') : url;
    imgs.push(`<img src="${src}" alt="${alt}" class="cuoti-img" onclick="this.classList.toggle('expanded')" title="点击放大/缩小">`);
    return '\x00IMG'+(imgs.length-1)+'\x00';
  });
  text = text
    .replace(/\\\((.+?)\\\)/g, (_,expr) => {
      mathTokens.push(`<span class="note-math-inline">\\(${escapeHtml(expr)}\\)</span>`);
      return '\x00MATH'+(mathTokens.length-1)+'\x00';
    })
    .replace(/(^|[^\\$])\$([^$\n]+)\$/g, (_,prefix,expr) => {
      mathTokens.push(`<span class="note-math-inline">\\(${escapeHtml(expr)}\\)</span>`);
      return prefix + '\x00MATH'+(mathTokens.length-1)+'\x00';
    });
  let s = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>');
  mathTokens.forEach((math,idx) => { s = s.replace('\x00MATH'+idx+'\x00', math); });
  imgs.forEach((img,idx) => { s = s.replace('\x00IMG'+idx+'\x00', img); });
  return s;
}
