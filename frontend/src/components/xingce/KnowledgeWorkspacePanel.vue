<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import type { KnowledgeNode } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'
import ErrorCard from './ErrorCard.vue'
import KnowledgeNodeModal from './KnowledgeNodeModal.vue'
import KnowledgeNoteEditorModal from './KnowledgeNoteEditorModal.vue'

marked.setOptions({ gfm: true, breaks: true })

const emit = defineEmits<{
  layoutMode: [mode: WorkspaceMode]
  openImport: []
  openGlobalSearch: []
  openAddForNode: [nodeId: string]
}>()

const store = useXingceStore()

type WorkspaceMode = 'list' | 'note'
type NoteViewMode = 'current' | 'directory'

const workspaceMode = ref<WorkspaceMode>('note')
const noteViewMode = ref<NoteViewMode>('directory')
const noteEditing = ref(false)
const draftMd = ref('')
const directoryPreviewId = ref<string | null>(null)

const nodeModal = ref<{
  mode: 'rename' | 'move' | 'create-child'
  nodeId?: string
  parentId?: string
  fallbackTitle?: string
} | null>(null)

const showNoteEditor = ref(false)

const currentNode = computed(() => {
  const tree = store.knowledgeTree
  if (store.activeNodeId) {
    const found = store.getKnowledgeNodeInTree(store.activeNodeId)
    if (found) return found
  }
  return tree[0] ?? null
})

watch(currentNode, (node) => {
  if (!node) return
  if (store.activeNodeId !== node.id) store.setActiveNode(node.id)
  noteEditing.value = false
  if (store.isTopLevelKnowledgeNode(node)) {
    if (noteViewMode.value !== 'directory' && noteViewMode.value !== 'current') {
      noteViewMode.value = 'directory'
    }
  } else {
    noteViewMode.value = 'current'
  }
}, { immediate: true })

const pathText = computed(() => {
  if (!currentNode.value) return ''
  return store.getNodePathText(currentNode.value.id)
})

const directCount = computed(() =>
  currentNode.value ? store.countErrorsForKnowledgeNode(currentNode.value.id, false) : 0,
)
const linkedCount = computed(() =>
  currentNode.value ? store.countErrorsForKnowledgeNode(currentNode.value.id, true) : 0,
)

const relatedErrors = computed(() =>
  store.collectErrorsForKnowledgeNode(currentNode.value),
)

const noteContent = computed(() => {
  if (!currentNode.value) return ''
  const node = currentNode.value as unknown as Record<string, unknown>
  const md = node.contentMd
  if (typeof md === 'string' && md.trim() && md.trim().toLowerCase() !== 'undefined') return md
  const fromNotes = (store.notesByType as Record<string, unknown>)[currentNode.value.id]
  if (typeof fromNotes === 'string' && fromNotes.trim()) return fromNotes
  if (fromNotes && typeof fromNotes === 'object') {
    const v = (fromNotes as Record<string, unknown>).content
    if (typeof v === 'string') return v
  }
  const nt = node.noteContent
  if (typeof nt === 'string' && nt.trim()) return nt
  return ''
})

watch([relatedErrors, noteContent], () => {
  if (workspaceMode.value === 'list' && !relatedErrors.value.length && noteContent.value.trim()) {
    workspaceMode.value = 'note'
  }
})

watch(relatedErrors, (list) => {
  if (list.length) store.queuePracticeSummaries(list.map(e => e.id))
}, { immediate: true })

watch(noteContent, (v) => {
  if (!noteEditing.value) draftMd.value = v
})

const renderedNote = computed(() => {
  const raw = noteEditing.value ? draftMd.value : noteContent.value
  if (!String(raw).trim()) return ''
  return marked.parse(raw) as string
})

const draftRendered = computed(() => {
  const raw = draftMd.value
  if (!String(raw).trim()) return '<p class="np-ph">预览将显示在此</p>'
  return marked.parse(raw) as string
})

const isTopLevel = computed(() => store.isTopLevelKnowledgeNode(currentNode.value))

