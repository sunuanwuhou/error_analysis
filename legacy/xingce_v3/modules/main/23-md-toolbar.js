// ============================================================
// MD 工具栏插入
// ============================================================
function mdInsert(type) {
  const ta = document.getElementById('globalNoteTA');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const sel = ta.value.slice(start, end);
  let before = '', after = '', defText = '', cursorToEnd = false;
  switch (type) {
    case 'bold':      before='**'; after='**'; defText='加粗文字'; break;
    case 'italic':    before='*';  after='*';  defText='斜体文字'; break;
    case 'heading':   before='## '; after=''; defText='标题'; cursorToEnd=true; break;
    case 'list':      before='- '; after=''; defText='列表项'; cursorToEnd=true; break;
    case 'code':      before='`'; after='`'; defText='代码'; break;
    case 'codeblock': {
      const inner = sel || '代码内容';
      const ins = '```\n' + inner + '\n```';
      ta.value = ta.value.slice(0, start) + ins + ta.value.slice(end);
      ta.selectionStart = start + 4; ta.selectionEnd = start + 4 + inner.length;
      ta.focus(); liveNotePreview(); return;
    }
    case 'table': {
      const ins = '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| A | B | C |\n';
      ta.value = ta.value.slice(0, start) + ins + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + ins.length;
      ta.focus(); liveNotePreview(); return;
    }
    default: return;
  }
  const inner = sel || defText;
  const insert = before + inner + after;
  ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
  if (cursorToEnd) {
    ta.selectionStart = ta.selectionEnd = start + insert.length;
  } else {
    ta.selectionStart = start + before.length;
    ta.selectionEnd = start + before.length + inner.length;
  }
  ta.focus();
  liveNotePreview();
}
