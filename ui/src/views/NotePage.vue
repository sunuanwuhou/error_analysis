<template>
  <main class="workspace-shell">
    <aside class="workspace-sidebar">
      <section class="panel sidebar-brand">
        <div class="eyebrow">{{ isEditMode ? '笔记编辑' : '笔记查看' }}</div>
        <strong>{{ currentNode?.title || '知识笔记' }}</strong>
        <p>{{ isEditMode ? '直接在 /next 中编辑当前知识点笔记。' : '直接在 /next 中查看当前知识点笔记。' }}</p>
      </section>

      <section class="panel sidebar-card">
        <div class="sidebar-card-title">知识树</div>
        <ul class="legacy-tree-list">
          <li v-for="node in flattenedNodes" :key="node.id">
            <button type="button" class="legacy-tree-item" @click="selectNode(node.id)">
              <span>{{ node.label }}</span>
            </button>
          </li>
        </ul>
      </section>
    </aside>

    <section class="workspace-main">
      <article class="panel workspace-topbar">
        <div>
          <div class="eyebrow">{{ isEditMode ? '编辑模式' : '查看模式' }}</div>
          <h1>{{ currentNode?.title || '知识笔记' }}</h1>
          <p v-if="pageError" class="form-error">{{ pageError }}</p>
        </div>
        <div class="topbar-actions">
          <a class="action-button action-button--secondary" href="/next/workspace/notes">返回学习笔记</a>
          <button v-if="isEditMode" type="button" class="action-button action-button--primary" @click="saveNode">{{ busy ? '保存中...' : '保存笔记' }}</button>
        </div>
      </article>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card content-card--workspace-focus">
          <h2>{{ isEditMode ? 'Markdown 笔记' : '笔记内容' }}</h2>
          <textarea
            v-if="isEditMode"
            v-model="draftContent"
            class="note-editor-textarea"
            rows="24"
            placeholder="在这里写当前知识点的 markdown 笔记"
          />
          <div v-else class="note-rendered-content" v-html="renderedContent" />
        </article>

        <article class="panel content-card panel--muted">
          <h2>节点详情</h2>
          <div class="fact-list" v-if="currentNode">
            <div>节点 ID：{{ currentNode.id }}</div>
            <div>更新时间：{{ currentNode.updatedAt || '未知' }}</div>
            <div>子节点：{{ currentNode.children?.length ?? 0 }}</div>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { apiRequest } from '@/services/api'
import type { KnowledgeTreeNode, NextHomeContextResponse } from '@/types/workspace'

type KnowledgeNodeRecord = KnowledgeTreeNode & {
  parentId?: string
  contentMd?: string
  updatedAt?: string
  sort?: number
}

const route = useRoute()
const router = useRouter()

const busy = ref(false)
const pageError = ref('')
const knowledgeRoots = ref<KnowledgeNodeRecord[]>([])
const selectedNodeId = ref('')
const draftContent = ref('')

const isEditMode = computed(() => route.name === 'tool-note-editor')

const renderedContent = computed(() => {
  const raw = String(currentNode.value?.contentMd || '').trim()
  if (!raw) return '<p class="note-empty">当前还没有内容。</p>'
  // 先转义 HTML，防止 XSS
  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // 标题
  html = html
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  // 粗体 / 斜体 / 行内代码
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
  // 无序列表（连续 - 行打包成 <ul>）
  html = html.replace(/((?:^- .+(?:\n|$))+)/gm, (match) => {
    const items = match.trim().split('\n').map((line) => `<li>${line.replace(/^- /, '')}</li>`).join('')
    return `<ul>${items}</ul>`
  })
  // 剩余段落
  html = html.split('\n\n').map((block) => {
    if (/^<(h[1-6]|ul|ol|blockquote)/.test(block.trim())) return block
    const inner = block.replace(/\n/g, '<br>')
    return `<p>${inner}</p>`
  }).join('\n')
  return html
})

const flattenedNodes = computed(() => {
  const items: Array<{ id: string; label: string }> = []
  const walk = (nodes: KnowledgeNodeRecord[], path: string[] = []) => {
    for (const node of nodes) {
      const nextPath = [...path, node.title]
      items.push({ id: node.id, label: nextPath.join(' / ') })
      if (node.children?.length) {
        walk(node.children as KnowledgeNodeRecord[], nextPath)
      }
    }
  }
  walk(knowledgeRoots.value)
  return items
})

const currentNode = computed<KnowledgeNodeRecord | null>(() => {
  const walk = (nodes: KnowledgeNodeRecord[]): KnowledgeNodeRecord | null => {
    for (const node of nodes) {
      if (node.id === selectedNodeId.value) return node
      const hit = walk((node.children || []) as KnowledgeNodeRecord[])
      if (hit) return hit
    }
    return null
  }
  return walk(knowledgeRoots.value)
})

function applyKnowledgeTree(tree: KnowledgeTreeNode[] | { roots?: KnowledgeTreeNode[] } | undefined) {
  if (Array.isArray(tree)) {
    knowledgeRoots.value = tree as KnowledgeNodeRecord[]
    return
  }
  knowledgeRoots.value = (Array.isArray(tree?.roots) ? tree.roots : []) as KnowledgeNodeRecord[]
}

async function loadPage() {
  pageError.value = ''
  const homeContext = await apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=6')
  applyKnowledgeTree(homeContext.knowledgeTree)
  const routeNodeId = String(route.query.nodeId || '').trim()
  selectedNodeId.value = routeNodeId || flattenedNodes.value[0]?.id || ''
}

function selectNode(nodeId: string) {
  selectedNodeId.value = nodeId
  void router.replace({ query: { ...route.query, nodeId } })
}

async function saveNode() {
  if (!currentNode.value || busy.value) return
  busy.value = true
  pageError.value = ''
  try {
    const payload = await apiRequest<{ ok: true; item: KnowledgeNodeRecord }>(`/api/knowledge/nodes/${encodeURIComponent(currentNode.value.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: currentNode.value.id,
        parentId: currentNode.value.parentId || '',
        title: currentNode.value.title,
        contentMd: draftContent.value,
        sort: Number(currentNode.value.sort || 0),
      }),
    })
    currentNode.value.contentMd = payload.item.contentMd || ''
    draftContent.value = currentNode.value.contentMd
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '笔记保存失败'
  } finally {
    busy.value = false
  }
}

watch(currentNode, (node) => {
  draftContent.value = String(node?.contentMd || '')
}, { immediate: true })

onMounted(() => {
  void loadPage()
})
</script>
