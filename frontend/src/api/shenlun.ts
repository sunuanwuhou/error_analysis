export interface SourceRecord {
  id: string
  question_text_raw: string
  material_text_raw: string
  status: 'raw_draft' | 'formatted' | 'extracted' | 'cc_done'
  node_id: string
  paper_year: string
  paper_province: string
  paper_suite_type: string
  created_at: string
  updated_at: string
}

export interface SourceSummary extends SourceRecord {
  attempt_count: number
  /** 历史成功复盘次数（多轮） */
  cc_success_count?: number
  /** 最近一轮练习的批改状态（无练习时为 null） */
  latest_cc_status?: 'none' | 'pending' | 'success' | 'failed' | null
  /** 最近一轮成功复盘的 issue tags */
  latest_issue_tags?: string[]
  top_issue_tag?: string | null
}

export interface AttemptSummary {
  id: string
  attempt_no: number
  cc_status: string
  created_at: string
  updated_at: string
  issue_tags?: string[]
}

export interface Segment {
  index: number
  source_text: string
  my_extraction: string
  /** 当前段落内的最终归纳（与「我的提炼」分列） */
  my_segment_summary?: string
}

export interface Attempt {
  id: string
  source_id: string
  /** 本题所属知识点（与 Hub 列表筛选一致，刷新后用于带回正确节点） */
  source_node_id?: string
  attempt_no: number
  segments: Segment[]
  my_final_summary: string
  cc_status: 'none' | 'pending' | 'success' | 'failed'
  cc_result_json: CCResult | null
  created_at: string
  updated_at: string
}

export interface SourceDetailResponse {
  source: SourceRecord
  latest_attempt: Attempt | null
}

export interface SegmentReview {
  segment_index: number
  source_segment_text: string
  my_extraction: string
  reference_extraction: string
  matched_points: string[]
  missed_points: string[]
  wrong_points: string[]
  issue_tags: string[]
  cc_comment: string
}

export interface CCResult {
  segments: SegmentReview[]
  reference_final_summary: string
  overall_comment: string
  overall_issue_tags: string[]
}

export interface HubNoteRecord {
  node_id: string
  body_md: string
  updated_at: string
}

export interface ShenlunCustomNode {
  id: string
  parent_id: string
  title: string
  sort_order?: number
  created_at?: string
  updated_at?: string
}

export interface ShenlunKnowledgeTreeResponse {
  tree: Array<{
    id: string
    title: string
    children: ShenlunCustomNode[]
  }>
  custom_nodes: ShenlunCustomNode[]
}

export interface IssueEntry {
  id: string
  node_id: string
  source_id: string
  attempt_id: string
  attempt_no: number
  scope: 'segment' | 'overall'
  segment_index: number | null
  issue_tag: string
  missed_points: string[]
  wrong_points: string[]
  cc_comment: string
  question_preview: string
  paper_year: string
  paper_province: string
  paper_suite_type: string
  detected_at: string
  status: string
}

export interface IssueTagCount {
  tag: string
  count: number
  last_at: string
}

export interface IssueStats {
  tag_counts: IssueTagCount[]
  total_entries: number
  sources_with_issues: number
  attempts_with_issues: number
  recent_7d_count: number
}

const BASE = '/api/shenlun'

