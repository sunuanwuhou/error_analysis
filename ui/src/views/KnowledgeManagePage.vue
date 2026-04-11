<template>
  <main class="workspace-shell">
    <aside class="workspace-sidebar">
      <section class="panel sidebar-brand">
        <div class="eyebrow">{{ modeEyebrow }}</div>
        <strong>{{ pageTitle }}</strong>
        <p>{{ pageCopy }}</p>
      </section>

      <section class="panel sidebar-card">
        <div class="sidebar-card-title">知识树</div>
        <div v-if="selectedNode" class="legacy-tree-focus">
          <div class="legacy-tree-focus-header">
            <span>当前节点</span>
            <button v-if="selectedParentNode" type="button" class="legacy-tree-jump" @click="selectNode(selectedParentNode.id)">上一级</button>
          </div>
          <strong>{{ selectedNode.title }}</strong>
          <p>{{ selectedPathText }}</p>
          <div class="legacy-tree-focus-meta">
            <span>子节点 {{ selectedNode.children?.length ?? 0 }}</span>
            <span>更新时间 {{ selectedNode.updatedAt || '未知' }}</span>
          </div>
        </div>
        <ul class="legacy-tree-list">
          <li v-for="node in flattenedNodes" :key="node.id">
            <button type="button" class="legacy-tree-item" :class="{ 'is-active': selectedNodeId === node.id }" @click="selectNode(node.id)">
              <span>{{ node.label }}</span>
            </button>
          </li>
          <li v-if="!flattenedNodes.length">当前还没有知识点。</li>
        </ul>
      </section>
    </aside>

    <section class="workspace-main">
      <article class="panel workspace-topbar">
        <div>
          <div class="eyebrow">{{ modeEyebrow }}</div>
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageCopy }}</p>
          <p v-if="pageError" class="form-error">{{ pageError }}</p>
          <p v-if="pageNotice" class="legacy-section-copy">{{ pageNotice }}</p>
          <p v-if="selectedPathText" class="legacy-section-copy">{{ selectedPathText }}</p>
        </div>
        <div class="topbar-actions">
          <a class="link-button" :href="notesBackHref">返回学习笔记</a>
          <a v-if="selectedNodeId" class="link-button" :href="noteViewerHref">查看笔记</a>
          <button type="button" @click="saveNode" :disabled="busy || !selectedNode">{{ busy ? '保存中...' : '保存' }}</button>
        </div>
      </article>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card content-card--workspace-focus">
          <h2>节点详情</h2>
          <template v-if="selectedNode">
            <div class="entry-grid">
              <label class="entry-grid-span">
                <span>标题</span>
                <input v-model.trim="draftTitle" type="text" placeholder="节点标题" />
              </label>
              <label v-if="isMoveMode || isDirectoryMode">
                <span>父节点</span>
                <select v-model="draftParentId">
                  <option value="">根节点</option>
                  <option v-for="node in availableParentNodes" :key="node.id" :value="node.id">{{ node.label }}</option>
                </select>
              </label>
            </div>

            <div class="knowledge-nav-section">
              <div class="knowledge-nav-row">
                <button v-if="selectedParentNode" type="button" class="link-button" @click="selectNode(selectedParentNode.id)">返回上级</button>
                <button v-if="firstChildNode" type="button" class="link-button" @click="selectNode(firstChildNode.id)">进入首个子节点</button>
                <a v-if="selectedNodeId" class="link-button" :href="noteViewerHref">查看当前笔记</a>
              </div>
              <div v-if="selectedSiblingNodes.length" class="knowledge-nav-group">
                <strong>同级节点</strong>
                <div class="knowledge-chip-list">
                  <button
                    v-for="node in selectedSiblingNodes.slice(0, 8)"
                    :key="node.id"
                    type="button"
                    class="knowledge-chip-button"
                    :class="{ 'is-active': selectedNodeId === node.id }"
                    @click="selectNode(node.id)"
                  >
                    {{ node.title }}
                  </button>
                </div>
              </div>
            </div>

            <label v-if="isNodeMode || isDirectoryMode" class="entry-block">
              <span>Markdown 内容</span>
              <textarea v-model.trim="draftContent" rows="20" class="note-editor-textarea" placeholder="节点 markdown 内容" />
            </label>

            <div class="detail-grid">
              <div class="panel detail-panel">
                <div class="sidebar-card-title">当前节点</div>
                <div class="fact-list">
                  <div>ID: {{ selectedNode.id }}</div>
                  <div>子节点：{{ selectedNode.children?.length ?? 0 }}</div>
                  <div>更新时间：{{ selectedNode.updatedAt || '未知' }}</div>
                </div>
                <div class="detail-block detail-block--tight">
                  <strong>当前路径</strong>
                  <p>{{ selectedPathText }}</p>
                </div>
              </div>
              <div class="panel detail-panel">
                <div class="sidebar-card-title">新增子节点</div>
                <label>
                  <span>子节点标题</span>
                  <input v-model.trim="newChildTitle" type="text" placeholder="新的子节点标题" />
                </label>
                <div class="topbar-actions">
                  <button type="button" @click="createChildNode" :disabled="busy || !newChildTitle.trim()">新增子节点</button>
                </div>
              </div>
            </div>
          </template>
          <p v-else>当前还没有选中的节点。</p>
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
const pageNotice = ref('')
const knowledgeRoots = ref<KnowledgeNodeRecord[]>([])
const selectedNodeId = ref('')
const draftTitle = ref('')
const draftContent = ref('')
const draftParentId = ref('')
const newChildTitle = ref('')

