<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { INTERVIEW_DIFFICULTY_LABELS } from '@/data/interviewCategories'
import type { InterviewPracticeRecord, InterviewQuestion } from '@/api/interview'
import {
  REVIEW_RATING_LABELS,
  formatReviewDueLabel,
  hasPolishedAnswer,
  isReviewDue,
  polishedLengthHint,
  type InterviewReviewRating,
} from '@/lib/interviewReview'

const props = defineProps<{
  question: InterviewQuestion | null
  record: InterviewPracticeRecord | null
  labelForCategory: (id: string) => string
  saving: boolean
  saveError: string | null
}>()

const emit = defineEmits<{
  save: [payload: { my_answer: string; polished_answer: string; note: string; is_starred: boolean }]
  review: [rating: InterviewReviewRating]
  edit: []
  delete: []
}>()

const myAnswer = ref('')
const polishedAnswer = ref('')
const note = ref('')
const isStarred = ref(false)
const showFramework = ref(true)
const showSample = ref(false)
const reviewMode = ref(false)
const reviewSubmitted = ref(false)

let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => [props.question?.id, props.record] as const,
  () => {
    myAnswer.value = props.record?.my_answer ?? ''
    polishedAnswer.value = props.record?.polished_answer ?? ''
    note.value = props.record?.note ?? ''
    isStarred.value = props.record?.is_starred ?? false
    showSample.value = false
    reviewMode.value = false
    reviewSubmitted.value = false
  },
  { immediate: true },
)

const metaLine = computed(() => {
  const q = props.question
  if (!q) return ''
  const parts = [
    props.labelForCategory(q.category),
    INTERVIEW_DIFFICULTY_LABELS[q.difficulty] || '中等',
  ]
  if (q.source) parts.push(q.source)
  return parts.join(' · ')
})

const reviewDue = computed(() => isReviewDue(props.record))
const reviewStatus = computed(() => formatReviewDueLabel(props.record))
const polishedHint = computed(() => polishedLengthHint(polishedAnswer.value))
const canReview = computed(() => hasPolishedAnswer(props.record))
const hideReferencePanels = computed(() => reviewMode.value && !reviewSubmitted.value)

function scheduleSave() {
  if (!props.question) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    emit('save', {
      my_answer: myAnswer.value,
      polished_answer: polishedAnswer.value,
      note: note.value,
      is_starred: isStarred.value,
    })
  }, 600)
}

function onStarToggle() {
  isStarred.value = !isStarred.value
  scheduleSave()
}

function saveNow() {
  if (saveTimer) clearTimeout(saveTimer)
  emit('save', {
    my_answer: myAnswer.value,
    polished_answer: polishedAnswer.value,
    note: note.value,
    is_starred: isStarred.value,
  })
}

function startReview() {
  if (!canReview.value) return
  reviewMode.value = true
  reviewSubmitted.value = false
  showSample.value = false
}

function exitReview() {
  reviewMode.value = false
  reviewSubmitted.value = false
}

function onReviewRating(rating: InterviewReviewRating) {
  reviewSubmitted.value = true
  emit('review', rating)
}
</script>

