<template>
  <main class="workspace-shell entry-flow-shell legacy-overlay-shell">
    <aside class="workspace-sidebar">
      <section class="panel sidebar-brand">
        <div class="eyebrow">{{ isEditMode ? '编辑题目' : '快速录题' }}</div>
        <strong>{{ pageTitle }}</strong>
        <p>{{ pageCopy }}</p>
      </section>

      <section class="panel sidebar-card">
        <div class="sidebar-card-title">快捷导航</div>
        <div class="action-grid">
          <a class="link-button" href="/next/workspace">学习首页</a>
          <a class="link-button" href="/next/workspace/errors">错题工作台</a>
          <a class="link-button" href="/next/workspace/notes">学习笔记</a>
          <a class="link-button" href="/next/actions/quickadd">快速录题</a>
          <a class="link-button" href="/next/tools/search">全局搜索</a>
        </div>
      </section>

      <section class="panel sidebar-card">
        <div class="sidebar-card-title">OCR</div>
        <p class="legacy-section-copy">上传题目截图，识别后再把结果回填进当前表单。</p>
        <label class="link-button entry-upload-button">
          <input type="file" accept="image/*" class="entry-file-input" @change="handleOcrFile" />
          {{ ocrBusy ? '识别中...' : '识别图片' }}
        </label>
        <p v-if="ocrStatus" class="legacy-section-copy">{{ ocrStatus }}</p>
      </section>
    </aside>

    <section class="workspace-main">
      <article class="panel workspace-topbar">
        <div>
          <div class="eyebrow">{{ isEditMode ? '编辑错题' : '添加错题' }}</div>
          <h1>{{ isEditMode ? '编辑错题' : '添加错题' }}</h1>
          <p>{{ isEditMode ? '直接修改当前错题内容。' : '先把题目放进来，再补答案、根因和解析。' }}</p>
          <p v-if="pageError" class="form-error">{{ pageError }}</p>
        </div>
        <div class="topbar-actions">
          <div class="entry-path-hint">当前路径：{{ currentKnowledgePath }}</div>
          <a class="action-button action-button--secondary" href="/next/workspace/errors">取消</a>
          <button type="button" class="action-button action-button--primary" @click="saveEntry">{{ busy ? '保存中...' : '保存题目' }}</button>
        </div>
      </article>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card content-card--workspace-focus entry-modal-card">
          <div class="entry-step-strip">
            <span class="entry-step-pill" :class="{ 'is-active': entryStep === 1 }">1 贴题目或识别题图</span>
            <span class="entry-step-pill" :class="{ 'is-active': entryStep === 2 }">2 确认选项与答案</span>
            <span class="entry-step-pill" :class="{ 'is-active': entryStep === 3 }">3 补错因与分析</span>
            <span class="entry-step-pill" :class="{ 'is-active': entryStep === 4 }">4 保存后继续复盘</span>
          </div>
          <div class="entry-section-head">
            <div>
              <h2>先完成最小录入</h2>
              <p>先录题干、选项、答案和知识点。只要这几项对了，这道题就能先存下来。</p>
            </div>
            <span class="entry-badge">优先必填</span>
          </div>
          <div class="entry-grid">
            <label>
              <span>一级分类</span>
              <input v-model.trim="form.type" type="text" placeholder="题型" />
            </label>
            <label>
              <span>二级分类</span>
              <input v-model.trim="form.subtype" type="text" placeholder="子类型" />
            </label>
            <label>
              <span>三级分类</span>
              <input v-model.trim="form.subSubtype" type="text" placeholder="更细分类" />
            </label>
            <label>
              <span>四级（可选）</span>
              <input v-model.trim="form.srcOrigin" type="text" placeholder="最终叶子或补充标签" />
            </label>
            <label>
              <span>状态</span>
              <select v-model="form.status">
                <option value="focus">重点</option>
                <option value="review">复习</option>
                <option value="archive">归档</option>
              </select>
            </label>
          </div>

          <label class="entry-block">
            <span>题干</span>
            <textarea v-model.trim="form.question" rows="6" placeholder="粘贴或编辑题干" />
          </label>

          <label class="entry-block">
            <span>选项</span>
            <textarea v-model.trim="form.options" rows="4" placeholder="A.xxx | B.xxx | C.xxx | D.xxx" />
          </label>

          <div class="entry-grid">
            <label>
              <span>正确答案</span>
              <input v-model.trim="form.answer" type="text" placeholder="A / B / C / D" />
            </label>
            <label>
              <span>我的答案</span>
              <input v-model.trim="form.myAnswer" type="text" placeholder="可选" />
            </label>
            <label>
              <span>来源年份</span>
              <input v-model.trim="form.srcYear" type="text" placeholder="2026" />
            </label>
            <label>
              <span>来源地区</span>
              <input v-model.trim="form.srcProvince" type="text" placeholder="可选" />
            </label>
          </div>

          <div class="entry-grid">
            <label class="entry-grid-span">
              <span>根因</span>
              <input v-model.trim="form.rootReason" type="text" placeholder="更深层原因" />
            </label>
            <label class="entry-grid-span">
              <span>触发点</span>
              <input v-model.trim="form.errorReason" type="text" placeholder="直接触发这次错误的点" />
            </label>
          </div>

          <label class="entry-block">
            <span>解析</span>
            <textarea v-model.trim="form.analysis" rows="5" placeholder="正确思路或解释" />
          </label>

          <label class="entry-block">
            <span>下一步</span>
            <textarea v-model.trim="form.nextAction" rows="3" placeholder="接下来怎么改" />
          </label>

          <div class="entry-grid">
            <label class="entry-grid-span">
              <span>知识点</span>
              <select v-model="form.noteNodeId">
                <option value="">暂不关联</option>
                <option v-for="node in flattenedKnowledgeNodes" :key="node.id" :value="node.id">
                  {{ node.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="entry-image-grid">
            <section class="panel detail-panel">
              <div class="sidebar-card-title">题目图片</div>
              <label class="link-button entry-upload-button">
                <input type="file" accept="image/*" class="entry-file-input" @change="(event) => handleImageUpload(event, 'imgData')" />
                上传图片
              </label>
              <img v-if="form.imgData" :src="form.imgData" alt="题目图片" class="entry-preview-image" />
            </section>

            <section class="panel detail-panel">
              <div class="sidebar-card-title">解析图片</div>
              <label class="link-button entry-upload-button">
                <input type="file" accept="image/*" class="entry-file-input" @change="(event) => handleImageUpload(event, 'analysisImgData')" />
                上传图片
              </label>
              <img v-if="form.analysisImgData" :src="form.analysisImgData" alt="解析图片" class="entry-preview-image" />
            </section>
          </div>
        </article>

        <article class="panel content-card panel--muted">
          <h2>OCR 结果</h2>
          <p class="legacy-section-copy">先识别，再选择怎么回填到当前表单。</p>
          <div v-if="ocrText" class="detail-block">
            <strong>识别文本</strong>
            <pre class="entry-ocr-preview">{{ ocrText }}</pre>
          </div>
          <div class="legacy-tool-grid">
            <button type="button" class="legacy-tool-action entry-action-button" @click="applyOcr('question')" :disabled="!ocrQuestion">
              <strong>回填题干</strong>
              <span>用识别文本替换当前题干。</span>
            </button>
            <button type="button" class="legacy-tool-action entry-action-button" @click="applyOcr('options')" :disabled="!ocrOptions">
              <strong>回填选项</strong>
              <span>用识别到的选项替换当前选项区。</span>
            </button>
            <button type="button" class="legacy-tool-action entry-action-button" @click="applyOcr('all')" :disabled="!ocrQuestion">
              <strong>整块回填</strong>
              <span>同时回填题干和选项。</span>
            </button>
            <button type="button" class="legacy-tool-action entry-action-button" @click="applyOcr('append')" :disabled="!ocrText">
              <strong>追加原文</strong>
              <span>把原始 OCR 文本追加到当前题干末尾。</span>
            </button>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError, apiRequest } from '@/services/api'
import type { ErrorSummary, KnowledgeTreeNode, NextHomeContextResponse } from '@/types/workspace'

type EntryForm = {
  id: string
  type: string
  subtype: string
  subSubtype: string
  question: string
  options: string
  answer: string
  myAnswer: string
  rootReason: string
  errorReason: string
  analysis: string
  nextAction: string
  status: string
  noteNodeId: string
  imgData: string
  analysisImgData: string
  srcYear: string
  srcProvince: string
  srcOrigin: string
}

const route = useRoute()
const router = useRouter()

const busy = ref(false)
const ocrBusy = ref(false)
const pageError = ref('')
const ocrStatus = ref('')
const knowledgeRoots = ref<KnowledgeTreeNode[]>([])
const ocrText = ref('')
const ocrQuestion = ref('')
const ocrOptions = ref('')

const form = ref<EntryForm>({
  id: '',
  type: '言语理解与表达',
  subtype: '',
  subSubtype: '',
  question: '',
  options: '',
  answer: '',
  myAnswer: '',
  rootReason: '',
  errorReason: '',
  analysis: '',
  nextAction: '',
  status: 'focus',
  noteNodeId: '',
  imgData: '',
  analysisImgData: '',
  srcYear: '',
  srcProvince: '',
  srcOrigin: '',
})

const isEditMode = computed(() => route.name === 'tool-edit')
const pageTitle = computed(() => (isEditMode.value ? '编辑错题' : '快速录题'))
const entryStep = computed(() => {
  if (!form.value.question && !form.value.imgData) return 1
  if (!form.value.answer) return 2
  if (!form.value.rootReason || !form.value.errorReason || !form.value.analysis) return 3
  return 4
})
const pageCopy = computed(() =>
  isEditMode.value
    ? '直接在 /next 里编辑当前错题，不再回旧版弹层。'
    : '直接在 /next 里新增错题，并支持 OCR 回填和图片上传。',
)

const flattenedKnowledgeNodes = computed(() => {
  const result: Array<{ id: string; label: string }> = []
  const walk = (nodes: KnowledgeTreeNode[], path: string[] = []) => {
    for (const node of nodes) {
      const nextPath = [...path, node.title]
      result.push({ id: node.id, label: nextPath.join(' / ') })
      if (node.children?.length) {
        walk(node.children, nextPath)
      }
    }
  }
  walk(knowledgeRoots.value)
  return result
})

const currentKnowledgePath = computed(() => {
  const matched = flattenedKnowledgeNodes.value.find((node) => node.id === form.value.noteNodeId)
  if (matched?.label) {
    return matched.label
  }
  const parts = [form.value.type, form.value.subtype, form.value.subSubtype, form.value.srcOrigin]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  return parts.join(' > ') || '未固定'
})

function applyKnowledgeTree(tree: KnowledgeTreeNode[] | { roots?: KnowledgeTreeNode[] } | undefined) {
  if (Array.isArray(tree)) {
    knowledgeRoots.value = tree
    return
  }
  knowledgeRoots.value = Array.isArray(tree?.roots) ? tree.roots : []
}

function applyRecord(record: ErrorSummary) {
  form.value = {
    id: String(record.id || ''),
    type: String(record.type || '言语理解与表达'),
    subtype: String(record.subtype || ''),
    subSubtype: String(record.subSubtype || ''),
    question: String(record.question || ''),
    options: String(record.options || ''),
    answer: String(record.answer || ''),
    myAnswer: String(record.myAnswer || ''),
    rootReason: String(record.rootReason || record.mistakeType || ''),
    errorReason: String(record.errorReason || record.triggerPoint || ''),
    analysis: String(record.analysis || record.correctModel || ''),
    nextAction: String(record.nextAction || ''),
    status: String(record.status || 'focus'),
    noteNodeId: String(record.noteNodeId || ''),
    imgData: String(record.imgData || ''),
    analysisImgData: String(record.analysisImgData || ''),
    srcYear: String(record.srcYear || ''),
    srcProvince: String(record.srcProvince || ''),
    srcOrigin: String(record.srcOrigin || ''),
  }
}

async function loadPage() {
  pageError.value = ''
  try {
    const homeContext = await apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=6')
    applyKnowledgeTree(homeContext.knowledgeTree)
    if (isEditMode.value) {
      const id = String(route.query.id || '').trim()
      if (!id) throw new Error('Missing error id')
      const payload = await apiRequest<{ ok: true; item: ErrorSummary }>(`/api/errors/${encodeURIComponent(id)}`)
      applyRecord(payload.item)
    }
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '录题页加载失败'
  }
}

async function uploadImage(body: ArrayBuffer, contentType: string): Promise<string> {
  const response = await fetch('/api/images', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': contentType || 'image/jpeg' },
    body,
  })
  if (!response.ok) {
    throw new Error((await response.text()) || '图片上传失败')
  }
  const payload = (await response.json()) as { url?: string }
  return String(payload.url || '')
}

