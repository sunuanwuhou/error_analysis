import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { xingceApi } from '@/api/xingce'
import type { ErrorEntry, KnowledgeNode, AttemptSummary } from '@/api/xingce'

// ── 知识树工具 ────────────────────────────────────────────────────────────────

const FIXED_ROOT_ORDER = ['言语理解与表达', '判断推理', '数量关系', '资料分析', '常识判断', '其他']

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

  // 按 order 字段排序子节点，根节点按固定顺序
  const sortChildren = (nodes: KnowledgeNode[], isRoot = false) => {
    nodes.sort((a, b) => {
      if (isRoot) {
        const ai = FIXED_ROOT_ORDER.indexOf(a.title)
        const bi = FIXED_ROOT_ORDER.indexOf(b.title)
        const av = ai === -1 ? 999 : ai
        const bv = bi === -1 ? 999 : bi
        if (av !== bv) return av - bv
      }
      return (a.order ?? 0) - (b.order ?? 0)
    })
    nodes.forEach(n => n.children && sortChildren(n.children))
  }
  sortChildren(roots, true)
  return roots
}

/** 收集节点及所有子孙的 id */
function collectDescendantIds(node: KnowledgeNode): string[] {
  const ids: string[] = [node.id]
  for (const c of node.children ?? []) {
    ids.push(...collectDescendantIds(c))
  }
  return ids
}

