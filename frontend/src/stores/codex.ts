import { defineStore } from 'pinia'
import { ref } from 'vue'

import { createCodexThread, getCodexThread, listCodexThreads, sendCodexMessage } from '@/services/api'
import type { CodexMessage, CodexThreadSummary } from '@/types/workspace'

const DEFAULT_THREAD_TITLE = 'Codex 收件箱'

export const useCodexStore = defineStore('codex', () => {
  const loading = ref(false)
  const threads = ref<CodexThreadSummary[]>([])
  const activeThreadId = ref('')
  const messages = ref<CodexMessage[]>([])

  async function loadThreads() {
    loading.value = true
    try {
      const data = await listCodexThreads()
      threads.value = data.threads || []
      if (!activeThreadId.value && threads.value.length) {
        activeThreadId.value = threads.value[0].id
      }
      if (activeThreadId.value) {
        await loadThread(activeThreadId.value)
      } else {
        messages.value = []
      }
    } finally {
      loading.value = false
    }
  }

  async function loadThread(threadId: string) {
    activeThreadId.value = threadId
    const data = await getCodexThread(threadId)
    messages.value = data.messages || []
    const summary = data.thread
    const index = threads.value.findIndex((item) => item.id === summary.id)
    if (index >= 0) {
      threads.value.splice(index, 1, summary)
    } else {
      threads.value.unshift(summary)
    }
  }

  async function createThread(title = DEFAULT_THREAD_TITLE) {
    const data = await createCodexThread(title)
    threads.value.unshift(data.thread)
    activeThreadId.value = data.thread.id
    messages.value = []
    return data.thread
  }

  async function postMessage(content: string, context: Record<string, unknown>) {
    if (!activeThreadId.value) {
      await createThread(content.slice(0, 24) || DEFAULT_THREAD_TITLE)
    }
    const data = await sendCodexMessage(activeThreadId.value, content, context)
    messages.value.push(data.message)
    await loadThreads()
  }

  return {
    loading,
    threads,
    activeThreadId,
    messages,
    loadThreads,
    loadThread,
    createThread,
    postMessage,
  }
})
