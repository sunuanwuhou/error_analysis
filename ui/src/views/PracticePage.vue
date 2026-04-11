<template>
  <main class="workspace-shell practice-shell legacy-overlay-shell">
    <aside class="workspace-sidebar">
      <section class="panel sidebar-brand">
        <div class="eyebrow">{{ modeEyebrow }}</div>
        <strong>{{ pageTitle }}</strong>
        <p>{{ pageCopy }}</p>
      </section>

      <section class="panel sidebar-card">
        <div class="sidebar-card-title">快捷导航</div>
        <div class="action-grid">
          <a class="link-button" href="/next/workspace">学习首页</a>
          <a class="link-button" href="/next/workspace/tasks/errors">任务通道</a>
          <a class="link-button" href="/next/workspace/errors">错题工作台</a>
          <a class="link-button" href="/next/workspace/notes">学习笔记</a>
        </div>
      </section>

      <section class="panel sidebar-card">
        <div class="sidebar-card-title">本轮状态</div>
        <div class="fact-list">
          <div>总题数：{{ practiceItems.length }}</div>
          <div>已完成：{{ completedIds.length }}</div>
          <div>当前进度：{{ currentIndex + 1 }}/{{ Math.max(practiceItems.length, 1) }}</div>
        </div>
        <div class="topbar-actions">
          <button type="button" @click="finishSession" :disabled="busy || !completedIds.length">
            {{ busy ? '保存中...' : '结束本轮' }}
          </button>
        </div>
      </section>
    </aside>

    <section class="workspace-main">
      <article class="panel workspace-topbar practice-modal-topbar">
        <div>
          <div class="eyebrow">{{ modeEyebrow }}</div>
          <h1>{{ practiceHeaderTitle }}</h1>
          <p>{{ pageCopy }}</p>
          <p v-if="pageError" class="form-error">{{ pageError }}</p>
          <p v-if="sessionNotice" class="legacy-section-copy">{{ sessionNotice }}</p>
        </div>
        <div class="topbar-actions">
          <button type="button" class="action-button action-button--secondary" @click="goPrev" :disabled="currentIndex <= 0">上一题</button>
          <button type="button" class="action-button action-button--primary" @click="goNext" :disabled="currentIndex >= practiceItems.length - 1">下一题</button>
          <button
            type="button"
            class="action-button action-button--primary"
            :disabled="busy || !answered || !selectedDetail"
            @click="saveAttemptAndNext"
          >
            {{ busy ? '保存中...' : '保存并下一题' }}
          </button>
          <button
            type="button"
            class="action-button action-button--secondary"
            :disabled="busy || !answered || !selectedDetail"
            @click="saveAttemptAndFinish"
          >
            {{ busy ? '保存中...' : '保存并结束' }}
          </button>
          <a class="action-button action-button--secondary" href="/next/workspace/tasks/errors">关闭</a>
        </div>
      </article>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card content-card--workspace-focus practice-modal-card">
          <div class="practice-progress-rail">
            <div class="practice-progress-fill" :style="{ width: `${practiceProgressPercent}%` }" />
          </div>
          <!-- 题目卡：旧版两阶段流程 -->
          <div v-if="selectedDetail" class="legacy-quiz-card">
            <!-- 题型 chip 行 -->
            <div class="legacy-quiz-chips">
              <span class="legacy-quiz-chip">{{ selectedDetail.type || '未分类' }}</span>
              <span v-if="selectedDetail.subtype" class="legacy-quiz-chip">{{ selectedDetail.subtype }}</span>
              <span class="legacy-quiz-progress">第 {{ currentIndex + 1 }} / {{ Math.max(practiceItems.length, 1) }} 题</span>
            </div>

            <!-- 阶段一：答题前（显示题干+选项+画布/跳过） -->
            <template v-if="!answered">
              <div class="legacy-quiz-question">
                <p v-if="selectedDetail.question">{{ selectedDetail.question }}</p>
                <p v-else class="legacy-quiz-placeholder">当前题面还没有文本内容。</p>
                <img v-if="selectedDetail.imgData" :src="selectedDetail.imgData" alt="题目图片" class="legacy-quiz-img" />
                <img v-if="selectedDetail.processImage?.imageUrl" :src="selectedDetail.processImage.imageUrl" alt="过程图" class="legacy-quiz-img" />
              </div>

              <div class="legacy-quiz-answer-label">选择你的答案</div>
              <div class="legacy-quiz-options">
                <button
                  v-for="option in displayedOptions"
                  :key="option.key"
                  type="button"
                  class="legacy-quiz-option"
                  :class="{ 'is-selected': attempt.myAnswer === option.key }"
                  @click="pickAnswer(option.key)"
                >
                  <strong>{{ option.key }}</strong>
                  <span v-if="option.text">{{ option.text }}</span>
                </button>
              </div>

              <div class="legacy-quiz-bottom-actions">
                <a
                  v-if="selectedDetail.id"
                  class="legacy-quiz-bottom-btn"
                  :href="`/next/tools/canvas?id=${encodeURIComponent(String(selectedDetail.id || ''))}`"
                >画布</a>
                <button type="button" class="legacy-quiz-bottom-btn" @click="skipQuestion">跳过</button>
              </div>
            </template>

            <!-- 阶段二：已选择答案后（显示表单 + 根因/解析 + 保存） -->
            <template v-else>
              <div class="legacy-quiz-answered-header">
                <span>已选择：<strong>{{ attempt.myAnswer }}</strong></span>
                <button type="button" class="legacy-quiz-reselect" @click="answered = false">重新选择</button>
              </div>

              <div class="legacy-quiz-result-form">
                <div class="entry-grid">
                  <label>
                    <span>结果</span>
                    <select v-model="attempt.result">
                      <option value="correct">答对</option>
                      <option value="wrong">答错</option>
                      <option value="partial">部分正确</option>
                    </select>
                  </label>
                  <label>
                    <span>把握度</span>
                    <select v-model.number="attempt.confidence">
                      <option :value="0">0</option>
                      <option :value="1">1</option>
                      <option :value="2">2</option>
                      <option :value="3">3</option>
                      <option :value="4">4</option>
                      <option :value="5">5</option>
                    </select>
                  </label>
                </div>
                <div class="entry-grid">
                  <label>
                    <span>耗时（秒）</span>
                    <input v-model.number="attempt.durationSec" type="number" min="0" step="5" />
                  </label>
                  <label>
                    <span>作答备注</span>
                    <input v-model.trim="attempt.solvingNote" type="text" placeholder="可选" />
                  </label>
                </div>
              </div>

              <div v-if="selectedDetail.rootReason || selectedDetail.errorReason" class="legacy-quiz-insight">
                <div class="legacy-quiz-insight-label">根因</div>
                <p>{{ selectedDetail.rootReason || selectedDetail.errorReason }}</p>
              </div>
              <div v-if="selectedDetail.analysis" class="legacy-quiz-insight">
                <div class="legacy-quiz-insight-label">解析</div>
                <p>{{ selectedDetail.analysis }}</p>
              </div>

              <div class="legacy-quiz-bottom-actions">
                <button type="button" class="legacy-quiz-save-btn" :disabled="busy" @click="saveAttemptAndNext">
                  {{ busy ? '保存中...' : '保存并下一题' }}
                </button>
                <button type="button" class="legacy-quiz-bottom-btn" :disabled="busy" @click="saveAttemptAndFinish">
                  {{ busy ? '保存中...' : '保存并结束' }}
                </button>
                <a
                  v-if="selectedDetail.id"
                  class="legacy-quiz-bottom-btn"
                  :href="`/next/tools/canvas?id=${encodeURIComponent(String(selectedDetail.id || ''))}`"
                >画布</a>
                <a
                  v-if="selectedDetail.noteNodeId"
                  class="legacy-quiz-bottom-btn"
                  :href="`/next/tools/note-viewer?nodeId=${encodeURIComponent(String(selectedDetail.noteNodeId || ''))}`"
                >打开笔记</a>
              </div>
            </template>
          </div>
          <p v-else>当前通道下没有可练习的题。</p>
        </article>
      </section>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card panel--muted">
          <h2>当前队列</h2>
          <ul class="result-list card-list">
            <li
              v-for="(item, index) in practiceItems"
              :key="item.id || `${index}-${item.question}`"
              class="selectable-card"
              :class="{ 'is-selected': item.id === selectedItem?.id }"
            >
              <button class="selectable-card-button" type="button" @click="selectPracticeIndex(index)">
                <strong>{{ buildQueueTitle(item) }}</strong>
                <span>{{ buildQueueReason(item) }}</span>
                <span>{{ completedIds.includes(String(item.id || '')) ? '本轮已完成' : '本轮待处理' }}</span>
              </button>
            </li>
            <li v-if="!practiceItems.length">当前通道还没有可练习的题。</li>
          </ul>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { apiRequest } from '@/services/api'
