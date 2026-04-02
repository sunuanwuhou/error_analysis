// ============================================================
// 调试功能
// ============================================================
function debugStorage() {
  const errorsData = errors && errors.length ? '存在' : null;
  const notesData  = notesByType && Object.keys(notesByType).length ? '存在' : null;

  const msg = `
🔍 存储调试信息：

📋 错题数据: ${errorsData || '不存在'}
📝 笔记数据: ${notesData || '不存在'}

📊 统计信息:
  - 错题数量: ${errors ? errors.length : 0}
  - 笔记类型数量: ${notesByType ? Object.keys(notesByType).length : 0}
  - 笔记面板状态: ${notesPanelOpen ? '展开' : '收起'}
  - 编辑模式状态: ${globalNoteEditing ? '编辑中' : '查看中'}
  - 当前笔记结构: ${JSON.stringify(notesByType, null, 2)}

💡 建议:
  - 如果错题数据不存在，请先添加一些错题
  - 如果笔记数据不存在，点击"🔄 同步笔记"按钮
  - 打开浏览器开发者工具查看控制台日志
  `;

  alert(msg);
  console.log('🔍 存储调试信息:', {
    错题数据存在: !!errorsData,
    笔记数据存在: !!notesData,
    错题数量: errors ? errors.length : 0,
    笔记类型数量: notesByType ? Object.keys(notesByType).length : 0,
    笔记面板状态: notesPanelOpen ? '展开' : '收起',
    编辑模式状态: globalNoteEditing ? '编辑中' : '查看中',
    当前笔记结构: notesByType
  });
}

function debugSync() {
  console.log('🐛 开始调试同步功能...');

  if (!errors || errors.length === 0) {
    alert('❌ 没有错题数据，无法同步！请先添加一些错题。');
    return;
  }

  console.log('✅ 有错题数据，开始同步...');
  syncNotesWithErrors();
  renderNotesByType();

  const msg = `
🐛 同步调试完成！

📊 同步结果:
  - 错题数量: ${errors.length}
  - 笔记类型数量: ${Object.keys(notesByType).length}
  - 笔记结构: ${JSON.stringify(notesByType, null, 2)}

💡 请查看浏览器控制台获取详细日志
  `;

  alert(msg);
  console.log('🐛 同步调试完成，最终笔记结构:', notesByType);
}
