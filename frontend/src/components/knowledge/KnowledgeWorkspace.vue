<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import ErrorCard from '@/components/errors/ErrorCard.vue'
import { useSyncStore } from '@/stores/sync'
import { useWorkspaceStore } from '@/stores/workspace'
import type { KnowledgeNode } from '@/types/workspace'

const emit = defineEmits<{
  'open-create': []
  'open-transfer': []
}>()

const workspaceStore = useWorkspaceStore()
const syncStore = useSyncStore()

const draft = ref('')
const editingNote = ref(false)
const statusMessage = ref('')
const movingNode = ref(false)
const moveTargetId = ref('')
const notePreviewScrollRef = ref<HTMLElement | null>(null)

const currentNode = computed(() => workspaceStore.selectedKnowledgeNode)
const childNodes = computed(() => currentNode.value?.children || [])
const nodeTitle = computed(() => currentNode.value?.title || '全局笔记')
const hasParent = computed(() => Boolean(currentNode.value?.parentId))
const visibleErrors = computed(() => workspaceStore.visibleErrors)
const filteredErrors = computed(() => workspaceStore.filteredErrors)

const directCount = computed(() =>
  visibleErrors.value.filter((item) => String(item.noteNodeId || '') === workspaceStore.selectedKnowledgeNodeId).length,
)

const linkedCount = computed(() => {
  const selectedIds = new Set(workspaceStore.selectedNodeIds)
  return visibleErrors.value.filter((item) => selectedIds.has(String(item.noteNodeId || ''))).length
})

const directRelatedErrors = computed(() => {
  const selectedId = String(workspaceStore.selectedKnowledgeNodeId || '')
  if (!selectedId) return filteredErrors.value
  return filteredErrors.value.filter((item) => String(item.noteNodeId || '') === selectedId)
})

const descendantRelatedErrors = computed(() => {
  const selectedId = String(workspaceStore.selectedKnowledgeNodeId || '')
  const selectedIds = new Set(workspaceStore.selectedNodeIds)
  if (!selectedId || selectedIds.size <= 1) return []
  return filteredErrors.value.filter((item) => {
    const noteNodeId = String(item.noteNodeId || '')
    return noteNodeId !== selectedId && selectedIds.has(noteNodeId)
  })
})

const filteredCount = computed(() => directRelatedErrors.value.length)

