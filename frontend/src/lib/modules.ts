/** 与 backend/user_access.py、portalPrefs.ts、v53-bootstrap.js 保持一致 */
export type PortalModuleKey = 'xingce' | 'xingce_suite' | 'xingce_bank_drill' | 'shenlun' | 'interview'

export const PORTAL_MODULE_KEYS: PortalModuleKey[] = [
  'xingce',
  'xingce_suite',
  'xingce_bank_drill',
  'shenlun',
  'interview',
]

export const MODULE_LABELS: Record<PortalModuleKey, string> = {
  xingce: '旧版行测',
  xingce_suite: '套卷练习',
  xingce_bank_drill: '套卷模块练',
  shenlun: '申论',
  interview: '面试',
}

export const DEFAULT_NEW_USER_MODULES: PortalModuleKey[] = ['xingce_suite']

export interface MeUser {
  id: string
  username: string
  role: string
  is_active: boolean
  modules: PortalModuleKey[]
  is_super_admin: boolean
}
