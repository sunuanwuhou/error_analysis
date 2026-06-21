import { hasModule } from '@/api/authMe'
import type { MeUser, PortalModuleKey } from '@/lib/modules'
import { readPortalLastModule, type PortalModuleChoice } from '@/lib/portalPrefs'

export type ShellTabId =
  | 'legacy_xingce'
  | 'xingce_vue'
  | 'xingce_suite'
  | 'xingce_bank_drill'
  | 'shenlun'
  | 'interview'
  | 'admin'

export interface ShellTabDef {
  id: ShellTabId
  label: string
  shortLabel: string
  routeName: string
  portalChoice: PortalModuleChoice | 'admin'
  moduleKey?: PortalModuleKey
  superAdmin?: boolean
  keepAlive: boolean
}

export const SHELL_TABS: ShellTabDef[] = [
  {
    id: 'legacy_xingce',
    label: '旧版行测',
    shortLabel: '旧行测',
    routeName: 'LegacyXingce',
    portalChoice: 'xingce',
    moduleKey: 'xingce',
    keepAlive: false,
  },
  {
    id: 'xingce_vue',
    label: 'Vue行测',
    shortLabel: '行测',
    routeName: 'XingceWorkspace',
    portalChoice: 'xingce_vue',
    moduleKey: 'xingce',
    keepAlive: true,
  },
  {
    id: 'xingce_suite',
    label: '套卷练习',
    shortLabel: '套卷',
    routeName: 'XingceSuiteBank',
    portalChoice: 'xingce_suite',
    moduleKey: 'xingce_suite',
    keepAlive: true,
  },
  {
    id: 'xingce_bank_drill',
    label: '模块练',
    shortLabel: '模块练',
    routeName: 'XingceBankDrill',
    portalChoice: 'xingce_bank_drill',
    moduleKey: 'xingce_bank_drill',
    keepAlive: true,
  },
  {
    id: 'shenlun',
    label: '申论',
    shortLabel: '申论',
    routeName: 'ShenlunHub',
    portalChoice: 'shenlun',
    moduleKey: 'shenlun',
    keepAlive: true,
  },
  {
    id: 'interview',
    label: '面试',
    shortLabel: '面试',
    routeName: 'InterviewWorkspace',
    portalChoice: 'interview',
    moduleKey: 'interview',
    keepAlive: true,
  },
  {
    id: 'admin',
    label: '系统管理',
    shortLabel: '管理',
    routeName: 'AdminUsers',
    portalChoice: 'admin',
    superAdmin: true,
    keepAlive: false,
  },
]

const ROUTE_ACTIVE_TAB: Record<string, ShellTabId> = {
  ShenlunWorkbench: 'shenlun',
  ShenlunResult: 'shenlun',
  XingceBankDrillExport: 'xingce_bank_drill',
  XingceExamInsight: 'xingce_suite',
}

export function getVisibleShellTabs(user?: MeUser): ShellTabDef[] {
  return SHELL_TABS.filter(tab => {
    if (tab.superAdmin) return Boolean(user?.is_super_admin)
    if (tab.moduleKey) return hasModule(user, tab.moduleKey)
    return false
  })
}

export function shellTabForRouteName(routeName?: string | null): ShellTabId | null {
  if (!routeName) return null
  const direct = SHELL_TABS.find(tab => tab.routeName === routeName)
  if (direct) return direct.id
  return ROUTE_ACTIVE_TAB[routeName] ?? null
}

export function shellTabDefForRouteName(routeName?: string | null): ShellTabDef | null {
  const tabId = shellTabForRouteName(routeName)
  if (!tabId) return null
  return SHELL_TABS.find(tab => tab.id === tabId) ?? null
}

export function defaultShellRouteName(user?: MeUser): string {
  const visible = getVisibleShellTabs(user)
  if (!visible.length) return 'ModulePortal'
  const last = readPortalLastModule()
  if (last) {
    const matched = visible.find(tab => tab.portalChoice === last)
    if (matched) return matched.routeName
  }
  return visible[0].routeName
}

export function portalChoiceForRouteName(routeName: string): PortalModuleChoice | 'admin' | null {
  const tab = SHELL_TABS.find(item => item.routeName === routeName)
  if (tab) return tab.portalChoice
  const tabId = ROUTE_ACTIVE_TAB[routeName]
  if (!tabId) return null
  return SHELL_TABS.find(item => item.id === tabId)?.portalChoice ?? null
}
