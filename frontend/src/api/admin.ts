import type { MeUser, PortalModuleKey } from '@/lib/modules'

export interface ModuleCatalogItem {
  key: PortalModuleKey
  label: string
}

export interface AdminUsersResponse {
  ok: boolean
  users: MeUser[]
  module_catalog: ModuleCatalogItem[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (res.status === 401) {
    window.location.href = '/login.html'
    throw new Error('unauthorized')
  }
  if (res.status === 403) throw new Error('forbidden')
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const adminApi = {
  listUsers(): Promise<AdminUsersResponse> {
    return request<AdminUsersResponse>('/api/admin/users')
  },

  createUser(body: { username: string; password: string; modules: PortalModuleKey[] }) {
    return request<{ ok: boolean; user: MeUser }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  updateUserModules(userId: string, modules: PortalModuleKey[]) {
    return request<{ ok: boolean; user: MeUser }>(`/api/admin/users/${encodeURIComponent(userId)}/modules`, {
      method: 'PUT',
      body: JSON.stringify({ modules }),
    })
  },

  resetPassword(userId: string, password: string) {
    return request<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    })
  },

  setActive(userId: string, is_active: boolean) {
    return request<{ ok: boolean; user: MeUser }>(`/api/admin/users/${encodeURIComponent(userId)}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    })
  },
}
