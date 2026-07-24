import type { AttemptSummary, ErrorEntry, KnowledgeNode } from '@/api/xingce'

const RANDOM_NOTE_BY_TYPE_PREFIX = '__notes_by_type__:'
const RANDOM_NOTE_EDIT_WEIGHT = 0.7
const RANDOM_NOTE_VIEW_WEIGHT = 0.3
const RANDOM_NOTE_RECENT_VIEW_DOWN_WEIGHT = 0.2
const RANDOM_NOTE_RECENT_VIEW_DAYS = 1
const RANDOM_NOTE_LEVEL1_SCORE_FACTOR = 0.75
const RANDOM_NOTE_DEPTH_SCORE_BOOST = 0.12
const TRACKING_KEY = 'xc_note_review_tracking'

export type RandomNoteQueueMode = 'weighted' | 'priority'

export type NoteReviewTrackingEntry = {
  nodeId: string
  lastViewedAt?: string
  lastViewedDate?: string
  lastSource?: string
  lastRandomReviewAt?: string
  viewCount?: number
}

export type RandomNoteCandidate = {
  nodeId: string
  title: string
  contentMd: string
  updatedAt: string
  lastViewedAt: string
  viewCount: number
  editGapDays: number | null
  viewGapDays: number | null
  score: number
  pathTitles?: string[]
  level?: number
  source?: string
}

export type RandomNoteStoreContext = {
  knowledgeTree: KnowledgeNode[]
  knowledgeNodes: KnowledgeNode[]
  notesByType: Record<string, unknown>
  errors: ErrorEntry[]
  practiceSummaries: Record<string, AttemptSummary | null>
  getNodePathText: (nodeId: string) => string
  getKnowledgeNodeInTree: (nodeId: string) => KnowledgeNode | null
  countErrorsForKnowledgeNode: (nodeId: string, includeDescendants: boolean) => number
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function loadNoteReviewTracking(): Record<string, NoteReviewTrackingEntry> {
  if (typeof localStorage === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(TRACKING_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function saveNoteReviewTracking(data: Record<string, NoteReviewTrackingEntry>) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(TRACKING_KEY, JSON.stringify(data || {}))
  } catch {
    /* ignore quota */
  }
}

export function markRandomNoteViewed(
  tracking: Record<string, NoteReviewTrackingEntry>,
  nodeId: string,
): Record<string, NoteReviewTrackingEntry> {
  if (!nodeId) return tracking
  const current = tracking[nodeId] || { nodeId }
  const next = {
    ...tracking,
    [nodeId]: {
      ...current,
      nodeId,
      lastViewedAt: new Date().toISOString(),
      lastViewedDate: todayKey(),
      lastSource: 'random_note_review',
      lastRandomReviewAt: new Date().toISOString(),
      viewCount: Number(current.viewCount || 0) + 1,
    },
  }
  saveNoteReviewTracking(next)
  return next
}

function toValidDate(value: unknown): Date | null {
  const d = new Date(String(value || ''))
  return Number.isNaN(d.getTime()) ? null : d
}

export function daysSince(value: unknown, fallbackDays?: number): number | null {
  const d = toValidDate(value)
  if (!d) return Number.isFinite(fallbackDays) ? fallbackDays! : null
  return Math.max(0, (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
}

export function formatGapDays(days: number | null): string {
  if (!Number.isFinite(days) || days == null || days < 0.04) return '刚刚'
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} 小时`
  return `${Math.round(days)} 天`
}

export function formatIsoTime(value: unknown): string {
  const d = toValidDate(value)
  if (!d) return '未知'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function normalizeNoteMeaningfulText(raw: string): string {
  return String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/^#{1,6}\s*/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/^\s*\d+\.\s+/gm, ' ')
    .replace(/[>|`*_~]/g, ' ')
    .replace(/\s+/g, '')
    .trim()
}

function noteContentHasImage(content: string): boolean {
  const text = String(content || '')
  return /noteimg:/i.test(text) || /!\[[^\]]*\]\([^)]+\)/.test(text) || /<img\b/i.test(text)
}

function hasMeaningfulNoteContent(contentMd: string, title: string): boolean {
  const body = String(contentMd || '').trim()
  if (!body) return false
  if (noteContentHasImage(body)) return true
  const normalizedBody = normalizeNoteMeaningfulText(body)
  if (!normalizedBody) return false
  const normalizedTitle = normalizeNoteMeaningfulText(String(title || ''))
  if (!normalizedTitle) return true
  if (normalizedBody === normalizedTitle) return false
  if (normalizedBody.startsWith(normalizedTitle) && normalizedBody.length <= normalizedTitle.length + 2) return false
  return true
}

