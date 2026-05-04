<script setup lang="ts">
import { computed } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'

const store = useXingceStore()

const activeNode = computed(() => {
  if (!store.activeNodeId) return null
  return store.knowledgeNodes.find(n => n.id === store.activeNodeId) ?? null
})

const noteContent = computed<string>(() => {
  if (!store.activeNodeId) return ''
  // 尝试从 notesByType 中获取（knowledge_node 笔记存在 knowledgeNotes 里）
  const fromNotes = (store.notesByType as Record<string, unknown>)[store.activeNodeId]
  if (fromNotes && typeof fromNotes === 'string') return fromNotes
  if (fromNotes && typeof fromNotes === 'object') {
    const v = (fromNotes as Record<string, unknown>).content
    if (typeof v === 'string') return v
  }
  return ''
})
</script>

<template>
  <div class="np">
    <div v-if="!store.activeNodeId" class="np-empty">
      <p>点击知识树节点查看笔记</p>
    </div>
    <template v-else>
      <div class="np-header">
        <span class="np-node-title">{{ activeNode?.title ?? store.activeNodeId }}</span>
        <span v-if="store.errorCountByNode[store.activeNodeId]" class="np-count">
          {{ store.errorCountByNode[store.activeNodeId] }} 题
        </span>
      </div>
      <div class="np-body">
        <pre v-if="noteContent" class="np-content">{{ noteContent }}</pre>
        <p v-else class="np-no-note">该节点暂无笔记</p>
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
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}
.np-node-title { font-weight: 600; font-size: 14px; color: #1e293b; flex: 1; }
.np-count {
  font-size: 11px;
  background: #fee2e2;
  color: #b91c1c;
  padding: 1px 6px;
  border-radius: 8px;
}

/* 关键：用 CSS 高度链控制滚动，不用 JS 计算高度 */
.np-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.np-content {
  font-family: inherit;
  font-size: 13px;
  line-height: 1.8;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.np-no-note { color: #aaa; font-size: 13px; margin: 0; }
</style>