import type {
  AdviceItem,
  ErrorSummary,
  NextHomeContextResponse,
  PracticeDailyItem,
  PracticeQueueItem,
} from '@/types/workspace'

type PracticeMode = 'daily' | 'full' | 'note' | 'direct' | 'speed'

type AttemptState = {
  myAnswer: string
  result: 'correct' | 'wrong' | 'partial'
  confidence: number
  durationSec: number
  solvingNote: string
}

const route = useRoute()
const router = useRouter()

const busy = ref(false)
const pageError = ref('')
const sessionNotice = ref('')
const answered = ref(false)
const homeContext = ref<NextHomeContextResponse | null>(null)
const currentIndex = ref(0)
const selectedDetail = ref<ErrorSummary | null>(null)
const completedIds = ref<string[]>([])
const completedResults = ref<Record<string, string>>({})

const attempt = ref<AttemptState>({
  myAnswer: '',
  result: 'wrong',
  confidence: 2,
  durationSec: 60,
  solvingNote: '',
})

const practiceMode = computed<PracticeMode>(() => {
  const name = String(route.name || '')
  if (name === 'action-full') return 'full'
  if (name === 'action-note') return 'note'
  if (name === 'action-direct') return 'direct'
  if (name === 'action-speed') return 'speed'
  return 'daily'
})