<template>
  <section class="iv-detail">
    <div v-if="!question" class="iv-detail-empty">
      <p>请从左侧选择一道题目开始练习</p>
    </div>

    <template v-else>
      <header class="iv-detail-head">
        <p class="iv-detail-meta">{{ metaLine }}</p>
        <h1 class="iv-detail-title">{{ question.question_text }}</h1>
        <div class="iv-detail-actions">
          <button type="button" class="iv-btn iv-btn--ghost" @click="emit('edit')">编辑题目</button>
          <button type="button" class="iv-btn iv-btn--danger" @click="emit('delete')">删除</button>
          <button
            type="button"
            class="iv-btn iv-btn--ghost"
            :class="{ 'iv-btn--starred': isStarred }"
            @click="onStarToggle"
          >
            {{ isStarred ? '★ 已标星' : '☆ 标星' }}
          </button>
          <button
            v-if="canReview && !reviewMode"
            type="button"
            class="iv-btn iv-btn--review"
            :class="{ 'iv-btn--review-due': reviewDue }"
            @click="startReview"
          >
            {{ reviewDue ? '开始复习（到期）' : '开始复习' }}
          </button>
          <button v-if="reviewMode" type="button" class="iv-btn iv-btn--ghost" @click="exitReview">
            退出复习
          </button>
          <button type="button" class="iv-btn iv-btn--primary" :disabled="saving" @click="saveNow">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
        <p v-if="saveError" class="iv-save-error">{{ saveError }}</p>
        <p v-else-if="record?.updated_at" class="iv-save-ok">
          上次保存：{{ new Date(record.updated_at).toLocaleString('zh-CN', { hour12: false }) }}
          <span v-if="canReview" class="iv-review-status" :class="{ 'iv-review-status--due': reviewDue }">
            · {{ reviewStatus }}
          </span>
        </p>
      </header>

      <div v-if="reviewMode" class="iv-review-banner">
        <template v-if="!reviewSubmitted">
          <strong>复习模式</strong>
          <span>只看题干，限时口述后整理到「我的作答」，再自评掌握程度。</span>
        </template>
        <template v-else>
          <strong>已记录本次复习</strong>
          <span>可展开「我的完整版」对照，或退出复习继续编辑。</span>
        </template>
      </div>

      <div class="iv-panels">
        <details v-if="!hideReferencePanels" class="iv-panel" :open="showFramework">
          <summary @click.prevent="showFramework = !showFramework">答题框架</summary>
          <pre class="iv-panel-body iv-framework">{{ question.framework || '暂无框架' }}</pre>
        </details>

        <details v-if="!hideReferencePanels" class="iv-panel">
          <summary @click.prevent="showSample = !showSample">参考答案</summary>
          <pre class="iv-panel-body iv-sample">{{ question.sample_answer || '暂无参考答案' }}</pre>
        </details>

        <div class="iv-panel iv-panel--open">
          <h3 class="iv-panel-heading">{{ reviewMode && !reviewSubmitted ? '复习作答' : '我的作答' }}</h3>
          <p v-if="!reviewMode" class="iv-panel-tip">第一遍练习：限时 3 分钟口述后整理成文字，允许粗糙。</p>
          <textarea
            v-model="myAnswer"
            class="iv-textarea"
            rows="8"
            :placeholder="
              reviewMode
                ? '复习：只看题干口述，再把要点整理到这里…'
                : '在此模拟作答（建议 3 分钟口述后整理成文字）…'
            "
            @input="scheduleSave"
          />
        </div>

        <div v-if="!hideReferencePanels" class="iv-panel iv-panel--open iv-panel--polished">
          <div class="iv-panel-heading-row">
            <h3 class="iv-panel-heading iv-panel-heading--inline">我的完整版</h3>
            <span class="iv-polished-hint">{{ polishedHint }}</span>
          </div>
          <p class="iv-panel-tip">
            对照框架与参考答案，写成 150～250 字、能一口气说完整的口播稿。保存后自动安排 3 天后复习。
          </p>
          <textarea
            v-model="polishedAnswer"
            class="iv-textarea iv-textarea--polished"
            rows="8"
            placeholder="按答题结构写成完整话术，用自己的话，不要照抄参考答案…"
            @input="scheduleSave"
          />
        </div>

        <div v-if="reviewMode && !reviewSubmitted" class="iv-panel iv-panel--open iv-review-panel">
          <h3 class="iv-panel-heading">自评掌握程度</h3>
          <p class="iv-panel-tip">说完后再点选，系统会自动安排下次复习时间。</p>
          <div class="iv-review-actions">
            <button
              v-for="(label, key) in REVIEW_RATING_LABELS"
              :key="key"
              type="button"
              class="iv-review-btn"
              :class="`iv-review-btn--${key}`"
              :disabled="saving"
              @click="onReviewRating(key as InterviewReviewRating)"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <details v-if="!hideReferencePanels || reviewSubmitted" class="iv-panel" :open="reviewSubmitted">
          <summary>我的完整版（对照）</summary>
          <pre class="iv-panel-body iv-polished-read">{{ polishedAnswer || '尚未写好完整版' }}</pre>
        </details>

        <div v-if="!reviewMode" class="iv-panel iv-panel--open">
          <h3 class="iv-panel-heading">笔记</h3>
          <textarea
            v-model="note"
            class="iv-textarea iv-textarea--note"
            rows="4"
            placeholder="卡壳点、改进点、可复用金句…"
            @input="scheduleSave"
          />
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.iv-detail {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 28px 32px;
  background: #fff;
}

