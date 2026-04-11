import fs from 'node:fs/promises'
import path from 'node:path'

import { chromium, devices } from 'playwright'

const baseUrl = (process.env.PARITY_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const username = process.env.PARITY_USERNAME || 'wesly'
const password = process.env.PARITY_PASSWORD || 'admin123456'
const outputRoot = path.resolve(process.cwd(), '..', 'artifacts', 'screenshot-parity')

const desktopViewport = { width: 1440, height: 1100 }
const mobileDevice = devices['iPhone 13']

const routePairs = [
  {
    key: 'home-shell',
    legacy: '/',
    next: '/next/workspace',
    states: [{ key: 'loaded', waitFor: '.legacy-hero, .workspace-shell, .legacy-home-shell' }],
  },
  {
    key: 'error-workspace',
    legacy: '/?home_action=workspace_errors',
    next: '/next/workspace/errors',
    states: [{ key: 'loaded', waitFor: '.content-card--workspace-focus, .error-workspace-grid, .card-list' }],
  },
  {
    key: 'notes-workspace',
    legacy: '/?home_action=workspace_notes',
    next: '/next/workspace/notes',
    states: [{ key: 'loaded', waitFor: '.notes-workspace-grid, .legacy-tree-list, .detail-panel' }],
  },
  {
    key: 'task-errors',
    legacy: '/?home_action=taskview_errors',
    next: '/next/workspace/tasks/errors',
    states: [{ key: 'loaded', waitFor: '.task-lane-grid, .detail-panel, .legacy-task-list' }],
  },
  {
    key: 'task-notes',
    legacy: '/?home_action=taskview_notes',
    next: '/next/workspace/tasks/notes',
    states: [{ key: 'loaded', waitFor: '.task-lane-grid, .detail-panel, .legacy-task-list' }],
  },
  {
    key: 'quick-add',
    legacy: '/?home_action=quickadd',
    next: '/next/actions/quickadd',
    states: [{ key: 'loaded', waitFor: 'iframe, .entry-flow-card, .entry-grid' }],
  },
  {
    key: 'daily-practice',
    legacy: '/?home_action=daily',
    next: '/next/actions/daily',
    // .practice-modal-card 总是存在；networkidle 后确保 .legacy-quiz-card（有题时）已渲染
    states: [{ key: 'loaded', waitFor: '.practice-modal-card, iframe' }],
  },
  {
    key: 'full-practice',
    legacy: '/?home_action=full',
    next: '/next/actions/full',
    states: [{ key: 'loaded', waitFor: '.practice-modal-card, iframe' }],
  },
  {
    key: 'note-first',
    legacy: '/?home_action=note',
    next: '/next/actions/note',
    states: [{ key: 'loaded', waitFor: '.practice-modal-card, iframe' }],
  },
  {
    key: 'direct-work',
    legacy: '/?home_action=direct',
    next: '/next/actions/direct',
    states: [{ key: 'loaded', waitFor: '.practice-modal-card, iframe' }],
  },
  {
    key: 'speed-drill',
    legacy: '/?home_action=speed',
    next: '/next/actions/speed',
    states: [{ key: 'loaded', waitFor: '.practice-modal-card, iframe' }],
  },
  {
    key: 'backup-tools',
    legacy: '/?home_action=local_backup',
    next: '/next/tools/backup',
    states: [{ key: 'loaded', waitFor: '.legacy-task-list, .content-card, .detail-panel' }],
  },
  {
    key: 'global-search',
    legacy: '/?home_action=global_search',
    // ?q= 触发自动搜索，与旧版展示结果状态对齐
    next: '/next/tools/search?q=%E9%98%85%E8%AF%BB',
    states: [{ key: 'loaded', waitFor: '.detail-panel, .search-form' }],
  },
  {
    key: 'note-editor',
    legacy: '/assets/note_editor.html',
    next: '/next/tools/note-editor',
    states: [{ key: 'loaded', waitFor: 'iframe, body' }],
  },
  {
    key: 'note-viewer',
    legacy: '/assets/note_viewer.html',
    next: '/next/tools/note-viewer',
    states: [{ key: 'loaded', waitFor: 'iframe, body' }],
  },
  {
    key: 'process-image',
    legacy: '/assets/process_image_editor.html',
    next: '/next/tools/process-image',
    states: [{ key: 'loaded', waitFor: 'iframe, body' }],
  },
  {
    key: 'canvas',
    legacy: '/?home_action=canvas',
    next: '/next/tools/canvas',
    states: [{ key: 'loaded', waitFor: 'iframe, .content-card, body' }],
  },
]

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  const me = await page.request.get(`${baseUrl}/api/me`)
  const mePayload = await me.json().catch(() => ({}))
  if (me.ok() && mePayload?.authenticated) {
    return
  }
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await Promise.all([
    page.waitForURL(/\/($|next\/workspace|workspace|next\/)/, { timeout: 15000 }).catch(() => null),
    page.locator('#loginBtn').click(),
  ])
}

async function waitForState(page, selector) {
  if (!selector) {
    await page.waitForLoadState('networkidle').catch(() => null)
    return
  }
  const options = { timeout: 15000 }
  const selectors = selector.split(',').map((item) => item.trim()).filter(Boolean)
  for (const candidate of selectors) {
    try {
      await page.waitForSelector(candidate, options)
      // 找到元素后再等 networkidle，确保 API 数据（如练习题目）已加载完成
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => null)
      return
    } catch {
      continue
    }
  }
  await page.waitForLoadState('networkidle').catch(() => null)
}

async function captureTarget(context, url, filePath, waitFor) {
  const page = await context.newPage()
  try {
    console.log(`[capture] ${url} -> ${path.relative(path.resolve(process.cwd(), '..'), filePath)}`)
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' })
    await waitForState(page, waitFor)
    await page.screenshot({ path: filePath, fullPage: false })
  } finally {
    await page.close()
  }
}

async function runViewport(viewportKey, contextOptions) {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()
    await login(page)
    await page.close()

    for (const pair of routePairs) {
      for (const state of pair.states) {
        const stateDir = path.join(outputRoot, pair.key, viewportKey)
        await ensureDir(stateDir)
        await captureTarget(
          context,
          pair.legacy,
          path.join(stateDir, `${state.key}-legacy.png`),
          state.waitFor,
        )
        await captureTarget(
          context,
          pair.next,
          path.join(stateDir, `${state.key}-next.png`),
          state.waitFor,
        )
      }
    }
    await context.close()
  } finally {
    await browser.close()
  }
}

async function writeManifest() {
  const manifest = {
    baseUrl,
    username,
    capturedAt: new Date().toISOString(),
    routePairs: routePairs.map(({ key, legacy, next, states }) => ({ key, legacy, next, states })),
  }
  await ensureDir(outputRoot)
  await fs.writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2))
}

async function main() {
  await writeManifest()
  await runViewport('desktop', { viewport: desktopViewport, screen: desktopViewport })
  await runViewport('mobile', mobileDevice)
  console.log(`Captured parity screenshots to ${outputRoot}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
