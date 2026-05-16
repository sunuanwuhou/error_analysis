/** 与 legacy `v53-bootstrap.js` 使用同一键，保证 `/` 与 `/new/` 行为一致 */
export const PORTAL_LAST_MODULE_KEY = 'v53.portal.lastModule'

export type PortalModuleChoice = 'xingce' | 'shenlun'

export function readPortalLastModule(): PortalModuleChoice | null {
  try {
    const v = localStorage.getItem(PORTAL_LAST_MODULE_KEY)
    if (v === 'xingce' || v === 'shenlun') return v
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
