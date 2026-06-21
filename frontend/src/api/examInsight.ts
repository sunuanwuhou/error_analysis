export interface ExamInsightKnowledgePoint {
  id: string
  label: string
  count: number
  pct: number
  source_tags: string[]
  by_year: Record<string, number>
}

export interface ExamInsightCategory {
  id: string
  label: string
  count: number
  pct: number
  knowledge_points: ExamInsightKnowledgePoint[]
}

export interface ExamInsightModule {
  id: string
  label: string
  count: number
  pct: number
  categories: ExamInsightCategory[]
}

export interface ExamInsightResponse {
  filters: {
    region: string
    exam_track: string
    exam_track_label: string
    years: number[]
  }
  summary: {
    paper_count: number
    question_count: number
    taxonomy_version: number
    taxonomy_source_note: string
    knowledge_point_total: number
    unmapped_tag_count: number
  }
  by_major_module: Array<{ id: string; label: string; count: number; pct: number }>
  by_year: Array<{ year: number; total: number; modules: Record<string, number> }>
  modules: ExamInsightModule[]
  unmapped_tags: Array<{ tag: string; count: number; pct: number; by_year: Record<string, number> }>
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  if (res.status === 401) {
    window.location.href = '/login.html'
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const examInsightApi = {
  async fetch(opts?: { examTrack?: 'provincial' | 'unified'; years?: number[] }): Promise<ExamInsightResponse> {
    const q = new URLSearchParams()
    if (opts?.examTrack) q.set('exam_track', opts.examTrack)
    if (opts?.years?.length) q.set('years', opts.years.join(','))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return getJson<ExamInsightResponse>(`/api/suite-bank/exam-insight${suffix}`)
  },
}
