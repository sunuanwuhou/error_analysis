import { chromium } from '@playwright/test'

const BASE = process.env.LEGACY_BASE || 'http://127.0.0.1:8088'

async function readIdb(page) {
  return page.evaluate(async () => {
    const keys = ['xc_knowledge_tree', 'xc_knowledge_notes']
    const openReq = indexedDB.open('xingce_db', 1)
    await new Promise((resolve, reject) => {
      openReq.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' })
      }
      openReq.onsuccess = () => resolve()
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

function summarize(raw) {
  const tree = raw.xc_knowledge_tree ? JSON.parse(raw.xc_knowledge_tree) : null
  const notes = raw.xc_knowledge_notes ? JSON.parse(raw.xc_knowledge_notes) : {}
  let treeContent = 0
  let mapContent = 0
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (String(node?.contentMd || '').trim()) treeContent += 1
      walk(node.children)
    }
  }
  walk(tree?.roots)
  for (const item of Object.values(notes || {})) {
    if (String(item?.content || '').trim()) mapContent += 1
  }
  const blob = JSON.stringify({ tree, notes })
  return { treeContent, mapContent, hasMarker: blob.includes('REFRESH_TEST') }
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
await context.addInitScript(() => {
  window.__earlyIdbMarker = null
  try {
    const req = indexedDB.open('xingce_db', 1)
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) {
        window.__earlyIdbMarker = false
        return
      }
      const tx = db.transaction('kv', 'readonly')
      const g1 = tx.objectStore('kv').get('xc_knowledge_tree')
      const g2 = tx.objectStore('kv').get('xc_knowledge_notes')
      let tree = ''
      let notes = ''
      g1.onsuccess = () => { tree = g1.result?.v || '' }
      g2.onsuccess = () => {
        notes = g2.result?.v || ''
        window.__earlyIdbMarker = (tree + notes).includes('REFRESH_TEST')
      }
    }
    req.onerror = () => { window.__earlyIdbMarker = false }
  } catch (e) {
    window.__earlyIdbMarker = false
  }
})
await context.request.post(`${BASE}/api/auth/login`, {
  data: { username: 'wesly', password: 'admin123456' },
})
const page = await context.newPage()
await page.goto(`${BASE}/?embed=1`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForFunction(() => typeof getKnowledgeRootNodes === 'function' && typeof persistKnowledgeStateNow === 'function', { timeout: 120000 })

const injected = await page.evaluate(async () => {
  const marker = `__REFRESH_TEST_${Date.now()}`
  let target = getKnowledgeRootNodes()[0]
  if (!target) return { ok: false }
  target.contentMd = `${marker}\n# test`
  target.updatedAt = new Date().toISOString()
  syncKnowledgeNotesFromTreeSafe()
  await persistKnowledgeStateNow()
  return { ok: true, marker, nodeId: target.id, title: target.title }
})
console.log('inject', injected)
await page.waitForTimeout(800)
console.log('after_inject', summarize(await readIdb(page)))
await page.reload({ waitUntil: 'domcontentloaded' })
const early = await page.evaluate(() => window.__earlyIdbMarker)
console.log('reload_early_marker', early)
console.log('reload_immediate', summarize(await readIdb(page)))
await page.waitForFunction(() => typeof renderNotesByType === 'function', { timeout: 120000 })
await page.waitForTimeout(2500)
console.log('after_boot', summarize(await readIdb(page)))
await browser.close()
