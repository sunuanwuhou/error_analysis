<template>
  <main class="sl-app">
    <header class="sl-top">
      <div>
        <div class="sl-badges">
          <span class="sl-badge" :data-mode="runtimeMode">运行时：{{ runtimeInfo?.label || '加载中' }}</span>
          <span class="sl-badge">云端账号：{{ authStore.user?.username || '访客' }}</span>
          <span id="syncBadge" class="sl-badge" :data-state="backupMeta?.exists ? 'synced' : 'idle'">
            {{ backupMeta?.exists ? '已同步' : '同步待命' }}
          </span>
        </div>
        <h1>申论工作台</h1>
        <p>按申论知识树选节点，再往节点下录题和笔记。题目表单保留最小必需项。</p>
      </div>
      <nav class="sl-switch">
        <a href="/next/workspace">行测工作台</a>
        <a class="active" href="/next/shenlun">申论工作台</a>
        <button type="button" @click="reloadAll">立即同步</button>
        <button type="button" @click="logout">退出登录</button>
      </nav>
    </header>

    <div class="sl-shell">
      <aside class="sl-side">
        <section class="sl-card">
          <div class="sl-card-head"><h2>当前概况</h2></div>
          <div class="sl-metrics">
            <div><span>题目</span><strong>{{ questions.length }}</strong></div>
            <div><span>已写</span><strong>{{ doneCount }}</strong></div>
            <div><span>套卷</span><strong>{{ paperCount }}</strong></div>
          </div>
          <p class="sl-hint">{{ backupMeta?.exists ? '云端与本地已连通。' : '工作区还没同步，先在本地录入也可以。' }}</p>
        </section>

        <section class="sl-card">
          <div class="sl-card-head"><h2>申论知识树</h2></div>
          <div id="noteTree" class="sl-list">
            <button
              v-for="node in flatNodes"
              :key="node.id"
              :class="{ active: selectedNodeId === node.id }"
              type="button"
              @click="selectNode(node.id)"
            >
              {{ node.label }}
            </button>
            <div v-if="!flatNodes.length" class="empty">暂无知识节点</div>
          </div>
        </section>

        <section class="sl-card">
          <div class="sl-card-head">
            <h2>当前节点题目</h2>
            <button type="button" @click="newQuestion">新建题目</button>
          </div>
          <div id="questionList" class="sl-question-table">
            <div class="sl-question-head">
              <span>题目</span>
              <span>套卷</span>
              <span>更新</span>
            </div>
            <button
              v-for="item in nodeQuestions"
              :key="item.id || item.question"
              class="sl-question-row"
              :class="{ active: currentQuestionId === item.id }"
              type="button"
              @click="selectQuestion(item)"
            >
              <span class="sl-question-title">{{ item.question || '未命名题目' }}</span>
              <span class="sl-question-cell">{{ item.srcOrigin || '-' }}</span>
              <span class="sl-question-cell">{{ item.updatedAt || '-' }}</span>
            </button>
            <div v-if="!nodeQuestions.length" class="empty">当前节点暂无题目</div>
          </div>
        </section>
      </aside>

      <main class="sl-main">
        <section class="sl-hero">
          <h2>{{ selectedNode?.title || '先在左侧选一个申论节点' }}</h2>
          <p>当前页只保留：当前节点、套卷、题目、我的答案、标准答案。</p>
          <div class="sl-badges">
            <span class="sl-badge">{{ notice || '就绪' }}</span>
            <span v-if="pageError" class="sl-badge" data-state="error">{{ pageError }}</span>
          </div>
        </section>

        <section class="sl-card">
          <div class="sl-card-head">
            <h2>节点工作区</h2>
            <div class="sl-tabs">
              <button class="sl-tab" :class="{ active: activeTab === 'questions' }" type="button" @click="activeTab = 'questions'">题目</button>
              <button class="sl-tab" :class="{ active: activeTab === 'notes' }" type="button" @click="activeTab = 'notes'">笔记</button>
            </div>
          </div>

          <div class="sl-panel" :class="{ active: activeTab === 'questions' }">
            <section class="sl-card sl-subcard">
              <div class="sl-card-head"><h3>题目记录</h3></div>
              <div class="sl-form">
                <label><span>当前节点</span><input :value="selectedNode?.title || ''" disabled /></label>
                <label><span>套卷</span><input v-model.trim="questionForm.paperTitle" placeholder="可空，如 2025国考副省级" /></label>
                <label><span>题目</span><textarea v-model.trim="questionForm.prompt" placeholder="题目、材料说明、要求都可以直接写在这里。" /></label>
                <label><span>我的答案</span><textarea v-model.trim="questionForm.myAnswer" placeholder="直接录入你的答案。" /></label>
                <label><span>标准答案</span><textarea v-model.trim="questionForm.reference" placeholder="标准答案或参考答案。" /></label>
              </div>
              <div class="sl-actions">
                <button type="button" class="primary" @click="saveQuestion">保存题目</button>
                <button type="button" @click="resetQuestion">清空题目</button>
                <button type="button" class="danger" :disabled="!currentQuestionId" @click="deleteQuestion">删除当前题目</button>
              </div>
            </section>
          </div>

          <div class="sl-panel" :class="{ active: activeTab === 'notes' }">
            <div class="sl-form">
              <label><span>节点标题</span><input v-model.trim="noteForm.title" /></label>
              <label><span>节点笔记</span><textarea v-model.trim="noteForm.content" placeholder="这一节点的方法、模板、素材、易错点都可以放这里。" /></label>
            </div>
            <div class="sl-actions">
              <button type="button" class="primary" @click="saveNote">保存笔记</button>
              <button type="button" @click="resetNote">恢复当前节点内容</button>
            </div>
            <section class="sl-preview">
              <h3>节点笔记预览</h3>
              <div>{{ noteForm.content || '当前还没有内容。' }}</div>
            </section>
          </div>
        </section>
      </main>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError, apiRequest } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { RuntimeInfo } from '@/types/auth'
