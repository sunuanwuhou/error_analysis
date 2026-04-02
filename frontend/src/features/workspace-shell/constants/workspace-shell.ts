export type WorkspaceTab = 'notes' | 'errors' | 'practice'
export type AuxiliaryPanel = '' | 'claude' | 'ai' | 'stats' | 'settings' | 'transfer' | 'codex'
export type PracticePreset = 'daily' | 'current' | 'full'

export const MOBILE_WORKSPACE_BREAKPOINT = 1080

export const AUXILIARY_PANEL_TITLES: Record<Exclude<AuxiliaryPanel, ''>, string> = {
  claude: 'Claude题库',
  ai: 'AI工作台',
  stats: '统计',
  settings: '规则目录',
  transfer: '导入导出',
  codex: 'Codex',
}

export const WORKSPACE_TAB_LABELS: Record<WorkspaceTab, string> = {
  notes: '知识工作区',
  errors: '错题列表',
  practice: '每日练习',
}
