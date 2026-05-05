<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { xingceApi, type LocalBackupItem } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'

const emit = defineEmits<{ close: [] }>()
const store = useXingceStore()

const loading = ref(false)
const creating = ref(false)
const items = ref<LocalBackupItem[]>([])
const err = ref('')

async function loadItems() {
  loading.value = true
  err.value = ''
  try {
    const res = await xingceApi.listLocalBackups()
    items.value = res.items ?? []
  } catch (e) {
    err.value = String(e)
  } finally {
    loading.value = false
  }
}

async function createBackup() {
  creating.value = true
  try {
    await xingceApi.createLocalBackup({ kind: 'manual', label: '手动备份' })
    await loadItems()
  } finally {
    creating.value = false
  }
}

async function restoreBackup(item: LocalBackupItem) {
  if (!confirm(`恢复备份 ${item.label || item.id}？`)) return
  await xingceApi.restoreLocalBackup(item.id, true)
  await store.load()
  emit('close')
}

async function removeBackup(item: LocalBackupItem) {
  if (!confirm(`删除备份 ${item.label || item.id}？`)) return
  await xingceApi.deleteLocalBackup(item.id)
  await loadItems()
}

function downloadBackup(item: LocalBackupItem) {
  const a = document.createElement('a')
  a.href = `/api/local-backups/${encodeURIComponent(item.id)}/download`
  a.target = '_blank'
  a.rel = 'noopener'
  a.click()
}

function fmtTime(t?: string): string {
  if (!t) return '-'
  return t.replace('T', ' ').slice(0, 16)
}

onMounted(loadItems)
</script>

<template>
  <Teleport to="body">
    <div class="lb-backdrop" @click.self="emit('close')">
      <div class="lb-modal">
        <div class="lb-header">
          <span>备份数据列表</span>
          <div class="lb-header-actions">
            <button class="lb-create" :disabled="creating" @click="createBackup">
              {{ creating ? '创建中…' : '创建备份' }}
            </button>
            <button class="lb-close" @click="emit('close')">×</button>
          </div>
        </div>
        <div class="lb-body">
          <div v-if="loading" class="lb-empty">加载中…</div>
          <div v-else-if="err" class="lb-empty lb-err">{{ err }}</div>
          <div v-else-if="!items.length" class="lb-empty">暂无备份</div>
          <div v-else class="lb-list">
            <div v-for="it in items" :key="it.id" class="lb-item">
              <div class="lb-main">
                <div class="lb-title">{{ it.label || it.kind || '备份' }}</div>
                <div class="lb-meta">
                  <span>ID: {{ it.id }}</span>
                  <span>时间: {{ fmtTime(it.updatedAt || it.createdAt) }}</span>
                  <span>错题: {{ it.summary?.errorCount ?? '-' }}</span>
                </div>
              </div>
              <div class="lb-actions">
                <button class="lb-btn" @click="downloadBackup(it)">下载</button>
                <button class="lb-btn" @click="restoreBackup(it)">恢复</button>
                <button class="lb-btn danger" @click="removeBackup(it)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lb-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; z-index: 1100; }
.lb-modal { width: min(760px, 96vw); max-height: 86vh; background: #fff; border-radius: 10px; box-shadow: 0 18px 44px rgba(0,0,0,.2); display: flex; flex-direction: column; overflow: hidden; }
.lb-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #edf2f7; font-size: 14px; font-weight: 700; color: #1e293b; }
.lb-header-actions { display: flex; gap: 8px; align-items: center; }
.lb-create { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
.lb-close { border: none; width: 24px; height: 24px; border-radius: 999px; background: #f1f5f9; cursor: pointer; }
.lb-body { padding: 12px; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
.lb-empty { text-align: center; padding: 24px 0; color: #64748b; font-size: 13px; }
.lb-err { color: #dc2626; }
.lb-list { display: flex; flex-direction: column; gap: 8px; }
.lb-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; display: flex; justify-content: space-between; gap: 10px; align-items: center; }
.lb-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 4px; }
.lb-meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: #6b7280; }
.lb-actions { display: flex; gap: 6px; }
.lb-btn { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; font-size: 12px; padding: 4px 8px; cursor: pointer; }
.lb-btn.danger { color: #b91c1c; border-color: #fca5a5; background: #fff1f2; }
</style>
