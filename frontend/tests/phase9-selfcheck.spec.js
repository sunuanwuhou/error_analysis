import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8080'
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'phase9-check')
/** SPA 长连接会导致 networkidle 长期不满足，易触发 30s 默认用例超时。 */
const GOTO = { waitUntil: 'domcontentloaded' }

async function waitNewWorkspaceShell(page) {
  await page.waitForSelector('.xc-workspace', { timeout: 60000 })
  await page.waitForFunction(
    () => !document.querySelector('.xc-loading'),
    { timeout: 120000 },
  )
}

async function maybeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: 'wesly', password: 'admin123456' },
  })
  if (!res.ok()) return false
  return true
}

async function collectState(page, mode) {
  const titleSel = mode === 'new' ? '.ktn-title' : '.knowledge-tree-title'
  const nodeSel = mode === 'new' ? '.ktn-row' : '.knowledge-tree-node'
  const titles = await page.$$eval(titleSel, (els) => els.map((el) => (el.textContent || '').trim()).filter(Boolean))
  const dirty = titles.filter((t) => /^(undefined|null|nan|\[object object\])$/i.test(t))
  const visibleCount = await page.$$eval(nodeSel, (els) =>
    els.filter((el) => {
      const s = window.getComputedStyle(el)
      return s.display !== 'none' && s.visibility !== 'hidden'
    }).length
  )
  return { visibleCount, dirtyCount: dirty.length, dirtyTitles: dirty.slice(0, 20), sampleTitles: titles.slice(0, 30) }
}

async function expandAllNewTree(page) {
  for (let i = 0; i < 12; i += 1) {
    const changed = await page.evaluate(() => {
      let hasClosed = false
      document.querySelectorAll('.ktn-arrow').forEach((el) => {
        if ((el.textContent || '').trim() === '▸') {
          hasClosed = true
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }
      })
      return hasClosed
    })
    if (!changed) break
    await page.waitForTimeout(120)
  }
}

async function expandAllOldTree(page) {
  for (let i = 0; i < 12; i += 1) {
    const changed = await page.evaluate(() => {
      let hasClosed = false
      document.querySelectorAll('.knowledge-tree-toggle').forEach((el) => {
        if ((el.textContent || '').trim() === '▸') {
          hasClosed = true
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }
      })
      return hasClosed
    })
    if (!changed) break
    await page.waitForTimeout(150)
  }
}

/** 旧版在首页时可能未 hydrate 全量错题；知识树 DOM 也可能受 120 节点渲染预算限制。 */
async function prepareOldAppWorkspaceForKnowledgeTree(page) {
  await page.waitForFunction(() => typeof window.switchAppView === 'function', { timeout: 45000 })
  await page.evaluate(() => {
    if (typeof window.switchAppView === 'function') window.switchAppView('workspace')
  })
  await page.waitForSelector('body.app-view-workspace', { timeout: 45000 })
  await page.waitForFunction(
    () =>
      typeof window.renderSidebar === 'function' &&
      typeof window.renderAll === 'function' &&
      typeof window.ensureKnowledgeState === 'function',
    { timeout: 60000 },
  )
  await page.evaluate(async () => {
    if (
      typeof window.ensureFullWorkspaceDataLoaded === 'function' &&
      typeof window.hasFullWorkspaceDataLoaded === 'function' &&
      !window.hasFullWorkspaceDataLoaded()
    ) {
      await window.ensureFullWorkspaceDataLoaded()
    }
  })
  await page.waitForFunction(
    () =>
      typeof window.hasFullWorkspaceDataLoaded !== 'function' || window.hasFullWorkspaceDataLoaded(),
    { timeout: 90000 },
  )
  await page.evaluate(() => {
    if (typeof window.renderSidebar === 'function') window.renderSidebar()
  })
  await page.waitForTimeout(400)
  await page.waitForFunction(
    () => (document.querySelectorAll('#navScroll .knowledge-tree-node').length || 0) >= 1,
    { timeout: 30000 },
  )
}

/** 交替点击「继续加载」与展开 ▸，直到树稳定（对齐 legacy 侧边栏预算 + 懒展开 DOM）。 */
async function fullyExpandLegacyKnowledgeTree(page) {
  for (let round = 0; round < 50; round += 1) {
    const loadMore = page.locator('#navScroll button.btn-secondary').filter({ hasText: '继续加载' }).first()
    if ((await loadMore.count()) > 0) {
      await loadMore.click()
      await page.waitForTimeout(300)
      continue
    }
    const expandedAny = await page.evaluate(() => {
      let changed = false
      document.querySelectorAll('.knowledge-tree-toggle').forEach((el) => {
        if ((el.textContent || '').trim() === '▸') {
          changed = true
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }
      })
      return changed
    })
    if (!expandedAny) break
    await page.waitForTimeout(160)
  }
}

