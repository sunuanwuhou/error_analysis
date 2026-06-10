<script setup lang="ts">
import { ref } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import KnowledgeWorkspacePanel from './KnowledgeWorkspacePanel.vue'

const store = useXingceStore()
const workspaceRef = ref<InstanceType<typeof KnowledgeWorkspacePanel> | null>(null)
const notesLayoutMode = ref<'list' | 'note'>('note')

const emit = defineEmits<{
  openImport: []
  openGlobalSearch: []
  openAddForNode: [nodeId: string]
}>()

function onClearNotes() {
  store.clearActiveKnowledgeNote()
}

function onDeleteKnowledgeNode() {
  const id = store.activeNodeId
  if (!id) return
  store.deleteKnowledgeNode(id)
}

function enterNoteEdit() {
  workspaceRef.value?.startEdit()
}

defineExpose({ enterNoteEdit })
</script>

<template>
  <div class="notes-area">
    <div class="notes-header">
      <h2>学习笔记</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-secondary" @click="emit('openGlobalSearch')">全局搜索</button>
        <button type="button" class="btn btn-secondary" @click="emit('openImport')">导入错题</button>
        <button
          type="button"
          class="btn btn-secondary del-node"
          title="删除当前选中的叶子知识点（有子节点或直属错题时不可删）"
          :disabled="!store.activeNodeId"
          @click="onDeleteKnowledgeNode"
        >
          删除知识点
        </button>
        <button type="button" class="btn btn-secondary" @click="onClearNotes">清空</button>
      </div>
    </div>
    <div
      id="notesContent"
      class="notes-content knowledge-notes-active"
      :class="{
        'knowledge-workspace-list-mode': notesLayoutMode === 'list',
        'knowledge-workspace-note-mode': notesLayoutMode === 'note',
      }"
    >
      <KnowledgeWorkspacePanel
        ref="workspaceRef"
        @layout-mode="notesLayoutMode = $event"
        @open-import="emit('openImport')"
        @open-global-search="emit('openGlobalSearch')"
        @open-add-for-node="emit('openAddForNode', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.del-node:not(:disabled) {
  border-color: #fecaca;
  color: #b91c1c;
}
.del-node:not(:disabled):hover {
  background: #fef2f2;
}
.notes-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
