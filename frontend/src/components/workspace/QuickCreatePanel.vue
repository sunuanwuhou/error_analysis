<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { aiOcrImage, uploadImage } from '@/services/api'
import { useSyncStore } from '@/stores/sync'
import { useWorkspaceStore } from '@/stores/workspace'
import type { ErrorEntry, KnowledgeNode } from '@/types/workspace'

type TypeRule = {
  keywords?: string[]
  type?: string
  subtype?: string
}

type OcrAlternative = {
  variant?: string
  text?: string
  quality?: number
  lineCount?: number
}

const workspaceStore = useWorkspaceStore()
const syncStore = useSyncStore()

const YEAR_OPTIONS = [
  '',
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
  '2019',
  '2018',
  '2017',
  '2016',
  '2015',
  '2014',
  '2013',
  '2012',
  '2011',
  '2010',
]

const PROVINCE_OPTIONS = [
  '',
  '国考',
  '北京',
  '天津',
  '上海',
  '重庆',
  '河北',
  '山西',
  '辽宁',
  '吉林',
  '黑龙江',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '四川',
  '贵州',
  '云南',
  '西藏',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆',
  '内蒙古',
]

const form = reactive({
  entryKind: 'error' as 'error' | 'claude_bank',
  type: '',
  subtype: '',
  subSubtype: '',
  question: '',
  options: '',
  answer: '',
  myAnswer: '',
  analysis: '',
  rootReason: '',
  errorReason: '',
  status: 'focus',
  noteNodeId: '',
  difficulty: 0,
  srcYear: '',
  srcProvince: '',
  srcOrigin: '',
})

const ocrStatus = reactive({
  busy: false,
  message: '',
})

const ocrDraft = reactive({
  rawText: '',
  question: '',
  options: '',
  hint: '',
  variant: '',
  lineCount: 0,
  alternatives: [] as OcrAlternative[],
})

const saveMessage = ref('')
const saving = ref(false)
const questionImageFile = ref<File | null>(null)
const questionImagePreviewUrl = ref('')

function collectNodeOptions(nodes: KnowledgeNode[], trail: string[] = []): Array<{ id: string; label: string }> {
  return nodes.flatMap((node) => {
    const nextTrail = [...trail, node.title]
    return [{ id: node.id, label: nextTrail.join(' > ') }, ...collectNodeOptions(node.children, nextTrail)]
  })
}

const knowledgeOptions = computed(() => collectNodeOptions(workspaceStore.knowledgeTree))

const typeRules = computed<TypeRule[]>(() =>
  Array.isArray(workspaceStore.typeRules) ? (workspaceStore.typeRules as TypeRule[]) : [],
)

watch(
  () => workspaceStore.selectedKnowledgeNodeId,
  (value) => {
    if (!form.noteNodeId) {
      form.noteNodeId = value || ''
    }
  },
  { immediate: true },
)

watch(
  () => `${form.question}\n${form.options}`,
  (value) => {
    const text = value.trim()
    if (text.length < 5) return
    if (form.type && form.type !== '未分类') return
    for (const rule of typeRules.value) {
      const keywords = Array.isArray(rule.keywords) ? rule.keywords : []
      if (!keywords.some((keyword) => keyword && text.includes(keyword))) continue
      form.type = rule.type || form.type || '未分类'
      if (!form.subtype && rule.subtype) form.subtype = rule.subtype
      return
    }
  },
)

const currentNodeLabel = computed(() => {
  const option = knowledgeOptions.value.find((item) => item.id === form.noteNodeId)
  return option?.label || '未指定知识点'
})

const hasOcrDraft = computed(() => Boolean(ocrDraft.rawText || ocrDraft.question || ocrDraft.options))

