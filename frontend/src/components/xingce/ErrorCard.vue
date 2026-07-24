<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import type { ErrorEntry, KnowledgeNode } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'
import PracticeModal from './PracticeModal.vue'
import ErrorQuestionImage from './ErrorQuestionImage.vue'
import { hasErrorImage } from '@/lib/errorImage'
import {
  ERROR_STATUS_OPTIONS,
  ERROR_WORKFLOW_OPTIONS,
  buildMasteryCyclePatch,
  buildStatusPatch,
  buildWorkflowPatch,
  copyErrorMarkdown,
  copyQuestionAndOptions,
  masteryButtonStyle,
} from '@/lib/errorCardActions'

const props = defineProps<{ entry: ErrorEntry }>()
const store = useXingceStore()
const openEditError = inject<(id: string) => void>('xingceOpenEditError')

const expanded = ref(false)
const practicing = ref(false)
const showMoveModal = ref(false)
const moveTarget = ref('')

function onStatusChange(ev: Event) {
  const status = (ev.target as HTMLSelectElement).value as ErrorEntry['status']
  store.updateError(props.entry.id, buildStatusPatch(props.entry, status))
}

function onWorkflowChange(ev: Event) {
  const stage = (ev.target as HTMLSelectElement).value
  store.updateError(props.entry.id, buildWorkflowPatch(props.entry, stage))
}

function cycleMastery() {
  store.updateError(props.entry.id, buildMasteryCyclePatch(props.entry))
}

function doDelete() {
  if (!window.confirm(`删除 #${props.entry.id}？`)) return
  store.deleteError(props.entry.id)
}

function openMoveModal() {
  moveTarget.value = props.entry.noteNodeId || ''
  showMoveModal.value = true
}

function applyMove() {
  if (!moveTarget.value) return
  store.updateError(props.entry.id, { noteNodeId: moveTarget.value })
  showMoveModal.value = false
}

function onEdit() {
  openEditError?.(props.entry.id)
}

function onCopyMd() {
  copyErrorMarkdown(props.entry)
}

function onCopyQuestion() {
  copyQuestionAndOptions(props.entry)
}

function walkLeaves(nodes: KnowledgeNode[]): KnowledgeNode[] {
  const out: KnowledgeNode[] = []
  for (const n of nodes) {
    const kids = n.children ?? []
    if (kids.length) out.push(...walkLeaves(kids as KnowledgeNode[]))
    else out.push(n)
  }
  return out
}

const knowledgeLeaves = computed(() => walkLeaves(store.knowledgeTree))

function leafLabel(n: KnowledgeNode) {
  const p = store.getNodePathText(n.id)
  return p ? `${p} › ${n.title}` : n.title
}

function onNoteBlur(ev: Event) {
  store.updateError(props.entry.id, { note: (ev.target as HTMLTextAreaElement).value })
}

const statusMap = {
  focus:    { label: '重点复习', cls: 'tag-focus' },
  review:   { label: '待复习',   cls: 'tag-review' },
  mastered: { label: '已掌握',   cls: 'tag-mastered' },
}
const masteryMap = {
  not_mastered: { label: '未掌握', cls: 'mastery-no' },
  fuzzy:        { label: '模糊',   cls: 'mastery-fuzzy' },
  mastered:     { label: '已掌握', cls: 'mastery-yes' },
}

const statusInfo = computed(() => statusMap[props.entry.status] ?? statusMap.focus)
const masteryInfo = computed(() => masteryMap[props.entry.masteryLevel ?? 'not_mastered'])
const masteryBtn = computed(() => masteryButtonStyle(props.entry.masteryLevel))

const knowledgePath = computed(() =>
  [props.entry.type, props.entry.subtype, props.entry.subSubtype].filter(Boolean).join(' › ')
)

const optionLines = computed(() =>
  props.entry.options ? props.entry.options.split(/\n|\|/).map(s => s.trim()).filter(Boolean) : []
)

const problemTypeLabel: Record<string, string> = {
  cognition: '认知',
  execution: '执行',
  mixed:     '混合',
  unknown:   '待定',
}

const summary = computed(() => store.practiceSummaries[props.entry.id] ?? null)