function resolveNoteEntryContent(entry: unknown): string {
  if (!entry) return ''
  if (typeof entry === 'string') return entry.trim()
  if (typeof entry === 'object' && typeof (entry as { content?: string }).content === 'string') {
    return (entry as { content: string }).content.trim()
  }
  return ''
}

function resolveNoteEntryUpdatedAt(entry: unknown): string {
  if (!entry || typeof entry !== 'object') return ''
  return String((entry as { updatedAt?: string }).updatedAt || '').trim()
}

function resolveNodeMarkdown(ctx: RandomNoteStoreContext, node: KnowledgeNode): string {
  const direct = String(node.contentMd ?? '').trim()
  if (direct && direct.toLowerCase() !== 'undefined') return direct
  const fromNotes = ctx.notesByType[node.id]
  const noteText = resolveNoteEntryContent(fromNotes)
  if (noteText) return noteText
  const legacy = String((node as unknown as { noteContent?: string }).noteContent ?? '').trim()
  return legacy
}

function findNodeByPathTitles(nodes: KnowledgeNode[], titles: string[]): KnowledgeNode | null {
  const path = titles.map(t => String(t || '').trim()).filter(Boolean)
  if (!path.length) return null
  let level: KnowledgeNode[] = nodes
  let found: KnowledgeNode | null = null
  for (const title of path) {
    const hit = level.find(n => String(n.title || '').trim() === title)
    if (!hit) return null
    found = hit
    level = (hit.children ?? []) as KnowledgeNode[]
  }
  return found
}

function applyDepthScoreFactor(score: number, depth: number): number {
  const base = Math.max(0.001, Number(score || 0))
  if (depth <= 1) return Math.max(0.001, base * RANDOM_NOTE_LEVEL1_SCORE_FACTOR)
  return Math.max(0.001, base * (1 + RANDOM_NOTE_DEPTH_SCORE_BOOST * (depth - 1)))
}

function buildCandidate(
  nodeId: string,
  title: string,
  contentMd: string,
  updatedAt: string,
  tracking: NoteReviewTrackingEntry | undefined,
  extra: Partial<RandomNoteCandidate> = {},
): RandomNoteCandidate {
  const editGapDays = daysSince(updatedAt, 365)
  const viewGapDays = daysSince(tracking?.lastViewedAt, 365)
  let score =
    RANDOM_NOTE_EDIT_WEIGHT * Math.log1p(editGapDays ?? 365) +
    RANDOM_NOTE_VIEW_WEIGHT * Math.log1p(viewGapDays ?? 365)
  if ((viewGapDays ?? 365) < RANDOM_NOTE_RECENT_VIEW_DAYS) score *= RANDOM_NOTE_RECENT_VIEW_DOWN_WEIGHT
  const depth = extra.pathTitles?.length || extra.level || 1
  score = applyDepthScoreFactor(score, depth)
  return {
    nodeId: String(nodeId || ''),
    title: String(title || '未命名笔记'),
    contentMd,
    updatedAt: String(updatedAt || ''),
    lastViewedAt: String(tracking?.lastViewedAt || ''),
    viewCount: Number(tracking?.viewCount || 0),
    editGapDays,
    viewGapDays,
    score: Math.max(0.001, score),
    ...extra,
  }
}

function notesByTypeMatchesRootFilter(ctx: RandomNoteStoreContext, typeKey: string, rootId: string): boolean {
  if (!rootId) return true
  const root = ctx.knowledgeTree.find(n => String(n.id) === rootId)
  if (!root) return false
  return String(root.title || '').trim() === String(typeKey || '').trim()
}

function walkNotesByTypeCandidates(
  ctx: RandomNoteStoreContext,
  pathTitles: string[],
  entry: unknown,
  rootId: string,
  candidates: RandomNoteCandidate[],
  seen: Set<string>,
  tracking: Record<string, NoteReviewTrackingEntry>,
) {
  const path = pathTitles.map(t => String(t || '').trim()).filter(Boolean)
  if (!path.length || !entry) return
  if (!notesByTypeMatchesRootFilter(ctx, path[0], rootId)) return
  const title = path[path.length - 1]
  const contentMd = resolveNoteEntryContent(entry)
  if (hasMeaningfulNoteContent(contentMd, title)) {
    let nodeId = `${RANDOM_NOTE_BY_TYPE_PREFIX}${path.join('::')}`
    let displayTitle = title
    const linked = findNodeByPathTitles(ctx.knowledgeTree, path)
    if (linked?.id) {
      nodeId = linked.id
      displayTitle = String(linked.title || title)
    }
    if (!seen.has(nodeId)) {
      seen.add(nodeId)
      candidates.push(
        buildCandidate(
          nodeId,
          displayTitle,
          contentMd,
          resolveNoteEntryUpdatedAt(entry) || '',
          tracking[nodeId],
          { source: 'notes_by_type', level: path.length, pathTitles: path.slice() },
        ),
      )
    }
  }
  const children =
    entry && typeof entry === 'object'
      ? ((entry as { children?: Record<string, unknown> }).children ?? {})
      : {}
  for (const childKey of Object.keys(children)) {
    if (!childKey) continue
    walkNotesByTypeCandidates(
      ctx,
      path.concat(childKey),
      children[childKey],
      rootId,
      candidates,
      seen,
      tracking,
    )
  }
}

