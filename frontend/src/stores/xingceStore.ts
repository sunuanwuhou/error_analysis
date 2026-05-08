import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { xingceApi } from '@/api/xingce'
import type { ErrorEntry, KnowledgeNode, AttemptSummary } from '@/api/xingce'

// ── 知识树工具 ────────────────────────────────────────────────────────────────

const FIXED_ROOT_ORDER = ['言语理解与表达', '判断推理', '数量关系', '资料分析', '常识判断', '其他']
const KNOWLEDGE_EXPANDED_STORAGE_KEY = 'xc_vue_knowledge_expanded_ids'
const INVALID_NODE_TITLES = new Set(['undefined', 'null', 'nan', '[object object]'])
const NOISY_ROOT_REMAP = new Map<string, string>([
  ['片段阅读', '言语理解与表达'],
  ['数字推理', '数量关系'],
  ['数学运算', '数量关系'],
  ['和差倍比', '数量关系'],
  ['核心思维纯笔记', '数量关系'],
  ['比例法', '数量关系'],
  ['混合', '数量关系'],
  ['鸡兔', '数量关系'],
  ['年龄问题', '数量关系'],
  ['容斥', '数量关系'],
  ['数列', '数量关系'],
  ['数推', '数量关系'],
  ['植树问题', '数量关系'],
  ['最不利', '数量关系'],
  ['逻辑判断', '判断推理'],
  ['物理', '常识判断'],
  ['未细分', '其他'],
  ['未分类', '其他'],
])

