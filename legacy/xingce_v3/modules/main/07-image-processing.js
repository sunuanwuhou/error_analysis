// ============================================================
// 图片处理（直接 base64 存在 e.imgData，无 IndexedDB）
// ============================================================
function normalizeOCRText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}
function parseOCRQuestionPayload(text) {
  const normalized = normalizeOCRText(text)
    .replace(/\s([A-D])[\.、]/g, '\n$1.')
    .replace(/([（(][A-D][）)])/g, '\n$1');
  const compact = normalized.split('\n').map(line => line.trim()).filter(Boolean);
  const optionStart = compact.findIndex(line => /^[A-D][\.\u3001]/.test(line) || /^[（(][A-D][）)]/.test(line));
  if (optionStart === -1) {
    return { question: normalized, options: '' };
  }
  const question = compact.slice(0, optionStart).join('\n').trim();
  const options = compact.slice(optionStart).join('|').trim();
  return { question, options };
}
parseOCRQuestionPayload = function(text) {
  const normalized = normalizeOCRText(text)
    .replace(/\s+([A-D])[\.\u3001]/g, '\n$1.')
    .replace(/\s+([A-D])\s+/g, '\n$1. ');
  const compact = normalized.split('\n').map(line => line.trim()).filter(Boolean);
  const optionStart = compact.findIndex(line => /^[A-D][\.\u3001]/.test(line));
  if (optionStart !== -1) {
    const question = compact.slice(0, optionStart).join('\n').trim();
    const options = compact.slice(optionStart).join('|').trim();
    return { question, options };
  }
  if (compact.length >= 3) {
    const numericOptionLines = compact.slice(1).filter(line => /^-?\d+(?:\.\d+)?$/.test(line.replace(/\s+/g, '')));
    if (numericOptionLines.length >= 2) {
      const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
      const options = numericOptionLines
        .slice(0, labels.length)
        .map((line, idx) => `${labels[idx]}. ${line.replace(/\s+/g, '')}`)
        .join('|');
      return { question: compact[0], options };
    }
  }
  return { question: normalized, options: '' };
};

async function unrefImageValue(value) {
  if (!isRemoteImageRef(value)) return;
  try {
    await fetch(`${value}/unref`, { method: 'DELETE', credentials: 'include' });
  } catch (e) {
    console.warn('[unrefImageValue] failed', e);
  }
}
// 解析图片
// 在题目/解析文本框中粘贴图片
document.addEventListener('paste', async e=>{
  const items=Array.from(e.clipboardData.items||[]);
  const imgItem = items.find(i=>i.type.startsWith('image/'));

  // 笔记 textarea 图片粘贴：存入 noteImages，插入短引用
  if(e.target.id === 'noteTypeTextarea'){
    if(!imgItem) return;
    e.preventDefault();
    const b64=await readFileAsBase64(imgItem.getAsFile());
    const id=noteImgId();
    noteImages[id]=await uploadImageValue(b64);
    saveNotesByType(); // 持久化图片
    const ta=e.target;
    const start=ta.selectionStart, end=ta.selectionEnd;
    const insertion=`![图片](noteimg:${id})`;
    ta.value=ta.value.substring(0,start)+insertion+ta.value.substring(end);
    ta.selectionStart=ta.selectionEnd=start+insertion.length;
    liveNotePreview();
    return;
  }

  // 题目/解析文本框图片粘贴
  if(!document.getElementById('addModal').classList.contains('open')) return;
  if(!imgItem) return;
  if(e.target.id === 'editQuestion'){
    e.preventDefault();
    const b64=await readFileAsBase64(imgItem.getAsFile());
    setEditImgPreview(b64);
  } else if(e.target.id === 'editAnalysis'){
    e.preventDefault();
    const b64=await readFileAsBase64(imgItem.getAsFile());
    setEditAnalysisImgPreview(b64);
  }
});

// checkStorageUsage 已在上方 IndexedDB 层定义
