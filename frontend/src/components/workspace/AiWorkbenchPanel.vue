<script setup lang="ts">
import { computed, ref } from 'vue'

import { aiChat, aiDiagnose, aiGenerateQuestion } from '@/services/api'
import { useWorkspaceStore } from '@/stores/workspace'
import type { ErrorEntry, KnowledgeNode } from '@/types/workspace'

const MAX_TASK_PACK_ERRORS = 6
const MAX_TASK_PACK_MODULES = 6
const MAX_TOTAL_ERRORS = 120
const NOTE_PREVIEW_LIMIT = 1200

type ModulePack = {
  key: string
  title: string
  pathLabel: string
  noteState: string
  noteContent: string
  errors: ErrorEntry[]
}

const workspaceStore = useWorkspaceStore()

const active = ref<'diagnose' | 'chat' | 'generate' | 'summary'>('summary')
const chatDraft = ref('')
const chatHistory = ref<Array<{ role: string; content: string }>>([])
const diagnoseText = ref('')
const chatText = ref('')
const generateText = ref('')
const summaryText = ref('')
const busy = ref(false)

const scopedErrors = computed(() =>
  workspaceStore.selectedKnowledgeNodeId ? workspaceStore.relatedErrors : workspaceStore.filteredErrors,
)

const knowledgeNodeMap = computed(() => new Map(workspaceStore.knowledgeNodes.map((node) => [node.id, node])))

function cleanText(value: string | undefined, fallback = '') {
  return (value || fallback).trim()
}

function trimBlock(value: string, maxLength: number) {
  const normalized = value.trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trim()}...`
}

function normalizeReason(value: string | undefined) {
  const normalized = cleanText(value)
  return normalized && normalized !== '无' ? normalized : ''
}

function buildFallbackModuleTitle(item: ErrorEntry) {
  return [item.type, item.subtype, item.subSubtype].map((part) => cleanText(part)).filter(Boolean).join(' / ') || '未命名模块'
}

function buildNodePathLabel(node: KnowledgeNode | undefined) {
  if (!node) return '未关联知识树节点'
  const path: string[] = []
  let cursor: KnowledgeNode | undefined = node
  while (cursor) {
    path.unshift(cursor.title)
    cursor = cursor.parentId ? knowledgeNodeMap.value.get(cursor.parentId) : undefined
  }
  return path.join(' > ')
}

function buildNoteState(noteContent: string) {
  const effective = noteContent.replace(/[#>*`\-\s\r\n]/g, '')
  if (!effective) return '空白或仅标题'
  if (effective.length < 30) return '内容很薄'
  return '已有内容'
}

function collectTopReasons(errors: ErrorEntry[], field: 'rootReason' | 'errorReason') {
  const counts = new Map<string, number>()
  errors.forEach((item) => {
    const value = normalizeReason(item[field])
    if (!value) return
    counts.set(value, (counts.get(value) || 0) + 1)
  })
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .slice(0, 4)
    .map(([value, count]) => `${value} x${count}`)
}

function buildModulePacks() {
  const groups = new Map<string, ModulePack>()
  for (const error of scopedErrors.value.slice(0, MAX_TOTAL_ERRORS)) {
    const noteNodeId = cleanText(error.noteNodeId)
    const node = noteNodeId ? knowledgeNodeMap.value.get(noteNodeId) : undefined
    const key = noteNodeId || buildFallbackModuleTitle(error)
    const title = node?.title || buildFallbackModuleTitle(error)
    const pathLabel = buildNodePathLabel(node)
    const noteContent = cleanText(node?.contentMd || workspaceStore.knowledgeNotes[noteNodeId] || '')
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title,
        pathLabel,
        noteState: buildNoteState(noteContent),
        noteContent,
        errors: [],
      })
    }
    groups.get(key)!.errors.push(error)
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (b.errors.length !== a.errors.length) return b.errors.length - a.errors.length
    return a.title.localeCompare(b.title, 'zh-CN')
  })
}

