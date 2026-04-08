import { defineStore } from 'pinia'

import { ApiError, apiRequest } from '@/services/api'
import type { CurrentUser, MeResponse } from '@/types/auth'

type LoginPayload = {
  username: string
  password: string
}

type LoginResponse = {
  ok: true
  user: CurrentUser
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    ready: false,
    authenticated: false,
    user: null as CurrentUser | null,
  }),
  actions: {
    async bootstrap(): Promise<boolean> {
      try {
        const payload = await apiRequest<MeResponse>('/api/me')
        this.authenticated = payload.authenticated
        this.user = payload.authenticated ? payload.user : null
      } catch (error) {
        if (!(error instanceof ApiError)) {
          throw error
        }
        this.authenticated = false
        this.user = null
      } finally {
        this.ready = true
      }

      return this.authenticated
    },
    async login(payload: LoginPayload): Promise<void> {
      const response = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      this.authenticated = true
      this.user = response.user
      this.ready = true
    },
    async logout(): Promise<void> {
      await apiRequest<{ ok: true }>('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      this.authenticated = false
      this.user = null
      this.ready = true
    },
  },
})
