<template>
  <main v-if="mode === 'login'" class="login-shell">
    <section class="panel login-hero">
      <div class="eyebrow">NEXT 登录</div>
      <h1>登录 /next 工作台</h1>
      <p>全部页面已迁移到 Vue 路由壳。</p>
    </section>

    <section class="panel login-card">
      <h2>登录</h2>
      <p v-if="pageError" class="form-error">{{ pageError }}</p>
      <form class="login-form" @submit.prevent="submitLogin">
        <label>
          <span>用户名</span>
          <input v-model.trim="loginForm.username" type="text" autocomplete="username" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="loginForm.password" type="password" autocomplete="current-password" />
        </label>
        <button type="submit">{{ busy ? '登录中...' : '登录' }}</button>
      </form>
    </section>
  </main>

  <main v-else class="workspace-shell">
    <aside class="workspace-sidebar">
      <section class="panel sidebar-brand">
        <div class="eyebrow">{{ mode.toUpperCase() }}</div>
        <strong>{{ pageTitle }}</strong>
        <p>{{ pageDesc }}</p>
      </section>

      <section class="panel sidebar-card">
        <div class="sidebar-card-title">快捷导航</div>
        <div class="action-grid">
          <a class="link-button" href="/next/workspace">学习首页</a>
          <a class="link-button" href="/next/workspace/errors">错题工作台</a>
          <a class="link-button" href="/next/workspace/notes">学习笔记</a>
          <a class="link-button" href="/next/tools/backup">备份管理</a>
          <a class="link-button" href="/next/tools/search">全局搜索</a>
        </div>
      </section>
    </aside>

    <section class="workspace-main">
      <article class="panel workspace-topbar">
        <div>
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageDesc }}</p>
          <p v-if="pageError" class="form-error">{{ pageError }}</p>
        </div>
        <div class="topbar-actions">
          <a class="action-button action-button--secondary" href="/next/workspace">返回首页</a>
          <button type="button" class="action-button action-button--secondary" @click="refreshCurrent">刷新</button>
          <button type="button" class="action-button action-button--quiet" @click="handleLogout">退出</button>
        </div>
      </article>

      <section v-if="mode === 'backup'" class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>云端备份</h2>
          <div class="fact-list">
            <div>存在：{{ backupMeta?.exists ? '是' : '否' }}</div>
            <div>更新时间：{{ backupMeta?.updatedAt || '-' }}</div>
            <div>大小：{{ backupMeta?.payloadBytes || 0 }}</div>
          </div>
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="saveCloudSnapshot">云端保存</button>
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="loadCloudSnapshot">云端载入</button>
          </div>
          <p v-if="actionNotice" class="legacy-section-copy">{{ actionNotice }}</p>
        </article>

        <article class="panel content-card">
          <h2>本地备份</h2>
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="createLocalBackup">创建备份</button>
          </div>
          <ul class="result-list legacy-task-list">
            <li v-for="item in localBackups" :key="item.id">
              <strong>{{ item.label || item.id }}</strong>
              <span>{{ item.createdAt || '-' }} / {{ item.errorCount || 0 }} 题</span>
              <span class="legacy-inline-actions">
                <button type="button" @click="restoreLocalBackup(item.id)">恢复</button>
                <button type="button" @click="deleteLocalBackup(item.id)">删除</button>
              </span>
            </li>
            <li v-if="!localBackups.length">当前没有本地备份。</li>
          </ul>
        </article>
      </section>

      <section v-else-if="mode === 'search'" class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>全局搜索</h2>
          <form class="search-form" @submit.prevent="runSearch">
            <input v-model.trim="searchQuery" type="text" placeholder="搜索笔记、题目或原因" />
            <button type="submit">{{ busy ? '搜索中...' : '搜索' }}</button>
          </form>
          <div class="workspace-split">
            <div class="panel detail-panel">
              <div class="sidebar-card-title">节点结果</div>
              <ul class="result-list legacy-task-list">
                <li v-for="node in searchResults.nodes" :key="node.id">
                  <strong>{{ node.title }}</strong>
                  <span>{{ (node.path || []).join(' / ') }}</span>
                </li>
                <li v-if="!searchResults.nodes.length">暂无节点结果。</li>
              </ul>
            </div>
            <div class="panel detail-panel">
              <div class="sidebar-card-title">错题结果</div>
              <ul class="result-list legacy-task-list">
                <li v-for="item in searchResults.errors" :key="item.id || item.question">
                  <strong>{{ item.question || item.type || '结果' }}</strong>
                  <span>{{ item.rootReason || '-' }}</span>
                </li>
                <li v-if="!searchResults.errors.length">暂无错题结果。</li>
              </ul>
            </div>
          </div>
        </article>
      </section>

      <section v-else-if="mode === 'notes'" class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>系统备注</h2>
          <textarea v-model="remarkDraft" rows="12" placeholder="在这里编辑系统备注" />
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="saveRemark">保存备注</button>
          </div>
        </article>

        <article class="panel content-card">
          <h2>学习日志</h2>
          <input v-model="journalDate" type="date" />
          <textarea v-model="journalDraft" rows="10" placeholder="在这里记录今天学习" />
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="saveJournal">保存日志</button>
          </div>
        </article>
      </section>

      <section v-else-if="mode === 'export'" class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>导出</h2>
          <p class="legacy-section-copy">导出当前快照或错题列表（JSON）。</p>
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="exportSnapshot">导出完整快照</button>
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="exportErrors">导出错题列表</button>
          </div>
        </article>
      </section>

      <section v-else class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>路由页面</h2>
          <p>该页面已迁移到 Vue。你可以从左侧导航进入具体工作流。</p>
          <div class="legacy-tool-grid">
            <a class="legacy-tool-action" href="/next/actions/daily"><strong>今日复习</strong><span>进入 daily 任务</span></a>
            <a class="legacy-tool-action" href="/next/actions/direct"><strong>直接开做</strong><span>进入 direct 任务</span></a>
            <a class="legacy-tool-action" href="/next/actions/speed"><strong>限时复训</strong><span>进入 speed 任务</span></a>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { apiRequest } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { PublicEntry, RuntimeInfo } from '@/types/auth'
