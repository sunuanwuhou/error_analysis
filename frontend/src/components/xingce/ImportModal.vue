<script setup lang="ts">
import { computed, ref } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'

const emit = defineEmits<{ close: []; imported: [count: number] }>()
const store = useXingceStore()

const raw = ref('')
const err = ref('')
const importing = ref(false)
/** json：粘贴导出 JSON；text：粉笔等纯文本（尝试按题号切块） */
const mode = ref<'json' | 'text'>('json')

/** 粉笔 / 文本：按「行首题号」粗切分为多条 */
function parseFenbiLoose(text: string): Record<string, unknown>[] {
  const t = text.trim()
  if (!t.length) return []
  const chunks = t
    .split(/\n(?=\s*\d{1,3}\s*[\.、．]\s*)|(?=\s*第\s*\d+\s*题)/)
    .map(s => s.trim())
    .filter(s => s.length > 10)
  const out: Record<string, unknown>[] = []
  for (const chunk of chunks) {
    const lines = chunk.split(/\n/).map(l => l.trim()).filter(Boolean)
    const optLines = lines.filter(l => /^[ABCDabcd][\.．、\s]/.test(l))
    const answerLine = lines.find(l => /答案|正确答案/.test(l))
    let answer = ''
    if (answerLine) {
      const m = answerLine.match(/[:：]\s*([ABCDabcd])/i)
      if (m) answer = m[1].toUpperCase()
    }
    const questionLines = lines.filter(
      l => !/^[ABCDabcd][\.．、\s]/.test(l) && !/^(答案|正确答案)/.test(l),
    )
    const question = questionLines.join('\n').trim()
    if (question.length < 5) continue
    out.push({
      question,
      options: optLines.join('\n') || undefined,
      answer: answer || undefined,
      type: '其他',
      subtype: '导入',
    })
  }
  return out
}

const parsed = computed(() => {
  const t = raw.value.trim()
  if (!t) return []
  if (mode.value === 'text') return parseFenbiLoose(t)
  try {
    const data = JSON.parse(t)
    if (Array.isArray(data)) return data as Record<string, unknown>[]
    if (Array.isArray((data as Record<string, unknown>).errors))
      return (data as { errors: Record<string, unknown>[] }).errors
    return []
  } catch {
    return []
  }
})

function normalizeType(v: unknown) {
  const s = String(v || '').trim()
  return s || '其他'
}

function normalizeSubtype(v: unknown) {
  const s = String(v || '').trim()
  return s || '未分类'
}

function doImport() {
  err.value = ''
  if (!parsed.value.length) {
    err.value =
      mode.value === 'json'
        ? '未识别到 JSON（数组或 { errors: [] }）'
        : '未从文本中解析出题目（尝试换行题号如 1. 或 第1题）'
    return
  }
  importing.value = true
  let ok = 0
  try {
    for (const item of parsed.value) {
      const q = String(item.question || '').trim()
      if (!q) continue
      store.addError({
        question: q,
        type: normalizeType(item.type),
        subtype: normalizeSubtype(item.subtype),
        subSubtype: String(item.subSubtype || '').trim() || undefined,
        options: String(item.options || '').trim() || undefined,
        answer: String(item.answer || '').trim() || undefined,
        myAnswer: String(item.myAnswer || '').trim() || undefined,
        rootReason: String(item.rootReason || item.errorReason || '').trim() || undefined,
        analysis: String(item.analysis || '').trim() || undefined,
        nextAction: String(item.nextAction || '').trim() || undefined,
        status: String(item.status || 'focus') as 'focus' | 'review' | 'mastered',
        noteNodeId: String(item.noteNodeId || '').trim() || undefined,
        workflowStage: String(item.workflowStage || 'captured'),
      })
      ok++
    }
  } finally {
    importing.value = false
  }
  emit('imported', ok)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="im-backdrop" @click.self="emit('close')">
      <div class="im-modal">
        <div class="im-header">
          <span>导入错题</span>
          <button type="button" class="im-close" @click="emit('close')">×</button>
        </div>
        <div class="im-body">
          <div class="im-tabs">
            <button type="button" class="im-tab" :class="{ on: mode === 'json' }" @click="mode = 'json'">
              JSON
            </button>
            <button type="button" class="im-tab" :class="{ on: mode === 'text' }" @click="mode = 'text'">
              文本 / 粉笔
            </button>
          </div>
          <textarea
            v-model="raw"
            class="im-text"
            rows="12"
            :placeholder="
              mode === 'json'
                ? '粘贴 JSON：数组，或 { errors: [...] }'
                : '粘贴整卷文本；按行首「1.」「2、」「第3题」尝试切块；选项行以 A. B. 开头；答案行含「答案：A」'
            "
          />
          <div class="im-meta">
            <span>识别条数：{{ parsed.length }}</span>
            <span v-if="err" class="im-err">{{ err }}</span>
          </div>
        </div>
        <div class="im-footer">
          <button type="button" class="im-btn" @click="emit('close')">取消</button>
          <button
            type="button"
            class="im-btn primary"
            :disabled="importing || parsed.length === 0"
            @click="doImport"
          >
            {{ importing ? '导入中…' : `确认导入 ${parsed.length} 条` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.im-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}
.im-modal {
  width: min(760px, 96vw);
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.24);
}
.im-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #edf2f7;
  font-weight: 700;
  color: #111827;
}
.im-close {
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
}
.im-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.im-tabs {
  display: flex;
  gap: 6px;
}
.im-tab {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #64748b;
}
.im-tab.on {
  border-color: #4a6cf7;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 600;
}
.im-text {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px;
  box-sizing: border-box;
}
.im-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
}
.im-err {
  color: #dc2626;
}
.im-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #edf2f7;
}
.im-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}
.im-btn.primary {
  background: #4a6cf7;
  border-color: #4a6cf7;
  color: #fff;
}
.im-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
