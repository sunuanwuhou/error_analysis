// ============================================================
// Random note candidate scoring and queue helpers
// ============================================================
const RANDOM_NOTE_EDIT_WEIGHT = 0.7;
const RANDOM_NOTE_VIEW_WEIGHT = 0.3;
const RANDOM_NOTE_RECENT_VIEW_DOWN_WEIGHT = 0.2;
const RANDOM_NOTE_RECENT_VIEW_DAYS = 1;
const RANDOM_NOTE_BY_TYPE_PREFIX = '__notes_by_type__:';
const RANDOM_NOTE_LEVEL1_SCORE_FACTOR = 0.75;
const RANDOM_NOTE_DEPTH_SCORE_BOOST = 0.12;
let randomNoteReviewQueue = [];
let randomNoteReviewIndex = -1;
let randomNoteQueueMode = 'weighted';
let randomNoteRootFilter = '';
let randomNoteSkipSet = new Set();

function _toValidDate(value) {
  const d = new Date(String(value || ''));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function _daysSince(value, fallbackDays) {
  const d = _toValidDate(value);
  if (!d) return Number.isFinite(fallbackDays) ? fallbackDays : null;
  const gapMs = Date.now() - d.getTime();
  return Math.max(0, gapMs / (24 * 60 * 60 * 1000));
}

function _formatGapDays(days) {
  if (!Number.isFinite(days) || days < 0.04) return '刚刚';
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} 小时`;
  return `${Math.round(days)} 天`;
}

function _formatIsoTime(value) {
  const d = _toValidDate(value);
  if (!d) return '未知';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function _normalizeNoteMeaningfulText(raw) {
  return String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/^#{1,6}\s*/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/^\s*\d+\.\s+/gm, ' ')
    .replace(/[>|`*_~]/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

function _isRandomNoteByTypeId(nodeId) {
  return String(nodeId || '').startsWith(RANDOM_NOTE_BY_TYPE_PREFIX);
}

function _randomNoteByTypeKey(nodeId) {
  return String(nodeId || '').slice(RANDOM_NOTE_BY_TYPE_PREFIX.length);
}

function _normalizeNotePathTitles(pathTitles) {
  return (pathTitles || []).map(title => String(title || '').trim()).filter(Boolean);
}

function _resolveNotesByTypeEntryContent(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry === 'object' && typeof entry.content === 'string') return entry.content.trim();
  return '';
}

function _resolveNotesByTypeEntryUpdatedAt(entry) {
  if (!entry || typeof entry !== 'object') return '';
  return String(entry.updatedAt || '').trim();
}

function _resolveNotesByTypeEntryByPath(pathTitles) {
  const path = _normalizeNotePathTitles(pathTitles);
  if (!path.length || typeof notesByType !== 'object' || !notesByType) return null;
  let entry = notesByType[path[0]];
  if (!entry) return null;
  for (let i = 1; i < path.length; i += 1) {
    if (!entry || typeof entry !== 'object') return null;
    entry = entry.children && entry.children[path[i]] ? entry.children[path[i]] : null;
  }
  return entry;
}

function _resolveNotesByTypeContentByPath(pathTitles) {
  return _resolveNotesByTypeEntryContent(_resolveNotesByTypeEntryByPath(pathTitles));
}

function _resolveNotesByTypeUpdatedAtByPath(pathTitles) {
  return _resolveNotesByTypeEntryUpdatedAt(_resolveNotesByTypeEntryByPath(pathTitles));
}

function _noteContentHasImage(content) {
  if (typeof noteContentHasImage === 'function') return noteContentHasImage(content);
  const text = String(content || '');
  return /noteimg:/i.test(text) || /!\[[^\]]*\]\([^)]+\)/.test(text) || /<img\b/i.test(text);
}

function _hasMeaningfulNoteContent(contentMd, title) {
  const body = String(contentMd || '').trim();
  if (!body) return false;
  if (_noteContentHasImage(body)) return true;
  const normalizedBody = _normalizeNoteMeaningfulText(body);
  if (!normalizedBody) return false;
  const normalizedTitle = _normalizeNoteMeaningfulText(String(title || ''));
  if (!normalizedTitle) return true;
  if (normalizedBody === normalizedTitle) return false;
  if (normalizedBody.startsWith(normalizedTitle) && normalizedBody.length <= normalizedTitle.length + 2) return false;
  return true;
}

function _resolveRandomNoteContentMd(node) {
  if (!node || typeof node !== 'object') return '';
  const nodeId = String(node.id || '').trim();
  const direct = String(node.contentMd || '').trim();
  if (direct) return direct;
  if (nodeId && typeof getKnowledgePathTitles === 'function') {
    const pathContent = _resolveNotesByTypeContentByPath(getKnowledgePathTitles(nodeId)).trim();
    if (pathContent) return pathContent;
  }
  if (nodeId && typeof getLegacyKnowledgeNoteSnapshot === 'function') {
    const legacy = getLegacyKnowledgeNoteSnapshot(nodeId);
    const legacyContent = legacy && typeof legacy.content === 'string' ? legacy.content.trim() : '';
    if (legacyContent) return legacyContent;
  }
  if (nodeId && typeof knowledgeNotes === 'object' && knowledgeNotes && knowledgeNotes[nodeId]) {
    const entry = knowledgeNotes[nodeId];
    const content = entry && typeof entry.content === 'string' ? entry.content.trim() : '';
    if (content) return content;
  }
  return '';
}