async function handleImageUpload(event: Event, field: 'imgData' | 'analysisImgData') {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (!file) return
  pageError.value = ''
  try {
    const buffer = await file.arrayBuffer()
    form.value[field] = await uploadImage(buffer, file.type || 'image/jpeg')
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '图片上传失败'
  } finally {
    if (target) target.value = ''
  }
}

function parseOcrQuestionPayload(text: string) {
  const normalized = String(text || '').trim()
  const lines = normalized.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  const optionLines = lines.filter((item) => /^[A-DＡ-Ｄ][\\.．、\\s]/i.test(item))
  const questionLines = optionLines.length ? lines.slice(0, Math.max(lines.indexOf(optionLines[0]), 0)) : lines
  return {
    question: questionLines.join('\n').trim(),
    options: optionLines.join('\n').trim(),
  }
}

async function handleOcrFile(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (!file) return
  ocrBusy.value = true
  ocrStatus.value = ''
  pageError.value = ''
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/ai/ocr-image', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      body: formData,
    })
    if (!response.ok) {
      throw new Error(await response.text())
    }
    const payload = (await response.json()) as { result?: { text?: string } }
    ocrText.value = String(payload.result?.text || '').trim()
    const parsed = parseOcrQuestionPayload(ocrText.value)
    ocrQuestion.value = parsed.question
    ocrOptions.value = parsed.options
    ocrStatus.value = ocrText.value ? 'OCR 已完成，请选择回填方式。' : 'OCR 没有识别出可用文本。'
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : 'OCR 识别失败'
  } finally {
    ocrBusy.value = false
    if (target) target.value = ''
  }
}

