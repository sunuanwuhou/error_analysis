/** 与 legacy `v53-bootstrap.js` 使用同一键，保证 `/` 与 `/new/` 行为一致 */
export const PORTAL_LAST_MODULE_KEY = 'v53.portal.lastModule'

export type PortalModuleChoice =
  | 'xingce'
  | 'xingce_vue'
  | 'xingce_suite'
  | 'xingce_bank_drill'
  | 'shenlun'
  | 'interview'

export function readPortalLastModule(): PortalModuleChoice | null {
  try {
    const v = localStorage.getItem(PORTAL_LAST_MODULE_KEY)
    if (
      v === 'xingce' ||
      v === 'xingce_vue' ||
      v === 'xingce_suite' ||
      v === 'xingce_bank_drill' ||
      v === 'shenlun' ||
      v === 'interview'
    ) {
      return v
    }
  } catch {
    /* ignore */
  }
  return null
}

export function savePortalLastModule(m: PortalModuleChoice) {
  try {
    localStorage.setItem(PORTAL_LAST_MODULE_KEY, m)
  } catch {
    /* ignore */
  }
}