export function collectRandomNoteCandidates(
  ctx: RandomNoteStoreContext,
  rootId = '',
  tracking = loadNoteReviewTracking(),
): RandomNoteCandidate[] {
  const scopedRoots = rootId
    ? ctx.knowledgeTree.filter(n => String(n.id) === rootId)
    : ctx.knowledgeTree
  const candidates: RandomNoteCandidate[] = []
  const seen = new Set<string>()

  const walk = (nodes: KnowledgeNode[]) => {
    for (const node of nodes) {
      const contentMd = resolveNodeMarkdown(ctx, node)
      if (hasMeaningfulNoteContent(contentMd, node.title || '')) {
        const pathText = ctx.getNodePathText(node.id)
        const pathTitles = pathText ? pathText.split(' > ').map(s => s.trim()).filter(Boolean) : []
        if (!seen.has(node.id)) {
          seen.add(node.id)
          candidates.push(
            buildCandidate(
              node.id,
              String(node.title || ''),
              contentMd,
              String(node.updatedAt || ''),
              tracking[node.id],
              { source: 'knowledge_tree', level: Number(node.level || pathTitles.length || 0), pathTitles },
            ),
          )
        }
      }
      walk((node.children ?? []) as KnowledgeNode[])
    }
  }
  walk(scopedRoots)

  for (const typeKey of Object.keys(ctx.notesByType)) {
    if (!typeKey) continue
    walkNotesByTypeCandidates(
      ctx,
      [typeKey],
      ctx.notesByType[typeKey],
      rootId,
      candidates,
      seen,
      tracking,
    )
  }
  return candidates
}

export function getRandomNoteTodayReviewedCount(tracking = loadNoteReviewTracking()): number {
  const today = todayKey()
  return Object.values(tracking).filter(item => {
    return String(item?.lastViewedDate || '') === today && String(item?.lastSource || '') === 'random_note_review'
  }).length
}

export function getRandomNoteRootFilterOptions(ctx: RandomNoteStoreContext) {
  return ctx.knowledgeTree
    .map(node => ({ id: String(node.id || ''), title: String(node.title || '未命名模块') }))
    .filter(item => item.id)
}

function pickWeightedIndex(pool: RandomNoteCandidate[]): number {
  const total = pool.reduce((sum, item) => sum + Math.max(0.001, Number(item.score || 0)), 0)
  if (!Number.isFinite(total) || total <= 0) return Math.floor(Math.random() * pool.length)
  let cursor = Math.random() * total
  for (let i = 0; i < pool.length; i += 1) {
    cursor -= Math.max(0.001, Number(pool[i].score || 0))
    if (cursor <= 0) return i
  }
  return pool.length - 1
}

export function buildRandomNoteReviewQueue(
  ctx: RandomNoteStoreContext,
  options: {
    excludeNodeId?: string
    rootId?: string
    mode?: RandomNoteQueueMode
    skipIds?: Set<string>
    tracking?: Record<string, NoteReviewTrackingEntry>
  } = {},
): RandomNoteCandidate[] {
  const rootId = String(options.rootId ?? '')
  const mode = options.mode === 'priority' ? 'priority' : 'weighted'
  const skipIds = options.skipIds ?? new Set<string>()
  const source = collectRandomNoteCandidates(ctx, rootId, options.tracking).filter(item => {
    if (!item.nodeId) return false
    if (item.nodeId === String(options.excludeNodeId || '')) return false
    if (skipIds.has(item.nodeId)) return false
    return true
  })
  if (!source.length) return []
  if (mode === 'priority') {
    return source.slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    })
  }
  const pool = source.slice()
  const queue: RandomNoteCandidate[] = []
  while (pool.length) {
    const idx = pickWeightedIndex(pool)
    queue.push(pool.splice(idx, 1)[0])
  }
  return queue
}

function isEffectivelyMastered(entry: ErrorEntry): boolean {
  return entry.status === 'mastered' || entry.masteryLevel === 'mastered'
}

