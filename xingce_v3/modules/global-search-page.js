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

const QUICK_SEARCHES = [
  { label: '有过程图', query: '有过程图', imageFilter: 'process' },
  { label: '有笔记图', query: '有笔记图', imageFilter: 'note', scope: 'notes' },
  { label: '有题图', query: '有题图', imageFilter: 'stem', scope: 'questions' },
  { label: '只看题目', query: '', scope: 'questions', imageFilter: 'all' },
  { label: '只看笔记', query: '', scope: 'notes', imageFilter: 'all' },
  { label: '全部有图', query: '有图片', imageFilter: 'any' }
];

const IMAGE_TOKEN_ALIASES = [
  { pattern: /(?:^|\s)(has:image|有图片|有图)(?=$|\s)/gi, value: 'any' },
  { pattern: /(?:^|\s)(has:stem-image|有题图)(?=$|\s)/gi, value: 'stem' },
  { pattern: /(?:^|\s)(has:analysis-image|有解析图)(?=$|\s)/gi, value: 'analysis' },
  { pattern: /(?:^|\s)(has:process-image|有过程图)(?=$|\s)/gi, value: 'process' },
  { pattern: /(?:^|\s)(has:note-image|有笔记图)(?=$|\s)/gi, value: 'note' }
];

const SCOPE_TOKEN_ALIASES = [
  { pattern: /(?:^|\s)(scope:questions|in:questions|只看题目|仅题目)(?=$|\s)/gi, value: 'questions' },
  { pattern: /(?:^|\s)(scope:notes|in:notes|只看笔记|仅笔记)(?=$|\s)/gi, value: 'notes' }
];

const RECENT_SEARCH_STORAGE_KEY = 'xc_global_search_recent';
const RECENT_SEARCH_LIMIT = 8;
const RESULT_LIMIT_PER_GROUP = 120;

const state = {
  host: null,
  payload: { questions: [], notes: [], query: '' },
  scope: 'all',
  imageFilter: 'all',
  query: '',
  embed: false,
  activeResultKey: '',
  visibleResults: [],
  recentSearches: []
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
  return String(query || '')
    .trim()
    .toLowerCase()
    .split(/[\s,，、|/\\>]+/)
    .filter(Boolean);
}

