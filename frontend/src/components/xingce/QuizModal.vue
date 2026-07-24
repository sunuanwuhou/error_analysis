<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import { xingceApi } from '@/api/xingce'
import type { ErrorEntry } from '@/api/xingce'
import ErrorQuestionImage from './ErrorQuestionImage.vue'
import {
  isImageHeavyQuestion,
  hasErrorImage,
  resolveErrorQueueItems,
  normalizeErrorImageSrc,
} from '@/lib/errorImage'

const IMAGE_OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

type QuizMode = 'daily' | 'full' | 'review' | 'retrain' | 'random'
type Phase = 'loading' | 'question' | 'review' | 'saving' | 'done'

interface Answer {
  id: string
  userAnswer: string
  correct: boolean
  skipped: boolean
  durationSec: number
}

const props = defineProps<{
  mode: QuizMode
  initialQueue?: ErrorEntry[]
  titleOverride?: string
}>()
const emit = defineEmits<{ close: [] }>()

const store = useXingceStore()

const phase = ref<Phase>('loading')
const queue = ref<ErrorEntry[]>([])
const idx = ref(0)
const answers = ref<Answer[]>([])
const selected = ref<string | null>(null)
const startedAt = ref(0)
const saving = ref(false)
const errorMsg = ref('')
const answeredEntryById = ref<Record<string, ErrorEntry>>({})

const TITLE_MAP: Record<QuizMode, string> = {
  daily:   '📝 今日复习',
  full:    '📚 全量练习',
  review:  '🧩 待复盘训练',
  retrain: '🔁 待复训训练',
  random:  '🎲 随机题目',
}

const current = computed(() => queue.value[idx.value] ?? null)
const options = computed(() => {
  const e = current.value
  if (!e?.options) return []
  return e.options.split(/\n|\|/).map(s => s.trim()).filter(Boolean)
})
const progressPct = computed(() =>
  queue.value.length ? Math.round((idx.value / queue.value.length) * 100) : 0
)
const progressText = computed(() => `${idx.value + 1} / ${queue.value.length}`)
const modalTitle = computed(() => props.titleOverride || TITLE_MAP[props.mode])

const currentImageHeavy = computed(() =>
  current.value ? isImageHeavyQuestion(current.value) : false,
)

const currentQuestionText = computed(() => String(current.value?.question ?? '').trim())
const currentHasImage = computed(() =>
  current.value ? hasErrorImage(current.value, 'imgData') : false,
)
const currentImageSrc = computed(() =>
  current.value ? normalizeErrorImageSrc(current.value.imgData) : '',
)
/** 对齐旧版：有题图且无文字选项时，用 A-D 按钮（选项在图里） */
const useImageOptionLetters = computed(() =>
  !options.value.length && currentHasImage.value,
)
const requiresSelection = computed(() =>
  options.value.length > 0 || useImageOptionLetters.value,
)

const stemImgExpanded = ref(false)

// ── 构建题目队列 ─────────────────────────────────────────────────────────────
async function buildQueue(): Promise<ErrorEntry[]> {
  if (props.mode === 'random') {
    return (props.initialQueue ?? []).filter(e => e?.id)
  }
  if (props.mode === 'full') {
    return store.filteredErrors
      .filter(e => e.status !== 'mastered' && e.masteryLevel !== 'mastered')
      .slice(0, 120)
  }

  try {
    if (props.mode === 'daily') {
      const data = await xingceApi.getDaily(30)
      const raw = (data.items ?? []) as Array<{ id?: string }>
      const resolved = resolveErrorQueueItems(raw, store.errors)
      if (resolved.length) return resolved
      return raw.filter(item => item?.id).map(item => item as unknown as ErrorEntry)
    }
    if (props.mode === 'review' || props.mode === 'retrain') {
      const data = await xingceApi.getWorkbench(12)
      const key = props.mode === 'review' ? 'reviewQueue' : 'retrainQueue'
      const raw = (data as Record<string, unknown>)[key] as { id?: string }[]
      return resolveIds((raw ?? []).map(i => i.id ?? ''))
    }
  } catch {
    // 降级到本地
  }

  return store.errors.filter(e => e.status !== 'mastered').slice(0, 12)
}

