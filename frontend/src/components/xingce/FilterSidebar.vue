<script setup lang="ts">
import { computed } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import KnowledgeTree from './KnowledgeTree.vue'

const store = useXingceStore()

const searchMetaText = computed(() => {
  if (!store.hasKnowledgeSearch()) return '支持按节点名和路径搜索'
  const count = store.visibleKnowledgeNodeCount
  return count > 0 ? `命中 ${count} 个节点` : '未找到匹配节点'
})

function clearTreeSearch() {
  store.knowledgeTreeSearch = ''
}
</script>

<template>
  <div class="sidebar-tree-toolbar">
    <div class="sidebar-tree-toolbar-row">
      <div class="sidebar-tree-search">
        <span class="search-icon">搜索</span>
        <input
          v-model="store.knowledgeTreeSearch"
          type="search"
          placeholder="搜索知识树节点..."
          autocomplete="off"
        />
        <button
          v-if="store.knowledgeTreeSearch"
          type="button"
          class="search-clear"
          aria-label="清空知识树搜索"
          @click="clearTreeSearch"
        >×</button>
      </div>
      <button
        type="button"
        class="btn btn-secondary"
        @click="store.knowledgeFocusMode = !store.knowledgeFocusMode"
      >
        {{ store.knowledgeFocusMode ? '退出专注' : '专注树' }}
      </button>
    </div>
    <div class="sidebar-tree-search-meta">{{ searchMetaText }}</div>
  </div>

  <div class="nav-scroll">
    <KnowledgeTree hide-toolbar />
  </div>
</template>