import type {
  BackupMetaResponse,
  ErrorSummary,
  KnowledgeTreeNode,
  NextHomeContextResponse,
} from '@/types/workspace'

type KnowledgeNodeRecord = KnowledgeTreeNode & {
  parentId?: string
  contentMd?: string
  sort?: number
}

const router = useRouter()
const authStore = useAuthStore()

const runtimeInfo = ref<RuntimeInfo | null>(null)
const backupMeta = ref<BackupMetaResponse | null>(null)
const knowledgeRoots = ref<KnowledgeNodeRecord[]>([])
const questions = ref<ErrorSummary[]>([])
const selectedNodeId = ref('')
const selectedNode = ref<KnowledgeNodeRecord | null>(null)
const currentQuestionId = ref('')
const activeTab = ref<'questions' | 'notes'>('questions')
const pageError = ref('')
const notice = ref('')

const questionForm = ref({
  paperTitle: '',
  prompt: '',
  myAnswer: '',
  reference: '',
})

const noteForm = ref({
  title: '',
  content: '',
})

const runtimeMode = computed(() => {
  const text = String(runtimeInfo.value?.label || '').toLowerCase()
  if (text.includes('docker')) return 'docker'
  if (text.includes('local')) return 'local'
  return 'unknown'
})

const flatNodes = computed(() => {
  const out: Array<{ id: string; label: string }> = []
  const walk = (nodes: KnowledgeNodeRecord[], path: string[] = []) => {
    for (const node of nodes) {
      const nextPath = [...path, node.title]
      out.push({ id: node.id, label: nextPath.join(' / ') })
      if (node.children?.length) {
        walk(node.children as KnowledgeNodeRecord[], nextPath)
      }
    }
  }
  walk(knowledgeRoots.value)
  return out
})

const nodeQuestions = computed(() =>
  questions.value
    .filter((item) => {
      if (!selectedNodeId.value) return true
      return String(item.noteNodeId || '') === selectedNodeId.value
    })
    .slice(0, 120),
)

const doneCount = computed(
  () => questions.value.filter((item) => String(item.myAnswer || '').trim().length > 0).length,
)

const paperCount = computed(() => {
  const papers = new Set(
    questions.value.map((item) => String(item.srcOrigin || '').trim()).filter(Boolean),
  )
  return papers.size
})

function findNodeById(nodes: KnowledgeNodeRecord[], nodeId: string): KnowledgeNodeRecord | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node
    }
    const child = findNodeById((node.children || []) as KnowledgeNodeRecord[], nodeId)
    if (child) return child
  }
  return null
}

function selectQuestion(item: ErrorSummary) {
  currentQuestionId.value = String(item.id || '')
  questionForm.value = {
    paperTitle: String(item.srcOrigin || ''),
    prompt: String(item.question || ''),
    myAnswer: String(item.myAnswer || ''),
    reference: String(item.answer || ''),
  }
  activeTab.value = 'questions'
}

