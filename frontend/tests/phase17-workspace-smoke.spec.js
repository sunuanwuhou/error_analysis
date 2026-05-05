import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8080'
const GOTO = { waitUntil: 'domcontentloaded' }

async function maybeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: 'wesly', password: 'admin123456' },
  })
  return res.ok()
}

async function waitWorkspace(page) {
  await page.waitForSelector('.xc-workspace', { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('.xc-loading'), { timeout: 120000 })
}

test('phase17 workspace smoke', async ({ page }) => {
  test.setTimeout(180000)
  await maybeLogin(page)
  await page.goto(`${BASE}/new/xingce/workspace`, GOTO)
  await waitWorkspace(page)

  const me = await page.evaluate(async () => {
    const r = await fetch('/api/me', { credentials: 'include' })
    return r.json()
  })
  expect(me.authenticated).toBeTruthy()

  const counts = await page.evaluate(() => {
    const main = document.querySelector('.xc-main')
    return {
      filtered: main?.getAttribute('data-filtered-count'),
      total: main?.getAttribute('data-total-count'),
    }
  })
  expect(Number(counts.total)).toBeGreaterThan(0)

  await page.locator('.fs-advanced-toggle').click()
  await expect(page.locator('.fs-search')).toBeVisible()

  const wb = await page.evaluate(async () => {
    const r = await fetch('/api/practice/workbench?limit=12', { credentials: 'include' })
    return r.json()
  })
  expect(wb.ok).toBeTruthy()
})
