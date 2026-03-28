<script setup lang="ts">
import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useWorkspaceStore } from '@/stores/workspace'

type WorkspacePanel = 'claude' | 'ai' | 'stats' | 'settings' | 'transfer' | 'codex'

const authStore = useAuthStore()
const syncStore = useSyncStore()
const workspaceStore = useWorkspaceStore()

defineProps<{
  sidebar?: boolean
}>()

const emit = defineEmits<{
  'open-create': []
  'open-panel': [value: WorkspacePanel]
}>()

const statusText = computed(() => {
  if (syncStore.status === 'saving') return '同步中'
  if (syncStore.status === 'synced') return '已同步'
  if (syncStore.status === 'error') return '同步失败'
  return '待同步'
})

const latestOrigin = computed(() =>
  [...workspaceStore.originStatuses].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0],
)

const morePanels: Array<{ key: WorkspacePanel; label: string }> = [
  { key: 'claude', label: 'Claude题库' },
  { key: 'ai', label: 'AI工作台' },
  { key: 'stats', label: '统计' },
  { key: 'settings', label: '规则目录' },
  { key: 'transfer', label: '导入导出' },
  { key: 'codex', label: 'Codex' },
]

async function handleReload() {
  const backup = await workspaceStore.loadBackup()
  await syncStore.pushOriginStatus({
    lastLoadedAt: backup?.updatedAt || '',
    lastBackupUpdatedAt: backup?.updatedAt || '',
  })
}
</script>

<template>
  <section class="cloud-status" :class="{ 'cloud-status--sidebar': sidebar }">
    <div class="cloud-status__toolbar">
      <div class="cloud-status__meta">
        <span>账号: {{ authStore.user?.username || '未登录' }}</span>
        <span class="cloud-status__badge" :data-state="syncStore.status">{{ statusText }}</span>
        <span>待同步 {{ syncStore.pendingCount }}</span>
      </div>

      <div class="cloud-status__toolbar-actions">
        <button class="ghost-button ghost-button--accent" type="button" @click="emit('open-create')">快速录题</button>
        <details class="workspace-more-menu">
          <summary class="ghost-button">更多</summary>
          <div class="workspace-more-menu__panel">
            <button
              v-for="panel in morePanels"
              :key="panel.key"
              class="workspace-more-menu__item"
              type="button"
              @click="emit('open-panel', panel.key)"
            >
              {{ panel.label }}
            </button>
          </div>
        </details>
        <button class="ghost-button" :disabled="syncStore.busy" @click="syncStore.syncNow()">增量同步</button>
        <button class="ghost-button" :disabled="workspaceStore.loading" @click="handleReload()">加载云端</button>
        <a class="ghost-button ghost-button--link" href="/legacy">Legacy</a>
      </div>
    </div>

    <div class="cloud-status__details">
      <div class="cloud-status__info">
        <div class="cloud-status__hint">{{ syncStore.message }}</div>
        <div v-if="workspaceStore.currentOrigin" class="cloud-status__hint">当前入口: {{ workspaceStore.currentOrigin }}</div>
        <div v-if="workspaceStore.backupUpdatedAt" class="cloud-status__hint">
          云端备份时间: {{ workspaceStore.backupUpdatedAt }}
        </div>
        <div v-if="latestOrigin?.origin" class="cloud-status__hint">
          最近活跃来源: {{ latestOrigin.origin }} /
          {{ latestOrigin.updatedAt || latestOrigin.lastSavedAt || latestOrigin.lastLocalChangeAt }}
        </div>
      </div>

    </div>
  </section>
</template>
