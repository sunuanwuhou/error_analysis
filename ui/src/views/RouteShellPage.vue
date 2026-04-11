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
        <div class="eyebrow">{{ modeLabel }}</div>
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
          <button type="button" class="action-button action-button--secondary" @click="goBack">返回上一页</button>
          <a class="action-button action-button--secondary" href="/next/workspace">返回首页</a>
          <button type="button" class="action-button action-button--secondary" @click="refreshCurrent">刷新</button>
          <button type="button" class="action-button action-button--quiet" @click="handleLogout">退出</button>
        </div>
      </article>

      <article v-if="mode !== 'action'" class="panel">
        <div class="sidebar-card-title">快捷动作</div>
        <div class="topbar-actions">
          <template v-if="mode === 'backup'">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="createLocalBackup">创建本地备份</button>
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="refreshLocalBackupList">刷新备份列表</button>
          </template>
          <template v-else-if="mode === 'search'">
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="clearSearch">清空搜索</button>
          </template>
          <template v-else-if="mode === 'notes'">
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="jumpJournalToday">日志切到今天</button>
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="insertJournalTemplate">插入日志模板</button>
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="saveRemark">保存备注</button>
          </template>
          <template v-else-if="mode === 'insights'">
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="loadPracticeInsights">刷新练习记录</button>
          </template>
          <template v-else-if="mode === 'codex'">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="createCodexThread">新建线程</button>
          </template>
          <template v-else-if="mode === 'ai'">
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="runAiDiagnose">刷新诊断</button>
          </template>
          <a class="action-button action-button--quiet" href="/next/workspace">回到首页</a>
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
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="refreshLocalBackupList">刷新列表</button>
          </div>
          <ul class="result-list legacy-task-list">
            <li v-for="item in localBackups" :key="item.id">
              <strong>{{ item.label || item.id }}</strong>
              <span>{{ item.createdAt || '-' }} / {{ item.errorCount || 0 }} 题</span>
              <span class="legacy-inline-actions">
                <button type="button" class="action-button action-button--quiet" @click="restoreLocalBackup(item.id)">恢复</button>
                <button type="button" class="action-button action-button--quiet" @click="deleteLocalBackup(item.id)">删除</button>
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
          <h2>推荐笔记队列</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="item in recommendedQueue.slice(0, 20)" :key="item.id || item.question">
              <strong>{{ item.question || item.type || '待处理题目' }}</strong>
              <span>{{ item.taskReason || item.rootReason || item.errorReason || '-' }}</span>
              <span class="legacy-inline-actions">
                <a class="link-button" :href="`/next/tools/note-viewer?nodeId=${encodeURIComponent(String(item.noteNodeId || ''))}`">看笔记</a>
                <a class="link-button" :href="`/next/tools/edit?id=${encodeURIComponent(String(item.id || ''))}`">开题目</a>
              </span>
            </li>
            <li v-if="!recommendedQueue.length">当前没有推荐笔记任务。</li>
          </ul>
        </article>

        <article class="panel content-card">
          <h2>系统备注</h2>
          <textarea v-model="remarkDraft" rows="12" placeholder="在这里编辑系统备注" />
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="insertDailyLogTemplateToRemark">插入日志模板</button>
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="saveRemark">保存备注</button>
          </div>
        </article>

        <article class="panel content-card">
          <h2>学习日志</h2>
          <input v-model="journalDate" type="date" />
          <textarea v-model="journalDraft" rows="10" placeholder="在这里记录今天学习" />
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="jumpJournalToday">今天</button>
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="insertJournalTemplate">插入模板</button>
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="saveJournal">保存日志</button>
          </div>
        </article>
      </section>

      <section v-else-if="mode === 'insights'" class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>学习建议</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="(item, index) in practiceAdvice" :key="`${item.key || item.title || index}`">
              <strong>{{ item.title || `建议 ${index + 1}` }}</strong>
              <span>{{ item.description || '-' }}</span>
            </li>
            <li v-if="!practiceAdvice.length">暂无建议数据。</li>
          </ul>
        </article>

        <article class="panel content-card">
          <h2>练习记录</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="item in practiceAttempts.slice(0, 60)" :key="item.id">
              <strong>{{ item.questionText || item.type || '练习记录' }}</strong>
              <span>{{ item.result || '-' }} / 置信度 {{ item.confidence ?? 0 }} / {{ item.createdAt || '-' }}</span>
            </li>
            <li v-if="!practiceAttempts.length">暂无练习记录。</li>
          </ul>
        </article>
      </section>

      <section v-else-if="mode === 'transfer'" class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>导入 JSON</h2>
          <textarea v-model="importRawText" rows="12" placeholder="粘贴完整快照 JSON 或错题数组 JSON" />
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="importSnapshotFromText">导入并覆盖</button>
          </div>
          <p v-if="importNotice" class="legacy-section-copy">{{ importNotice }}</p>
        </article>

        <article class="panel content-card">
          <h2>题型规则</h2>
          <textarea v-model="typeRulesDraft" rows="12" placeholder='[{"keywords":["词语"],"type":"言语","subtype":"逻辑填空"}]' />
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="saveTypeRules">保存题型规则</button>
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

      <section v-else-if="mode === 'codex'" class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>Codex 线程</h2>
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--primary" :disabled="busy" @click="createCodexThread">新建线程</button>
          </div>
          <ul class="result-list legacy-task-list">
            <li v-for="thread in codexThreads" :key="thread.id">
              <strong>{{ thread.title || '未命名线程' }}</strong>
              <span>{{ thread.latestMessageText || thread.updatedAt || '-' }}</span>
              <button type="button" class="action-button action-button--quiet" @click="openCodexThread(thread.id)">打开</button>
            </li>
            <li v-if="!codexThreads.length">暂无线程。</li>
          </ul>
        </article>
        <article class="panel content-card">
          <h2>会话</h2>
          <div v-if="activeCodexThreadId" class="legacy-section-copy">当前线程：{{ activeCodexThreadId }}</div>
          <ul class="result-list legacy-task-list">
            <li v-for="message in codexMessages" :key="message.id">
              <strong>{{ message.role === 'assistant' ? '助手' : '我' }}</strong>
              <span>{{ message.content }}</span>
            </li>
            <li v-if="!codexMessages.length">打开线程后可查看消息。</li>
          </ul>
          <form class="search-form" @submit.prevent="sendCodexMessage">
            <input v-model.trim="codexDraft" type="text" placeholder="输入消息后发送" />
            <button type="submit" :disabled="busy || !activeCodexThreadId || !codexDraft.trim()">{{ busy ? '发送中...' : '发送' }}</button>
          </form>
        </article>
      </section>

      <section v-else-if="mode === 'ai'" class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>AI 对话</h2>
          <form class="search-form" @submit.prevent="runAiChat">
            <input v-model.trim="aiDraft" type="text" placeholder="输入你的问题" />
            <button type="submit" :disabled="busy || !aiDraft.trim()">{{ busy ? '处理中...' : '发送' }}</button>
          </form>
          <p v-if="aiReply" class="legacy-section-copy">{{ aiReply }}</p>
        </article>
        <article class="panel content-card">
          <h2>AI 诊断</h2>
          <div class="topbar-actions">
            <button type="button" class="action-button action-button--secondary" :disabled="busy" @click="runAiDiagnose">刷新诊断</button>
          </div>
          <p v-if="aiDiagnosisSummary" class="legacy-section-copy">{{ aiDiagnosisSummary }}</p>
          <ul class="result-list legacy-task-list">
            <li v-for="(item, index) in aiWeakPoints" :key="index">
              <strong>{{ item.area || '弱点' }}（{{ item.priority || '-' }}）</strong>
              <span>{{ item.description || '-' }}</span>
              <span>{{ item.suggestion || '-' }}</span>
            </li>
            <li v-if="!aiWeakPoints.length">暂无诊断结果。</li>
          </ul>
        </article>
      </section>

      <section v-else class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <h2>路由页面</h2>
          <p>该页面已迁移到 Vue。你可以从左侧导航进入具体工作流。</p>
          <div class="legacy-tool-grid">
            <a class="legacy-tool-action" href="/next/actions/daily"><strong>今日复习</strong><span>进入今日复习任务</span></a>
            <a class="legacy-tool-action" href="/next/actions/direct"><strong>直接开做</strong><span>进入直接开做任务</span></a>
            <a class="legacy-tool-action" href="/next/actions/speed"><strong>限时复训</strong><span>进入限时复训任务</span></a>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError, apiRequest } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { PublicEntry, RuntimeInfo } from '@/types/auth'
