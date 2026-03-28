<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { aiChat, createPracticeLog, getPracticeDaily } from '@/services/api'
import { useSyncStore } from '@/stores/sync'
import { useWorkspaceStore } from '@/stores/workspace'
import type { ErrorEntry, PracticeLogEntry } from '@/types/workspace'

const props = defineProps<{
  preset?: 'daily' | 'current' | 'full'
}>()

const workspaceStore = useWorkspaceStore()
const syncStore = useSyncStore()

const loading = ref(false)
const queue = ref<ErrorEntry[]>([])
const recentLogs = ref<PracticeLogEntry[]>([])
const practicedTodayCount = ref(0)
const answers = reactive<Record<string, string>>({})
const summary = ref('')
const aiSummary = ref('')
const mode = ref<'daily' | 'current' | 'full'>('daily')

const correctCount = computed(() =>
  queue.value.filter((item) => {
    const answer = (answers[item.id] || '').trim().toUpperCase()
    const standard = (item.answer || '').trim().toUpperCase()
    return answer && standard && answer === standard
  }).length,
)

function parseOptions(entry: ErrorEntry) {
  return (entry.options || '')
    .split(/\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function resetAnswers() {
  Object.keys(answers).forEach((key) => {
    delete answers[key]
  })
}

async function loadQueue() {
  loading.value = true
  summary.value = ''
  aiSummary.value = ''
  resetAnswers()
  try {
    if (mode.value === 'daily') {
      const data = await getPracticeDaily(12)
      queue.value = data.items || []
      recentLogs.value = data.recentLogs || []
      practicedTodayCount.value = data.practicedTodayCount || 0
    } else if (mode.value === 'full') {
      queue.value = workspaceStore.visibleErrors.filter((item) => item.status !== 'mastered').slice(0, 40)
      practicedTodayCount.value = 0
    } else {
      queue.value = (workspaceStore.selectedKnowledgeNodeId ? workspaceStore.relatedErrors : workspaceStore.filteredErrors).slice(0, 20)
      practicedTodayCount.value = 0
    }
  } finally {
    loading.value = false
  }
}

async function savePractice() {
  const wrongIds = queue.value
    .filter((item) => {
      const answer = (answers[item.id] || '').trim().toUpperCase()
      const standard = (item.answer || '').trim().toUpperCase()
      return answer && standard && answer !== standard
    })
    .map((item) => item.id)

  const total = queue.value.filter((item) => (answers[item.id] || '').trim()).length
  if (!total) {
    summary.value = '先完成至少一题，再保存练习记录。'
    return
  }

    const response = await createPracticeLog({
      date: new Date().toISOString().slice(0, 10),
      mode: mode.value === 'daily' ? 'daily' : mode.value === 'full' ? 'full_practice' : 'targeted',
      weaknessTag: workspaceStore.selectedKnowledgeNode?.title || '',
      total,
      correct: correctCount.value,
    errorIds: wrongIds,
  })
  recentLogs.value = response.recent || recentLogs.value

  queue.value.forEach((item) => {
    const updated = workspaceStore.upsertErrorEntry(
      {
        ...item,
        myAnswer: answers[item.id] || '',
        lastPracticedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      item.entryKind || 'error',
    )
    syncStore.enqueueOp('error_upsert', updated.id, updated)
  })

  summary.value = `本次练习完成：${total} 题，答对 ${correctCount.value} 题。`
  const wrongItems = queue.value
    .filter((item) => wrongIds.includes(item.id))
    .map((item) => ({
      type: item.type,
      subtype: item.subtype,
      rootReason: item.rootReason,
      errorReason: item.errorReason,
    }))

  try {
    const ai = await aiChat(
      `我刚完成了一次练习，${total}题答对${correctCount.value}题。答错的题如下：${JSON.stringify(wrongItems)}。请用3到4句话分析这次练习暴露的主要问题，并给出今天接下来应该做的1件具体的事。`,
      [],
    )
    aiSummary.value = ai.reply || ''
  } catch {
    aiSummary.value = ''
  }

  await loadQueue()
}

onMounted(async () => {
  if (props.preset) mode.value = props.preset
  await loadQueue()
})

watch(
  () => props.preset,
  async (value) => {
    if (!value || value === mode.value) return
    mode.value = value
    await loadQueue()
  },
)
</script>

<template>
  <section class="panel transfer-panel">
    <header class="panel__header">
      <div>
        <h2>每日练习</h2>
        <p class="panel__subtle">可以直接拉取今日队列，也可以针对当前筛选范围做一轮小练。</p>
      </div>
      <div class="error-card__actions">
        <button class="ghost-button ghost-button--small" type="button" :disabled="loading" @click="loadQueue">刷新队列</button>
        <button class="ghost-button ghost-button--small" type="button" :disabled="loading" @click="savePractice">保存记录</button>
      </div>
    </header>

    <div class="transfer-message practice-toolbar">
      <span>模式：</span>
      <label><input v-model="mode" type="radio" value="daily" @change="loadQueue" /> 今日队列</label>
      <label><input v-model="mode" type="radio" value="current" @change="loadQueue" /> 当前范围</label>
      <label><input v-model="mode" type="radio" value="full" @change="loadQueue" /> 全量练习</label>
    </div>

    <div class="transfer-message">
      今日已练：{{ practicedTodayCount }} 题
      <span v-if="summary"> / {{ summary }}</span>
    </div>

    <div v-if="aiSummary" class="transfer-preview">
      <div class="panel__subtle">本次练习 AI 总结</div>
      <textarea class="transfer-textarea" rows="6" :value="aiSummary" readonly />
    </div>

    <div v-if="queue.length" class="error-list">
      <article v-for="item in queue" :key="item.id" class="error-card">
        <div class="error-card__meta">
          <span>{{ item.type || '未分类' }}</span>
          <span>{{ item.subtype || '未分类' }}</span>
        </div>
        <h3 class="error-card__title">{{ item.question || '未填写题干' }}</h3>

        <div v-if="parseOptions(item).length" class="practice-options">
          <label v-for="option in parseOptions(item)" :key="option" class="practice-option">
            <input v-model="answers[item.id]" type="radio" :value="option.slice(0, 1)" />
            <span>{{ option }}</span>
          </label>
        </div>

        <div v-else class="practice-manual-answer">
          <input v-model="answers[item.id]" class="editor-input" type="text" placeholder="直接填写你的答案" />
        </div>

        <div class="error-card__analysis-block" v-if="answers[item.id]">
          <div class="panel__subtle">你的答案：{{ answers[item.id] }} / 标准答案：{{ item.answer || '未填写' }}</div>
          <p class="error-card__analysis" v-if="item.analysis">{{ item.analysis }}</p>
        </div>
      </article>
    </div>

    <div v-else class="panel__empty">
      {{ loading ? '正在加载练习队列...' : '当前没有可练习题目。' }}
    </div>

    <div class="transfer-preview" v-if="recentLogs.length">
      <div class="panel__subtle">最近练习记录</div>
      <div class="stats-grid">
        <article v-for="log in recentLogs.slice(0, 6)" :key="`${log.date}-${log.mode}-${log.total}`" class="stats-box">
          <h3>{{ log.date }}</h3>
          <div class="stats-row"><span>模式</span><strong>{{ log.mode }}</strong></div>
          <div class="stats-row"><span>总题</span><strong>{{ log.total }}</strong></div>
          <div class="stats-row"><span>答对</span><strong>{{ log.correct }}</strong></div>
        </article>
      </div>
    </div>
  </section>
</template>
