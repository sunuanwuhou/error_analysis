<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { KnowledgeNode } from '@/types/workspace'

const props = defineProps<{
  node: KnowledgeNode
  selectedId: string
}>()

const emit = defineEmits<{
  select: [nodeId: string]
}>()

const expanded = ref(false)

const isSelected = computed(() => props.node.id === props.selectedId)
const hasChildren = computed(() => props.node.children.length > 0)

function containsSelected(node: KnowledgeNode, targetId: string): boolean {
  if (!targetId) return false
  if (node.id === targetId) return true
  return node.children.some((child) => containsSelected(child, targetId))
}

watch(
  () => props.selectedId,
  (value) => {
    if (containsSelected(props.node, value)) {
      expanded.value = true
    }
  },
  { immediate: true },
)

function toggle() {
  if (!hasChildren.value) return
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="tree-node">
    <div class="tree-node__row" :class="{ 'is-active': isSelected }">
      <button class="tree-node__toggle" type="button" @click="toggle">
        {{ hasChildren ? (expanded ? '-' : '+') : '*' }}
      </button>
      <button class="tree-node__label" type="button" @click="emit('select', node.id)">
        {{ node.title }}
      </button>
    </div>
    <div v-if="expanded && hasChildren" class="tree-node__children">
      <TreeNodeItem
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-id="selectedId"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