const wrongCount = computed(() => {
  const s = summary.value
  const e = props.entry as Record<string, unknown>
  const summaryWrong = Number(s?.recentWrongCount ?? (s as { wrongCount?: number } | null)?.wrongCount ?? 0)
  const quiz = e.quiz as { wrongCount?: number } | undefined
  const quizWrong = Number(quiz?.wrongCount ?? 0)
  const directWrong = Number(e.recentWrongCount ?? e.wrongCount ?? 0)
  const vals = [summaryWrong, quizWrong, directWrong].filter(v => Number.isFinite(v) && v >= 0).map(v => Math.floor(v))
  return vals.length ? Math.max(...vals) : 0
})

const recentDurationSec = computed(() => {
  const s = summary.value
  const fromSummary = Number(s?.lastDuration ?? 0)
  if (Number.isFinite(fromSummary) && fromSummary > 0) return fromSummary
  const actual = Number(props.entry.actualDurationSec ?? 0)
  if (Number.isFinite(actual) && actual > 0) return actual
  const legacy = Number((props.entry as Record<string, unknown>).lastDuration ?? 0)
  return Number.isFinite(legacy) && legacy > 0 ? legacy : 0
})

const targetDurationSec = computed(() => {
  const t = Number(props.entry.targetDurationSec ?? 0)
  return Number.isFinite(t) && t > 0 ? t : 0
})

function fmtDuration(sec: number | undefined): string {
  if (!sec || sec <= 0) return ''
  const s = Math.round(sec)
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}分${r}秒` : `${m}分钟`
}

function formatPracticeSummaryTime(raw: string | undefined): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return String(raw)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const dateText = sameYear
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  return `${dateText} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const practiceMetaLine = computed(() => {
  const s = summary.value
  if (!s) return ''
  const resultMap: Record<string, string> = {
    correct: '正确',
    wrong: '错误',
    skipped: '跳过',
    partial: '部分正确',
  }
  const bits: string[] = []
  if (s.lastResult) bits.push(`最近结果 ${resultMap[s.lastResult] ?? s.lastResult}`)
  if (Number(s.recentWrongCount || 0) > 0) bits.push(`错 ${Number(s.recentWrongCount)} 次`)
  if (s.lastConfidence) bits.push(`信心 ${s.lastConfidence}`)
  if (s.lastDuration) bits.push(`上次用时 ${fmtDuration(s.lastDuration)}`)
  if (s.avgDuration) bits.push(`平均用时 ${fmtDuration(s.avgDuration)}`)
  if (s.lastTime) bits.push(formatPracticeSummaryTime(s.lastTime))
  return bits.join(' / ')
})

const practiceSummaryMetaDisplay = computed(() => {
  if (practiceMetaLine.value) return practiceMetaLine.value
  if (wrongCount.value > 0) return `Wrong x${wrongCount.value}`
  return ''
})

const showPracticeChips = computed(() =>
  wrongCount.value > 0
  || recentDurationSec.value > 0
  || targetDurationSec.value > 0
  || !!practiceMetaLine.value,
)

</script>

