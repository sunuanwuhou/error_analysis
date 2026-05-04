<script setup lang="ts">
import { useXingceStore } from '@/stores/xingceStore'
import KnowledgeTreeNode from './KnowledgeTreeNode.vue'

const store = useXingceStore()
</script>

<template>
  <div class="ktp">
    <div class="ktp-header">
      <span class="ktp-title">知识树</span>
      <button
        v-if="store.activeNodeId"
        class="ktp-clear"
        @click="store.setActiveNode(null)"
      >清除筛选</button>
    </div>
    <div v-if="!store.knowledgeTree.length" class="ktp-empty">暂无知识节点</div>
    <div v-else class="ktp-tree">
      <KnowledgeTreeNode
        v-for="node in store.knowledgeTree"
        :key="node.id"
        :node="node"
        :depth="0"
      />
    </div>
  </div>
</template>

<style scoped>
.ktp {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.ktp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.ktp-title { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }

.ktp-clear {
  font-size: 11px;
  color: #4a6cf7;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.ktp-clear:hover { text-decoration: underline; }

.ktp-tree { overflow-y: auto; flex: 1; padding: 6px 4px; }
.ktp-empty { padding: 20px; text-align: center; color: #aaa; font-size: 13px; }
</style>
