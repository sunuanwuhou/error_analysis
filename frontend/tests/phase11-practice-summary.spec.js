import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8080'
const GOTO = { waitUntil: 'domcontentloaded' }

async function maybeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: 'wesly', password: 'admin123456' },
  })
  return res.ok()
}

async function waitNewWorkspaceShell(page) {
  await page.waitForSelector('.xc-workspace', { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('.xc-loading'), { timeout: 120000 })
}

test('phase11 practice attempts summary API shape', async ({ page }) => {
  test.setTimeout(120000)
  await maybeLogin(page)
  await page.goto(`${BASE}/new/xingce/workspace`, GOTO)
  await waitNewWorkspaceShell(page)

  const firstErrorId = await page.evaluate(async () => {
    const res = await fetch('/api/sync', { credentials: 'include' })
    const data = await res.json()
    for (const op of data.ops || []) {
      if (op.op_type !== 'error_upsert') continue
      let p = op.payload
      if (typeof p === 'string') {
        try {
          p = JSON.parse(p)
        } catch {
          continue
        }
      }
      const id = String(p?.id || '').trim()
      if (id) return id
    }
    return ''
  })

  expect(firstErrorId.length).toBeGreaterThan(0)

  const payload = await page.evaluate(async (errorId) => {
    const url = `/api/practice/attempts/summary?error_ids=${encodeURIComponent(errorId)}`
    const res = await fetch(url, { credentials: 'include' })
    return res.json()
  }, firstErrorId)

  expect(payload.ok).toBeTruthy()
  expect(payload.items).toBeTruthy()
  expect(typeof payload.items).toBe('object')
})