<template>
  <div
    class="error-card ec"
    :class="{ 'ec--expanded': expanded, 'ec--batch': store.batchMode }"
    :data-error-id="entry.id"
  >
    <label v-if="store.batchMode" class="ec-batch-cb" @click.stop>
      <input
        type="checkbox"
        :checked="store.batchSelectedIds.includes(entry.id)"
        @change="store.toggleBatchSelect(entry.id)"
      />
    </label>
    <div class="ec-inner">
      <div class="ec-tags card-top">
        <span class="ec-tag status-tag" :class="statusInfo.cls">{{ statusInfo.label }}</span>
        <span v-if="entry.subSubtype" class="ec-tag tag-sub">{{ entry.subSubtype }}</span>
        <span v-if="knowledgePath" class="ec-tag tag-path" :title="knowledgePath">{{ knowledgePath }}</span>
        <span v-if="entry.problemType && entry.problemType !== 'unknown'" class="ec-tag tag-pt">
          {{ problemTypeLabel[entry.problemType] ?? entry.problemType }}
        </span>
        <span class="ec-tag" :class="masteryInfo.cls">{{ masteryInfo.label }}</span>
      </div>

      <div class="card-question-surface">
        <div v-if="String(entry.question || '').trim()" class="ec-question card-question">{{ entry.question }}</div>
        <ErrorQuestionImage v-if="hasErrorImage(entry, 'imgData')" :src="entry.imgData" variant="card" />
        <div v-if="optionLines.length" class="ec-options card-options">
          <p v-for="(opt, i) in optionLines" :key="i" class="ec-option">{{ opt }}</p>
        </div>
      </div>

      <div v-if="showPracticeChips" class="ec-practice-chips">
        <span class="ec-pc pc-wrong">错 {{ wrongCount }} 次</span>
        <span v-if="fmtDuration(recentDurationSec)" class="ec-pc pc-time">
          最近用时 {{ fmtDuration(recentDurationSec) }}
        </span>
        <span v-if="fmtDuration(targetDurationSec)" class="ec-pc pc-target">
          预计用时 {{ fmtDuration(targetDurationSec) }}
        </span>
        <span v-if="practiceSummaryMetaDisplay" class="ec-pc pc-meta">{{ practiceSummaryMetaDisplay }}</span>
      </div>

      <div v-if="expanded" class="ec-detail card-lower-panel">
        <div class="ec-pills detail-meta-row">
          <span v-if="entry.myAnswer" class="ec-pill pill-wrong detail-pill wrong-pill">我的答案：{{ entry.myAnswer }}</span>
          <span class="ec-pill pill-correct detail-pill correct-pill">正确答案：{{ entry.answer ?? '-' }}</span>
          <span v-if="entry.confidence" class="ec-pill pill-meta detail-pill meta-pill">信心 {{ entry.confidence }}/5</span>
          <span v-if="entry.actualDurationSec" class="ec-pill pill-meta detail-pill meta-pill">用时 {{ entry.actualDurationSec }}s</span>
          <span v-if="entry.targetDurationSec" class="ec-pill pill-meta detail-pill meta-pill">目标 {{ entry.targetDurationSec }}s</span>
        </div>
        <div v-if="entry.errorReason || entry.rootReason" class="ec-section">
          <span class="ec-section-label">错误原因</span>
          <p>{{ entry.errorReason || entry.rootReason }}</p>
        </div>
        <div v-if="entry.analysis" class="ec-section card-detail">
          <span class="ec-section-label">解析</span>
          <p class="ec-analysis detail-analysis">{{ entry.analysis }}</p>
        </div>
        <ErrorQuestionImage
          v-if="hasErrorImage(entry, 'analysisImgData')"
          :src="entry.analysisImgData"
          variant="analysis"
          alt="解析图片"
        />
        <div v-if="entry.tip || entry.nextAction" class="ec-section">
          <span class="ec-section-label">提示</span>
          <p>{{ entry.tip || entry.nextAction }}</p>
        </div>
        <div class="card-note-area">
          <div class="card-note-label">备注</div>
          <textarea
            class="card-note-ta ec-note-input"
            rows="2"
            :value="entry.note || ''"
            placeholder="添加备注…"
            @blur="onNoteBlur"
          />
        </div>
      </div>

      <button
        type="button"
        class="card-reveal-btn"
        :style="expanded ? 'color:#bbb;border-color:#eee;font-size:11px;margin-top:6px' : ''"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : '查看详情' }}
      </button>

      <div class="card-actions card-actions-soft">
        <button type="button" class="btn btn-sm btn-secondary" @click="openMoveModal">改挂载</button>
        <select
          class="status-select"
          :value="entry.status"
          @change="onStatusChange"
        >
          <option v-for="s in ERROR_STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
        <select
          class="status-select"
          :value="entry.workflowStage || 'captured'"
          title="任务阶段"
          @change="onWorkflowChange"
        >
          <option v-for="w in ERROR_WORKFLOW_OPTIONS" :key="w.value" :value="w.value">{{ w.label }}</option>
        </select>
        <button
          type="button"
          class="btn btn-sm ec-mastery-btn"
          :style="{
            color: masteryBtn.color,
            background: masteryBtn.bg,
            border: `1px solid ${masteryBtn.border}`,
          }"
          title="切换掌握度"
          @click="cycleMastery"
        >
          ● {{ masteryBtn.label }}
        </button>
        <button type="button" class="btn btn-sm btn-secondary" @click="onCopyQuestion">复制题干</button>
        <button type="button" class="btn btn-sm btn-secondary" @click="onCopyMd">复制MD</button>
        <button type="button" class="btn btn-sm btn-secondary" @click="onEdit">编辑</button>
        <button
          type="button"
          class="btn btn-sm btn-secondary ec-quiz-btn"
          @click="practicing = true"
        >
          做题
        </button>
        <button type="button" class="del-btn del-btn-danger" @click="doDelete">删除</button>
      </div>

      <PracticeModal v-if="practicing" :entry="entry" @close="practicing = false" />
    </div>

    <Teleport to="body">
      <div v-if="showMoveModal" class="ec-move-mask" @click.self="showMoveModal = false">
        <div class="ec-move-dialog" role="dialog" aria-modal="true" @keydown.escape.prevent="showMoveModal = false">
          <div class="ec-move-title">改挂载</div>
          <p class="ec-move-hint">将此题挂载到所选知识点叶子节点。</p>
          <select v-model="moveTarget" class="status-select ec-move-select">
            <option value="">请选择目标知识点…</option>
            <option v-for="n in knowledgeLeaves" :key="n.id" :value="n.id">{{ leafLabel(n) }}</option>
          </select>
          <div class="ec-move-actions">
            <button type="button" class="btn btn-sm btn-secondary" @click="showMoveModal = false">取消</button>
            <button type="button" class="btn btn-sm btn-primary" :disabled="!moveTarget" @click="applyMove">应用</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ec {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  transition: box-shadow 0.15s;
}
.ec-inner {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ec-batch-cb {
  flex-shrink: 0;
  padding-top: 2px;
  cursor: pointer;
}
.ec-batch-cb input { cursor: pointer; width: 16px; height: 16px; }
.ec:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.ec--expanded { border-color: #bfdbfe; }

.ec-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.ec-tag {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid transparent;
  white-space: nowrap;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag-focus    { background:#fff1f0; color:#cf1322; border-color:#ffa39e; }
.tag-review   { background:#fff7e6; color:#d46b08; border-color:#ffd591; }
.tag-mastered { background:#f6ffed; color:#389e0d; border-color:#b7eb8f; }
.tag-sub      { background:#f0f5ff; color:#4e8ef7; border-color:#adc6ff; }
.tag-path     { background:#f8fafc; color:#475569; border-color:#e2e8f0; }
.tag-pt       { background:#f5f3ff; color:#6d28d9; border-color:#ddd6fe; }
.mastery-no   { background:#fff1f0; color:#cf1322; border-color:#ffa39e; }
.mastery-fuzzy{ background:#fffbe6; color:#d48806; border-color:#ffe58f; }
.mastery-yes  { background:#f6ffed; color:#389e0d; border-color:#b7eb8f; }

.ec-question {
  font-size: 14px;
  line-height: 1.7;
  color: #1a1a1a;
  white-space: pre-wrap;
  word-break: break-word;
}

.ec-options { display: flex; flex-direction: column; gap: 2px; }
.ec-option { font-size: 13px; color: #444; margin: 0; padding: 2px 0; }

.ec-detail { display: flex; flex-direction: column; gap: 10px; }

.ec-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.ec-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
}
.pill-wrong   { background:#fff1f0; color:#cf1322; border-color:#ffa39e; }
.pill-correct { background:#f6ffed; color:#389e0d; border-color:#b7eb8f; }
.pill-meta    { background:#f0f9ff; color:#0369a1; border-color:#bae6fd; }

.ec-section { display: flex; flex-direction: column; gap: 4px; }
.ec-section-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ec-section p { font-size: 13px; color: #333; margin: 0; line-height: 1.6; }
.ec-analysis  { white-space: pre-wrap; }

.card-note-area { margin-top: 4px; }
.card-note-label { font-size: 11px; color: #888; margin-bottom: 4px; }
.ec-note-input {
  width: 100%;
  font-size: 12px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}

.ec-quiz-btn {
  color: #4e8ef7;
  border-color: #adc6ff;
}

.ec-practice-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.ec-pc {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 8px;
  border: 1px solid transparent;
}
.pc-wrong  { background:#fff1f2; color:#be123c; border-color:#fecdd3; }
.pc-time   { background:#ecfdf5; color:#065f46; border-color:#a7f3d0; }
.pc-target { background:#eef2ff; color:#3730a3; border-color:#c7d2fe; }
.pc-meta   { background:#ecfeff; color:#155e75; border-color:#a5f3fc; }

.ec-move-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  z-index: 1150;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.ec-move-dialog {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  width: min(420px, 96vw);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
}
.ec-move-title { font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
.ec-move-hint { font-size: 12px; color: #64748b; margin: 0 0 12px; line-height: 1.5; }
.ec-move-select { width: 100%; margin-bottom: 14px; }
.ec-move-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
