<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IssueStatsBar from '@/components/shenlun/IssueStatsBar.vue'
import IssueTagChip from '@/components/shenlun/IssueTagChip.vue'
import { shenlunApi, type IssueStats, type ShenlunCustomNode, type SourceSummary } from '@/api/shenlun'
import {
  SL_TREE,
  collectCustomChildIds,
  isNoteOnlyNode,
  mergeTreeWithChildren,
  shenlunNodeTitleFromTree,
  routeQueryToNodeId,
  nodeIdToRouteQuery,
  SL_UNCATEGORIZED_ROUTE,
  type ShenlunTreeNode,
} from '@/data/shenlunTree'
import { savePortalLastModule } from '@/lib/portalPrefs'
import {
  clearNoteDirty,
  countDirtyNotes,
  formatCacheTime,
  isNoteDirty,
  listDirtyNoteIds,
  markNoteDirty,
  readCacheMeta,
  readIssueStatsCache,
  readKnowledgeTreeCache,
  readNoteLocal,
  readSourcesCache,
  writeCacheMeta,
  writeIssueStatsCache,
  writeKnowledgeTreeCache,
  writeNoteLocal,
  writeSourcesCache,
} from '@/lib/shenlunLocalCache'

const ShenlunHubNotesEditor = defineAsyncComponent(
  () => import('@/components/shenlun/ShenlunHubNotesEditor.vue'),
)
const IssueFeedPanel = defineAsyncComponent(
  () => import('@/components/shenlun/IssueFeedPanel.vue'),
)

const route = useRoute()
const router = useRouter()

const selectedNodeId = computed(() => routeQueryToNodeId(route.query.node))

const customNodes = ref<ShenlunCustomNode[]>([])
const knowledgeTree = computed(() => mergeTreeWithChildren(customNodes.value))
const customChildIds = computed(() => collectCustomChildIds(customNodes.value))
const isNoteOnlySelected = computed(() =>
  isNoteOnlyNode(selectedNodeId.value, customChildIds.value),
)
const selectedNodeTitle = computed(() =>
  shenlunNodeTitleFromTree(selectedNodeId.value, knowledgeTree.value),
)

const treeActionBusy = ref(false)

const syncBusy = ref(false)
const lastSyncAt = ref<string | null>(readCacheMeta().lastManualSyncAt)
const dirtyNoteCount = ref(countDirtyNotes())

function refreshDirtyCount() {
  dirtyNoteCount.value = countDirtyNotes()
}

function hydrateKnowledgeTreeFromCache() {
  const cached = readKnowledgeTreeCache()
  if (cached?.custom_nodes) customNodes.value = cached.custom_nodes
}

async function createChildNode(parentId: string) {
  const raw = window.prompt('新建子节点名称（仅 Markdown 笔记）')
  if (raw === null) return
  const title = raw.trim()
  if (!title) return
  treeActionBusy.value = true
  try {
    const created = await shenlunApi.createKnowledgeNode(parentId, title)
    customNodes.value = [...customNodes.value, created]
    writeKnowledgeTreeCache(customNodes.value)
    expanded.value = new Set([...expanded.value, parentId])
  } catch (e) {
    alert((e as Error).message || '创建失败')
  } finally {
    treeActionBusy.value = false
  }
}

async function renameChildNode(nodeId: string, currentTitle: string) {
  const raw = window.prompt('重命名子节点', currentTitle)
  if (raw === null) return
  const title = raw.trim()
  if (!title || title === currentTitle) return
  treeActionBusy.value = true
  try {
    await shenlunApi.patchKnowledgeNode(nodeId, title)
    customNodes.value = customNodes.value.map((n) =>
      n.id === nodeId ? { ...n, title } : n,
    )
    writeKnowledgeTreeCache(customNodes.value)
  } catch (e) {
    alert((e as Error).message || '重命名失败')
  } finally {
    treeActionBusy.value = false
  }
}

async function deleteChildNode(nodeId: string, title: string) {
  const ok = window.confirm(`确定删除子节点「${title}」？笔记内容将一并删除。`)
  if (!ok) return
  treeActionBusy.value = true
  try {
    await shenlunApi.deleteKnowledgeNode(nodeId)
    if (selectedNodeId.value === nodeId) {
      const parent = customNodes.value.find((n) => n.id === nodeId)?.parent_id
      if (parent) pickNode(parent)
      else pickUncategorized()
    }
    customNodes.value = customNodes.value.filter((n) => n.id !== nodeId)
    writeKnowledgeTreeCache(customNodes.value)
    clearNoteDirty(nodeId)
    refreshDirtyCount()
  } catch (e) {
    alert((e as Error).message || '删除失败')
  } finally {
    treeActionBusy.value = false
  }
}

