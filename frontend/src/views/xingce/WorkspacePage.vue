<script setup lang="ts">
import { onMounted } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'

const store = useXingceStore()

onMounted(() => {
  store.load()
})
</script>

<template>
  <div class="xc-workspace">
    <!-- 顶部导航 -->
    <header class="xc-header">
      <span class="xc-logo">行测工作台</span>
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

    <!-- 主体（Phase 1+ 组件将挂载在这里） -->
    <main v-else class="xc-main">
      <!-- Phase 0 临时占位，后续各 Phase 替换 -->
      <div class="xc-placeholder">
        <div class="xc-stats">
          <span class="xc-stat-item">错题总数：<strong>{{ store.errors.length }}</strong></span>
          <span class="xc-stat-item">未掌握：<strong>{{ store.errors.filter(e => e.status === 'unmastered').length }}</strong></span>
          <span class="xc-stat-item">知识节点：<strong>{{ store.knowledgeNodes.length }}</strong></span>
        </div>
        <p class="xc-hint">Phase 0 验证通过 — 数据加载正常，接下来将逐步渲染组件</p>
      </div>
    </main>
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

.xc-main {
  flex: 1;
  padding: 24px;
}

.xc-placeholder {
  background: #fff;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  border: 2px dashed #d9d9d9;
}

.xc-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 16px;
}

.xc-stat-item {
  font-size: 14px;
  color: #666;
}
.xc-stat-item strong {
  font-size: 24px;
  color: #4a6cf7;
  margin-left: 4px;
}

.xc-hint {
  font-size: 13px;
  color: #aaa;
  margin: 0;
}
</style>
