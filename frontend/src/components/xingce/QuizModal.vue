<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import { xingceApi } from '@/api/xingce'
import type { ErrorEntry } from '@/api/xingce'

type QuizMode = 'daily' | 'full' | 'review' | 'retrain'
type Phase = 'loading' | 'question' | 'review' | 'saving' | 'done'

interface Answer {
  id: string
  userAnswer: string
  correct: boolean
  skipped: boolean
  durationSec: number
}

const props = defineProps<{ mode: QuizMode }>()
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

const TITLE_MAP: Record<QuizMode, string> = {
  daily:   '📝 今日复习',
  full:    '📚 全量练习',
  review:  '🧩 待复盘训练',
  retrain: '🔁 待复训训练',
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

// ── 构建题目队列 ─────────────────────────────────────────────────────────────
async function buildQueue(): Promise<ErrorEntry[]> {
  if (props.mode === 'full') {
    return store.filteredErrors
      .filter(e => e.status !== 'mastered' && e.masteryLevel !== 'mastered')
      .slice(0, 120)
  }

  try {
    if (props.mode === 'daily') {
      const data = await xingceApi.getDaily(12)
      return resolveIds((data.items as { id?: string }[]).map(i => i.id ?? ''))
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
  const result: ErrorEntry[] = []
  for (const id of ids) {
    const e = store.errors.find(x => x.id === id)
    if (e) result.push(e)
  }
  return result
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

function submitAnswer(skip = false) {
  const e = current.value
  if (!e) return
  const durationSec = Math.max(1, Math.round((Date.now() - startedAt.value) / 1000))
  const letter = skip ? '' : (selected.value ?? '')
  const correct = !skip && !!e.answer && letter.trim().toUpperCase()[0] === e.answer.trim().toUpperCase()[0]

  answers.value.push({ id: e.id, userAnswer: letter, correct, skipped: skip, durationSec })
  selected.value = null
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
    entry: queue.value.find(e => e.id === a.id),
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
        mode: props.mode === 'full' ? 'targeted' : 'daily',
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
          <span class="qm-title">{{ TITLE_MAP[mode] }}</span>
          <span v-if="phase === 'question'" class="qm-progress-text">
            {{ idx + 1 }} / {{ queue.length }}
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
          <div class="qm-question">{{ current.question }}</div>
          <div
            v-if="current.targetDurationSec && Number(current.targetDurationSec) > 0"
            class="qm-target-hint"
          >
            目标用时 {{ Math.round(Number(current.targetDurationSec)) }} 秒（计时参考）
          </div>

          <div class="qm-options">
            <button
              v-for="opt in options"
              :key="opt"
              class="qm-option"
              :class="{ selected: selected === opt }"
              @click="selectOption(opt)"
            >{{ opt }}</button>
            <div v-if="!options.length" class="qm-no-options">
              （无选项，请判断正误）
              <div class="qm-yn-row">
                <button class="qm-yn-btn yn-correct" @click="submitAnswer(false)">✓ 正确</button>
                <button class="qm-yn-btn yn-wrong" @click="() => { selected = 'X'; submitAnswer(false) }">✗ 错误</button>
              </div>
            </div>
          </div>

          <div class="qm-footer">
            <button class="qm-skip" @click="submitAnswer(true)">跳过</button>
            <button
              class="qm-next"
              :disabled="!selected && !!options.length"
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
              <div class="ri-question">{{ item.entry?.question }}</div>
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
  width: min(680px, 96vw);
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
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.qm-question {
  font-size: 14px;
  line-height: 1.8;
  color: #1e293b;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f8fafc;
  padding: 14px 16px;
  border-radius: 8px;
  border-left: 3px solid #4a6cf7;
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
