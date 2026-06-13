<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ErrorEntry } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'
import ErrorPathGroup from './ErrorPathGroup.vue'
import type { PathGroupNode } from './errorPathGroupTypes'

const props = defineProps<{ entries: ErrorEntry[] }>()
const store = useXingceStore()

const expanded = ref(new Set<string>())

function buildPathGroupTree(list: ErrorEntry[]): PathGroupNode[] {
  const root: PathGroupNode[] = []
  for (const item of list) {
    const titles = store.getErrorGroupingPathTitles(item)
    let bucket = root
    let parentKey = ''
    for (let index = 0; index < titles.length; index++) {
      const title = titles[index]!
      const groupKey = parentKey ? `${parentKey} > ${title}` : title
      let group = bucket.find(n => n.title === title)
      if (!group) {
        group = { title, key: groupKey, level: index, children: [], items: [] }
        bucket.push(group)
      }
      parentKey = groupKey
      bucket = group.children
    }
    if (!titles.length) {
      let fallback = root.find(n => n.title === '未归类')
      if (!fallback) {
        fallback = { title: '未归类', key: '未归类', level: 0, children: [], items: [] }
        root.push(fallback)
      }
      fallback.items.push(item)
      continue
    }
    let leaf = root
    let current: PathGroupNode | null = null
    for (const title of titles) {
      current = leaf.find(n => n.title === title) ?? null
      if (current) leaf = current.children
    }
    if (current) current.items.push(item)
  }
  return root
}

const groups = computed(() => buildPathGroupTree(props.entries))

function collectAllKeys(nodes: PathGroupNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    out.push(n.key)
    out.push(...collectAllKeys(n.children))
  }
  return out
}

function toggleGroup(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

function expandAll() {
  expanded.value = new Set(collectAllKeys(groups.value))
}

function collapseAll() {
  expanded.value = new Set()
}

defineExpose({ expandAll, collapseAll })

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
    <div v-if="!entries.length" class="el-empty">
      <div class="emoji">{{ store.searchQuery ? '🔍' : '📭' }}</div>
      <p>{{ store.searchQuery ? '未找到匹配题目' : '暂无错题，点击「+ 添加」' }}</p>
    </div>
    <ErrorPathGroup
      v-for="g in groups"
      :key="g.key"
      :group="g"
      :expanded="expanded"
      @toggle="toggleGroup"
    />
  </div>
</template>

<style scoped>
.el { display: flex; flex-direction: column; gap: 2px; }
.el-empty {
  text-align: center;
  color: #aaa;
  font-size: 14px;
  padding: 40px 0;
}
.el-empty .emoji { font-size: 32px; margin-bottom: 8px; }
</style>