function normalizeOCRText(text: string) {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseOCRQuestionPayload(text: string) {
  const normalized = normalizeOCRText(text)
  if (!normalized) return { question: '', options: '' }
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean)
  const optionStart = lines.findIndex((line) => /^[A-DＡ-Ｄ][.、．\s]/.test(line))
  if (optionStart <= 0) {
    return { question: normalized, options: '' }
  }
  return {
    question: lines.slice(0, optionStart).join('\n').trim(),
    options: lines.slice(optionStart).join('\n').trim(),
  }
}

function clearOcrDraft() {
  ocrDraft.rawText = ''
  ocrDraft.question = ''
  ocrDraft.options = ''
  ocrDraft.hint = ''
  ocrDraft.variant = ''
  ocrDraft.lineCount = 0
  ocrDraft.alternatives = []
}

function applyOcrResult(mode: 'question' | 'options' | 'all' | 'append') {
  if (!hasOcrDraft.value) return
  if (mode === 'question') {
    form.question = ocrDraft.question || form.question
  } else if (mode === 'options') {
    form.options = ocrDraft.options || form.options
  } else if (mode === 'all') {
    if (ocrDraft.question) form.question = ocrDraft.question
    if (ocrDraft.options) form.options = ocrDraft.options
  } else if (mode === 'append') {
    form.question = [form.question.trim(), ocrDraft.rawText].filter(Boolean).join('\n').trim()
  }
  ocrStatus.message = 'OCR 内容已回填，可以继续修改后保存。'
}

function useOcrAlternative(index: number) {
  const alternative = ocrDraft.alternatives[index]
  if (!alternative?.text) return
  const parsed = parseOCRQuestionPayload(alternative.text)
  ocrDraft.rawText = normalizeOCRText(alternative.text)
  ocrDraft.question = parsed.question
  ocrDraft.options = parsed.options
  ocrDraft.variant = alternative.variant || ''
  ocrDraft.lineCount = Number(alternative.lineCount || 0)
  ocrStatus.message = '已切换 OCR 候选，请确认后回填。'
}

function resetForm() {
  form.type = ''
  form.subtype = ''
  form.subSubtype = ''
  form.question = ''
  form.options = ''
  form.answer = ''
  form.myAnswer = ''
  form.analysis = ''
  form.rootReason = ''
  form.errorReason = ''
  form.status = 'focus'
  form.difficulty = 0
  form.srcYear = ''
  form.srcProvince = ''
  form.srcOrigin = ''
  questionImageFile.value = null
  if (questionImagePreviewUrl.value) {
    URL.revokeObjectURL(questionImagePreviewUrl.value)
    questionImagePreviewUrl.value = ''
  }
  clearOcrDraft()
}

async function handleCreate() {
  const question = form.question.trim()
  if (!question) {
    saveMessage.value = '至少先填上题干，再保存。'
    return
  }

  saving.value = true
  saveMessage.value = ''
  try {
    let imgData = ''
    if (questionImageFile.value) {
      const uploaded = await uploadImage(questionImageFile.value)
      imgData = uploaded.hash
    }

    const entry: Partial<ErrorEntry> = {
      entryKind: form.entryKind,
      type: form.type.trim() || '未分类',
      subtype: form.subtype.trim() || '未分类',
      subSubtype: form.subSubtype.trim(),
      question,
      options: form.options.trim(),
      answer: form.answer.trim(),
      myAnswer: form.myAnswer.trim(),
      analysis: form.analysis.trim(),
      rootReason: form.rootReason.trim(),
      errorReason: form.errorReason.trim(),
      noteNodeId: form.noteNodeId || workspaceStore.selectedKnowledgeNodeId || '',
      status: form.entryKind === 'error' ? form.status : '',
      difficulty: form.difficulty,
      srcYear: form.srcYear,
      srcProvince: form.srcProvince,
      srcOrigin: form.srcOrigin.trim(),
      imgData,
      addDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    }
    const saved = workspaceStore.upsertErrorEntry(entry, form.entryKind)
    syncStore.enqueueOp('error_upsert', saved.id, saved)
    saveMessage.value = form.entryKind === 'claude_bank' ? '已保存到 Claude 题库。' : '已保存这道题。'
    resetForm()
  } catch (error) {
    saveMessage.value = error instanceof Error ? error.message : '保存失败。'
  } finally {
    saving.value = false
  }
}

