<template>
  <main class="workspace-shell legacy-home-shell">
    <aside class="workspace-sidebar legacy-sidebar">
      <section class="panel legacy-logo">
        <div class="legacy-brand">Ashore</div>
        <div class="legacy-runtime">{{ runtimeInfo?.label || '运行中' }}</div>
      </section>

      <nav class="legacy-nav panel">
        <a class="legacy-nav-button" :class="{ 'is-active': mode === 'home' }" href="/next/workspace">学习首页</a>
        <a class="legacy-nav-button" :class="{ 'is-active': mode === 'errors' }" href="/next/workspace/errors">错题工作台</a>
        <a class="legacy-nav-button" :class="{ 'is-active': mode === 'notes' }" href="/next/workspace/notes">学习笔记</a>
        <a class="legacy-nav-button" :class="{ 'is-active': mode === 'task-errors' }" href="/next/workspace/tasks/errors">任务通道</a>
        <a class="legacy-nav-button" :class="{ 'is-active': mode === 'task-notes' }" href="/next/workspace/tasks/notes">申论工作台</a>
      </nav>

      <section class="panel legacy-quick-card">
        <div class="legacy-tool-row">
          <a class="legacy-primary-link" href="/next/actions/quickadd">+ 快速录题</a>
          <a class="legacy-secondary-link" href="/next/tools/remarks">备注</a>
          <a class="legacy-secondary-link" href="/next/tools/journal">日志</a>
          <a class="legacy-secondary-link" :href="exportHref">导出</a>
        </div>
      </section>

      <section class="panel legacy-cloud-card">
        <div class="legacy-cloud-title">
          <span>账号：{{ authStore.user?.username || '未登录' }}</span>
          <span class="legacy-cloud-badge">{{ backupMeta?.exists ? '已备份' : '未备份' }}</span>
        </div>
        <div class="legacy-cloud-meta">
          <div>来源：{{ backupMeta?.currentOrigin || publicEntry?.origin || '-' }}</div>
          <div>最近：{{ backupMeta?.updatedAt || '-' }}</div>
          <div>错题：{{ Number(summary.errors || 0) }}</div>
          <div>知识点：{{ Number(summary.knowledgeNodes || 0) }}</div>
        </div>
        <div class="legacy-cloud-actions">
          <button class="legacy-small-link" type="button" :disabled="busy" @click="cloudLoad">云端载入</button>
          <button class="legacy-small-link" type="button" :disabled="busy" @click="cloudSave">云端保存</button>
          <button class="legacy-small-link" type="button" :disabled="busy" @click="logout">退出</button>
        </div>
        <p v-if="notice" class="legacy-section-copy">{{ notice }}</p>
      </section>

      <section class="panel legacy-practice-card">
        <a class="legacy-practice-button is-red" href="/next/actions/daily">
          <span>今日复习</span>
          <strong>{{ daily.items.length }}</strong>
        </a>
        <a class="legacy-practice-button is-blue" href="/next/actions/full">
          <span>全量练习</span>
          <strong>{{ workbench.overview.totalErrors }}</strong>
        </a>
      </section>
    </aside>

    <section class="workspace-main">
      <article class="panel legacy-hero">
        <div class="legacy-hero-main">
          <div class="eyebrow">{{ heroEyebrow }}</div>
          <h1>{{ heroTitle }}</h1>
          <p>{{ heroDesc }}</p>
          <div class="legacy-hero-actions">
            <a class="action-button action-button--primary" href="/next/workspace/errors">进入错题工作台</a>
            <a class="action-button action-button--secondary" href="/next/actions/quickadd">快速录题</a>
            <a class="action-button action-button--secondary" href="/next/workspace/notes">学习笔记</a>
          </div>
        </div>
      </article>

      <section class="workspace-split legacy-summary-grid">
        <article class="panel content-card">
          <h2>今日队列</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="item in activeQueue.slice(0, 10)" :key="item.id || item.question">
              <strong>{{ buildQueueTitle(item) }}</strong>
              <span>{{ buildQueueReason(item) }}</span>
            </li>
            <li v-if="!activeQueue.length">当前没有待处理条目。</li>
          </ul>
        </article>

        <article class="panel content-card">
          <h2>最近错题</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="item in errors.slice(0, 10)" :key="item.id || item.question">
              <strong>{{ item.question || item.type || '错题' }}</strong>
              <span>{{ item.rootReason || item.errorReason || '-' }}</span>
              <a v-if="item.id" class="legacy-task-action-link" :href="`/next/tools/edit?id=${encodeURIComponent(String(item.id))}`">编辑</a>
            </li>
            <li v-if="!errors.length">当前没有错题。</li>
          </ul>
        </article>
      </section>

      <section class="workspace-split legacy-main-grid">
        <article class="panel content-card panel--muted">
          <h2>知识树</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="node in knowledgeRoots.slice(0, 12)" :key="node.id">
              <strong>{{ node.title }}</strong>
              <span>子节点 {{ node.children?.length || 0 }}</span>
              <a class="legacy-task-action-link" :href="`/next/tools/note-viewer?nodeId=${encodeURIComponent(node.id)}`">查看</a>
            </li>
            <li v-if="!knowledgeRoots.length">当前没有知识节点。</li>
          </ul>
        </article>

        <article class="panel content-card panel--muted">
          <h2>本地备份</h2>
          <div class="legacy-tool-row">
            <button type="button" class="legacy-small-link" :disabled="busy" @click="createLocalBackup">新建备份</button>
          </div>
          <ul class="result-list legacy-task-list">
            <li v-for="item in localBackups.slice(0, 8)" :key="item.id">
              <strong>{{ item.label || item.id }}</strong>
              <span>{{ item.createdAt || '-' }} / {{ item.errorCount || 0 }} 题</span>
              <span class="legacy-inline-actions">
                <button type="button" class="legacy-secondary-link legacy-inline-button" :disabled="busy" @click="restoreLocalBackup(item.id)">恢复</button>
                <button type="button" class="legacy-secondary-link legacy-inline-button" :disabled="busy" @click="deleteLocalBackup(item.id)">删除</button>
              </span>
            </li>
            <li v-if="!localBackups.length">当前还没有本地备份。</li>
          </ul>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { apiRequest } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { PublicEntry, RuntimeInfo } from '@/types/auth'
