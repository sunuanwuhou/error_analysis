<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ShenlunHubNotesEditor from '@/components/shenlun/ShenlunHubNotesEditor.vue'
import { shenlunApi, type SourceSummary } from '@/api/shenlun'
import {
  SL_TREE,
  shenlunNodeTitle,
  routeQueryToNodeId,
  nodeIdToRouteQuery,
  SL_UNCATEGORIZED_ROUTE,
} from '@/data/shenlunTree'
import { savePortalLastModule } from '@/lib/portalPrefs'

const route = useRoute()
const router = useRouter()

const selectedNodeId = computed(() => routeQueryToNodeId(route.query.node))

const items = ref<SourceSummary[]>([])
const listLoading = ref(false)
const listError = ref<string | null>(null)
const searchQuery = ref('')
const deletingId = ref<string | null>(null)

let searchDebounce: ReturnType<typeof setTimeout> | null = null

type HubMainSection = 'topics' | 'notes'
const hubMainSection = ref<HubMainSection>('topics')
const notesEditorMounted = ref(false)

const NOTES_LS_PREFIX = 'shenlun:hubNotes:v1:'

function notesStorageKey(nodeId: string): string {
  return NOTES_LS_PREFIX + (nodeId === '' ? '_uncategorized_' : nodeId)
}

/** 知识点笔记 Markdown（与 hubNotesMd 同步；以服务器为准并写回本地作缓存） */
const hubNotesMd = ref('')

let hubNotesNavChain = Promise.resolve()
const skipHubNotesPersist = ref(false)
type HubNotesCloudState = 'idle' | 'loading' | 'synced' | 'saving' | 'error'
const hubNotesCloud = ref<{ status: HubNotesCloudState; detail?: string }>({
  status: 'idle',
})

let persistHubNotesTimer: ReturnType<typeof setTimeout> | null = null
const PERSIST_DEBOUNCE_MS = 560

/** 服务器返回的上一版保存时间（ISO），用于向用户展示「确实已写入云端」 */
const hubNotesLastServerAt = ref('')
/** 防抖等待中：已编辑但尚未发起 PUT */
const hubNotesDebounceActive = ref(false)

function applyHubNoteSavedMeta(r: { updated_at?: string }) {
  const u = (r.updated_at ?? '').trim()
  if (u) hubNotesLastServerAt.value = u
}

function formatHubSavedAt(iso: string): string {
  const s = iso.trim()
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', { hour12: false })
}

const hubNotesBadgeText = computed(() => {
  const st = hubNotesCloud.value.status
  if (st === 'idle' || st === 'loading') return '正在加载笔记本…'
  if (st === 'error') return '云端保存失败'
  if (st === 'saving') return '正在保存到云端…'
  if (st === 'synced' && hubNotesDebounceActive.value) return '有改动：将自动保存'
  if (st === 'synced') return '已保存到云端（账号）'
  return '申论笔记'
})

const hubNotesBadgeClass = computed(() => {
  const st = hubNotesCloud.value.status
  return {
    'hub-notes-badge': true,
    'hub-notes-badge--loading': st === 'idle' || st === 'loading',
    'hub-notes-badge--saving': st === 'saving',
    'hub-notes-badge--error': st === 'error',
    'hub-notes-badge--pending': st === 'synced' && hubNotesDebounceActive.value,
    'hub-notes-badge--ok': st === 'synced' && !hubNotesDebounceActive.value,
  }
})

const hubNotesSubHint = computed(() => {
  const st = hubNotesCloud.value.status
  if (st === 'error') {
    return (
      hubNotesCloud.value.detail ||
      '请检查网络后点「重试保存」，或重新登录后再试。'
    )
  }
  if (st === 'idle' || st === 'loading') {
    return '正在连接服务器并读取当前知识点的笔记本…'
  }
  if (st === 'saving') {
    return '正在向服务器写入，请稍候…'
  }
  const saved = formatHubSavedAt(hubNotesLastServerAt.value)
  if (st === 'synced' && saved) {
    return `云端记录时间：${saved}（换设备登录同一账号可继续编辑）`
  }
  if (st === 'synced') {
    return '编辑后约 1 秒内自动上传；切换知识点、切走标签或关闭页面前也会再保存一次。'
  }
  return ''
})

/** 「笔记」标签上的小点：有未上传改动 / 正在保存 / 失败时提醒 */
const hubNotesTabMarkerClass = computed(() => {
  const st = hubNotesCloud.value.status
  if (st === 'error') return 'hub-tab-marker hub-tab-marker--error'
  if (st === 'saving' || (st === 'synced' && hubNotesDebounceActive.value)) {
    return 'hub-tab-marker hub-tab-marker--pending'
  }
  return ''
})

