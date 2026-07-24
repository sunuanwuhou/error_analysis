/**
 * Reproduce legacy xingce: note persistence after refresh + boot time.
 * Run: cd frontend && npx playwright test ../scripts/diagnostics/test_legacy_notes_refresh.spec.js --reporter=line
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.LEGACY_BASE || 'http://127.0.0.1:8088'

async function login(request) {
  const res = await request.post(`${BASE}/api/auth/login`, {
    data: { username: 'wesly', password: 'admin123456' },
  })
  expect(res.ok()).toBeTruthy()
}

async function readIdb(page) {
  return page.evaluate(async () => {
    const keys = ['xc_knowledge_tree', 'xc_knowledge_notes', 'xc_notes_by_type']
    const openReq = indexedDB.open('xingce_db', 1)
    const db = await new Promise((resolve, reject) => {
      openReq.onsuccess = () => resolve(openReq.result)
      openReq.onerror = () => reject(openReq.error)
    })
    const out = {}
    for (const key of keys) {
      out[key] = await new Promise((resolve) => {
        const tx = db.transaction('kv', 'readonly')
        const store = tx.objectStore('kv')
        const req = store.get(key)
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
  return {
    treeRootCount: tree?.roots?.length ?? 0,
    treeContent,
    mapContent,
  }
}

test('legacy notes survive refresh and boot under 60s', async ({ page, request }) => {
  test.setTimeout(180000)
  await login(request)

  const t0 = Date.now()
  await page.goto(`${BASE}/?embed=1`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(
    () => typeof renderNotesByType === 'function' && document.getElementById('notesContent'),
    { timeout: 120000 },
  )
  const bootMs = Date.now() - t0
  console.log('boot_ms', bootMs)

  const before = summarizeNotes(await readIdb(page))
  console.log('idb_before', before)

  const injected = await page.evaluate(() => {
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
    else if (typeof syncKnowledgeNotesFromTree === 'function') syncKnowledgeNotesFromTree()
    if (typeof persistKnowledgeStateNow === 'function') persistKnowledgeStateNow()
    else if (typeof saveKnowledgeState === 'function') saveKnowledgeState({ preserveTreeShape: true })
    if (typeof renderNotesByType === 'function') renderNotesByType()
    return { ok: true, nodeId: target.id, title: target.title, marker }
  })
  console.log('injected', injected)
  expect(injected.ok).toBeTruthy()

  await page.waitForTimeout(2000)
  const afterInject = summarizeNotes(await readIdb(page))
  console.log('idb_after_inject', afterInject)
  expect(afterInject.treeContent + afterInject.mapContent).toBeGreaterThan(0)

  const t1 = Date.now()
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(
    () => typeof renderNotesByType === 'function' && document.getElementById('notesContent'),
    { timeout: 120000 },
  )
  const reloadMs = Date.now() - t1
  console.log('reload_ms', reloadMs)

  const afterReload = summarizeNotes(await readIdb(page))
  console.log('idb_after_reload', afterReload)

  const markerInIdb = await page.evaluate(async (marker) => {
    const keys = ['xc_knowledge_tree', 'xc_knowledge_notes']
    const openReq = indexedDB.open('xingce_db', 1)
    const db = await new Promise((resolve, reject) => {
      openReq.onsuccess = () => resolve(openReq.result)
      openReq.onerror = () => reject(openReq.error)
    })
    let blob = ''
    for (const key of keys) {
      const val = await new Promise((resolve) => {
        const tx = db.transaction('kv', 'readonly')
        const req = tx.objectStore('kv').get(key)
        req.onsuccess = () => resolve(req.result?.v || '')
        req.onerror = () => resolve('')
      })
      blob += val
    }
    db.close()
    return blob.includes(marker)
  }, injected.marker)
  console.log('marker_in_idb', markerInIdb)

  const overlayStuck = await page.evaluate(() => !!document.getElementById('_wsTabLoadingOverlay'))
  console.log('loading_overlay_stuck', overlayStuck)

  expect(markerInIdb, 'injected note should persist in IndexedDB after reload').toBeTruthy()
  expect(overlayStuck, 'loading overlay should not remain after reload').toBeFalsy()
  expect(reloadMs, 'reload should finish within 60s').toBeLessThan(60000)
})
