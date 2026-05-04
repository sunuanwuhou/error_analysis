<script setup lang="ts">
import { onMounted } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import FilterSidebar from '@/components/xingce/FilterSidebar.vue'
import ErrorList from '@/components/xingce/ErrorList.vue'

const store = useXingceStore()
onMounted(() => { store.load() })
</script>

<template>
  <div class="xc-workspace">
    <header class="xc-header">
      <span class="xc-logo">行测工作台</span>
      <span class="xc-count">
        {{ store.filteredErrors.length }} / {{ store.errors.length }} 题
      </span>
      <span v-if="store.saving" class="xc-save-status saving">保存中…</span>
      <span v-else-if="store.lastSavedAt" class="xc-save-status saved">已保存</span>
    </header>

    <div v-if="store.loading" class="xc-loading">
      <div class="xc-spinner" />
      <p>加载数据中…</p>
    </div>

    <div v-else-if="store.loadError" class="xc-error-state">
      <p class="xc-error-msg">{{ store.loadError }}</p>
      <button class="xc-btn" @click="store.load()">重试</button>
    </div>

    <div v-else class="xc-body">
      <FilterSidebar />
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
  min-height: 100vh;
  background: #f5f6f8;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
}

.xc-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  font-size: 15px;
}

.xc-logo {
  font-weight: 600;
  color: #1a1a1a;
}

.xc-save-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
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
  padding: 16px;
  gap: 16px;
}

.xc-main {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}

.xc-count {
  font-size: 13px;
  color: #888;
}
</style>