const modeEyebrow = computed(() => {
  if (practiceMode.value === 'full') return '全量练习'
  if (practiceMode.value === 'note') return '先看笔记'
  if (practiceMode.value === 'direct') return '直接开做'
  if (practiceMode.value === 'speed') return '限时复训'
  return '今日复习'
})

const pageTitle = computed(() => {
  if (practiceMode.value === 'full') return '全量练习'
  if (practiceMode.value === 'note') return '先看笔记'
  if (practiceMode.value === 'direct') return '直接开做'
  if (practiceMode.value === 'speed') return '限时复训'
  return '今日复习'
})

const pageCopy = computed(() => {
  if (practiceMode.value === 'full') return '按当前完整错题池练习，并把作答记录直接保存在 /next。'
  if (practiceMode.value === 'note') return '先看方法和笔记，再进入作答，保持同一条原生流程。'
  if (practiceMode.value === 'direct') return '沿着直接开做通道往下做，每道题都在这里记录结果。'
  if (practiceMode.value === 'speed') return '聚焦超时题，记录作答和耗时，再继续下一题。'
  return '按今天推荐集复习，并立即记录作答结果。'
})

const practiceItems = computed<Array<PracticeQueueItem | PracticeDailyItem>>(() => {
  if (!homeContext.value) {
    return []
  }
  if (practiceMode.value === 'full') {
    return (homeContext.value.errors || []).slice(0, 120)
  }
  if (practiceMode.value === 'note') {
    return homeContext.value.workbench.noteFirstQueue || []
  }
  if (practiceMode.value === 'direct') {
    return homeContext.value.workbench.directDoQueue || []
  }
  if (practiceMode.value === 'speed') {
    return homeContext.value.workbench.speedDrillQueue || []
  }
  return homeContext.value.daily.items || []
})

const selectedItem = computed(() => practiceItems.value[currentIndex.value] || null)
const practiceHeaderTitle = computed(() => `${pageTitle.value} · ${currentIndex.value + 1} / ${Math.max(practiceItems.value.length, 1)}`)
const practiceProgressPercent = computed(() => Math.min(100, Math.round(((currentIndex.value + 1) / Math.max(practiceItems.value.length, 1)) * 100)))
const parsedOptions = computed(() => {
  const raw = String(selectedDetail.value?.options || '').trim()
  if (!raw) {
    return [] as Array<{ key: string; text: string }>
  }
  const lines = raw.split(/\r?\n|\|/).map((item) => item.trim()).filter(Boolean)
  return lines.map((line, index) => {
    const match = line.match(/^([A-Z])[\\.．、:\s-]*(.*)$/i)
    return {
      key: String(match?.[1] || String.fromCharCode(65 + index)).toUpperCase(),
      text: String(match?.[2] || line).trim(),
    }
  })
})
const displayedOptions = computed(() => {
  if (parsedOptions.value.length) {
    return parsedOptions.value
  }
  return ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '' }))
})

const visibleAdvice = computed<AdviceItem[]>(() => {
  if (!homeContext.value) {
    return []
  }
  if (practiceMode.value === 'note' || practiceMode.value === 'direct' || practiceMode.value === 'speed') {
    return homeContext.value.workbench.workflowAdvice || homeContext.value.workbench.advice || []
  }
  return homeContext.value.daily.advice || []
})

