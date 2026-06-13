<script setup lang="ts">
import { computed } from 'vue'
import ErrorCard from './ErrorCard.vue'
import type { PathGroupNode } from './errorPathGroupTypes'

const props = defineProps<{
  group: PathGroupNode
  expanded: Set<string>
}>()

const emit = defineEmits<{ toggle: [key: string] }>()

const total = computed(() => {
  function count(g: PathGroupNode): number {
    return g.items.length + g.children.reduce((s, c) => s + count(c), 0)
  }
  return count(props.group)
})

const isOpen = computed(() => {
  if (props.group.level === 0) return true
  if (props.group.level >= 3) return true
  return props.expanded.has(props.group.key)
})

const headClass = computed(() => {
  if (props.group.level === 0) return 'type-header'
  if (props.group.level === 1) return 'subtype-header'
  return 'sub2-header'
})

const wrapClass = computed(() => {
  if (props.group.level === 0) return 'type-group'
  if (props.group.level === 1) return 'subtype-group'
  return 'sub2-group'
})
</script>

<template>
  <div :class="wrapClass">
    <div :class="headClass" @click="emit('toggle', group.key)">
      <div :class="group.level === 0 ? 'type-title' : group.level === 1 ? 'subtype-title' : 'sub2-title'">
        <span
          :class="[
            group.level === 0 ? 'type-arrow' : group.level === 1 ? 'subtype-arrow' : 'sub2-arrow',
            { open: isOpen },
          ]"
        >▶</span>
        {{ group.title }}
        <span class="epg-badge">{{ total }}</span>
      </div>
    </div>
    <template v-if="isOpen">
      <ErrorCard v-for="entry in group.items" :key="entry.id" :entry="entry" />
      <ErrorPathGroup
        v-for="child in group.children"
        :key="child.key"
        :group="child"
        :expanded="expanded"
        @toggle="emit('toggle', $event)"
      />
    </template>
  </div>
</template>

<style scoped>
.type-group,
.subtype-group,
.sub2-group {
  margin-bottom: 2px;
}
.type-header,
.subtype-header,
.sub2-header {
  padding: 10px 14px;
  background: #fafafa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ebebeb;
  transition: 0.15s;
}
.subtype-header {
  padding-left: 26px;
  background: #fcfcfc;
  border-bottom-color: #f5f5f5;
}
.sub2-header {
  padding-left: 38px;
  background: #fff;
}
.type-header:hover,
.subtype-header:hover,
.sub2-header:hover {
  background: #f5f5f5;
}
.type-title,
.subtype-title,
.sub2-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}
.subtype-title { font-size: 12.5px; font-weight: 500; color: #555; }
.sub2-title { font-size: 12px; font-weight: 500; color: #666; }
.type-arrow,
.subtype-arrow,
.sub2-arrow {
  font-size: 10px;
  color: #aaa;
  transition: transform 0.2s;
  display: inline-block;
}
.type-arrow.open,
.subtype-arrow.open,
.sub2-arrow.open {
  transform: rotate(90deg);
}
.epg-badge {
  font-size: 11px;
  color: #aaa;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 500;
  margin-left: 4px;
}
</style>
