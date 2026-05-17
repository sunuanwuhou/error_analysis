export interface SuitePaperRow {
  id: string
  source_rel_path: string
  title: string
  folder: string
  created_at?: string
  question_count: number
}

export interface SuiteQuestionRow {
  id: string
  seq_no: number
  question_no: string
  stem: string
  options: string
  answer: string
  analysis: string
  type_label?: string
  img_data?: string
  meta?: Record<string, unknown>
}

export interface SuitePaperDetail {
  id: string
  title: string
  folder: string
  source_rel_path?: string
  questions: SuiteQuestionRow[]
}

export interface SuiteSearchHit {
  id: string
  paper_id: string
  seq_no: number
  question_no: string
  stem: string
  options: string
  answer: string
  paper_title: string
  paper_folder: string
  source_rel_path: string
}

/** 套卷级命中（标题 / 文件夹 / 路径），与小题检索并列返回 */
export interface SuitePaperSearchHit {
  id: string
  title: string
  folder: string
  source_rel_path: string
  question_count: number
}

export interface SuitePracticeItemPayload {
  question_id: string
  question_no: string
  picked: string | null
  answer: string
  correct: boolean
  skipped: boolean
}

export interface SuitePracticeRecordRow {
  id: string
  paper_id: string
  paper_title: string
  paper_folder: string
  mode: string
  created_at: string
  duration_sec: number
  correct_count: number
  wrong_count: number
  unanswered_count: number
  submitted_count: number
  payload: Record<string, unknown>
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

async function postJson<TOut>(path: string, body: unknown): Promise<TOut> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    window.location.href = '/login.html'
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<TOut>
}

export interface SuitePracticeRecordPostBody {
  paper_id: string
  paper_title: string
  paper_folder: string
  mode: string
  duration_sec: number
  correct_count: number
  wrong_count: number
  unanswered_count: number
  submitted_count: number
  items: SuitePracticeItemPayload[]
}

export const suiteBankApi = {
  async listPapers(): Promise<SuitePaperRow[]> {
    const data = await getJson<{ papers: SuitePaperRow[] }>('/api/suite-bank/papers')
    return data.papers ?? []
  },

  async getPaper(paperId: string): Promise<SuitePaperDetail> {
    return getJson<SuitePaperDetail>(`/api/suite-bank/papers/${encodeURIComponent(paperId)}`)
  },

  async search(q: string, limit = 80): Promise<{ items: SuiteSearchHit[]; papers: SuitePaperSearchHit[] }> {
    const data = await getJson<{ items: SuiteSearchHit[]; papers: SuitePaperSearchHit[] }>(
      `/api/suite-bank/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    )
    return { items: data.items ?? [], papers: data.papers ?? [] }
  },

  async appendPracticeRecord(body: SuitePracticeRecordPostBody): Promise<{ id: string; ok: boolean }> {
    return postJson<{ id: string; ok: boolean }>('/api/suite-bank/practice-records', body)
  },

  async listPracticeRecords(limit = 50, paperId?: string): Promise<SuitePracticeRecordRow[]> {
    const q = new URLSearchParams({ limit: String(limit) })
    if (paperId) q.set('paper_id', paperId)
    const data = await getJson<{ records: SuitePracticeRecordRow[] }>(
      `/api/suite-bank/practice-records?${q.toString()}`,
    )
    return data.records ?? []
  },
}
