<script setup lang="ts">
import { ref } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import KnowledgeTree from './KnowledgeTree.vue'

const store = useXingceStore()

const TASK_OPTIONS = [
  { value: 'all', label: '全部任务' },
  { value: 'diagnose', label: '待判因' },
  { value: 'review_ready', label: '待复盘' },
  { value: 'retrain', label: '待复训' },
] as const

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'focus', label: '重点复习' },
  { value: 'review', label: '待复习' },
  { value: 'mastered', label: '已掌握' },
] as const

const advancedOpen = ref(false)
const reasonOpen = ref(false)
const dateOpen = ref(false)
</script>

<template>
  <aside class="fs">
    <button v-if="!store.knowledgeFocusMode" class="fs-advanced-toggle" @click="advancedOpen = !advancedOpen">
      <span>高级筛选</span>
      <span>{{ advancedOpen ? '▾' : '▸' }}</span>
    </button>

    <div v-if="!store.knowledgeFocusMode && advancedOpen" class="fs-advanced-panel">
      <div v-if="store.activeFilterCrumbs.length" class="fs-breadcrumb">
        <span class="fs-bc-label">当前</span>
        <span
          v-for="c in store.activeFilterCrumbs"
          :key="c.key + c.label"
          class="fs-bc-chip"
        >
          {{ c.label }}
          <button
            type="button"
            class="fs-bc-remove"
            :title="'移除：' + c.label"
            aria-label="移除筛选"
            @click="store.removeFilterCrumb(c.key)"
          >×</button>
        </span>
      </div>

      <div class="fs-section">
        <input
          v-model="store.searchQuery"
          class="fs-search"
          placeholder="搜索题目…（空格 = AND）"
          type="search"
        />
      </div>

      <div class="fs-section">
        <div class="fs-label">任务阶段</div>
        <div class="fs-chip-row">
          <button
            v-for="opt in TASK_OPTIONS"
            :key="opt.value"
            class="fs-chip"
            :class="{ active: store.taskFilter === opt.value }"
            @click="store.setTaskFilter(opt.value)"
          >
            {{ opt.label }}
            <span class="fs-chip-badge">
              <template v-if="opt.value === 'all'">{{ store.errors.length }}</template>
              <template v-else>{{ store.taskCounts[opt.value] }}</template>
            </span>
          </button>
        </div>
      </div>

      <div class="fs-section">
        <div class="fs-label">状态</div>
        <div class="fs-chip-row">
          <button
            v-for="opt in STATUS_OPTIONS"
            :key="opt.value"
            class="fs-chip"
            :class="{ active: store.statusFilter === opt.value }"
            @click="store.setStatusFilter(opt.value)"
          >{{ opt.label }}</button>
        </div>
      </div>

      <div v-if="store.reasonOptions.length > 0" class="fs-section">
        <button class="fs-collapse-header" @click="reasonOpen = !reasonOpen">
          <span class="fs-label" style="margin:0">错因</span>
          <span class="fs-collapse-arrow">{{ reasonOpen ? '▾' : '▸' }}</span>
          <span v-if="store.reasonFilter" class="fs-active-dot" />
        </button>
        <div v-if="reasonOpen" class="fs-reason-list">
          <button
            v-for="item in store.reasonOptions.slice(0, 20)"
            :key="item.reason"
            class="fs-reason-item"
            :class="{ active: store.reasonFilter === item.reason }"
            @click="store.toggleReasonFilter(item.reason)"
          >
            <span class="fs-reason-label">{{ item.reason }}</span>
            <span class="fs-reason-count">{{ item.count }}</span>
          </button>
        </div>
      </div>

      <div class="fs-section">
        <button class="fs-collapse-header" @click="dateOpen = !dateOpen">
          <span class="fs-label" style="margin:0">加入日期</span>
          <span class="fs-collapse-arrow">{{ dateOpen ? '▾' : '▸' }}</span>
          <span v-if="store.dateFrom || store.dateTo" class="fs-active-dot" />
        </button>
        <div v-if="dateOpen" class="fs-date-row">
          <input v-model="store.dateFrom" class="fs-date-input" type="date" title="起始日期" />
          <span class="fs-date-sep">–</span>
          <input v-model="store.dateTo" class="fs-date-input" type="date" title="结束日期" />
        </div>
      </div>
    </div>

    <div class="fs-section fs-tree-section">
      <div class="fs-label">知识树</div>
      <KnowledgeTree />
    </div>
  </aside>
</template>

<style scoped>
.fs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.fs-advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 1px solid #dbe1ea;
  background: #fff;
  border-radius: 8px;
  font-size: 12px;
  color: #475569;
  padding: 6px 10px;
  cursor: pointer;
}
.fs-advanced-panel {
  border: 1px solid #e5eaf1;
  background: #fafbfd;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fs-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
  padding-bottom: 4px;
  border-bottom: 1px dashed #e2e8f0;
  margin-bottom: 2px;
}
.fs-bc-label {
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #94a3b8;
  text-transform: uppercase;
  font-size: 10px;
}
.fs-bc-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: #eef2ff;
  color: #4338ca;
  padding: 2px 4px 2px 8px;
  border-radius: 4px;
  max-width: 100%;
}
.fs-bc-remove {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 4px;
}
.fs-bc-remove:hover { color: #dc2626; }
.fs-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fs-tree-section {
  flex: 1;
  min-height: 160px;
  overflow: hidden;
  border: 1px solid #e7d9c7;
  background: #fffdfa;
  border-radius: 10px;
  padding: 8px;
}
.fs-search {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}
.fs-search:focus { border-color: #4a6cf7; }
.fs-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 2px;
}
.fs-chip-row { display: flex; flex-wrap: wrap; gap: 3px; }
.fs-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 7px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  font-size: 11.5px;
  color: #475569;
}
.fs-chip.active { background: #eef2ff; border-color: #a5b4fc; color: #4a6cf7; font-weight: 600; }
.fs-chip-badge {
  font-size: 10px;
  background: #fee2e2;
  color: #dc2626;
  padding: 0 4px;
  border-radius: 6px;
  font-weight: 600;
}
.fs-collapse-header {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  padding: 0 2px;
}
.fs-collapse-arrow { font-size: 10px; color: #94a3b8; margin-left: auto; }
.fs-active-dot { width: 6px; height: 6px; border-radius: 50%; background: #4a6cf7; }
.fs-reason-list { display: flex; flex-direction: column; gap: 1px; max-height: 180px; overflow-y: auto; }
.fs-reason-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
}
.fs-reason-item.active { background: #eef2ff; color: #4a6cf7; font-weight: 600; }
.fs-reason-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-reason-count { font-size: 10px; color: #94a3b8; margin-left: 4px; }
.fs-date-row { display: flex; align-items: center; gap: 4px; }
.fs-date-input {
  flex: 1;
  min-width: 0;
  padding: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 11px;
}
.fs-date-sep { font-size: 11px; color: #94a3b8; }
</style>
