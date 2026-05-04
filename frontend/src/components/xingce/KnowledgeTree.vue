<script setup lang="ts">
import { computed } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import KnowledgeTreeNode from './KnowledgeTreeNode.vue'

const store = useXingceStore()

const searchKw = computed({
  get: () => store.knowledgeTreeSearch,
  set: (v) => { store.knowledgeTreeSearch = v },
})

const focusMode = computed({
  get: () => store.knowledgeFocusMode,
  set: (v) => { store.knowledgeFocusMode = v },
})

const hasActiveNode = computed(() => store.activeNodeId !== null)

function clearNodeFilter() {
  store.setActiveNode(null)
}

function clearSearch() {
  store.knowledgeTreeSearch = ''
}
</script>

<template>
  <div class="kt">
    <!-- 工具栏 -->
    <div class="kt-toolbar">
      <div class="kt-search-wrap">
        <input
          v-model="searchKw"
          class="kt-search"
          type="search"
          placeholder="搜索知识树节点…"
        />
        <button
          v-if="searchKw"
          class="kt-search-clear"
          @click="clearSearch"
        >×</button>
      </div>
      <button
        class="kt-focus-btn"
        :class="{ active: focusMode }"
        title="专注树：只显示有错题的节点"
        @click="focusMode = !focusMode"
      >专注</button>
    </div>

    <!-- 当前节点筛选提示 -->
    <div v-if="hasActiveNode" class="kt-active-hint">
      <span>已定位节点</span>
      <button class="kt-clear-node" @click="clearNodeFilter">全部</button>
    </div>

    <!-- 树体 -->
    <div class="kt-body">
      <div v-if="!store.knowledgeTree.length" class="kt-empty">暂无知识树数据</div>
      <KnowledgeTreeNode
        v-for="root in store.knowledgeTree"
        :key="root.id"
        :node="root"
        :depth="0"
        :search-keyword="searchKw"
      />
    </div>
  </div>
</template>

<style scoped>
.kt {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex: 1;
}

.kt-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kt-search-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.kt-search {
  width: 100%;
  padding: 5px 24px 5px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
  color: #1e293b;
  background: #fff;
}
.kt-search:focus { border-color: #4a6cf7; }
.kt-search::-webkit-search-cancel-button { display: none; }

.kt-search-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #94a3b8;
  padding: 0 2px;
  line-height: 1;
}
.kt-search-clear:hover { color: #475569; }

.kt-focus-btn {
  flex-shrink: 0;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.1s;
}
.kt-focus-btn:hover { background: #f1f5f9; }
.kt-focus-btn.active { background: #eef2ff; border-color: #a5b4fc; color: #4a6cf7; font-weight: 600; }

.kt-active-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #4a6cf7;
  background: #eef2ff;
  border-radius: 4px;
  padding: 3px 8px;
}

.kt-clear-node {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  color: #64748b;
  padding: 0;
  text-decoration: underline;
}
.kt-clear-node:hover { color: #1e293b; }

.kt-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.kt-empty {
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  padding: 20px 0;
}
</style>