function resolveIds(ids: string[]): ErrorEntry[] {
  return resolveErrorQueueItems(ids.map(id => ({ id })), store.errors)
}

onMounted(async () => {
  queue.value = await buildQueue()
  if (!queue.value.length) {
    errorMsg.value = '当前暂无需要练习的题目'
    phase.value = 'done'
    return
  }
  phase.value = 'question'
  startedAt.value = Date.now()
})

// ── 答题阶段 ──────────────────────────────────────────────────────────────────
function selectOption(opt: string) {
  selected.value = opt
}

function selectLetter(letter: string) {
  selected.value = letter
}

function submitAnswer(skip = false) {
  const e = current.value
  if (!e) return
  const durationSec = Math.max(1, Math.round((Date.now() - startedAt.value) / 1000))
  const letter = skip ? '' : (selected.value ?? '')
  const correct = !skip && !!e.answer && letter.trim().toUpperCase()[0] === e.answer.trim().toUpperCase()[0]

  answeredEntryById.value = { ...answeredEntryById.value, [e.id]: e }
  answers.value.push({ id: e.id, userAnswer: letter, correct, skipped: skip, durationSec })
  selected.value = null
  stemImgExpanded.value = false
  startedAt.value = Date.now()

  if (idx.value + 1 >= queue.value.length) {
    phase.value = 'review'
  } else {
    idx.value++
  }
}

// ── 回顾阶段 ──────────────────────────────────────────────────────────────────
const reviewItems = computed(() =>
  answers.value.map(a => ({
    answer: a,
    entry: answeredEntryById.value[a.id] || queue.value.find(e => e.id === a.id),
  }))
)

const scoreText = computed(() => {
  const done = answers.value.filter(a => !a.skipped)
  const correct = done.filter(a => a.correct)
  return `${correct.length} / ${done.length} 正确`
})

// ── 保存 ──────────────────────────────────────────────────────────────────────
async function saveResults() {
  saving.value = true
  const today = new Date().toISOString().slice(0, 10)
  const realAnswers = answers.value.filter(a => !a.skipped)

  try {
    // 1. 批量记录 attempts
    const items = realAnswers.map(a => {
      const e = queue.value.find(x => x.id === a.id)!
      return {
        sessionMode:
          props.mode === 'full'
            ? 'full'
            : props.mode === 'random'
              ? 'random'
            : props.mode === 'review'
              ? 'review'
              : props.mode === 'retrain'
                ? 'retrain'
                : 'daily',
        source: `vue_quiz_${props.mode}`,
        questionId: a.id,
        errorId: a.id,
        type: e?.type ?? '',
        subtype: e?.subtype ?? '',
        subSubtype: e?.subSubtype ?? '',
        questionText: e?.question ?? '',
        myAnswer: a.userAnswer,
        correctAnswer: e?.answer ?? '',
        result: a.correct ? 'correct' : 'wrong',
        durationSec: a.durationSec,
        statusTag: e?.status ?? '',
        confidence: a.correct ? 3 : 1,
        solvingNote: e?.note ?? '',
        scratchData: {},
        noteNodeId: e?.noteNodeId ?? '',
        meta: {
          mistakeType: e?.rootReason ?? e?.errorReason ?? '',
          triggerPoint: '',
          correctModel: e?.analysis ?? '',
          nextAction: a.correct ? '继续复训' : '回看错因与解析',
        },
      }
    })

    if (items.length) {
      await fetch('/api/practice/attempts/batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
    }

    // 2. 记录会话汇总
    await fetch('/api/practice/log', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        mode: props.mode === 'full' ? 'targeted' : (props.mode === 'random' ? 'random' : 'daily'),
        weaknessTag: '',
        total: realAnswers.length,
        correct: realAnswers.filter(a => a.correct).length,
        errorIds: realAnswers.map(a => a.id),
      }),
    })

    // 3. 更新本地错题状态
    realAnswers.forEach(a => {
      const e = queue.value.find(x => x.id === a.id)
      if (!e) return
      if (a.correct) {
        store.updateError(a.id, { status: 'review', masteryLevel: 'fuzzy' })
      } else {
        store.updateError(a.id, { status: 'focus', masteryLevel: 'not_mastered', myAnswer: a.userAnswer })
      }
    })

    // 4. 刷新练习面板与卡片练习摘要
    store.loadPracticePanel()
    const touchedIds = [...new Set(realAnswers.map(a => a.id).filter(Boolean))]
    if (touchedIds.length) {
      store.invalidatePracticeSummaries(touchedIds)
      store.queuePracticeSummaries(touchedIds)
    }

    phase.value = 'done'
  } catch (err) {
    console.error('save quiz results failed', err)
    errorMsg.value = '保存失败，请重试'
  } finally {
    saving.value = false
  }
}