type DirectorySection = {
  nodeId: string
  title: string
  pathText: string
  hasContent: boolean
  childCount: number
  depth: number
}

function normalizeMd(value: unknown): string {
  const text = String(value ?? '')
  if (text.trim().toLowerCase() === 'undefined') return ''
  return text
}

function flattenDirectoryTree(nodes: KnowledgeNode[]): DirectorySection[] {
  const out: DirectorySection[] = []
  function walk(node: KnowledgeNode, depth: number) {
    const markdown = normalizeMd(node.contentMd).trim()
    const kids = node.children ?? []
    const childCount = store.countErrorsForKnowledgeNode(node.id, true)
    if (markdown || kids.length || childCount) {
      out.push({
        nodeId: node.id,
        title: String(node.title || ''),
        pathText: store.getNodePathText(node.id),
        hasContent: !!markdown,
        childCount,
        depth,
      })
    }
    for (const c of kids) walk(c as KnowledgeNode, depth + 1)
  }
  for (const c of nodes) walk(c as KnowledgeNode, 0)
  return out
}

const directorySections = computed(() => {
  if (!currentNode.value) return [] as DirectorySection[]
  return flattenDirectoryTree((currentNode.value.children ?? []) as KnowledgeNode[])
})

const directoryPreviewNode = computed(() => {
  const sections = directorySections.value
  if (!sections.length) return null
  const pick = directoryPreviewId.value
    ?? sections.find(s => s.hasContent)?.nodeId
    ?? sections[0]?.nodeId
  if (!pick) return null
  return store.getKnowledgeNodeInTree(pick)
})

watch(directorySections, (sections) => {
  if (!sections.length) {
    directoryPreviewId.value = null
    return
  }
  if (!directoryPreviewId.value || !sections.some(s => s.nodeId === directoryPreviewId.value)) {
    directoryPreviewId.value = sections.find(s => s.hasContent)?.nodeId ?? sections[0]?.nodeId ?? null
  }
})

const directoryPreviewHtml = computed(() => {
  const node = directoryPreviewNode.value
  if (!node) return ''
  const md = normalizeMd(node.contentMd)
  if (!md.trim()) return ''
  return marked.parse(md) as string
})

function setWorkspaceMode(mode: WorkspaceMode) {
  workspaceMode.value = mode
  if (mode === 'note') noteEditing.value = false
}

watch(workspaceMode, (mode) => emit('layoutMode', mode), { immediate: true })

function setKnowledgeNoteViewMode(mode: NoteViewMode) {
  noteViewMode.value = mode
  noteEditing.value = false
}

function openRename() {
  if (!currentNode.value) return
  nodeModal.value = { mode: 'rename', nodeId: currentNode.value.id }
}

function openMove() {
  if (!currentNode.value) return
  if (!store.canMoveKnowledgeNode(currentNode.value.id)) {
    window.alert('基础一级节点不支持移动')
    return
  }
  const opts = store.getKnowledgeMoveTargetOptions(currentNode.value.id)
  if (!opts.length) {
    window.alert('暂无可移动到的目标节点')
    return
  }
  nodeModal.value = { mode: 'move', nodeId: currentNode.value.id }
}

function openCreateChild() {
  if (!currentNode.value) return
  const fallback = `${currentNode.value.title || '新知识点'}补充`
  nodeModal.value = {
    mode: 'create-child',
    parentId: currentNode.value.id,
    fallbackTitle: fallback,
  }
}

function openAddQuestion() {
  if (!currentNode.value) return
  emit('openAddForNode', currentNode.value.id)
}

function openDirectoryNode(nodeId: string) {
  directoryPreviewId.value = nodeId
}

function openPopupEditor() {
  if (!currentNode.value) return
  showNoteEditor.value = true
}

function startEdit() {
  draftMd.value = noteContent.value
  noteEditing.value = true
}

function saveEdit() {
  if (!currentNode.value) return
  store.updateKnowledgeNode(currentNode.value.id, { contentMd: draftMd.value })
  noteEditing.value = false
}

