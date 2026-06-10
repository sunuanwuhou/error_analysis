import type { MeUser, PortalModuleKey } from '@/lib/modules'

export interface MeResponse {
  authenticated: boolean
  user?: MeUser
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

export async function fetchMe(): Promise<MeResponse> {
  return getJson<MeResponse>('/api/me')
}

export function hasModule(user: MeUser | undefined, key: PortalModuleKey): boolean {
  if (!user) return false
  return (user.modules || []).includes(key)
}