function newQuestion() {
  currentQuestionId.value = ''
  resetQuestion()
  activeTab.value = 'questions'
}

function resetQuestion() {
  questionForm.value = {
    paperTitle: '',
    prompt: '',
    myAnswer: '',
    reference: '',
  }
}

function resetNote() {
  noteForm.value.title = String(selectedNode.value?.title || '')
  noteForm.value.content = String(selectedNode.value?.contentMd || '')
}

async function selectNode(nodeId: string) {
  selectedNodeId.value = nodeId
  currentQuestionId.value = ''
  resetQuestion()
  try {
    const payload = await apiRequest<{ ok: true; item: KnowledgeNodeRecord }>(`/api/knowledge/nodes/${encodeURIComponent(nodeId)}`)
    selectedNode.value = payload.item
    resetNote()
  } catch {
    selectedNode.value = findNodeById(knowledgeRoots.value, nodeId)
    resetNote()
  }
}

async function saveQuestion() {
  pageError.value = ''
  notice.value = ''
  if (!selectedNodeId.value) {
    pageError.value = '请先选择一个知识节点'
    return
  }
  if (!questionForm.value.prompt.trim()) {
    pageError.value = '题目不能为空'
    return
  }
  const body = {
    id: currentQuestionId.value,
    type: '申论',
    subtype: selectedNode.value?.title || '申论节点',
    question: questionForm.value.prompt,
    myAnswer: questionForm.value.myAnswer,
    answer: questionForm.value.reference,
    noteNodeId: selectedNodeId.value,
    srcOrigin: questionForm.value.paperTitle,
    status: 'focus',
  }
  try {
    if (currentQuestionId.value) {
      await apiRequest(`/api/errors/${encodeURIComponent(currentQuestionId.value)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    } else {
      const payload = await apiRequest<{ ok: true; item: ErrorSummary }>('/api/errors', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      currentQuestionId.value = String(payload.item.id || '')
    }
    notice.value = '题目已保存'
    await reloadAll()
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '保存题目失败'
  }
}

async function deleteQuestion() {
  if (!currentQuestionId.value) return
  pageError.value = ''
  notice.value = ''
  try {
    await apiRequest(`/api/errors/${encodeURIComponent(currentQuestionId.value)}`, {
      method: 'DELETE',
    })
    currentQuestionId.value = ''
    resetQuestion()
    notice.value = '题目已删除'
    await reloadAll()
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '删除题目失败'
  }
}

async function saveNote() {
  if (!selectedNodeId.value || !selectedNode.value) {
    pageError.value = '请先选择一个知识节点'
    return
  }
  pageError.value = ''
  notice.value = ''
  try {
    const payload = await apiRequest<{ ok: true; item: KnowledgeNodeRecord }>(`/api/knowledge/nodes/${encodeURIComponent(selectedNodeId.value)}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: selectedNode.value.id,
        parentId: selectedNode.value.parentId || '',
        title: noteForm.value.title.trim(),
        contentMd: noteForm.value.content,
        sort: Number(selectedNode.value.sort || 0),
      }),
    })
    selectedNode.value = payload.item
    notice.value = '笔记已保存'
    await reloadAll()
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '保存笔记失败'
  }
}

async function reloadAll() {
  pageError.value = ''
  const [runtime, meta, homeContext] = await Promise.all([
    apiRequest<RuntimeInfo>('/api/runtime-info'),
    apiRequest<BackupMetaResponse>('/api/backup?meta=true'),
    apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=120'),
  ])
  runtimeInfo.value = runtime
  backupMeta.value = meta
  questions.value = homeContext.errors || []
  knowledgeRoots.value = (Array.isArray(homeContext.knowledgeTree)
    ? homeContext.knowledgeTree
    : (homeContext.knowledgeTree?.roots || [])) as KnowledgeNodeRecord[]
  if (!selectedNodeId.value && flatNodes.value.length) {
    await selectNode(flatNodes.value[0].id)
    return
  }
  if (selectedNodeId.value) {
    await selectNode(selectedNodeId.value)
  }
}

async function logout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}

onMounted(() => {
  void reloadAll().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      void router.push({ name: 'login' })
      return
    }
    pageError.value = error instanceof Error ? error.message : '申论工作台加载失败'
  })
})
</script>
