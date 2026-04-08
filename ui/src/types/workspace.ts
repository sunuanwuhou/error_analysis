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

export type BackupPayloadResponse = BackupMetaResponse & {
  payload?: {
    knowledgeTree?: KnowledgeTreeNode[] | { roots?: KnowledgeTreeNode[] }
    errors?: ErrorSummary[]
  } | null
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
  type?: string
  subtype?: string
  subSubtype?: string
  question?: string
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
  tip?: string
  masteryLevel?: string
  updatedAt?: string
  noteNodeId?: string
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
  advice: string[]
  workflowAdvice: string[]
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
  advice: string[]
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