const items = ref<SourceSummary[]>([])
const listCacheEmpty = ref(true)
const listError = ref<string | null>(null)
const searchQuery = ref('')
const deletingId = ref<string | null>(null)

type HubMainSection = 'topics' | 'notes' | 'issues'
const hubMainSection = ref<HubMainSection>('topics')
const issueFeedRef = ref<InstanceType<typeof IssueFeedPanel> | null>(null)

const issueStats = ref<IssueStats | null>(null)
const topicIssueTagFilter = ref('')
const topicListFilter = ref<'all' | 'reviewed' | 'has_issues'>('all')
const issuesInitialTag = ref('')
const issuesInitialSourceId = ref('')

/** 知识点笔记 Markdown（本地优先，手动同步上传云端） */
const hubNotesMd = ref('')

type HubNotesCloudState = 'local' | 'dirty' | 'syncing' | 'synced' | 'error'
const hubNotesCloud = ref<{ status: HubNotesCloudState; detail?: string }>({
  status: 'local',
})

/** 服务器返回的上一版保存时间（ISO） */
const hubNotesLastServerAt = ref('')

function applyHubNoteSavedMeta(r: { updated_at?: string }) {
  const u = (r.updated_at ?? '').trim()
  if (u) hubNotesLastServerAt.value = u
}

function formatHubSavedAt(iso: string): string {
  return formatCacheTime(iso)
}

const syncStatusHint = computed(() => {
  if (syncBusy.value) return '正在与云端同步…'
  const parts: string[] = ['本地优先']
  const synced = formatCacheTime(lastSyncAt.value)
  if (synced) parts.push(`上次同步 ${synced}`)
  if (dirtyNoteCount.value > 0) parts.push(`${dirtyNoteCount.value} 篇笔记待上传`)
  return parts.join(' · ')
})

const hubNotesBadgeText = computed(() => {
  const st = hubNotesCloud.value.status
  if (st === 'syncing') return '同步中…'
  if (st === 'error') return '同步失败'
  if (st === 'dirty') return '有改动 · 待同步'
  if (st === 'synced') return '已与云端一致'
  return '仅本地缓存'
})

const hubNotesBadgeClass = computed(() => {
  const st = hubNotesCloud.value.status
  return {
    'hub-notes-badge': true,
    'hub-notes-badge--loading': st === 'local',
    'hub-notes-badge--saving': st === 'syncing',
    'hub-notes-badge--error': st === 'error',
    'hub-notes-badge--pending': st === 'dirty',
    'hub-notes-badge--ok': st === 'synced',
  }
})

const hubNotesSubHint = computed(() => {
  const st = hubNotesCloud.value.status
  if (st === 'error') {
    return hubNotesCloud.value.detail || '同步失败，请点顶栏「同步」重试。'
  }
  if (st === 'dirty') {
    return '改动已写入本地；点顶栏「同步」上传到账号。'
  }
  if (st === 'synced') {
    const saved = formatHubSavedAt(hubNotesLastServerAt.value)
    return saved
      ? `云端记录：${saved}（换设备需先同步）`
      : '已与云端对齐。'
  }
  return '当前为本地缓存；编辑后点顶栏「同步」上传，并从云端拉取最新题目与统计。'
})

/** 「笔记」标签上的小点 */
const hubNotesTabMarkerClass = computed(() => {
  const st = hubNotesCloud.value.status
  if (st === 'error') return 'hub-tab-marker hub-tab-marker--error'
  if (st === 'dirty' || st === 'syncing') {
    return 'hub-tab-marker hub-tab-marker--pending'
  }
  return ''
})

function flushHubNotesToNode(nodeId: string) {
  writeNoteLocal(nodeId, hubNotesMd.value)
}

function applyHubNotesFromRemote(md: string) {
  hubNotesMd.value = md
}

function onNotesInput(md: string) {
  hubNotesMd.value = md
  saveNoteLocally()
}

function saveNoteLocally() {
  const nid = selectedNodeId.value
  const prev = readNoteLocal(nid)
  if (prev === hubNotesMd.value) return
  flushHubNotesToNode(nid)
  markNoteDirty(nid)
  refreshDirtyCount()
  hubNotesCloud.value = { status: 'dirty' }
}

function loadNoteForNode(id: string, prev?: string) {
  if (prev !== undefined) {
    flushHubNotesToNode(prev)
  }
  applyHubNotesFromRemote(readNoteLocal(id))
  hubNotesCloud.value = isNoteDirty(id) ? { status: 'dirty' } : { status: 'local' }
  if (!isNoteDirty(id)) hubNotesLastServerAt.value = ''
}

