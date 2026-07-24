<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import '@/styles/xingce-knowledge-workspace.css'
import { useXingceStore } from '@/stores/xingceStore'
import type { ErrorEntry } from '@/api/xingce'
import KnowledgeNotePreview from './KnowledgeNotePreview.vue'
import {
  buildRandomNoteReviewQueue,
  collectErrorsForRandomNotePractice,
  daysSince,
  formatGapDays,
  formatIsoTime,
  getRandomNoteRootFilterOptions,
  getRandomNoteTodayReviewedCount,
  loadNoteReviewTracking,
  markRandomNoteViewed,
  pickAllPracticeQueue,
  pickHighValuePracticeQueue,
  resolveOpenWorkspaceNodeId,
  type RandomNoteCandidate,
  type RandomNoteQueueMode,
} from '@/lib/randomNoteReview'

const emit = defineEmits<{
  close: []
  openInWorkspace: [nodeId: string]
  startPractice: [payload: { queue: ErrorEntry[]; title: string }]
}>()

const store = useXingceStore()

const queueMode = ref<RandomNoteQueueMode>('weighted')
const rootFilter = ref('')
const skipIds = ref(new Set<string>())
const reviewQueue = ref<RandomNoteCandidate[]>([])
const reviewIndex = ref(-1)
const tracking = ref(loadNoteReviewTracking())

const storeCtx = computed(() => ({
  knowledgeTree: store.knowledgeTree,
  knowledgeNodes: store.knowledgeNodes,
  notesByType: store.notesByType,
  errors: store.errors,
  practiceSummaries: store.practiceSummaries,
  getNodePathText: store.getNodePathText,
  getKnowledgeNodeInTree: store.getKnowledgeNodeInTree,
  countErrorsForKnowledgeNode: store.countErrorsForKnowledgeNode,
}))

const rootOptions = computed(() => getRandomNoteRootFilterOptions(storeCtx.value))
const todayReviewedCount = computed(() => getRandomNoteTodayReviewedCount(tracking.value))

const current = computed(() => {
  if (reviewIndex.value < 0 || reviewIndex.value >= reviewQueue.value.length) return null
  return reviewQueue.value[reviewIndex.value] ?? null
})

const liveNode = computed(() => (current.value ? store.getKnowledgeNodeInTree(current.value.nodeId) : null))
const liveTracking = computed(() => (current.value ? tracking.value[current.value.nodeId] : undefined))

const pathText = computed(() => {
  if (!current.value) return ''
  if (current.value.pathTitles?.length) return current.value.pathTitles.join(' > ')
  return store.getNodePathText(current.value.nodeId)
})

const whyText = computed(() => {
  const updatedAt = String(liveNode.value?.updatedAt || current.value?.updatedAt || '')
  const lastViewedAt = String(liveTracking.value?.lastViewedAt || current.value?.lastViewedAt || '')
  const editGap = formatGapDays(daysSince(updatedAt))
  const viewGap = lastViewedAt ? formatGapDays(daysSince(lastViewedAt)) : '从未'
  return `距上次编辑 ${editGap}，距上次查看 ${viewGap}`
})

const errorCount = computed(() =>
  current.value ? collectErrorsForRandomNotePractice(storeCtx.value, current.value.nodeId).length : 0,
)

function rebuildQueue(excludeNodeId?: string) {
  const queue = buildRandomNoteReviewQueue(storeCtx.value, {
    excludeNodeId,
    rootId: rootFilter.value,
    mode: queueMode.value,
    skipIds: skipIds.value,
    tracking: tracking.value,
  })
  reviewQueue.value = queue
  reviewIndex.value = queue.length ? 0 : -1
  markCurrentViewed()
}

function markCurrentViewed() {
  const item = current.value
  if (!item?.nodeId) return
  tracking.value = markRandomNoteViewed(tracking.value, item.nodeId)
}

function setQueueMode(mode: RandomNoteQueueMode) {
  if (queueMode.value === mode) return
  queueMode.value = mode
  rebuildQueue(current.value?.nodeId)
}

function setRootFilter(value: string) {
  rootFilter.value = value
  rebuildQueue()
}

