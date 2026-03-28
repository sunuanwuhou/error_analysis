<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { aiEvaluateAnswer } from '@/services/api'
import { useSyncStore } from '@/stores/sync'
import { useWorkspaceStore } from '@/stores/workspace'
import type { ErrorEntry, KnowledgeNode } from '@/types/workspace'

const props = defineProps<{
  item: ErrorEntry
  bankMode?: boolean
}>()

const workspaceStore = useWorkspaceStore()
const syncStore = useSyncStore()

const showAnalysis = ref(false)
const showPractice = ref(false)
const editing = ref(false)
const selectedAnswer = ref('')
const evaluating = ref(false)
const aiFeedback = ref('')

function createDraft(item: ErrorEntry) {
  return {
    type: item.type || '',
    subtype: item.subtype || '',
    subSubtype: item.subSubtype || '',
    question: item.question || '',
    options: item.options || '',
    answer: item.answer || '',
    analysis: item.analysis || '',
    rootReason: item.rootReason || '',
    errorReason: item.errorReason || '',
    noteNodeId: item.noteNodeId || '',
    difficulty: item.difficulty || 0,
    srcYear: item.srcYear || '',
    srcProvince: item.srcProvince || '',
    srcOrigin: item.srcOrigin || '',
  }
}

const draft = ref(createDraft(props.item))

watch(
  () => props.item,
  (value) => {
    draft.value = createDraft(value)
    selectedAnswer.value = value.myAnswer || ''
  },
  { immediate: true },
)

const options = computed(() =>
  (props.item.options || '')
    .split(/\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean),
)

function collectNodeOptions(nodes: KnowledgeNode[], trail: string[] = []): Array<{ id: string; label: string }> {
  return nodes.flatMap((node) => {
    const nextTrail = [...trail, node.title]
    return [{ id: node.id, label: nextTrail.join(' > ') }, ...collectNodeOptions(node.children, nextTrail)]
  })
}

const knowledgeOptions = computed(() => collectNodeOptions(workspaceStore.knowledgeTree))

const entryKindLabel = computed(() => (props.bankMode ? '题库题' : '错题'))
const statusLabel = computed(() => {
  if (props.item.status === 'review') return '复习中'
  if (props.item.status === 'mastered') return '已掌握'
  return '重点复习'
})

const sourceLabel = computed(() => [props.item.srcYear, props.item.srcProvince, props.item.srcOrigin].filter(Boolean).join(' / '))

function resolveImageUrl(value?: string) {
  if (!value) return ''
  if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http')) return value
  return `/api/images/${value}`
}

function syncEntry(entry: ErrorEntry) {
  syncStore.enqueueOp('error_upsert', entry.id, entry)
}

function handleStatusCycle() {
  const updated = workspaceStore.cycleErrorStatus(props.item.id)
  if (updated) syncEntry(updated)
}

function handleDelete() {
  if (!window.confirm('确认删除这道题吗？')) return
  if (workspaceStore.deleteErrorEntry(props.item.id)) {
    syncStore.enqueueOp('error_delete', props.item.id, { id: props.item.id })
  }
}

function handleSwitchKind() {
  const nextKind = props.bankMode ? 'error' : 'claude_bank'
  const updated = workspaceStore.switchEntryKind(props.item.id, nextKind)
  if (updated) syncEntry(updated)
}

function handleSaveEdit() {
  const updated = workspaceStore.upsertErrorEntry(
    {
      ...props.item,
      ...draft.value,
      updatedAt: new Date().toISOString(),
    },
    props.item.entryKind || 'error',
  )
  syncEntry(updated)
  editing.value = false
}

function deriveStatusFromPractice(masteryUpdate?: string) {
  if (props.bankMode) return props.item.status || ''
  if (masteryUpdate === 'mastered') return 'mastered'
  if (masteryUpdate === 'fuzzy') return 'review'
  return 'focus'
}

