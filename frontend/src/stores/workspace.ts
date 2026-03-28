import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { getBackup } from '@/services/api'
import type {
  BackupResponse,
  ErrorEntry,
  KnowledgeNode,
  LegacyKnowledgeNoteEntry,
  OriginStatus,
  SyncOp,
  WorkspaceBackup,
} from '@/types/workspace'

type ExportContentMode = 'questions' | 'questions_notes' | 'module_backup'
type ExportScopeMode = 'all' | 'filtered' | 'current'

const UNCLASSIFIED_LABEL = '未分类'
const UNTITLED_NODE_LABEL = '未命名知识点'

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function toText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeEntry(item: Partial<ErrorEntry>, defaultKind: ErrorEntry['entryKind'] = 'error'): ErrorEntry {
  return {
    ...item,
    id: String(item.id || crypto.randomUUID()),
    entryKind: (item.entryKind || defaultKind || 'error') as ErrorEntry['entryKind'],
    type: toText(item.type, UNCLASSIFIED_LABEL),
    subtype: toText(item.subtype, UNCLASSIFIED_LABEL),
    subSubtype: toText(item.subSubtype),
    question: toText(item.question),
    options: toText(item.options),
    answer: toText(item.answer),
    myAnswer: toText(item.myAnswer),
    analysis: toText(item.analysis),
    rootReason: toText(item.rootReason),
    errorReason: toText(item.errorReason),
    status: toText(item.status, 'focus'),
    noteNodeId: toText(item.noteNodeId),
    masteryLevel: toText(item.masteryLevel),
    lastPracticedAt: toText(item.lastPracticedAt),
    difficulty: toInt(item.difficulty, 0),
    srcYear: toText(item.srcYear),
    srcProvince: toText(item.srcProvince),
    srcOrigin: toText(item.srcOrigin),
    imgData: toText(item.imgData),
    analysisImgData: toText(item.analysisImgData),
    note: toText(item.note),
    addDate: toText(item.addDate),
    updatedAt: toText(item.updatedAt, new Date().toISOString()),
  }
}

function normalizeNode(raw: unknown, parentId = ''): KnowledgeNode {
  const source = (raw || {}) as Record<string, unknown>
  const nodeId = String(source.id || source.nodeId || source.key || crypto.randomUUID())
  const children = Array.isArray(source.children) ? source.children : []
  const contentMd = String(source.contentMd || source.content || '')
  return {
    id: nodeId,
    title: String(source.title || source.name || UNTITLED_NODE_LABEL),
    contentMd,
    updatedAt: String(source.updatedAt || ''),
    parentId,
    children: children.map((child) => normalizeNode(child, nodeId)),
  }
}

function normalizeKnowledgeTree(raw: unknown): KnowledgeNode[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((item) => normalizeNode(item))
  if (typeof raw === 'object') {
    const source = raw as Record<string, unknown>
    if (Array.isArray(source.roots)) {
      return source.roots.map((item) => normalizeNode(item))
    }
    return [normalizeNode(raw)]
  }
  return []
}

function normalizeKnowledgeNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      result[key] = value
      continue
    }
    if (value && typeof value === 'object') {
      const legacy = value as LegacyKnowledgeNoteEntry
      result[key] = typeof legacy.content === 'string' ? legacy.content : ''
    }
  }
  return result
}

function serializeKnowledgeTree(nodes: KnowledgeNode[]) {
  return {
    version: 1,
    roots: cloneJson(nodes),
  }
}

function flatten(nodes: KnowledgeNode[]): KnowledgeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}

function findNode(nodes: KnowledgeNode[], nodeId: string): KnowledgeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node
    const child = findNode(node.children, nodeId)
    if (child) return child
  }
  return null
}

function parsePayload(payload: unknown) {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch {
      return {}
    }
  }
  return payload || {}
}

function collectDescendantIds(node: KnowledgeNode | null): string[] {
  if (!node) return []
  return [node.id, ...node.children.flatMap((child) => collectDescendantIds(child))]
}

function isDescendant(node: KnowledgeNode, targetId: string): boolean {
  return node.children.some((child) => child.id === targetId || isDescendant(child, targetId))
}

