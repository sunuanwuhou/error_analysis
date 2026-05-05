import fs from 'node:fs'
import path from 'path'
import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8080'
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'phase10-check')
const GOTO = { waitUntil: 'domcontentloaded' }

async function waitNewWorkspaceShell(page) {
  await page.waitForSelector('.xc-workspace', { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('.xc-loading'), { timeout: 120000 })
}

async function maybeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: 'wesly', password: 'admin123456' },
  })
  return res.ok()
}

async function fetchSyncOps(page) {
  return page.evaluate(async () => {
    const res = await fetch('/api/sync', { credentials: 'include' })
    return res.json()
  })
}

function parsePayload(op) {
  let p = op.payload
  if (typeof p === 'string') {
    try {
      p = JSON.parse(p)
    } catch {
      return {}
    }
  }
  return p && typeof p === 'object' ? p : {}
}

function collectKnowledgeNodes(ops) {
  const map = new Map()
  for (const op of ops || []) {
    if (op.op_type !== 'knowledge_node_upsert') continue
    const n = parsePayload(op)
    const id = String(n.id || '').trim()
    if (!id) continue
    map.set(id, {
      id,
      parentId: n.parentId == null || n.parentId === '' ? null : String(n.parentId),
      title: String(n.title || ''),
    })
  }
  return map
}

function knowledgePathText(noteNodeId, byId) {
  const id = noteNodeId ? String(noteNodeId) : ''
  if (!id || !byId.has(id)) return ''
  const titles = []
  let cur = id
  const guard = new Set()
  while (cur && byId.has(cur) && !guard.has(cur)) {
    guard.add(cur)
    const n = byId.get(cur)
    titles.unshift(n.title)
    cur = n.parentId || ''
  }
  return titles.join(' ')
}

/** 与 store `filteredErrors` 任务阶段 + 搜索口径一致的离线计数（用于验收，不依赖旧版 DOM hydrate） */
function expectedCountsFromOps(ops, options) {
  const { taskMode, searchRaw } = options
  const terms = String(searchRaw || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  const knMap = collectKnowledgeNodes(ops)

  let list = []
  for (const op of ops || []) {
    if (op.op_type !== 'error_upsert') continue
    const e = parsePayload(op)
    if (!e.id) continue
    list.push(e)
  }

  if (taskMode === 'diagnose') {
    list = list.filter(e => {
      const stage = String(e.workflowStage || '')
      return stage === 'captured' || stage === 'diagnosing'
    })
  }

  if (terms.length) {
    list = list.filter(e => {
      const rec = e
      const kpath = knowledgePathText(e.noteNodeId, knMap)
      const text = [
        e.question,
        e.options,
        e.analysis,
        kpath,
        e.type,
        e.subtype,
        e.subSubtype,
        e.errorReason,
        e.rootReason,
        e.tip,
        rec.srcYear,
        rec.srcProvince,
        rec.srcOrigin,
      ]
        .filter(v => v != null && String(v).trim() !== '')
        .map(v => String(v))
        .join(' ')
        .toLowerCase()
      return terms.every(t => text.includes(t))
    })
  }

  return list.length
}

async function parseNewFilteredCount(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.xc-main')
    if (!el) return { filtered: -1, total: -1 }
    const f = el.getAttribute('data-filtered-count')
    const t = el.getAttribute('data-total-count')
    return {
      filtered: Number.parseInt(f || '-1', 10),
      total: Number.parseInt(t || '-1', 10),
    }
  })
}

function probeWorkflowStages(ops) {
  const stages = {}
  let diag = 0
  let total = 0
  for (const op of ops || []) {
    if (op.op_type !== 'error_upsert') continue
    total += 1
    const p = parsePayload(op)
    const s = String(p.workflowStage || '')
    stages[s] = (stages[s] || 0) + 1
    if (s === 'captured' || s === 'diagnosing') diag += 1
  }
  return { total, diag, stages }
}

test('phase10 filter self-check vs /api/sync snapshot', async ({ page }) => {
  test.setTimeout(180000)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const loginAttempted = await maybeLogin(page)

  await page.goto(`${BASE}/new/xingce/workspace`, GOTO)
  await waitNewWorkspaceShell(page)

  const syncData = await fetchSyncOps(page)
  const ops = syncData.ops || []
  const probe = probeWorkflowStages(ops)

  const expDiagnose = expectedCountsFromOps(ops, { taskMode: 'diagnose' })
  const expAll = expectedCountsFromOps(ops, {})
  const expSearch = expectedCountsFromOps(ops, { taskMode: null, searchRaw: '逻辑 判断' })

  await page.locator('.fs-advanced-toggle').click()
  await page.waitForTimeout(200)
  await page.locator('.fs-chip-row').getByRole('button', { name: /待判因/ }).click()
  await page.waitForTimeout(400)
  const newDiagnose = await parseNewFilteredCount(page)

  await page.locator('.fs-chip-row').getByRole('button', { name: /全部任务/ }).click()
  await page.waitForTimeout(400)
  const newAll = await parseNewFilteredCount(page)

  const searchInput = page.locator('.fs-search')
  await searchInput.fill('逻辑 判断')
  await searchInput.dispatchEvent('input')
  await page.waitForTimeout(400)
  const newSearch = await parseNewFilteredCount(page)

  const summary = {
    timestamp: new Date().toISOString(),
    loginAttempted,
    expected: {
      diagnose: expDiagnose,
      all: expAll,
      search: expSearch,
    },
    apiProbe: probe,
    new: { diagnose: newDiagnose, all: newAll, search: newSearch },
    match: {
      diagnose: expDiagnose === newDiagnose.filtered,
      all: expAll === newAll.filtered,
      search: expSearch === newSearch.filtered,
    },
  }
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')

  expect(probe.total).toBe(expAll)
  expect(probe.diag).toBe(expDiagnose)
  expect(newDiagnose.total).toBe(newAll.total)
  expect(newAll.total).toBe(newSearch.total)
  expect(newDiagnose.filtered).toBe(expDiagnose)
  expect(newAll.filtered).toBe(expAll)
  expect(newSearch.filtered).toBe(expSearch)
})
