<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useXingceStore } from '@/stores/xingceStore'
import PracticePanel from '@/components/xingce/PracticePanel.vue'
import FilterSidebar from '@/components/xingce/FilterSidebar.vue'
import NotesWorkspacePanel from '@/components/xingce/NotesWorkspacePanel.vue'
import ErrorsWorkspacePanel from '@/components/xingce/ErrorsWorkspacePanel.vue'
import GlobalSearchModal from '@/components/xingce/GlobalSearchModal.vue'
import QuizModal from '@/components/xingce/QuizModal.vue'
import AddErrorModal from '@/components/xingce/AddErrorModal.vue'
import ImportModal from '@/components/xingce/ImportModal.vue'
import HistoryModal from '@/components/xingce/HistoryModal.vue'
import TypeRulesModal from '@/components/xingce/TypeRulesModal.vue'
import { savePortalLastModule } from '@/lib/portalPrefs'
import '@/styles/xingce-vue-legacy.css'

const store = useXingceStore()
const router = useRouter()
const route = useRoute()
const quizMode = ref<'daily' | 'full' | 'review' | 'retrain' | null>(null)
const showAddModal = ref(false)
const showImportModal = ref(false)
const showGlobalSearch = ref(false)
const showHistoryModal = ref(false)
const showTypeRulesModal = ref(false)
const notesWorkspaceRef = ref<InstanceType<typeof NotesWorkspacePanel> | null>(null)

/** 与旧版 `switchTab` 默认一致：工作区先展示「学习笔记」 */
const mainTab = ref<'notes' | 'errors'>('notes')

const runtimeMode = computed(() => {
  if (typeof window === 'undefined') return 'unknown'
  const { hostname } = window.location
  if (hostname === '127.0.0.1' || hostname === 'localhost') return 'local'
  return 'docker'
})

const runtimeLabel = computed(() => {
  if (typeof window === 'undefined') return 'unknown'
  const { hostname, port } = window.location
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return port ? `${hostname}:${port}` : hostname
  }
  return hostname
})

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    showGlobalSearch.value = true
  }
}

