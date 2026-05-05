<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { xingceApi } from '@/api/xingce'
import type { PracticeAttemptRow } from '@/api/xingce'

const emit = defineEmits<{ close: [] }>()

const loading = ref(true)
const err = ref('')
const items = ref<PracticeAttemptRow[]>([])

function fmtTime(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return String(iso)
  }
}

function resultLabel(r: string | undefined): string {
  const m: Record<string, string> = {
    correct: '正确',
    wrong: '错误',
    skipped: '跳过',
    partial: '部分正确',
  }
  return r ? (m[r] ?? r) : '—'
}

onMounted(async () => {
  loading.value = true
  err.value = ''
  try {
    const res = await xingceApi.getPracticeAttempts(200)
    items.value = res.items ?? []
  } catch (e) {
    err.value = String(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="hm-backdrop" @click.self="emit('close')">
      <div class="hm-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <div class="hm-head">
          <h2 class="hm-title">学习历史</h2>
          <button type="button" class="hm-close" title="关闭" @click="emit('close')">×</button>
        </div>
        <p class="hm-hint">按练习记录时间倒序（最近在上）。数据来自服务端 <code>practice_attempts</code>。</p>
        <div class="hm-body">
          <div v-if="loading" class="hm-empty">加载中…</div>
          <div v-else-if="err" class="hm-empty hm-err">{{ err }}</div>
          <div v-else-if="!items.length" class="hm-empty">暂无练习记录</div>
          <ul v-else class="hm-list">
            <li v-for="it in items" :key="it.id" class="hm-row">
              <div class="hm-row-top">
                <span class="hm-time">{{ fmtTime(it.createdAt || it.updatedAt) }}</span>
                <span class="hm-result" :class="'r-' + (it.result || 'unk')">{{ resultLabel(it.result) }}</span>
                <span v-if="it.durationSec != null" class="hm-dur">{{ it.durationSec }}s</span>
              </div>
              <div class="hm-meta">
                <span v-if="it.type || it.subtype">{{ [it.type, it.subtype].filter(Boolean).join(' › ') }}</span>
                <span v-if="it.sessionMode" class="hm-mode">{{ it.sessionMode }}</span>
              </div>
              <div v-if="it.questionText" class="hm-q">{{ String(it.questionText).slice(0, 200) }}{{ String(it.questionText).length > 200 ? '…' : '' }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.hm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}
.hm-modal {
  width: min(640px, 96vw);
  max-height: 88vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.hm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.hm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}
.hm-close {
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  color: #64748b;
}
.hm-hint {
  margin: 0;
  padding: 8px 16px;
  font-size: 11px;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
}
.hm-hint code {
  font-size: 10px;
  background: #e2e8f0;
  padding: 1px 4px;
  border-radius: 4px;
}
.hm-body {
  overflow-y: auto;
  padding: 10px 12px 14px;
  flex: 1;
  min-height: 120px;
}
.hm-empty {
  text-align: center;
  color: #64748b;
  padding: 28px 12px;
  font-size: 13px;
}
.hm-err {
  color: #dc2626;
}
.hm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hm-row {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fafafa;
}
.hm-row-top {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
}
.hm-time {
  color: #334155;
  font-weight: 600;
}
.hm-result {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 6px;
  font-weight: 600;
}
.hm-result.r-correct {
  background: #f0fdf4;
  color: #15803d;
}
.hm-result.r-wrong {
  background: #fef2f2;
  color: #b91c1c;
}
.hm-result.r-skipped {
  background: #f8fafc;
  color: #64748b;
}
.hm-result.r-partial {
  background: #fffbeb;
  color: #b45309;
}
.hm-result.r-unk {
  background: #f1f5f9;
  color: #64748b;
}
.hm-dur {
  margin-left: auto;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}
.hm-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #64748b;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.hm-mode {
  background: #eef2ff;
  color: #4338ca;
  padding: 0 6px;
  border-radius: 4px;
}
.hm-q {
  margin-top: 6px;
  font-size: 12px;
  color: #475569;
  line-height: 1.45;
  word-break: break-word;
}
</style>
