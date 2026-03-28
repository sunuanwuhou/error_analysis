<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSyncStore } from '@/stores/sync'
import { useWorkspaceStore } from '@/stores/workspace'

const workspaceStore = useWorkspaceStore()
const syncStore = useSyncStore()

const importKind = ref<'error' | 'claude_bank'>('error')
const importText = ref('')
const exportMode = ref<'questions' | 'questions_notes' | 'module_backup'>('questions')
const exportScope = ref<'all' | 'filtered' | 'current'>('all')
const previewText = ref('')
const lastMessage = ref('')

const currentScopeLabel = computed(() => workspaceStore.selectedKnowledgeNode?.title || '当前工作区')

async function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importText.value = await file.text()
  lastMessage.value = `已载入文件：${file.name}`
}

function downloadJson(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function handleImport() {
  const raw = importText.value.trim()
  if (!raw) {
    lastMessage.value = '先粘贴 JSON 内容。'
    return
  }

  try {
    const result = workspaceStore.importEntries(raw, importKind.value)
    syncStore.enqueueOps(
      result.touched.map((entry) => ({
        opType: 'error_upsert',
        entityId: entry.id,
        payload: entry,
      })),
    )
    importText.value = ''
    lastMessage.value =
      importKind.value === 'claude_bank'
        ? `Claude 题库导入完成：新增 ${result.added} 题，更新 ${result.updated} 题。`
        : `错题导入完成：新增 ${result.added} 题，更新 ${result.updated} 题。`
  } catch (error) {
    lastMessage.value = error instanceof Error ? error.message : '导入失败。'
  }
}

function handlePreviewExport() {
  try {
    const result = workspaceStore.buildExportPayload(exportMode.value, exportScope.value)
    previewText.value = JSON.stringify(result.payload, null, 2)
    lastMessage.value = `已生成导出预览：${result.fileName}`
  } catch (error) {
    lastMessage.value = error instanceof Error ? error.message : '导出预览失败。'
  }
}

function handleDownloadExport() {
  try {
    const result = workspaceStore.buildExportPayload(exportMode.value, exportScope.value)
    previewText.value = JSON.stringify(result.payload, null, 2)
    downloadJson(result.fileName, result.payload)
    lastMessage.value = `已下载：${result.fileName}`
  } catch (error) {
    lastMessage.value = error instanceof Error ? error.message : '下载失败。'
  }
}

async function handleCopyExport() {
  try {
    const result = workspaceStore.buildExportPayload(exportMode.value, exportScope.value)
    const text = JSON.stringify(result.payload, null, 2)
    previewText.value = text
    await navigator.clipboard.writeText(text)
    lastMessage.value = '导出 JSON 已复制。'
  } catch (error) {
    lastMessage.value = error instanceof Error ? error.message : '复制失败。'
  }
}
</script>

<template>
  <section class="panel transfer-panel">
    <header class="panel__header">
      <div>
        <h2>导入导出</h2>
        <p class="panel__subtle">普通导入进错题，Claude 导入进题库。导出支持题目、题目加笔记、模块备份。</p>
      </div>
    </header>

    <div class="transfer-grid">
      <article class="transfer-card">
        <h3>导入</h3>
        <div class="radio-row">
          <label><input v-model="importKind" type="radio" value="error" /> 导入错题</label>
          <label><input v-model="importKind" type="radio" value="claude_bank" /> 导入 Claude 题</label>
        </div>
        <input class="editor-input" type="file" accept=".json" @change="handleFileImport" />
        <div class="panel__subtle">当前知识点：{{ currentScopeLabel }}</div>
        <textarea
          v-model="importText"
          class="transfer-textarea"
          rows="14"
          placeholder='粘贴 JSON，支持数组或 { "errors": [] } 格式。'
        />
        <div class="transfer-actions">
          <button class="ghost-button ghost-button--small" type="button" @click="handleImport">开始导入</button>
        </div>
      </article>

      <article class="transfer-card">
        <h3>导出</h3>
        <div class="panel__subtle">导出内容</div>
        <div class="radio-col">
          <label><input v-model="exportMode" type="radio" value="questions" /> 仅题目</label>
          <label><input v-model="exportMode" type="radio" value="questions_notes" /> 题目 + 笔记</label>
          <label><input v-model="exportMode" type="radio" value="module_backup" /> 模块备份</label>
        </div>

        <div class="panel__subtle">导出范围</div>
        <div class="radio-col">
          <label><input v-model="exportScope" type="radio" value="all" /> 全部错题</label>
          <label><input v-model="exportScope" type="radio" value="filtered" /> 当前筛选</label>
          <label><input v-model="exportScope" type="radio" value="current" /> 当前知识点</label>
        </div>

        <div class="transfer-actions">
          <button class="ghost-button ghost-button--small" type="button" @click="handlePreviewExport">预览</button>
          <button class="ghost-button ghost-button--small" type="button" @click="handleCopyExport">复制 JSON</button>
          <button class="ghost-button ghost-button--small" type="button" @click="handleDownloadExport">下载 JSON</button>
        </div>
      </article>
    </div>

    <div v-if="lastMessage" class="transfer-message">{{ lastMessage }}</div>

    <div v-if="previewText" class="transfer-preview">
      <div class="panel__subtle">导出预览</div>
      <textarea class="transfer-textarea" rows="16" :value="previewText" readonly />
    </div>
  </section>
</template>