function flushHubNotesToNode(nodeId: string) {
  try {
    localStorage.setItem(notesStorageKey(nodeId), hubNotesMd.value)
  } catch {
    /* storage full or disabled */
  }
}

function clearHubNotesPersistTimer() {
  if (persistHubNotesTimer !== null) {
    window.clearTimeout(persistHubNotesTimer)
    persistHubNotesTimer = null
  }
  hubNotesDebounceActive.value = false
}

function applyHubNotesFromRemote(md: string) {
  skipHubNotesPersist.value = true
  hubNotesMd.value = md
  queueMicrotask(() => {
    skipHubNotesPersist.value = false
  })
}

async function persistHubNotesToServerNow(nodeId: string): Promise<void> {
  flushHubNotesToNode(nodeId)
  hubNotesCloud.value = { status: 'saving' }
  try {
    const r = await shenlunApi.putHubNote(nodeId, hubNotesMd.value)
    applyHubNoteSavedMeta(r)
    hubNotesCloud.value = { status: 'synced' }
  } catch (e) {
    hubNotesCloud.value = { status: 'error', detail: (e as Error).message }
  }
}

function scheduleHubNotesPersist() {
  if (skipHubNotesPersist.value) return
  const nid = selectedNodeId.value
  clearHubNotesPersistTimer()
  hubNotesDebounceActive.value = true
  persistHubNotesTimer = window.setTimeout(() => {
    persistHubNotesTimer = null
    hubNotesDebounceActive.value = false
    void (async () => {
      flushHubNotesToNode(nid)
      hubNotesCloud.value = { status: 'saving' }
      try {
        const r = await shenlunApi.putHubNote(nid, hubNotesMd.value)
        applyHubNoteSavedMeta(r)
        hubNotesCloud.value = { status: 'synced' }
      } catch (err) {
        hubNotesCloud.value = { status: 'error', detail: (err as Error).message }
      }
    })()
  }, PERSIST_DEBOUNCE_MS)
}

watch(
  () => selectedNodeId.value,
  (id, prev) => {
    hubNotesNavChain = hubNotesNavChain
      .then(async () => {
        clearHubNotesPersistTimer()

        if (prev !== undefined) {
          await persistHubNotesToServerNow(prev)
        }

        hubNotesCloud.value = { status: 'loading' }
        hubNotesLastServerAt.value = ''
        try {
          const remote = await shenlunApi.getHubNote(id)
          applyHubNoteSavedMeta(remote)
          let md = remote.body_md ?? ''
          if (!md.trim()) {
            try {
              const legacy = localStorage.getItem(notesStorageKey(id)) ?? ''
              if (legacy.trim()) {
                md = legacy
                const up = await shenlunApi.putHubNote(id, md)
                applyHubNoteSavedMeta(up)
              }
            } catch {
              /* ignore migration upload errors */
            }
          }
          applyHubNotesFromRemote(md)
          await nextTick()
          flushHubNotesToNode(id)
          hubNotesCloud.value = { status: 'synced' }
        } catch (e) {
          hubNotesCloud.value = { status: 'error', detail: (e as Error).message }
          try {
            applyHubNotesFromRemote(localStorage.getItem(notesStorageKey(id)) ?? '')
          } catch {
            applyHubNotesFromRemote('')
          }
        }
      })
      .catch(() => {})
  },
  { immediate: true },
)

watch(
  hubNotesMd,
  () => {
    scheduleHubNotesPersist()
  },
  { flush: 'sync' },
)

async function retryHubNotesSave() {
  const nid = selectedNodeId.value
  hubNotesCloud.value = { status: 'saving' }
  flushHubNotesToNode(nid)
  try {
    const r = await shenlunApi.putHubNote(nid, hubNotesMd.value)
    applyHubNoteSavedMeta(r)
    hubNotesCloud.value = { status: 'synced' }
  } catch (e) {
    hubNotesCloud.value = { status: 'error', detail: (e as Error).message }
  }
}

function flushHubNotesBestEffort() {
  clearHubNotesPersistTimer()
  const nid = selectedNodeId.value
  flushHubNotesToNode(nid)
  void shenlunApi
    .putHubNote(nid, hubNotesMd.value)
    .then((r) => {
      applyHubNoteSavedMeta(r)
      hubNotesCloud.value = { status: 'synced' }
    })
    .catch(() => {})
}

function onVisibilityFlush() {
  if (document.visibilityState === 'hidden') flushHubNotesBestEffort()
}