function prevItem() {
  if (reviewIndex.value <= 0) return
  reviewIndex.value -= 1
  markCurrentViewed()
}

function nextItem() {
  if (reviewIndex.value >= reviewQueue.value.length - 1) return
  reviewIndex.value += 1
  markCurrentViewed()
}

function shuffleItem() {
  const exclude = current.value?.nodeId
  const queue = buildRandomNoteReviewQueue(storeCtx.value, {
    excludeNodeId: exclude,
    rootId: rootFilter.value,
    mode: queueMode.value,
    skipIds: skipIds.value,
    tracking: tracking.value,
  })
  if (!queue.length) {
    window.alert('没有更多可切换笔记')
    return
  }
  reviewQueue.value = queue
  reviewIndex.value = 0
  markCurrentViewed()
}

function skipItem() {
  const item = current.value
  if (!item?.nodeId) return
  skipIds.value = new Set(skipIds.value).add(item.nodeId)
  const hadNext = reviewIndex.value < reviewQueue.value.length - 1
  reviewQueue.value = reviewQueue.value.filter(row => row.nodeId !== item.nodeId)
  if (!reviewQueue.value.length) {
    reviewIndex.value = -1
    window.alert('当前筛选下没有更多笔记')
    return
  }
  if (!hadNext) reviewIndex.value = Math.max(0, reviewQueue.value.length - 1)
  markCurrentViewed()
}

function openInWorkspace() {
  const item = current.value
  if (!item?.nodeId) return
  const nodeId = resolveOpenWorkspaceNodeId(storeCtx.value, item.nodeId)
  if (!nodeId) {
    window.alert('无法定位到知识树节点')
    return
  }
  emit('openInWorkspace', nodeId)
  emit('close')
}

function startHighValuePractice() {
  const item = current.value
  if (!item?.nodeId) return
  const queue = pickHighValuePracticeQueue(storeCtx.value, item.nodeId, 5)
  if (!queue.length) {
    window.alert('这条笔记下暂无可练习错题')
    return
  }
  emit('startPractice', { queue, title: `笔记高价值练习 · ${item.title} (${queue.length}题)` })
  emit('close')
}

function startAllPractice() {
  const item = current.value
  if (!item?.nodeId) return
  const queue = pickAllPracticeQueue(storeCtx.value, item.nodeId)
  if (!queue.length) {
    window.alert('这条笔记下暂无可练习错题')
    return
  }
  emit('startPractice', { queue, title: `笔记全部错题 · ${item.title} (${queue.length}题)` })
  emit('close')
}

watch(current, (item, prev) => {
  if (item?.nodeId && item.nodeId !== prev?.nodeId) markCurrentViewed()
})

rebuildQueue()
</script>