watch(
  () => selectedNodeId.value,
  (id, prev) => {
    loadNoteForNode(id, prev)
  },
  { immediate: true },
)

async function manualSync() {
  if (syncBusy.value) return
  syncBusy.value = true
  listError.value = null
  const nodeId = selectedNodeId.value
  hubNotesCloud.value = { status: 'syncing' }
  try {
    flushHubNotesToNode(nodeId)

    for (const nid of listDirtyNoteIds()) {
      const md = readNoteLocal(nid)
      const r = await shenlunApi.putHubNote(nid, md)
      clearNoteDirty(nid)
      if (nid === nodeId) applyHubNoteSavedMeta(r)
    }
    refreshDirtyCount()

    const treeRes = await shenlunApi.getKnowledgeTree()
    customNodes.value = treeRes.custom_nodes ?? []
    writeKnowledgeTreeCache(customNodes.value)

    const [sourcesRes, statsRes] = await Promise.all([
      shenlunApi.listSources(nodeId, ''),
      shenlunApi.getIssueStats(nodeId),
    ])
    writeSourcesCache(nodeId, sourcesRes.items)
    writeIssueStatsCache(nodeId, statsRes)
    items.value = sourcesRes.items
    listCacheEmpty.value = false
    issueStats.value = statsRes

    if (!isNoteDirty(nodeId)) {
      const remote = await shenlunApi.getHubNote(nodeId)
      applyHubNotesFromRemote(remote.body_md ?? '')
      writeNoteLocal(nodeId, remote.body_md ?? '')
      applyHubNoteSavedMeta(remote)
    }

    const now = new Date().toISOString()
    writeCacheMeta({ lastManualSyncAt: now })
    lastSyncAt.value = now
    hubNotesCloud.value = isNoteDirty(nodeId) ? { status: 'dirty' } : { status: 'synced' }

    if (hubMainSection.value === 'issues') {
      void issueFeedRef.value?.reload?.()
    }
  } catch (e) {
    listError.value = (e as Error).message
    hubNotesCloud.value = { status: 'error', detail: (e as Error).message }
  } finally {
    syncBusy.value = false
  }
}

onMounted(() => {
  savePortalLastModule('shenlun')
  hydrateKnowledgeTreeFromCache()
  refreshDirtyCount()
  if (String(route.query.tab || '') === 'issues') {
    goIssuesTab('', '')
  }
})

onBeforeUnmount(() => {
  flushHubNotesToNode(selectedNodeId.value)
})

const copyBlinkId = ref<string | null>(null)

function sourceCopyPack(row: SourceSummary): string {
  const material = row.material_text_raw?.trim?.() ?? ''
  const question = row.question_text_raw?.trim?.() ?? ''
  const mBlock = material || '（暂无材料正文）'
  const qBlock = question || '（暂无题干）'
  return `【材料】\n${mBlock}\n\n【题目】\n${qBlock}`
}

async function copySourceProblem(row: SourceSummary, ev?: Event) {
  ev?.preventDefault()
  ev?.stopPropagation()
  const text = sourceCopyPack(row)
  try {
    await navigator.clipboard.writeText(text)
    copyBlinkId.value = row.id
    setTimeout(() => {
      if (copyBlinkId.value === row.id) copyBlinkId.value = null
    }, 1600)
  } catch {
    window.prompt('可复制以下内容（Ctrl+C）：', text)
  }
}

watch(
  () => isNoteOnlySelected.value,
  (noteOnly) => {
    if (noteOnly && hubMainSection.value !== 'notes') {
      hubMainSection.value = 'notes'
    }
  },
)

watch(hubMainSection, (s) => {
  if (s === 'issues') {
    void issueFeedRef.value?.reload?.()
  }
})

const expanded = ref<Set<string>>(
  new Set(SL_TREE.map((n) => n.id)),
)

function hasChildren(n: ShenlunTreeNode): boolean {
  return (n.children?.length ?? 0) > 0
}

function applyListFromCache(nodeId: string) {
  listError.value = null
  const sourcesCached = readSourcesCache(nodeId)
  items.value = sourcesCached?.items ?? []
  listCacheEmpty.value = !sourcesCached
  const statsCached = readIssueStatsCache(nodeId)
  issueStats.value = statsCached?.stats ?? null
}

