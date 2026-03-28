<script setup lang="ts">
import { computed } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import type { ErrorEntry } from '@/types/workspace'

const props = defineProps<{
  items: ErrorEntry[]
}>()

const workspaceStore = useWorkspaceStore()

function topCounts(getter: (item: ErrorEntry) => string, limit = 8) {
  const map = new Map<string, number>()
  for (const item of props.items) {
    const key = getter(item)
    if (!key) continue
    map.set(key, (map.get(key) || 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

const topKnowledgeNodes = computed(() =>
  topCounts((item) => workspaceStore.knowledgeNodes.find((node) => node.id === item.noteNodeId)?.title || '', 6),
)
</script>

<template>
  <section class="panel stats-panel">
    <header class="panel__header">
      <h2>统计</h2>
      <span class="panel__count">{{ items.length }}</span>
    </header>

    <div v-if="items.length" class="stats-grid">
      <article class="stats-box">
        <h3>高频题型</h3>
        <div v-for="[name, count] in topCounts((item) => item.type || '未分类', 6)" :key="name" class="stats-row">
          <span>{{ name }}</span>
          <strong>{{ count }}</strong>
        </div>
      </article>

      <article class="stats-box">
        <h3>高频错因</h3>
        <div
          v-for="[name, count] in topCounts((item) => item.rootReason || item.errorReason || '', 6)"
          :key="name"
          class="stats-row"
        >
          <span>{{ name }}</span>
          <strong>{{ count }}</strong>
        </div>
      </article>

      <article class="stats-box">
        <h3>知识点挂载</h3>
        <div v-for="[name, count] in topKnowledgeNodes" :key="name" class="stats-row">
          <span>{{ name }}</span>
          <strong>{{ count }}</strong>
        </div>
      </article>
    </div>

    <div v-else class="panel__empty">还没有足够数据可统计。</div>
  </section>
</template>
