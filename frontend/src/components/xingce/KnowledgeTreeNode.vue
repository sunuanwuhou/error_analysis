<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { KnowledgeNode } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'

const props = defineProps<{
  node: KnowledgeNode
  depth: number
}>()

const store = useXingceStore()

const renaming = ref(false)
const draftTitle = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const isExpanded = computed(() => store.knowledgeExpandedIds.has(props.node.id))
const isActive = computed(() => store.activeNodeId === props.node.id)
const aggCount = computed(() => store.errorCountByNodeAgg[props.node.id] ?? 0)
const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0)

const isVisible = computed(() => {
  if (!store.isNodeVisibleBySearch(props.node)) return false
  return true
})

// 搜索时自动展开匹配的节点
const shouldExpand = computed(() => {
  if (store.hasKnowledgeSearch() && hasChildren.value) return true
  return isExpanded.value
})

function handleClick() {
  if (!isActive.value) {
    store.setActiveNode(props.node.id)
  }
}

function handleToggle(e: Event) {
  e.stopPropagation()
  store.toggleKnowledgeNode(props.node.id)
}

async function beginRename(e: Event) {
  e.stopPropagation()
  renaming.value = true
  draftTitle.value = props.node.title
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

function cancelRename() {
  renaming.value = false
}

function commitRename() {
  if (!renaming.value) return
  const prev = props.node.title
  const next = draftTitle.value.trim()
  renaming.value = false
  if (!next || next === prev) return
  store.renameKnowledgeNode(props.node.id, next)
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

      <!-- 节点标题（双击重命名） -->
      <span
        v-if="!renaming"
        class="ktn-title"
        :title="'双击重命名'"
        @dblclick.stop="beginRename"
      >{{ node.title }}</span>
      <input
        v-else
        ref="renameInputRef"
        v-model="draftTitle"
        class="ktn-rename"
        type="text"
        @click.stop
        @keydown.enter.prevent="commitRename"
        @keydown.escape.prevent="cancelRename"
        @blur="commitRename"
      >

      <!-- 错题数 badge -->
      <span
        class="ktn-badge"
        :class="{ 'badge-warn': aggCount > 20, 'is-empty': aggCount === 0 }"
      >{{ aggCount }}</span>
    </div>

    <!-- 子节点（递归） -->
    <div v-if="hasChildren && shouldExpand" class="ktn-children">
      <KnowledgeTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
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
.ktn-rename {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  padding: 2px 6px;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  outline: none;
  color: #1e293b;
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
.ktn-badge.is-empty { visibility: hidden; }

.ktn-children {
  display: flex;
  flex-direction: column;
}
</style>
