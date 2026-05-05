<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import { useXingceStore } from '@/stores/xingceStore'

marked.setOptions({ gfm: true, breaks: true })

const store = useXingceStore()
const editing = ref(false)
const draftMd = ref('')

const activeNode = computed(() => {
  if (!store.activeNodeId) return null
  return store.knowledgeNodes.find(n => n.id === store.activeNodeId) ?? null
})

const noteContent = computed<string>(() => {
  if (!store.activeNodeId) return ''
  const node = activeNode.value as Record<string, unknown> | null
  const md = node?.contentMd
  if (typeof md === 'string' && md.trim()) return md
  const fromNotes = (store.notesByType as Record<string, unknown>)[store.activeNodeId]
  if (fromNotes && typeof fromNotes === 'string') return fromNotes
  if (fromNotes && typeof fromNotes === 'object') {
    const v = (fromNotes as Record<string, unknown>).content
    if (typeof v === 'string') return v
  }
  const nt = node?.noteContent
  if (typeof nt === 'string' && nt.trim()) return nt
  return ''
})

const pathLine = computed(() => {
  if (!store.activeNodeId) return ''
  return store.getNodePathText(store.activeNodeId)
})

const renderedNote = computed(() => {
  const raw = noteContent.value
  if (!String(raw).trim()) return ''
  return marked.parse(raw) as string
})

const draftRendered = computed(() => {
  const raw = draftMd.value
  if (!String(raw).trim()) {
    return '<p class="np-ph">预览将显示在此</p>'
  }
  return marked.parse(raw) as string
})

watch(
  () => store.activeNodeId,
  () => {
    editing.value = false
    draftMd.value = noteContent.value
  },
)

watch(noteContent, (v) => {
  if (!editing.value) draftMd.value = v
})

function startEdit() {
  draftMd.value = noteContent.value
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  draftMd.value = noteContent.value
}

function saveEdit() {
  if (!store.activeNodeId) return
  store.updateKnowledgeNode(store.activeNodeId, { contentMd: draftMd.value })
  editing.value = false
}

defineExpose({ startEdit })
</script>

<template>
  <div class="np">
    <div v-if="!store.activeNodeId" class="np-empty">
      <p>点击知识树节点查看笔记</p>
    </div>
    <template v-else>
      <div class="np-header">
        <div class="np-title-block">
          <span class="np-node-title">{{ activeNode?.title ?? store.activeNodeId }}</span>
          <span v-if="pathLine" class="np-path">{{ pathLine }}</span>
        </div>
        <span v-if="store.errorCountByNode[store.activeNodeId]" class="np-count">
          {{ store.errorCountByNode[store.activeNodeId] }} 题
        </span>
        <div class="np-actions">
          <button v-if="!editing" type="button" class="np-btn" @click="startEdit">编辑笔记</button>
          <template v-else>
            <button type="button" class="np-btn primary" @click="saveEdit">保存</button>
            <button type="button" class="np-btn" @click="cancelEdit">取消</button>
          </template>
        </div>
      </div>
      <div class="np-body" :class="{ 'np-body--edit': editing }">
        <div v-if="editing" class="np-edit-split">
          <div class="np-edit-pane">
            <div class="np-edit-label">Markdown</div>
            <textarea
              v-model="draftMd"
              class="np-editor"
              placeholder="# 规则总结&#10;## 易错点&#10;- …"
              spellcheck="false"
            />
          </div>
          <div class="np-edit-pane np-edit-preview">
            <div class="np-edit-label">预览</div>
            <div class="np-content np-md np-md-preview" v-html="draftRendered" />
          </div>
        </div>
        <template v-else>
          <div
            v-if="noteContent"
            class="np-content np-md"
            v-html="renderedNote"
          />
          <p v-else class="np-no-note">该节点暂无笔记，点击「编辑笔记」开始记录</p>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.np {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  min-width: 0;
}

.np-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #aaa;
  font-size: 14px;
}
.np-empty p { margin: 0; }

.np-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.np-title-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.np-node-title { font-weight: 600; font-size: 14px; color: #1e293b; }
.np-path {
  font-size: 11px;
  color: #64748b;
  line-height: 1.35;
  word-break: break-word;
}
.np-count {
  font-size: 11px;
  background: #fee2e2;
  color: #b91c1c;
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
}
.np-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
}
.np-btn {
  border: 1px solid #d9dee5;
  background: #fff;
  color: #475569;
  border-radius: 6px;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
}
.np-btn:hover { background: #f8fafc; }
.np-btn.primary {
  background: #4a6cf7;
  border-color: #4a6cf7;
  color: #fff;
}
.np-btn.primary:hover { filter: brightness(1.05); }

.np-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 120px;
}
.np-body--edit {
  display: flex;
  flex-direction: column;
  min-height: 280px;
  overflow: hidden;
}

.np-edit-split {
  display: flex;
  flex: 1;
  gap: 12px;
  min-height: 0;
  align-items: stretch;
}
@media (max-width: 720px) {
  .np-edit-split {
    flex-direction: column;
  }
}
.np-edit-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}
.np-edit-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.np-edit-preview {
  overflow: hidden;
}
.np-md-preview {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafafa;
  min-height: 180px;
}
.np-ph {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
}

.np-editor {
  width: 100%;
  flex: 1;
  min-height: 200px;
  box-sizing: border-box;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #334155;
  resize: vertical;
}

.np-content {
  font-family: inherit;
  font-size: 13px;
  line-height: 1.8;
  color: #334155;
  word-break: break-word;
  margin: 0;
}
.np-no-note { color: #aaa; font-size: 13px; margin: 0; }

.np-md :deep(h1) { font-size: 1.35em; margin: 0.6em 0 0.35em; font-weight: 700; color: #1e293b; }
.np-md :deep(h2) { font-size: 1.2em; margin: 0.55em 0 0.3em; font-weight: 650; color: #1e293b; }
.np-md :deep(h3) { font-size: 1.08em; margin: 0.5em 0 0.25em; font-weight: 600; color: #334155; }
.np-md :deep(p) { margin: 0.45em 0; }
.np-md :deep(ul), .np-md :deep(ol) { margin: 0.4em 0 0.4em 1.2em; padding: 0; }
.np-md :deep(li) { margin: 0.2em 0; }
.np-md :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.25em 0 0.25em 0.75em;
  border-left: 3px solid #cbd5e1;
  color: #475569;
}
.np-md :deep(code) {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.92em;
  background: #f1f5f9;
  padding: 0.1em 0.35em;
  border-radius: 4px;
}
.np-md :deep(pre) {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  font-size: 12px;
}
.np-md :deep(pre code) { background: none; padding: 0; }
.np-md :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
  margin: 0.5em 0;
}
.np-md :deep(th), .np-md :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 6px 8px;
}
.np-md :deep(th) { background: #f8fafc; }
</style>
