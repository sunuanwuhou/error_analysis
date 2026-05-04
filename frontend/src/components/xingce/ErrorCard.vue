<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ErrorEntry } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'
import PracticeModal from './PracticeModal.vue'

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

function fmtDuration(sec: number | undefined): string {
  if (!sec || sec <= 0) return ''
  const s = Math.round(sec)
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}分${r}秒` : `${m}分钟`
}
</script>

<template>
  <div class="ec" :class="{ 'ec--expanded': expanded }">
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

    <!-- 练习统计 chips -->
    <div v-if="summary" class="ec-practice-chips">
      <span class="ec-pc pc-wrong">错 {{ summary.recentWrongCount ?? 0 }} 次</span>
      <span v-if="fmtDuration(summary.lastDuration)" class="ec-pc pc-time">
        最近用时 {{ fmtDuration(summary.lastDuration) }}
      </span>
      <span v-if="fmtDuration(entry.targetDurationSec)" class="ec-pc pc-target">
        预计 {{ fmtDuration(entry.targetDurationSec) }}
      </span>
      <span v-if="summary.lastResult" class="ec-pc" :class="summary.lastResult === 'correct' ? 'pc-correct' : 'pc-wrong-light'">
        {{ summary.lastResult === 'correct' ? '上次正确' : '上次错误' }}
      </span>
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
      <div v-if="entry.note" class="ec-section">
        <span class="ec-section-label">备注</span>
        <p>{{ entry.note }}</p>
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
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.15s;
}
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
</style>