interface TocItem {
  id: string
  text: string
  level: number
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function applyInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function splitTableRow(row: string) {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

function isTableDivider(row: string) {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  if (!trimmed) return false
  return trimmed.split('|').every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
}

function buildNoteRender(markdown: string) {
  const lines = markdown.replace(/\r/g, '').split('\n')
  const blocks: string[] = []
  const toc: TocItem[] = []
  let paragraph: string[] = []
  let listKind: 'ul' | 'ol' | null = null
  let listItems: string[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
  let headingIndex = 0

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(`<p>${paragraph.map((line) => applyInlineMarkdown(line)).join('<br/>')}</p>`)
    paragraph = []
  }

  const flushList = () => {
    if (!listKind || !listItems.length) return
    blocks.push(`<${listKind}>${listItems.join('')}</${listKind}>`)
    listKind = null
    listItems = []
  }

  const flushCodeBlock = () => {
    if (!codeLines.length) return
    blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    codeLines = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (line.startsWith('```')) {
      flushParagraph()
      flushList()
      if (inCodeBlock) {
        flushCodeBlock()
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(rawLine)
      continue
    }

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const nextLine = lines[index + 1]?.trim() || ''
    if (line.includes('|') && isTableDivider(nextLine)) {
      flushParagraph()
      flushList()
      const headers = splitTableRow(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length) {
        const rowLine = lines[index].trim()
        if (!rowLine || !rowLine.includes('|')) {
          index -= 1
          break
        }
        rows.push(splitTableRow(rowLine))
        index += 1
      }
      blocks.push(
        `<div class="knowledge-note-table-wrap"><table><thead><tr>${headers
          .map((cell) => `<th>${applyInlineMarkdown(cell)}</th>`)
          .join('')}</tr></thead><tbody>${rows
          .map(
            (cells) =>
              `<tr>${headers
                .map((_, cellIndex) => `<td>${applyInlineMarkdown(cells[cellIndex] || '')}</td>`)
                .join('')}</tr>`,
          )
          .join('')}</tbody></table></div>`,
      )
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      headingIndex += 1
      const id = `knowledge-note-heading-${headingIndex}`
      const level = heading[1].length
      toc.push({ id, text: heading[2], level })
      const tag = Math.min(level + 1, 4)
      blocks.push(`<h${tag} id="${id}">${applyInlineMarkdown(heading[2])}</h${tag}>`)
      continue
    }

    if (/^>\s+/.test(line)) {
      flushParagraph()
      flushList()
      blocks.push(`<blockquote>${applyInlineMarkdown(line.replace(/^>\s+/, ''))}</blockquote>`)
      continue
    }

    const unordered = line.match(/^[-*]\s+(.+)$/)
    if (unordered) {
      flushParagraph()
      if (listKind !== 'ul') {
        flushList()
        listKind = 'ul'
      }
      listItems.push(`<li>${applyInlineMarkdown(unordered[1])}</li>`)
      continue
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/)
    if (ordered) {
      flushParagraph()
      if (listKind !== 'ol') {
        flushList()
        listKind = 'ol'
      }
      listItems.push(`<li>${applyInlineMarkdown(ordered[1])}</li>`)
      continue
    }

    if (/^---+$/.test(line)) {
      flushParagraph()
      flushList()
      blocks.push('<hr/>')
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  flushCodeBlock()

  return {
    html: blocks.join(''),
    toc,
  }
}

function findPath(nodes: KnowledgeNode[], nodeId: string, trail: string[] = []): string[] {
  for (const node of nodes) {
    const nextTrail = [...trail, node.title]
    if (node.id === nodeId) return nextTrail
    const childTrail = findPath(node.children, nodeId, nextTrail)
    if (childTrail.length) return childTrail
  }
  return []
}

function isDescendant(node: KnowledgeNode, targetId: string): boolean {
  return node.children.some((child) => child.id === targetId || isDescendant(child, targetId))
}

const pathText = computed(() => {
  if (!currentNode.value) return '未选择知识点'
  return findPath(workspaceStore.knowledgeTree, currentNode.value.id).join(' > ')
})

const noteRender = computed(() => buildNoteRender(draft.value))
const notePreviewHtml = computed(() => noteRender.value.html)
const noteTocItems = computed(() => noteRender.value.toc)

const moveTargetOptions = computed(() => {
  const selectedNode = currentNode.value
  if (!selectedNode) return []
  return workspaceStore.knowledgeNodes
    .filter((node) => node.id !== selectedNode.id && !isDescendant(selectedNode, node.id))
    .map((node) => ({
      id: node.id,
      path: findPath(workspaceStore.knowledgeTree, node.id).join(' > '),
    }))
})

watch(
  () => workspaceStore.selectedNodeNote,
  (value) => {
    draft.value = value || ''
    editingNote.value = false
    movingNode.value = false
    statusMessage.value = ''
    void nextTick(() => {
      notePreviewScrollRef.value?.scrollTo({ top: 0, behavior: 'auto' })
    })
  },
  { immediate: true },
)

watch(
  () => moveTargetOptions.value,
  (options) => {
    if (!options.length) {
      moveTargetId.value = ''
      return
    }
    if (!options.some((item) => item.id === moveTargetId.value)) {
      moveTargetId.value = options[0].id
    }
  },
  { immediate: true },
)

function handleSave() {
  const updatedNode = workspaceStore.updateSelectedKnowledgeNote(draft.value)
  if (updatedNode) {
    syncStore.enqueueOp('knowledge_node_upsert', updatedNode.id, updatedNode)
    statusMessage.value = `已保存“${updatedNode.title}”的笔记。`
  } else {
    workspaceStore.updateGlobalNote(draft.value)
    syncStore.enqueueOp('setting_upsert', 'global_note', { key: 'global_note', value: draft.value })
    statusMessage.value = '已保存全局笔记。'
  }
  editingNote.value = false
}

function handleCreateChild() {
  const title = window.prompt('新知识点名称')
  if (!title) return
  const created = workspaceStore.createKnowledgeChild(title)
  if (created) {
    syncStore.enqueueOp('knowledge_node_upsert', created.id, created)
    statusMessage.value = `已新建知识点“${created.title}”。`
    return
  }
  statusMessage.value = '新建失败：名称为空，或同级已经有同名知识点。'
}

function handleRename() {
  const current = workspaceStore.selectedKnowledgeNode?.title || ''
  const title = window.prompt('重命名知识点', current)
  if (!title) return
  const updated = workspaceStore.renameSelectedKnowledgeNode(title)
  if (updated) {
    syncStore.enqueueOp('knowledge_node_upsert', updated.id, updated)
    statusMessage.value = `已重命名为“${updated.title}”。`
    return
  }
  statusMessage.value = '重命名失败：名称为空，或同级已经有同名知识点。'
}

function handleMove() {
  if (!moveTargetId.value) {
    statusMessage.value = '没有可移动到的目标节点。'
    return
  }
  const moved = workspaceStore.moveSelectedKnowledgeNode(moveTargetId.value)
  if (!moved) {
    statusMessage.value = '移动失败，请确认不是移动到自己、下级节点或根节点。'
    return
  }
  syncStore.enqueueOp('knowledge_node_upsert', moved.id, moved)
  movingNode.value = false
  statusMessage.value = `已移动到“${findPath(workspaceStore.knowledgeTree, moved.parentId).join(' > ')}”。`
}

function handleDelete() {
  if (!workspaceStore.selectedKnowledgeNode) return
  const confirmed = window.confirm(
    `确认删除知识点“${workspaceStore.selectedKnowledgeNode.title}”吗？直属题目会改挂到父节点，下级知识点会整体上提。`,
  )
  if (!confirmed) return

  const result = workspaceStore.deleteSelectedKnowledgeNode()
  if (!result) {
    statusMessage.value = '根节点暂不支持删除。'
    return
  }

  syncStore.enqueueOp('knowledge_node_delete', result.ids[0], { id: result.ids[0] })
  syncStore.enqueueOps([
    ...result.movedNodes.map((item) => ({
      opType: 'knowledge_node_upsert',
      entityId: item.id,
      payload: item,
    })),
    ...result.movedErrors.map((item) => ({
      opType: 'error_upsert',
      entityId: item.id,
      payload: item,
    })),
  ])

  statusMessage.value = '已删除当前知识点，并把直属题目与下级节点接回父节点。'
}

function jumpToChild(nodeId: string) {
  workspaceStore.selectKnowledgeNode(nodeId)
}

function openCreateQuestion() {
  emit('open-create')
}

function openImportPanel() {
  emit('open-transfer')
}

function startEditNote() {
  editingNote.value = true
}

function toggleEditNote() {
  if (editingNote.value) {
    handleSave()
    return
  }
  startEditNote()
}

function scrollToHeading(id: string) {
  if (typeof document === 'undefined') return
  const target = document.getElementById(id)
  if (!target) return
  const scrollContainer = notePreviewScrollRef.value
  if (!scrollContainer) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }

  const containerRect = scrollContainer.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const nextTop = scrollContainer.scrollTop + targetRect.top - containerRect.top - 16

  scrollContainer.scrollTo({
    top: Math.max(nextTop, 0),
    behavior: 'smooth',
  })
}

function handleEditorKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    handleSave()
  }
}
</script>

<template>
  <section class="knowledge-workspace-shell">
    <section class="panel notes-area knowledge-notes-panel">
      <div class="knowledge-workspace-bar">
        <div class="knowledge-workspace-meta">
          <div class="note-page-breadcrumb">{{ pathText }}</div>
          <div class="knowledge-workspace-title">{{ nodeTitle }}</div>
          <div class="knowledge-page-meta">
            <span class="knowledge-page-pill">直属 {{ directCount }}</span>
            <span class="knowledge-page-pill">含下级 {{ linkedCount }}</span>
            <span class="knowledge-page-pill">当前展示 {{ filteredCount }}</span>
            <span class="knowledge-page-pill">子节点 {{ childNodes.length }}</span>
          </div>
        </div>

        <div class="knowledge-page-actions">
          <button class="ghost-button ghost-button--small" type="button" @click="toggleEditNote">
            {{ editingNote ? '完成编辑' : '编辑笔记' }}
          </button>

          <details class="note-more-menu">
            <summary class="ghost-button ghost-button--small">更多</summary>
            <div class="note-more-menu-panel">
              <button class="ghost-button ghost-button--small" type="button" @click="handleRename">重命名</button>
              <button
                v-if="hasParent"
                class="ghost-button ghost-button--small"
                type="button"
                @click="movingNode = !movingNode"
              >
                {{ movingNode ? '取消移动' : '移动节点' }}
              </button>
              <button class="ghost-button ghost-button--small" type="button" @click="handleCreateChild">新建下级</button>
              <button class="ghost-button ghost-button--small" type="button" @click="openCreateQuestion">录入题目</button>
              <button class="ghost-button ghost-button--small" type="button" @click="openImportPanel">导入 JSON</button>
              <button
                class="ghost-button ghost-button--small"
                :disabled="!hasParent"
                type="button"
                @click="handleDelete"
              >
                删除节点
              </button>
            </div>
          </details>
        </div>
      </div>

      <div class="notes-content knowledge-notes-content">
        <div v-if="childNodes.length" class="knowledge-children-bar">
          <button
            v-for="child in childNodes"
            :key="child.id"
            class="knowledge-node-pill"
            type="button"
            @click="jumpToChild(child.id)"
          >
            {{ child.title }}
          </button>
        </div>

        <div class="knowledge-node-hint">录题和导入会默认归到当前知识点。</div>

        <div v-if="movingNode" class="knowledge-workspace__move-panel">
          <div>
            <div class="knowledge-workspace__section-title">移动到哪个父节点</div>
            <div class="panel__subtle">不会移动到自己或自己的下级，也不会保留同级同名冲突。</div>
          </div>
          <div class="knowledge-workspace__move-controls">
            <select v-model="moveTargetId" class="editor-input knowledge-workspace__move-select">
              <option v-for="option in moveTargetOptions" :key="option.id" :value="option.id">
                {{ option.path }}
              </option>
            </select>
            <button class="ghost-button ghost-button--small" type="button" @click="handleMove">确认移动</button>
          </div>
        </div>

        <div v-if="statusMessage" class="transfer-message knowledge-status-message">{{ statusMessage }}</div>

        <div v-if="editingNote" class="note-split-area">
          <div class="note-split-editor">
            <div class="note-split-label">编辑</div>
            <textarea
              v-model="draft"
              class="note-md-textarea knowledge-editor__textarea"
              rows="18"
              placeholder="# 规则总结&#10;## 易错点&#10;- ...&#10;&#10;## 下一步动作&#10;- ..."
              @keydown="handleEditorKeydown"
            />
            <div class="note-btn-bar">
              <button class="ghost-button ghost-button--small" type="button" @click="handleSave">保存</button>
              <button class="ghost-button ghost-button--small" type="button" @click="editingNote = false">取消</button>
              <span class="save-hint">Ctrl + S 快捷保存</span>
            </div>
          </div>

          <div class="note-split-preview">
            <div class="note-split-label">预览</div>
            <div ref="notePreviewScrollRef" class="note-preview-scroll notes-content">
              <div v-if="draft.trim()" class="note-preview-layout" :class="{ 'note-preview-layout-no-toc': !noteTocItems.length }">
                <article class="note-preview-article knowledge-note-preview__rich" v-html="notePreviewHtml" />
                <aside v-if="noteTocItems.length" class="note-preview-toc">
                  <div class="note-toc note-toc-floating">
                    <div class="note-toc-title">笔记目录</div>
                    <div class="note-toc-list">
                      <button
                        v-for="item in noteTocItems"
                        :key="item.id"
                        class="note-toc-item"
                        :class="`lv${item.level + 1}`"
                        type="button"
                        @click="scrollToHeading(item.id)"
                      >
                        {{ item.text }}
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
              <div v-else class="panel__empty">还没有笔记，先把规则、坑点和下一步动作写下来。</div>
            </div>
          </div>
        </div>

        <div v-else class="note-split-area">
          <div class="note-split-preview note-split-preview--single">
            <div class="note-split-label">当前笔记</div>
            <div ref="notePreviewScrollRef" class="note-preview-scroll notes-content">
              <div v-if="draft.trim()" class="note-preview-layout" :class="{ 'note-preview-layout-no-toc': !noteTocItems.length }">
                <article class="note-preview-article knowledge-note-preview__rich" v-html="notePreviewHtml" />
                <aside v-if="noteTocItems.length" class="note-preview-toc">
                  <div class="note-toc note-toc-floating">
                    <div class="note-toc-title">笔记目录</div>
                    <div class="note-toc-list">
                      <button
                        v-for="item in noteTocItems"
                        :key="item.id"
                        class="note-toc-item"
                        :class="`lv${item.level + 1}`"
                        type="button"
                        @click="scrollToHeading(item.id)"
                      >
                        {{ item.text }}
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
              <div v-else class="knowledge-note-empty">
                <div class="knowledge-note-empty__title">还没有笔记</div>
                <p class="panel__subtle">先记规则和坑点，再继续刷题。</p>
                <div class="knowledge-note-empty__actions">
                  <button class="ghost-button ghost-button--small" type="button" @click="startEditNote">编辑笔记</button>
                  <button class="ghost-button ghost-button--small" type="button" @click="openCreateQuestion">录入题目</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section v-if="directRelatedErrors.length || descendantRelatedErrors.length" class="knowledge-related-inline">
          <div class="knowledge-related-inline__header">
            <h3>当前知识点题目</h3>
            <span class="panel__count">{{ directRelatedErrors.length }}</span>
          </div>
          <div v-if="directRelatedErrors.length" class="knowledge-related-inline__list">
            <ErrorCard v-for="item in directRelatedErrors" :key="item.id" :item="item" />
          </div>
          <div v-else class="knowledge-related-inline__empty">当前节点下还没有直属题目。</div>
          <div v-if="descendantRelatedErrors.length" class="knowledge-related-inline__tip">
            下级知识点还有 {{ descendantRelatedErrors.length }} 道题，切到对应子节点查看。
          </div>
        </section>
      </div>
    </section>
  </section>
</template>
