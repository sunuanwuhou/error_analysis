// ============================================================
// Random note candidate scoring and queue helpers
// ============================================================
const RANDOM_NOTE_EDIT_WEIGHT = 0.7;
const RANDOM_NOTE_VIEW_WEIGHT = 0.3;
const RANDOM_NOTE_RECENT_VIEW_DOWN_WEIGHT = 0.2;
const RANDOM_NOTE_RECENT_VIEW_DAYS = 1;
let randomNoteReviewQueue = [];
let randomNoteReviewIndex = -1;

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

function _hasMeaningfulNoteContent(contentMd, title) {
  const body = String(contentMd || '').trim();
  if (!body) return false;
  const normalizedBody = _normalizeNoteMeaningfulText(body);
  if (!normalizedBody) return false;
  const normalizedTitle = _normalizeNoteMeaningfulText(String(title || ''));
  if (!normalizedTitle) return true;
  if (normalizedBody === normalizedTitle) return false;
  if (normalizedBody.startsWith(normalizedTitle) && normalizedBody.length <= normalizedTitle.length + 2) return false;
  return true;
}

function _collectRandomNoteCandidates() {
  if (typeof ensureKnowledgeState === 'function') ensureKnowledgeState();
  const roots = (typeof getKnowledgeRootNodes === 'function')
    ? (getKnowledgeRootNodes() || [])
    : ((knowledgeTree && knowledgeTree.roots) || []);
  const candidates = [];
  const walk = (nodes) => {
    (nodes || []).forEach(node => {
      if (!node || typeof node !== 'object') return;
      const contentMd = String(node.contentMd || '').trim();
      if (_hasMeaningfulNoteContent(contentMd, node.title)) {
        const tracking = (noteReviewTracking && noteReviewTracking[node.id]) || {};
        const editGapDays = _daysSince(node.updatedAt, 365);
        const viewGapDays = _daysSince(tracking.lastViewedAt, 365);
        let score = (RANDOM_NOTE_EDIT_WEIGHT * Math.log1p(editGapDays))
          + (RANDOM_NOTE_VIEW_WEIGHT * Math.log1p(viewGapDays));
        if (viewGapDays < RANDOM_NOTE_RECENT_VIEW_DAYS) score *= RANDOM_NOTE_RECENT_VIEW_DOWN_WEIGHT;
        candidates.push({
          nodeId: String(node.id || ''),
          title: String(node.title || '未命名笔记'),
          contentMd,
          updatedAt: String(node.updatedAt || ''),
          lastViewedAt: String(tracking.lastViewedAt || ''),
          viewCount: Number(tracking.viewCount || 0),
          editGapDays,
          viewGapDays,
          score: Math.max(0.001, score),
        });
      }
      walk(node.children || []);
    });
  };
  walk(roots);
  return candidates;
}

function getRandomNoteReviewCandidateCount() {
  return _collectRandomNoteCandidates().length;
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

function _buildRandomNoteReviewQueue(excludeNodeId) {
  const source = _collectRandomNoteCandidates().filter(item => item.nodeId && item.nodeId !== String(excludeNodeId || ''));
  const pool = source.slice();
  const queue = [];
  while (pool.length) {
    const idx = _pickWeightedIndex(pool);
    const picked = pool.splice(idx, 1)[0];
    queue.push(picked);
  }
  return queue;
}