function _candidateDepth(pathTitles, level) {
  const depth = _normalizeNotePathTitles(pathTitles).length;
  if (depth > 0) return depth;
  return Math.max(1, Number(level || 1));
}

function _applyDepthScoreFactor(score, depth) {
  const base = Math.max(0.001, Number(score || 0));
  if (depth <= 1) return Math.max(0.001, base * RANDOM_NOTE_LEVEL1_SCORE_FACTOR);
  return Math.max(0.001, base * (1 + RANDOM_NOTE_DEPTH_SCORE_BOOST * (depth - 1)));
}

function _buildRandomNoteCandidate(nodeId, title, contentMd, updatedAt, tracking, extra) {
  const editGapDays = _daysSince(updatedAt, 365);
  const viewGapDays = _daysSince(tracking && tracking.lastViewedAt, 365);
  let score = (RANDOM_NOTE_EDIT_WEIGHT * Math.log1p(editGapDays))
    + (RANDOM_NOTE_VIEW_WEIGHT * Math.log1p(viewGapDays));
  if (viewGapDays < RANDOM_NOTE_RECENT_VIEW_DAYS) score *= RANDOM_NOTE_RECENT_VIEW_DOWN_WEIGHT;
  const depth = _candidateDepth(extra && extra.pathTitles, extra && extra.level);
  score = _applyDepthScoreFactor(score, depth);
  return {
    nodeId: String(nodeId || ''),
    title: String(title || '未命名笔记'),
    contentMd,
    updatedAt: String(updatedAt || ''),
    lastViewedAt: String((tracking && tracking.lastViewedAt) || ''),
    viewCount: Number((tracking && tracking.viewCount) || 0),
    editGapDays,
    viewGapDays,
    score: Math.max(0.001, score),
    ...(extra || {}),
  };
}

function _getRandomNoteRoots() {
  if (typeof ensureKnowledgeState === 'function') ensureKnowledgeState({ repair: false, persist: false });
  return (typeof getKnowledgeRootNodes === 'function')
    ? (getKnowledgeRootNodes() || [])
    : ((knowledgeTree && knowledgeTree.roots) || []);
}

function _notesByTypeMatchesRootFilter(typeKey, rootId) {
  const filterId = String(rootId || randomNoteRootFilter || '').trim();
  if (!filterId) return true;
  const root = _getRandomNoteRoots().find(node => String(node && node.id || '') === filterId);
  if (!root) return false;
  return String(root.title || '').trim() === String(typeKey || '').trim();
}

function _rememberRandomNoteCandidate(candidates, seen, item) {
  const nodeId = String(item && item.nodeId || '').trim();
  if (!nodeId || seen.has(nodeId)) return;
  seen.add(nodeId);
  candidates.push(item);
}

function _walkNotesByTypeCandidates(pathTitles, entry, rootId, candidates, seen) {
  const path = _normalizeNotePathTitles(pathTitles);
  if (!path.length || !entry) return;
  if (!_notesByTypeMatchesRootFilter(path[0], rootId)) return;
  const title = path[path.length - 1];
  const contentMd = _resolveNotesByTypeEntryContent(entry);
  if (_hasMeaningfulNoteContent(contentMd, title)) {
    let nodeId = `${RANDOM_NOTE_BY_TYPE_PREFIX}${path.join('::')}`;
    let displayTitle = title;
    if (typeof getKnowledgeNodeByPathTitles === 'function') {
      const linkedNode = getKnowledgeNodeByPathTitles(path);
      if (linkedNode && linkedNode.id) {
        nodeId = String(linkedNode.id);
        displayTitle = String(linkedNode.title || title);
      }
    }
    const tracking = (noteReviewTracking && noteReviewTracking[nodeId]) || {};
    const updatedAt = _resolveNotesByTypeEntryUpdatedAt(entry) || _resolveNotesByTypeUpdatedAtByPath(path);
    _rememberRandomNoteCandidate(candidates, seen, _buildRandomNoteCandidate(
      nodeId,
      displayTitle,
      contentMd,
      updatedAt,
      tracking,
      { source: 'notes_by_type', level: path.length, pathTitles: path.slice() },
    ));
  }
  const children = entry && typeof entry === 'object' && entry.children && typeof entry.children === 'object'
    ? entry.children
    : {};
  Object.keys(children).forEach((childKey) => {
    if (!childKey) return;
    _walkNotesByTypeCandidates(path.concat(childKey), children[childKey], rootId, candidates, seen);
  });
}