import type {
  BackupMetaResponse,
  ErrorSummary,
  KnowledgeTreeNode,
  LocalBackupItem,
  LocalBackupsResponse,
  NextHomeContextResponse,
  PracticeDailyResponse,
  PracticeQueueItem,
  PracticeWorkbenchResponse,
} from '@/types/workspace'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const runtimeInfo = ref<RuntimeInfo | null>(null)
const publicEntry = ref<PublicEntry | null>(null)
const backupMeta = ref<BackupMetaResponse | null>(null)
const localBackups = ref<LocalBackupItem[]>([])
const workbench = ref<PracticeWorkbenchResponse>({
  ok: true,
  overview: {
    totalErrors: 0,
    noteFirstCount: 0,
    directDoCount: 0,
    speedDrillCount: 0,
    reviewCount: 0,
    retrainCount: 0,
    stabilizingCount: 0,
    stableCount: 0,
    attemptTrackedCount: 0,
  },
  advice: [],
  workflowAdvice: [],
  reviewQueue: [],
  retrainQueue: [],
  noteFirstQueue: [],
  directDoQueue: [],
  speedDrillQueue: [],
  weaknessGroups: [],
})
const daily = ref<PracticeDailyResponse>({ ok: true, items: [], practicedTodayCount: 0, advice: [] })
const errors = ref<ErrorSummary[]>([])
const knowledgeRoots = ref<KnowledgeTreeNode[]>([])
const summary = ref<Record<string, number | string | null>>({})
const notice = ref('')
const busy = ref(false)

const mode = computed(() => {
  if (route.name === 'workspace-errors') return 'errors'
  if (route.name === 'workspace-notes') return 'notes'
  if (route.name === 'workspace-task-errors') return 'task-errors'
  if (route.name === 'workspace-task-notes') return 'task-notes'
  return 'home'
})