.iv-detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  font-size: 14px;
}

.iv-detail-head {
  margin-bottom: 20px;
}

.iv-detail-meta {
  margin: 0 0 8px;
  font-size: 12px;
  color: #64748b;
}

.iv-detail-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.5;
  color: #0f172a;
}

.iv-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.iv-btn {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
}

.iv-btn--ghost:hover {
  border-color: #ea580c;
  color: #ea580c;
}

.iv-btn--danger {
  border-color: #fecaca;
  color: #dc2626;
}

.iv-btn--danger:hover {
  background: #fef2f2;
}

.iv-btn--starred {
  border-color: #ea580c;
  color: #ea580c;
  background: #fff7ed;
}

.iv-btn--review {
  border-color: #93c5fd;
  color: #1d4ed8;
  background: #eff6ff;
}

.iv-btn--review:hover {
  border-color: #3b82f6;
}

.iv-btn--review-due {
  border-color: #fca5a5;
  color: #b91c1c;
  background: #fef2f2;
}

.iv-btn--primary {
  border: none;
  background: linear-gradient(135deg, #ea580c, #c2410c);
  color: #fff;
}

.iv-btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.iv-save-error {
  margin: 10px 0 0;
  font-size: 12px;
  color: #dc2626;
}

.iv-save-ok {
  margin: 10px 0 0;
  font-size: 12px;
  color: #059669;
}

.iv-review-status {
  color: #64748b;
}

.iv-review-status--due {
  color: #dc2626;
  font-weight: 700;
}

.iv-review-banner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  font-size: 13px;
  color: #1e3a8a;
}

.iv-review-banner strong {
  font-size: 14px;
}

.iv-panels {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.iv-panel {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.iv-panel summary {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  background: #f8fafc;
  list-style: none;
}

.iv-panel summary::-webkit-details-marker {
  display: none;
}

.iv-panel--open {
  padding: 0;
}

.iv-panel--polished {
  border-color: #fed7aa;
}

.iv-panel-heading {
  margin: 0;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.iv-panel-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
}

.iv-panel-heading--inline {
  padding: 0;
  background: transparent;
  border: none;
}

.iv-polished-hint {
  font-size: 12px;
  color: #c2410c;
  white-space: nowrap;
}

.iv-panel-tip {
  margin: 0;
  padding: 10px 16px 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.iv-panel-body {
  margin: 0;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  font-family: inherit;
  color: #334155;
}

.iv-framework {
  background: #fffbeb;
}

.iv-sample {
  background: #f0fdf4;
}

.iv-polished-read {
  background: #fff7ed;
}

.iv-textarea {
  display: block;
  width: 100%;
  padding: 14px 16px;
  border: none;
  resize: vertical;
  font-size: 14px;
  line-height: 1.6;
  font-family: inherit;
  box-sizing: border-box;
}

.iv-textarea:focus {
  outline: none;
}

.iv-textarea--polished {
  background: #fffbf5;
}

.iv-textarea--note {
  min-height: 100px;
}

.iv-review-panel {
  border-color: #bfdbfe;
}

.iv-review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px 16px;
}

.iv-review-btn {
  flex: 1 1 160px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

.iv-review-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.iv-review-btn--smooth {
  border-color: #86efac;
  color: #166534;
}

.iv-review-btn--smooth:hover:not(:disabled) {
  background: #f0fdf4;
}

.iv-review-btn--ok {
  border-color: #fde68a;
  color: #92400e;
}

.iv-review-btn--ok:hover:not(:disabled) {
  background: #fffbeb;
}

.iv-review-btn--forgot {
  border-color: #fca5a5;
  color: #991b1b;
}

.iv-review-btn--forgot:hover:not(:disabled) {
  background: #fef2f2;
}
</style>