async function readOldKnowledgeBaselineMeta(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('#navScroll button.btn-secondary'))
    const loadMoreVisible = buttons.some((b) => (b.textContent || '').includes('继续加载'))
    return {
      bodyWorkspace: document.body.classList.contains('app-view-workspace'),
      fullDataLoaded:
        typeof window.hasFullWorkspaceDataLoaded === 'function' ? window.hasFullWorkspaceDataLoaded() : null,
      navKnowledgeNodes: document.querySelectorAll('#navScroll .knowledge-tree-node').length,
      loadMoreVisible,
    }
  })
}

async function collectOldTreeByRuntime(page) {
  return page.evaluate(() => {
    if (typeof window.ensureKnowledgeState === 'function') {
      try { window.ensureKnowledgeState({ persist: false }) } catch {}
    }
    if (typeof window.renderSidebar === 'function') {
      try { window.renderSidebar() } catch {}
    }

    const roots = typeof window.getKnowledgeRootNodes === 'function' ? window.getKnowledgeRootNodes() : []
    const rows = []
    function walk(node, pathTitles) {
      const title = String(node?.title || '').trim()
      if (!title) return
      const next = [...pathTitles, title]
      const parentPath = pathTitles.join(' > ')
      const path = next.join(' > ')
      const count = typeof window.countErrorsForKnowledgeNode === 'function'
        ? Number(window.countErrorsForKnowledgeNode(node.id, true) || 0)
        : 0
      rows.push({ path, parentPath, title, depth: next.length - 1, count })
      ;(node.children || []).forEach((child) => walk(child, next))
    }
    roots.forEach((root) => walk(root, []))
    return {
      rootTitles: roots.map((r) => String(r.title || '').trim()),
      rows,
      diagnostics: {
        rootCount: roots.length,
        errorEntries: Array.isArray(window.errors) ? window.errors.length : -1,
        hasCounterFn: typeof window.countErrorsForKnowledgeNode === 'function',
      },
    }
  })
}

async function collectOldTreeFromDom(page) {
  return page.evaluate(() => {
    const rows = []
    const stack = []
    const rowEls = Array.from(document.querySelectorAll('.knowledge-tree-node'))
      .filter((el) => {
        const s = window.getComputedStyle(el)
        return s.display !== 'none' && s.visibility !== 'hidden'
      })

    const detectDepth = (el) => {
      const cls = el.className || ''
      if (cls.includes('nav-type-header')) return 0
      if (cls.includes('nav-subtype')) return 1
      const style = (el.getAttribute('style') || '').match(/padding-left:\s*(\d+(?:\.\d+)?)px/i)
      if (!style) return 2
      const px = Number(style[1])
      if (!Number.isFinite(px) || px <= 60) return 2
      return 2 + Math.max(0, Math.round((px - 60) / 18))
    }

    for (const el of rowEls) {
      const title = (el.querySelector('.knowledge-tree-title')?.textContent || '').trim()
      if (!title) continue
      const depth = detectDepth(el)
      while (stack.length > depth) stack.pop()
      stack[depth] = title
      const pathTitles = stack.slice(0, depth + 1)
      const parentPath = pathTitles.slice(0, -1).join(' > ')
      const countText = (el.querySelector('.knowledge-tree-count')?.textContent || '').trim()
      const count = Number.parseInt(countText || '0', 10) || 0
      rows.push({
        path: pathTitles.join(' > '),
        parentPath,
        title,
        depth,
        count,
      })
    }
    return {
      rows,
      rootTitles: rows.filter((r) => r.depth === 0).map((r) => r.title),
    }
  })
}

async function collectNewTreeFromDom(page) {
  return page.evaluate(() => {
    const toDepth = (row) => {
      const style = (row.getAttribute('style') || '').match(/padding-left:\s*(\d+(?:\.\d+)?)px/i)
      const pad = style ? Number(style[1]) : 8
      const d = Math.round((pad - 8) / 14)
      return Number.isFinite(d) && d >= 0 ? d : 0
    }

    const rows = []
    const stack = []
    const rowEls = Array.from(document.querySelectorAll('.ktn-row'))
      .filter((el) => {
        const s = window.getComputedStyle(el)
        return s.display !== 'none' && s.visibility !== 'hidden'
      })

    for (const row of rowEls) {
      const title = (row.querySelector('.ktn-title')?.textContent || '').trim()
      if (!title) continue
      const depth = toDepth(row)
      while (stack.length > depth) stack.pop()
      stack[depth] = title
      const pathTitles = stack.slice(0, depth + 1)
      const path = pathTitles.join(' > ')
      const parentPath = pathTitles.slice(0, -1).join(' > ')
      const countText = (row.querySelector('.ktn-badge')?.textContent || '').trim()
      const count = Number.parseInt(countText || '0', 10) || 0
      rows.push({ path, parentPath, title, depth, count })
    }

    return {
      rows,
      rootTitles: rows.filter((r) => r.depth === 0).map((r) => r.title),
    }
  })
}