import type {
  AdviceItem,
  BackupMetaResponse,
  BackupPayloadResponse,
  CodexThreadsResponse,
  KnowledgeSearchResponse,
  LocalBackupItem,
  LocalBackupsResponse,
  NextHomeContextResponse,
  PracticeAttempt,
  TypeRuleItem,
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
const homeContext = ref<NextHomeContextResponse | null>(null)

const searchQuery = ref('')
const searchResults = ref<KnowledgeSearchResponse>({ ok: true, nodes: [], errors: [] })

const remarkDraft = ref('')
const journalDate = ref(new Date().toISOString().slice(0, 10))
const journalDraft = ref('')
const codexThreads = ref<CodexThreadsResponse['threads']>([])
const codexMessages = ref<Array<{ id: string; role: string; content: string }>>([])
const activeCodexThreadId = ref('')
const codexDraft = ref('')
const aiDraft = ref('')
const aiReply = ref('')
const aiDiagnosisSummary = ref('')
const aiWeakPoints = ref<Array<{ area?: string; description?: string; priority?: string; suggestion?: string }>>([])
const practiceAttempts = ref<PracticeAttempt[]>([])
const practiceAdvice = ref<AdviceItem[]>([])
const importRawText = ref('')
const importNotice = ref('')
const typeRulesDraft = ref('[]')
const handledRouteAction = ref('')

const mode = computed(() => String((route.meta.nativeMode as string) || 'action'))
const modeLabel = computed(() => {
  const map: Record<string, string> = {
    login: '登录',
    backup: '备份',
    search: '搜索',
    notes: '笔记',
    insights: '统计',
    transfer: '导入',
    export: '导出',
    codex: 'Codex',
    ai: 'AI',
    action: '操作',
  }
  return map[mode.value] || mode.value
})
const pageTitle = computed(() => String(route.meta.title || '工具页'))
const pageDesc = computed(() => String(route.meta.description || '原生 /next 路由页'))
const recommendedQueue = computed(() => homeContext.value?.workbench?.noteFirstQueue || [])

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

async function persistSnapshot(snapshot: WorkspaceSnapshot, forceOverwrite = false) {
  const baseUpdatedAt = String(backupMeta.value?.updatedAt || currentSnapshot().exportTime || currentSnapshot().baseUpdatedAt || '')
  const payload = {
    ...snapshot,
    xc_version: 2,
    baseUpdatedAt,
    forceOverwrite,
  }
  try {
    await apiRequest('/api/backup', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      await apiRequest('/api/backup', {
        method: 'PUT',
        body: JSON.stringify({
          ...payload,
          forceOverwrite: true,
        }),
      })
      return
    }
    throw error
  }
}

async function loadSharedData() {
  const [runtime, entry, meta, payload, locals, context] = await Promise.all([
    apiRequest<RuntimeInfo>('/api/runtime-info'),
    apiRequest<PublicEntry>('/api/public-entry'),
    apiRequest<BackupMetaResponse>('/api/backup?meta=true'),
    apiRequest<BackupPayloadResponse>('/api/backup'),
    apiRequest<LocalBackupsResponse>('/api/local-backups'),
    apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=12'),
  ])
  runtimeInfo.value = runtime
  publicEntry.value = entry
  backupMeta.value = meta
  backupPayload.value = payload
  localBackups.value = locals.items || []
  homeContext.value = context
  syncDraftFromSnapshot()
  typeRulesDraft.value = JSON.stringify((currentSnapshot().typeRules || []) as TypeRuleItem[], null, 2)
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

async function goBack() {
  if (window.history.length > 1) {
    await router.back()
    return
  }
  await router.push({ name: 'workspace' })
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
    await persistSnapshot(currentSnapshot(), true)
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
    await persistSnapshot(payload.backup as WorkspaceSnapshot, true)
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

async function refreshLocalBackupList() {
  busy.value = true
  try {
    const payload = await apiRequest<LocalBackupsResponse>('/api/local-backups')
    localBackups.value = payload.items || []
    actionNotice.value = '本地备份列表已刷新。'
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
      body: JSON.stringify({ backupId: id, createSafetyBackup: true }),
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

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = { ok: true, nodes: [], errors: [] }
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

function buildDailyTemplate(dateText: string) {
  return `## ${dateText}\n- 今日目标\n- 复盘\n- 下一步\n`
}

function insertDailyLogTemplateToRemark() {
  const today = new Date().toISOString().slice(0, 10)
  const marker = `## ${today}`
  if (!remarkDraft.value.includes(marker)) {
    const template = buildDailyTemplate(today)
    remarkDraft.value = `${remarkDraft.value.trim()}\n\n${template}`.trim()
  }
}

function jumpJournalToday() {
  journalDate.value = new Date().toISOString().slice(0, 10)
}

function insertJournalTemplate() {
  const marker = `## ${journalDate.value}`
  if (!journalDraft.value.includes(marker)) {
    const template = buildDailyTemplate(journalDate.value)
    journalDraft.value = `${template}\n${journalDraft.value}`.trim()
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

async function loadPracticeInsights() {
  const [attemptsPayload, insightsPayload] = await Promise.all([
    apiRequest<{ ok: true; items: PracticeAttempt[] }>('/api/practice/attempts?limit=120'),
    apiRequest<{ ok: true; advice?: AdviceItem[] }>('/api/practice/insights?limit=8'),
  ])
  practiceAttempts.value = attemptsPayload.items || []
  practiceAdvice.value = insightsPayload.advice || []
}

async function importSnapshotFromText() {
  const raw = importRawText.value.trim()
  if (!raw) {
    importNotice.value = '请先粘贴 JSON。'
    return
  }
  busy.value = true
  importNotice.value = ''
  try {
    const parsed = JSON.parse(raw) as unknown
    const snapshot = cloneSnapshot(currentSnapshot()) as WorkspaceSnapshot
    if (Array.isArray(parsed)) {
      snapshot.errors = parsed as WorkspaceSnapshot['errors']
    } else if (parsed && typeof parsed === 'object') {
      Object.assign(snapshot, parsed)
    } else {
      throw new Error('JSON 结构不支持')
    }
    await persistSnapshot(snapshot, true)
    importNotice.value = '导入成功。'
    await loadSharedData()
  } catch (error: unknown) {
    importNotice.value = error instanceof Error ? error.message : '导入失败'
  } finally {
    busy.value = false
  }
}

async function saveTypeRules() {
  busy.value = true
  importNotice.value = ''
  try {
    const parsed = JSON.parse(typeRulesDraft.value) as unknown
    if (!Array.isArray(parsed)) {
      throw new Error('题型规则必须是数组')
    }
    const snapshot = cloneSnapshot(currentSnapshot()) as WorkspaceSnapshot
    snapshot.typeRules = parsed as TypeRuleItem[]
    await persistSnapshot(snapshot)
    importNotice.value = '题型规则已保存。'
    await loadSharedData()
  } catch (error: unknown) {
    importNotice.value = error instanceof Error ? error.message : '题型规则保存失败'
  } finally {
    busy.value = false
  }
}

async function loadCodexThreads() {
  const payload = await apiRequest<CodexThreadsResponse>('/api/codex/threads')
  codexThreads.value = payload.threads || []
}

async function createCodexThread() {
  busy.value = true
  pageError.value = ''
  try {
    const payload = await apiRequest<{ ok: true; thread: { id: string } }>('/api/codex/threads', {
      method: 'POST',
      body: JSON.stringify({ title: `新线程 ${new Date().toLocaleString()}` }),
    })
    await loadCodexThreads()
    if (payload.thread?.id) {
      await openCodexThread(payload.thread.id)
    }
  } finally {
    busy.value = false
  }
}

async function openCodexThread(threadId: string) {
  if (!threadId) return
  busy.value = true
  pageError.value = ''
  try {
    const payload = await apiRequest<{
      ok: true
      messages: Array<{ id: string; role: string; content: string }>
    }>(`/api/codex/threads/${encodeURIComponent(threadId)}`)
    activeCodexThreadId.value = threadId
    codexMessages.value = payload.messages || []
  } finally {
    busy.value = false
  }
}

async function sendCodexMessage() {
  if (!activeCodexThreadId.value || !codexDraft.value.trim()) return
  busy.value = true
  pageError.value = ''
  try {
    await apiRequest(`/api/codex/threads/${encodeURIComponent(activeCodexThreadId.value)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: codexDraft.value, context: {} }),
    })
    codexDraft.value = ''
    await openCodexThread(activeCodexThreadId.value)
    await loadCodexThreads()
  } finally {
    busy.value = false
  }
}

async function runAiChat() {
  if (!aiDraft.value.trim()) return
  busy.value = true
  pageError.value = ''
  try {
    const payload = await apiRequest<{ ok: true; reply: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: aiDraft.value,
        history: codexMessages.value.slice(-4).map((item) => ({ role: item.role, content: item.content })),
      }),
    })
    aiReply.value = payload.reply || ''
  } finally {
    busy.value = false
  }
}

async function runAiDiagnose() {
  busy.value = true
  pageError.value = ''
  try {
    const payload = await apiRequest<{
      ok: true
      result?: {
        summary?: string
        weakPoints?: Array<{ area?: string; description?: string; priority?: string; suggestion?: string }>
      }
    }>('/api/ai/diagnose', {
      method: 'POST',
      body: JSON.stringify({ errors: [] }),
    })
    aiDiagnosisSummary.value = payload.result?.summary || ''
    aiWeakPoints.value = payload.result?.weakPoints || []
  } finally {
    busy.value = false
  }
}

async function loadByMode() {
  if (mode.value === 'login') return
  await loadSharedData()
  if (route.name === 'tool-journal-today') {
    journalDate.value = new Date().toISOString().slice(0, 10)
  }
  if (route.name === 'tool-journal-template' || route.name === 'tool-remarks-daily-log') {
    const today = new Date().toISOString().slice(0, 10)
    const template = `## ${today}\n- 今日目标\n- 复盘\n- 下一步\n`
    if (!journalDraft.value.includes(`## ${today}`)) {
      journalDraft.value = `${template}\n${journalDraft.value}`.trim()
    }
  }

  const routeActionKey = `${String(route.name || '')}|${route.fullPath}`
  if (handledRouteAction.value !== routeActionKey) {
    if (route.name === 'tool-backup-create') {
      await createLocalBackup()
      actionNotice.value = '已创建本地备份。'
      handledRouteAction.value = routeActionKey
    } else if (route.name === 'tool-backup-refresh') {
      actionNotice.value = '备份列表已刷新。'
      handledRouteAction.value = routeActionKey
    } else if (route.name === 'tool-backup-restore') {
      const id = String(route.query.id || '').trim()
      if (id) {
        await restoreLocalBackup(id)
        actionNotice.value = '已恢复本地备份。'
      }
      handledRouteAction.value = routeActionKey
    } else if (route.name === 'tool-backup-delete') {
      const id = String(route.query.id || '').trim()
      if (id) {
        await deleteLocalBackup(id)
        actionNotice.value = '已删除本地备份。'
      }
      handledRouteAction.value = routeActionKey
    }
  }

  if (mode.value === 'codex') {
    await loadCodexThreads()
  }
  if (mode.value === 'ai') {
    await runAiDiagnose()
  }
  if (mode.value === 'insights') {
    await loadPracticeInsights()
  }
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
