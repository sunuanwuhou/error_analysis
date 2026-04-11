<template>
  <main class="workspace-shell">
    <aside class="workspace-sidebar">
      <section class="panel sidebar-brand">
        <div class="eyebrow">{{ isCanvasMode ? '画布' : '过程图' }}</div>
        <strong>{{ pageTitle }}</strong>
        <p>{{ pageCopy }}</p>
      </section>

      <section class="panel sidebar-card">
        <div class="sidebar-card-title">题目列表</div>
        <ul class="result-list legacy-task-list">
          <li v-for="item in errors" :key="item.id || item.question">
            <button type="button" class="legacy-tree-item" @click="selectError(String(item.id || ''))">
              <span>{{ buildErrorTitle(item) }}</span>
            </button>
          </li>
        </ul>
      </section>
    </aside>

    <section class="workspace-main">
      <article class="panel workspace-topbar">
        <div>
          <div class="eyebrow">{{ isCanvasMode ? '画布' : '过程图' }}</div>
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageCopy }}</p>
          <p v-if="pageError" class="form-error">{{ pageError }}</p>
          <p v-if="saveNotice" class="legacy-section-copy">{{ saveNotice }}</p>
        </div>
        <div class="topbar-actions">
          <a class="action-button action-button--secondary" href="/next/workspace/errors">返回错题工作台</a>
          <button type="button" class="action-button action-button--primary" @click="saveCurrent" :disabled="busy || !selectedDetail">{{ busy ? '保存中...' : '保存' }}</button>
        </div>
      </article>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card content-card--workspace-focus">
          <h2>题目上下文</h2>
          <template v-if="selectedDetail">
            <div class="detail-title">{{ buildErrorTitle(selectedDetail) }}</div>
            <div class="detail-block">
              <strong>题干</strong>
              <pre class="practice-text">{{ selectedDetail.question || '当前还没有题干内容。' }}</pre>
            </div>
            <div class="detail-grid">
              <div class="panel detail-panel">
                <div class="sidebar-card-title">根因</div>
                <p>{{ selectedDetail.rootReason || selectedDetail.errorReason || '当前还没有原因记录。' }}</p>
              </div>
              <div class="panel detail-panel">
                <div class="sidebar-card-title">解析</div>
                <p>{{ selectedDetail.analysis || '当前还没有解析。' }}</p>
              </div>
            </div>
          </template>
          <p v-else>先从左侧选一题。</p>
        </article>

        <article v-if="!isCanvasMode" class="panel content-card">
          <h2>过程图</h2>
          <label class="link-button entry-upload-button">
            <input type="file" accept="image/*" class="entry-file-input" @change="handleImageUpload" />
            上传过程图
          </label>
          <div v-if="processImageUrl" class="detail-block">
            <strong>预览</strong>
            <img :src="processImageUrl" alt="过程图" class="entry-preview-image" />
          </div>
          <div v-else class="entry-upload-zone">
            <p>还没有过程图</p>
            <p class="legacy-section-copy">粘贴截图或点击「上传过程图」选择图片</p>
          </div>
          <div class="topbar-actions">
            <button type="button" @click="clearProcessImage" :disabled="!processImageUrl">清空</button>
          </div>
        </article>

        <article v-else class="panel content-card">
          <h2>画布</h2>
          <canvas
            ref="canvasRef"
            class="next-scratch-canvas"
            width="960"
            height="560"
            @mousedown="startDraw"
            @mousemove="drawMove"
            @mouseup="stopDraw"
            @mouseleave="stopDraw"
            @touchstart.prevent="startDraw"
            @touchmove.prevent="drawMove"
            @touchend.prevent="stopDraw"
          />
          <div class="topbar-actions">
            <button type="button" @click="clearCanvas">清空</button>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { apiRequest } from '@/services/api'
import type { ErrorSummary, NextHomeContextResponse } from '@/types/workspace'

const route = useRoute()
const router = useRouter()

const busy = ref(false)
const pageError = ref('')
const saveNotice = ref('')
const errors = ref<ErrorSummary[]>([])
const selectedDetail = ref<ErrorSummary | null>(null)
const processImageUrl = ref('')
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)

const isCanvasMode = computed(() => route.name === 'tool-canvas')
const pageTitle = computed(() => (isCanvasMode.value ? '画布工具' : '过程图工具'))
const pageCopy = computed(() =>
  isCanvasMode.value
    ? '直接在 /next 里做草稿画布，并保存回当前错题。'
    : '直接在 /next 里上传并保存当前题目的过程图。',
)

function asText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function buildErrorTitle(error: ErrorSummary): string {
  const typeName = asText(error.type).trim()
  const subtypeName = asText(error.subtype).trim()
  if (typeName && subtypeName) {
    return `${typeName} / ${subtypeName}`
  }
  return typeName || asText(error.question).trim() || '未分类'
}

function getCanvasContext() {
  const canvas = canvasRef.value
  return canvas ? canvas.getContext('2d') : null
}

function pointFromEvent(event: MouseEvent | TouchEvent) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const source = 'touches' in event ? event.touches[0] : event
  return {
    x: ((source.clientX - rect.left) / rect.width) * canvas.width,
    y: ((source.clientY - rect.top) / rect.height) * canvas.height,
  }
}

function ensureCanvasBase() {
  const ctx = getCanvasContext()
  if (!ctx) return
  ctx.fillStyle = '#fffdf3'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#1f2937'
}

function drawFromSavedData(dataUrl: string) {
  const ctx = getCanvasContext()
  if (!ctx || !dataUrl) return
  const image = new Image()
  image.onload = () => {
    ensureCanvasBase()
    ctx.drawImage(image, 0, 0, ctx.canvas.width, ctx.canvas.height)
  }
  image.src = dataUrl
}