const filteredItems = computed(() => {
  let rows = items.value
  const needle = searchQuery.value.trim().toLowerCase()
  if (needle) {
    rows = rows.filter((r) => {
      const q = (r.question_text_raw ?? '').toLowerCase()
      const m = (r.material_text_raw ?? '').toLowerCase()
      const meta = [r.paper_year, r.paper_province, r.paper_suite_type]
        .join(' ')
        .toLowerCase()
      return q.includes(needle) || m.includes(needle) || meta.includes(needle)
    })
  }
  if (topicListFilter.value === 'reviewed') {
    rows = rows.filter((r) => (r.cc_success_count ?? 0) > 0 || r.latest_cc_status === 'success')
  } else if (topicListFilter.value === 'has_issues') {
    rows = rows.filter((r) => (r.latest_issue_tags?.length ?? 0) > 0)
  }
  if (topicIssueTagFilter.value) {
    rows = rows.filter((r) => r.latest_issue_tags?.includes(topicIssueTagFilter.value))
  }
  return rows
})

function goIssuesTab(tag = '', sourceId = '') {
  issuesInitialTag.value = tag
  issuesInitialSourceId.value = sourceId
  hubMainSection.value = 'issues'
}

function onTopicTagClick(tag: string, sourceId: string, ev: Event) {
  ev.preventDefault()
  ev.stopPropagation()
  goIssuesTab(tag, sourceId)
}

function onStatsTagUpdate(tag: string) {
  topicIssueTagFilter.value = tag
}

function onStatsViewAll() {
  goIssuesTab(topicIssueTagFilter.value, '')
}

watch(
  () => selectedNodeId.value,
  (nodeId) => applyListFromCache(nodeId),
  { immediate: true },
)

function paperMetaLine(row: SourceSummary): string {
  const ys = [row.paper_year, row.paper_province, row.paper_suite_type]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
  return ys.join(' · ') || ''
}

async function confirmDelete(row: SourceSummary, ev: Event) {
  ev.stopPropagation()
  const ok = window.confirm(
    `确定删除这条题目记录？删除后不可恢复。\n「${previewRowForConfirm(row)}」`,
  )
  if (!ok) return
  deletingId.value = row.id
  try {
    await shenlunApi.deleteSource(row.id)
    const cached = readSourcesCache(selectedNodeId.value)
    if (cached) {
      writeSourcesCache(
        selectedNodeId.value,
        cached.items.filter((i) => i.id !== row.id),
      )
      listCacheEmpty.value = cached.items.length <= 1
    }
    applyListFromCache(selectedNodeId.value)
  } catch {
    alert('删除失败')
  } finally {
    deletingId.value = null
  }
}

