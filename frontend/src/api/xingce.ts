// ── 数据类型 ─────────────────────────────────────────────────────────────────

import {
  cloneDefaultDirTree,
  cloneDefaultTypeRules,
  type DirTree,
  type TypeRule,
} from '@/lib/xingceDefaults'

export type { DirTree, TypeRule }

export interface ErrorEntry {
  id: string
  type: string
  subtype: string
  subSubtype?: string
  question?: string
  options?: string          // 选项文本，用 \n 或 | 分隔
  answer?: string
  myAnswer?: string
  analysis?: string
  analysisImgData?: string
  tip?: string
  nextAction?: string
  note?: string
  imgData?: string
  status: 'focus' | 'review' | 'mastered'
  masteryLevel?: 'not_mastered' | 'fuzzy' | 'mastered'
  workflowStage?: string
  confidence?: number
  problemType?: 'cognition' | 'execution' | 'mixed' | 'unknown'
  nextActionType?: string
  rootReason?: string
  errorReason?: string
  mistakeType?: string
  noteNodeId?: string
  actualDurationSec?: number
  targetDurationSec?: number
  difficulty?: number
  addDate?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

export interface KnowledgeNode {
  id: string
  parentId: string | null
  title: string
  path?: string[]
  level?: number
  order?: number
  noteContent?: string
  /** Markdown 正文（与旧版 knowledge node `contentMd` 对齐） */
  contentMd?: string
  updatedAt?: string
  children?: KnowledgeNode[]
}

export interface AttemptSummary {
  recentWrongCount?: number
  wrongCount?: number
  lastConfidence?: number
  lastDuration?: number
  avgDuration?: number
  lastResult?: string
  lastTime?: string
}

/** GET /api/practice/attempts 单条练习记录（与后端 read_practice_attempts 对齐） */
export interface PracticeAttemptRow {
  id: string
  createdAt?: string
  updatedAt?: string
  sessionMode?: string
  errorId?: string
  questionId?: string
  type?: string
  subtype?: string
  questionText?: string
  myAnswer?: string
  result?: string
  durationSec?: number
  confidence?: number
  [key: string]: unknown
}

export interface TodayTrainingSession {
  sessionId: string
  date: string
  status: 'in_progress' | 'paused' | 'done'
  totalCount: number
  queueSize?: number
  completedCount: number
  remainingCount: number
  currentIndex: number
  nextItemId?: string
  nextQuestion?: Record<string, unknown> | null
  queue: Record<string, unknown>[]
  createdAt?: string
  updatedAt?: string
}

export interface LocalBackupItem {
  id: string
  kind?: string
  label?: string
  createdAt?: string
  updatedAt?: string
  summary?: {
    errorCount?: number
    knowledgeNodeCount?: number
    noteModuleCount?: number
  }
  [key: string]: unknown
}

/** GET /api/sync 返回的原始 op 结构 */
export interface SyncOp {
  id: string
  op_type: string
  entity_id: string
  payload: unknown
  created_at: string
}

export interface SyncPullResponse {
  ops: SyncOp[]
  snapshot_updated_at?: string
}

/** 从 ops 中重建的工作区状态快照 */
export interface WorkspaceSnapshot {
  errors: ErrorEntry[]
  knowledgeNodes: KnowledgeNode[]
  notesByType: Record<string, unknown>
  noteImages: Record<string, string>
  typeRules: TypeRule[]
  dirTree: DirTree
}

// ── HTTP 工具 ────────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── ops → 快照重建 ───────────────────────────────────────────────────────────

function parsePayload(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Record<string, unknown> } catch { return {} }
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  return {}
}

