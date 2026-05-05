<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import WorkspaceSidebarBrand from '@/components/xingce/WorkspaceSidebarBrand.vue'
import FilterSidebar from '@/components/xingce/FilterSidebar.vue'
import PracticePanel from '@/components/xingce/PracticePanel.vue'
import NotesWorkspacePanel from '@/components/xingce/NotesWorkspacePanel.vue'
import ErrorsWorkspacePanel from '@/components/xingce/ErrorsWorkspacePanel.vue'
import GlobalSearchModal from '@/components/xingce/GlobalSearchModal.vue'
import QuizModal from '@/components/xingce/QuizModal.vue'
import AddErrorModal from '@/components/xingce/AddErrorModal.vue'
import ImportModal from '@/components/xingce/ImportModal.vue'
import HistoryModal from '@/components/xingce/HistoryModal.vue'
import TypeRulesModal from '@/components/xingce/TypeRulesModal.vue'

const store = useXingceStore()
const quizMode = ref<'daily' | 'full' | 'review' | 'retrain' | null>(null)
const showAddModal = ref(false)
const showImportModal = ref(false)
const showGlobalSearch = ref(false)
const showHistoryModal = ref(false)
const showTypeRulesModal = ref(false)
const notesWorkspaceRef = ref<InstanceType<typeof NotesWorkspacePanel> | null>(null)

/** 与旧版 `switchTab` 默认一致：工作区先展示「学习笔记」 */
const mainTab = ref<'notes' | 'errors'>('notes')

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    showGlobalSearch.value = true
  }
}

onMounted(() => {
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
</script>

<template>
  <div class="xc-workspace">
    <div v-if="store.loading" class="xc-loading">
      <div class="xc-spinner" />
      <p>加载数据中…</p>
    </div>

    <div v-else-if="store.loadError" class="xc-error-state">
      <p class="xc-error-msg">{{ store.loadError }}</p>
      <button class="xc-btn" @click="store.load()">重试</button>
    </div>

    <div v-else class="xc-body">
      <aside class="xc-sidebar">
        <WorkspaceSidebarBrand />
        <PracticePanel
          v-if="!store.knowledgeFocusMode"
          @start-quiz="(mode) => { quizMode = mode }"
          @start-random-note="onStartRandomNote"
          @open-add="showAddModal = true"
          @open-import="showImportModal = true"
          @open-markdown-editor="onOpenMarkdownEditor"
          @open-history="showHistoryModal = true"
          @open-type-rules="showTypeRulesModal = true"
        />
        <div v-if="!store.knowledgeFocusMode" class="xc-sidebar-divider" />
        <FilterSidebar />
      </aside>

      <div class="xc-main-wrap">
        <div class="xc-main-tabs-row">
          <div class="xc-tabs">
            <button
              type="button"
              class="xc-tab"
              data-testid="workspace-tab-notes"
              :class="{ active: mainTab === 'notes' }"
              @click="mainTab = 'notes'"
            >学习笔记</button>
            <button
              type="button"
              class="xc-tab"
              data-testid="workspace-tab-errors"
              :class="{ active: mainTab === 'errors' }"
              @click="mainTab = 'errors'"
            >错题列表</button>
          </div>
          <div class="xc-main-meta">
            <span v-if="store.currentUser" class="xc-user">{{ store.currentUser.username }}</span>
            <span v-if="mainTab === 'errors'" class="xc-mini-count" title="当前筛选 / 全库">
              {{ store.filteredErrors.length }} / {{ store.errors.length }} 题
            </span>
            <button
              v-if="store.activeNodeId || store.statusFilter !== 'all' || store.taskFilter !== 'all' || store.reasonFilter || store.dateFrom || store.dateTo || store.searchQuery"
              type="button"
              class="xc-clear-btn"
              @click="store.clearFilters()"
            >清除筛选</button>
            <span v-if="store.saving" class="xc-save-status saving">保存中…</span>
            <span v-else-if="store.lastSavedAt" class="xc-save-status saved">已保存</span>
          </div>
        </div>

        <main
          class="xc-main"
          :data-filtered-count="store.filteredErrors.length"
          :data-total-count="store.errors.length"
        >
          <NotesWorkspacePanel
            ref="notesWorkspaceRef"
            v-show="mainTab === 'notes'"
            @open-import="showImportModal = true"
            @open-global-search="showGlobalSearch = true"
          />
          <ErrorsWorkspacePanel v-show="mainTab === 'errors'" @open-global-search="showGlobalSearch = true" />
        </main>
      </div>
    </div>

    <GlobalSearchModal
      v-if="showGlobalSearch"
      @close="showGlobalSearch = false"
      @pick-question="onPickQuestion"
      @pick-note="onPickNote"
    />
    <QuizModal v-if="quizMode" :mode="quizMode" @close="quizMode = null" />
    <AddErrorModal v-if="showAddModal" @close="showAddModal = false" @added="() => {}" />
    <ImportModal v-if="showImportModal" @close="showImportModal = false" @imported="() => {}" />

    <HistoryModal v-if="showHistoryModal" @close="showHistoryModal = false" />
    <TypeRulesModal v-if="showTypeRulesModal" @close="showTypeRulesModal = false" />
  </div>
</template>

<style scoped>
.xc-workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f6f8;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  overflow: hidden;
}

.xc-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  gap: 0;
}

.xc-sidebar {
  width: 260px;
  min-width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  padding: 0 10px 12px;
}

.xc-sidebar-divider {
  height: 1px;
  background: #e8e8e8;
  flex-shrink: 0;
  margin: 0 -10px;
}

.xc-main-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.xc-main-tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.xc-tabs {
  display: flex;
  gap: 4px;
}

.xc-tab {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  border-radius: 8px;
  font-size: 13px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 500;
}
.xc-tab:hover { background: #f1f5f9; color: #334155; }
.xc-tab.active {
  background: #fff;
  border-color: #cbd5e1;
  color: #1e293b;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.xc-main-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}

.xc-user {
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

.xc-clear-btn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
}
.xc-clear-btn:hover { background: #f1f5f9; color: #1e293b; }

.xc-save-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}
.xc-save-status.saving { background: #fff7e6; color: #d46b08; }
.xc-save-status.saved  { background: #f6ffed; color: #389e0d; }

.xc-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 14px 14px;
}

.xc-loading,
.xc-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  color: #666;
  font-size: 14px;
}

.xc-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e8e8e8;
  border-top-color: #4a6cf7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.xc-error-msg { color: #cf1322; }

.xc-btn {
  padding: 6px 16px;
  background: #4a6cf7;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.xc-btn:hover { background: #3a5ce5; }
</style>