function normalizeKnowledgeTitleForCleanup(title: string): string {
  return String(title || '')
    .replace(/\uFEFF/g, '')
    .replace(/\u200B/g, '')
    .replace(/\u00A0/g, '')
    .replace(/[()（）【】\[\]·•,，.:：;；!?！？-]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function resolveNoisyRootAlias(title: string): string {
  return NOISY_ROOT_REMAP.get(normalizeKnowledgeTitleForCleanup(title)) || ''
}

function makeVirtualRoot(title: string, order: number): TreeNode {
  return {
    id: `__virtual_root__${title}`,
    parentId: null,
    title,
    level: 1,
    order,
    children: [],
    _mergedIds: [`__virtual_root__${title}`],
  }
}

type TreeNode = KnowledgeNode & {
  children: TreeNode[]
  _mergedIds?: string[]
}

function normalizeDisplayTitle(raw: unknown, fallback: string): string {
  const text = String(raw || '')
    .replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .trim()
  if (!text) return fallback
  const cleaned = text
    .replace(/^[“”"'‘’`]+/, '')
    .replace(/[“”"'‘’`]+$/, '')
    .trim()
  if (!cleaned) return fallback
  if (/^\?+$/.test(cleaned)) return fallback
  if (/^(?:\?{2,}|未分类\?|未细分\?|知识点\?)$/i.test(cleaned)) return fallback
  return cleaned
}

function getNodeMergedIds(node: KnowledgeNode): string[] {
  const merged = (node as TreeNode)._mergedIds
  if (!Array.isArray(merged) || merged.length === 0) return [node.id]
  return merged
}

function mergeDuplicateSiblings(nodes: TreeNode[]) {
  if (!nodes.length) return
  nodes.forEach(n => mergeDuplicateSiblings(n.children ?? []))
  const seen = new Map<string, TreeNode>()
  const next: TreeNode[] = []
  for (const node of nodes) {
    const key = normalizeKnowledgeTitleForCleanup(node.title)
    if (!key) {
      next.push(node)
      continue
    }
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, node)
      next.push(node)
      continue
    }
    const mergedIds = new Set<string>([...getNodeMergedIds(existing), ...getNodeMergedIds(node)])
    existing._mergedIds = [...mergedIds]
    existing.children = [...(existing.children ?? []), ...(node.children ?? [])]
  }
  nodes.splice(0, nodes.length, ...next)
}

function collapseSameTitleChildren(nodes: TreeNode[]) {
  nodes.forEach(node => {
    collapseSameTitleChildren(node.children ?? [])
    const normalizedSelf = normalizeKnowledgeTitleForCleanup(node.title)
    if (!normalizedSelf || !(node.children ?? []).length) return

    const remained: TreeNode[] = []
    for (const child of node.children ?? []) {
      const normalizedChild = normalizeKnowledgeTitleForCleanup(child.title)
      if (normalizedChild && normalizedChild === normalizedSelf) {
        const mergedIds = new Set<string>([...getNodeMergedIds(node), ...getNodeMergedIds(child)])
        node._mergedIds = [...mergedIds]
        remained.push(...(child.children ?? []))
        continue
      }
      remained.push(child)
    }
    node.children = remained
  })
}

function rebalanceDepth1ByAlias(roots: TreeNode[]) {
  const rootByTitle = new Map<string, TreeNode>()
  roots.forEach(root => {
    rootByTitle.set(normalizeKnowledgeTitleForCleanup(root.title), root)
  })

  for (const root of roots) {
    if (!Array.isArray(root.children) || root.children.length === 0) continue
    const remained: TreeNode[] = []
    for (const child of root.children) {
      const alias = resolveNoisyRootAlias(child.title)
      if (!alias) {
        remained.push(child)
        continue
      }
      const target = rootByTitle.get(normalizeKnowledgeTitleForCleanup(alias))
      if (!target || target.id === root.id) {
        remained.push(child)
        continue
      }
      child.parentId = target.id
      child.level = 2
      target.children = [...(target.children ?? []), child]
    }
    root.children = remained
  }
}

/** 把扁平节点列表组装成树（父子引用） */
function buildTree(flatNodes: KnowledgeNode[]): KnowledgeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // 仅清洗展示层结构，不改写原始 knowledgeNodes，避免误伤历史数据。
  for (const raw of flatNodes) {
    const id = String(raw.id || '').trim()
    const title = normalizeDisplayTitle(raw.title, '未分类')
    if (!id || !title) continue
    if (INVALID_NODE_TITLES.has(title.toLowerCase())) continue
    const parentIdRaw = raw.parentId == null ? null : String(raw.parentId).trim()
    const parentId = parentIdRaw && parentIdRaw !== id ? parentIdRaw : null
    if (map.has(id)) continue
    map.set(id, { ...raw, id, title, parentId, children: [], _mergedIds: [id] })
  }

  // 父节点已失效（引用不存在）的节点先降级为 root，再参与后续根归并。
  for (const node of map.values()) {
    if (node.parentId && !map.has(node.parentId)) {
      node.parentId = null
    }
  }

  // 旧版行为收口：
  // 1) 固定 6 根始终存在（缺失则补虚拟根，仅用于展示层）
  // 2) 脏根/重复根一律归并到目标根下，避免根层污染
  const rootByTitle = new Map<string, TreeNode>()
  for (const node of map.values()) {
    if (node.parentId) continue
    const normalized = normalizeKnowledgeTitleForCleanup(node.title)
    if (!rootByTitle.has(normalized)) {
      rootByTitle.set(normalized, node)
    }
  }
  FIXED_ROOT_ORDER.forEach((title, idx) => {
    const normalized = normalizeKnowledgeTitleForCleanup(title)
    if (!rootByTitle.has(normalized)) {
      const virtualRoot = makeVirtualRoot(title, idx)
      map.set(virtualRoot.id, virtualRoot)
      rootByTitle.set(normalized, virtualRoot)
    }
  })

  for (const node of map.values()) {
    if (node.parentId) continue
    const normalized = normalizeKnowledgeTitleForCleanup(node.title)
    const canonicalSameTitle = rootByTitle.get(normalized)
    const isFixedRootTitle = FIXED_ROOT_ORDER.some(t => normalizeKnowledgeTitleForCleanup(t) === normalized)

    // 重复固定根：只保留一个根，其余收编到 canonical 根下。
    if (isFixedRootTitle && canonicalSameTitle && canonicalSameTitle.id !== node.id) {
      node.parentId = canonicalSameTitle.id
      node.level = 2
      continue
    }

    if (isFixedRootTitle) continue

    const alias = resolveNoisyRootAlias(node.title) || '其他'
    const targetRoot = rootByTitle.get(normalizeKnowledgeTitleForCleanup(alias))
    if (targetRoot && targetRoot.id !== node.id) {
      node.parentId = targetRoot.id
      node.level = 2
    }
  }

  for (const n of map.values()) {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children!.push(n)
    } else {
      roots.push(n)
    }
  }

  // 同父同名节点合并，减少二级脏节点重复。
  rebalanceDepth1ByAlias(roots)
  mergeDuplicateSiblings(roots)
  // 折叠“父子同名”包裹层（对齐旧版 collapseDuplicateKnowledgeWrappers 思路）。
  collapseSameTitleChildren(roots)
  // 包裹层折叠后可能再次产生同级同名，补一轮去重。
  mergeDuplicateSiblings(roots)

  // 按旧版稳定排序思路：根按固定顺序；其余按 order（有值优先）+ 标题 + id。
  const sortChildren = (nodes: TreeNode[], isRoot = false) => {
    nodes.sort((a, b) => {
      if (isRoot) {
        const ai = FIXED_ROOT_ORDER.indexOf(a.title)
        const bi = FIXED_ROOT_ORDER.indexOf(b.title)
        const av = ai === -1 ? 999 : ai
        const bv = bi === -1 ? 999 : bi
        if (av !== bv) return av - bv
      }
      const ao = Number.isFinite(a.order as number) ? Number(a.order) : null
      const bo = Number.isFinite(b.order as number) ? Number(b.order) : null
      if (ao != null && bo != null && ao !== bo) return ao - bo
      if (ao != null && bo == null) return -1
      if (ao == null && bo != null) return 1
      const byTitle = String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN')
      if (byTitle !== 0) return byTitle
      return String(a.id || '').localeCompare(String(b.id || ''), 'zh-CN')
    })
    nodes.forEach(n => n.children && sortChildren(n.children as TreeNode[]))
  }
  sortChildren(roots, true)
  return roots as KnowledgeNode[]
}

/** 收集节点及所有子孙的 id */
function collectDescendantIds(node: KnowledgeNode): string[] {
  const ids: string[] = [...getNodeMergedIds(node)]
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

/** 在树中查找节点路径标题 */
function findNodePathTitles(nodes: KnowledgeNode[], id: string, parentTitles: string[] = []): string[] | null {
  for (const n of nodes) {
    const nextTitles = [...parentTitles, n.title]
    if (n.id === id) return nextTitles
    const found = findNodePathTitles(n.children ?? [], id, nextTitles)
    if (found) return found
  }
  return null
}

function isVirtualKnowledgeNodeId(id: string | null | undefined): boolean {
  return String(id || '').startsWith('__virtual_root__')
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
  /** Cloud Load 成功时间（与旧版「上次同步」对照） */
  const lastPulledAt = ref<string | null>(null)
  const currentUser = ref<{ id: string; username: string } | null>(null)

  /** 错题列表批量模式（对齐 legacy `batchMode`） */
  const batchMode = ref(false)
  const batchSelectedIds = ref<string[]>([])

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

  /** 可参与「全量练习」的题量（未掌握类） */
  const eligibleFullPracticeCount = computed(() =>
    errors.value.filter(e => e.status !== 'mastered' && e.masteryLevel !== 'mastered').length,
  )

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

  /** 每个节点直接挂载的错题数（与旧版口径一致，含 mastered） */
  const errorCountByNode = computed(() => {
    const counts: Record<string, number> = {}
    for (const e of errors.value) {
      if (e.noteNodeId) {
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
      const own = getNodeMergedIds(node).reduce((sum, id) => sum + (direct[id] ?? 0), 0)
      const childSum = (node.children ?? []).reduce((sum, c) => sum + walk(c), 0)
      agg[node.id] = own + childSum
      return agg[node.id]
    }

    knowledgeTree.value.forEach(root => walk(root))
    return agg
  })

  const knowledgeSearchTerms = computed(() =>
    String(knowledgeTreeSearch.value || '')
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean)
  )

  function hasKnowledgeSearch() {
    return knowledgeSearchTerms.value.length > 0
  }

  function getNodePathText(nodeId: string): string {
    if (!nodeId) return ''
    const titles = findNodePathTitles(knowledgeTree.value, nodeId) ?? []
    return titles.join(' ')
  }

  function isNodeSearchMatch(node: KnowledgeNode): boolean {
    const terms = knowledgeSearchTerms.value
    if (!terms.length) return false
    const text = `${node.title || ''} ${getNodePathText(node.id)}`.toLowerCase()
    return terms.every(term => text.includes(term))
  }

  function isNodeVisibleBySearch(node: KnowledgeNode): boolean {
    if (!hasKnowledgeSearch()) return true
    if (isNodeSearchMatch(node)) return true
    return (node.children ?? []).some(child => isNodeVisibleBySearch(child))
  }

  const visibleKnowledgeNodeCount = computed(() => {
    function walk(nodes: KnowledgeNode[]): number {
      return nodes.reduce((sum, node) => {
        if (!isNodeVisibleBySearch(node)) return sum
        return sum + 1 + walk(node.children ?? [])
      }, 0)
    }
    return walk(knowledgeTree.value)
  })

  /** 与旧版 `getFiltered` 搜索文本口径对齐（题目/选项/解析/知识路径/来源等） */
  function buildErrorSearchText(e: ErrorEntry): string {
    const rec = e as Record<string, unknown>
    const knowledgePath = e.noteNodeId ? getNodePathText(e.noteNodeId) : ''
    return [
      e.question,
      e.options,
      e.analysis,
      knowledgePath,
      e.type,
      e.subtype,
      e.subSubtype,
      e.errorReason,
      e.rootReason,
      e.tip,
      rec.srcYear,
      rec.srcProvince,
      rec.srcOrigin,
    ]
      .filter(v => v != null && String(v).trim() !== '')
      .map(v => String(v))
      .join(' ')
      .toLowerCase()
  }

  function nodeTitleById(id: string | null): string | null {
    if (!id) return null
    const n = findNodeInTree(knowledgeTree.value, id)
    return n?.title ? String(n.title) : null
  }

  /** 侧栏 / 头图共用的活跃筛选条（可点除） */
  const activeFilterCrumbs = computed(() => {
    const crumbs: { key: string; label: string }[] = []
    const nt = nodeTitleById(activeNodeId.value)
    if (nt) crumbs.push({ key: 'node', label: nt })
    if (taskFilter.value !== 'all') {
      const tmap: Record<string, string> = {
        diagnose: '待判因',
        review_ready: '待复盘',
        retrain: '待复训',
      }
      crumbs.push({ key: 'task', label: tmap[taskFilter.value] ?? taskFilter.value })
    }
    if (statusFilter.value !== 'all') {
      const sm: Record<string, string> = { focus: '重点复习', review: '待复习', mastered: '已掌握' }
      crumbs.push({ key: 'status', label: sm[statusFilter.value] ?? statusFilter.value })
    }
    if (reasonFilter.value) {
      crumbs.push({ key: 'reason', label: `错因: ${reasonFilter.value}` })
    }
    if (dateFrom.value || dateTo.value) {
      crumbs.push({
        key: 'date',
        label: `${dateFrom.value || '…'} ~ ${dateTo.value || '…'}`,
      })
    }
    const sq = searchQuery.value.trim()
    if (sq) crumbs.push({ key: 'search', label: `"${sq}"` })
    return crumbs
  })

  const filteredErrors = computed(() => {
    let list = errors.value

    // 任务阶段筛选（workflowStage）
    if (taskFilter.value !== 'all') {
      list = list.filter(e => {
        const stage = String(e.workflowStage ?? '')
        if (taskFilter.value === 'diagnose') return stage === 'captured' || stage === 'diagnosing'
        if (taskFilter.value === 'review_ready') return stage === 'review_ready'
        if (taskFilter.value === 'retrain') return stage === 'retrain_due'
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
      const terms = searchQuery.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
      list = list.filter(e => {
        const text = buildErrorSearchText(e)
        return terms.every(t => text.includes(t))
      })
    }

    return list
  })

  /** 与旧版 `renderStats(list)` 一致：基于当前可见列表 */
  const errorListStats = computed(() => {
    const list = filteredErrors.value
    let focus = 0
    let review = 0
    let mastered = 0
    for (const e of list) {
      if (e.status === 'focus') focus++
      else if (e.status === 'review') review++
      else if (e.status === 'mastered') mastered++
    }
    return { total: list.length, focus, review, mastered }
  })

  const errorListBreadcrumb = computed(() => {
    const crumbs = activeFilterCrumbs.value
    if (!crumbs.length) return '全部题目'
    return `全部 › ${crumbs.map(c => c.label).join(' › ')}`
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
      lastPulledAt.value = new Date().toISOString()
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

  function updateKnowledgeNode(id: string, patch: Partial<KnowledgeNode>) {
    knowledgeNodes.value = knowledgeNodes.value.map(n =>
      n.id === id
        ? ({ ...n, ...patch, updatedAt: new Date().toISOString() } as KnowledgeNode)
        : n,
    )
    scheduleSave()
  }

  /** 对齐旧版知识点重命名：同级重名校验 */
  function renameKnowledgeNode(nodeId: string, newTitle: string) {
    const t = newTitle.trim()
    if (!t) {
      window.alert('标题不能为空')
      return
    }
    const node = knowledgeNodes.value.find(n => n.id === nodeId)
    if (!node) return
    if (t === node.title) return
    const siblings = knowledgeNodes.value.filter(n => n.parentId === node.parentId && n.id !== nodeId)
    if (siblings.some(s => s.title === t)) {
      if (!window.confirm(`同级下已存在「${t}」，仍要重命名吗？`)) return
    }
    updateKnowledgeNode(nodeId, { title: t })
  }

  function toggleBatchMode() {
    batchMode.value = !batchMode.value
    if (!batchMode.value) batchSelectedIds.value = []
  }

  function toggleBatchSelect(id: string) {
    const arr = [...batchSelectedIds.value]
    const i = arr.indexOf(id)
    if (i >= 0) arr.splice(i, 1)
    else arr.push(id)
    batchSelectedIds.value = arr
  }

  function batchApplyNoteNode(noteNodeId: string | null | undefined) {
    const ids = new Set(batchSelectedIds.value)
    if (!ids.size) return
    const nid = noteNodeId || undefined
    errors.value = errors.value.map(e =>
      ids.has(e.id)
        ? { ...e, noteNodeId: nid, updatedAt: new Date().toISOString() }
        : e,
    )
    scheduleSave()
  }

  function batchDeleteSelectedErrors() {
    const n = batchSelectedIds.value.length
    if (!n) return
    if (!confirm(`删除选中的 ${n} 题？不可撤销。`)) return
    const rm = new Set(batchSelectedIds.value)
    errors.value = errors.value.filter(e => !rm.has(e.id))
    batchSelectedIds.value = []
    batchMode.value = false
    scheduleSave()
  }

  /** 对齐 legacy `deleteKnowledgeNode`：扁平 knowledgeNodes + 校验下级与直属错题 */
  function deleteKnowledgeNode(nodeId: string) {
    const node = knowledgeNodes.value.find(n => n.id === nodeId)
    if (!node) return
    const childCount = knowledgeNodes.value.filter(n => n.parentId === nodeId).length
    const directErrors = errors.value.filter(e => e.noteNodeId === nodeId).length
    if (childCount > 0 || directErrors > 0) {
      window.alert(
        `不能直接删除「${node.title}」：还有 ${childCount} 个下级、${directErrors} 道直属题目。请先移动或清理后再删。`,
      )
      return
    }
    const rec = node as Record<string, unknown>
    const hasNote = String(rec.contentMd || rec.noteContent || '').trim()
    const noteFlag = hasNote ? '\n- 当前节点有笔记内容' : ''
    if (!window.confirm(`确认删除知识点「${node.title}」吗？${noteFlag}\n\n此操作不可撤销。`)) return
    const isRoot = !node.parentId
    if (isRoot) {
      if (
        !window.confirm(
          `你正在删除一级知识点「${node.title}」。\n\n这会影响整组知识树结构和挂载错题，请再次确认。`,
        )
      ) {
        return
      }
    }
    knowledgeNodes.value = knowledgeNodes.value.filter(n => n.id !== nodeId)
    if (knowledgeExpandedIds.value.has(nodeId)) {
      knowledgeExpandedIds.value.delete(nodeId)
      knowledgeExpandedIds.value = new Set(knowledgeExpandedIds.value)
      saveKnowledgeExpandedState()
    }
    if (activeNodeId.value === nodeId) activeNodeId.value = null
    scheduleSave()
  }

  function canMoveKnowledgeNode(nodeId: string): boolean {
    const node = knowledgeNodes.value.find(n => n.id === nodeId)
    if (!node) return false
    if (isVirtualKnowledgeNodeId(node.id)) return false
    const isRoot = !node.parentId
    if (!isRoot) return true
    return !FIXED_ROOT_ORDER.includes(String(node.title || ''))
  }

  function getKnowledgeMoveTargetOptions(nodeId: string): Array<{ id: string; label: string }> {
    const source = findNodeInTree(knowledgeTree.value, nodeId)
    if (!source) return []
    const blocked = new Set(collectDescendantIds(source))
    blocked.add(nodeId)
    const options: Array<{ id: string; label: string }> = []
    const walk = (nodes: KnowledgeNode[], trail: string[]) => {
      for (const n of nodes) {
        const nextTrail = [...trail, n.title]
        if (!blocked.has(n.id) && !isVirtualKnowledgeNodeId(n.id)) {
          options.push({ id: n.id, label: nextTrail.join(' > ') })
        }
        if (n.children?.length) walk(n.children, nextTrail)
      }
    }
    walk(knowledgeTree.value, [])
    return options
  }

  function moveKnowledgeNode(nodeId: string, targetParentId: string) {
    if (!canMoveKnowledgeNode(nodeId)) {
      window.alert('基础一级节点不支持移动')
      return false
    }
    const node = knowledgeNodes.value.find(n => n.id === nodeId)
    if (!node) return false
    if (!targetParentId || targetParentId === nodeId) return false
    if (isVirtualKnowledgeNodeId(targetParentId)) {
      window.alert('目标节点无效，请选择真实节点')
      return false
    }
    const sourceInTree = findNodeInTree(knowledgeTree.value, nodeId)
    if (!sourceInTree) return false
    const descendantIds = new Set(collectDescendantIds(sourceInTree))
    if (descendantIds.has(targetParentId)) {
      window.alert('不能移动到自己的下级节点')
      return false
    }
    const target = knowledgeNodes.value.find(n => n.id === targetParentId)
    if (!target) {
      window.alert('目标节点不存在')
      return false
    }
    const duplicate = knowledgeNodes.value.find(n =>
      n.id !== node.id &&
      n.parentId === targetParentId &&
      String(n.title || '').trim() === String(node.title || '').trim()
    )
    if (duplicate) {
      window.alert('目标父节点下已存在同名节点，请先重命名后再移动')
      return false
    }
    updateKnowledgeNode(nodeId, { parentId: targetParentId })
    expandKnowledgeNode(targetParentId)
    return true
  }

  /** 全局搜索：与错题列表筛选同为 AND 词匹配（沿用 buildErrorSearchText） */
  function globalSearchMatchError(e: ErrorEntry, terms: string[]): boolean {
    if (!terms.length) return false
    const text = buildErrorSearchText(e)
    return terms.every(t => text.includes(t))
  }

  function globalSearchMatchKnowledgeNode(n: KnowledgeNode, terms: string[]): boolean {
    if (!terms.length) return false
    const md = String(n.contentMd ?? n.noteContent ?? '')
    const path = getNodePathText(n.id)
    const blob = `${n.title} ${path} ${md}`.toLowerCase()
    return terms.every(t => blob.includes(t.toLowerCase()))
  }

  /** 对齐旧版 `setTaskFilter`：切换任务视角时清空其它筛选条件 */
  function setTaskFilter(mode: 'all' | 'diagnose' | 'review_ready' | 'retrain') {
    const key = String(mode || 'all')
    taskFilter.value =
      key === 'diagnose' || key === 'review_ready' || key === 'retrain'
        ? (key as typeof taskFilter.value)
        : 'all'
    statusFilter.value = 'all'
    activeType.value = null
    activeNodeId.value = null
    reasonFilter.value = null
    searchQuery.value = ''
    dateFrom.value = ''
    dateTo.value = ''
  }

  /** 对齐旧版 `setStatusFilter`：选中状态时退出任务视角并清空大类/知识节点 */
  function setStatusFilter(s: typeof statusFilter.value) {
    taskFilter.value = 'all'
    statusFilter.value = s
    activeType.value = null
    activeNodeId.value = null
  }

  /** 对齐旧版 `setReasonFilter`：切换错因时退出任务视角并清空知识节点 */
  function toggleReasonFilter(reason: string) {
    taskFilter.value = 'all'
    activeNodeId.value = null
    reasonFilter.value = reasonFilter.value === reason ? null : reason
  }

  /** 侧栏 breadcrumb 单项移除 */
  function removeFilterCrumb(key: string) {
    if (key === 'node') {
      activeNodeId.value = null
      return
    }
    if (key === 'task') {
      setTaskFilter('all')
      return
    }
    if (key === 'status') {
      setStatusFilter('all')
      return
    }
    if (key === 'reason') {
      reasonFilter.value = null
      return
    }
    if (key === 'date') {
      dateFrom.value = ''
      dateTo.value = ''
      return
    }
    if (key === 'search') {
      searchQuery.value = ''
    }
  }

  function setActiveType(type: string | null) {
    taskFilter.value = 'all'
    activeType.value = type
    activeNodeId.value = null
  }

  /** 选中知识节点时对齐旧版大类筛选（清空任务视角）；取消选中时不重置任务筛选 */
  function setActiveNode(nodeId: string | null) {
    if (nodeId) taskFilter.value = 'all'
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
    saveKnowledgeExpandedState()
  }

  function expandKnowledgeNode(id: string) {
    if (!knowledgeExpandedIds.value.has(id)) {
      knowledgeExpandedIds.value = new Set([...knowledgeExpandedIds.value, id])
      saveKnowledgeExpandedState()
    }
  }

  function loadKnowledgeExpandedState() {
    try {
      const raw = localStorage.getItem(KNOWLEDGE_EXPANDED_STORAGE_KEY)
      if (!raw) return
      const ids = JSON.parse(raw)
      if (!Array.isArray(ids)) return
      knowledgeExpandedIds.value = new Set(
        ids.map(v => String(v || '').trim()).filter(Boolean)
      )
    } catch {
      // ignore storage parse errors
    }
  }

  function saveKnowledgeExpandedState() {
    try {
      localStorage.setItem(
        KNOWLEDGE_EXPANDED_STORAGE_KEY,
        JSON.stringify([...knowledgeExpandedIds.value])
      )
    } catch {
      // ignore storage quota errors
    }
  }

  /** 加载练习面板数据（badge 计数、今日进度） */
  async function loadPracticePanel() {
    if (practiceLoading.value) return
    practiceLoading.value = true
    try {
      const [wb, daily] = await Promise.all([
        xingceApi.getWorkbench(12),
        xingceApi.getDaily(30),
      ])
      const dailyItems = (daily.items ?? []) as unknown[]
      const dueN = dailyItems.length
      quizBadge.value = dueN
      reviewBadge.value = Number((wb.reviewQueue ?? []).length || 0)
      retrainBadge.value = Number((wb.retrainQueue ?? []).length || 0)
      const done = daily.practicedTodayCount ?? 0
      todayDone.value = done
      todayTotal.value = done + dueN
    } catch {
      // 静默失败
    } finally {
      practiceLoading.value = false
    }
  }

  async function loadMe() {
    try {
      const r = await xingceApi.getMe()
      currentUser.value = r.authenticated && r.user ? r.user : null
    } catch {
      currentUser.value = null
    }
  }

  function clearErrorsByFilter(ids: string[]) {
    if (!ids.length) return
    const drop = new Set(ids)
    errors.value = errors.value.filter(e => !drop.has(e.id))
    scheduleSave()
  }

  function clearAllErrors() {
    errors.value = []
    scheduleSave()
  }

  function resetAllStudyFields() {
    errors.value = errors.value.map(e => ({
      ...e,
      status: 'focus' as const,
      masteryLevel: 'not_mastered',
      workflowStage: 'captured',
      updatedAt: new Date().toISOString(),
    }))
    scheduleSave()
  }

  function replaceWorkspaceSnapshot(nextErrors: ErrorEntry[], nextNodes: KnowledgeNode[]) {
    errors.value = nextErrors
    knowledgeNodes.value = nextNodes
    scheduleSave()
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

  /** 清除练习摘要缓存（单题练习提交后需重拉，与旧版 `invalidatePracticeAttemptSummaries` 类似） */
  function invalidatePracticeSummaries(ids?: string[]) {
    if (!ids?.length) {
      practiceSummaries.value = {}
      return
    }
    const next = { ...practiceSummaries.value }
    for (const id of ids) {
      delete next[id]
    }
    practiceSummaries.value = next
  }

  /** 添加新错题并触发同步 */
  function addError(fields: Partial<ErrorEntry> & { question: string; type: string; subtype: string }) {
    const newEntry: ErrorEntry = {
      ...fields,
      id: crypto.randomUUID(),
      entryKind: 'error',
      addDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
      masteryLevel: fields.masteryLevel ?? 'not_mastered',
      status: fields.status ?? 'focus',
      workflowStage: fields.workflowStage ?? 'captured',
    }
    errors.value = [newEntry, ...errors.value]
    scheduleSave()
    return newEntry
  }

  function clearActiveKnowledgeNote() {
    if (!activeNodeId.value) return
    const id = activeNodeId.value
    if (!confirm('清空当前知识点的笔记内容？此操作不可撤销。')) return
    const next = knowledgeNodes.value.map(n => {
      if (n.id !== id) return n
      const rec = { ...n } as Record<string, unknown>
      rec.contentMd = ''
      rec.noteContent = ''
      return rec as unknown as KnowledgeNode
    })
    knowledgeNodes.value = next
    void flushSave()
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
    lastPulledAt,
    currentUser,
    batchMode,
    batchSelectedIds,
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
    knowledgeSearchTerms,
    visibleKnowledgeNodeCount,
    // 练习统计
    practiceSummaries,
    queuePracticeSummaries,
    invalidatePracticeSummaries,
    // 练习面板
    quizBadge,
    reviewBadge,
    retrainBadge,
    todayDone,
    todayTotal,
    practiceLoading,
    loadPracticePanel,
    loadMe,
    eligibleFullPracticeCount,
    clearErrorsByFilter,
    clearAllErrors,
    resetAllStudyFields,
    replaceWorkspaceSnapshot,
    // 计算
    knowledgeTree,
    filteredErrors,
    errorListStats,
    errorListBreadcrumb,
    errorCountByType,
    totalCountByType,
    errorCountByNode,
    errorCountByNodeAgg,
    taskCounts,
    reasonOptions,
    activeFilterCrumbs,
    // 动作
    load,
    flushSave,
    updateError,
    deleteError,
    updateKnowledgeNode,
    renameKnowledgeNode,
    canMoveKnowledgeNode,
    getKnowledgeMoveTargetOptions,
    moveKnowledgeNode,
    deleteKnowledgeNode,
    globalSearchMatchError,
    globalSearchMatchKnowledgeNode,
    toggleBatchMode,
    toggleBatchSelect,
    batchApplyNoteNode,
    batchDeleteSelectedErrors,
    setActiveType,
    setActiveNode,
    toggleKnowledgeNode,
    expandKnowledgeNode,
    hasKnowledgeSearch,
    getNodePathText,
    isNodeSearchMatch,
    isNodeVisibleBySearch,
    loadKnowledgeExpandedState,
    saveKnowledgeExpandedState,
    addError,
    clearActiveKnowledgeNote,
    clearFilters,
    setTaskFilter,
    setStatusFilter,
    toggleReasonFilter,
    removeFilterCrumb,
  }
})