function _collectRandomNoteCandidates(rootId) {
  const roots = _getRandomNoteRoots();
  const scopedRoots = String(rootId || randomNoteRootFilter || '').trim()
    ? roots.filter(node => String(node && node.id || '') === String(rootId || randomNoteRootFilter || '').trim())
    : roots;
  const candidates = [];
  const seen = new Set();
  const walk = (nodes) => {
    (nodes || []).forEach((node) => {
      if (!node || typeof node !== 'object') return;
      const nodeId = String(node.id || '').trim();
      const contentMd = _resolveRandomNoteContentMd(node);
      if (_hasMeaningfulNoteContent(contentMd, node.title)) {
        const pathTitles = (typeof getKnowledgePathTitles === 'function')
          ? _normalizeNotePathTitles(getKnowledgePathTitles(nodeId))
          : [];
        const tracking = (noteReviewTracking && noteReviewTracking[nodeId]) || {};
        const updatedAt = String(node.updatedAt || '').trim()
          || String((knowledgeNotes && knowledgeNotes[nodeId] && knowledgeNotes[nodeId].updatedAt) || '')
          || _resolveNotesByTypeUpdatedAtByPath(pathTitles);
        _rememberRandomNoteCandidate(candidates, seen, _buildRandomNoteCandidate(
          nodeId,
          node.title,
          contentMd,
          updatedAt,
          tracking,
          { source: 'knowledge_tree', level: Number(node.level || pathTitles.length || 0), pathTitles },
        ));
      }
      walk(node.children || []);
    });
  };
  walk(scopedRoots);
  if (typeof notesByType === 'object' && notesByType) {
    Object.keys(notesByType).forEach((typeKey) => {
      if (!typeKey) return;
      _walkNotesByTypeCandidates([typeKey], notesByType[typeKey], rootId, candidates, seen);
    });
  }
  return candidates;
}

function getRandomNoteReviewCandidateCount() {
  return _collectRandomNoteCandidates().length;
}

function getRandomNoteTodayReviewedCount() {
  const todayKey = (typeof today === 'function') ? today() : new Date().toISOString().split('T')[0];
  return Object.values(noteReviewTracking || {}).filter((item) => {
    if (!item || typeof item !== 'object') return false;
    return String(item.lastViewedDate || '') === todayKey
      && String(item.lastSource || '') === 'random_note_review';
  }).length;
}

function getRandomNoteErrorCount(nodeId) {
  if (!nodeId || typeof _collectErrorsForRandomNotePractice !== 'function') return 0;
  return _collectErrorsForRandomNotePractice(nodeId).length;
}

function getRandomNoteRootFilterOptions() {
  return _getRandomNoteRoots().map(node => ({
    id: String(node && node.id || ''),
    title: String((node && node.title) || '未命名模块'),
  })).filter(item => item.id);
}

function _pickWeightedIndex(pool) {
  const total = pool.reduce((sum, item) => sum + Math.max(0.001, Number(item.score || 0)), 0);
  if (!Number.isFinite(total) || total <= 0) return Math.floor(Math.random() * pool.length);
  let cursor = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    cursor -= Math.max(0.001, Number(pool[i].score || 0));
    if (cursor <= 0) return i;
  }
  return pool.length - 1;
}

function _shuffleArray(items) {
  const list = (items || []).slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

function _buildRandomNoteReviewQueue(excludeNodeId, options) {
  const opts = options || {};
  const rootId = String(opts.rootId != null ? opts.rootId : randomNoteRootFilter || '');
  const mode = String(opts.mode || randomNoteQueueMode || 'weighted');
  const skipIds = opts.skipIds || randomNoteSkipSet;
  const source = _collectRandomNoteCandidates(rootId).filter((item) => {
    if (!item.nodeId) return false;
    if (item.nodeId === String(excludeNodeId || '')) return false;
    if (skipIds && typeof skipIds.has === 'function' && skipIds.has(item.nodeId)) return false;
    return true;
  });
  if (!source.length) return [];
  if (mode === 'priority') {
    return source.slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = String(a.updatedAt || '');
      const tb = String(b.updatedAt || '');
      return tb.localeCompare(ta);
    });
  }
  const pool = source.slice();
  const queue = [];
  while (pool.length) {
    const idx = _pickWeightedIndex(pool);
    const picked = pool.splice(idx, 1)[0];
    queue.push(picked);
  }
  return queue;
}

function rebuildRandomNoteReviewQueue(options) {
  const opts = options || {};
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  const excludeNodeId = opts.excludeNodeId != null ? opts.excludeNodeId : (current && current.nodeId);
  const queue = _buildRandomNoteReviewQueue(excludeNodeId, opts);
  randomNoteReviewQueue = queue;
  randomNoteReviewIndex = queue.length ? 0 : -1;
  return queue.length;
}