function rebuildTreeFromMap(nodeMap: Map<string, KnowledgeNode>): KnowledgeNode[] {
  const cloned = new Map<string, KnowledgeNode>()
  for (const node of nodeMap.values()) {
    cloned.set(node.id, { ...node, children: [] })
  }
  for (const node of cloned.values()) {
    if (node.parentId && cloned.has(node.parentId)) {
      cloned.get(node.parentId)!.children.push(node)
    }
  }
  return Array.from(cloned.values()).filter((node) => !node.parentId || !cloned.has(node.parentId))
}

function tryParseJson(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function tryParseLooseJson(raw: string) {
  const direct = tryParseJson(raw)
  if (direct) return direct

  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
  } catch {
    // ignore
  }

  try {
    const fixed = raw.replace(/"((?:[^"\\]|\\.)*)"/g, (_, value: string) => `"${value.replace(/\r?\n/g, '\\n')}"`)
    const match = fixed.match(/\[[\s\S]*\]/)
    return JSON.parse(match ? match[0] : fixed)
  } catch {
    return null
  }
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const loading = ref(false)
  const backupUpdatedAt = ref('')
  const currentOrigin = ref('')
  const originStatuses = ref<OriginStatus[]>([])
  const searchQuery = ref('')
  const statusFilter = ref<'all' | 'focus' | 'review' | 'mastered'>('all')
  const errors = ref<ErrorEntry[]>([])
  const notesByType = ref<Record<string, { content?: string; updatedAt?: string }>>({})
  const knowledgeTree = ref<KnowledgeNode[]>([])
  const knowledgeNotes = ref<Record<string, string>>({})
  const globalNote = ref('')
  const typeRules = ref<unknown>(null)
  const dirTree = ref<unknown>(null)
  const selectedKnowledgeNodeId = ref('')

  const knowledgeNodes = computed(() => flatten(knowledgeTree.value))
  const knowledgeNodeMap = computed(() => new Map(knowledgeNodes.value.map((node) => [node.id, node])))
  const selectedKnowledgeNode = computed(() => findNode(knowledgeTree.value, selectedKnowledgeNodeId.value))
  const selectedNodeIds = computed(() => collectDescendantIds(selectedKnowledgeNode.value))
  const selectedNodeNote = computed(() => {
    const selected = selectedKnowledgeNode.value
    if (!selected) return globalNote.value || ''
    return selected.contentMd || knowledgeNotes.value[selected.id] || ''
  })
  const visibleErrors = computed(() =>
    errors.value.filter((item: ErrorEntry) => (item.entryKind || 'error') === 'error'),
  )
  const claudeBankEntries = computed(() =>
    errors.value.filter((item: ErrorEntry) => item.entryKind === 'claude_bank'),
  )
  const filteredErrors = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    const statusScoped =
      statusFilter.value === 'all'
        ? visibleErrors.value
        : visibleErrors.value.filter((item: ErrorEntry) => (item.status || 'focus') === statusFilter.value)
    if (!query) return statusScoped
    return statusScoped.filter((item: ErrorEntry) => {
      const haystack = [
        item.question,
        item.type,
        item.subtype,
        item.subSubtype,
        item.rootReason,
        item.errorReason,
        item.analysis,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  })
  const filteredClaudeBank = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return claudeBankEntries.value
    return claudeBankEntries.value.filter((item: ErrorEntry) => {
      const haystack = [item.question, item.type, item.subtype, item.subSubtype, item.analysis]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  })
  const relatedErrors = computed(() => {
    const selectedIds = new Set(selectedNodeIds.value)
    if (!selectedIds.size) return filteredErrors.value
    return filteredErrors.value.filter((item: ErrorEntry) => selectedIds.has(String(item.noteNodeId || '')))
  })
  const summary = computed(() => {
    const total = visibleErrors.value.length
    const focus = visibleErrors.value.filter((item) => item.status === 'focus').length
    const review = visibleErrors.value.filter((item) => item.status === 'review').length
    const mastered = visibleErrors.value.filter((item) => item.status === 'mastered').length
    const topTypes = new Map<string, number>()
    for (const item of visibleErrors.value) {
      const key = item.type || UNCLASSIFIED_LABEL
      topTypes.set(key, (topTypes.get(key) || 0) + 1)
    }
    const topType = Array.from(topTypes.entries()).sort((a, b) => b[1] - a[1])[0] || [UNCLASSIFIED_LABEL, 0]
    return { total, focus, review, mastered, topType }
  })

  function setFromBackupPayload(payload: WorkspaceBackup | null | undefined) {
    const backup = (payload || {
      errors: [],
      revealed: [],
      expTypes: [],
      expMain: [],
      expMainSub: [],
      expMainSub2: [],
      notesByType: {},
      noteImages: {},
      typeRules: null,
      dirTree: null,
      knowledgeTree: null,
      knowledgeNotes: {},
      globalNote: '',
      knowledgeExpanded: [],
      todayDate: '',
      todayDone: 0,
      history: [],
    }) as WorkspaceBackup

    errors.value = Array.isArray(backup.errors)
      ? backup.errors.map((item: ErrorEntry) => normalizeEntry(item, item.entryKind || 'error'))
      : []
    notesByType.value = backup.notesByType || {}
    knowledgeTree.value = normalizeKnowledgeTree(backup.knowledgeTree)
    knowledgeNotes.value = normalizeKnowledgeNotes(backup.knowledgeNotes)
    globalNote.value = backup.globalNote || ''
    typeRules.value = backup.typeRules ?? null
    dirTree.value = backup.dirTree ?? null
    if (!selectedKnowledgeNodeId.value || !selectedKnowledgeNode.value) {
      selectedKnowledgeNodeId.value = knowledgeTree.value[0]?.id || ''
    }
  }

  async function loadBackup() {
    loading.value = true
    try {
      const response: BackupResponse = await getBackup()
      backupUpdatedAt.value = response.updatedAt || ''
      currentOrigin.value = response.currentOrigin || ''
      originStatuses.value = response.origins || []
      setFromBackupPayload(response.backup)
      return response
    } finally {
      loading.value = false
    }
  }

  function selectKnowledgeNode(nodeId: string) {
    selectedKnowledgeNodeId.value = nodeId
  }

  function setSearchQuery(value: string) {
    searchQuery.value = value
  }

  function setStatusFilter(value: 'all' | 'focus' | 'review' | 'mastered') {
    statusFilter.value = value
  }

  function updateGlobalNote(value: string) {
    globalNote.value = value
  }

  function updateTypeRules(value: unknown) {
    typeRules.value = value
  }

  function updateDirTree(value: unknown) {
    dirTree.value = value
  }

  function updateSelectedKnowledgeNote(value: string) {
    const selectedId = selectedKnowledgeNodeId.value
    if (!selectedId) {
      globalNote.value = value
      return null
    }
    const nodeMap = new Map(knowledgeNodes.value.map((node) => [node.id, { ...node, children: [] as KnowledgeNode[] }]))
    const target = nodeMap.get(selectedId)
    if (!target) return null
    const updatedAt = new Date().toISOString()
    target.contentMd = value
    target.updatedAt = updatedAt
    knowledgeTree.value = rebuildTreeFromMap(nodeMap)
    knowledgeNotes.value = {
      ...knowledgeNotes.value,
      [selectedId]: value,
    }
    return cloneJson(target)
  }

  function createKnowledgeChild(title: string) {
    const trimmed = title.trim()
    if (!trimmed) return null
    const parentId = selectedKnowledgeNodeId.value || ''
    const nodeMap = new Map(knowledgeNodes.value.map((node) => [node.id, { ...node, children: [] as KnowledgeNode[] }]))
    const siblings = Array.from(nodeMap.values()).filter((node) => node.parentId === parentId)
    if (siblings.some((node) => node.title === trimmed)) return null
    const newNode: KnowledgeNode = {
      id: crypto.randomUUID(),
      title: trimmed,
      contentMd: '',
      updatedAt: new Date().toISOString(),
      parentId,
      children: [],
    }
    nodeMap.set(newNode.id, newNode)
    knowledgeTree.value = rebuildTreeFromMap(nodeMap)
    selectedKnowledgeNodeId.value = newNode.id
    return cloneJson(newNode)
  }

  function renameSelectedKnowledgeNode(title: string) {
    const trimmed = title.trim()
    if (!trimmed || !selectedKnowledgeNodeId.value) return null
    const nodeMap = new Map(knowledgeNodes.value.map((node) => [node.id, { ...node, children: [] as KnowledgeNode[] }]))
    const target = nodeMap.get(selectedKnowledgeNodeId.value)
    if (!target) return null
    const siblings = Array.from(nodeMap.values()).filter((node) => node.parentId === target.parentId && node.id !== target.id)
    if (siblings.some((node) => node.title === trimmed)) return null
    target.title = trimmed
    target.updatedAt = new Date().toISOString()
    knowledgeTree.value = rebuildTreeFromMap(nodeMap)
    return cloneJson(target)
  }

  function moveSelectedKnowledgeNode(targetParentId: string) {
    const selectedId = selectedKnowledgeNodeId.value
    if (!selectedId || !targetParentId) return null
    const selectedNode = selectedKnowledgeNode.value
    const targetParent = knowledgeNodeMap.value.get(targetParentId)
    if (!selectedNode || !targetParent) return null
    if (!selectedNode.parentId) return null
    if (selectedNode.id === targetParent.id) return null
    if (isDescendant(selectedNode, targetParent.id)) return null

    const nodeMap = new Map(knowledgeNodes.value.map((node) => [node.id, { ...node, children: [] as KnowledgeNode[] }]))
    const target = nodeMap.get(targetParentId)
    const source = nodeMap.get(selectedId)
    if (!target || !source) return null
    const sameLevel = Array.from(nodeMap.values()).filter((node) => node.parentId === targetParentId && node.id !== selectedId)
    if (sameLevel.some((node) => node.title === source.title)) return null

    source.parentId = targetParentId
    source.updatedAt = new Date().toISOString()
    knowledgeTree.value = rebuildTreeFromMap(nodeMap)
    selectedKnowledgeNodeId.value = selectedId
    return cloneJson(source)
  }

  function deleteSelectedKnowledgeNode() {
    const selectedId = selectedKnowledgeNodeId.value
    if (!selectedId) return null
    const selectedNode = selectedKnowledgeNode.value
    if (!selectedNode) return null
    if (!selectedNode.parentId) return null

    const nextParentId = selectedNode.parentId
    const nodeMap = new Map(
      knowledgeNodes.value
        .filter((node) => node.id !== selectedId)
        .map((node) => [
          node.id,
          {
            ...node,
            parentId: node.parentId === selectedId ? nextParentId : node.parentId,
            children: [] as KnowledgeNode[],
          },
        ]),
    )

    const movedErrors = errors.value
      .filter((item) => String(item.noteNodeId || '') === selectedId)
      .map((item) =>
        normalizeEntry(
          {
            ...item,
            noteNodeId: nextParentId,
            updatedAt: new Date().toISOString(),
          },
          item.entryKind || 'error',
        ),
      )
    const movedErrorMap = new Map(movedErrors.map((item) => [item.id, item]))
    errors.value = errors.value.map((item) => movedErrorMap.get(item.id) || item)

    const movedNodes = selectedNode.children.map((child) =>
      cloneJson({
        ...child,
        parentId: nextParentId,
      }),
    )

    knowledgeTree.value = rebuildTreeFromMap(nodeMap)
    selectedKnowledgeNodeId.value = nextParentId || knowledgeTree.value[0]?.id || ''
    const nextNotes = { ...knowledgeNotes.value }
    delete nextNotes[selectedId]
    knowledgeNotes.value = nextNotes

    return {
      ids: [selectedId],
      nextSelectedId: selectedKnowledgeNodeId.value,
      movedErrors,
      movedNodes,
      reparentedTo: nextParentId,
    }
  }

  function upsertErrorEntry(entry: Partial<ErrorEntry>, defaultKind: ErrorEntry['entryKind'] = 'error') {
    const normalized = normalizeEntry(entry, defaultKind)
    const index = errors.value.findIndex((item) => String(item.id) === normalized.id)
    if (index >= 0) {
      errors.value.splice(index, 1, normalized)
    } else {
      errors.value.unshift(normalized)
    }
    return normalized
  }

  function deleteErrorEntry(entryId: string) {
    const index = errors.value.findIndex((item) => String(item.id) === String(entryId))
    if (index < 0) return false
    errors.value.splice(index, 1)
    return true
  }

  function cycleErrorStatus(entryId: string) {
    const current = errors.value.find((item) => item.id === entryId)
    if (!current) return null
    const order = ['focus', 'review', 'mastered']
    const currentIndex = Math.max(order.indexOf(current.status || 'focus'), 0)
    const nextStatus = order[(currentIndex + 1) % order.length]
    return upsertErrorEntry(
      {
        ...current,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      },
      current.entryKind || 'error',
    )
  }

  function switchEntryKind(entryId: string, nextKind: ErrorEntry['entryKind']) {
    const current = errors.value.find((item) => item.id === entryId)
    if (!current) return null
    return upsertErrorEntry(
      {
        ...current,
        entryKind: nextKind,
        status: nextKind === 'error' ? current.status || 'focus' : current.status,
        updatedAt: new Date().toISOString(),
      },
      nextKind,
    )
  }

  function mergeImportedEntries(rawEntries: unknown[], defaultKind: ErrorEntry['entryKind']) {
    const normalizedEntries = (rawEntries || []).map((item) => {
      const raw = (item || {}) as Partial<ErrorEntry>
      return normalizeEntry(
        {
          ...raw,
          noteNodeId: raw.noteNodeId || selectedKnowledgeNodeId.value || '',
          updatedAt: raw.updatedAt || new Date().toISOString(),
        },
        defaultKind,
      )
    })
    const questionKey = (item: ErrorEntry) => `${item.entryKind || defaultKind}::${(item.question || '').trim().slice(0, 120)}`
    const idMap = new Map(errors.value.map((item, index) => [String(item.id), index]))
    const questionMap = new Map(errors.value.map((item, index) => [questionKey(item), index]))
    const touched: ErrorEntry[] = []
    let added = 0
    let updated = 0

    for (const entry of normalizedEntries) {
      const targetIndex = idMap.get(entry.id) ?? questionMap.get(questionKey(entry))
      if (targetIndex !== undefined) {
        const merged = normalizeEntry(
          {
            ...errors.value[targetIndex],
            ...entry,
            id: errors.value[targetIndex].id,
            entryKind: entry.entryKind || errors.value[targetIndex].entryKind || defaultKind,
            updatedAt: new Date().toISOString(),
          },
          defaultKind,
        )
        errors.value.splice(targetIndex, 1, merged)
        touched.push(merged)
        updated += 1
      } else {
        errors.value.unshift(entry)
        touched.push(entry)
        added += 1
      }
    }

    return { added, updated, touched }
  }

  function importEntries(rawText: string, defaultKind: ErrorEntry['entryKind']) {
    const parsed = tryParseLooseJson(rawText.trim())
    if (!parsed) {
      throw new Error('JSON 解析失败，请检查内容。')
    }
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { errors?: unknown[] }).errors)
        ? (parsed as { errors: unknown[] }).errors
        : null
    if (!list) {
      throw new Error('导入内容必须是数组，或带 errors 字段的对象。')
    }
    return mergeImportedEntries(list, defaultKind)
  }

  function buildNotesByTypeSubset(errorList: ErrorEntry[]) {
    const types = [...new Set(errorList.map((item) => item.type).filter(Boolean))]
    const subset: Record<string, { content?: string; updatedAt?: string }> = {}
    types.forEach((type) => {
      if (type && notesByType.value[type]) subset[type] = cloneJson(notesByType.value[type])
    })
    return subset
  }

  function buildKnowledgeSubset(nodeIds: string[]) {
    const includeIds = new Set(nodeIds.filter(Boolean))
    if (!includeIds.size) return { knowledgeTree: null, knowledgeNotes: {} as Record<string, string> }

    function walk(nodes: KnowledgeNode[]): KnowledgeNode[] {
      return nodes.reduce<KnowledgeNode[]>((acc, node) => {
        const children = walk(node.children || [])
        if (!includeIds.has(node.id) && !children.length) return acc
        acc.push({
          ...cloneJson(node),
          children,
        })
        return acc
      }, [])
    }

    const tree = walk(knowledgeTree.value)
    const notes: Record<string, string> = {}
    includeIds.forEach((id) => {
      const node = knowledgeNodeMap.value.get(id)
      if (!node) return
      const content = knowledgeNotes.value[id] || node.contentMd || ''
      if (content.trim()) notes[id] = content
    })
    return {
      knowledgeTree: tree.length ? serializeKnowledgeTree(tree) : null,
      knowledgeNotes: notes,
    }
  }

  function getScopedErrorList(scopeMode: ExportScopeMode) {
    if (scopeMode === 'all') {
      return {
        list: visibleErrors.value.map((item) => cloneJson(item)),
        label: 'all_errors',
        displayLabel: '全部错题',
      }
    }
    if (scopeMode === 'filtered') {
      return {
        list: filteredErrors.value.map((item) => cloneJson(item)),
        label: 'filtered_errors',
        displayLabel: '当前筛选',
      }
    }
    const node = selectedKnowledgeNode.value
    if (!node) return null
    const nodeIds = collectDescendantIds(node)
    return {
      list: visibleErrors.value
        .filter((item) => nodeIds.includes(String(item.noteNodeId || '')))
        .map((item) => cloneJson(item)),
      label: `knowledge_${node.title}`,
      displayLabel: `当前知识点：${node.title}`,
      nodeIds,
    }
  }

  function buildExportPayload(contentMode: ExportContentMode, scopeMode: ExportScopeMode) {
    const scopeInfo = getScopedErrorList(scopeMode)
    if (!scopeInfo) {
      throw new Error('当前没有可导出的范围。')
    }
    if (!scopeInfo.list.length) {
      throw new Error('当前范围内没有可导出的错题。')
    }

    const noteNodeIds =
      scopeInfo.nodeIds && scopeInfo.nodeIds.length
        ? scopeInfo.nodeIds
        : [...new Set(scopeInfo.list.map((item) => item.noteNodeId).filter(Boolean) as string[])]
    const notesSubset = buildNotesByTypeSubset(scopeInfo.list)
    const knowledgeSubset = buildKnowledgeSubset(noteNodeIds)

    if (contentMode === 'questions') {
      return {
        fileName: `cuoti_questions_${scopeInfo.label}_${new Date().toISOString().slice(0, 10)}.json`,
        payload: scopeInfo.list,
      }
    }

    const base = {
      xc_version: 2,
      exportTime: new Date().toISOString(),
      exportKind: contentMode,
      exportScope: scopeInfo.displayLabel,
      errors: scopeInfo.list,
      notesByType: notesSubset,
      noteImages: {},
      knowledgeTree: knowledgeSubset.knowledgeTree,
      knowledgeNotes: knowledgeSubset.knowledgeNotes,
    }

    if (contentMode === 'module_backup') {
      return {
        fileName: `xingce_module_backup_${scopeInfo.label}_${new Date().toISOString().slice(0, 10)}.json`,
        payload: {
          ...buildBackupPayload(),
          ...base,
          errors: scopeInfo.list,
          notesByType: notesSubset,
          noteImages: {},
          knowledgeTree: knowledgeSubset.knowledgeTree,
          knowledgeNotes: knowledgeSubset.knowledgeNotes,
        },
      }
    }

    return {
      fileName: `xingce_questions_notes_${scopeInfo.label}_${new Date().toISOString().slice(0, 10)}.json`,
      payload: base,
    }
  }

  function buildBackupPayload(): WorkspaceBackup {
    return {
      xc_version: 2,
      exportTime: new Date().toISOString(),
      errors: errors.value.map((item) => cloneJson(item)),
      revealed: [],
      expTypes: [],
      expMain: [],
      expMainSub: [],
      expMainSub2: [],
      notesByType: cloneJson(notesByType.value),
      noteImages: {},
      typeRules: cloneJson(typeRules.value),
      dirTree: cloneJson(dirTree.value),
      globalNote: globalNote.value,
      knowledgeTree: serializeKnowledgeTree(knowledgeTree.value),
      knowledgeNotes: cloneJson(knowledgeNotes.value),
      knowledgeExpanded: [],
      todayDate: '',
      todayDone: 0,
      history: [],
    }
  }

  function applySyncOps(ops: SyncOp[]) {
    if (!ops.length) return
    const errorMap = new Map(errors.value.map((item: ErrorEntry) => [String(item.id), { ...item }]))
    const noteMap = { ...notesByType.value }
    const nodeMap = new Map(knowledgeNodes.value.map((node) => [node.id, { ...node, children: [] as KnowledgeNode[] }]))

    for (const op of ops) {
      const payload = parsePayload(op.payload)
      if (op.op_type === 'error_upsert') {
        const entry = normalizeEntry(payload as ErrorEntry, (payload as ErrorEntry)?.entryKind || 'error')
        errorMap.set(String(entry.id), entry)
      } else if (op.op_type === 'error_delete') {
        errorMap.delete(String(op.entity_id))
      } else if (op.op_type === 'note_type_upsert') {
        const key = String((payload as Record<string, unknown>).key || op.entity_id || '')
        if (key) noteMap[key] = ((payload as Record<string, unknown>).value || {}) as { content?: string; updatedAt?: string }
      } else if (op.op_type === 'note_type_delete') {
        delete noteMap[String(op.entity_id)]
      } else if (op.op_type === 'knowledge_node_upsert') {
        const nodeId = String((payload as Record<string, unknown>).id || op.entity_id || '')
        if (nodeId) {
          nodeMap.set(nodeId, {
            id: nodeId,
            title: String((payload as Record<string, unknown>).title || UNTITLED_NODE_LABEL),
            contentMd: String((payload as Record<string, unknown>).contentMd || ''),
            updatedAt: String((payload as Record<string, unknown>).updatedAt || op.created_at || ''),
            parentId: String((payload as Record<string, unknown>).parentId || ''),
            children: [],
          })
        }
      } else if (op.op_type === 'knowledge_node_delete') {
        nodeMap.delete(String(op.entity_id))
      } else if (op.op_type === 'setting_upsert') {
        const key = String((payload as Record<string, unknown>).key || op.entity_id || '')
        if (key === 'global_note') globalNote.value = String((payload as Record<string, unknown>).value || '')
        if (key === 'type_rules') typeRules.value = (payload as Record<string, unknown>).value ?? null
        if (key === 'dir_tree') dirTree.value = (payload as Record<string, unknown>).value ?? null
      }
    }

    errors.value = Array.from(errorMap.values())
    notesByType.value = noteMap
    knowledgeTree.value = rebuildTreeFromMap(nodeMap)
    if (!selectedKnowledgeNode.value) {
      selectedKnowledgeNodeId.value = knowledgeTree.value[0]?.id || ''
    }
  }

  return {
    loading,
    backupUpdatedAt,
    currentOrigin,
    originStatuses,
    searchQuery,
    statusFilter,
    errors,
    notesByType,
    knowledgeTree,
    knowledgeNotes,
    globalNote,
    typeRules,
    dirTree,
    selectedKnowledgeNodeId,
    knowledgeNodes,
    selectedKnowledgeNode,
    selectedNodeIds,
    selectedNodeNote,
    visibleErrors,
    filteredErrors,
    claudeBankEntries,
    filteredClaudeBank,
    relatedErrors,
    summary,
    loadBackup,
    selectKnowledgeNode,
    setSearchQuery,
    setStatusFilter,
    updateGlobalNote,
    updateTypeRules,
    updateDirTree,
    updateSelectedKnowledgeNote,
    createKnowledgeChild,
    renameSelectedKnowledgeNode,
    moveSelectedKnowledgeNode,
    deleteSelectedKnowledgeNode,
    upsertErrorEntry,
    deleteErrorEntry,
    cycleErrorStatus,
    switchEntryKind,
    importEntries,
    buildExportPayload,
    buildBackupPayload,
    applySyncOps,
  }
})