onMounted(() => {
  savePortalLastModule('shenlun')
  document.addEventListener('visibilitychange', onVisibilityFlush)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityFlush)
  clearHubNotesPersistTimer()
  flushHubNotesToNode(selectedNodeId.value)
  void shenlunApi
    .putHubNote(selectedNodeId.value, hubNotesMd.value)
    .then((r) => applyHubNoteSavedMeta(r))
    .catch(() => {})
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

watch(hubMainSection, (s) => {
  if (s === 'notes') notesEditorMounted.value = true
})

const expanded = ref<Set<string>>(
  new Set(SL_TREE.map((n) => n.id)),
)

async function loadList() {
  listLoading.value = true
  listError.value = null
  try {
    const res = await shenlunApi.listSources(selectedNodeId.value, searchQuery.value)
    items.value = res.items
  } catch (e) {
    listError.value = (e as Error).message
    items.value = []
  } finally {
    listLoading.value = false
  }
}

watch(
  () => selectedNodeId.value,
  () => void loadList(),
  { immediate: true },
)

watch(searchQuery, () => {
  if (searchDebounce) window.clearTimeout(searchDebounce)
  searchDebounce = window.setTimeout(() => void loadList(), 280)
})

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
    await loadList()
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
        <p class="hub-sub">先选知识点，再查看已有练习或新建录入。</p>
      </div>
      <nav class="hub-nav hub-nav-wrap">
        <a href="/?portal=1" class="hub-module-hero-btn">
          <span class="hmh-main">模块首页</span>
          <span class="hmh-sub">门户切换</span>
        </a>
        <router-link :to="{ name: 'XingceWorkspace' }" class="hub-link hub-link-accent">行测工作台</router-link>
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
          <template v-for="n in SL_TREE" :key="n.id">
            <div class="hub-tree-node">
              <div class="hub-tree-row">
                <button
                  v-if="n.children?.length"
                  type="button"
                  class="hub-tree-chevron"
                  @click="toggleExpand(n.id)"
                >
                  {{ expanded.has(n.id) ? '▾' : '▸' }}
                </button>
                <span v-else class="hub-tree-chevron hub-tree-chevron--ghost" />
                <span v-if="n.children?.length" class="hub-tree-label hub-tree-label--group">{{ n.title }}</span>
                <button
                  v-else
                  type="button"
                  class="hub-tree-label hub-tree-label--leaf"
                  :class="{ active: selectedNodeId === n.id }"
                  @click="pickNode(n.id)"
                >
                  {{ n.title }}
                </button>
              </div>

              <div v-if="n.children?.length && expanded.has(n.id)" class="hub-tree-children">
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
            <p class="hub-node-path">{{ shenlunNodeTitle(selectedNodeId) }}</p>
          </div>
          <button type="button" class="btn btn-primary" @click="goNewPractice">新建练习</button>
        </div>

        <div class="hub-seg-tabs" role="tablist">
          <button
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
        </div>

        <template v-if="hubMainSection === 'topics'">
          <div class="hub-toolbar">
            <input
              v-model="searchQuery"
              type="search"
              class="hub-search"
              placeholder="搜索题干、材料或套卷信息…"
              enterkeyhint="search"
            />
          </div>
          <p v-if="listLoading" class="hub-muted">加载中…</p>
          <p v-else-if="listError" class="hub-error">加载失败：{{ listError }}</p>
          <ul v-else class="hub-list">
            <li v-if="!items.length" class="hub-empty">该知识点下还没有练习记录，点击右上角新建。</li>
            <li v-for="row in items" :key="row.id" class="hub-row" @click="openSource(row)">
              <div class="hub-row-main">
                <span class="hub-row-title">{{ previewRowLead(row) }}</span>
                <span class="hub-row-meta">
                  <template v-if="paperMetaLine(row)">{{ paperMetaLine(row) }} · </template>
                  {{ statusLabel(row) }} · {{ row.attempt_count }} 次练习 ·
                  {{ new Date(row.updated_at).toLocaleString('zh-CN', { hour12: false }) }}
                </span>
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
                v-if="hubNotesCloud.status === 'error'"
                type="button"
                class="hub-notes-retry"
                @click="retryHubNotesSave"
              >
                重试保存
              </button>
            </div>
            <p v-if="hubNotesSubHint" class="hub-notes-savebar-sub">{{ hubNotesSubHint }}</p>
          </div>
          <ShenlunHubNotesEditor
            v-if="notesEditorMounted"
            v-model="hubNotesMd"
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
  margin-bottom: 14px;
}
.hub-search {
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
  padding: 9px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
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