export function collectErrorsForRandomNotePractice(ctx: RandomNoteStoreContext, nodeId: string): ErrorEntry[] {
  if (!nodeId) return []
  if (nodeId.startsWith(RANDOM_NOTE_BY_TYPE_PREFIX)) {
    const pathTitles = nodeId.slice(RANDOM_NOTE_BY_TYPE_PREFIX.length).split('::').filter(Boolean)
    const typeKey = pathTitles[0] || ''
    if (!typeKey) return []
    if (pathTitles.length > 1) {
      const node = findNodeByPathTitles(ctx.knowledgeTree, pathTitles)
      if (node) {
        const ids = new Set<string>([node.id])
        const walk = (n: KnowledgeNode) => {
          for (const c of (n.children ?? []) as KnowledgeNode[]) {
            ids.add(c.id)
            walk(c)
          }
        }
        walk(node)
        return ctx.errors.filter(e => e.noteNodeId && ids.has(e.noteNodeId) && !isEffectivelyMastered(e))
      }
    }
    return ctx.errors.filter(e => String(e.type || '') === typeKey && !isEffectivelyMastered(e))
  }
  const node = ctx.getKnowledgeNodeInTree(nodeId)
  if (!node) {
    return ctx.errors.filter(e => e.noteNodeId === nodeId && !isEffectivelyMastered(e))
  }
  const ids = new Set<string>([node.id])
  const walk = (n: KnowledgeNode) => {
    for (const c of (n.children ?? []) as KnowledgeNode[]) {
      ids.add(c.id)
      walk(c)
    }
  }
  walk(node)
  return ctx.errors.filter(e => e.noteNodeId && ids.has(e.noteNodeId) && !isEffectivelyMastered(e))
}

function computePracticePriority(ctx: RandomNoteStoreContext, errorItem: ErrorEntry) {
  const summary = ctx.practiceSummaries[errorItem.id]
  const wrongCount = Math.max(
    Number(summary?.recentWrongCount || 0),
    Number(summary?.wrongCount || 0),
    Number(errorItem.recentWrongCount || 0),
    Number(errorItem.wrongCount || 0),
    Number((errorItem.quiz as { wrongCount?: number } | undefined)?.wrongCount || 0),
  )
  const recentWrong =
    String(summary?.lastResult || '') === 'wrong' ||
    Number(summary?.recentWrongCount || 0) > 0 ||
    String(errorItem.lastResult || '') === 'wrong'
      ? 1
      : 0
  const target = Number(errorItem.targetDurationSec || 0)
  let durationOverTarget = 0
  if (target > 0) {
    const lastDuration = Number(summary?.lastDuration || errorItem.lastDuration || errorItem.actualDurationSec || 0)
    if (lastDuration > 0) durationOverTarget = Math.max(0, Math.min(2, (lastDuration - target) / target))
  }
  const score = 0.5 * wrongCount + 0.3 * recentWrong + 0.2 * durationOverTarget
  return { score, wrongCount, recentWrong, durationOverTarget }
}

export function pickHighValuePracticeQueue(ctx: RandomNoteStoreContext, nodeId: string, limit: number): ErrorEntry[] {
  const pool = collectErrorsForRandomNotePractice(ctx, nodeId)
  return pool
    .map(item => ({ item, priority: computePracticePriority(ctx, item) }))
    .sort((a, b) => {
      if (b.priority.score !== a.priority.score) return b.priority.score - a.priority.score
      if (b.priority.wrongCount !== a.priority.wrongCount) return b.priority.wrongCount - a.priority.wrongCount
      return String(b.item.updatedAt || b.item.lastPracticedAt || '').localeCompare(
        String(a.item.updatedAt || a.item.lastPracticedAt || ''),
      )
    })
    .slice(0, Math.max(1, limit))
    .map(row => row.item)
}

function resolveErrorCreatedAt(error: ErrorEntry): string {
  return String(error.createdAt || error.addDate || error.updatedAt || '')
}

export function pickAllPracticeQueue(ctx: RandomNoteStoreContext, nodeId: string): ErrorEntry[] {
  return collectErrorsForRandomNotePractice(ctx, nodeId).sort((a, b) =>
    resolveErrorCreatedAt(b).localeCompare(resolveErrorCreatedAt(a)),
  )
}

export function resolveOpenWorkspaceNodeId(ctx: RandomNoteStoreContext, nodeId: string): string | null {
  if (!nodeId) return null
  if (nodeId.startsWith(RANDOM_NOTE_BY_TYPE_PREFIX)) {
    const pathTitles = nodeId.slice(RANDOM_NOTE_BY_TYPE_PREFIX.length).split('::').filter(Boolean)
    const linked = findNodeByPathTitles(ctx.knowledgeTree, pathTitles)
    return linked?.id ?? null
  }
  return nodeId
}
