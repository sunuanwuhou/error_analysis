// ============================================================
// 工具
// ============================================================
function today() { return new Date().toISOString().split('T')[0]; }
function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.floor((new Date(b) - new Date(a)) / 86400000);
}
function addDays(d, n) {
  const dt = new Date(d); dt.setDate(dt.getDate()+n);
  return dt.toISOString().split('T')[0];
}
function escapeHtml(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function hl(s, kw) {
  if (!kw) return escapeHtml(s);
  const e = escapeHtml(s);
  const ek = escapeHtml(kw).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return e.replace(new RegExp(ek,'gi'), m=>`<span class="highlight">${escapeHtml(m)}</span>`);
}
function renderAnalysis(text, kw) {
  if (!text) return '';
  const processBlock = (block) => {
    const escaped = kw ? hl(block, kw) : escapeHtml(block);
    return escaped.replace(/【([^】]+)】/g, '<strong style="color:#2c3e50;display:block;margin-bottom:2px">【$1】</strong>');
  };
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return escapeHtml(text);
    return lines.map(l => `<p style="margin:0 0 4px">${processBlock(l)}</p>`).join('');
  }
  return paragraphs.map(p => {
    const lines = p.split(/\n/).map(l => l.trim()).filter(Boolean);
    return `<p style="margin:0 0 8px">${lines.map(l => processBlock(l)).join('<br>')}</p>`;
  }).join('');
}
function newId() { return crypto.randomUUID(); }
function idArg(id) { return JSON.stringify(String(id)); }
function noteNodeArg(id) { return JSON.stringify(String(id || '')); }
function normalizeErrorId(id) { return String(id); }
function findErrorById(id) {
  const targetId = normalizeErrorId(id);
  return errors.find(x => normalizeErrorId(x.id) === targetId) || null;
}
function isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}