function buildClaudeSummary() {
  const totalErrors = scopedErrors.value.length
  if (!totalErrors) {
    summaryText.value = '当前范围内还没有错题，先录入或筛出一个模块，再生成 Claude 任务包。'
    return
  }

  const packs = buildModulePacks()
  const visiblePacks = packs.slice(0, MAX_TASK_PACK_MODULES)
  const lines = [
    '# Claude 模块任务包',
    '',
    `当前范围：${workspaceStore.selectedKnowledgeNode?.title || '未指定知识点'}`,
    `搜索词：${workspaceStore.searchQuery || '无'}`,
    `错题总数：${totalErrors}`,
    `已拆分模块数：${packs.length}`,
    '',
    '使用规则：',
    '1. 一次只发一个模块给 Claude，不要把全部模块一起发。',
    '2. Claude 必须同时看“错题样本 + 对应笔记”再判断弱点。',
    '3. 如果笔记为空、很薄或只有标题，要让 Claude 明确指出。',
    '4. 如果模块太多，优先从排在前面的模块开始。',
  ]

  visiblePacks.forEach((pack, index) => {
    const notePreview = trimBlock(pack.noteContent, NOTE_PREVIEW_LIMIT)
    const rootReasons = collectTopReasons(pack.errors, 'rootReason')
    const errorReasons = collectTopReasons(pack.errors, 'errorReason')
    const errorSamples = pack.errors.slice(0, MAX_TASK_PACK_ERRORS).map((item) => ({
      type: item.type || '',
      subtype: item.subtype || '',
      subSubtype: item.subSubtype || '',
      question: item.question || '',
      answer: item.answer || '',
      rootReason: item.rootReason || '',
      errorReason: item.errorReason || '',
      status: item.status || '',
    }))

    lines.push(
      '',
      `## 模块 ${index + 1}：${pack.title}`,
      `- 模块路径：${pack.pathLabel}`,
      `- 关联错题数：${pack.errors.length}`,
      `- 本包展示样本：${Math.min(pack.errors.length, MAX_TASK_PACK_ERRORS)}`,
      `- 笔记状态：${pack.noteState}`,
      `- 高频根因：${rootReasons.length ? rootReasons.join('；') : '暂无明确标注'}`,
      `- 高频表象错因：${errorReasons.length ? errorReasons.join('；') : '暂无明确标注'}`,
      '',
      '### 对应笔记',
      notePreview || '(空白)',
      '',
      '### 错题样本',
      JSON.stringify(errorSamples, null, 2),
      '',
      '### 发给 Claude 的任务',
      '1. 判断这个模块最真实的主弱点。',
      '2. 结合错题样本和笔记内容，判断是“笔记本身不够”还是“笔记已有但不会调用”。',
      '3. 给出一个 3 天专项陪练方案。',
      '4. 判断是否需要立刻围绕这个模块出 3 道题；如果需要，再出题。',
    )
  })

  if (packs.length > visiblePacks.length) {
    lines.push(
      '',
      `其余还有 ${packs.length - visiblePacks.length} 个模块未展开。建议先把上面模块逐个发给 Claude，处理完再看后面的模块。`,
    )
  }

  summaryText.value = lines.join('\n')
}

async function handleDiagnose() {
  if (!scopedErrors.value.length) {
    diagnoseText.value = '当前范围内还没有错题，先录入一些题目再做诊断。'
    return
  }
  busy.value = true
  diagnoseText.value = '正在生成诊断...'
  try {
    const data = await aiDiagnose(scopedErrors.value.slice(0, 120))
    const weakPoints = (data.result.weakPoints || [])
      .map(
        (item, index) =>
          `${index + 1}. ${item.area || '未命名弱点'} [${item.priority || 'normal'}]\n${item.description || ''}\n建议：${item.suggestion || ''}`,
      )
      .join('\n\n')
    diagnoseText.value = `${data.result.summary || '暂无诊断结论'}\n\n${weakPoints}`.trim()
  } catch (error) {
    diagnoseText.value = error instanceof Error ? error.message : '诊断失败。'
  } finally {
    busy.value = false
  }
}

