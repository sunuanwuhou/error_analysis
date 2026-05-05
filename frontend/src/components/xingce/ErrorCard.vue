<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ErrorEntry, KnowledgeNode } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'
import PracticeModal from './PracticeModal.vue'

const WORKFLOW_OPTIONS = [
  { value: 'captured', label: '待判因' },
  { value: 'diagnosing', label: '判因中' },
  { value: 'review_ready', label: '待复盘' },
  { value: 'retrain_due', label: '待复训' },
  { value: 'mastered', label: '已闭环' },
]

const props = defineProps<{ entry: ErrorEntry }>()
const store = useXingceStore()
const expanded = ref(false)
const confirmDelete = ref(false)
const practicing = ref(false)

function cycleStatus() {
  const next: Record<string, ErrorEntry['status']> = {
    focus: 'review', review: 'mastered', mastered: 'focus'
  }
  store.updateError(props.entry.id, { status: next[props.entry.status] ?? 'focus' })
}

function cycleMastery() {
  const next: Record<string, ErrorEntry['masteryLevel']> = {
    not_mastered: 'fuzzy', fuzzy: 'mastered', mastered: 'not_mastered'
  }
  store.updateError(props.entry.id, {
    masteryLevel: next[props.entry.masteryLevel ?? 'not_mastered']
  })
}

function doDelete() {
  if (!confirmDelete.value) { confirmDelete.value = true; setTimeout(() => confirmDelete.value = false, 3000); return }
  store.deleteError(props.entry.id)
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

/** 对齐旧版 `getErrorWrongCount`：摘要 / quiz / 错题本体字段取最大 */
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

/** 对齐旧版 `getRecentDurationSeconds` */
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

/** 对齐旧版 `renderPracticeSummaryMeta`（第四条 cyan chip） */
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

function onWorkflowChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value
  store.updateError(props.entry.id, { workflowStage: v })
}

function onMoveNode(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value
  store.updateError(props.entry.id, { noteNodeId: v || undefined })
}

function onNoteBlur(ev: Event) {
  store.updateError(props.entry.id, { note: (ev.target as HTMLTextAreaElement).value })
}
</script>