const heroEyebrow = computed(() => (mode.value === 'home' ? '学习首页' : '工作台'))
const heroTitle = computed(() => {
  if (mode.value === 'errors') return '错题工作台'
  if (mode.value === 'notes') return '学习笔记'
  if (mode.value === 'task-errors') return '任务通道（错题）'
  if (mode.value === 'task-notes') return '任务通道（笔记）'
  return '先安排今天要做什么，再执行'
})
const heroDesc = computed(() => '页面已完全由 Vue 渲染，旧版 HTML 桥接已移除。')

const activeQueue = computed(() => {
  if (mode.value === 'task-errors') return workbench.value.directDoQueue
  if (mode.value === 'task-notes') return workbench.value.noteFirstQueue
  if (mode.value === 'errors') return workbench.value.speedDrillQueue
  if (mode.value === 'notes') return workbench.value.noteFirstQueue
  return workbench.value.reviewQueue.length ? workbench.value.reviewQueue : daily.value.items
})

const exportHref = computed(() => '/next/tools/export')

function normalizeKnowledgeTree(raw: NextHomeContextResponse['knowledgeTree']): KnowledgeTreeNode[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object' && Array.isArray((raw as { roots?: KnowledgeTreeNode[] }).roots)) {
    return (raw as { roots?: KnowledgeTreeNode[] }).roots || []
  }
  return []
}

function buildQueueTitle(item: PracticeQueueItem): string {
  const typeName = String(item.type || '').trim()
  const question = String(item.question || '').trim()
  if (typeName && question) return `${typeName} ${question}`
  return typeName || question || '待处理题目'
}

function buildQueueReason(item: PracticeQueueItem): string {
  return item.taskReason || item.rootReason || item.errorReason || '按当前状态继续处理'
}

async function refreshAll() {
  const [runtime, entry, meta, backups, context] = await Promise.all([
    apiRequest<RuntimeInfo>('/api/runtime-info'),
    apiRequest<PublicEntry>('/api/public-entry'),
    apiRequest<BackupMetaResponse>('/api/backup?meta=true'),
    apiRequest<LocalBackupsResponse>('/api/local-backups'),
    apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=20'),
  ])
  runtimeInfo.value = runtime
  publicEntry.value = entry
  backupMeta.value = meta
  localBackups.value = backups.items || []
  workbench.value = context.workbench
  daily.value = context.daily
  errors.value = context.errors || []
  knowledgeRoots.value = normalizeKnowledgeTree(context.knowledgeTree)
  summary.value = context.summary || {}
}

async function cloudSave() {
  busy.value = true
  notice.value = ''
  try {
    const payload = await apiRequest<{ backup?: Record<string, unknown> | null }>('/api/backup')
    await apiRequest('/api/backup/cloud', {
      method: 'PUT',
      body: JSON.stringify({ backup: payload.backup || {} }),
    })
    notice.value = '云端保存完成。'
    await refreshAll()
  } finally {
    busy.value = false
  }
}

async function cloudLoad() {
  busy.value = true
  notice.value = ''
  try {
    const payload = await apiRequest<{ backup?: Record<string, unknown> | null; updatedAt?: string; exists?: boolean }>('/api/backup/cloud')
    if (!payload?.backup) {
      notice.value = '云端暂无可恢复备份。'
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
    notice.value = '云端载入完成。'
    await refreshAll()
  } finally {
    busy.value = false
  }
}

async function createLocalBackup() {
  busy.value = true
  try {
    const payload = await apiRequest<{ ok: true; items: LocalBackupItem[] }>('/api/local-backups/create', {
      method: 'POST',
      body: JSON.stringify({ label: `workspace-${new Date().toISOString().slice(0, 19)}` }),
    })
    localBackups.value = payload.items || []
    notice.value = '本地备份已创建。'
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
    notice.value = '本地备份已恢复。'
    await refreshAll()
  } finally {
    busy.value = false
  }
}

async function deleteLocalBackup(id: string) {
  if (!id) return
  busy.value = true
  try {
    await apiRequest<{ ok: true; items: LocalBackupItem[] }>(`/api/local-backups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    await refreshAll()
    notice.value = '本地备份已删除。'
  } finally {
    busy.value = false
  }
}

async function logout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}

onMounted(() => {
  void refreshAll()
})
</script>
