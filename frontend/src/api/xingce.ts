// ── 数据类型 ─────────────────────────────────────────────────────────────────

export interface ErrorEntry {
  id: string
  type: string
  subtype: string
  subSubtype?: string
  question?: string
  answer?: string
  analysis?: string
  tip?: string
  status: 'unmastered' | 'learning' | 'mastered'
  masteryLevel?: number
  confidence?: number
  problemType?: 'cognition' | 'execution' | 'speed'
  rootReason?: string
  errorReason?: string
  noteNodeId?: string
  actualDurationSec?: number
  targetDurationSec?: number
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
  children?: KnowledgeNode[]
}

export interface AttemptSummary {
  errorId: string
  totalCount: number
  correctCount: number
  lastAttemptAt?: string
  lastDurationSec?: number
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
  knowledgeNodes: KnowledgeNode[]          // 扁平列表，由 store 组装成树
  notesByType: Record<string, unknown>      // note_type entity
  noteImages: Record<string, string>        // note_image entity (base64)
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
    }
  }

  return {
    errors: [...errorsMap.values()],
    knowledgeNodes: [...knowledgeMap.values()],
    notesByType,
    noteImages,
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

export const xingceApi = {
  /** 拉取全量 ops，重建本地快照 */
  async load(): Promise<WorkspaceSnapshot> {
    const res = await request<SyncPullResponse>('/api/sync')
    return opsToSnapshot(res.ops)
  },

  /** 推送单条或多条 op（upsert/delete） */
  push(ops: Omit<SyncOp, 'id' | 'created_at'>[]): Promise<{ ok: boolean }> {
    return request('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ ops }),
    })
  },

  /** 获取多条错题的练习摘要 */
  getAttemptSummaries(errorIds: string[]): Promise<AttemptSummary[]> {
    if (!errorIds.length) return Promise.resolve([])
    const q = errorIds.map(id => `id=${encodeURIComponent(id)}`).join('&')
    return request<AttemptSummary[]>(`/api/practice/attempts/summary?${q}`)
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