onMounted(() => {
  savePortalLastModule('xingce')
  store.load()
  store.loadMe()
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

function onPickQuestion(id: string) {
  showGlobalSearch.value = false
  mainTab.value = 'errors'
  store.clearFilters()
  nextTick(() => {
    const safe = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"')
    const el = document.querySelector(`[data-error-id="${safe}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.classList.add('ec--picked')
    window.setTimeout(() => el?.classList.remove('ec--picked'), 2200)
  })
}

function onStartRandomNote() {
  const withNotes = store.knowledgeNodes.filter((n) => {
    const md = String(n.contentMd ?? '').trim()
    const nt = String(n.noteContent ?? '').trim()
    return !!(md || nt)
  })
  if (!withNotes.length) {
    window.alert('暂无笔记内容')
    return
  }
  const pick = withNotes[Math.floor(Math.random() * withNotes.length)]!
  store.setActiveNode(pick.id)
  mainTab.value = 'notes'
}

function onOpenMarkdownEditor() {
  mainTab.value = 'notes'
  nextTick(() => notesWorkspaceRef.value?.enterNoteEdit())
}

function onPickNote(nodeId: string) {
  store.setActiveNode(nodeId)
  mainTab.value = 'notes'
  showGlobalSearch.value = false
}

function qsOne(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && v[0]) return String(v[0])
  return ''
}

function consumeSuiteGlobalSearchHandoff() {
  if (store.loading) return
  const errId = qsOne(route.query.gsPickError)
  const noteId = qsOne(route.query.gsPickNote)
  if (!errId && !noteId) return
  const q = { ...route.query }
  delete q.gsPickError
  delete q.gsPickNote
  void router.replace({ path: route.path, query: q })
  if (errId) onPickQuestion(errId)
  else onPickNote(noteId)
}

watch(
  () => [store.loading, route.query.gsPickError, route.query.gsPickNote] as const,
  consumeSuiteGlobalSearchHandoff,
  { flush: 'post' },
)

function onPickSuite(paperId: string, questionId: string) {
  showGlobalSearch.value = false
  const q: Record<string, string> = { paper: paperId }
  if (questionId) q.qid = questionId
  void router.push({
    name: 'XingceSuiteBank',
    query: q,
  })
}
</script>

<template>
  <div class="xc-vue-legacy">
    <div v-if="store.loading" class="xc-loading">
      <div class="xc-spinner" />
      <p>加载数据中…</p>
    </div>

    <div v-else-if="store.loadError" class="xc-error-state">
      <p class="xc-error-msg">{{ store.loadError }}</p>
      <button type="button" class="btn btn-primary" @click="store.load()">重试</button>
    </div>

    <template v-else>
      <aside
        class="sidebar"
        :class="{ 'is-tree-focus': store.knowledgeFocusMode }"
      >
        <div class="sidebar-logo">
          <div>Ashore</div>
          <div class="runtime-badge" :data-mode="runtimeMode">Runtime: {{ runtimeLabel }}</div>
        </div>
        <PracticePanel
          @start-quiz="(mode) => { quizMode = mode }"
          @start-random-note="onStartRandomNote"
          @open-add="showAddModal = true"
          @open-import="showImportModal = true"
          @open-markdown-editor="onOpenMarkdownEditor"
          @open-history="showHistoryModal = true"
          @open-type-rules="showTypeRulesModal = true"
        />
        <FilterSidebar />
      </aside>

      <div class="main-area">
        <div class="xc-ws-main-inner">
          <div class="xc-ws-tabs">
            <button
              type="button"
              class="tab-btn"
              data-testid="workspace-tab-notes"
              :class="{ active: mainTab === 'notes' }"
              @click="mainTab = 'notes'"
            >
              学习笔记
            </button>
            <button
              type="button"
              class="tab-btn"
              data-testid="workspace-tab-errors"
              :class="{ active: mainTab === 'errors' }"
              @click="mainTab = 'errors'"
            >
              错题列表
            </button>
          </div>
          <div class="xc-ws-top-meta">
            <span v-if="store.currentUser" class="xc-user-pill">{{ store.currentUser.username }}</span>
            <span
              v-if="mainTab === 'errors'"
              class="xc-mini-count"
              title="当前筛选 / 全库"
            >
              {{ store.filteredErrors.length }} / {{ store.errors.length }} 题
            </span>
            <button
              v-if="store.activeNodeId || store.statusFilter !== 'all' || store.taskFilter !== 'all' || store.reasonFilter || store.dateFrom || store.dateTo || store.searchQuery"
              type="button"
              class="btn btn-sm btn-secondary"
              @click="store.clearFilters()"
            >
              清除筛选
            </button>
            <span v-if="store.saving" class="xc-save-pill saving">保存中…</span>
            <span v-else-if="store.lastSavedAt" class="xc-save-pill saved">已保存</span>
          </div>
          <div class="xc-ws-tab-panes">
            <div
              id="tabContentNotes"
              class="tab-content"
              :class="{ active: mainTab === 'notes' }"
              :data-filtered-count="store.filteredErrors.length"
              :data-total-count="store.errors.length"
            >
              <NotesWorkspacePanel
                ref="notesWorkspaceRef"
                @open-import="showImportModal = true"
                @open-global-search="showGlobalSearch = true"
              />
            </div>
            <div
              id="tabContentErrors"
              class="tab-content"
              :class="{ active: mainTab === 'errors' }"
            >
              <ErrorsWorkspacePanel @open-global-search="showGlobalSearch = true" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <GlobalSearchModal
      v-if="showGlobalSearch"
      @close="showGlobalSearch = false"
      @pick-question="onPickQuestion"
      @pick-note="onPickNote"
      @pick-suite="onPickSuite"
    />
    <QuizModal v-if="quizMode" :mode="quizMode" @close="quizMode = null" />
    <AddErrorModal v-if="showAddModal" @close="showAddModal = false" @added="() => {}" />
    <ImportModal v-if="showImportModal" @close="showImportModal = false" @imported="() => {}" />

    <HistoryModal v-if="showHistoryModal" @close="showHistoryModal = false" />
    <TypeRulesModal v-if="showTypeRulesModal" @close="showTypeRulesModal = false" />
  </div>
</template>

<style scoped>
.xc-loading,
.xc-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
  gap: 12px;
  color: #666;
  font-size: 14px;
}
.xc-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e8e8e8;
  border-top-color: #e74c3c;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.xc-error-msg {
  color: #cf1322;
}
.xc-user-pill {
  font-size: 12px;
  color: #64748b;
  padding: 2px 8px;
  background: #f1f5f9;
  border-radius: 6px;
}
.xc-mini-count {
  font-size: 12px;
  color: #888;
}
.xc-save-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}
.xc-save-pill.saving {
  background: #fff7e6;
  color: #d46b08;
}
.xc-save-pill.saved {
  background: #f6ffed;
  color: #389e0d;
}
</style>