<template>
  <Teleport to="body">
    <div class="rnr-backdrop" @click.self="emit('close')">
      <div class="rnr-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <button type="button" class="rnr-close" aria-label="关闭" @click="emit('close')">×</button>
        <h2 class="rnr-title">随机笔记复习</h2>
        <p class="rnr-sub">按「越久未编辑 + 越久未查看」加权抽取，避免只看熟悉内容。</p>

        <div class="rnr-controls">
          <div class="rnr-controls-left">
            <span class="rnr-label">排序模式</span>
            <button
              type="button"
              class="rnr-mode-btn"
              :class="{ active: queueMode === 'weighted' }"
              @click="setQueueMode('weighted')"
            >
              加权随机
            </button>
            <button
              type="button"
              class="rnr-mode-btn"
              :class="{ active: queueMode === 'priority' }"
              @click="setQueueMode('priority')"
            >
              按优先级
            </button>
          </div>
          <div class="rnr-controls-right">
            <select class="rnr-select" :value="rootFilter" @change="setRootFilter(($event.target as HTMLSelectElement).value)">
              <option value="">全部模块</option>
              <option v-for="opt in rootOptions" :key="opt.id" :value="opt.id">{{ opt.title }}</option>
            </select>
            <span class="rnr-pill rnr-pill--green">今日已复习 {{ todayReviewedCount }} 条</span>
          </div>
        </div>

        <div v-if="!current" class="rnr-empty">
          <strong>暂无可复习笔记</strong>
          <span>请先在知识点下补充笔记内容，或调整模块筛选。</span>
        </div>

        <template v-else>
          <div class="rnr-meta-row">
            <div class="rnr-meta-left">
              <span class="rnr-count">{{ reviewIndex + 1 }} / {{ reviewQueue.length }}</span>
              <span class="rnr-pill rnr-pill--amber">{{ whyText }}</span>
              <span class="rnr-pill rnr-pill--blue">优先级 {{ Number(current.score || 0).toFixed(1) }}</span>
              <span class="rnr-pill rnr-pill--red">错题 {{ errorCount }} 道</span>
            </div>
            <div class="rnr-meta-right">
              最后编辑：{{ formatIsoTime(liveNode?.updatedAt || current.updatedAt) }}
              · 上次查看：{{ liveTracking?.lastViewedAt ? formatIsoTime(liveTracking.lastViewedAt) : '从未' }}
            </div>
          </div>

          <div class="rnr-card">
            <h3>{{ current.title }}</h3>
            <div class="rnr-path">{{ pathText }}</div>
          </div>

          <div class="rnr-preview xc-vue-legacy note-preview-scroll">
            <KnowledgeNotePreview
              :markdown="current.contentMd"
              :node-id="current.nodeId"
              :note-images="store.noteImages"
            />
          </div>

          <div class="rnr-actions">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="reviewIndex <= 0" @click="prevItem">上一个</button>
            <button type="button" class="btn btn-secondary btn-sm" :disabled="reviewIndex >= reviewQueue.length - 1" @click="nextItem">下一个</button>
            <button type="button" class="btn btn-secondary btn-sm" @click="shuffleItem">换一条</button>
            <button type="button" class="btn btn-secondary btn-sm" @click="skipItem">跳过</button>
            <button type="button" class="btn btn-secondary btn-sm" @click="startHighValuePractice">练高价值错题(5题)</button>
            <button type="button" class="btn btn-secondary btn-sm" :disabled="errorCount <= 0" @click="startAllPractice">练全部错题({{ errorCount }}题)</button>
            <button type="button" class="btn btn-primary btn-sm" @click="openInWorkspace">打开到知识树</button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rnr-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1350;
  background: rgba(15, 23, 42, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  box-sizing: border-box;
}
.rnr-modal {
  position: relative;
  width: min(860px, 96vw);
  max-height: 90vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px;
  padding: 18px 20px 20px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}
.rnr-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: #f1f5f9;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.rnr-title {
  margin: 0 0 6px;
  font-size: 20px;
}
.rnr-sub {
  margin: 0 0 12px;
  font-size: 12px;
  color: #888;
}
.rnr-controls {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.rnr-controls-left,
.rnr-controls-right,
.rnr-meta-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.rnr-label {
  font-size: 12px;
  color: #64748b;
}
.rnr-mode-btn {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  border-radius: 8px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}
.rnr-mode-btn.active {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #93c5fd;
}
.rnr-select {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  min-width: 140px;
  background: #fff;
}
.rnr-pill {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
}
.rnr-pill--green {
  background: #f0fdf4;
  color: #166534;
  border-color: #bbf7d0;
}
.rnr-pill--amber {
  background: #fff7e6;
  color: #ad6800;
  border-color: #ffd591;
}
.rnr-pill--blue {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}
.rnr-pill--red {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}
.rnr-empty {
  padding: 24px 16px;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #64748b;
  font-size: 13px;
}
.rnr-meta-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.rnr-meta-right {
  font-size: 12px;
  color: #888;
}
.rnr-count {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f8fafc;
  color: #475569;
}
.rnr-card {
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #f1e5d7;
  border-radius: 12px;
  background: #fffaf5;
}
.rnr-card h3 {
  margin: 0 0 6px;
  font-size: 16px;
}
.rnr-path {
  font-size: 12px;
  color: #888;
  line-height: 1.7;
}
.rnr-preview {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  height: min(48vh, 520px);
  min-height: 280px;
  overflow: hidden;
  padding: 14px;
  box-sizing: border-box;
}
.rnr-actions {
  margin-top: 14px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
