<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import { xingceApi } from '@/api/xingce'
import type { ErrorEntry, KnowledgeNode } from '@/api/xingce'
import LocalBackupModal from './LocalBackupModal.vue'
import DashboardModal from './DashboardModal.vue'

const emit = defineEmits<{
  openImport: []
  randomNote: []
  openMarkdownEditor: []
  openHistory: []
  openTypeRules: []
}>()

const store = useXingceStore()
const open = ref(false)
const btnRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

function toggle() { open.value = !open.value }

function closeOnOutside(e: MouseEvent) {
  if (!open.value) return
  if (!btnRef.value?.contains(e.target as Node) && !menuRef.value?.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', closeOnOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', closeOnOutside))

// ── 功能 ──────────────────────────────────────────────────────────────────────

function exportJson() {
  open.value = false
  const payload = {
    exportTime: new Date().toISOString(),
    version: '2',
    errors: store.errors,
    knowledgeNodes: store.knowledgeNodes,
  }
  const data = JSON.stringify(payload, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const day = new Date().toISOString().slice(0, 10)
  a.download = `xingce_backup_${day}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function exportKnowledgeTreeSnapshot() {
  open.value = false
  type Row = { id: string; parentId: string; level: number; title: string; path: string }
  const rows: Row[] = []
  function walk(nodes: KnowledgeNode[], parentPath: string[]) {
    for (const node of nodes) {
      const pathTitles = [...parentPath, String(node.title || '')]
      rows.push({
        id: String(node.id || ''),
        parentId: node.parentId ? String(node.parentId) : '',
        level: Number(node.level || 0),
        title: String(node.title || ''),
        path: pathTitles.filter(Boolean).join(' > '),
      })
      const kids = node.children
      if (kids?.length) walk(kids as KnowledgeNode[], pathTitles)
    }
  }
  walk(store.knowledgeTree, [])
  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'vue-xingce-workspace',
    rootCount: store.knowledgeTree.length,
    nodeCount: rows.length,
    roots: store.knowledgeTree.map(n => ({ id: n.id, title: n.title })),
    nodes: rows,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `knowledge_tree_snapshot_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function cloudSave() {
  open.value = false
  await store.flushSave()
  alert('已同步到云端')
}

function cloudLoad() {
  open.value = false
  if (confirm('重新从云端加载数据？本地未保存的更改将丢失。')) {
    store.load()
  }
}

async function cloudFullSave() {
  open.value = false
  const payload = {
    exportTime: new Date().toISOString(),
    errors: store.errors,
    knowledgeNodes: store.knowledgeNodes,
  }
  await xingceApi.putCloudBackup(payload as Record<string, unknown>)
  alert('云端全量备份完成')
}

async function cloudFullLoad() {
  open.value = false
  if (!confirm('全量从云端同步会覆盖本地，继续吗？')) return
  const data = await xingceApi.getCloudBackup()
  const backup = (data.backup ?? data.payload ?? {}) as Record<string, unknown>
  const errors = (backup.errors as unknown[]) ?? []
  const knowledgeNodes = (backup.knowledgeNodes as unknown[]) ?? (backup.knowledge_nodes as unknown[]) ?? []
  if (!errors.length && !knowledgeNodes.length) {
    alert('云端暂无可用全量数据')
    return
  }
  store.replaceWorkspaceSnapshot(errors as ErrorEntry[], knowledgeNodes as KnowledgeNode[])
  await store.flushSave()
  await store.load()
  alert('云端全量已同步到本地')
}

function printList() {
  open.value = false
  window.print()
}

const ccText = computed(() => {
  const list = store.filteredErrors.slice(0, 20)
  return list.map((e, i) => `${i + 1}. [${e.type}/${e.subtype}] ${String(e.question || '').slice(0, 80)}`).join('\n')
})

async function sendToCC() {
  open.value = false
  const text = ccText.value || '暂无内容'
  try {
    await navigator.clipboard.writeText(text)
    alert('已复制到剪贴板，可直接发给 CC')
  } catch {
    alert(text)
  }
}

function clearCurrentModuleErrors() {
  open.value = false
  const scope = store.resolveClearModuleScope()
  if (!scope) {
    window.alert('请先选择知识点或题型，或使用状态 / 错因 / 搜索 / 日期筛选后再清空（仅有任务阶段筛选时不能清空范围）。')
    return
  }
  if (!scope.ids.length) {
    window.alert(`在「${scope.label}」下没有可清空的错题`)
    return
  }
  if (!confirm(`确定删除「${scope.label}」内的 ${scope.ids.length} 条错题？不可撤销。`)) return
  store.clearErrorsByFilter(scope.ids)
}

function clearAllErrors() {
  open.value = false
  if (!confirm('清空全部标准错题？Claude bank 等非 error 条目将保留。此操作不可恢复。')) return
  store.clearAllErrors()
}

function resetAllStudyData() {
  open.value = false
  if (!confirm('重置全部学习数据（状态/掌握度/练习轨迹）？')) return
  store.resetAllStudyFields()
}

function openMarkdownNote() {
  open.value = false
  emit('openMarkdownEditor')
}

const showStats = ref(false)
const showLocalBackups = ref(false)

function openStats() {
  open.value = false
  showStats.value = true
}

</script>

<template>
  <div ref="btnRef" class="more-menu" :class="{ open }">
    <button type="button" class="btn btn-secondary" @click="toggle">更多</button>

    <div ref="menuRef" class="more-menu-panel">
      <button type="button" class="btn btn-secondary" @click="() => { open = false; emit('openImport') }">导入错题</button>
      <button type="button" class="btn btn-secondary" @click="() => { open = false; emit('randomNote') }">随机笔记</button>
      <button type="button" class="btn btn-secondary" @click="exportJson">导出</button>
      <button type="button" class="btn btn-secondary" @click="exportKnowledgeTreeSnapshot">导出知识树快照</button>
      <button type="button" class="btn btn-secondary" @click="() => { open = false; showLocalBackups = true }">备份数据列表</button>
      <button type="button" class="btn btn-secondary" @click="cloudFullSave">从本地到云端全量</button>
      <button type="button" class="btn btn-secondary" @click="cloudFullLoad">全量从云端同步（覆盖本地）</button>
      <button type="button" class="btn btn-secondary" @click="sendToCC">发给CC</button>
      <button type="button" class="btn btn-secondary" @click="openMarkdownNote">Markdown备注（专业）</button>
      <button type="button" class="btn btn-secondary" @click="() => { open = false; emit('openHistory') }">学习历史</button>
      <button type="button" class="btn btn-secondary" @click="() => { open = false; emit('openTypeRules') }">题型规则</button>
      <button type="button" class="btn btn-secondary" @click="openStats">学习统计</button>
      <button type="button" class="btn btn-secondary" @click="printList">打印</button>
      <details class="more-menu-advanced">
        <summary>高级数据</summary>
        <div class="more-menu-advanced-body">
          <button type="button" class="btn btn-secondary" @click="clearCurrentModuleErrors">清空当前模块</button>
          <button type="button" class="btn btn-secondary" @click="clearAllErrors">清空全部错题</button>
          <button type="button" class="btn btn-secondary" @click="resetAllStudyData">重置全部学习数据</button>
        </div>
      </details>
      <button type="button" class="btn btn-secondary" @click="cloudSave">Cloud Save（增量）</button>
      <button type="button" class="btn btn-secondary" @click="cloudLoad">Cloud Load（增量）</button>
    </div>
  </div>

  <LocalBackupModal v-if="showLocalBackups" @close="showLocalBackups = false" />
  <DashboardModal v-if="showStats" @close="showStats = false" />
</template>

<style scoped>
.more-menu {
  position: relative;
  flex: 1;
}
.more-menu-advanced {
  padding: 2px 6px;
  font-size: 12px;
  color: #64748b;
}
.more-menu-advanced summary {
  cursor: pointer;
  user-select: none;
}
.more-menu-advanced-body {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
