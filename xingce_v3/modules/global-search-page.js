const SCOPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'questions', label: '题目' },
  { value: 'notes', label: '笔记' }
];

const IMAGE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'any', label: '有图片' },
  { value: 'stem', label: '题图' },
  { value: 'analysis', label: '解析图' },
  { value: 'process', label: '过程图' },
  { value: 'note', label: '笔记图' }
];

const IMAGE_TOKEN_ALIASES = [
  { pattern: /(?:^|\s)(has:image|有图片|图片)(?=$|\s)/gi, value: 'any' },
  { pattern: /(?:^|\s)(has:stem-image|有题图|题图)(?=$|\s)/gi, value: 'stem' },
  { pattern: /(?:^|\s)(has:analysis-image|有解析图|解析图)(?=$|\s)/gi, value: 'analysis' },
  { pattern: /(?:^|\s)(has:process-image|有过程图|过程图)(?=$|\s)/gi, value: 'process' },
  { pattern: /(?:^|\s)(has:note-image|有笔记图|笔记图)(?=$|\s)/gi, value: 'note' }
];

const state = {
  host: null,
  payload: { questions: [], notes: [], query: '' },
  scope: 'all',
  imageFilter: 'all',
  query: '',
  embed: false
};

function getHost() {
  const candidates = [window.parent, window.opener];
  for (const candidate of candidates) {
    if (!candidate || candidate === window) continue;
    try {
      if (typeof candidate.getGlobalSearchPayload === 'function') return candidate;
    } catch (error) {
      console.warn('[global-search] host access failed', error);
    }
  }
  return null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, ' 图片 ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>~-]/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function highlightText(text, terms) {
  let html = escapeHtml(text);
  terms.forEach(term => {
    if (!term) return;
    const regex = new RegExp(escapeRegExp(term), 'gi');
    html = html.replace(regex, match => `<mark>${match}</mark>`);
  });
  return html;
}

