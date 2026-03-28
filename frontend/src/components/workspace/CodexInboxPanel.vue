<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { useCodexStore } from '@/stores/codex'
import { useWorkspaceStore } from '@/stores/workspace'
import type { KnowledgeNode } from '@/types/workspace'

const codexStore = useCodexStore()
const workspaceStore = useWorkspaceStore()

const draft = ref('')
const includeContext = ref(true)

const activeThread = computed(() =>
  codexStore.threads.find((item) => item.id === codexStore.activeThreadId) || null,
)

function findPath(nodes: KnowledgeNode[], nodeId: string, trail: string[] = []): string[] {
  for (const node of nodes) {
    const nextTrail = [...trail, node.title]
    if (node.id === nodeId) return nextTrail
    const childTrail = findPath(node.children, nodeId, nextTrail)
    if (childTrail.length) return childTrail
  }
  return []
}

function buildContextSnapshot() {
  const selectedNode = workspaceStore.selectedKnowledgeNode
  return {
    currentOrigin: workspaceStore.currentOrigin,
    searchQuery: workspaceStore.searchQuery,
    summary: {
      total: workspaceStore.summary.total,
      focus: workspaceStore.summary.focus,
      review: workspaceStore.summary.review,
      mastered: workspaceStore.summary.mastered,
    },
    selectedKnowledgeNode: selectedNode
      ? {
          id: selectedNode.id,
          title: selectedNode.title,
          path: findPath(workspaceStore.knowledgeTree, selectedNode.id).join(' > '),
        }
      : null,
  }
}

function summarizeContext(context?: Record<string, unknown>) {
  if (!context) return ''
  const parts: string[] = []
  const selected = context.selectedKnowledgeNode as { path?: string } | null | undefined
  const search = typeof context.searchQuery === 'string' ? context.searchQuery : ''
  if (selected?.path) parts.push(`知识点：${selected.path}`)
  if (search) parts.push(`搜索：${search}`)
  return parts.join(' / ')
}

async function handleSend() {
  const content = draft.value.trim()
  if (!content) return
  await codexStore.postMessage(content, includeContext.value ? buildContextSnapshot() : {})
  draft.value = ''
}

onMounted(async () => {
  await codexStore.loadThreads()
})
</script>

<template>
  <section class="panel codex-panel">
    <header class="panel__header">
      <div>
        <h2>Codex 留言</h2>
        <p class="panel__subtle">这是异步留言，不是实时聊天。发出后会进入待处理队列，稍后写回回复。</p>
      </div>
      <div class="error-card__actions">
        <button class="ghost-button ghost-button--small" type="button" @click="codexStore.loadThreads()">刷新</button>
        <button class="ghost-button ghost-button--small" type="button" @click="codexStore.createThread('新会话')">新建</button>
      </div>
    </header>

    <div class="codex-layout">
      <aside class="codex-threads">
        <button
          v-for="thread in codexStore.threads"
          :key="thread.id"
          class="codex-thread"
          :class="{ 'is-active': thread.id === codexStore.activeThreadId }"
          type="button"
          @click="codexStore.loadThread(thread.id)"
        >
          <strong>{{ thread.title }}</strong>
          <span>{{ thread.pendingCount || 0 }} 待处理 / {{ thread.messageCount || 0 }} 条</span>
          <span>{{ thread.updatedAt || thread.createdAt }}</span>
        </button>
        <div v-if="!codexStore.threads.length" class="panel__empty">还没有会话，可以先新建一个。</div>
      </aside>

      <section class="codex-messages">
        <div class="codex-messages__header">
          <strong>{{ activeThread?.title || '暂无会话' }}</strong>
        </div>

        <div class="codex-messages__list">
          <article
            v-for="message in codexStore.messages"
            :key="message.id"
            class="codex-message"
            :class="`role-${message.role}`"
          >
            <div class="codex-message__meta">
              <span>{{ message.role === 'assistant' ? 'Codex' : '我' }}</span>
              <span>{{ message.createdAt }}</span>
            </div>
            <div v-if="summarizeContext(message.context)" class="codex-message__context">
              {{ summarizeContext(message.context) }}
            </div>
            <p class="codex-message__content">{{ message.content }}</p>
            <div class="panel__subtle" v-if="message.errorText">{{ message.errorText }}</div>
          </article>
        </div>

        <div class="codex-composer">
          <label class="codex-context-toggle">
            <input v-model="includeContext" type="checkbox" />
            发送时附带当前知识点和筛选上下文
          </label>
          <textarea v-model="draft" placeholder="给 Codex 留言，比如：根据当前知识点帮我做一个 3 天复习计划。" />
          <button class="ghost-button" type="button" @click="handleSend">发送到队列</button>
        </div>
      </section>
    </div>
  </section>
</template>
