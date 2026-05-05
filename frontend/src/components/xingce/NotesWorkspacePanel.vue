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
  <div class="nwp">
    <div class="nwp-notes-header">
      <h2 class="nwp-h2">学习笔记</h2>
      <div class="nwp-actions">
        <button type="button" class="nwp-btn" @click="emit('openGlobalSearch')">全局搜索</button>
        <button type="button" class="nwp-btn" @click="emit('openImport')">导入错题</button>
        <button type="button" class="nwp-btn" @click="onClearNotes">清空</button>
        <button
          type="button"
          class="nwp-btn nwp-btn-danger"
          title="删除当前选中的叶子知识点（有子节点或直属错题时不可删）"
          :disabled="!store.activeNodeId"
          @click="onDeleteKnowledgeNode"
        >
          删除知识点
        </button>
      </div>
    </div>
    <div class="nwp-body">
      <NotesPanel ref="notesPanelRef" />
    </div>
  </div>
</template>

<style scoped>
.nwp {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  background: #fff;
  border: 1px solid #e8e8e8;
  overflow: hidden;
}
.nwp-notes-header {
  padding: 14px 18px;
  border-bottom: 1px solid #e8e8e8;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.nwp-h2 {
  font-size: 17px;
  margin: 0;
  color: #2c3e50;
  letter-spacing: 0.2px;
}
.nwp-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.nwp-btn {
  border: 1px solid #d9dee5;
  background: #fff;
  color: #475569;
  border-radius: 8px;
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
}
.nwp-btn:hover { background: #f8fafc; }
.nwp-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.nwp-btn-danger {
  border-color: #fecaca;
  color: #b91c1c;
}
.nwp-btn-danger:hover:not(:disabled) {
  background: #fef2f2;
}

.nwp-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}
.nwp-body :deep(.np) {
  border-radius: 8px;
  flex: 1;
  min-height: 0;
}
</style>
