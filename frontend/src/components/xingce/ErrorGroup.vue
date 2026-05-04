<script setup lang="ts">
import { ref } from 'vue'
import type { ErrorEntry } from '@/api/xingce'
import ErrorCard from './ErrorCard.vue'

const props = defineProps<{
  groupKey: string
  label: string
  entries: ErrorEntry[]
  defaultOpen?: boolean
}>()

const open = ref(props.defaultOpen ?? true)
const renderLimit = ref(30)
const hasMore = () => props.entries.length > renderLimit.value
</script>

<template>
  <div class="eg">
    <button class="eg-header" @click="open = !open">
      <span class="eg-arrow">{{ open ? '▾' : '▸' }}</span>
      <span class="eg-label">{{ label }}</span>
      <span class="eg-count">{{ entries.length }}</span>
    </button>
    <div v-if="open" class="eg-body">
      <ErrorCard
        v-for="entry in entries.slice(0, renderLimit)"
        :key="entry.id"
        :entry="entry"
      />
      <button v-if="hasMore()" class="eg-more" @click="renderLimit += 30">
        展开更多（还有 {{ entries.length - renderLimit }} 题）
      </button>
    </div>
  </div>
</template>

<style scoped>
.eg { margin-bottom: 8px; }

.eg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: #334155;
  font-weight: 600;
  transition: background 0.1s;
}
.eg-header:hover { background: #e8eef5; }

.eg-arrow { font-size: 11px; color: #94a3b8; width: 12px; }
.eg-label { flex: 1; }
.eg-count {
  font-size: 11px;
  background: #4a6cf7;
  color: #fff;
  padding: 1px 7px;
  border-radius: 10px;
  font-weight: 500;
}

.eg-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0 0 12px;
}

.eg-more {
  align-self: flex-start;
  font-size: 12px;
  color: #4a6cf7;
  background: none;
  border: 1px dashed #c7d2fe;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
}
.eg-more:hover { background: #eef2ff; }
</style>
