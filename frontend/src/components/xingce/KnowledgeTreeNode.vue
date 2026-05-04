<script setup lang="ts">
import { ref, computed } from 'vue'
import type { KnowledgeNode } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'

const props = defineProps<{
  node: KnowledgeNode
  depth?: number
}>()

const store = useXingceStore()
const open = ref(props.depth === 0)

const isActive = computed(() => store.activeNodeId === props.node.id)
const count = computed(() => store.errorCountByNode[props.node.id] ?? 0)
const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0)

function select() {
  store.setActiveNode(isActive.value ? null : props.node.id)
}
</script>

<template>
  <div class="ktn" :style="{ paddingLeft: `${(depth ?? 0) * 14}px` }">
    <div class="ktn-row" :class="{ active: isActive }" @click="select">
      <span
        v-if="hasChildren"
        class="ktn-arrow"
        @click.stop="open = !open"
      >{{ open ? '▾' : '▸' }}</span>
      <span v-else class="ktn-dot">·</span>
      <span class="ktn-title">{{ node.title }}</span>
      <span v-if="count > 0" class="ktn-count">{{ count }}</span>
    </div>
    <div v-if="open && hasChildren">
      <KnowledgeTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="(depth ?? 0) + 1"
      />
    </div>
  </div>
</template>

<style scoped>
.ktn { user-select: none; }

.ktn-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  transition: background 0.1s;
}
.ktn-row:hover { background: #f1f5f9; }
.ktn-row.active { background: #eef2ff; color: #4a6cf7; font-weight: 600; }

.ktn-arrow { font-size: 10px; color: #94a3b8; width: 12px; flex-shrink: 0; }
.ktn-dot   { font-size: 16px; color: #cbd5e1; width: 12px; flex-shrink: 0; line-height: 1; }
.ktn-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ktn-count {
  font-size: 10px;
  background: #fee2e2;
  color: #b91c1c;
  padding: 1px 5px;
  border-radius: 8px;
  flex-shrink: 0;
}
</style>
