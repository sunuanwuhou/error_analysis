// ============================================================
// 新版 renderAll 所需函数（补充定义）
// ============================================================
function toggleExpMain(type) {
  if (expMain.has(type)) expMain.delete(type); else expMain.add(type);
  saveExpMain(); renderAll();
}
function toggleExpMainSub(type, subtype) {
  const k = type + '::' + subtype;
  if (expMainSub.has(k)) expMainSub.delete(k); else expMainSub.add(k);
  saveExpMain(); renderAll();
}
function toggleExpMainSub2(type, subtype, subSubtype) {
  const k = type + '::' + subtype + '::' + subSubtype;
  if (expMainSub2.has(k)) expMainSub2.delete(k); else expMainSub2.add(k);
  saveExpMain(); renderAll();
}
function updateStatsBar(count, total) {
  // 复用原有 renderStats，传入当前筛选结果
  renderStats(getFiltered());
}
function copyQuestion(id) {
  const e = errors.find(x => x.id === id);
  if (!e) return;
  const text = e.question || '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch(ex) {}
  document.body.removeChild(ta);
}
function isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}
