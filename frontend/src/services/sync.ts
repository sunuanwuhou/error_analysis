import { getSync, pushSync } from '@/services/api'
import type { SyncOp } from '@/types/workspace'

function cursorKey(key: string, userId?: string) {
  return `newapp:${key}:${userId || 'guest'}`
}

export interface SyncCursor {
  since: string
  cursorAt: string
  cursorId: string
}

export function readCursor(userId?: string): SyncCursor {
  return {
    since: localStorage.getItem(cursorKey('lastSyncTime', userId)) || '',
    cursorAt: localStorage.getItem(cursorKey('lastSyncCursorAt', userId)) || '',
    cursorId: localStorage.getItem(cursorKey('lastSyncCursorId', userId)) || '',
  }
}

export function clearCursor(userId?: string) {
  localStorage.removeItem(cursorKey('lastSyncTime', userId))
  localStorage.removeItem(cursorKey('lastSyncCursorAt', userId))
  localStorage.removeItem(cursorKey('lastSyncCursorId', userId))
}

function rememberCursor(serverTime: string, userId?: string) {
  if (serverTime) localStorage.setItem(cursorKey('lastSyncTime', userId), serverTime)
  localStorage.removeItem(cursorKey('lastSyncCursorAt', userId))
  localStorage.removeItem(cursorKey('lastSyncCursorId', userId))
}

export async function runIncrementalSync(pendingOps: SyncOp[], userId?: string) {
  if (pendingOps.length > 0) {
    await pushSync(pendingOps)
  }

  const cursor = readCursor(userId)
  const baseSince = cursor.since || ''
  let cursorAt = ''
  let cursorId = ''
  let pulled: SyncOp[] = []
  let serverTime = cursor.since || ''

  while (true) {
    const params = new URLSearchParams()
    params.set('since', baseSince)
    if (cursorAt) params.set('cursorAt', cursorAt)
    if (cursorId) params.set('cursorId', cursorId)

    const result = await getSync(params)
    pulled = pulled.concat(result.ops || [])
    serverTime = result.serverTime || serverTime

    if (!result.hasMore) break
    cursorAt = result.nextCursorAt || (result.ops?.length ? result.ops[result.ops.length - 1]?.created_at || '' : '')
    cursorId = result.nextCursorId || (result.ops?.length ? result.ops[result.ops.length - 1]?.id || '' : '')
    if (!cursorAt) break
    localStorage.setItem(cursorKey('lastSyncCursorAt', userId), cursorAt)
    localStorage.setItem(cursorKey('lastSyncCursorId', userId), cursorId)
  }

  rememberCursor(serverTime, userId)
  return {
    pulled,
    serverTime,
  }
}