const isDirectoryMode = computed(() => route.name === 'tool-directory')
const isMoveMode = computed(() => route.name === 'tool-knowledge-move')
const isNodeMode = computed(() => route.name === 'tool-knowledge-node')
const modeEyebrow = computed(() => (isMoveMode.value ? '移动知识点' : isNodeMode.value ? '知识点编辑' : '目录管理'))
const pageTitle = computed(() => (isMoveMode.value ? '移动知识点' : isNodeMode.value ? '知识点编辑' : '目录管理'))
const pageCopy = computed(() => {
  if (isMoveMode.value) return '把当前知识点移动到新的父节点下面。'
  if (isNodeMode.value) return '直接在 /next 里修改当前知识点名称和内容。'
  return '直接在 /next 里管理知识目录结构并新增子节点。'
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

const selectedNode = computed<KnowledgeNodeRecord | null>(() => findNodeById(knowledgeRoots.value, selectedNodeId.value))
const selectedPath = computed(() => findNodePath(knowledgeRoots.value, selectedNodeId.value))
const selectedPathText = computed(() => selectedPath.value.map((node) => node.title).join(' / '))
const selectedParentNode = computed(() => {
  if (selectedPath.value.length <= 1) {
    return null
  }
  return selectedPath.value[selectedPath.value.length - 2] ?? null
})
const selectedSiblingNodes = computed(() => {
  if (!selectedNode.value) {
    return []
  }
  if (selectedParentNode.value) {
    return (selectedParentNode.value.children || []) as KnowledgeNodeRecord[]
  }
  return knowledgeRoots.value
})
const firstChildNode = computed(() => ((selectedNode.value?.children || [])[0] as KnowledgeNodeRecord | undefined) ?? null)
const availableParentNodes = computed(() => flattenedNodes.value.filter((node) => node.id !== selectedNodeId.value))
const notesBackHref = computed(() =>
  selectedNodeId.value ? `/next/workspace/notes?nodeId=${encodeURIComponent(selectedNodeId.value)}` : '/next/workspace/notes',
)
const noteViewerHref = computed(() =>
  selectedNodeId.value ? `/next/tools/note-viewer?nodeId=${encodeURIComponent(selectedNodeId.value)}` : '/next/tools/note-viewer',
)

function findNodeById(nodes: KnowledgeNodeRecord[], nodeId: string): KnowledgeNodeRecord | null {
  if (!nodeId) {
    return null
  }
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node
    }
    const hit = findNodeById((node.children || []) as KnowledgeNodeRecord[], nodeId)
    if (hit) {
      return hit
    }
  }
  return null
}

function findNodePath(nodes: KnowledgeNodeRecord[], nodeId: string, path: KnowledgeNodeRecord[] = []): KnowledgeNodeRecord[] {
  if (!nodeId) {
    return []
  }
  for (const node of nodes) {
    const nextPath = [...path, node]
    if (node.id === nodeId) {
      return nextPath
    }
    const childPath = findNodePath((node.children || []) as KnowledgeNodeRecord[], nodeId, nextPath)
    if (childPath.length) {
      return childPath
    }
  }
  return []
}

function applyKnowledgeTree(tree: KnowledgeTreeNode[] | { roots?: KnowledgeTreeNode[] } | undefined) {
  if (Array.isArray(tree)) {
    knowledgeRoots.value = tree as KnowledgeNodeRecord[]
    return
  }
  knowledgeRoots.value = (Array.isArray(tree?.roots) ? tree.roots : []) as KnowledgeNodeRecord[]
}

async function loadPage() {
  pageError.value = ''
  pageNotice.value = ''
  const homeContext = await apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=12')
  applyKnowledgeTree(homeContext.knowledgeTree)
  selectedNodeId.value = String(route.query.nodeId || '').trim() || flattenedNodes.value[0]?.id || ''
}

function selectNode(nodeId: string) {
  selectedNodeId.value = nodeId
  void router.replace({ query: { ...route.query, nodeId } })
}

async function saveNode() {
  if (!selectedNode.value || busy.value) return
  busy.value = true
  pageError.value = ''
  pageNotice.value = ''
  try {
    await apiRequest(`/api/knowledge/nodes/${encodeURIComponent(selectedNode.value.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: selectedNode.value.id,
        parentId: draftParentId.value,
        title: draftTitle.value,
        contentMd: draftContent.value,
        sort: Number(selectedNode.value.sort || 0),
      }),
    })
    pageNotice.value = '知识点已保存。'
    await loadPage()
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    busy.value = false
  }
}

async function createChildNode() {
  if (!selectedNode.value || busy.value || !newChildTitle.value.trim()) return
  busy.value = true
  pageError.value = ''
  pageNotice.value = ''
  try {
    const payload = await apiRequest<{ ok: true; item: KnowledgeNodeRecord }>('/api/knowledge/nodes', {
      method: 'POST',
      body: JSON.stringify({
        parentId: selectedNode.value.id,
        title: newChildTitle.value.trim(),
        contentMd: '',
        sort: (selectedNode.value.children?.length || 0) + 1,
      }),
    })
    newChildTitle.value = ''
    pageNotice.value = '子节点已创建。'
    await loadPage()
    selectedNodeId.value = payload.item.id
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '创建失败'
  } finally {
    busy.value = false
  }
}

watch(
  selectedNode,
  (node) => {
    draftTitle.value = String(node?.title || '')
    draftContent.value = String(node?.contentMd || '')
    draftParentId.value = String(node?.parentId || '')
  },
  { immediate: true },
)

watch(
  () => String(route.query.nodeId || '').trim(),
  (nodeId) => {
    if (nodeId && nodeId !== selectedNodeId.value) {
      selectedNodeId.value = nodeId
    }
  },
)

onMounted(() => {
  void loadPage()
})
</script>