function compareTrees(oldTree, newTree) {
  const oldMap = new Map(oldTree.rows.map((r) => [r.path, r]))
  const newMap = new Map(newTree.rows.map((r) => [r.path, r]))

  const missingInNew = []
  const extraInNew = []
  const countMismatch = []

  for (const [path, oldRow] of oldMap.entries()) {
    const newRow = newMap.get(path)
    if (!newRow) {
      missingInNew.push(path)
      continue
    }
    if (Number(oldRow.count) !== Number(newRow.count)) {
      countMismatch.push({ path, old: oldRow.count, new: newRow.count })
    }
  }
  for (const path of newMap.keys()) {
    if (!oldMap.has(path)) extraInNew.push(path)
  }

  const dupByParentTitle = new Map()
  for (const row of newTree.rows) {
    if (row.depth !== 1) continue
    const key = `${row.parentPath}||${row.title}`
    dupByParentTitle.set(key, (dupByParentTitle.get(key) || 0) + 1)
  }
  const depth1Duplicates = [...dupByParentTitle.entries()]
    .filter(([, n]) => n > 1)
    .map(([k, n]) => ({ key: k, count: n }))

  return {
    totalOldNodes: oldTree.rows.length,
    totalNewNodes: newTree.rows.length,
    missingInNew: missingInNew.slice(0, 80),
    extraInNew: extraInNew.slice(0, 80),
    countMismatch: countMismatch.slice(0, 80),
    depth1Duplicates: depth1Duplicates.slice(0, 80),
  }
}

test('phase9 self-check old vs new', async ({ page }) => {
  test.setTimeout(240000)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  await page.goto(`${BASE}/`, GOTO)
  const loginAttempted = await maybeLogin(page)
  await page.goto(`${BASE}/`, GOTO)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(OUT_DIR, 'old-home.png'), fullPage: true })
  const oldState = await collectState(page, 'old')

  await page.goto(`${BASE}/new/xingce/workspace`, GOTO)
  await waitNewWorkspaceShell(page)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(OUT_DIR, 'new-before-focus.png'), fullPage: true })
  const newBefore = await collectState(page, 'new')
  await expandAllNewTree(page)
  const newTreeExpanded = await collectNewTreeFromDom(page)
  const depth1Titles = newTreeExpanded.rows.filter((r) => r.depth === 1).map((r) => r.title)
  const depth1Dirty = depth1Titles.filter((t) => /^(undefined|null|nan|\[object object\]|\?+|知识点\?)$/i.test(t))
  const depth1 = {
    depth1Count: depth1Titles.length,
    depth1DirtyCount: depth1Dirty.length,
    depth1Sample: depth1Titles.slice(0, 60),
  }
  await page.screenshot({ path: path.join(OUT_DIR, 'new-expanded.png'), fullPage: true })

  await page.goto(`${BASE}/`, GOTO)
  await page.waitForTimeout(800)
  await prepareOldAppWorkspaceForKnowledgeTree(page)
  const oldBaselineBeforeExpand = await readOldKnowledgeBaselineMeta(page)
  await fullyExpandLegacyKnowledgeTree(page)
  const oldBaselineAfterExpand = await readOldKnowledgeBaselineMeta(page)
  await page.screenshot({ path: path.join(OUT_DIR, 'old-workspace-tree-expanded.png'), fullPage: true })
  const oldTreeRuntime = await collectOldTreeByRuntime(page)
  const oldTreeDom = await collectOldTreeFromDom(page)
  const treeDiff = compareTrees(oldTreeDom, newTreeExpanded)

  await page.goto(`${BASE}/new/xingce/workspace`, GOTO)
  await waitNewWorkspaceShell(page)
  await page.waitForTimeout(800)
  const focusBtn = page.locator('.kt-focus-btn').first()
  let toggled = false
  if ((await focusBtn.count()) > 0) {
    toggled = true
    await focusBtn.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(OUT_DIR, 'new-after-focus.png'), fullPage: true })
  }
  const newAfter = await collectState(page, 'new')
  const practiceVisibleAfter = (await page.locator('.xc-sidebar .quiz-panel, .xc-sidebar .practice-panel').count()) > 0
  const advancedVisibleAfter = (await page.locator('.fs-advanced-toggle').count()) > 0

  const summary = {
    timestamp: new Date().toISOString(),
    loginAttempted,
    old: oldState,
    newBefore,
    depth1,
    oldKnowledgeBaseline: {
      beforeExpand: oldBaselineBeforeExpand,
      afterExpand: oldBaselineAfterExpand,
    },
    oldTreeRuntimeDiagnostics: oldTreeRuntime.diagnostics,
    oldRuntimeNodeCount: oldTreeRuntime.rows.length,
    oldDomNodeCount: oldTreeDom.rows.length,
    treeDiff,
    newAfter,
    focus: {
      toggled,
      beforeVisibleCount: newBefore.visibleCount,
      afterVisibleCount: newAfter.visibleCount,
      practiceVisibleAfter,
      advancedVisibleAfter,
    },
  }
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')

  expect(toggled).toBeTruthy()
  expect(advancedVisibleAfter).toBeFalsy()
  expect(practiceVisibleAfter).toBeFalsy()
  expect(newBefore.visibleCount).toBeLessThanOrEqual(12)
  expect(depth1.depth1DirtyCount).toBe(0)
})
