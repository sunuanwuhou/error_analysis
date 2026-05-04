export interface SourceRecord {
  id: string
  question_text_raw: string
  material_text_raw: string
  status: 'raw_draft' | 'formatted' | 'extracted' | 'cc_done'
  created_at: string
  updated_at: string
}

export interface Segment {
  index: number
  source_text: string
  my_extraction: string
}

export interface Attempt {
  id: string
  source_id: string
  attempt_no: number
  segments: Segment[]
  my_final_summary: string
  cc_status: 'none' | 'pending' | 'success' | 'failed'
  cc_result_json: CCResult | null
  created_at: string
  updated_at: string
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
  upsertSource(data: { question_text_raw: string; material_text_raw: string }) {
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
