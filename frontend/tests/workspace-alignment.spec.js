import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'

const BASE = process.env.XINGCE_BASE_URL || 'http://127.0.0.1:8088'
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'workspace-alignment')
const GOTO = { waitUntil: 'domcontentloaded' }

async function maybeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: 'wesly', password: 'admin123456' },
  })
  return res.ok()
}

async function waitNewWorkspaceShell(page) {
  await page.waitForSelector('.xc-workspace', { timeout: 60000 })
  await page.waitForFunction(
    () => !document.querySelector('.xc-loading'),
    { timeout: 120000 },
  )
}

async function enterLegacyXingceFromPortal(page) {
  const portalBtn = page.getByRole('button', { name: '旧版行测' })
  if (await portalBtn.count()) {
    await portalBtn.click()
    await page.waitForTimeout(800)
  }
}

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
}

test('workspace alignment screenshots old vs new', async ({ page }) => {
  test.setTimeout(180000)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const summary = { timestamp: new Date().toISOString(), loginAttempted: false, steps: [] }

  await page.goto(`${BASE}/`, GOTO)
  summary.loginAttempted = await maybeLogin(page)
  await page.goto(`${BASE}/`, GOTO)
  await page.waitForTimeout(1000)
  await enterLegacyXingceFromPortal(page)

  await prepareOldAppWorkspaceForKnowledgeTree(page)
  await page.waitForTimeout(800)
  const oldPath = path.join(OUT_DIR, 'old-workspace.png')
  await page.screenshot({ path: oldPath, fullPage: true })
  summary.steps.push({ name: 'old-workspace', file: oldPath })

  const oldSidebarPath = path.join(OUT_DIR, 'old-sidebar.png')
  await page.locator('.sidebar').screenshot({ path: oldSidebarPath })
  summary.steps.push({ name: 'old-sidebar', file: oldSidebarPath })

  await page.goto(`${BASE}/new/xingce/workspace`, GOTO)
  await waitNewWorkspaceShell(page)
  await page.waitForTimeout(800)

  const notesPath = path.join(OUT_DIR, 'new-workspace-tab-notes.png')
  await page.screenshot({ path: notesPath, fullPage: true })
  summary.steps.push({ name: 'new-tab-notes-default', file: notesPath })

  const newSidebarPath = path.join(OUT_DIR, 'new-sidebar.png')
  await page.locator('.sidebar').screenshot({ path: newSidebarPath })
  summary.steps.push({ name: 'new-sidebar', file: newSidebarPath })

  await page.getByTestId('workspace-tab-errors').click()
  await page.waitForTimeout(500)
  const errorsPath = path.join(OUT_DIR, 'new-workspace-tab-errors.png')
  await page.screenshot({ path: errorsPath, fullPage: true })
  summary.steps.push({ name: 'new-tab-errors', file: errorsPath })

  await page.getByTestId('workspace-tab-notes').click()
  await page.waitForTimeout(300)
  const notesAgain = path.join(OUT_DIR, 'new-workspace-tab-notes-after-toggle.png')
  await page.screenshot({ path: notesAgain, fullPage: true })
  summary.steps.push({ name: 'new-tab-notes-again', file: notesAgain })

  const reportPath = path.join(OUT_DIR, 'summary.json')
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf8')

  await expect(page.locator('.wsb-title')).toHaveText('Ashore')
  await expect(page.locator('.runtime-badge')).toContainText('Docker /')
  await expect(page.getByTestId('workspace-tab-notes')).toBeVisible()
  await expect(page.getByTestId('workspace-tab-errors')).toBeVisible()
})