function startDraw(event: MouseEvent | TouchEvent) {
  const ctx = getCanvasContext()
  if (!ctx) return
  const point = pointFromEvent(event)
  isDrawing.value = true
  ctx.beginPath()
  ctx.moveTo(point.x, point.y)
}

function drawMove(event: MouseEvent | TouchEvent) {
  if (!isDrawing.value) return
  const ctx = getCanvasContext()
  if (!ctx) return
  const point = pointFromEvent(event)
  ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

function stopDraw() {
  isDrawing.value = false
}

function clearCanvas() {
  ensureCanvasBase()
}

async function loadPage() {
  pageError.value = ''
  saveNotice.value = ''
  const payload = await apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=24')
  errors.value = payload.errors || []
  const routeId = String(route.query.id || '').trim() || String(errors.value[0]?.id || '')
  if (routeId) {
    await selectError(routeId)
  }
}

async function selectError(errorId: string) {
  if (!errorId) return
  pageError.value = ''
  saveNotice.value = ''
  const fallbackItem = errors.value.find((entry) => String(entry.id || '') === errorId) || null
  if (fallbackItem) {
    selectedDetail.value = fallbackItem
    processImageUrl.value = String(fallbackItem.processImage?.imageUrl || '')
  }
  try {
    const payload = await apiRequest<{ ok: true; item: ErrorSummary }>(`/api/errors/${encodeURIComponent(errorId)}`)
    selectedDetail.value = payload.item
    processImageUrl.value = String(payload.item.processImage?.imageUrl || '')
    await router.replace({ query: { ...route.query, id: errorId } })
    await nextTick()
    if (isCanvasMode.value) {
      ensureCanvasBase()
      if (payload.item.processCanvasData) {
        drawFromSavedData(String(payload.item.processCanvasData || ''))
      }
    }
  } catch (error: unknown) {
    if (!fallbackItem) {
      pageError.value = error instanceof Error ? error.message : '错题详情加载失败'
    } else if (isCanvasMode.value) {
      ensureCanvasBase()
      if (fallbackItem.processCanvasData) {
        drawFromSavedData(String(fallbackItem.processCanvasData || ''))
      }
    }
  }
}

async function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  busy.value = true
  pageError.value = ''
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/images', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    })
    const payload = (await response.json()) as { dataUrl?: string; url?: string; detail?: string }
    if (!response.ok) {
      throw new Error(payload.detail || '上传失败')
    }
    processImageUrl.value = String(payload.url || payload.dataUrl || '')
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '上传失败'
  } finally {
    busy.value = false
    if (input) input.value = ''
  }
}

function clearProcessImage() {
  processImageUrl.value = ''
}

async function saveCurrent() {
  if (!selectedDetail.value || busy.value) return
  busy.value = true
  pageError.value = ''
  saveNotice.value = ''
  try {
    const processCanvasData = isCanvasMode.value && canvasRef.value ? canvasRef.value.toDataURL('image/png') : String(selectedDetail.value.processCanvasData || '')
    const processImage = !isCanvasMode.value && processImageUrl.value
      ? { imageUrl: processImageUrl.value, updatedAt: new Date().toISOString() }
      : (!isCanvasMode.value ? {} : (selectedDetail.value.processImage || {}))
    const payload = await apiRequest<{ ok: true; item: ErrorSummary }>(`/api/errors/${encodeURIComponent(String(selectedDetail.value.id || ''))}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: selectedDetail.value.id,
        type: selectedDetail.value.type || '',
        subtype: selectedDetail.value.subtype || '',
        subSubtype: selectedDetail.value.subSubtype || '',
        question: selectedDetail.value.question || '',
        options: selectedDetail.value.options || '',
        answer: selectedDetail.value.answer || '',
        myAnswer: selectedDetail.value.myAnswer || '',
        rootReason: selectedDetail.value.rootReason || '',
        errorReason: selectedDetail.value.errorReason || '',
        analysis: selectedDetail.value.analysis || '',
        nextAction: selectedDetail.value.nextAction || '',
        status: selectedDetail.value.status || 'focus',
        noteNodeId: selectedDetail.value.noteNodeId || '',
        imgData: selectedDetail.value.imgData || '',
        analysisImgData: selectedDetail.value.analysisImgData || '',
        srcYear: selectedDetail.value.srcYear || '',
        srcProvince: selectedDetail.value.srcProvince || '',
        srcOrigin: selectedDetail.value.srcOrigin || '',
        knowledgePathTitles: selectedDetail.value.knowledgePathTitles || [],
        knowledgePath: selectedDetail.value.knowledgePath || '',
        knowledgeNodePath: selectedDetail.value.knowledgeNodePath || '',
        notePath: selectedDetail.value.notePath || '',
        mistakeType: selectedDetail.value.mistakeType || '',
        triggerPoint: selectedDetail.value.triggerPoint || '',
        correctModel: selectedDetail.value.correctModel || '',
        processCanvasData,
        processImage,
      }),
    })
    selectedDetail.value = payload.item
    processImageUrl.value = String(payload.item.processImage?.imageUrl || '')
    saveNotice.value = isCanvasMode.value ? '画布已保存。' : '过程图已保存。'
  } catch (error: unknown) {
    pageError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    busy.value = false
  }
}

watch(isCanvasMode, async () => {
  await nextTick()
  if (isCanvasMode.value) {
    ensureCanvasBase()
    if (selectedDetail.value?.processCanvasData) {
      drawFromSavedData(String(selectedDetail.value.processCanvasData || ''))
    }
  }
})

onMounted(() => {
  void loadPage()
})
</script>