function asText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function buildAdviceTitle(item: AdviceItem | unknown, index: number): string {
  const record = typeof item === 'object' && item ? (item as Record<string, unknown>) : {}
  const normalized = asText(record.title || record.key || record.description || item).trim().toLowerCase()
  if (normalized.includes('note')) return '先看笔记'
  if (normalized.includes('speed') || normalized.includes('time')) return '限时复训'
  if (normalized.includes('direct')) return '直接开做'
  return index === 0 ? '资料分析' : `动作 ${index + 1}`
}

function buildAdviceBody(item: AdviceItem | unknown): string {
  const record = typeof item === 'object' && item ? (item as Record<string, unknown>) : {}
  const text = asText(record.description || record.title || record.key || item).trim()
  if (!text) return '推荐的下一步动作'
  return text
    .replace(/daily practice/gi, '今日复习')
    .replace(/full practice/gi, '全量练习')
    .replace(/note first/gi, '先看笔记')
    .replace(/direct work/gi, '直接开做')
    .replace(/speed drill/gi, '限时复训')
}

function buildAdviceKey(item: AdviceItem | unknown): string {
  const record = typeof item === 'object' && item ? (item as Record<string, unknown>) : {}
  return asText(record.key || record.title || record.description || item)
}

function buildQueueTitle(item: PracticeQueueItem | PracticeDailyItem): string {
  const typeName = asText((item as { type?: string }).type).trim()
  const question = asText((item as { question?: string }).question).trim()
  if (typeName && question) {
    return `${typeName} ${question}`
  }
  return typeName || question || '练习题'
}

function buildQueueReason(item: PracticeQueueItem | PracticeDailyItem): string {
  const queueItem = item as PracticeQueueItem
  return queueItem.taskReason || queueItem.rootReason || queueItem.errorReason || '继续沿着当前推荐通道处理'
}

function buildErrorTitle(error: ErrorSummary): string {
  const typeName = asText(error.type).trim()
  const subtypeName = asText(error.subtype).trim()
  if (typeName && subtypeName) {
    return `${typeName} / ${subtypeName}`
  }
  return typeName || '未分类'
}

function pickAnswer(key: string) {
  attempt.value.myAnswer = key
  answered.value = true
}

function skipQuestion() {
  answered.value = false
  goNext()
}

function resetAttemptFromDetail(detail: ErrorSummary | null) {
  attempt.value = {
    myAnswer: '',
    result: 'wrong',
    confidence: 2,
    durationSec: 60,
    solvingNote: '',
  }
  if (!detail) {
    return
  }
  attempt.value.myAnswer = String(detail.myAnswer || '')
  if (String(detail.answer || '').trim() && String(detail.myAnswer || '').trim()) {
    attempt.value.result = String(detail.answer || '').trim() === String(detail.myAnswer || '').trim() ? 'correct' : 'wrong'
  }
}

async function loadSelectedDetail() {
  const item = selectedItem.value
  const errorId = String((item as { id?: string }).id || '').trim()
  selectedDetail.value = null
  resetAttemptFromDetail(null)
  if (!errorId) {
    return
  }
  const fallbackItem = homeContext.value?.errors?.find((entry) => String(entry.id || '') === errorId) || null
  if (fallbackItem) {
    selectedDetail.value = fallbackItem
    resetAttemptFromDetail(fallbackItem)
  }
  try {
    const payload = await apiRequest<{ ok: true; item: ErrorSummary }>(`/api/errors/${encodeURIComponent(errorId)}`)
    selectedDetail.value = payload.item
    resetAttemptFromDetail(payload.item)
  } catch (error: unknown) {
    if (!fallbackItem) {
      pageError.value = error instanceof Error ? error.message : '练习详情加载失败'
    }
  }
}

async function loadPage() {
  pageError.value = ''
  sessionNotice.value = ''
  homeContext.value = await apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=12')
  const routeErrorId = String(route.query.id || '').trim()
  if (routeErrorId) {
    const hitIndex = practiceItems.value.findIndex((item) => String((item as { id?: string }).id || '') === routeErrorId)
    currentIndex.value = hitIndex >= 0 ? hitIndex : 0
  } else {
    currentIndex.value = 0
  }
  await loadSelectedDetail()
}

function selectPracticeIndex(index: number) {
  currentIndex.value = index
}

function goPrev() {
  if (currentIndex.value <= 0) return
  currentIndex.value -= 1
}

function goNext() {
  if (currentIndex.value >= practiceItems.value.length - 1) return
  currentIndex.value += 1
}