import type {
  BackupMetaResponse,
  BackupPayloadResponse,
  KnowledgeSearchResponse,
  LocalBackupItem,
  LocalBackupsResponse,
  WorkspaceSnapshot,
} from '@/types/workspace'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const busy = ref(false)
const pageError = ref('')
const actionNotice = ref('')

const runtimeInfo = ref<RuntimeInfo | null>(null)
const publicEntry = ref<PublicEntry | null>(null)
const backupMeta = ref<BackupMetaResponse | null>(null)
const backupPayload = ref<BackupPayloadResponse | null>(null)
const localBackups = ref<LocalBackupItem[]>([])

const searchQuery = ref('')
const searchResults = ref<KnowledgeSearchResponse>({ ok: true, nodes: [], errors: [] })

const remarkDraft = ref('')
const journalDate = ref(new Date().toISOString().slice(0, 10))
const journalDraft = ref('')

const mode = computed(() => String((route.meta.nativeMode as string) || 'action'))
const pageTitle = computed(() => String(route.meta.title || '工具页'))
const pageDesc = computed(() => String(route.meta.description || '原生 /next 路由页'))

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

function currentSnapshot(): WorkspaceSnapshot {
  return (backupPayload.value?.backup ?? backupPayload.value?.payload ?? {}) as WorkspaceSnapshot
}

function syncDraftFromSnapshot() {
  const snapshot = currentSnapshot() as WorkspaceSnapshot & { dailyJournalEntries?: Record<string, string> }
  remarkDraft.value = String(snapshot.globalNote || '')
  const entries = snapshot.dailyJournalEntries || {}
  journalDraft.value = String(entries[journalDate.value] || '')
}

async function persistSnapshot(snapshot: WorkspaceSnapshot) {
  await apiRequest('/api/backup', {
    method: 'PUT',
    body: JSON.stringify({
      ...snapshot,
      xc_version: 2,
    }),
  })
}

async function loadSharedData() {
  const [runtime, entry, meta, payload, locals] = await Promise.all([
    apiRequest<RuntimeInfo>('/api/runtime-info'),
    apiRequest<PublicEntry>('/api/public-entry'),
    apiRequest<BackupMetaResponse>('/api/backup?meta=true'),
    apiRequest<BackupPayloadResponse>('/api/backup'),
    apiRequest<LocalBackupsResponse>('/api/local-backups'),
  ])
  runtimeInfo.value = runtime
  publicEntry.value = entry
  backupMeta.value = meta
  backupPayload.value = payload
  localBackups.value = locals.items || []
  syncDraftFromSnapshot()
}

async function submitLogin() {
  if (!loginForm.value.username || !loginForm.value.password) {
    pageError.value = '请输入用户名和密码'
    return
  }
  busy.value = true
  pageError.value = ''
  try {
    await authStore.login({ username: loginForm.value.username, password: loginForm.value.password })
    await router.push({ name: 'workspace' })
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '登录失败'
  } finally {
    busy.value = false
  }
}

const loginForm = ref({ username: '', password: '' })

