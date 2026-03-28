export interface CloudUser {
  id: string
  username: string
}

export interface ErrorEntry {
  id: string
  type?: string
  subtype?: string
  subSubtype?: string
  question?: string
  options?: string
  answer?: string
  myAnswer?: string
  analysis?: string
  rootReason?: string
  errorReason?: string
  status?: string
  noteNodeId?: string
  entryKind?: 'error' | 'claude_bank' | string
  updatedAt?: string
  masteryLevel?: string
  lastPracticedAt?: string
  difficulty?: number
  srcYear?: string
  srcProvince?: string
  srcOrigin?: string
  imgData?: string
  analysisImgData?: string
  note?: string
  addDate?: string
}

export interface NotesEntry {
  content?: string
  updatedAt?: string
}

export interface KnowledgeNode {
  id: string
  title: string
  contentMd: string
  updatedAt: string
  parentId: string
  children: KnowledgeNode[]
}

export interface LegacyKnowledgeNoteEntry {
  title?: string
  content?: string
  updatedAt?: string
}

export interface WorkspaceBackup {
  xc_version?: number
  exportTime?: string
  errors: ErrorEntry[]
  revealed: string[]
  expTypes: string[]
  expMain: string[]
  expMainSub: string[]
  expMainSub2: string[]
  notesByType: Record<string, NotesEntry>
  noteImages: Record<string, string>
  typeRules: unknown
  dirTree: unknown
  globalNote: string
  knowledgeTree: unknown
  knowledgeNotes: Record<string, string | LegacyKnowledgeNoteEntry>
  knowledgeExpanded: string[]
  todayDate: string
  todayDone: number
  history: unknown[]
}

export interface OriginStatus {
  origin: string
  lastLocalChangeAt?: string
  lastLoadedAt?: string
  lastSavedAt?: string
  lastBackupUpdatedAt?: string
  updatedAt?: string
}

export interface BackupResponse {
  exists: boolean
  updatedAt?: string
  currentOrigin?: string
  backup: WorkspaceBackup | null
  payload?: WorkspaceBackup | null
  origins: OriginStatus[]
}

export interface SyncOp {
  id: string
  op_type: string
  entity_id: string
  payload: unknown
  created_at: string
}

export interface SyncPullResponse {
  ops: SyncOp[]
  serverTime: string
  hasMore: boolean
  nextCursorAt?: string
  nextCursorId?: string
}

export interface CodexThreadSummary {
  id: string
  title: string
  archived?: boolean
  createdAt?: string
  updatedAt?: string
  lastMessagePreview?: string
  lastMessageRole?: string
  lastMessageAt?: string
  lastMessageStatus?: string
  messageCount?: number
  pendingCount?: number
  replyCount?: number
}

export interface CodexMessage {
  id: string
  threadId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  status: string
  errorText?: string
  createdAt: string
  repliedAt?: string
  context?: Record<string, unknown>
}

export interface PracticeLogEntry {
  id?: string
  date: string
  mode: string
  weaknessTag?: string
  total: number
  correct: number
  errorIds: string[]
  createdAt?: string
}

export interface PracticeDailyResponse {
  ok: boolean
  items: ErrorEntry[]
  recentLogs: PracticeLogEntry[]
  practicedTodayCount: number
}