async function handlePractice() {
  if (!selectedAnswer.value.trim()) {
    aiFeedback.value = '先填上你的答案，再保存作答。'
    return
  }

  let updated = workspaceStore.upsertErrorEntry(
    {
      ...props.item,
      myAnswer: selectedAnswer.value.trim(),
      lastPracticedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    props.item.entryKind || 'error',
  )
  syncEntry(updated)
  showAnalysis.value = true
  evaluating.value = true

  try {
    const data = await aiEvaluateAnswer({
      question: props.item.question || '',
      options: props.item.options || '',
      correctAnswer: props.item.answer || '',
      myAnswer: selectedAnswer.value.trim(),
      originalErrorReason: props.item.errorReason || '',
      rootReason: props.item.rootReason || '',
    })
    const result = data.result || {}
    aiFeedback.value = [result.analysis, result.thoughtProcess].filter(Boolean).join('\n\n')
    updated = workspaceStore.upsertErrorEntry(
      {
        ...updated,
        masteryLevel: result.masteryUpdate || updated.masteryLevel,
        status: deriveStatusFromPractice(result.masteryUpdate),
        updatedAt: new Date().toISOString(),
      },
      props.item.entryKind || 'error',
    )
    syncEntry(updated)
  } catch (error) {
    aiFeedback.value = error instanceof Error ? error.message : 'AI 评估失败。'
  } finally {
    evaluating.value = false
  }
}
</script>

<template>
  <article class="error-card">
    <div class="error-card__meta">
      <span>{{ item.type || '未分类' }}</span>
      <span>{{ item.subtype || '未分类' }}</span>
      <span>{{ statusLabel }}</span>
      <span>{{ entryKindLabel }}</span>
      <span v-if="item.difficulty">难度 {{ item.difficulty }}</span>
      <span v-if="sourceLabel">{{ sourceLabel }}</span>
    </div>

    <h3 class="error-card__title">{{ item.question || '未填写题干' }}</h3>
    <img v-if="item.imgData" class="error-card__image" :src="resolveImageUrl(item.imgData)" alt="题图" />

    <div class="error-card__actions">
      <button class="tiny-button" type="button" @click="showAnalysis = !showAnalysis">
        {{ showAnalysis ? '收起解析' : '查看解析' }}
      </button>
      <button class="tiny-button" type="button" @click="showPractice = !showPractice">
        {{ showPractice ? '收起作答' : '做题' }}
      </button>
      <button class="tiny-button" type="button" @click="editing = !editing">
        {{ editing ? '收起编辑' : '编辑' }}
      </button>
      <button class="tiny-button" type="button" @click="handleStatusCycle">切换状态</button>
      <button class="tiny-button" type="button" @click="handleSwitchKind">
        {{ bankMode ? '转为错题' : '转为题库题' }}
      </button>
      <button class="tiny-button tiny-button--danger" type="button" @click="handleDelete">删除</button>
    </div>

    <div v-if="showPractice" class="error-card__practice">
      <div v-if="options.length" class="practice-options">
        <label v-for="option in options" :key="option" class="practice-option">
          <input v-model="selectedAnswer" type="radio" :value="option.slice(0, 1)" />
          <span>{{ option }}</span>
        </label>
      </div>
      <div v-else class="practice-manual-answer">
        <input v-model="selectedAnswer" class="editor-input" type="text" placeholder="这道题没有结构化选项，直接填写你的答案" />
      </div>
      <div class="error-card__practice-actions">
        <button class="ghost-button ghost-button--small" type="button" @click="handlePractice">提交作答</button>
        <span v-if="item.answer" class="answer-chip">正确答案：{{ item.answer }}</span>
      </div>
      <div v-if="evaluating || aiFeedback" class="error-card__analysis-block">
        <div class="panel__subtle" v-if="evaluating">AI 正在评估...</div>
        <p class="error-card__analysis" v-else>{{ aiFeedback }}</p>
      </div>
    </div>

    <div v-if="showAnalysis" class="error-card__analysis-block">
      <div class="error-card__answer-row">
        <span class="answer-chip" v-if="item.answer">正确答案：{{ item.answer }}</span>
        <span class="answer-chip answer-chip--muted" v-if="item.myAnswer">我的答案：{{ item.myAnswer }}</span>
      </div>
      <p v-if="item.analysis" class="error-card__analysis">{{ item.analysis }}</p>
      <p v-if="item.rootReason || item.errorReason" class="error-card__analysis">
        根因：{{ item.rootReason || '未填写' }} / 表象：{{ item.errorReason || '未填写' }}
      </p>
    </div>

    <div v-if="editing" class="error-card__editor">
      <input v-model="draft.type" class="editor-input" type="text" placeholder="题型" />
      <input v-model="draft.subtype" class="editor-input" type="text" placeholder="子类型" />
      <input v-model="draft.subSubtype" class="editor-input" type="text" placeholder="细分类" />
      <select v-model="draft.noteNodeId" class="editor-input">
        <option v-for="option in knowledgeOptions" :key="option.id" :value="option.id">
          {{ option.label }}
        </option>
      </select>
      <textarea v-model="draft.question" class="editor-textarea" rows="4" placeholder="题干" />
      <textarea v-model="draft.options" class="editor-textarea" rows="4" placeholder="选项，用换行或 | 分隔" />
      <input v-model="draft.answer" class="editor-input" type="text" placeholder="正确答案" />
      <textarea v-model="draft.analysis" class="editor-textarea" rows="4" placeholder="解析" />
      <input v-model="draft.rootReason" class="editor-input" type="text" placeholder="根因" />
      <input v-model="draft.errorReason" class="editor-input" type="text" placeholder="表象原因" />
      <div class="form-grid">
        <select v-model="draft.difficulty" class="editor-input">
          <option :value="0">难度未设置</option>
          <option :value="1">1 星</option>
          <option :value="2">2 星</option>
          <option :value="3">3 星</option>
        </select>
        <input v-model="draft.srcYear" class="editor-input" type="text" placeholder="年份" />
        <input v-model="draft.srcProvince" class="editor-input" type="text" placeholder="省份/级别" />
      </div>
      <input v-model="draft.srcOrigin" class="editor-input" type="text" placeholder="来源" />
      <div class="error-card__practice-actions">
        <button class="ghost-button ghost-button--small" type="button" @click="handleSaveEdit">保存</button>
      </div>
    </div>
  </article>
</template>
