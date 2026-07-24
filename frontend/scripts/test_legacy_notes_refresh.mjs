import { chromium } from '@playwright/test'

const BASE = process.env.LEGACY_BASE || 'http://127.0.0.1:8088'

async function waitAppReady(page) {
  await page.waitForFunction(
    () => typeof renderNotesByType === 'function'
      && document.getElementById('notesContent')
      && typeof DB !== 'undefined',
    { timeout: 120000 },
  )
  await page.waitForTimeout(1500)
}

async function readIdb(page) {
  return page.evaluate(async () => {
    const keys = ['xc_knowledge_tree', 'xc_knowledge_notes', 'xc_notes_by_type']
    const openReq = indexedDB.open('xingce_db', 1)
    await new Promise((resolve, reject) => {
      openReq.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'k' })
        }
      }
      openReq.onsuccess = () => resolve(openReq.result)
      openReq.onerror = () => reject(openReq.error)
    })
    const db = openReq.result
    const out = {}
    for (const key of keys) {
      out[key] = await new Promise((resolve) => {
        const tx = db.transaction('kv', 'readonly')
        const req = tx.objectStore('kv').get(key)
        req.onsuccess = () => resolve(req.result ? req.result.v : null)
        req.onerror = () => resolve(null)
      })
    }
    db.close()
    return out
  })
}

function summarizeNotes(raw) {
  const tree = raw.xc_knowledge_tree ? JSON.parse(raw.xc_knowledge_tree) : null
  const notes = raw.xc_knowledge_notes ? JSON.parse(raw.xc_knowledge_notes) : {}
  let treeContent = 0
  let mapContent = 0
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (!node) continue
      if (String(node.contentMd || '').trim()) treeContent += 1
      walk(node.children)
    }
  }
  if (tree?.roots) walk(tree.roots)
  for (const item of Object.values(notes || {})) {
    if (String(item?.content || '').trim()) mapContent += 1
  }
  return { treeRootCount: tree?.roots?.length ?? 0, treeContent, mapContent }
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const login = await context.request.post(`${BASE}/api/auth/login`, {
  data: { username: 'wesly', password: 'admin123456' },
})
console.log('login_ok', login.ok())

const page = await context.newPage()
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('PAGE_ERR', msg.text().slice(0, 200))
})

const t0 = Date.now()
await page.goto(`${BASE}/?embed=1`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await waitAppReady(page)
console.log('boot_ms', Date.now() - t0)

const before = summarizeNotes(await readIdb(page))
console.log('idb_before', before)

const injected = await page.evaluate(async () => {
  const marker = `__REFRESH_TEST_${Date.now()}`
  let target = null
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (!node) continue
      if (node.isLeaf || !(node.children && node.children.length)) {
        target = node
        return
      }
      walk(node.children)
      if (target) return
    }
  }
  if (typeof getKnowledgeRootNodes === 'function') walk(getKnowledgeRootNodes())
  if (!target && typeof collectKnowledgeNodes === 'function') {
    const all = collectKnowledgeNodes()
    target = all.find((n) => n?.isLeaf) || all[0] || null
  }
  if (!target) return { ok: false, reason: 'no target node' }
  selectedKnowledgeNodeId = target.id
  target.contentMd = `${marker}\n\n# 刷新测试笔记`
  target.updatedAt = new Date().toISOString()
  if (typeof syncKnowledgeNotesFromTreeSafe === 'function') syncKnowledgeNotesFromTreeSafe()
  if (typeof persistKnowledgeStateNow === 'function') {
    await persistKnowledgeStateNow()
  } else if (typeof saveKnowledgeState === 'function') {
    saveKnowledgeState({ preserveTreeShape: true })
  }
  return { ok: true, nodeId: target.id, title: target.title, marker }
})
console.log('injected', injected)
await page.waitForTimeout(2500)
console.log('idb_after_inject', summarizeNotes(await readIdb(page)))

const t1 = Date.now()
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
await waitAppReady(page)
console.log('reload_ms', Date.now() - t1)

const after = summarizeNotes(await readIdb(page))
console.log('idb_after_reload', after)

const markerInIdb = await page.evaluate(async (marker) => {
  const openReq = indexedDB.open('xingce_db', 1)
  const db = await new Promise((resolve, reject) => {
    openReq.onsuccess = () => resolve(openReq.result)
    openReq.onerror = () => reject(openReq.error)
  })
  let blob = ''
  for (const key of ['xc_knowledge_tree', 'xc_knowledge_notes']) {
    blob += await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readonly')
      const req = tx.objectStore('kv').get(key)
      req.onsuccess = () => resolve(req.result?.v || '')
      req.onerror = () => resolve('')
    })
  }
  db.close()
  return blob.includes(marker)
}, injected.marker)

const runtime = await page.evaluate((marker) => ({
  overlay: !!document.getElementById('_wsTabLoadingOverlay'),
  selected: typeof selectedKnowledgeNodeId !== 'undefined' ? selectedKnowledgeNodeId : null,
  domHasMarker: (document.getElementById('notesContent')?.innerText || '').includes(marker),
  nodeContentLen: (() => {
    if (typeof getKnowledgeNodeById !== 'function' || !selectedKnowledgeNodeId) return -1
    const n = getKnowledgeNodeById(selectedKnowledgeNodeId)
    return n ? String(n.contentMd || '').length : -1
  })(),
}), injected.marker)

console.log('marker_in_idb', markerInIdb)
console.log('runtime', runtime)

await browser.close()
const pass = injected.ok && markerInIdb
console.log('PASS', pass)
process.exit(pass ? 0 : 1)