function normalizeQueryFilters(rawQuery) {
  let nextQuery = String(rawQuery || '');
  let tokenImageFilter = 'all';
  let tokenScope = 'all';

  IMAGE_TOKEN_ALIASES.forEach(item => {
    item.pattern.lastIndex = 0;
    if (item.pattern.test(nextQuery)) {
      tokenImageFilter = item.value;
      item.pattern.lastIndex = 0;
      nextQuery = nextQuery.replace(item.pattern, ' ');
    }
  });

  SCOPE_TOKEN_ALIASES.forEach(item => {
    item.pattern.lastIndex = 0;
    if (item.pattern.test(nextQuery)) {
      tokenScope = item.value;
      item.pattern.lastIndex = 0;
      nextQuery = nextQuery.replace(item.pattern, ' ');
    }
  });

  return {
    normalizedQuery: nextQuery.replace(/\s+/g, ' ').trim(),
    tokenImageFilter,
    tokenScope
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

function computeQuestionScore(item, terms, query) {
  const questionText = String(item.question || '').toLowerCase();
  const analysisText = String(item.analysis || '').toLowerCase();
  const pathText = String(item.knowledgePath || '').toLowerCase();
  const metaText = `${item.type || ''} ${item.subtype || ''} ${item.subSubtype || ''}`.toLowerCase();
  const rawQuery = String(query || '').trim().toLowerCase();
  let score = 0;

  terms.forEach(term => {
    if (questionText.includes(term)) score += 6;
    if (analysisText.includes(term)) score += 3;
    if (pathText.includes(term)) score += 3;
    if (metaText.includes(term)) score += 2;
  });

  if (rawQuery) {
    if (questionText.includes(rawQuery)) score += 5;
    if (analysisText.includes(rawQuery)) score += 2;
    if (pathText.includes(rawQuery)) score += 2;
  }

  if (item.hasProcessImage) score += 0.6;
  if (item.hasAnalysisImage) score += 0.3;
  if (item.status === '未掌握') score += 0.2;
  return score;
}

function computeNoteScore(item, terms, query) {
  const titleText = String(item.title || '').toLowerCase();
  const pathText = String(item.path || '').toLowerCase();
  const bodyText = String(item.content || '').toLowerCase();
  const rawQuery = String(query || '').trim().toLowerCase();
  let score = 0;

  terms.forEach(term => {
    if (titleText.includes(term)) score += 7;
    if (pathText.includes(term)) score += 4;
    if (bodyText.includes(term)) score += 3;
  });

  if (rawQuery) {
    if (titleText.includes(rawQuery)) score += 6;
    if (pathText.includes(rawQuery)) score += 3;
    if (bodyText.includes(rawQuery)) score += 2;
  }

  if (item.hasNoteImage) score += 0.5;
  score += Math.min(Number(item.linkedCount || 0), 8) * 0.05;
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

function buildQuestionSnippet(item, terms) {
  const sources = [
    item.question,
    item.analysis,
    item.options,
    item.reason,
    item.knowledgePath
  ];
  if (!terms.length) return item.analysis || item.options || item.question || item.reason || '';
  const hit = sources.find(source => {
    const lower = String(source || '').toLowerCase();
    return terms.some(term => lower.includes(term));
  });
  return hit || item.analysis || item.options || item.question || item.reason || '';
}

function buildNoteSnippet(item, terms) {
  const headingText = (item.headings || []).join(' / ');
  const sources = [item.title, item.path, headingText, item.content];
  if (!terms.length) return item.content || headingText || item.path || item.title || '';
  const hit = sources.find(source => {
    const lower = String(source || '').toLowerCase();
    return terms.some(term => lower.includes(term));
  });
  return hit || item.content || headingText || item.path || item.title || '';
}

function getResultKey(kind, id) {
  return `${kind}:${id}`;
}

function getVisibleResultByIndex(index) {
  return state.visibleResults[index] || null;
}

function getActiveResultIndex() {
  return state.visibleResults.findIndex(item => getResultKey(item.kind, item.id) === state.activeResultKey);
}

function ensureActiveResultVisible() {
  if (!state.activeResultKey) return;
  const activeCard = document.querySelector('.result-card.active');
  if (!activeCard) return;
  activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function setActiveResultByIndex(index) {
  const item = getVisibleResultByIndex(index);
  if (!item) return;
  state.activeResultKey = getResultKey(item.kind, item.id);
  render(false);
  ensureActiveResultVisible();
}

function moveActiveResult(step) {
  if (!state.visibleResults.length) return;
  const activeIndex = getActiveResultIndex();
  const baseIndex = activeIndex >= 0 ? activeIndex : 0;
  const nextIndex = Math.min(state.visibleResults.length - 1, Math.max(0, baseIndex + step));
  setActiveResultByIndex(nextIndex);
}

function applyChipFilter(type, value) {
  if (type === 'scope') state.scope = value;
  if (type === 'image') state.imageFilter = value;
  render();
}

function applyQuickSearch(config) {
  state.query = config.query || '';
  state.scope = config.scope || 'all';
  state.imageFilter = config.imageFilter || 'all';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = state.query;
    searchInput.focus();
    searchInput.select();
  }
  rememberRecentSearch(state.query);
  render();
}

function loadRecentSearches() {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => typeof item === 'string' && item.trim()).slice(0, RECENT_SEARCH_LIMIT);
  } catch (error) {
    console.warn('[global-search] failed to load recent searches', error);
    return [];
  }
}

function persistRecentSearches() {
  try {
    window.localStorage.setItem(
      RECENT_SEARCH_STORAGE_KEY,
      JSON.stringify(state.recentSearches.slice(0, RECENT_SEARCH_LIMIT))
    );
  } catch (error) {
    console.warn('[global-search] failed to save recent searches', error);
  }
}

function renderRecentSearches() {
  const container = document.getElementById('recentChips');
  if (!container) return;
  if (!state.recentSearches.length) {
    container.innerHTML = '<div class="shortcut-empty">还没有历史搜索。按一次回车打开结果后，会自动记住这次查询。</div>';
    return;
  }
  container.innerHTML = state.recentSearches.map(item => `
    <button type="button" class="chip shortcut-chip" data-recent-query="${escapeHtml(item)}">${escapeHtml(item)}</button>
  `).join('');
}

function renderQuickSearches() {
  const container = document.getElementById('quickChips');
  if (!container) return;
  container.innerHTML = QUICK_SEARCHES.map((item, index) => `
    <button type="button" class="chip shortcut-chip" data-quick-index="${index}">${escapeHtml(item.label)}</button>
  `).join('');
}

function rememberRecentSearch(query) {
  const normalized = String(query || '').trim();
  if (!normalized) return;
  state.recentSearches = [normalized]
    .concat(state.recentSearches.filter(item => item !== normalized))
    .slice(0, RECENT_SEARCH_LIMIT);
  persistRecentSearches();
  renderRecentSearches();
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

function filterQuestions(terms, activeImageFilter, normalizedQuery) {
  return (state.payload.questions || [])
    .filter(item => matchesImageFilter(item, activeImageFilter))
    .filter(item => {
      if (!terms.length) return true;
      const text = buildQuestionSearchText(item);
      return terms.every(term => text.includes(term));
    })
    .map(item => ({ ...item, score: computeQuestionScore(item, terms, normalizedQuery) }))
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}

function filterNotes(terms, activeImageFilter, normalizedQuery) {
  return (state.payload.notes || [])
    .filter(item => matchesImageFilter(item, activeImageFilter))
    .filter(item => {
      if (!terms.length) return true;
      const text = buildNoteSearchText(item);
      return terms.every(term => text.includes(term));
    })
    .map(item => ({ ...item, score: computeNoteScore(item, terms, normalizedQuery) }))
    .sort((a, b) => b.score - a.score || String(a.path).localeCompare(String(b.path), 'zh-CN'));
}

function renderResultGroup(title, items, terms, offset) {
  if (!items.length) return '';
  const cards = items.map((item, itemIndex) => {
    const imagePills = buildImagePills(item).map(label => `<span class="pill image">${escapeHtml(label)}</span>`).join('');
    const snippetText = item.kind === 'question'
      ? buildQuestionSnippet(item, terms)
      : buildNoteSnippet(item, terms);
    const resultIndex = offset + itemIndex;
    const resultKey = getResultKey(item.kind, item.id);
    const isActive = resultKey === state.activeResultKey;
    return `
      <div
        class="result-card${isActive ? ' active' : ''}"
        data-kind="${escapeHtml(item.kind)}"
        data-id="${escapeHtml(item.id)}"
        data-result-key="${escapeHtml(resultKey)}"
        data-result-index="${resultIndex}"
        tabindex="0"
      >
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

function renderSummary(questionCount, noteCount, activeImageFilter, activeScope, terms) {
  const summary = document.getElementById('searchSummary');
  if (!summary) return;
  const filterLabel = IMAGE_OPTIONS.find(item => item.value === activeImageFilter)?.label || '全部';
  const scopeLabel = SCOPE_OPTIONS.find(item => item.value === activeScope)?.label || '全部';
  const activeIndex = getActiveResultIndex();
  const activeText = state.visibleResults.length
    ? `当前选中 <strong>${activeIndex + 1}</strong> / ${state.visibleResults.length}`
    : '当前没有可选结果';

  summary.innerHTML = `
    <div><strong>${questionCount + noteCount}</strong> 条结果，题目 <strong>${questionCount}</strong> 条，笔记 <strong>${noteCount}</strong> 条</div>
    <div>范围：<strong>${scopeLabel}</strong> · 图片：<strong>${escapeHtml(filterLabel)}</strong>${terms.length ? ` · 关键词：<strong>${escapeHtml(terms.join(' '))}</strong>` : ''}</div>
    <div class="summary-hint">${activeText} · <kbd>↑</kbd> <kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 打开 · <kbd>Esc</kbd> 关闭</div>
  `;
}

function renderEmpty(activeImageFilter, activeScope, terms) {
  const resultScroll = document.getElementById('resultScroll');
  if (!resultScroll) return;
  const filterLabel = IMAGE_OPTIONS.find(item => item.value === activeImageFilter)?.label || '全部';
  const scopeLabel = SCOPE_OPTIONS.find(item => item.value === activeScope)?.label || '全部';
  resultScroll.innerHTML = `
    <div class="empty-state">
      <div>
        <div style="font-size:28px;margin-bottom:10px">⌕</div>
        <div>没有找到匹配结果。</div>
        <div>当前范围：${escapeHtml(scopeLabel)} / 图片：${escapeHtml(filterLabel)}${terms.length ? ` / 关键词：${escapeHtml(terms.join(' '))}` : ''}</div>
        <div>可以试试更短的关键词，或者点左侧的快捷搜索。</div>
      </div>
    </div>
  `;
}

function render(resetActive = true) {
  renderChips('scopeChips', SCOPE_OPTIONS, state.scope, 'scope');
  renderChips('imageChips', IMAGE_OPTIONS, state.imageFilter, 'image');
  renderQuickSearches();
  renderRecentSearches();

  const normalized = normalizeQueryFilters(state.query);
  const activeImageFilter = normalized.tokenImageFilter !== 'all' ? normalized.tokenImageFilter : state.imageFilter;
  const activeScope = normalized.tokenScope !== 'all' ? normalized.tokenScope : state.scope;
  const terms = extractTerms(normalized.normalizedQuery);
  const questionResults = activeScope === 'notes' ? [] : filterQuestions(terms, activeImageFilter, normalized.normalizedQuery);
  const noteResults = activeScope === 'questions' ? [] : filterNotes(terms, activeImageFilter, normalized.normalizedQuery);
  const visibleResults = []
    .concat(questionResults.slice(0, RESULT_LIMIT_PER_GROUP))
    .concat(noteResults.slice(0, RESULT_LIMIT_PER_GROUP))
    .map(item => ({ kind: item.kind, id: String(item.id) }));

  state.visibleResults = visibleResults;

  if (!visibleResults.length) {
    state.activeResultKey = '';
  } else if (
    resetActive ||
    !state.activeResultKey ||
    !visibleResults.some(item => getResultKey(item.kind, item.id) === state.activeResultKey)
  ) {
    state.activeResultKey = getResultKey(visibleResults[0].kind, visibleResults[0].id);
  }

  renderSummary(questionResults.length, noteResults.length, activeImageFilter, activeScope, terms);

  const resultScroll = document.getElementById('resultScroll');
  if (!resultScroll) return;
  if (!questionResults.length && !noteResults.length) {
    renderEmpty(activeImageFilter, activeScope, terms);
    return;
  }

  const questionItems = questionResults.slice(0, RESULT_LIMIT_PER_GROUP);
  const noteItems = noteResults.slice(0, RESULT_LIMIT_PER_GROUP);
  resultScroll.innerHTML = [
    renderResultGroup('题目结果', questionItems, terms, 0),
    renderResultGroup('笔记结果', noteItems, terms, questionItems.length)
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
  rememberRecentSearch(state.query);
  if (!state.host || typeof state.host.activateGlobalSearchResult !== 'function') return;
  state.host.activateGlobalSearchResult({ kind, id });
}

function activateActiveResult() {
  const activeIndex = getActiveResultIndex();
  const item = getVisibleResultByIndex(activeIndex >= 0 ? activeIndex : 0);
  if (!item) return;
  activateResult(item.kind, item.id);
}

function bindEvents() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', event => {
      state.query = event.target.value || '';
      render();
    });

    searchInput.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveActiveResult(1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveActiveResult(-1);
        return;
      }
      if (event.key === 'Enter') {
        if (!state.visibleResults.length) return;
        event.preventDefault();
        activateActiveResult();
      }
    });
  }

  document.addEventListener('click', event => {
    const chip = event.target.closest('[data-chip-type]');
    if (chip) {
      applyChipFilter(chip.getAttribute('data-chip-type'), chip.getAttribute('data-chip-value'));
      return;
    }

    const quickChip = event.target.closest('[data-quick-index]');
    if (quickChip) {
      const quickIndex = Number(quickChip.getAttribute('data-quick-index'));
      const quickConfig = QUICK_SEARCHES[quickIndex];
      if (quickConfig) applyQuickSearch(quickConfig);
      return;
    }

    const recentChip = event.target.closest('[data-recent-query]');
    if (recentChip) {
      const recentQuery = recentChip.getAttribute('data-recent-query') || '';
      state.query = recentQuery;
      const input = document.getElementById('searchInput');
      if (input) {
        input.value = recentQuery;
        input.focus();
        input.select();
      }
      render();
      return;
    }

    const card = event.target.closest('.result-card[data-kind][data-id]');
    if (card) {
      const resultIndex = Number(card.getAttribute('data-result-index'));
      if (Number.isFinite(resultIndex)) {
        const item = getVisibleResultByIndex(resultIndex);
        if (item) state.activeResultKey = getResultKey(item.kind, item.id);
      }
      activateResult(card.getAttribute('data-kind'), card.getAttribute('data-id'));
    }
  });

  document.getElementById('closeSearchBtn')?.addEventListener('click', closeSelf);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSelf();
      return;
    }
    if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveResult(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveResult(-1);
      return;
    }
    if (event.key === 'Enter' && state.visibleResults.length) {
      event.preventDefault();
      activateActiveResult();
    }
  });
}

function init() {
  const params = new URLSearchParams(window.location.search);
  state.embed = params.get('embed') === '1';
  state.recentSearches = loadRecentSearches();
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
