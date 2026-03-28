import { defineStore } from 'pinia'
import { ref } from 'vue'

import { getSession } from '@/services/api'
import type { CloudUser } from '@/types/workspace'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<CloudUser | null>(null)
  const loading = ref(false)

  async function loadSession() {
    loading.value = true
    try {
      const data = await getSession()
      if (!data.authenticated || !data.user) {
        user.value = null
        window.location.replace('/login')
        return
      }
      user.value = data.user
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    loading,
    loadSession,
  }
})