function applyOcr(mode: 'question' | 'options' | 'all' | 'append') {
  if (mode === 'question' || mode === 'all') {
    form.value.question = ocrQuestion.value || form.value.question
  }
  if (mode === 'options' || mode === 'all') {
    form.value.options = ocrOptions.value || form.value.options
  }
  if (mode === 'append' && ocrText.value) {
    form.value.question = `${form.value.question}\n${ocrText.value}`.trim()
  }
}

function buildPayload() {
  return {
    id: form.value.id,
    type: form.value.type,
    subtype: form.value.subtype,
    subSubtype: form.value.subSubtype,
    question: form.value.question,
    options: form.value.options,
    answer: form.value.answer,
    myAnswer: form.value.myAnswer,
    rootReason: form.value.rootReason,
    errorReason: form.value.errorReason,
    analysis: form.value.analysis,
    nextAction: form.value.nextAction,
    status: form.value.status,
    noteNodeId: form.value.noteNodeId,
    imgData: form.value.imgData,
    analysisImgData: form.value.analysisImgData,
    srcYear: form.value.srcYear,
    srcProvince: form.value.srcProvince,
    srcOrigin: form.value.srcOrigin,
    mistakeType: form.value.rootReason,
    triggerPoint: form.value.errorReason,
    correctModel: form.value.analysis,
    knowledgePathTitles: [form.value.type, form.value.subtype, form.value.subSubtype].filter(Boolean),
  }
}

async function saveEntry() {
  if (busy.value) return
  pageError.value = ''
  if (!form.value.question && !form.value.imgData) {
    pageError.value = '题干不能为空'
    return
  }
  if (!form.value.subtype) {
    pageError.value = '二级分类不能为空'
    return
  }
  if (!form.value.answer) {
    pageError.value = '正确答案不能为空'
    return
  }
  busy.value = true
  try {
    if (isEditMode.value) {
      await apiRequest<{ ok: true; item: ErrorSummary }>(`/api/errors/${encodeURIComponent(form.value.id)}`, {
        method: 'PUT',
        body: JSON.stringify(buildPayload()),
      })
    } else {
      const payload = await apiRequest<{ ok: true; item: ErrorSummary }>('/api/errors', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      })
      form.value.id = String(payload.item.id || '')
    }
    await router.push({ name: 'workspace-errors' })
  } catch (error: unknown) {
    pageError.value = error instanceof ApiError || error instanceof Error ? error.message : '题目保存失败'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  void loadPage()
})
</script>
