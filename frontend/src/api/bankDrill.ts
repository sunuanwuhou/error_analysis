import type { SuiteQuestionRow } from '@/api/suiteBank'

export type ExamTrackApi = 'provincial' | 'unified'

export interface BankDrillMetaResponse {
  region: string
  exam_track: string
  years: number[]
  default_years: number[]
  year_catalog: number[]
  calendar_year: number
  modules: { id: string; label: string; count: number; total_count: number; used_count: number }[]
}

export interface BankDrillStartResponse {
  session_id: string
  exam_track: string
  years: number[]
  major_module: string
  major_module_label: string
  requested_count: number
  actual_count: number
  questions: SuiteQuestionRow[]
}

export interface BankDrillExportRecord {
  id: string
  file_name: string
  exam_track: string
  years: number[]
  modules: string[]
  count: number
  question_ids: string[]
  title_text: string
  created_at: string
  updated_at: string
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

async function postEmptyJson<TOut>(path: string): Promise<TOut> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
  })
  if (res.status === 401) {
    window.location.href = '/login.html'
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<TOut>
}

export const BANK_DRILL_PAPER_ID = '__bank_drill__'

export const bankDrillApi = {
  meta(examTrack: ExamTrackApi, years: number[]): Promise<BankDrillMetaResponse> {
    const u = new URLSearchParams()
    u.set('exam_track', examTrack)
    for (const y of years) u.append('years', String(y))
    return getJson<BankDrillMetaResponse>(`/api/suite-bank/bank-drill/meta?${u.toString()}`)
  },

  start(body: {
    exam_track: ExamTrackApi
    major_module: string
    count: number
    years?: number[]
  }): Promise<BankDrillStartResponse> {
    return postJson<BankDrillStartResponse>('/api/suite-bank/bank-drill/start', body)
  },

  resetHistory(): Promise<{ ok: boolean; cleared_count: number }> {
    return postEmptyJson<{ ok: boolean; cleared_count: number }>('/api/suite-bank/bank-drill/history/reset')
  },

  async listExports(limit = 50): Promise<BankDrillExportRecord[]> {
    const data = await getJson<{ items: BankDrillExportRecord[] }>(
      `/api/suite-bank/bank-drill/exports?limit=${limit}`,
    )
    return data.items ?? []
  },

  exportPrintUrl(exportId: string): string {
    return `/api/suite-bank/bank-drill/exports/${encodeURIComponent(exportId)}/print`
  },

  async deleteExport(exportId: string): Promise<{ ok: boolean }> {
    const res = await fetch(`/api/suite-bank/bank-drill/exports/${encodeURIComponent(exportId)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.status === 401) {
      window.location.href = '/login.html'
      throw new Error('unauthorized')
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<{ ok: boolean }>
  },
}
