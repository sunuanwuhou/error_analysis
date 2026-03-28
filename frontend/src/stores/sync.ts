import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { saveBackup, updateOriginStatus } from '@/services/api'
import { runIncrementalSync } from '@/services/sync'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import type { SyncOp } from '@/types/workspace'

function createPendingKey(userId: string | undefined) {
  return `newapp:pendingOps:${userId || 'guest'}`
}

export const useSyncStore = defineStore('sync', () => {
  const status = ref<'idle' | 'saving' | 'synced' | 'error'>('idle')
  const message = ref('等待同步。')
  const updatedAt = ref('')
  const pendingOps = ref<SyncOp[]>([])
  const busy = ref(false)
  let autoSyncTimer: number | null = null
  let backgroundTimer: number | null = null
  let listenersAttached = false

  const pendingCount = computed(() => pendingOps.value.length)

  function persistPendingOps() {
    const auth = useAuthStore()
    localStorage.setItem(createPendingKey(auth.user?.id), JSON.stringify(pendingOps.value))
  }

  async function pushOriginStatus(payload: {
    localChangedAt?: string
    lastLoadedAt?: string
    lastSavedAt?: string
    lastBackupUpdatedAt?: string
  }) {
    try {
      await updateOriginStatus(payload)
    } catch {
      // keep sync flow non-blocking
    }
  }

  function scheduleAutoSync(delay = 1500) {
    if (typeof window === 'undefined') return
    if (autoSyncTimer) window.clearTimeout(autoSyncTimer)
    autoSyncTimer = window.setTimeout(() => {
      autoSyncTimer = null
      if (!busy.value) {
        void syncNow().catch(() => {
          // state is surfaced through store fields
        })
      }
    }, delay)
  }

  function startBackgroundSync() {
    if (typeof window === 'undefined') return
    if (!backgroundTimer) {
      backgroundTimer = window.setInterval(() => {
        if (!busy.value && document.visibilityState === 'visible') {
          void syncNow().catch(() => {
            // state is surfaced through store fields
          })
        }
      }, 60000)
    }
    if (!listenersAttached) {
      const wakeSync = () => {
        if (document.visibilityState === 'visible') scheduleAutoSync(300)
      }
      document.addEventListener('visibilitychange', wakeSync)
      window.addEventListener('online', wakeSync)
      listenersAttached = true
    }
    scheduleAutoSync(300)
  }

  function restorePendingOps() {
    const auth = useAuthStore()
    const raw = localStorage.getItem(createPendingKey(auth.user?.id)) || '[]'
    try {
      const parsed = JSON.parse(raw)
      pendingOps.value = Array.isArray(parsed) ? parsed : []
    } catch {
      pendingOps.value = []
    }
    if (pendingOps.value.length) scheduleAutoSync(400)
  }

  function enqueueOp(opType: string, entityId: string, payload: unknown) {
    const changedAt = new Date().toISOString()
    pendingOps.value.push({
      id: crypto.randomUUID(),
      op_type: opType,
      entity_id: entityId,
      payload,
      created_at: changedAt,
    })
    persistPendingOps()
    void pushOriginStatus({ localChangedAt: changedAt })
    scheduleAutoSync()
  }

  function enqueueOps(ops: Array<{ opType: string; entityId: string; payload: unknown }>) {
    if (!ops.length) return
    const changedAt = new Date().toISOString()
    pendingOps.value.push(
      ...ops.map((item) => ({
        id: crypto.randomUUID(),
        op_type: item.opType,
        entity_id: item.entityId,
        payload: item.payload,
        created_at: changedAt,
      })),
    )
    persistPendingOps()
    void pushOriginStatus({ localChangedAt: changedAt })
    scheduleAutoSync()
  }

  async function syncNow() {
    if (busy.value) return
    busy.value = true
    status.value = 'saving'
    message.value = '正在执行增量同步...'
    try {
      const workspace = useWorkspaceStore()
      const auth = useAuthStore()
      const pushing = pendingOps.value.slice()
      const pushedIds = new Set(pushing.map((item) => item.id))
      const result = await runIncrementalSync(pushing, auth.user?.id)
      pendingOps.value = pendingOps.value.filter((item) => !pushedIds.has(item.id))
      workspace.applySyncOps(result.pulled)
      updatedAt.value = result.serverTime || ''
      status.value = 'synced'
      message.value = result.pulled.length ? `已拉取 ${result.pulled.length} 条更新。` : '已同步到最新。'
      persistPendingOps()
    } catch (error) {
      status.value = 'error'
      message.value = error instanceof Error ? error.message : '增量同步失败。'
      persistPendingOps()
      throw error
    } finally {
      busy.value = false
    }
  }

  async function saveFullBackup() {
    if (busy.value) return
    busy.value = true
    status.value = 'saving'
    message.value = '正在保存完整备份...'
    try {
      const workspace = useWorkspaceStore()
      const result = await saveBackup({
        ...workspace.buildBackupPayload(),
        baseUpdatedAt: workspace.backupUpdatedAt,
        forceOverwrite: false,
      })
      updatedAt.value = result.updatedAt || ''
      workspace.backupUpdatedAt = result.updatedAt || ''
      status.value = 'synced'
      message.value = '完整备份已保存。'
      void pushOriginStatus({
        localChangedAt: result.updatedAt || '',
        lastSavedAt: result.updatedAt || '',
        lastBackupUpdatedAt: result.updatedAt || '',
      })
    } catch (error) {
      status.value = 'error'
      message.value = error instanceof Error ? error.message : '完整备份失败。'
      throw error
    } finally {
      busy.value = false
    }
  }

  return {
    status,
    message,
    updatedAt,
    pendingOps,
    pendingCount,
    busy,
    restorePendingOps,
    scheduleAutoSync,
    startBackgroundSync,
    pushOriginStatus,
    enqueueOp,
    enqueueOps,
    syncNow,
    saveFullBackup,
  }
})
