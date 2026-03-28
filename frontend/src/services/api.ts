import type {
  BackupResponse,
  CodexMessage,
  CodexThreadSummary,
  PracticeDailyResponse,
  PracticeLogEntry,
  SyncPullResponse,
  WorkspaceBackup,
} from '@/types/workspace'

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { detail?: string; error?: string }
  if (!response.ok) {
    throw new Error((data as { detail?: string; error?: string }).detail || (data as { detail?: string; error?: string }).error || 'Request failed')
  }
  return data
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })
  return readJson<T>(response)
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return readJson<T>(response)
}

export async function apiPostForm<T>(url: string, body: FormData): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
    body,
  })
  return readJson<T>(response)
}

export async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return readJson<T>(response)
}

export async function getSession() {
  return apiGet<{ authenticated: boolean; user?: { id: string; username: string } }>('/api/me')
}

export async function getBackup() {
  return apiGet<BackupResponse>('/api/backup')
}

export async function saveBackup(body: WorkspaceBackup & { baseUpdatedAt?: string; forceOverwrite?: boolean }) {
  return apiPut<{ ok: boolean; updatedAt: string; currentOrigin?: string }>(
    '/api/backup',
    body,
  )
}

export async function getSync(params: URLSearchParams) {
  return apiGet<SyncPullResponse>(`/api/sync?${params.toString()}`)
}

export async function pushSync(ops: unknown[]) {
  return apiPost<{ ok?: boolean }>('/api/sync', { ops })
}

export async function listCodexThreads() {
  return apiGet<{ ok: boolean; threads: CodexThreadSummary[] }>('/api/codex/threads')
}

export async function getCodexThread(threadId: string) {
  return apiGet<{ ok: boolean; thread: CodexThreadSummary; messages: CodexMessage[] }>(`/api/codex/threads/${threadId}`)
}

export async function createCodexThread(title: string) {
  return apiPost<{ ok: boolean; thread: CodexThreadSummary }>('/api/codex/threads', { title })
}

export async function sendCodexMessage(threadId: string, content: string, context: Record<string, unknown>) {
  return apiPost<{ ok: boolean; message: CodexMessage }>(`/api/codex/threads/${threadId}/messages`, {
    content,
    context,
  })
}

export async function aiDiagnose(errors: unknown[]) {
  return apiPost<{ ok: boolean; result: { summary?: string; weakPoints?: Array<{ area?: string; description?: string; priority?: string; suggestion?: string }> } }>(
    '/api/ai/diagnose',
    { errors },
  )
}

export async function aiChat(message: string, history: Array<{ role: string; content: string }>) {
  return apiPost<{ ok: boolean; reply: string; model?: string }>('/api/ai/chat', {
    message,
    history,
  })
}

export async function aiGenerateQuestion(body: {
  nodeTitle: string
  nodeSummary: string
  referenceError: Record<string, unknown>
  count: number
}) {
  return apiPost<{ ok: boolean; items: Array<{ question?: string; options?: string; answer?: string; analysis?: string }>; model?: string }>(
    '/api/ai/generate-question',
    body,
  )
}

export async function aiEvaluateAnswer(body: {
  question: string
  options?: string
  correctAnswer?: string
  myAnswer?: string
  originalErrorReason?: string
  rootReason?: string
}) {
  return apiPost<{
    ok: boolean
    result: {
      isCorrect: boolean
      analysis?: string
      thoughtProcess?: string
      masteryUpdate?: string
      model?: string
    }
  }>('/api/ai/evaluate-answer', body)
}

export async function getPracticeDaily(limit = 12) {
  return apiGet<PracticeDailyResponse>(`/api/practice/daily?limit=${limit}`)
}

export async function createPracticeLog(body: {
  date: string
  mode: string
  weaknessTag?: string
  total: number
  correct: number
  errorIds: string[]
}) {
  return apiPost<{ ok: boolean; entry: PracticeLogEntry; recent: PracticeLogEntry[] }>('/api/practice/log', body)
}

export async function updateOriginStatus(body: {
  localChangedAt?: string
  lastLoadedAt?: string
  lastSavedAt?: string
  lastBackupUpdatedAt?: string
}) {
  return apiPost<{ ok: boolean; currentOrigin?: string; origins?: BackupResponse['origins'] }>('/api/origin-status', body)
}

export async function aiOcrImage(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiPostForm<{
    ok: boolean
    result?: {
      text?: string
      hint?: string
      variant?: string
      lineCount?: number
      lines?: Array<{ text?: string }>
      alternatives?: Array<{ variant?: string; text?: string; quality?: number; lineCount?: number }>
    }
  }>('/api/ai/ocr-image', form)
}

export async function uploadImage(file: File) {
  const response = await fetch('/api/images', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: await file.arrayBuffer(),
  })
  return readJson<{ ok: boolean; hash: string; url: string }>(response)
}

export async function unrefImage(hash: string) {
  const response = await fetch(`/api/images/${hash}/unref`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })
  return readJson<{ ok: boolean; deleted: boolean }>(response)
}