async function handleChatSend() {
  const message = chatDraft.value.trim()
  if (!message) return
  busy.value = true
  try {
    const data = await aiChat(message, chatHistory.value.slice(-6))
    chatHistory.value.push({ role: 'user', content: message })
    chatHistory.value.push({ role: 'assistant', content: data.reply || '' })
    chatText.value = data.reply || ''
    chatDraft.value = ''
  } catch (error) {
    chatText.value = error instanceof Error ? error.message : 'AI 对话失败。'
  } finally {
    busy.value = false
  }
}

async function handleGenerate() {
  if (!workspaceStore.selectedKnowledgeNode && !scopedErrors.value.length) {
    generateText.value = '先选中一个知识点，或者至少准备一条参考错题，再生成专项练习。'
    return
  }
  busy.value = true
  generateText.value = '正在生成题目...'
  try {
    const data = await aiGenerateQuestion({
      nodeTitle: workspaceStore.selectedKnowledgeNode?.title || '',
      nodeSummary: workspaceStore.selectedNodeNote || '',
      referenceError: scopedErrors.value[0] || {},
      count: 3,
    })
    generateText.value = JSON.stringify(data.items || [], null, 2)
  } catch (error) {
    generateText.value = error instanceof Error ? error.message : '生成题目失败。'
  } finally {
    busy.value = false
  }
}

async function copySummary() {
  if (!summaryText.value) buildClaudeSummary()
  await navigator.clipboard.writeText(summaryText.value)
}
</script>

<template>
  <section class="panel transfer-panel">
    <header class="panel__header">
      <div>
        <h2>AI 工作台</h2>
        <p class="panel__subtle">把诊断、对话、出题和按模块导出的 Claude 任务包集中到一个地方处理。</p>
      </div>
    </header>

    <div class="workspace-tabs workspace-tabs--inner">
      <button class="workspace-tab" :class="{ 'is-active': active === 'summary' }" type="button" @click="active = 'summary'">任务包导出</button>
      <button class="workspace-tab" :class="{ 'is-active': active === 'diagnose' }" type="button" @click="active = 'diagnose'">弱点诊断</button>
      <button class="workspace-tab" :class="{ 'is-active': active === 'chat' }" type="button" @click="active = 'chat'">问 AI</button>
      <button class="workspace-tab" :class="{ 'is-active': active === 'generate' }" type="button" @click="active = 'generate'">针对出题</button>
    </div>

    <div v-if="active === 'summary'" class="transfer-preview">
      <div class="transfer-actions">
        <button class="ghost-button ghost-button--small" type="button" @click="buildClaudeSummary">生成任务包</button>
        <button class="ghost-button ghost-button--small" type="button" @click="copySummary">复制任务包</button>
      </div>
      <textarea class="transfer-textarea" rows="18" :value="summaryText" readonly />
    </div>

    <div v-else-if="active === 'diagnose'" class="transfer-preview">
      <div class="transfer-actions">
        <button class="ghost-button ghost-button--small" type="button" :disabled="busy" @click="handleDiagnose">立即诊断</button>
      </div>
      <textarea class="transfer-textarea" rows="18" :value="diagnoseText" readonly />
    </div>

    <div v-else-if="active === 'chat'" class="transfer-preview">
      <textarea v-model="chatDraft" class="transfer-textarea" rows="5" placeholder="例如：我现在最该先补哪块？" />
      <div class="transfer-actions">
        <button class="ghost-button ghost-button--small" type="button" :disabled="busy" @click="handleChatSend">发送</button>
      </div>
      <textarea class="transfer-textarea" rows="16" :value="chatText" readonly />
    </div>

    <div v-else class="transfer-preview">
      <div class="transfer-actions">
        <button class="ghost-button ghost-button--small" type="button" :disabled="busy" @click="handleGenerate">生成 3 题</button>
      </div>
      <textarea class="transfer-textarea" rows="18" :value="generateText" readonly />
    </div>
  </section>
</template>
