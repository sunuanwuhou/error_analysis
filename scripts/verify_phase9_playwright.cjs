const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const BASE = 'http://127.0.0.1:8080'
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'phase9-check')

function textClean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim()
}

async function maybeLogin(page) {
  const hasPwd = (await page.locator('input[type="password"]').count()) > 0
  if (!hasPwd) return false

  const userInput = page.locator('input[type="text"], input[name="username"], input[placeholder*="用户名"]').first()
  const pwdInput = page.locator('input[type="password"]').first()
  if ((await userInput.count()) === 0 || (await pwdInput.count()) === 0) return false

  await userInput.fill('wesly')
  await pwdInput.fill('admin123456')

  const loginBtn = page.locator('button:has-text("登录"), button:has-text("Login"), button[type="submit"]').first()
  if ((await loginBtn.count()) > 0) {
    await loginBtn.click()
  } else {
    await pwdInput.press('Enter')
  }
  await page.wait_for_timeout(1200)
  await page.wait_for_load_state('networkidle')
  return true
}

async function collectTreeState(page, mode) {
  const isNew = mode === 'new'
  const nodeSel = isNew ? '.ktn-row' : '.knowledge-tree-node'
  const titleSel = isNew ? '.ktn-title' : '.knowledge-tree-title'

  const titles = await page.$$eval(titleSel, (els) => els.map((el) => (el.textContent || '').trim()).filter(Boolean))
  const dirtyTitles = titles.filter((t) => /^(undefined|null|nan|\[object object\])$/i.test(t))
  const rootTitles = isNew
    ? await page.$$eval('.kt .kt-body > .ktn-wrap > .ktn-row .ktn-title', (els) => els.map((el) => (el.textContent || '').trim()))
    : await page.$$eval('#navScroll .knowledge-tree-node.depth-0 .knowledge-tree-title, #navScroll .nav-type-header .knowledge-tree-title', (els) =>
        els.map((el) => (el.textContent || '').trim())
      ).catch(() => [])

  const visibleCount = await page.$$eval(nodeSel, (els) => els.filter((el) => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  }).length)

  return {
    visibleCount,
    dirtyCount: dirtyTitles.length,
    dirtyTitles: dirtyTitles.slice(0, 20),
    rootTitles: rootTitles.slice(0, 20),
    sampleTitles: titles.slice(0, 30),
  }
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1680, height: 1080 } })
  const page = await context.newPage()

  const result = {
    timestamp: new Date().toISOString(),
    loginAttempted: false,
    old: null,
    new: null,
    focus: null,
  }

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  result.loginAttempted = await maybeLogin(page)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(OUT_DIR, 'old-home.png'), fullPage: true })
  result.old = await collectTreeState(page, 'old')

  await page.goto(`${BASE}/new/xingce/workspace`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(OUT_DIR, 'new-workspace-before-focus.png'), fullPage: true })
  const newBefore = await collectTreeState(page, 'new')

  const practiceVisibleBefore = (await page.locator('.xc-sidebar .quiz-panel, .xc-sidebar .practice-panel, .xc-sidebar').count()) > 0
  const advancedVisibleBefore = (await page.locator('.fs-advanced-toggle').count()) > 0

  const focusBtn = page.locator('button:has-text("专注树"), button:has-text("退出专注")').first()
  if ((await focusBtn.count()) > 0) {
    await focusBtn.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(OUT_DIR, 'new-workspace-after-focus.png'), fullPage: true })
  }

  const newAfter = await collectTreeState(page, 'new')
  const practiceVisibleAfter = (await page.locator('.xc-sidebar .quiz-panel, .xc-sidebar .practice-panel').count()) > 0
  const advancedVisibleAfter = (await page.locator('.fs-advanced-toggle').count()) > 0

  result.new = newBefore
  result.focus = {
    toggled: (await focusBtn.count()) > 0,
    beforeVisibleCount: newBefore.visibleCount,
    afterVisibleCount: newAfter.visibleCount,
    practiceVisibleBefore,
    practiceVisibleAfter,
    advancedVisibleBefore,
    advancedVisibleAfter,
  }

  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(result, null, 2), 'utf8')
  console.log(JSON.stringify(result, null, 2))

  await context.close()
  await browser.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