export function opsToSnapshot(ops: SyncOp[]): WorkspaceSnapshot {
  const errorsMap = new Map<string, ErrorEntry>()
  const knowledgeMap = new Map<string, KnowledgeNode>()
  const notesByType: Record<string, unknown> = {}
  const noteImages: Record<string, string> = {}
  let typeRules: TypeRule[] | null = null
  let dirTree: DirTree | null = null

  for (const op of ops) {
    const payload = parsePayload(op.payload)

    switch (op.op_type) {
      case 'error_upsert': {
        const id = String(payload.id || op.entity_id)
        errorsMap.set(id, { ...payload, id } as ErrorEntry)
        break
      }
      case 'error_delete':
        errorsMap.delete(String(op.entity_id))
        break

      case 'knowledge_node_upsert': {
        const id = String(payload.id || op.entity_id)
        knowledgeMap.set(id, { ...payload, id } as KnowledgeNode)
        break
      }
      case 'knowledge_node_delete':
        knowledgeMap.delete(String(op.entity_id))
        break

      case 'note_type_upsert': {
        const key = String((payload as { key?: string }).key || op.entity_id)
        notesByType[key] = (payload as { value?: unknown }).value ?? {}
        break
      }
      case 'note_type_delete':
        delete notesByType[String(op.entity_id)]
        break

      case 'note_image_upsert': {
        const key = String((payload as { id?: string }).id || op.entity_id)
        noteImages[key] = String((payload as { data?: string }).data ?? '')
        break
      }
      case 'note_image_delete':
        delete noteImages[String(op.entity_id)]
        break

      case 'setting_upsert': {
        const key = String((payload as { key?: string }).key || op.entity_id || '')
        const value = (payload as { value?: unknown }).value
        if (key === 'type_rules' && Array.isArray(value)) typeRules = value as TypeRule[]
        if (key === 'dir_tree' && value && typeof value === 'object') dirTree = value as DirTree
        break
      }
      case 'setting_delete': {
        const key = String(op.entity_id || '')
        if (key === 'type_rules') typeRules = null
        if (key === 'dir_tree') dirTree = null
        break
      }
    }
  }

  return {
    errors: [...errorsMap.values()],
    knowledgeNodes: [...knowledgeMap.values()],
    notesByType,
    noteImages,
    typeRules: typeRules ?? cloneDefaultTypeRules(),
    dirTree: dirTree ?? cloneDefaultDirTree(),
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

export const xingceApi = {
  /** 当前登录用户 */
  getMe(): Promise<{ authenticated: boolean; user?: { id: string; username: string } }> {
    return request('/api/me')
  },

  /** 登出（清 cookie） */
  logout(): Promise<{ ok: boolean }> {
    return request('/api/auth/logout', { method: 'POST' })
  },

  /** 拉取全量 ops，重建本地快照 */
  async load(): Promise<WorkspaceSnapshot> {
    const res = await request<SyncPullResponse>('/api/sync')
    return opsToSnapshot(res.ops)
  },

  /** 推送单条或多条 op（upsert/delete，payload 可省略） */
  push(
    ops: Array<{ op_type: string; entity_id: string; payload?: unknown; id?: string; created_at?: string }>,
  ): Promise<{ ok: boolean }> {
    return request('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ ops }),
    })
  },

  /** 最近练习记录时间线 */
  getPracticeAttempts(limit = 120): Promise<{ ok: boolean; items: PracticeAttemptRow[] }> {
    return request(`/api/practice/attempts?limit=${limit}`)
  },

  /** 获取多条错题的练习摘要，返回 { items: { [errorId]: AttemptSummary } } */
  getAttemptSummaries(errorIds: string[]): Promise<{ items: Record<string, AttemptSummary> }> {
    if (!errorIds.length) return Promise.resolve({ items: {} })
    const q = `error_ids=${encodeURIComponent(errorIds.join(','))}`
    return request<{ items: Record<string, AttemptSummary> }>(`/api/practice/attempts/summary?${q}`)
  },

  /** 获取练习工作台数据（badge 计数、队列） */
  getWorkbench(limit = 6): Promise<{
    ok: boolean
    dailyQueue: unknown[]
    reviewQueue: unknown[]
    retrainQueue: unknown[]
    practicedTodayCount?: number
  }> {
    return request(`/api/practice/workbench?limit=${limit}`)
  },

  /** 获取今日练习队列 */
  getDaily(limit = 12): Promise<{
    ok: boolean
    items: unknown[]
    practicedTodayCount: number
    reviewQueue: unknown[]
    retrainQueue: unknown[]
  }> {
    return request(`/api/practice/daily?limit=${limit}`)
  },

  startTodaySession(limit = 30): Promise<{ ok: boolean; session: TodayTrainingSession }> {
    return request(`/api/practice/today/start?limit=${limit}`, { method: 'POST' })
  },

  getTodaySession(): Promise<{ ok: boolean; exists: boolean; session: TodayTrainingSession | null }> {
    return request('/api/practice/today/current')
  },

  pauseTodaySession(sessionId: string): Promise<{ ok: boolean; session?: TodayTrainingSession }> {
    return request('/api/practice/today/pause', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    })
  },

  answerTodaySession(sessionId: string, itemId: string, isCorrect: boolean): Promise<{ ok: boolean; session?: TodayTrainingSession }> {
    return request('/api/practice/today/answer', {
      method: 'POST',
      body: JSON.stringify({ sessionId, itemId, isCorrect }),
    })
  },

  /** 学习统计 */
  getInsights(limit = 12): Promise<Record<string, unknown>> {
    return request(`/api/practice/insights?limit=${limit}`)
  },

  /** 云端全量读取 */
  getCloudBackup(): Promise<Record<string, unknown>> {
    return request('/api/backup')
  },

  /** 云端全量写入 */
  putCloudBackup(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return request('/api/backup', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  /** 本地备份列表 */
  listLocalBackups(): Promise<{ ok: boolean; items: LocalBackupItem[] }> {
    return request('/api/local-backups')
  },

  /** 创建本地备份 */
  createLocalBackup(payload: { kind?: string; label?: string; skipRecentHours?: number }): Promise<Record<string, unknown>> {
    return request('/api/local-backups/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  /** 恢复本地备份 */
  restoreLocalBackup(backupId: string, createSafetyBackup = true): Promise<Record<string, unknown>> {
    return request('/api/local-backups/restore', {
      method: 'POST',
      body: JSON.stringify({ backupId, createSafetyBackup }),
    })
  },

  /** 删除本地备份 */
  deleteLocalBackup(backupId: string): Promise<Record<string, unknown>> {
    return request(`/api/local-backups/${encodeURIComponent(backupId)}`, {
      method: 'DELETE',
    })
  },

  /** 记录一次练习结果 */
  logAttempt(data: { errorId: string; correct: boolean; durationSec: number }): Promise<void> {
    return request('/api/practice/log', {
      method: 'POST',
      body: JSON.stringify({
        error_id: data.errorId,
        correct: data.correct,
        duration_sec: data.durationSec,
      }),
    })
  },
}
