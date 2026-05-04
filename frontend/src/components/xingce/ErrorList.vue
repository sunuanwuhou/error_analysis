<script setup lang="ts">
import { computed, watch } from 'vue'
import type { ErrorEntry } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'
import ErrorGroup from './ErrorGroup.vue'

const props = defineProps<{ entries: ErrorEntry[] }>()
const store = useXingceStore()

interface Group { key: string; entries: ErrorEntry[] }

const groups = computed<Group[]>(() => {
  const map = new Map<string, ErrorEntry[]>()
  for (const e of props.entries) {
    const key = [e.type, e.subtype].filter(Boolean).join('|')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return [...map.entries()].map(([key, entries]) => ({ key, entries }))
})

// 每当可见列表变化时，批量加载练习统计
watch(
  () => props.entries,
  (list) => {
    const ids = list.slice(0, 120).map(e => e.id)
    store.queuePracticeSummaries(ids)
  },
  { immediate: true },
)
</script>

<template>
  <div class="el">
    <div v-if="!entries.length" class="el-empty">暂无错题</div>
    <ErrorGroup
      v-for="g in groups"
      :key="g.key"
      :group-key="g.key"
      :label="g.key.split('|').filter(Boolean).join(' › ')"
      :entries="g.entries"
      :default-open="groups.length <= 3"
    />
  </div>
</template>

<style scoped>
.el { display: flex; flex-direction: column; gap: 4px; }
.el-empty { text-align: center; color: #aaa; font-size: 14px; padding: 40px 0; }
</style>
