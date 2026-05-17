// ============================================================
// Import parse
// ============================================================

function tryParseJson(text) {
  try { return JSON.parse(text); } catch (e) {}
  try {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
  } catch (e) {}
  try {
    const fixed = text.replace(/"((?:[^"\\]|\\.)*)"/g, (_, s) => '"' + s.replace(/\r?\n/g, '\\n') + '"');
    const m = fixed.match(/\[[\s\S]*\]/);
    return JSON.parse(m ? m[0] : fixed);
  } catch (e) {}
  return null;
}