async function saveAttempt(advanceAfterSave: boolean) {
  if (!selectedDetail.value || busy.value) return
  busy.value = true
  pageError.value = ''
  sessionNotice.value = ''
  try {
    const now = new Date().toISOString()
    const errorId = String(selectedDetail.value.id || '')
    await apiRequest('/api/practice/attempts/batch', {
      method: 'POST',
      body: JSON.stringify({
        items: [
          {
            id: `${errorId}-${Date.now()}`,
            createdAt: now,
            updatedAt: now,
            sessionMode: practiceMode.value,
            source: 'next',
            questionId: errorId,
            errorId,
            type: selectedDetail.value.type || '',
            subtype: selectedDetail.value.subtype || '',
            subSubtype: selectedDetail.value.subSubtype || '',
            questionText: selectedDetail.value.question || '',
            myAnswer: attempt.value.myAnswer,
            correctAnswer: selectedDetail.value.answer || '',
            result: attempt.value.result,
            durationSec: Number(attempt.value.durationSec || 0),
            statusTag: attempt.value.result === 'correct' ? 'stable' : 'review',
            confidence: Number(attempt.value.confidence || 0),
            solvingNote: attempt.value.solvingNote,
            noteNodeId: selectedDetail.value.noteNodeId || '',
            scratchData: {
              processCanvasData: selectedDetail.value.processCanvasData || '',
            },
            meta: {
              routeName: route.name,
            },
          },
        ],
      }),
    })
    if (!completedIds.value.includes(errorId)) {
      completedIds.value = [...completedIds.value, errorId]
    }
    completedResults.value = {
      ...completedResults.value,
      [errorId]: attempt.value.result,
    }
    sessionNotice.value = '结果已保存。'
    if (advanceAfterSave && currentIndex.value < practiceItems.value.length - 1) {
      currentIndex.value += 1
    } else if (!advanceAfterSave) {
      await persistSessionLog()
    }
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '作答结果保存失败'
  } finally {
    busy.value = false
  }
}

async function saveAttemptAndNext() {
  await saveAttempt(true)
}

async function saveAttemptAndFinish() {
  await saveAttempt(false)
}

async function persistSessionLog() {
  if (!completedIds.value.length) {
    sessionNotice.value = '本轮还没有已保存题目。'
    return
  }
  try {
    const correctCount = completedIds.value.filter((id) => {
      return completedResults.value[id] === 'correct'
    }).length
    await apiRequest('/api/practice/log', {
      method: 'POST',
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        mode: practiceMode.value,
        weaknessTag: practiceMode.value,
        total: completedIds.value.length,
        correct: correctCount,
        errorIds: completedIds.value,
      }),
    })
    sessionNotice.value = '本轮结果已保存。'
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '本轮练习收尾失败'
  }
}

async function finishSession() {
  if (busy.value || !completedIds.value.length) return
  busy.value = true
  pageError.value = ''
  sessionNotice.value = ''
  try {
    await persistSessionLog()
  } finally {
    busy.value = false
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) {
    return false
  }
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (busy.value) {
    return
  }
  const typing = isTypingTarget(event.target)
  const key = event.key.toLowerCase()
  if (event.key === 'ArrowLeft' && !typing) {
    event.preventDefault()
    goPrev()
    return
  }
  if (event.key === 'ArrowRight' && !typing) {
    event.preventDefault()
    goNext()
    return
  }
  if (event.ctrlKey && key === 'enter' && answered.value) {
    event.preventDefault()
    void saveAttemptAndFinish()
    return
  }
  if ((event.ctrlKey || event.metaKey) && key === 's' && answered.value) {
    event.preventDefault()
    void saveAttemptAndNext()
    return
  }
  if (event.key === 'Escape' && !typing) {
    event.preventDefault()
    void router.push('/next/workspace/tasks/errors')
    return
  }
  if (event.key === 'Enter' && !event.ctrlKey && answered.value && !typing) {
    event.preventDefault()
    void saveAttemptAndNext()
    return
  }
  if (!answered.value && !typing && ['a', 'b', 'c', 'd'].includes(key)) {
    event.preventDefault()
    pickAnswer(key.toUpperCase())
  }
}

watch(selectedItem, () => {
  answered.value = false
  void loadSelectedDetail()
})

watch(currentIndex, async () => {
  await router.replace({
    query: selectedItem.value?.id ? { ...route.query, id: String(selectedItem.value.id || '') } : { ...route.query },
  })
})

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  void loadPage()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>
