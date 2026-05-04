<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeNode } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'

const props = defineProps<{
  node: KnowledgeNode
  depth: number
  searchKeyword?: string
}>()

const store = useXingceStore()

const isExpanded = computed(() => store.knowledgeExpandedIds.has(props.node.id))
const isActive = computed(() => store.activeNodeId === props.node.id)
const aggCount = computed(() => store.errorCountByNodeAgg[props.node.id] ?? 0)
const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0)

// 搜索匹配逻辑：自身匹配 or 子孙中有匹配
const matchesSearch = computed(() => {
  const kw = props.searchKeyword?.toLowerCase() ?? ''
  if (!kw) return true
  return nodeMatchesKeyword(props.node, kw)
})

function nodeMatchesKeyword(node: KnowledgeNode, kw: string): boolean {
  if (node.title.toLowerCase().includes(kw)) return true
  return (node.children ?? []).some(c => nodeMatchesKeyword(c, kw))
}

// 专注树：aggCount=0 且非活跃时隐藏
const isVisible = computed(() => {
  if (!matchesSearch.value) return false
  if (store.knowledgeFocusMode && aggCount.value === 0 && !isActive.value) return false
  return true
})

// 搜索时自动展开匹配的节点
const shouldExpand = computed(() => {
  const kw = props.searchKeyword?.toLowerCase() ?? ''
  if (kw && (props.node.children ?? []).some(c => nodeMatchesKeyword(c, kw))) return true
  return isExpanded.value
})

function handleClick() {
  if (isActive.value) {
    store.setActiveNode(null)
  } else {
    store.setActiveNode(props.node.id)
  }
}

function handleToggle(e: Event) {
  e.stopPropagation()
  store.toggleKnowledgeNode(props.node.id)
}
</script>

<template>
  <div v-if="isVisible" class="ktn-wrap">
    <div
      class="ktn-row"
      :class="{ active: isActive, 'depth-0': depth === 0, 'depth-1': depth === 1 }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      @click="handleClick"
    >
      <!-- 展开/折叠箭头 -->
      <span
        v-if="hasChildren"
        class="ktn-arrow"
        @click="handleToggle"
      >{{ shouldExpand ? '▾' : '▸' }}</span>
      <span v-else class="ktn-arrow-placeholder" />

      <!-- 节点标题 -->
      <span class="ktn-title">{{ node.title }}</span>

      <!-- 错题数 badge -->
      <span
        v-if="aggCount > 0"
        class="ktn-badge"
        :class="{ 'badge-warn': aggCount > 20 }"
      >{{ aggCount }}</span>
    </div>

    <!-- 子节点（递归） -->
    <div v-if="hasChildren && shouldExpand" class="ktn-children">
      <KnowledgeTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :search-keyword="searchKeyword"
      />
    </div>
  </div>
</template>

<style scoped>
.ktn-wrap {
  display: flex;
  flex-direction: column;
}

.ktn-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 4px;
  padding-bottom: 4px;
  padding-right: 8px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  user-select: none;
  transition: background 0.1s;
  min-height: 28px;
}
.ktn-row:hover { background: #f1f5f9; }
.ktn-row.active { background: #eef2ff; color: #4a6cf7; font-weight: 600; }
.ktn-row.depth-0 { font-weight: 600; color: #1e293b; font-size: 12.5px; }
.ktn-row.depth-0.active { color: #4a6cf7; }

.ktn-arrow {
  font-size: 10px;
  color: #94a3b8;
  width: 12px;
  flex-shrink: 0;
  text-align: center;
  line-height: 1;
  padding: 2px 0;
}
.ktn-arrow:hover { color: #475569; }
.ktn-arrow-placeholder { width: 12px; flex-shrink: 0; }

.ktn-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.ktn-badge {
  font-size: 10px;
  background: #e2e8f0;
  color: #64748b;
  padding: 1px 5px;
  border-radius: 8px;
  min-width: 18px;
  text-align: center;
  flex-shrink: 0;
  font-weight: 500;
}
.ktn-badge.badge-warn { background: #fff1f0; color: #cf1322; }

.ktn-children {
  display: flex;
  flex-direction: column;
}
</style>
