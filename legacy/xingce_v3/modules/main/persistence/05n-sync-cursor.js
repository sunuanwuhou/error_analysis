// ============================================================
// Sync cursor persistence helpers
// ============================================================
function getLastSyncCursor() {
  try {
    return {
      since: localStorage.getItem('lastSyncTime') || '',
      cursorAt: localStorage.getItem('lastSyncCursorAt') || '',
      cursorId: localStorage.getItem('lastSyncCursorId') || ''
    };
  } catch (e) {
    return { since: '', cursorAt: '', cursorId: '' };
  }
}

function clearLastSyncCursor() {
  try {
    localStorage.removeItem('lastSyncTime');
    localStorage.removeItem('lastSyncCursorAt');
    localStorage.removeItem('lastSyncCursorId');
  } catch (e) {}
}

function rememberLastSyncCursor(serverTime) {
  try {
    if (serverTime) localStorage.setItem('lastSyncTime', serverTime);
    localStorage.removeItem('lastSyncCursorAt');
    localStorage.removeItem('lastSyncCursorId');
  } catch (e) {}
}
