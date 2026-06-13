import type { InterviewCategory, InterviewCategoryKey } from '@/data/interviewCategories'

export interface InterviewQuestion {
  id: string
  category: InterviewCategoryKey
  difficulty: number
  question_text: string
  framework: string
  sample_answer: string
  source: string
  created_at: string
}

export interface InterviewPracticeRecord {
  id: string
  question_id: string
  my_answer: string
  polished_answer: string
  note: string
  is_starred: boolean
  practiced_at: string
  updated_at: string
  next_review_at: string
  review_stage: number
  last_review_at: string
}

export interface InterviewQuestionInput {
  category: InterviewCategoryKey
  difficulty?: number
  question_text: string
  framework?: string
  sample_answer?: string
  source?: string
}

export interface InterviewImportResult {
  ok: boolean
  added: number
  updated: number
  items: InterviewQuestion[]
}

const BASE = '/api/interview'

function formatRequestError(status: number, body: unknown): string {
  const o = body as { detail?: unknown }
  const d = o?.detail
  if (typeof d === 'string' && d.trim()) return d
  if (Array.isArray(d)) {
    const parts = d.map((x) =>
      typeof x === 'object' && x && 'msg' in x ? String((x as { msg?: string }).msg) : String(x),
    )
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

export const interviewApi = {
  listCategories() {
    return request<{ items: InterviewCategory[] }>('/categories')
  },

  createCategory(data: { label: string; id?: string; sort_order?: number }) {
    return request<{ category: InterviewCategory }>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateCategory(categoryId: string, data: { label: string; sort_order?: number }) {
    return request<{ category: InterviewCategory }>(`/categories/${encodeURIComponent(categoryId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteCategory(categoryId: string) {
    return request<{ ok: boolean; id: string }>(`/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE',
    })
  },

  listQuestions(category?: InterviewCategoryKey | '') {
    const q = new URLSearchParams()
    const c = (category ?? '').trim()
    if (c) q.set('category', c)
    const qs = q.toString()
    return request<{ items: InterviewQuestion[] }>(`/questions${qs ? `?${qs}` : ''}`)
  },

  createQuestion(data: InterviewQuestionInput) {
    return request<{ question: InterviewQuestion }>('/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateQuestion(questionId: string, data: InterviewQuestionInput) {
    return request<{ question: InterviewQuestion }>(`/questions/${encodeURIComponent(questionId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteQuestion(questionId: string) {
    return request<{ ok: boolean; id: string }>(`/questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    })
  },

  importQuestions(payload: { format: 'json' | 'markdown'; content: string }) {
    return request<InterviewImportResult>('/questions/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getQuestion(questionId: string) {
    return request<{ question: InterviewQuestion }>(`/questions/${encodeURIComponent(questionId)}`)
  },

  listRecords() {
    return request<{ items: InterviewPracticeRecord[] }>('/records')
  },

  upsertRecord(data: {
    question_id: string
    my_answer?: string
    polished_answer?: string
    note?: string
    is_starred?: boolean
  }) {
    return request<{ record: InterviewPracticeRecord }>('/records', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  submitReview(data: { question_id: string; rating: 'smooth' | 'ok' | 'forgot' }) {
    return request<{ record: InterviewPracticeRecord }>('/records/review', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}