async function handleOcrFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  ocrStatus.busy = true
  ocrStatus.message = '正在识别图片文字...'
  clearOcrDraft()
  try {
    const data = await aiOcrImage(file)
    const text = (data.result?.text || data.result?.lines?.map((item) => item.text || '').join('\n') || '').trim()
    if (text) {
      const parsed = parseOCRQuestionPayload(text)
      ocrDraft.rawText = normalizeOCRText(text)
      ocrDraft.question = parsed.question
      ocrDraft.options = parsed.options
      ocrDraft.hint = data.result?.hint || ''
      ocrDraft.variant = data.result?.variant || ''
      ocrDraft.lineCount = Number(data.result?.lineCount || 0)
      ocrDraft.alternatives = Array.isArray(data.result?.alternatives) ? data.result?.alternatives : []
      ocrStatus.message = 'OCR 已完成，请先确认内容再回填。'
    } else {
      ocrStatus.message = '这张图没有识别出可用文字。'
    }
  } catch (error) {
    ocrStatus.message = error instanceof Error ? error.message : 'OCR 失败。'
  } finally {
    ocrStatus.busy = false
    input.value = ''
  }
}

function handleQuestionImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  questionImageFile.value = file
  if (questionImagePreviewUrl.value) URL.revokeObjectURL(questionImagePreviewUrl.value)
  questionImagePreviewUrl.value = URL.createObjectURL(file)
  input.value = ''
}

function clearQuestionImage() {
  questionImageFile.value = null
  if (questionImagePreviewUrl.value) {
    URL.revokeObjectURL(questionImagePreviewUrl.value)
    questionImagePreviewUrl.value = ''
  }
}
</script>