function tryClose() {
  if (phase.value === 'question' && answers.value.length > 0) {
    if (!confirm('练习尚未保存，确认关闭？')) return
  }
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="qm-backdrop" @click.self="tryClose">
      <div class="qm-modal">
        <!-- Header -->
        <div class="qm-header">
          <span class="qm-title">{{ modalTitle }}</span>
          <span v-if="phase === 'question'" class="qm-progress-text">
            {{ progressText }}
          </span>
          <button class="qm-close" @click="tryClose">×</button>
        </div>

        <!-- 进度条 -->
        <div v-if="phase === 'question'" class="qm-progress-bar">
          <div class="qm-progress-fill" :style="{ width: progressPct + '%' }" />
        </div>

        <!-- ── 加载中 ── -->
        <div v-if="phase === 'loading'" class="qm-body qm-center">
          <div class="qm-spinner" />
          <p>加载题目中…</p>
        </div>

        <!-- ── 答题阶段 ── -->
        <div v-else-if="phase === 'question' && current" class="qm-body">
          <div class="qm-stage">
            <div v-if="current.type || current.subtype" class="qm-chips">
              <span v-if="current.type" class="qm-chip qm-chip-type">{{ current.type }}</span>
              <span v-if="current.subtype" class="qm-chip qm-chip-sub">{{ current.subtype }}</span>
            </div>
            <div class="qm-question-surface">
              <div class="qm-reading-panel" :class="{ 'is-image-heavy': currentImageHeavy }">
                <div v-if="currentQuestionText" class="qm-question-box">{{ currentQuestionText }}</div>
                <div
                  v-if="currentHasImage && currentImageSrc"
                  class="qm-image-wrap"
                  :class="{ 'is-image-heavy': currentImageHeavy }"
                >
                  <img
                    :src="currentImageSrc"
                    class="qm-stem-img cuoti-img"
                    :class="{ expanded: stemImgExpanded, 'quiz-image-heavy': currentImageHeavy }"
                    alt="题目图片"
                    loading="lazy"
                    decoding="async"
                    @click="stemImgExpanded = !stemImgExpanded"
                  />
                  <div class="qm-image-actions">
                    <button type="button" class="qm-image-btn" @click="stemImgExpanded = !stemImgExpanded">
                      放大预览
                    </button>
                    <a
                      class="qm-image-btn qm-image-link"
                      :href="currentImageSrc"
                      target="_blank"
                      rel="noopener noreferrer"
                    >查看原图</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="current.targetDurationSec && Number(current.targetDurationSec) > 0"
            class="qm-target-hint"
          >
            目标用时 {{ Math.round(Number(current.targetDurationSec)) }} 秒（计时参考）
          </div>

          <div class="qm-options">
            <template v-if="options.length">
              <button
                v-for="opt in options"
                :key="opt"
                type="button"
                class="qm-option"
                :class="{ selected: selected === opt }"
                @click="selectOption(opt)"
              >{{ opt }}</button>
            </template>
            <div v-else-if="useImageOptionLetters" class="qm-opt-grid">
              <button
                v-for="letter in IMAGE_OPTION_LETTERS"
                :key="letter"
                type="button"
                class="qm-option qm-letter-opt"
                :class="{ selected: selected === letter }"
                @click="selectLetter(letter)"
              >{{ letter }}</button>
            </div>
            <div v-else class="qm-no-options">
              （无选项，请判断正误）
              <div class="qm-yn-row">
                <button type="button" class="qm-yn-btn yn-correct" @click="selectLetter('√')">✓ 正确</button>
                <button type="button" class="qm-yn-btn yn-wrong" @click="selectLetter('×')">✗ 错误</button>
              </div>
            </div>
          </div>

          <div class="qm-footer">
            <button class="qm-skip" @click="submitAnswer(true)">跳过</button>
            <button
              class="qm-next"
              :disabled="!selected && requiresSelection"
              @click="submitAnswer(false)"
            >
              {{ idx + 1 >= queue.length ? '完成' : '下一题' }}
            </button>
          </div>
        </div>

        <!-- ── 回顾阶段 ── -->
        <div v-else-if="phase === 'review'" class="qm-body">
          <div class="qm-score">{{ scoreText }}</div>

          <div class="qm-review-list">
            <div
              v-for="(item, i) in reviewItems"
              :key="item.answer.id"
              class="qm-review-item"
              :class="{ 'ri-correct': item.answer.correct, 'ri-wrong': !item.answer.correct && !item.answer.skipped, 'ri-skipped': item.answer.skipped }"
            >
              <div class="ri-header">
                <span class="ri-num">{{ i + 1 }}</span>
                <span class="ri-result">
                  {{ item.answer.skipped ? '跳过' : item.answer.correct ? '✓ 正确' : '✗ 错误' }}
                </span>
                <span v-if="item.entry?.answer" class="ri-answer">答案：{{ item.entry.answer }}</span>
                <span v-if="item.answer.userAnswer" class="ri-my-answer">
                  我选：{{ item.answer.userAnswer }}
                </span>
              </div>
              <div v-if="String(item.entry?.question || '').trim()" class="ri-question">{{ item.entry?.question }}</div>
              <ErrorQuestionImage
                v-if="item.entry?.imgData"
                :src="item.entry.imgData"
                variant="card"
              />
              <div v-if="item.entry?.analysis" class="ri-analysis">{{ item.entry.analysis }}</div>
            </div>
          </div>

          <div class="qm-footer">
            <button class="qm-save" :disabled="saving" @click="saveResults">
              {{ saving ? '保存中…' : '保存结果' }}
            </button>
          </div>
        </div>

        <!-- ── 完成 ── -->
        <div v-else-if="phase === 'done'" class="qm-body qm-center">
          <div v-if="errorMsg" class="qm-error">{{ errorMsg }}</div>
          <div v-else class="qm-done-msg">✅ 练习已保存！</div>
          <button class="qm-next" style="margin-top:16px" @click="emit('close')">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.qm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.qm-modal {
  background: #fff;
  border-radius: 12px;
  width: min(920px, 96vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
  overflow: hidden;
}

.qm-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}
.qm-title { font-size: 15px; font-weight: 700; color: #1e293b; flex: 1; }
.qm-progress-text { font-size: 13px; color: #64748b; }
.qm-close {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: #f1f5f9; color: #475569;
  font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.qm-close:hover { background: #e2e8f0; }

.qm-progress-bar {
  height: 3px;
  background: #f1f5f9;
  flex-shrink: 0;
}
.qm-progress-fill {
  height: 100%;
  background: #4a6cf7;
  transition: width 0.3s ease;
}

.qm-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.qm-center {
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #64748b;
}

.qm-spinner {
  width: 36px; height: 36px;
  border: 3px solid #e2e8f0;
  border-top-color: #4a6cf7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.qm-question-box {
  font-size: 15px;
  line-height: 1.8;
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.qm-stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.qm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.qm-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.qm-chip-type {
  background: #eff6ff;
  color: #1d4ed8;
}

.qm-chip-sub {
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.qm-question-surface {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  max-width: 100%;
}

.qm-reading-panel {
  padding: 18px 18px 12px;
  min-width: 0;
}

.qm-image-wrap {
  margin-top: 12px;
  border-radius: 12px;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  max-width: 100%;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.qm-image-wrap.is-image-heavy {
  margin-top: 8px;
}

.qm-image-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 10px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
}

.qm-image-btn {
  border: 1px solid #d0d7e2;
  background: #fff;
  color: #334155;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
}

.qm-image-btn:hover {
  background: #f8fafc;
}

.qm-opt-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.qm-letter-opt {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  min-height: 52px;
  padding: 12px 8px;
}

.qm-target-hint {
  font-size: 12px;
  color: #7c3aed;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  border-radius: 6px;
  padding: 6px 10px;
}

.qm-options { display: flex; flex-direction: column; gap: 8px; }
.qm-option {
  text-align: left;
  padding: 10px 16px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
  transition: all 0.12s;
  line-height: 1.5;
}
.qm-option:hover { border-color: #a5b4fc; background: #f5f3ff; }
.qm-option.selected { border-color: #4a6cf7; background: #eef2ff; color: #3730a3; font-weight: 600; }

.qm-no-options { font-size: 13px; color: #94a3b8; }
.qm-yn-row { display: flex; gap: 12px; margin-top: 12px; }
.qm-yn-btn {
  flex: 1; padding: 10px; border: none; border-radius: 8px;
  font-size: 14px; font-weight: 700; cursor: pointer;
}
.yn-correct { background: #dcfce7; color: #16a34a; }
.yn-wrong   { background: #fee2e2; color: #dc2626; }

.qm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
  flex-shrink: 0;
}

.qm-skip {
  padding: 8px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
}
.qm-next {
  padding: 8px 24px;
  border: none;
  border-radius: 6px;
  background: #4a6cf7;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.qm-next:disabled { opacity: 0.4; cursor: not-allowed; }
.qm-next:not(:disabled):hover { background: #3a5ce5; }

.qm-save {
  padding: 8px 24px;
  border: none;
  border-radius: 6px;
  background: #16a34a;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.qm-save:disabled { opacity: 0.5; cursor: not-allowed; }

/* 回顾 */
.qm-score {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  padding: 8px 0;
}

.qm-review-list { display: flex; flex-direction: column; gap: 10px; }

.qm-review-item {
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ri-correct { border-color: #86efac; background: #f0fdf4; }
.ri-wrong   { border-color: #fca5a5; background: #fff1f2; }
.ri-skipped { background: #f8fafc; }

.ri-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.ri-num {
  font-size: 11px;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 6px;
  border-radius: 6px;
}
.ri-result { font-weight: 700; font-size: 12px; }
.ri-correct .ri-result { color: #16a34a; }
.ri-wrong .ri-result   { color: #dc2626; }
.ri-skipped .ri-result { color: #94a3b8; }
.ri-answer   { color: #16a34a; font-size: 11px; }
.ri-my-answer { color: #dc2626; font-size: 11px; }

.ri-question {
  font-size: 12.5px;
  color: #475569;
  line-height: 1.6;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.ri-analysis {
  font-size: 12px;
  color: #64748b;
  background: rgba(255,255,255,.6);
  padding: 6px 10px;
  border-radius: 6px;
  line-height: 1.5;
}

.qm-done-msg { font-size: 18px; font-weight: 700; color: #16a34a; }
.qm-error { font-size: 14px; color: #dc2626; }
</style>

<!-- Teleport 到 body，在 .xc-vue-legacy 外，需全局约束题目图（对齐 legacy 12-quiz-modal.css） -->
<style>
.qm-modal {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  overflow-x: hidden;
}

.qm-modal .qm-stage,
.qm-modal .qm-question-surface,
.qm-modal .qm-reading-panel,
.qm-modal .qm-image-wrap {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.qm-modal .qm-stem-img,
.qm-modal .cuoti-img {
  display: block;
  box-sizing: border-box;
  max-width: 100% !important;
  width: auto !important;
  height: auto !important;
  max-height: min(480px, 52vh) !important;
  margin: 0 auto;
  object-fit: contain !important;
  object-position: center top;
  border-radius: 0;
  cursor: zoom-in;
  background: #fff;
}

.qm-modal .qm-stem-img.expanded,
.qm-modal .cuoti-img.expanded {
  max-height: none !important;
  cursor: zoom-out;
}
</style>
