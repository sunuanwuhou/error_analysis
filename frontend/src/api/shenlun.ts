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

const BASE = '/api/shenlun'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
}
