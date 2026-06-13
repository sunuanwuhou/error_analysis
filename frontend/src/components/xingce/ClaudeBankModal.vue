<script setup lang="ts">
import { computed, ref } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import type { ErrorEntry } from '@/api/xingce'

const emit = defineEmits<{ close: []; openImport: [] }>()
const store = useXingceStore()

const search = ref('')

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  const list = store.claudeBankEntries
  if (!kw) return list
  const terms = kw.split(/\s+/).filter(Boolean)
  return list.filter(item => {
    const haystack = [
      item.type,
      item.subtype,
      item.subSubtype,
      item.question,
      item.options,
      item.answer,
      item.analysis,
      item.rootReason,
      item.errorReason,
    ].join(' ').toLowerCase()
    return terms.every(t => haystack.includes(t))
  })
})

function pathText(item: ErrorEntry): string {
  if (item.noteNodeId) {
    const p = store.getNodePathText(item.noteNodeId)
    if (p) return p
  }
  const rec = item as Record<string, unknown>
  if (rec.knowledgePath) return String(rec.knowledgePath)
  if (Array.isArray(rec.knowledgePathTitles)) {
    return (rec.knowledgePathTitles as string[]).join(' > ')
  }
  return ''
}

function convert(id: string) {
  store.convertClaudeBankToError(id)
  window.alert('已转为错题')
}

function openImport() {
  emit('openImport')
}
</script>

<template>
  <Teleport to="body">
    <div class="cb-backdrop" @click.self="emit('close')">
      <div class="cb-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <div class="cb-head">
          <h2 class="cb-title">📚 Claude 题库</h2>
          <button type="button" class="cb-close" @click="emit('close')">×</button>
        </div>
        <div class="cb-body">
          <p class="cb-lead">
            这里存放 Claude 生成或导入的题目。它们默认不算错题，不参与复习和错题统计；需要时可以一键转为错题。
          </p>
          <div class="cb-toolbar">
            <input v-model="search" type="text" placeholder="搜索题干、题型、解析..." />
            <button type="button" class="cb-btn sm" @click="search = ''">清空搜索</button>
            <button type="button" class="cb-btn sm" @click="openImport">继续导入</button>
          </div>
          <div class="cb-summary">
            共 {{ store.claudeBankEntries.length }} 题，当前显示 {{ filtered.length }} 题
          </div>
          <div v-if="!filtered.length" class="cb-empty">暂无 Claude 题库题目</div>
          <div v-for="item in filtered" :key="item.id" class="cb-card">
            <div class="cb-card-meta">
              <span class="cb-tag">{{ item.type }} / {{ item.subtype }}</span>
              <span v-if="pathText(item)" class="cb-path">{{ pathText(item) }}</span>
            </div>
            <div class="cb-question">{{ String(item.question || '').slice(0, 200) }}</div>
            <div v-if="item.analysis" class="cb-analysis">{{ String(item.analysis).slice(0, 120) }}…</div>
            <div class="cb-actions">
              <button type="button" class="cb-btn primary sm" @click="convert(item.id)">转为错题</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cb-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}
.cb-modal {
  width: min(1120px, 96vw);
  max-height: 92vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.cb-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.cb-close {
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 18px;
}
.cb-body {
  overflow-y: auto;
  padding: 14px 16px 16px;
}
.cb-lead {
  margin: 0 0 14px;
  font-size: 12px;
  color: #7a8599;
  line-height: 1.7;
}
.cb-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.cb-toolbar input {
  flex: 1;
  min-width: 240px;
  padding: 9px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  font-size: 13px;
}
.cb-summary {
  font-size: 12px;
  color: #667085;
  margin-bottom: 12px;
}
.cb-empty {
  text-align: center;
  color: #94a3b8;
  padding: 32px;
}
.cb-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: #fafbfc;
}
.cb-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
}
.cb-tag {
  background: #eef2ff;
  color: #4338ca;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}
.cb-path {
  color: #94a3b8;
}
.cb-question {
  font-size: 13px;
  color: #1e293b;
  line-height: 1.5;
  margin-bottom: 4px;
}
.cb-analysis {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}
.cb-actions {
  display: flex;
  justify-content: flex-end;
}
.cb-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}
.cb-btn.sm { padding: 5px 10px; }
.cb-btn.primary {
  background: #4a6cf7;
  border-color: #4a6cf7;
  color: #fff;
}
</style>
