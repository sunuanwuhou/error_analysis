<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import FilterSidebar from '@/components/xingce/FilterSidebar.vue'
import PracticePanel from '@/components/xingce/PracticePanel.vue'
import ErrorList from '@/components/xingce/ErrorList.vue'

const store = useXingceStore()

onMounted(() => { store.load() })

/** 当前筛选的面包屑描述 */
const filterDesc = computed(() => {
  const parts: string[] = []
  if (store.activeNodeId) {
    // 找节点标题
    function findTitle(nodes: typeof store.knowledgeTree, id: string): string | null {
      for (const n of nodes) {
        if (n.id === id) return n.title
        const found = findTitle(n.children ?? [], id)
        if (found) return found
      }
      return null
    }
    const title = findTitle(store.knowledgeTree, store.activeNodeId)
    if (title) parts.push(title)
  }
  if (store.taskFilter !== 'all') {
    const tmap: Record<string, string> = { diagnose: '待判因', review_ready: '待复盘', retrain: '待复训' }
    parts.push(tmap[store.taskFilter] ?? store.taskFilter)
  }
  if (store.statusFilter !== 'all') {
    const map: Record<string, string> = { focus: '重点复习', review: '待复习', mastered: '已掌握' }
    parts.push(map[store.statusFilter] ?? store.statusFilter)
  }
  if (store.reasonFilter) parts.push(`错因: ${store.reasonFilter}`)
  if (store.dateFrom || store.dateTo) {
    parts.push(`${store.dateFrom || '…'} ~ ${store.dateTo || '…'}`)
  }
  if (store.searchQuery.trim()) parts.push(`"${store.searchQuery.trim()}"`)
  return parts.join(' · ')
})
</script>

<template>
  <div class="xc-workspace">
    <!-- Header -->
    <header class="xc-header">
      <span class="xc-logo">行测工作台</span>
      <span class="xc-count">
        <template v-if="filterDesc">
          <span class="xc-filter-desc">{{ filterDesc }}</span>
          <span class="xc-sep">·</span>
        </template>
        {{ store.filteredErrors.length }} / {{ store.errors.length }} 题
      </span>
      <button
        v-if="store.activeNodeId || store.statusFilter !== 'all' || store.taskFilter !== 'all' || store.reasonFilter || store.dateFrom || store.dateTo || store.searchQuery"
        class="xc-clear-btn"
        @click="store.clearFilters()"
      >清除筛选</button>
      <span v-if="store.saving" class="xc-save-status saving">保存中…</span>
      <span v-else-if="store.lastSavedAt" class="xc-save-status saved">已保存</span>
    </header>

    <!-- 加载中 -->
    <div v-if="store.loading" class="xc-loading">
      <div class="xc-spinner" />
      <p>加载数据中…</p>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="store.loadError" class="xc-error-state">
      <p class="xc-error-msg">{{ store.loadError }}</p>
      <button class="xc-btn" @click="store.load()">重试</button>
    </div>

    <!-- 主体 -->
    <div v-else class="xc-body">
      <!-- 左侧栏：练习面板 + 筛选/知识树 -->
      <div class="xc-sidebar">
        <PracticePanel @start-quiz="() => {}" @start-random-note="() => {}" />
        <div class="xc-sidebar-divider" />
        <FilterSidebar />
      </div>
      <main class="xc-main">
        <ErrorList :entries="store.filteredErrors" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.xc-workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f6f8;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  overflow: hidden;
}

.xc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  font-size: 14px;
  flex-shrink: 0;
}

.xc-logo {
  font-weight: 700;
  color: #1a1a1a;
  font-size: 15px;
}

.xc-count {
  font-size: 12px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 6px;
}

.xc-filter-desc {
  color: #4a6cf7;
  font-weight: 500;
}

.xc-sep { color: #ccc; }

.xc-clear-btn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
}
.xc-clear-btn:hover { background: #f1f5f9; color: #1e293b; }

.xc-save-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: auto;
}
.xc-save-status.saving { background: #fff7e6; color: #d46b08; }
.xc-save-status.saved  { background: #f6ffed; color: #389e0d; }

.xc-loading,
.xc-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  color: #666;
  font-size: 14px;
}

.xc-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e8e8e8;
  border-top-color: #4a6cf7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.xc-error-msg { color: #cf1322; }

.xc-btn {
  padding: 6px 16px;
  background: #4a6cf7;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.xc-btn:hover { background: #3a5ce5; }

.xc-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 14px;
  gap: 14px;
  min-height: 0;
}

.xc-sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  overflow-x: hidden;
}

.xc-sidebar-divider {
  height: 1px;
  background: #e2e8f0;
  flex-shrink: 0;
}

.xc-main {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}
</style>
