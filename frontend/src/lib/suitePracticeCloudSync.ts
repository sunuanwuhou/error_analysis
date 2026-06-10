/**
 * 套卷 / 模块练做题记录：定时 upsert 到服务端（不依赖交卷、不依赖 sessionStorage 草稿）。
 */
import type { SuitePracticeRecordPostBody } from '@/api/suiteBank'
import { suiteBankApi } from '@/api/suiteBank'

export type SuitePracticeSubtype = 'paper_exam' | 'bank_module_drill'

const CLOUD_SESS_KEY_PREFIX = 'xingce_suite_cloud_sess_v1:'
const SYNC_INTERVAL_MS = 45_000
const SYNC_DEBOUNCE_MS = 4_000

export type SuitePracticeSnapshotBuilder = () => SuitePracticeRecordPostBody | null

let activeBuilder: SuitePracticeSnapshotBuilder | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let flushing = false

export function cloudSessionStorageKey(paperId: string): string {
  return CLOUD_SESS_KEY_PREFIX + paperId
}

/** 本场做题云端会话 id（localStorage，换 tab同源可复用；以服务端 upsert 为准） */
export function getOrCreateCloudSessionId(paperId: string, forceNew = false): string {
  const key = cloudSessionStorageKey(paperId)
  if (!forceNew) {
    try {
      const existing = localStorage.getItem(key)
      if (existing && existing.trim()) return existing.trim()
    } catch {
      /* ignore */
    }
  }
  const sid = `scs_${paperId.slice(0, 12)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
  try {
    localStorage.setItem(key, sid)
  } catch {
    /* ignore */
  }
  return sid
}

export function clearCloudSessionId(paperId: string): void {
  try {
    localStorage.removeItem(cloudSessionStorageKey(paperId))
  } catch {
    /* ignore */
  }
}

export function registerSuitePracticeCloudSync(builder: SuitePracticeSnapshotBuilder): void {
  activeBuilder = builder
  startSuitePracticeSyncLoop()
  scheduleSuitePracticeCloudSync(true)
}

export function unregisterSuitePracticeCloudSync(): void {
  activeBuilder = null
  stopSuitePracticeSyncLoop()
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

function startSuitePracticeSyncLoop(): void {
  stopSuitePracticeSyncLoop()
  intervalTimer = setInterval(() => {
    void flushSuitePracticeCloudSync()
  }, SYNC_INTERVAL_MS)
}

function stopSuitePracticeSyncLoop(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}

/** 答题变动后防抖上传 */
export function scheduleSuitePracticeCloudSync(immediate = false): void {
  if (!activeBuilder) return
  if (debounceTimer) clearTimeout(debounceTimer)
  if (immediate) {
    void flushSuitePracticeCloudSync()
    return
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flushSuitePracticeCloudSync()
  }, SYNC_DEBOUNCE_MS)
}

export async function flushSuitePracticeCloudSync(): Promise<string | null> {
  if (!activeBuilder || flushing) return null
  const body = activeBuilder()
  if (!body || !String(body.client_session_id || '').trim()) return null
  flushing = true
  try {
    const res = await suiteBankApi.syncPracticeRecord(body)
    return res.id
  } catch {
    return null
  } finally {
    flushing = false
  }
}

export function isBankModuleDrillRecord(rec: {
  practice_subtype?: string
  paper_id?: string
  payload?: Record<string, unknown>
}): boolean {
  const st = String(rec.practice_subtype || rec.payload?.practice_subtype || '').trim()
  if (st === 'bank_module_drill') return true
  return String(rec.paper_id || '') === '__bank_drill__'
}

export function practiceRecordStatusLabel(status: string | undefined): string {
  return status === 'in_progress' ? '进行中' : '已交卷'
}