<template>
  <section class="panel transfer-panel">
    <header class="panel__header">
      <div>
        <h2>快速录题</h2>
        <p class="panel__subtle">保留旧版录题主链路：知识点挂载、OCR 辅助、题图、来源和复习信息都可以一起录。</p>
      </div>
    </header>

    <div class="transfer-grid transfer-grid--single">
      <article class="transfer-card">
        <div class="context-chip">当前挂载知识点：{{ currentNodeLabel }}</div>

        <div class="radio-row">
          <label><input v-model="form.entryKind" type="radio" value="error" /> 新增错题</label>
          <label><input v-model="form.entryKind" type="radio" value="claude_bank" /> 新增 Claude 题</label>
        </div>

        <div class="form-grid">
          <select v-model="form.noteNodeId" class="editor-input">
            <option v-for="option in knowledgeOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="transfer-actions">
          <input class="editor-input" type="file" accept="image/*" :disabled="ocrStatus.busy" @change="handleOcrFile" />
          <input class="editor-input" type="file" accept="image/*" @change="handleQuestionImageChange" />
        </div>
        <div class="panel__subtle">左边用于 OCR 识别，右边用于挂题图。</div>
        <div v-if="ocrStatus.message" class="panel__subtle">{{ ocrStatus.message }}</div>

        <div v-if="hasOcrDraft" class="transfer-preview">
          <div class="transfer-actions">
            <button class="ghost-button ghost-button--small" type="button" @click="applyOcrResult('question')">回填题干</button>
            <button class="ghost-button ghost-button--small" type="button" :disabled="!ocrDraft.options" @click="applyOcrResult('options')">回填选项</button>
            <button class="ghost-button ghost-button--small" type="button" @click="applyOcrResult('all')">全部回填</button>
            <button class="ghost-button ghost-button--small" type="button" @click="applyOcrResult('append')">追加原文</button>
          </div>
          <div class="panel__subtle" v-if="ocrDraft.hint">{{ ocrDraft.hint }}</div>
          <div class="panel__subtle" v-if="ocrDraft.variant || ocrDraft.lineCount">
            OCR 方案：{{ ocrDraft.variant || '默认' }}<span v-if="ocrDraft.lineCount"> / {{ ocrDraft.lineCount }} 行</span>
          </div>
          <textarea class="transfer-textarea" rows="4" :value="ocrDraft.question" readonly />
          <textarea v-if="ocrDraft.options" class="transfer-textarea" rows="4" :value="ocrDraft.options" readonly />
          <div v-if="ocrDraft.alternatives.length" class="radio-col">
            <label
              v-for="(item, index) in ocrDraft.alternatives"
              :key="`${item.variant || 'candidate'}-${index}`"
            >
              <button class="ghost-button ghost-button--small" type="button" @click="useOcrAlternative(index)">
                使用 {{ item.variant || `候选 ${index + 1}` }}
              </button>
              <span class="panel__subtle">{{ item.text }}</span>
            </label>
          </div>
        </div>

        <div v-if="questionImagePreviewUrl" class="transfer-preview">
          <div class="panel__subtle">题图预览</div>
          <img class="quick-create-image-preview" :src="questionImagePreviewUrl" alt="题图预览" />
          <div class="transfer-actions">
            <button class="ghost-button ghost-button--small" type="button" @click="clearQuestionImage">移除题图</button>
          </div>
        </div>

        <div class="form-grid">
          <input v-model="form.type" class="editor-input" type="text" placeholder="题型" />
          <input v-model="form.subtype" class="editor-input" type="text" placeholder="子类型" />
          <input v-model="form.subSubtype" class="editor-input" type="text" placeholder="细分类" />
        </div>

        <textarea v-model="form.question" class="editor-textarea" rows="5" placeholder="题干" />
        <textarea v-model="form.options" class="editor-textarea" rows="4" placeholder="选项，用换行或 | 分隔" />

        <div class="form-grid">
          <input v-model="form.answer" class="editor-input" type="text" placeholder="正确答案" />
          <input v-model="form.myAnswer" class="editor-input" type="text" placeholder="我的答案" />
          <select v-model="form.status" class="editor-input" :disabled="form.entryKind !== 'error'">
            <option value="focus">重点复习</option>
            <option value="review">复习中</option>
            <option value="mastered">已掌握</option>
          </select>
        </div>

        <div class="form-grid">
          <input v-model="form.rootReason" class="editor-input" type="text" placeholder="根因" />
          <input v-model="form.errorReason" class="editor-input" type="text" placeholder="表象原因" />
        </div>

        <textarea v-model="form.analysis" class="editor-textarea" rows="6" placeholder="解析 / 总结" />

        <details class="quick-create-advanced">
          <summary class="panel__subtle">补充信息：难度、来源这些可以最后再补</summary>
          <div class="form-grid">
            <select v-model="form.difficulty" class="editor-input">
              <option :value="0">难度未设置</option>
              <option :value="1">1 星</option>
              <option :value="2">2 星</option>
              <option :value="3">3 星</option>
            </select>
            <select v-model="form.srcYear" class="editor-input">
              <option v-for="year in YEAR_OPTIONS" :key="year || 'empty-year'" :value="year">
                {{ year || '年份' }}
              </option>
            </select>
            <select v-model="form.srcProvince" class="editor-input">
              <option v-for="province in PROVINCE_OPTIONS" :key="province || 'empty-province'" :value="province">
                {{ province || '省份/级别' }}
              </option>
            </select>
          </div>
          <input v-model="form.srcOrigin" class="editor-input" type="text" placeholder="来源（自填）" />
        </details>

        <div class="transfer-actions">
          <button class="ghost-button ghost-button--small" type="button" :disabled="saving" @click="handleCreate">保存题目</button>
        </div>
        <div v-if="saveMessage" class="panel__subtle">{{ saveMessage }}</div>
      </article>
    </div>
  </section>
</template>
