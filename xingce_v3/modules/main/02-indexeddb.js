// ============================================================
// IndexedDB 存储层（替代 localStorage）
// ============================================================
const DB = (() => {
  const DB_NAME = 'xingce_db', DB_VER = 1, STORE = 'kv';
  let _db = null;
  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE))
          db.createObjectStore(STORE, { keyPath: 'k' });
      };
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror  = e => rej(e.target.error);
    });
  }
  async function get(key) {
    const db = await open();
    return new Promise((res, rej) => {
      const req = db.transaction(STORE,'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => res(req.result ? req.result.v : null);
      req.onerror = e => rej(e.target.error);
    });
  }
  async function set(key, val) {
    const db = await open();
    return new Promise((res, rej) => {
      const req = db.transaction(STORE,'readwrite').objectStore(STORE).put({ k: key, v: val });
      req.onsuccess = () => res();
      req.onerror = e => rej(e.target.error);
    });
  }
  // 首次运行时将 localStorage 数据迁移到 IndexedDB
  async function migrateFromLocalStorage(keys) {
    const done = await get('__idb_migrated__');
    if (done) return;
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v !== null) await set(k, v);
    }
    await set('__idb_migrated__', '1');
    console.log('[IndexedDB] localStorage 数据迁移完成');
  }
  return { get, set, migrateFromLocalStorage };
})();
