import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { xingceApi, opsToSnapshot } from '@/api/xingce'
import type { ErrorEntry, KnowledgeNode } from '@/api/xingce'

// ── 知识树工具 ────────────────────────────────────────────────────────────────

/** 把扁平节点列表组装成树（父子引用） */
function buildTree(flatNodes: KnowledgeNode[]): KnowledgeNode[] {
  const map = new Map<string, KnowledgeNode>()
  const roots: KnowledgeNode[] = []

  for (const n of flatNodes) {
    map.set(n.id, { ...n, children: [] })
  }
  for (const n of map.values()) {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children!.push(n)
    } else {
      roots.push(n)
    }
  }
  // 按 order 字段排序
  const sortChildren = (nodes: KnowledgeNode[]) => {
    nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    nodes.forEach(n => n.children && sortChildren(n.children))
  }
  sortChildren(roots)
  return roots
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useXingceStore = defineStore('xingce', () => {
  // ── 原始数据 ────────────────────────────────────────────────────────────────
  const errors = ref<ErrorEntry[]>([])
  const knowledgeNodes = ref<KnowledgeNode[]>([])   // 扁平列表
  const notesByType = ref<Record<string, unknown>>({})
  const noteImages = ref<Record<string, string>>({})

  // ── 加载状态 ────────────────────────────────────────────────────────────────
  const loading = ref(false)
  const saving = ref(false)
  const loadError = ref<string | null>(null)
  const lastSavedAt = ref<string | null>(null)

  // ── 筛选状态 ────────────────────────────────────────────────────────────────
  const activeType = ref<string | null>(null)
  const activeNodeId = ref<string | null>(null)
  const statusFilter = ref<'all' | 'unmastered' | 'learning' | 'mastered'>('all')
  const searchQuery = ref('')

  // ── 计算属性 ────────────────────────────────────────────────────────────────
  const knowledgeTree = computed(() => buildTree(knowledgeNodes.value))

  const filteredErrors = computed(() => {
    let list = errors.value

    if (activeType.value) {
      list = list.filter(e => e.type === activeType.value)
    }
    if (activeNodeId.value) {
      list = list.filter(e => e.noteNodeId === activeNodeId.value)
    }
    if (statusFilter.value !== 'all') {
      list = list.filter(e => e.status === statusFilter.value)
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      list = list.filter(e =>
        (e.question ?? '').toLowerCase().includes(q) ||
        (e.errorReason ?? '').toLowerCase().includes(q) ||
        (e.tip ?? '').toLowerCase().includes(q),
      )
    }
    return list
  })

  const errorCountByType = computed(() => {
    const counts: Record<string, number> = {}
    for (const e of errors.value) {
      if (e.status !== 'mastered') {
        counts[e.type] = (counts[e.type] ?? 0) + 1
      }
    }
    return counts
  })

  const errorCountByNode = computed(() => {
    const counts: Record<string, number> = {}
    for (const e of errors.value) {
      if (e.noteNodeId && e.status !== 'mastered') {
        counts[e.noteNodeId] = (counts[e.noteNodeId] ?? 0) + 1
      }
    }
    return counts
  })

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const snapshot = await xingceApi.load()
      errors.value = snapshot.errors
      knowledgeNodes.value = snapshot.knowledgeNodes
      notesByType.value = snapshot.notesByType
      noteImages.value = snapshot.noteImages
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : '加载失败'
    } finally {
      loading.value = false
    }
  }

  // 防抖 save timer
  let _saveTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleSave() {
    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(() => flushSave(), 2000)
  }

  async function flushSave() {
    if (saving.value) return
    saving.value = true
    try {
      // 全量重算当前状态为 ops，推送给后端
      // 注：当前实现为简化版全量推送；后续可改为增量 diff
      const snapshot = opsToSnapshot([])  // 空 ops 得到空快照
      const ops = [
        ...errors.value.map(e => ({
          op_type: 'error_upsert' as const,
          entity_id: e.id,
          payload: e,
        })),
        ...knowledgeNodes.value.map(n => ({
          op_type: 'knowledge_node_upsert' as const,
          entity_id: n.id,
          payload: n,
        })),
      ]
      void snapshot  // 暂不使用，后续增量 diff 时使用
      await xingceApi.push(ops)
      lastSavedAt.value = new Date().toISOString()
    } catch (e) {
      console.error('xingce save failed', e)
    } finally {
      saving.value = false
    }
  }

  function updateError(id: string, patch: Partial<ErrorEntry>) {
    const idx = errors.value.findIndex(e => e.id === id)
    if (idx === -1) return
    errors.value[idx] = { ...errors.value[idx], ...patch, updatedAt: new Date().toISOString() }
    scheduleSave()
  }

  function deleteError(id: string) {
    errors.value = errors.value.filter(e => e.id !== id)
    scheduleSave()
  }

  function setActiveType(type: string | null) {
    activeType.value = type
    activeNodeId.value = null
  }

  function setActiveNode(nodeId: string | null) {
    activeNodeId.value = nodeId
  }

  return {
    // 状态
    errors,
    knowledgeNodes,
    notesByType,
    noteImages,
    loading,
    saving,
    loadError,
    lastSavedAt,
    // 筛选
    activeType,
    activeNodeId,
    statusFilter,
    searchQuery,
    // 计算
    knowledgeTree,
    filteredErrors,
    errorCountByType,
    errorCountByNode,
    // 动作
    load,
    flushSave,
    updateError,
    deleteError,
    setActiveType,
    setActiveNode,
  }
})