async function handleLogout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}

async function refreshCurrent() {
  busy.value = true
  pageError.value = ''
  try {
    await loadByMode()
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '刷新失败'
  } finally {
    busy.value = false
  }
}

async function saveCloudSnapshot() {
  busy.value = true
  actionNotice.value = ''
  try {
    const payload = await apiRequest<{ backup?: Record<string, unknown> | null }>('/api/backup')
    await apiRequest('/api/backup/cloud', {
      method: 'PUT',
      body: JSON.stringify({ backup: payload.backup || {} }),
    })
    actionNotice.value = '云端保存成功。'
    await loadSharedData()
  } finally {
    busy.value = false
  }
}

async function loadCloudSnapshot() {
  busy.value = true
  actionNotice.value = ''
  try {
    const payload = await apiRequest<{ backup?: Record<string, unknown> | null; updatedAt?: string; exists?: boolean }>('/api/backup/cloud')
    if (!payload?.backup) {
      actionNotice.value = '云端暂无备份。'
      return
    }
    await apiRequest('/api/backup', {
      method: 'PUT',
      body: JSON.stringify({
        ...(payload.backup || {}),
        xc_version: 2,
        forceOverwrite: true,
        baseUpdatedAt: payload.updatedAt || '',
      }),
    })
    actionNotice.value = '云端载入成功。'
    await loadSharedData()
  } finally {
    busy.value = false
  }
}

async function createLocalBackup() {
  busy.value = true
  try {
    const payload = await apiRequest<{ ok: true; items: LocalBackupItem[] }>('/api/local-backups/create', {
      method: 'POST',
      body: JSON.stringify({ label: `local-${new Date().toISOString().slice(0, 19)}` }),
    })
    localBackups.value = payload.items || []
  } finally {
    busy.value = false
  }
}

async function restoreLocalBackup(id: string) {
  if (!id) return
  busy.value = true
  try {
    const payload = await apiRequest<{ ok: true; items: LocalBackupItem[] }>('/api/local-backups/restore', {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
    localBackups.value = payload.items || []
    await loadSharedData()
  } finally {
    busy.value = false
  }
}

async function deleteLocalBackup(id: string) {
  if (!id) return
  busy.value = true
  try {
    const payload = await apiRequest<{ ok: true; items: LocalBackupItem[] }>(`/api/local-backups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    localBackups.value = payload.items || []
  } finally {
    busy.value = false
  }
}

async function runSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = { ok: true, nodes: [], errors: [] }
    return
  }
  busy.value = true
  try {
    searchResults.value = await apiRequest<KnowledgeSearchResponse>(`/api/knowledge/search?q=${encodeURIComponent(searchQuery.value)}&limit=20`)
  } finally {
    busy.value = false
  }
}

async function saveRemark() {
  busy.value = true
  try {
    const snapshot = cloneSnapshot(currentSnapshot()) as WorkspaceSnapshot
    snapshot.globalNote = remarkDraft.value
    snapshot.xc_version = 2
    await persistSnapshot(snapshot)
    await loadSharedData()
    actionNotice.value = '备注已保存。'
  } finally {
    busy.value = false
  }
}

async function saveJournal() {
  busy.value = true
  try {
    const snapshot = cloneSnapshot(currentSnapshot()) as WorkspaceSnapshot & { dailyJournalEntries?: Record<string, string> }
    const entries = { ...(snapshot.dailyJournalEntries || {}) }
    entries[journalDate.value] = journalDraft.value
    snapshot.dailyJournalEntries = entries
    snapshot.xc_version = 2
    await persistSnapshot(snapshot)
    await loadSharedData()
    actionNotice.value = '日志已保存。'
  } finally {
    busy.value = false
  }
}

async function exportSnapshot() {
  const snapshot = currentSnapshot()
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `xingce_backup_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function exportErrors() {
  const snapshot = currentSnapshot() as WorkspaceSnapshot
  const errors = Array.isArray(snapshot.errors) ? snapshot.errors : []
  const blob = new Blob([JSON.stringify(errors, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `xingce_errors_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function loadByMode() {
  if (mode.value === 'login') return
  await loadSharedData()
}

watch(
  () => journalDate.value,
  () => {
    const snapshot = currentSnapshot() as WorkspaceSnapshot & { dailyJournalEntries?: Record<string, string> }
    const entries = snapshot.dailyJournalEntries || {}
    journalDraft.value = String(entries[journalDate.value] || '')
  },
)

watch(
  () => route.fullPath,
  () => {
    void loadByMode()
  },
)

onMounted(() => {
  void loadByMode()
})
</script>