function extractTerms(query) {
  return String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function normalizeQueryFilters(rawQuery) {
  let nextQuery = String(rawQuery || '');
  let tokenImageFilter = 'all';
  IMAGE_TOKEN_ALIASES.forEach(item => {
    item.pattern.lastIndex = 0;
    if (item.pattern.test(nextQuery)) {
      tokenImageFilter = item.value;
      item.pattern.lastIndex = 0;
      nextQuery = nextQuery.replace(item.pattern, ' ');
    }
  });
  return {
    normalizedQuery: nextQuery.replace(/\s+/g, ' ').trim(),
    tokenImageFilter
  };
}

function buildQuestionSearchText(item) {
  return [
    item.question,
    item.options,
    item.analysis,
    item.type,
    item.subtype,
    item.subSubtype,
    item.reason,
    item.knowledgePath,
    item.sourceYear,
    item.sourceProvince,
    item.sourceOrigin
  ].join(' ').toLowerCase();
}

function buildNoteSearchText(item) {
  return [
    item.title,
    item.path,
    item.content,
    (item.headings || []).join(' ')
  ].join(' ').toLowerCase();
}

function matchesImageFilter(item, filterValue) {
  if (filterValue === 'all') return true;
  if (item.kind === 'question') {
    const map = {
      any: item.hasQuestionImage || item.hasAnalysisImage || item.hasProcessImage,
      stem: item.hasQuestionImage,
      analysis: item.hasAnalysisImage,
      process: item.hasProcessImage,
      note: false
    };
    return !!map[filterValue];
  }
  if (item.kind === 'note') {
    const map = {
      any: item.hasNoteImage,
      note: item.hasNoteImage,
      stem: false,
      analysis: false,
      process: false
    };
    return !!map[filterValue];
  }
  return true;
}

function computeQuestionScore(item, terms) {
  const questionText = String(item.question || '').toLowerCase();
  const analysisText = String(item.analysis || '').toLowerCase();
  const metaText = `${item.type || ''} ${item.subtype || ''} ${item.knowledgePath || ''}`.toLowerCase();
  let score = 0;
  terms.forEach(term => {
    if (questionText.includes(term)) score += 5;
    if (analysisText.includes(term)) score += 2;
    if (metaText.includes(term)) score += 1;
  });
  if (item.hasProcessImage) score += 0.5;
  return score;
}

function computeNoteScore(item, terms) {
  const titleText = String(item.title || '').toLowerCase();
  const pathText = String(item.path || '').toLowerCase();
  const bodyText = String(item.content || '').toLowerCase();
  let score = 0;
  terms.forEach(term => {
    if (titleText.includes(term)) score += 5;
    if (pathText.includes(term)) score += 2;
    if (bodyText.includes(term)) score += 3;
  });
  if (item.hasNoteImage) score += 0.5;
  return score;
}

function buildExcerpt(text, terms) {
  const source = stripMarkdown(text);
  if (!source) return '暂无正文摘要';
  if (!terms.length) return highlightText(source.slice(0, 140), terms);
  const lower = source.toLowerCase();
  let anchor = -1;
  terms.some(term => {
    anchor = lower.indexOf(term);
    return anchor >= 0;
  });
  if (anchor < 0) return highlightText(source.slice(0, 140), terms);
  const start = Math.max(0, anchor - 30);
  const end = Math.min(source.length, anchor + 110);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < source.length ? '...' : '';
  return prefix + highlightText(source.slice(start, end), terms) + suffix;
}

function buildQuestionMeta(item) {
  const parts = [item.type, item.subtype, item.subSubtype].filter(Boolean);
  return parts.join(' / ') || `题目 #${item.id}`;
}

function buildImagePills(item) {
  const pills = [];
  if (item.kind === 'question') {
    if (item.hasQuestionImage) pills.push('题图');
    if (item.hasAnalysisImage) pills.push('解析图');
    if (item.hasProcessImage) pills.push('过程图');
  } else if (item.kind === 'note' && item.hasNoteImage) {
    pills.push('笔记图');
  }
  return pills;
}

function renderChips(containerId, options, currentValue, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = options.map(item => `
    <button
      type="button"
      class="chip${item.value === currentValue ? ' active' : ''}"
      data-chip-type="${type}"
      data-chip-value="${item.value}"
    >${escapeHtml(item.label)}</button>
  `).join('');
}

function applyChipFilter(type, value) {
  if (type === 'scope') state.scope = value;
  if (type === 'image') state.imageFilter = value;
  render();
}

function filterQuestions(terms, activeImageFilter) {
  return (state.payload.questions || [])
    .filter(item => matchesImageFilter(item, activeImageFilter))
    .filter(item => {
      if (!terms.length) return true;
      const text = buildQuestionSearchText(item);
      return terms.every(term => text.includes(term));
    })
    .map(item => ({ ...item, score: computeQuestionScore(item, terms) }))
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}

function filterNotes(terms, activeImageFilter) {
  return (state.payload.notes || [])
    .filter(item => matchesImageFilter(item, activeImageFilter))
    .filter(item => {
      if (!terms.length) return true;
      const text = buildNoteSearchText(item);
      return terms.every(term => text.includes(term));
    })
    .map(item => ({ ...item, score: computeNoteScore(item, terms) }))
    .sort((a, b) => b.score - a.score || String(a.path).localeCompare(String(b.path), 'zh-CN'));
}

function renderResultGroup(title, items, terms) {
  if (!items.length) return '';
  const cards = items.map(item => {
    const imagePills = buildImagePills(item).map(label => `<span class="pill image">${escapeHtml(label)}</span>`).join('');
    const snippetText = item.kind === 'question'
      ? (item.analysis || item.options || item.question)
      : item.content;
    return `
      <div class="result-card" data-kind="${escapeHtml(item.kind)}" data-id="${escapeHtml(item.id)}">
        <div class="result-meta">
          <span class="pill kind-${escapeHtml(item.kind)}">${item.kind === 'question' ? '题目' : '笔记'}</span>
          ${imagePills}
          ${item.kind === 'note' ? `<span class="pill">关联 ${Number(item.linkedCount || 0)} 题</span>` : ''}
        </div>
        <div class="result-title">${item.kind === 'question' ? highlightText(item.question || `题目 #${item.id}`, terms) : highlightText(item.title || '未命名笔记', terms)}</div>
        <div class="result-path">${item.kind === 'question' ? escapeHtml(buildQuestionMeta(item)) : ''}${item.path ? `${item.kind === 'question' ? ' · ' : ''}${highlightText(item.path, terms)}` : ''}</div>
        <div class="result-snippet">${buildExcerpt(snippetText, terms)}</div>
      </div>
    `;
  }).join('');
  return `
    <section class="result-group">
      <div class="result-group-title">
        <span>${escapeHtml(title)}</span>
        <span>${items.length} 条</span>
      </div>
      <div class="result-list">${cards}</div>
    </section>
  `;
}

function renderSummary(questionCount, noteCount, activeImageFilter, terms) {
  const summary = document.getElementById('searchSummary');
  if (!summary) return;
  const filterLabel = IMAGE_OPTIONS.find(item => item.value === activeImageFilter)?.label || '全部';
  summary.innerHTML = `
    <div><strong>${questionCount + noteCount}</strong> 条结果，题目 <strong>${questionCount}</strong> 条，笔记 <strong>${noteCount}</strong> 条</div>
    <div>范围：<strong>${SCOPE_OPTIONS.find(item => item.value === state.scope)?.label || '全部'}</strong> · 图片：<strong>${escapeHtml(filterLabel)}</strong>${terms.length ? ` · 关键词：<strong>${escapeHtml(terms.join(' '))}</strong>` : ''}</div>
  `;
}

function renderEmpty(activeImageFilter, terms) {
  const resultScroll = document.getElementById('resultScroll');
  if (!resultScroll) return;
  const filterLabel = IMAGE_OPTIONS.find(item => item.value === activeImageFilter)?.label || '全部';
  resultScroll.innerHTML = `
    <div class="empty-state">
      <div>
        <div style="font-size:28px;margin-bottom:10px">⌕</div>
        <div>没有找到匹配结果。</div>
        <div>当前范围：${escapeHtml(SCOPE_OPTIONS.find(item => item.value === state.scope)?.label || '全部')} / 图片：${escapeHtml(filterLabel)}${terms.length ? ` / 关键词：${escapeHtml(terms.join(' '))}` : ''}</div>
      </div>
    </div>
  `;
}

function render() {
  renderChips('scopeChips', SCOPE_OPTIONS, state.scope, 'scope');
  renderChips('imageChips', IMAGE_OPTIONS, state.imageFilter, 'image');

  const normalized = normalizeQueryFilters(state.query);
  const activeImageFilter = normalized.tokenImageFilter !== 'all' ? normalized.tokenImageFilter : state.imageFilter;
  const terms = extractTerms(normalized.normalizedQuery);
  const questionResults = state.scope === 'notes' ? [] : filterQuestions(terms, activeImageFilter);
  const noteResults = state.scope === 'questions' ? [] : filterNotes(terms, activeImageFilter);

  renderSummary(questionResults.length, noteResults.length, activeImageFilter, terms);

  const resultScroll = document.getElementById('resultScroll');
  if (!resultScroll) return;
  if (!questionResults.length && !noteResults.length) {
    renderEmpty(activeImageFilter, terms);
    return;
  }

  resultScroll.innerHTML = [
    renderResultGroup('题目结果', questionResults.slice(0, 120), terms),
    renderResultGroup('笔记结果', noteResults.slice(0, 120), terms)
  ].filter(Boolean).join('');
}

function closeSelf() {
  if (state.host && typeof state.host.closeGlobalSearchModal === 'function') {
    state.host.closeGlobalSearchModal(true);
    return;
  }
  window.close();
}

function activateResult(kind, id) {
  if (!state.host || typeof state.host.activateGlobalSearchResult !== 'function') return;
  state.host.activateGlobalSearchResult({ kind, id });
}

function bindEvents() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', event => {
      state.query = event.target.value || '';
      render();
    });
  }

  document.addEventListener('click', event => {
    const chip = event.target.closest('[data-chip-type]');
    if (chip) {
      applyChipFilter(chip.getAttribute('data-chip-type'), chip.getAttribute('data-chip-value'));
      return;
    }
    const card = event.target.closest('.result-card[data-kind][data-id]');
    if (card) {
      activateResult(card.getAttribute('data-kind'), card.getAttribute('data-id'));
    }
  });

  document.getElementById('closeSearchBtn')?.addEventListener('click', closeSelf);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSelf();
    }
  });
}

function init() {
  const params = new URLSearchParams(window.location.search);
  state.embed = params.get('embed') === '1';
  document.body.classList.toggle('is-embedded', state.embed);
  state.host = getHost();
  if (!state.host) {
    const resultScroll = document.getElementById('resultScroll');
    if (resultScroll) {
      resultScroll.innerHTML = '<div class="empty-state">未找到主页面上下文，当前搜索页无法读取题目和笔记数据。</div>';
    }
    return;
  }

  state.payload = state.host.getGlobalSearchPayload() || state.payload;
  state.query = params.get('q') || state.payload.query || '';

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = state.query;
    searchInput.focus();
    searchInput.select();
  }

  bindEvents();
  render();
}

init();
