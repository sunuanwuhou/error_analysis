// ============================================================
// 存储使用量检查（IndexedDB 无 5 MB 限制，直接隐藏警告）
// ============================================================
function checkStorageUsage() {
  try { document.getElementById('storageWarn').style.display = 'none'; } catch(e) {}
}
