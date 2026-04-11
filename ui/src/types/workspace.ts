export type BackupMetaResponse = {
  exists: boolean
  currentOrigin: string
  updatedAt?: string
  payloadBytes: number
  summary: Record<string, number | string | null>
  origins: Array<Record<string, string | null>>
}

export type KnowledgeTreeNode = {
  id: string
  title: string
  children?: KnowledgeTreeNode[]
}

export type TypeRuleItem = {
  keywords: string[]
  type: string
  subtype?: string
}

export type WorkspaceSnapshot = {
  xc_version?: number
  exportTime?: string
  baseUpdatedAt?: string
  forceOverwrite?: boolean
  errors?: ErrorSummary[]
  revealed?: string[]
  expTypes?: string[]
  expMain?: string[]
  expMainSub?: string[]
  expMainSub2?: string[]
  notesByType?: Record<string, unknown>
  noteImages?: Record<string, unknown>
  typeRules?: TypeRuleItem[] | null
  dirTree?: unknown
  globalNote?: string
  knowledgeTree?: KnowledgeTreeNode[] | { roots?: KnowledgeTreeNode[] }
  knowledgeNotes?: Record<string, unknown>
  knowledgeExpanded?: string[]
  todayDate?: string
  todayDone?: number
  history?: PracticeHistoryRecord[]
}

export type BackupPayloadResponse = BackupMetaResponse & {
  payload?: WorkspaceSnapshot | null
  backup?: WorkspaceSnapshot | null
}

export type LocalBackupItem = {
  id: string
  kind?: string
  label?: string
  createdAt?: string
  sizeBytes?: number
  errorCount?: number
  knowledgeNodeCount?: number
  knowledgeNoteCount?: number
  noteModuleCount?: number
  noteImageRefCount?: number
  imageFileCount?: number
  userImageRowCount?: number
}

export type LocalBackupsResponse = {
  ok: true
  items: LocalBackupItem[]
}

export type ErrorSummary = {
  id?: string
  entryKind?: string
  type?: string
  subtype?: string
  subSubtype?: string
  question?: string
  options?: string
  answer?: string
  myAnswer?: string
  status?: string
  workflowStage?: string
  problemType?: string
  nextActionType?: string
  confidence?: number
  difficulty?: number
  errorReason?: string
  rootReason?: string
  analysis?: string
  nextAction?: string
  tip?: string
  masteryLevel?: string
  masteryUpdatedAt?: string | null
  lastPracticedAt?: string | null
  updatedAt?: string
  addDate?: string
  createdAt?: string
  noteNodeId?: string
  imgData?: string
  analysisImgData?: string
  srcYear?: string
  srcProvince?: string
  srcOrigin?: string
  knowledgePathTitles?: string[]
  knowledgePath?: string
  knowledgeNodePath?: string
  notePath?: string
  mistakeType?: string
  triggerPoint?: string
  correctModel?: string
  processCanvasData?: string
  processImage?: {
    imageUrl?: string
    updatedAt?: string
  }
}

export type AdviceItem = {
  key?: string
  title?: string
  description?: string
  targetIds?: string[]
}

export type PracticeWorkbenchOverview = {
  totalErrors: number
  noteFirstCount: number
  directDoCount: number
  speedDrillCount: number
  reviewCount: number
  retrainCount: number
  stabilizingCount: number
  stableCount: number
  attemptTrackedCount: number
}

export type PracticeQueueItem = {
  id?: string
  question?: string
  type?: string
  taskReason?: string
  rootReason?: string
  errorReason?: string
  lastResult?: string
  lastMistakeType?: string
  noteNodeId?: string
}

export type WeaknessGroup = {
  name: string
  count: number
  topType?: string
}

export type PracticeWorkbenchResponse = {
  ok: true
  overview: PracticeWorkbenchOverview
  advice: AdviceItem[]
  workflowAdvice: AdviceItem[]
  reviewQueue: PracticeQueueItem[]
  retrainQueue: PracticeQueueItem[]
  noteFirstQueue: PracticeQueueItem[]
  directDoQueue: PracticeQueueItem[]
  speedDrillQueue: PracticeQueueItem[]
  weaknessGroups: WeaknessGroup[]
}

export type KnowledgeNodeHit = {
  id: string
  title: string
  path: string[]
  excerpt?: string
}

export type KnowledgeErrorHit = {
  id?: string
  question?: string
  type?: string
  rootReason?: string
}

export type KnowledgeSearchResponse = {
  ok: true
  nodes: KnowledgeNodeHit[]
  errors: KnowledgeErrorHit[]
}

export type NextHomeContextResponse = {
  ok: true
  workbench: PracticeWorkbenchResponse
  daily: PracticeDailyResponse
  errors: ErrorSummary[]
  knowledgeTree?: KnowledgeTreeNode[] | { roots?: KnowledgeTreeNode[] }
  summary: Record<string, number | string | null>
}

export type PracticeDailyItem = {
  id?: string
  question?: string
  type?: string
  subtype?: string
}

export type PracticeDailyResponse = {
  ok: true
  items: PracticeDailyItem[]
  practicedTodayCount: number
  advice: AdviceItem[]
}

export type PracticeAttempt = {
  id: string
  createdAt?: string
  updatedAt?: string
  sessionMode?: string
  source?: string
  questionId?: string
  errorId?: string
  type?: string
  subtype?: string
  subSubtype?: string
  questionText?: string
  myAnswer?: string
  correctAnswer?: string
  result?: string
  durationSec?: number
  statusTag?: string
  confidence?: number
  solvingNote?: string
  noteNodeId?: string
  scratchData?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export type PracticeAttemptsResponse = {
  ok: true
  items: PracticeAttempt[]
}

export type PracticeHistoryRecord = {
  date?: string
  sessionType?: string
  total?: number
  correct?: number
  skipped?: number
  details?: Array<{
    id?: string
    correct?: boolean
    skipped?: boolean
  }>
}

export type CodexThreadSummary = {
  id: string
  title: string
  updatedAt?: string
  latestMessageText?: string
  latestRole?: string
}

export type CodexThreadsResponse = {
  ok: true
  threads: CodexThreadSummary[]
}
