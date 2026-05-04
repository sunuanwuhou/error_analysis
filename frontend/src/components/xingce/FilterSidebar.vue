<script setup lang="ts">
import { useXingceStore } from '@/stores/xingceStore'

const store = useXingceStore()

const TYPES = ['言语理解与表达', '判断推理', '数量关系', '资料分析', '常识判断', '其他']

const STATUS_OPTIONS = [
  { value: 'all',      label: '全部' },
  { value: 'focus',    label: '重点复习' },
  { value: 'review',   label: '待复习' },
  { value: 'mastered', label: '已掌握' },
] as const
</script>

<template>
  <aside class="fs">
    <!-- 搜索 -->
    <div class="fs-section">
      <input
        v-model="store.searchQuery"
        class="fs-search"
        placeholder="搜索题目…"
        type="search"
      />
    </div>

    <!-- 大类筛选 -->
    <div class="fs-section">
      <div class="fs-label">题型</div>
      <button
        class="fs-item"
        :class="{ active: store.activeType === null }"
        @click="store.setActiveType(null)"
      >
        <span class="fs-item-name">全部</span>
        <span class="fs-item-count">{{ store.errors.length }}</span>
      </button>
      <button
        v-for="t in TYPES"
        :key="t"
        class="fs-item"
        :class="{ active: store.activeType === t }"
        @click="store.setActiveType(t)"
      >
        <span class="fs-item-name">{{ t }}</span>
        <span
          v-if="store.errorCountByType[t]"
          class="fs-item-count"
          :class="{ 'count-warn': (store.errorCountByType[t] ?? 0) > 20 }"
        >{{ store.errorCountByType[t] }}</span>
      </button>
    </div>

    <!-- 状态筛选 -->
    <div class="fs-section">
      <div class="fs-label">状态</div>
      <button
        v-for="opt in STATUS_OPTIONS"
        :key="opt.value"
        class="fs-item"
        :class="{ active: store.statusFilter === opt.value }"
        @click="store.statusFilter = opt.value"
      >
        <span class="fs-item-name">{{ opt.label }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.fs {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fs-search {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}
.fs-search:focus { border-color: #4a6cf7; }

.fs-section { display: flex; flex-direction: column; gap: 2px; }

.fs-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 4px;
  margin-bottom: 4px;
}

.fs-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  text-align: left;
  transition: background 0.1s;
}
.fs-item:hover { background: #f1f5f9; }
.fs-item.active { background: #eef2ff; color: #4a6cf7; font-weight: 600; }

.fs-item-name { flex: 1; }
.fs-item-count {
  font-size: 11px;
  background: #e2e8f0;
  color: #64748b;
  padding: 1px 6px;
  border-radius: 8px;
  min-width: 20px;
  text-align: center;
}
.count-warn { background: #fff1f0; color: #cf1322; }
</style>