function toggleExpand(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function pickUncategorized() {
  void router.replace({ name: 'ShenlunHub', query: { node: SL_UNCATEGORIZED_ROUTE } })
}

function pickNode(id: string) {
  void router.replace({ name: 'ShenlunHub', query: { node: nodeIdToRouteQuery(id) } })
}

function goNewPractice() {
  void router.push({
    name: 'ShenlunWorkbench',
    query: { node: nodeIdToRouteQuery(selectedNodeId.value) },
  })
}

function openSource(row: SourceSummary) {
  void router.push({
    name: 'ShenlunWorkbench',
    query: {
      node: nodeIdToRouteQuery(row.node_id || selectedNodeId.value),
      source: row.id,
    },
  })
}

function collapseLine(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

/** 题干优先；题干为空则展示材料（避免「明明材料命中却只能看到无题干」） */
function previewRowLead(row: SourceSummary): string {
  const q = collapseLine(row.question_text_raw ?? '')
  if (q) return q.length > 96 ? `${q.slice(0, 96)}…` : q

  const rawMat = row.material_text_raw ?? ''
  const mat = collapseLine(rawMat)
  if (!mat) return '（无题干）'

  const needleRaw = collapseLine(searchQuery.value)
  if (needleRaw.length > 0) {
    const li = rawMat.toLowerCase().indexOf(needleRaw.toLowerCase())
    if (li !== -1) {
      const start = Math.max(0, li - 28)
      const end = Math.min(rawMat.length, li + needleRaw.length + 64)
      const frag = collapseLine(rawMat.slice(start, end))
      return `[材料命中] ${start ? '…' : ''}${frag}${end < rawMat.length ? '…' : ''}`
    }
  }
  const excerpt = mat.length > 92 ? `${mat.slice(0, 92)}…` : mat
  return `[材料预览] ${excerpt}`
}

function previewRowForConfirm(row: SourceSummary): string {
  const q = collapseLine(row.question_text_raw ?? '')
  if (q) return q.length > 120 ? `${q.slice(0, 120)}…` : q
  const mat = collapseLine(row.material_text_raw ?? '')
  if (mat) return mat.length > 120 ? `${mat.slice(0, 120)}…` : mat
  return '（无题干）'
}

function statusLabel(row: SourceSummary): string {
  const latest = row.latest_cc_status
  const okN = row.cc_success_count ?? 0
  const ac = row.attempt_count ?? 0
  if (latest === 'success') {
    return ac > 1 ? `已复盘 · ${ac} 轮练习` : '已复盘'
  }
  if (okN > 0) {
    return `本轮进行中 · 已成功复盘 ${okN} 次`
  }
  if (row.status === 'raw_draft') return '草稿'
  if (row.status === 'formatted') return '提炼中'
  if (row.status === 'extracted') return '已提炼'
  if (row.status === 'cc_done') return '已复盘'
  return row.status
}
</script>

<template>
  <div class="hub-page">
    <header class="hub-header">
      <div>
        <h1 class="hub-title">申论工作台</h1>
        <p class="hub-sub">本地优先展示；点「同步」与云端交换数据。</p>
        <p class="hub-sync-hint">{{ syncStatusHint }}</p>
      </div>
      <nav class="hub-nav hub-nav-wrap">
        <button
          type="button"
          class="btn btn-sync"
          :disabled="syncBusy"
          @click="manualSync"
        >
          {{ syncBusy ? '同步中…' : '同步' }}
        </button>
        <a href="/?portal=1" class="hub-module-hero-btn">
          <span class="hmh-main">模块首页</span>
          <span class="hmh-sub">门户切换</span>
        </a>
        <a href="/" class="hub-link hub-link-accent">行测工作台</a>
      </nav>
    </header>

    <div class="hub-shell">
      <aside class="hub-side">
        <div class="hub-side-head">
          <h2>申论知识树</h2>
        </div>
        <button
          type="button"
          class="hub-uncat"
          :class="{ active: selectedNodeId === '' }"
          @click="pickUncategorized"
        >
          未分类
        </button>

        <div class="hub-tree">
          <p v-if="syncBusy" class="hub-tree-muted">同步中…</p>
          <template v-for="n in knowledgeTree" :key="n.id">
            <div class="hub-tree-node">
              <div class="hub-tree-row">
                <button
                  v-if="hasChildren(n)"
                  type="button"
                  class="hub-tree-chevron"
                  @click="toggleExpand(n.id)"
                >
                  {{ expanded.has(n.id) ? '▾' : '▸' }}
                </button>
                <span v-else class="hub-tree-chevron hub-tree-chevron--ghost" />
                <button
                  type="button"
                  class="hub-tree-label hub-tree-label--leaf"
                  :class="{ active: selectedNodeId === n.id }"
                  @click="pickNode(n.id)"
                >
                  {{ n.title }}
                </button>
                <button
                  type="button"
                  class="hub-tree-add"
                  title="新建子节点（仅笔记）"
                  :disabled="treeActionBusy"
                  @click.stop="createChildNode(n.id)"
                >
                  +
                </button>
              </div>

              <div v-if="hasChildren(n) && expanded.has(n.id)" class="hub-tree-children">
                <div v-for="c in n.children" :key="c.id" class="hub-tree-row hub-tree-row--child">
                  <span class="hub-tree-chevron hub-tree-chevron--ghost" />
                  <button
                    type="button"
                    class="hub-tree-label hub-tree-label--leaf"
                    :class="{ active: selectedNodeId === c.id }"
                    @click="pickNode(c.id)"
                  >
                    {{ c.title }}
                  </button>
                  <div class="hub-tree-child-actions">
                    <button
                      type="button"
                      class="hub-tree-action"
                      title="重命名"
                      :disabled="treeActionBusy"
                      @click.stop="renameChildNode(c.id, c.title)"
                    >
                      改
                    </button>
                    <button
                      type="button"
                      class="hub-tree-action hub-tree-action--danger"
                      title="删除"
                      :disabled="treeActionBusy"
                      @click.stop="deleteChildNode(c.id, c.title)"
                    >
                      删
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </aside>

      <main class="hub-main">
        <div class="hub-main-head">
          <div>
            <h2>当前节点</h2>
            <p class="hub-node-path">{{ selectedNodeTitle }}</p>
          </div>
          <button
            v-if="!isNoteOnlySelected"
            type="button"
            class="btn btn-primary"
            @click="goNewPractice"
          >
            新建练习
          </button>
        </div>

        <div class="hub-seg-tabs" role="tablist">
          <button
            v-if="!isNoteOnlySelected"
            type="button"
            class="hub-tab"
            :class="{ active: hubMainSection === 'topics' }"
            role="tab"
            :aria-selected="hubMainSection === 'topics'"
            @click="hubMainSection = 'topics'"
          >
            题目
          </button>
          <button
            type="button"
            class="hub-tab hub-tab--with-marker"
            :class="{ active: hubMainSection === 'notes' }"
            role="tab"
            :aria-selected="hubMainSection === 'notes'"
            @click="hubMainSection = 'notes'"
          >
            笔记
            <span
              v-if="hubNotesTabMarkerClass"
              class="hub-tab-marker-wrap"
              title="笔记本同步状态提醒"
              aria-hidden="true"
            >
              <span class="hub-tab-marker-ring">
                <span :class="hubNotesTabMarkerClass" />
              </span>
            </span>
          </button>
          <button
            v-if="!isNoteOnlySelected"
            type="button"
            class="hub-tab"
            :class="{ active: hubMainSection === 'issues' }"
            role="tab"
            :aria-selected="hubMainSection === 'issues'"
            @click="goIssuesTab('', '')"
          >
            复盘问题
            <span v-if="issueStats && issueStats.total_entries > 0" class="hub-tab-count">
              {{ issueStats.total_entries }}
            </span>
          </button>
        </div>

        <p v-if="isNoteOnlySelected" class="hub-note-only-hint">
          本子节点仅用于 Markdown 笔记，不支持题目与复盘。
        </p>

        <template v-if="!isNoteOnlySelected && hubMainSection === 'topics'">
          <IssueStatsBar
            :stats="issueStats"
            :node-title="selectedNodeTitle"
            :active-tag="topicIssueTagFilter"
            :loading="syncBusy"
            @update:active-tag="onStatsTagUpdate"
            @view-all="onStatsViewAll"
          />
          <div class="hub-toolbar">
            <input
              v-model="searchQuery"
              type="search"
              class="hub-search"
              placeholder="搜索题干、材料或套卷信息…"
              enterkeyhint="search"
            />
            <select v-model="topicListFilter" class="hub-filter-select">
              <option value="all">全部题目</option>
              <option value="reviewed">已复盘</option>
              <option value="has_issues">含弱点标签</option>
            </select>
          </div>
          <p v-if="syncBusy" class="hub-muted">正在同步云端数据…</p>
          <p v-else-if="listError" class="hub-error">同步失败：{{ listError }}</p>
          <ul v-else class="hub-list">
            <li v-if="!filteredItems.length" class="hub-empty">
              {{
                listCacheEmpty
                  ? '暂无本地题目缓存，请点击顶栏「同步」从云端拉取。'
                  : items.length && filteredItems.length !== items.length
                    ? '没有符合筛选条件的题目。'
                    : '该知识点下还没有练习记录，可新建或先同步云端。'
              }}
            </li>
            <li v-for="row in filteredItems" :key="row.id" class="hub-row" @click="openSource(row)">
              <div class="hub-row-main">
                <span class="hub-row-title">{{ previewRowLead(row) }}</span>
                <span class="hub-row-meta">
                  <template v-if="paperMetaLine(row)">{{ paperMetaLine(row) }} · </template>
                  {{ statusLabel(row) }} · {{ row.attempt_count }} 次练习 ·
                  {{ new Date(row.updated_at).toLocaleString('zh-CN', { hour12: false }) }}
                </span>
                <div v-if="row.latest_issue_tags?.length" class="hub-row-tags" @click.stop>
                  <IssueTagChip
                    v-for="tag in row.latest_issue_tags.slice(0, 2)"
                    :key="tag"
                    :tag="tag"
                    size="sm"
                    @click="onTopicTagClick(tag, row.id, $event)"
                  />
                  <span v-if="row.latest_issue_tags.length > 2" class="hub-row-tags-more">
                    +{{ row.latest_issue_tags.length - 2 }}
                  </span>
                </div>
              </div>
              <div class="hub-row-actions">
                <button
                  type="button"
                  class="hub-row-del"
                  :disabled="deletingId === row.id"
                  @click.stop="confirmDelete(row, $event)"
                >
                  {{ deletingId === row.id ? '…' : '删除' }}
                </button>
                <button
                  type="button"
                  class="hub-row-copy"
                  @click.stop="copySourceProblem(row, $event)"
                >
                  {{ copyBlinkId === row.id ? '已复制' : '复制题目' }}
                </button>
                <span class="hub-row-go">打开 →</span>
              </div>
            </li>
          </ul>
        </template>

        <div v-if="!isNoteOnlySelected && hubMainSection === 'issues'" class="hub-issues-pane">
          <IssueFeedPanel
            ref="issueFeedRef"
            :node-id="selectedNodeId"
            :initial-tag="issuesInitialTag"
            :initial-source-id="issuesInitialSourceId"
          />
        </div>

        <div v-show="hubMainSection === 'notes'" class="hub-notes-pane">
          <div
            class="hub-notes-savebar"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div class="hub-notes-savebar-top">
              <span :class="hubNotesBadgeClass">{{ hubNotesBadgeText }}</span>
              <button
                v-if="hubNotesCloud.status === 'error' || hubNotesCloud.status === 'dirty'"
                type="button"
                class="hub-notes-retry"
                :disabled="syncBusy"
                @click="manualSync"
              >
                立即同步
              </button>
            </div>
            <p v-if="hubNotesSubHint" class="hub-notes-savebar-sub">{{ hubNotesSubHint }}</p>
          </div>
          <ShenlunHubNotesEditor
            v-if="hubMainSection === 'notes' || isNoteOnlySelected"
            :key="selectedNodeId"
            :model-value="hubNotesMd"
            @update:model-value="onNotesInput"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.hub-page {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 28px clamp(12px, 2.5vw, 22px) 64px;
  box-sizing: border-box;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Segoe UI', sans-serif;
  color: #1a1a2e;
}

.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.hub-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px;
}

.hub-sub {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

.hub-sync-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.btn-sync {
  align-self: center;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
}

.btn-sync:hover:not(:disabled) {
  background: #dbeafe;
}

.btn-sync:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hub-nav {
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.hub-nav-wrap {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hub-module-hero-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 22px;
  min-height: 48px;
  border-radius: 14px;
  text-decoration: none;
  border: 1px solid rgb(129 140 248);
  background: linear-gradient(135deg, #4338ca 0%, #4f46e5 45%, #7c3aed 100%);
  color: #fff;
  box-shadow: 0 10px 26px rgb(79 70 229 / 0.35);
  transition: filter 0.14s ease, transform 0.12s ease;
}

.hub-module-hero-btn:hover {
  filter: brightness(1.06);
}

.hub-module-hero-btn:active {
  transform: scale(0.99);
}

.hmh-main {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.14em;
  line-height: 1.2;
  text-shadow: 0 1px 0 rgb(0 0 0 / 0.18);
}

.hmh-sub {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.92;
}

.hub-link {
  font-size: 14px;
  font-weight: 700;
  color: #2563eb;
  text-decoration: none;
  align-self: center;
  padding: 8px 4px;
}

.hub-link-accent {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  border-radius: 10px;
  padding: 10px 16px;
  color: #1d4ed8;
}

.hub-link-accent:hover {
  text-decoration: none;
  background: #dbeafe;
  border-color: #93c5fd;
}

.hub-shell {
  display: grid;
  grid-template-columns: minmax(200px, min(280px, 26vw)) minmax(0, 1fr);
  gap: clamp(14px, 2vw, 24px);
  min-width: 0;
}

@media (max-width: 760px) {
  .hub-shell {
    grid-template-columns: 1fr;
  }

  .hub-nav-wrap {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .hub-module-hero-btn {
    width: 100%;
    min-height: 54px;
  }

  .hub-link-accent {
    text-align: center;
    width: 100%;
    box-sizing: border-box;
  }
}

.hub-side {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
  padding: 12px 10px 16px;
  align-self: start;
}

.hub-side-head h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}

.hub-uncat {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  margin-bottom: 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: #4b5563;
}

.hub-uncat.active {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 600;
}

.hub-tree-node + .hub-tree-node {
  margin-top: 6px;
}

.hub-tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hub-tree-row--child {
  padding-left: 14px;
}

.hub-tree-chevron {
  width: 22px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #9ca3af;
  flex-shrink: 0;
  font-size: 12px;
}

.hub-tree-chevron--ghost {
  display: inline-block;
  width: 22px;
  flex-shrink: 0;
}

.hub-tree-label {
  flex: 1;
  text-align: left;
  font-size: 13px;
  border: none;
  background: transparent;
  padding: 6px 8px;
  border-radius: 6px;
  color: #374151;
  cursor: default;
}

.hub-tree-label--leaf {
  cursor: pointer;
}

.hub-tree-label--leaf:hover {
  background: #f3f4f6;
}

.hub-tree-label--leaf.active {
  background: #dbeafe;
  color: #1e40af;
  font-weight: 600;
}

.hub-tree-muted {
  margin: 0 0 8px;
  font-size: 12px;
  color: #9ca3af;
}

.hub-tree-add {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #6b7280;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.hub-tree-add:hover:not(:disabled) {
  border-color: #93c5fd;
  color: #2563eb;
  background: #eff6ff;
}

.hub-tree-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hub-tree-child-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.hub-tree-action {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 5px;
  cursor: pointer;
}

.hub-tree-action:hover:not(:disabled) {
  border-color: #93c5fd;
  color: #2563eb;
  background: #eff6ff;
}

.hub-tree-action--danger:hover:not(:disabled) {
  border-color: #fecaca;
  color: #b91c1c;
  background: #fef2f2;
}

.hub-tree-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hub-note-only-hint {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  font-size: 13px;
}

.hub-tree-label--group {
  font-weight: 600;
  color: #111827;
}

.hub-tree-children {
  margin-top: 4px;
}

.hub-main {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 18px clamp(12px, 1.8vw, 20px) 24px;
  background: #fff;
  min-width: 0;
  overflow-x: clip;
}

.hub-main-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.hub-seg-tabs {
  display: flex;
  gap: 4px;
  margin: 0 0 16px;
  padding: 3px;
  background: #f3f4f6;
  border-radius: 8px;
  width: fit-content;
}

.hub-tab {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  padding: 7px 16px;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}

.hub-tab:hover {
  color: #374151;
}

.hub-tab.active {
  background: #fff;
  color: #1d4ed8;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
}

.hub-tab--with-marker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.hub-tab-marker-wrap {
  display: inline-flex;
  align-items: center;
  margin-left: 2px;
}

.hub-tab-marker-ring {
  display: flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
}

.hub-tab-marker {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.hub-tab-marker--pending {
  background: #f59e0b;
  box-shadow: 0 0 0 2px rgb(251 191 36 / 0.4);
  animation: hubNotesDotPulse 1.15s ease-in-out infinite;
}

.hub-tab-marker--error {
  background: #ef4444;
  box-shadow: 0 0 0 2px rgb(252 165 165 / 0.55);
}

.hub-tab-count {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 11px;
  font-weight: 700;
}

.hub-issues-pane {
  margin-top: 4px;
  min-width: 0;
}

.hub-row-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.hub-row-tags-more {
  font-size: 11px;
  color: #6b7280;
}

@keyframes hubNotesDotPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.85;
  }
}

.hub-notes-pane {
  margin-top: 4px;
  min-width: 0;
}

.hub-notes-savebar {
  border: 1px solid #bfdbfe;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
  box-shadow: 0 1px 3px rgb(37 99 235 / 0.06);
}

.hub-notes-savebar-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.hub-notes-badge {
  font-size: 13px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 999px;
  letter-spacing: 0.02em;
}

.hub-notes-badge--loading {
  background: #e5e7eb;
  color: #374151;
}

.hub-notes-badge--saving {
  background: #dbeafe;
  color: #1e40af;
  animation: hubNotesBadgeGlow 1.1s ease-in-out infinite;
}

.hub-notes-badge--pending {
  background: rgb(254 243 199);
  color: #b45309;
  border: 1px solid rgb(251 191 36);
}

.hub-notes-badge--ok {
  background: rgb(209 250 229);
  color: #047857;
  border: 1px solid rgb(110 231 183);
}

.hub-notes-badge--error {
  background: rgb(254 226 226);
  color: #b91c1c;
  border: 1px solid rgb(248 113 113);
}

@keyframes hubNotesBadgeGlow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(59 130 246 / 0.25);
  }
  50% {
    box-shadow: 0 0 0 6px rgb(59 130 246 / 0);
  }
}

.hub-notes-savebar-sub {
  margin: 10px 0 0;
  padding: 0;
  font-size: 12px;
  line-height: 1.55;
  color: #4b5563;
}

.hub-notes-retry {
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
  background: #fff;
  border: 1px solid #93c5fd;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.hub-notes-retry:hover {
  background: #eff6ff;
}

.hub-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.hub-search {
  flex: 1 1 220px;
  width: auto;
  max-width: 420px;
  box-sizing: border-box;
  padding: 9px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}
.hub-filter-select {
  flex: 0 0 auto;
  font-size: 13px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #374151;
}
.hub-search:focus {
  outline: none;
  border-color: #3b82f6;
}
.hub-row-del {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  cursor: pointer;
}
.hub-row-del:hover:not(:disabled) {
  background: #fee2e2;
}
.hub-row-del:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hub-row-copy {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  cursor: pointer;
}

.hub-row-copy:hover {
  background: #dbeafe;
}

.hub-main-head h2 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
}

.hub-node-path {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
}

.hub-muted {
  color: #9ca3af;
  font-size: 14px;
}

.hub-error {
  color: #dc2626;
  font-size: 14px;
}

.hub-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.hub-empty {
  padding: 28px 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
}

.hub-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 12px;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.hub-row:hover {
  border-color: #bfdbfe;
  background: #f8fafc;
}

.hub-row-main {
  flex: 1;
  min-width: 0;
}

.hub-row-title {
  display: block;
  font-size: 14px;
  color: #111827;
  line-height: 1.5;
}

.hub-row-meta {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.hub-row-go {
  flex-shrink: 0;
  font-size: 13px;
  color: #2563eb;
  font-weight: 600;
}
</style>
