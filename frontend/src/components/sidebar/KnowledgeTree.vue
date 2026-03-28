<script setup lang="ts">
import type { KnowledgeNode } from '@/types/workspace'
import TreeNodeItem from './TreeNodeItem.vue'

defineProps<{
  nodes: KnowledgeNode[]
  selectedId: string
}>()

const emit = defineEmits<{
  select: [nodeId: string]
}>()
</script>

<template>
  <aside class="panel tree-panel">
    <div class="tree-panel__section-title">知识树</div>
    <div v-if="nodes.length" class="tree-list">
      <TreeNodeItem
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :selected-id="selectedId"
        @select="emit('select', $event)"
      />
    </div>
    <div v-else class="panel__empty">还没有知识树数据。</div>
  </aside>
</template>