function cancelEdit() {
  noteEditing.value = false
  draftMd.value = noteContent.value
}

defineExpose({ startEdit })
</script>

<template>
  <div v-if="!currentNode" class="knowledge-workspace-empty">
    暂时还没有知识点内容，先录入错题后会自动生成结构。
  </div>
  <div
    v-else
    class="knowledge-workspace-shell"
    :class="{
      'knowledge-workspace-list-mode': workspaceMode === 'list',
      'knowledge-workspace-note-mode': workspaceMode === 'note',
    }"
  >
    <div class="knowledge-workspace-shell-header">
      <div class="knowledge-workspace-shell-meta">
        <div class="knowledge-workspace-shell-title">{{ currentNode.title }}</div>
        <div v-if="pathText && pathText !== currentNode.title" class="knowledge-workspace-shell-path">
          {{ pathText }}
        </div>
        <div class="knowledge-workspace-node-actions">
          <button type="button" class="btn btn-sm btn-secondary" @click="openPopupEditor">弹窗编辑</button>
          <button type="button" class="btn btn-sm btn-secondary" @click="openRename">重命名</button>
          <button type="button" class="btn btn-sm btn-secondary" @click="openMove">移动</button>
          <button type="button" class="btn btn-sm btn-secondary" @click="openCreateChild">+ 新建下级</button>
          <button type="button" class="btn btn-sm btn-secondary" @click="openAddQuestion">+ 新建题目</button>
        </div>
      </div>
      <div class="knowledge-workspace-shell-actions">
        <div class="knowledge-workspace-mode-switch">
          <button
            type="button"
            class="btn btn-sm"
            :class="workspaceMode === 'list' ? 'btn-primary' : 'btn-secondary'"
            @click="setWorkspaceMode('list')"
          >
            题目
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="workspaceMode === 'note' ? 'btn-primary' : 'btn-secondary'"
            @click="setWorkspaceMode('note')"
          >
            笔记
          </button>
        </div>
        <div v-if="workspaceMode === 'list'" class="knowledge-workspace-sort-tools">
          <span class="knowledge-workspace-sort-label">排序</span>
          <select
            class="knowledge-workspace-sort-select"
            :value="store.errorSortBy"
            @change="store.setErrorSortBy(($event.target as HTMLSelectElement).value)"
          >
            <option value="created_at">创建时间</option>
            <option value="wrong_count">错题次数</option>
          </select>
          <button type="button" class="btn btn-sm btn-secondary" @click="store.toggleErrorSortOrder()">
            {{ store.errorSortOrder === 'asc' ? '升序' : '降序' }}
          </button>
        </div>
        <div v-if="workspaceMode === 'note' && isTopLevel" class="knowledge-workspace-mode-switch knowledge-note-view-switch">
          <button
            type="button"
            class="btn btn-sm"
            :class="noteViewMode === 'current' ? 'btn-primary' : 'btn-secondary'"
            @click="setKnowledgeNoteViewMode('current')"
          >
            当前笔记
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="noteViewMode === 'directory' ? 'btn-primary' : 'btn-secondary'"
            @click="setKnowledgeNoteViewMode('directory')"
          >
            章节目录
          </button>
        </div>
        <span class="knowledge-workspace-count">{{ linkedCount }}题</span>
      </div>
      <div class="knowledge-workspace-shell-stats">
        <span class="knowledge-workspace-stat">直属 {{ directCount }}</span>
        <span class="knowledge-workspace-stat">含下级 {{ linkedCount }}</span>
      </div>
    </div>

    <!-- 题目模式 -->
    <div v-if="workspaceMode === 'list'" class="knowledge-workspace-list-wrap">
      <div class="knowledge-workspace-list-head">当前题目</div>
      <div class="knowledge-workspace-list">
        <ErrorCard v-for="entry in relatedErrors" :key="entry.id" :entry="entry" />
        <div v-if="!relatedErrors.length" class="knowledge-workspace-empty">
          当前知识点下还没有题目，先点「+ 新建题目」录一题。
        </div>
      </div>
    </div>

    <!-- 笔记模式：当前笔记 -->
    <div v-else-if="noteViewMode === 'current' || !isTopLevel" class="knowledge-workspace-note-wrap">
      <div class="knowledge-workspace-list-head">当前笔记</div>
      <div v-if="noteEditing" class="note-split-area">
        <div class="note-split-editor">
          <div class="note-split-label">
            编辑
            <button type="button" class="note-done-btn" @click="saveEdit">完成</button>
          </div>
          <textarea
            v-model="draftMd"
            class="note-md-textarea"
            placeholder="# 规则总结&#10;## 易错点&#10;- …"
            spellcheck="false"
          />
          <div class="note-btn-bar">
            <button type="button" class="btn btn-primary btn-sm" @click="saveEdit">保存</button>
            <button type="button" class="btn btn-secondary btn-sm" @click="cancelEdit">取消</button>
            <span class="save-hint">Ctrl+S 快捷保存</span>
          </div>
        </div>
        <div class="note-split-preview">
          <div class="note-split-label">预览</div>
          <div class="note-preview-scroll note-preview-frame-scroll">
            <div class="knowledge-inline-preview np-md" v-html="draftRendered" />
          </div>
        </div>
      </div>
      <div v-else class="note-preview-scroll note-preview-frame-scroll">
        <div
          v-if="renderedNote"
          class="knowledge-inline-preview np-md"
          v-html="renderedNote"
        />
        <div v-else class="knowledge-workspace-empty">
          当前节点还没有笔记，先写规则总结、易错点和下一步动作。
        </div>
      </div>
    </div>

    <!-- 笔记模式：章节目录 -->
    <div v-else class="knowledge-workspace-note-wrap knowledge-workspace-note-wrap--directory">
      <div class="knowledge-workspace-list-head">章节目录</div>
      <div v-if="!directorySections.length" class="knowledge-workspace-empty">
        当前一级节点下还没有可浏览的子章节。
      </div>
      <div v-else class="knowledge-directory-layout">
        <div class="knowledge-directory-list">
          <button
            v-for="section in directorySections"
            :key="section.nodeId"
            type="button"
            class="knowledge-directory-item"
            :class="{
              active: directoryPreviewNode?.id === section.nodeId,
              'is-structural': !section.hasContent,
            }"
            :style="{ paddingLeft: `${14 + section.depth * 18}px` }"
            @click="openDirectoryNode(section.nodeId)"
          >
            <span class="knowledge-directory-item-title">{{ section.title }}</span>
            <span class="knowledge-directory-item-meta">{{ section.childCount }}题</span>
          </button>
        </div>
        <div class="knowledge-directory-preview-wrap">
          <div class="knowledge-directory-preview-head">
            <div class="knowledge-directory-preview-title">
              {{ directoryPreviewNode?.title || '当前章节' }}
            </div>
            <div v-if="directoryPreviewNode" class="knowledge-directory-preview-path">
              {{ store.getNodePathText(directoryPreviewNode.id) }}
            </div>
          </div>
          <div class="note-preview-scroll note-preview-frame-scroll knowledge-directory-preview">
            <div
              v-if="directoryPreviewHtml"
              class="knowledge-inline-preview np-md"
              v-html="directoryPreviewHtml"
            />
            <div v-else class="knowledge-workspace-empty">请选择一个章节查看笔记。</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <KnowledgeNodeModal
    v-if="nodeModal"
    :mode="nodeModal.mode"
    :node-id="nodeModal.nodeId"
    :parent-id="nodeModal.parentId"
    :fallback-title="nodeModal.fallbackTitle"
    @close="nodeModal = null"
    @done="nodeModal = null"
  />
  <KnowledgeNoteEditorModal
    v-if="showNoteEditor && currentNode"
    :node-id="currentNode.id"
    @close="showNoteEditor = false"
  />
</template>