/** 在树中找节点 */
function findNodeInTree(nodes: KnowledgeNode[], id: string): KnowledgeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNodeInTree(n.children ?? [], id)
    if (found) return found
  }
  return null
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useXingceStore = defineStore('xingce', () => {
  // ── 原始数据 ────────────────────────────────────────────────────────────────
  const errors = ref<ErrorEntry[]>([])
  const knowledgeNodes = ref<KnowledgeNode[]>([])
  const notesByType = ref<Record<string, unknown>>({})
  const noteImages = ref<Record<string, string>>({})

  // ── 加载状态 ────────────────────────────────────────────────────────────────
  const loading = ref(false)
  const saving = ref(false)
  const loadError = ref<string | null>(null)
  const lastSavedAt = ref<string | null>(null)

  // ── 练习统计缓存 ─────────────────────────────────────────────────────────────
  const practiceSummaries = ref<Record<string, AttemptSummary | null>>({})
  let _summaryLoadTimer: ReturnType<typeof setTimeout> | null = null
  const _pendingSummaryIds = new Set<string>()

  // ── 练习面板状态 ─────────────────────────────────────────────────────────────
  const quizBadge = ref(0)          // 今日训练题数
  const reviewBadge = ref(0)        // 待复盘题数
  const retrainBadge = ref(0)       // 待复训题数
  const todayDone = ref(0)          // 今日已练
  const todayTotal = ref(0)         // 今日计划总数
  const practiceLoading = ref(false)

  // ── 筛选状态 ────────────────────────────────────────────────────────────────
  const activeType = ref<string | null>(null)
  const activeNodeId = ref<string | null>(null)
  const statusFilter = ref<'all' | 'focus' | 'review' | 'mastered'>('all')
  const taskFilter = ref<'all' | 'diagnose' | 'review_ready' | 'retrain'>('all')
  const reasonFilter = ref<string | null>(null)
  const dateFrom = ref('')
  const dateTo = ref('')
  const searchQuery = ref('')

  // ── 知识树 UI 状态 ──────────────────────────────────────────────────────────
  const knowledgeExpandedIds = ref<Set<string>>(new Set())
  const knowledgeTreeSearch = ref('')
  const knowledgeFocusMode = ref(false)

  // ── 计算属性 ────────────────────────────────────────────────────────────────
  const knowledgeTree = computed(() => buildTree(knowledgeNodes.value))

  /** 每个节点直接挂载的非掌握错题数 */
  const errorCountByNode = computed(() => {
    const counts: Record<string, number> = {}
    for (const e of errors.value) {
      if (e.noteNodeId && e.status !== 'mastered') {
        counts[e.noteNodeId] = (counts[e.noteNodeId] ?? 0) + 1
      }
    }
    return counts
  })

  /** 每个节点（含所有子孙）的非掌握错题聚合数 */
  const errorCountByNodeAgg = computed(() => {
    const direct = errorCountByNode.value
    const agg: Record<string, number> = {}

    function walk(node: KnowledgeNode): number {
      const own = direct[node.id] ?? 0
      const childSum = (node.children ?? []).reduce((sum, c) => sum + walk(c), 0)
      agg[node.id] = own + childSum
      return agg[node.id]
    }

    knowledgeTree.value.forEach(root => walk(root))
    return agg
  })

  const filteredErrors = computed(() => {
    let list = errors.value

    // 任务阶段筛选（workflowStage）
    if (taskFilter.value !== 'all') {
      list = list.filter(e => {
        const stage = String(e.workflowStage ?? '')
        if (taskFilter.value === 'diagnose')    return stage === 'captured' || stage === 'diagnosing'
        if (taskFilter.value === 'review_ready') return stage === 'review_ready'
        if (taskFilter.value === 'retrain')      return stage === 'retrain_due'
        return true
      })
    }

    // 知识节点筛选（含子孙）
    if (activeNodeId.value) {
      const node = findNodeInTree(knowledgeTree.value, activeNodeId.value)
      const ids = node ? new Set(collectDescendantIds(node)) : new Set([activeNodeId.value])
      list = list.filter(e => e.noteNodeId != null && ids.has(e.noteNodeId))
    } else if (activeType.value) {
      list = list.filter(e => e.type === activeType.value)
    }

    if (statusFilter.value !== 'all') {
      list = list.filter(e => e.status === statusFilter.value)
    }

    // 错因筛选
    if (reasonFilter.value) {
      const r = reasonFilter.value
      list = list.filter(e => {
        const reason = String(e.rootReason ?? e.errorReason ?? '').trim()
        return reason === r
      })
    }

    // 日期范围（addDate 字段，格式 YYYY-MM-DD）
    if (dateFrom.value) {
      list = list.filter(e => e.addDate != null && String(e.addDate) >= dateFrom.value)
    }
    if (dateTo.value) {
      list = list.filter(e => e.addDate != null && String(e.addDate) <= dateTo.value)
    }

    if (searchQuery.value.trim()) {
      // 多关键词 AND 匹配（空格分隔）
      const terms = searchQuery.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
      list = list.filter(e => {
        const text = [
          e.question, e.options, e.analysis,
          e.type, e.subtype, e.subSubtype,
          e.errorReason, e.rootReason, e.tip,
        ].filter(Boolean).join(' ').toLowerCase()
        return terms.every(t => text.includes(t))
      })
    }

    return list
  })

  /** 各任务阶段的错题数量（全量，不受其他筛选影响） */
  const taskCounts = computed(() => {
    const counts = { diagnose: 0, review_ready: 0, retrain: 0 }
    for (const e of errors.value) {
      const stage = String(e.workflowStage ?? '')
      if (stage === 'captured' || stage === 'diagnosing') counts.diagnose++
      else if (stage === 'review_ready') counts.review_ready++
      else if (stage === 'retrain_due') counts.retrain++
    }
    return counts
  })

  /** 当前数据中出现的错因列表（含计数，降序） */
  const reasonOptions = computed(() => {
    const map = new Map<string, number>()
    for (const e of errors.value) {
      const r = String(e.rootReason ?? e.errorReason ?? '').trim()
      if (r) map.set(r, (map.get(r) ?? 0) + 1)
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count }))
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

  const totalCountByType = computed(() => {
    const counts: Record<string, number> = {}
    for (const e of errors.value) {
      counts[e.type] = (counts[e.type] ?? 0) + 1
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

  let _saveTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleSave() {
    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(() => flushSave(), 2000)
  }

  async function flushSave() {
    if (saving.value) return
    saving.value = true
    try {
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
    activeType.value = null
  }

  function toggleKnowledgeNode(id: string) {
    if (knowledgeExpandedIds.value.has(id)) {
      knowledgeExpandedIds.value.delete(id)
    } else {
      knowledgeExpandedIds.value.add(id)
    }
    // 触发响应式更新
    knowledgeExpandedIds.value = new Set(knowledgeExpandedIds.value)
  }

  function expandKnowledgeNode(id: string) {
    if (!knowledgeExpandedIds.value.has(id)) {
      knowledgeExpandedIds.value = new Set([...knowledgeExpandedIds.value, id])
    }
  }

  /** 加载练习面板数据（badge 计数、今日进度） */
  async function loadPracticePanel() {
    if (practiceLoading.value) return
    practiceLoading.value = true
    try {
      const [wb, daily] = await Promise.all([
        xingceApi.getWorkbench(12),
        xingceApi.getDaily(12),
      ])
      quizBadge.value = (daily.items ?? []).length
      reviewBadge.value = (wb.reviewQueue ?? []).length
      retrainBadge.value = (wb.retrainQueue ?? []).length
      const done = daily.practicedTodayCount ?? 0
      const remaining = (daily.items ?? []).length
      todayDone.value = done
      todayTotal.value = done + remaining
    } catch {
      // 静默失败
    } finally {
      practiceLoading.value = false
    }
  }

  /** 批量加载练习统计，只请求缓存中没有的 id，防抖 80ms */
  function queuePracticeSummaries(ids: string[]) {
    const missing = ids.filter(id => !Object.prototype.hasOwnProperty.call(practiceSummaries.value, id))
    if (!missing.length) return
    missing.forEach(id => _pendingSummaryIds.add(id))
    if (_summaryLoadTimer) return
    _summaryLoadTimer = setTimeout(async () => {
      _summaryLoadTimer = null
      const batch = [..._pendingSummaryIds]
      _pendingSummaryIds.clear()
      if (!batch.length) return
      try {
        const res = await xingceApi.getAttemptSummaries(batch)
        const next = { ...practiceSummaries.value }
        batch.forEach(id => { next[id] = res.items[id] ?? null })
        practiceSummaries.value = next
      } catch {
        // 静默失败，下次触发时重试
      }
    }, 80)
  }

  function clearFilters() {
    activeType.value = null
    activeNodeId.value = null
    statusFilter.value = 'all'
    taskFilter.value = 'all'
    reasonFilter.value = null
    dateFrom.value = ''
    dateTo.value = ''
    searchQuery.value = ''
  }

  return {
    // 数据
    errors,
    knowledgeNodes,
    notesByType,
    noteImages,
    // 加载状态
    loading,
    saving,
    loadError,
    lastSavedAt,
    // 筛选
    activeType,
    activeNodeId,
    statusFilter,
    taskFilter,
    reasonFilter,
    dateFrom,
    dateTo,
    searchQuery,
    // 知识树 UI
    knowledgeExpandedIds,
    knowledgeTreeSearch,
    knowledgeFocusMode,
    // 练习统计
    practiceSummaries,
    queuePracticeSummaries,
    // 练习面板
    quizBadge,
    reviewBadge,
    retrainBadge,
    todayDone,
    todayTotal,
    practiceLoading,
    loadPracticePanel,
    // 计算
    knowledgeTree,
    filteredErrors,
    errorCountByType,
    totalCountByType,
    errorCountByNode,
    errorCountByNodeAgg,
    taskCounts,
    reasonOptions,
    // 动作
    load,
    flushSave,
    updateError,
    deleteError,
    setActiveType,
    setActiveNode,
    toggleKnowledgeNode,
    expandKnowledgeNode,
    clearFilters,
  }
})