<template>
  <div
    class="ec"
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
    <!-- 顶部标签行 -->
    <div class="ec-tags">
      <span class="ec-tag" :class="statusInfo.cls">{{ statusInfo.label }}</span>
      <span v-if="entry.subSubtype" class="ec-tag tag-sub">{{ entry.subSubtype }}</span>
      <span v-if="knowledgePath" class="ec-tag tag-path" :title="knowledgePath">{{ knowledgePath }}</span>
      <span v-if="entry.problemType && entry.problemType !== 'unknown'" class="ec-tag tag-pt">
        {{ problemTypeLabel[entry.problemType] ?? entry.problemType }}
      </span>
      <span class="ec-tag" :class="masteryInfo.cls">{{ masteryInfo.label }}</span>
    </div>

    <!-- 题目 -->
    <div class="ec-question">{{ entry.question }}</div>

    <!-- 选项 -->
    <div v-if="optionLines.length" class="ec-options">
      <p v-for="(opt, i) in optionLines" :key="i" class="ec-option">{{ opt }}</p>
    </div>

    <!-- 练习统计 chips（对齐 legacy `renderCardPracticeMetaChips`） -->
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

    <!-- 操作栏 -->
    <div class="ec-actions">
      <button class="ec-toggle" @click="expanded = !expanded">{{ expanded ? '收起' : '详情' }}</button>
      <button class="ec-act" :class="statusInfo.cls" @click="cycleStatus" :title="'切换：' + statusInfo.label">{{ statusInfo.label }}</button>
      <button class="ec-act" :class="masteryInfo.cls" @click="cycleMastery" :title="'切换掌握度：' + masteryInfo.label">{{ masteryInfo.label }}</button>
      <button class="ec-act tag-sub" style="margin-left:auto" @click="practicing = true">练习</button>
      <button class="ec-del" :class="{ confirm: confirmDelete }" @click="doDelete">
        {{ confirmDelete ? '确认?' : '删除' }}
      </button>
    </div>

    <PracticeModal v-if="practicing" :entry="entry" @close="practicing = false" />

    <!-- 展开面板 -->
    <div v-if="expanded" class="ec-detail">
      <div class="ec-pills">
        <span v-if="entry.myAnswer" class="ec-pill pill-wrong">我的答案：{{ entry.myAnswer }}</span>
        <span class="ec-pill pill-correct">正确答案：{{ entry.answer ?? '-' }}</span>
        <span v-if="entry.confidence" class="ec-pill pill-meta">信心 {{ entry.confidence }}/5</span>
        <span v-if="entry.actualDurationSec" class="ec-pill pill-meta">用时 {{ entry.actualDurationSec }}s</span>
        <span v-if="entry.targetDurationSec" class="ec-pill pill-meta">目标 {{ entry.targetDurationSec }}s</span>
      </div>
      <div v-if="entry.errorReason || entry.rootReason" class="ec-section">
        <span class="ec-section-label">错误原因</span>
        <p>{{ entry.errorReason || entry.rootReason }}</p>
      </div>
      <div v-if="entry.analysis" class="ec-section">
        <span class="ec-section-label">解析</span>
        <p class="ec-analysis">{{ entry.analysis }}</p>
      </div>
      <div v-if="entry.tip || entry.nextAction" class="ec-section">
        <span class="ec-section-label">提示</span>
        <p>{{ entry.tip || entry.nextAction }}</p>
      </div>

      <div class="ec-section ec-tools">
        <span class="ec-section-label">卡片操作</span>
        <div class="ec-tool-grid">
          <span class="ec-mini-label">任务阶段</span>
          <select
            class="ec-select"
            :value="entry.workflowStage || 'captured'"
            @change="onWorkflowChange"
          >
            <option v-for="w in WORKFLOW_OPTIONS" :key="w.value" :value="w.value">{{ w.label }}</option>
          </select>
          <span class="ec-mini-label">关联知识点</span>
          <select class="ec-select" :value="entry.noteNodeId || ''" @change="onMoveNode">
            <option value="">（未关联）</option>
            <option v-for="n in knowledgeLeaves" :key="n.id" :value="n.id">{{ leafLabel(n) }}</option>
          </select>
          <span class="ec-mini-label">备注</span>
          <textarea
            class="ec-note-input"
            rows="2"
            :value="entry.note || ''"
            placeholder="失焦自动保存"
            @blur="onNoteBlur"
          />
        </div>
      </div>
    </div>
    </div>
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
@keyframes ec-picked-flash {
  0% { box-shadow: 0 0 0 0 rgba(74, 108, 247, 0.55); }
  100% { box-shadow: 0 0 0 6px rgba(74, 108, 247, 0); }
}
.ec--picked {
  animation: ec-picked-flash 0.9s ease-out 2;
  border-color: #4a6cf7;
}

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

.ec-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.ec-toggle {
  font-size: 12px;
  color: #4a6cf7;
  background: none;
  border: 1px solid #c7d2fe;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
}
.ec-toggle:hover { background: #eef2ff; }

.ec-act {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: opacity 0.15s;
}
.ec-act:hover { opacity: 0.75; }

.ec-del {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 8px;
  border: 1px solid #fca5a5;
  background: #fff1f0;
  color: #b91c1c;
  cursor: pointer;
  margin-left: auto;
}
.ec-del.confirm { background: #b91c1c; color: #fff; border-color: #b91c1c; }

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

.ec-tools { margin-top: 4px; }
.ec-tool-grid {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 6px 8px;
  align-items: center;
}
.ec-mini-label { font-size: 11px; color: #64748b; }
.ec-select {
  width: 100%;
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
}
.ec-note-input {
  grid-column: 1 / -1;
  width: 100%;
  font-size: 12px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  resize: vertical;
  box-sizing: border-box;
}

.ec-practice-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.ec-pc {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 8px;
  border: 1px solid transparent;
}
.pc-wrong       { background:#fff1f2; color:#be123c; border-color:#fecdd3; }
.pc-wrong-light { background:#fff7f0; color:#c2410c; border-color:#fed7aa; }
.pc-correct     { background:#f0fdf4; color:#16a34a; border-color:#bbf7d0; }
.pc-time        { background:#ecfdf5; color:#065f46; border-color:#a7f3d0; }
.pc-target      { background:#eef2ff; color:#3730a3; border-color:#c7d2fe; }
.pc-meta        { background:#ecfeff; color:#155e75; border-color:#a5f3fc; }
</style>
