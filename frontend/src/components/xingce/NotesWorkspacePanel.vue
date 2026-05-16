<script setup lang="ts">
import { ref } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import NotesPanel from './NotesPanel.vue'

const store = useXingceStore()
const notesPanelRef = ref<InstanceType<typeof NotesPanel> | null>(null)

const emit = defineEmits<{
  openImport: []
  openGlobalSearch: []
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
  notesPanelRef.value?.startEdit()
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
    <div class="notes-content">
      <NotesPanel ref="notesPanelRef" />
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
.notes-content :deep(.np) {
  border-radius: 8px;
  flex: 1;
  min-height: 0;
}
</style>
