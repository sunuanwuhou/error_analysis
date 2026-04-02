// ============================================================
// 类型特定笔记树编辑函数
// ============================================================

// 切换节点展开/折叠
function toggleNoteNode(key, level) {
  const node = event.currentTarget.parentElement;
  const content = node.querySelector('.note-tree-content');
  const arrow = node.querySelector('.note-tree-arrow');

  if (content.style.display === 'none' || !content.style.display) {
    content.style.display = 'block';
    arrow.textContent = '▼';
  } else {
    content.style.display = 'none';
    arrow.textContent = '▶';
  }
}

// 编辑节点内容
function editNoteNode(key, level) {
  const node = getNoteNodeByKey(notesByType, key, level);
  if (!node) return;

  const newContent = prompt('编辑笔记内容（支持Markdown）：', node.content || '');
  if (newContent !== null) {
    node.content = newContent;
    saveNotesByType();
    renderNotesByType();
  }
}

// 添加子节点
function addSubNote(parentKey, parentLevel) {
  const parent = getNoteNodeByKey(notesByType, parentKey, parentLevel);
  if (!parent) return;

  const title = prompt('请输入子节点标题：');
  if (!title) return;

  if (!parent.children) parent.children = {};
  const key = title; // 使用标题作为key

  parent.children[key] = {
    title: title,
    content: '',
    children: {}
  };

  saveNotesByType();
  renderNotesByType();
}

// 删除节点
function deleteNoteNode(key, level) {
  if (!confirm('确定要删除这个节点吗？删除后无法恢复。')) return;

  deleteNoteNodeRecursive(notesByType, key, level);
  saveNotesByType();
  renderNotesByType();
}

// 递归查找节点
function getNoteNodeByKey(notesData, key, level) {
  if (level === 0) {
    return notesData[key];
  }

  for (const k in notesData) {
    if (notesData[k].children) {
      const found = getNoteNodeByKey(notesData[k].children, key, level - 1);
      if (found) return found;
    }
  }
  return null;
}

// 递归删除节点
function deleteNoteNodeRecursive(notesData, key, level) {
  if (level === 0) {
    delete notesData[key];
    return true;
  }

  for (const k in notesData) {
    if (notesData[k].children) {
      const deleted = deleteNoteNodeRecursive(notesData[k].children, key, level - 1);
      if (deleted) {
        // 如果子节点为空，可以考虑删除父节点（可选）
        if (Object.keys(notesData[k].children).length === 0) {
          delete notesData[k].children;
        }
        return true;
      }
    }
  }
  return false;
}