function formatRequestError(status: number, body: unknown): string {
  const o = body as { detail?: unknown }
  const d = o?.detail
  if (typeof d === 'string' && d.trim()) return d
  if (Array.isArray(d)) {
    const parts = d.map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg?: string }).msg) : String(x)))
    const s = parts.filter(Boolean).join('；')
    if (s) return s
  }
  return `HTTP ${status}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(formatRequestError(res.status, err))
  }
  return res.json() as Promise<T>
}

export const shenlunApi = {
  listSources(nodeId: string, search?: string) {
    const q = new URLSearchParams()
    q.set('node_id', nodeId)
    const s = (search ?? '').trim()
    if (s) q.set('q', s)
    return request<{ items: SourceSummary[] }>(`/sources?${q.toString()}`)
  },

  deleteSource(sourceId: string) {
    return request<{ ok: boolean; id: string }>(
      `/sources/${encodeURIComponent(sourceId)}`,
      { method: 'DELETE' },
    )
  },

  getSource(sourceId: string) {
    return request<SourceDetailResponse>(`/sources/${encodeURIComponent(sourceId)}`)
  },

  listAttemptsForSource(sourceId: string) {
    return request<{ items: AttemptSummary[] }>(
      `/sources/${encodeURIComponent(sourceId)}/attempts`,
    )
  },

  deleteAttempt(attemptId: string) {
    return request<{ ok: boolean; id: string; source_id: string }>(
      `/attempts/${encodeURIComponent(attemptId)}`,
      { method: 'DELETE' },
    )
  },

  patchSourceNode(sourceId: string, node_id: string) {
    return request<SourceRecord>(`/sources/${encodeURIComponent(sourceId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ node_id }),
    })
  },

  upsertSource(data: {
    question_text_raw: string
    material_text_raw: string
    node_id?: string | null
    paper_year?: string
    paper_province?: string
    paper_suite_type?: string
  }) {
    return request<SourceRecord>('/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  createAttempt(sourceId: string) {
    return request<Attempt>('/attempts', {
      method: 'POST',
      body: JSON.stringify({ source_id: sourceId }),
    })
  },

  saveAttempt(attemptId: string, data: { segments: Segment[]; my_final_summary: string }) {
    return request<Attempt>(`/attempts/${attemptId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  /** Get the structured prompt text the user copies into their AI. */
  getCCPrompt(attemptId: string) {
    return request<{ attempt_id: string; prompt: string }>(
      `/attempts/${attemptId}/cc-prompt`,
    )
  },

  /** Submit the JSON text the user pasted back from their AI. */
  pasteCCResult(attemptId: string, ccRaw: string) {
    return request<Attempt>(`/attempts/${attemptId}/paste-cc-result`, {
      method: 'POST',
      body: JSON.stringify({ cc_raw: ccRaw }),
    })
  },

  getAttempt(attemptId: string) {
    return request<Attempt>(`/attempts/${attemptId}`)
  },

  getHubNote(nodeId: string) {
    const q = new URLSearchParams()
    q.set('node_id', nodeId)
    return request<HubNoteRecord>(`/hub-notes?${q.toString()}`)
  },

  putHubNote(nodeId: string, body_md: string) {
    return request<HubNoteRecord>('/hub-notes', {
      method: 'PUT',
      body: JSON.stringify({ node_id: nodeId, body_md }),
    })
  },

  getKnowledgeTree() {
    return request<ShenlunKnowledgeTreeResponse>('/knowledge-tree')
  },

  createKnowledgeNode(parent_id: string, title: string) {
    return request<ShenlunCustomNode>('/knowledge-nodes', {
      method: 'POST',
      body: JSON.stringify({ parent_id, title }),
    })
  },

  patchKnowledgeNode(nodeId: string, title: string) {
    return request<ShenlunCustomNode>(`/knowledge-nodes/${encodeURIComponent(nodeId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    })
  },

  deleteKnowledgeNode(nodeId: string) {
    return request<{ ok: boolean; id: string }>(
      `/knowledge-nodes/${encodeURIComponent(nodeId)}`,
      { method: 'DELETE' },
    )
  },

  listIssueFeed(params: {
    nodeId: string
    tag?: string
    scope?: 'segment' | 'overall' | ''
    sourceId?: string
    limit?: number
    offset?: number
  }) {
    const q = new URLSearchParams()
    q.set('node_id', params.nodeId)
    if (params.tag?.trim()) q.set('tag', params.tag.trim())
    if (params.scope) q.set('scope', params.scope)
    if (params.sourceId?.trim()) q.set('source_id', params.sourceId.trim())
    if (params.limit) q.set('limit', String(params.limit))
    if (params.offset) q.set('offset', String(params.offset))
    return request<{ items: IssueEntry[]; total: number }>(`/issue-feed?${q.toString()}`)
  },

  getIssueStats(nodeId: string) {
    const q = new URLSearchParams()
    q.set('node_id', nodeId)
    return request<IssueStats>(`/issue-stats?${q.toString()}`)
  },
}
