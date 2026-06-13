<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInterviewStore } from '@/stores/interviewStore'

const emit = defineEmits<{ close: []; imported: [result: { added: number; updated: number }] }>()
const store = useInterviewStore()

type ImportTab = 'json' | 'markdown'

const tab = ref<ImportTab>('json')
const content = ref('')
const err = ref('')
const loading = ref(false)

const placeholder = computed(() =>
  tab.value === 'json' ? '[{ "question_text": "..." }]' : '## 题目\n...',
)

const jsonExample = `[
  {
    "category": "comprehensive",
    "question_text": "有人说基层工作没有成长空间，你怎么看？",
    "framework": "1. 表态\\n2. 分析\\n3. 总结",
    "sample_answer": "基层是锻炼综合能力的舞台…",
    "source": "自拟",
    "difficulty": 2
  }
]`

const markdownExample = `## 题目
有人说基层工作没有成长空间，你怎么看？

## 题型
综合分析

## 来源
自拟

## 框架
1. 表态
2. 分析
3. 总结

## 参考答案
基层是锻炼综合能力的舞台…

---

## 题目
单位要组织政务服务开放日，你怎么组织？

## 题型
计划组织协调

## 框架
前期准备 → 现场流程 → 总结反馈`

function fillExample() {
  content.value = tab.value === 'json' ? jsonExample : markdownExample
}

async function copyExample() {
  try {
    await navigator.clipboard.writeText(tab.value === 'json' ? jsonExample : markdownExample)
  } catch {
    window.alert('复制失败，请手动复制示例')
  }
}

function switchTab(next: ImportTab) {
  tab.value = next
  err.value = ''
}

async function doImport() {
  err.value = ''
  const text = content.value.trim()
  if (!text) {
    err.value = '请先粘贴内容'
    return
  }
  loading.value = true
  try {
    const res = await store.importQuestions({ format: tab.value, content: text })
    content.value = ''
    emit('imported', { added: res.added, updated: res.updated })
    emit('close')
    window.alert(`导入完成：新增 ${res.added} 题，更新 ${res.updated} 题`)
  } catch (e) {
    err.value = e instanceof Error ? e.message : '导入失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="ivi-backdrop" @click.self="emit('close')">
      <div class="ivi-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <div class="ivi-head">
          <h2 class="ivi-title">批量导入题目</h2>
          <button type="button" class="ivi-close" @click="emit('close')">×</button>
        </div>

        <div class="ivi-tabs">
          <button
            type="button"
            class="ivi-tab"
            :class="{ 'ivi-tab--active': tab === 'json' }"
            @click="switchTab('json')"
          >
            JSON
          </button>
          <button
            type="button"
            class="ivi-tab"
            :class="{ 'ivi-tab--active': tab === 'markdown' }"
            @click="switchTab('markdown')"
          >
            Markdown
          </button>
        </div>

        <div class="ivi-body">
          <p v-if="tab === 'json'" class="ivi-hint">
            粘贴 JSON 数组。字段：<code>question_text</code>（必填）、<code>category</code>、<code>framework</code>、<code>sample_answer</code>、<code>source</code>、<code>difficulty</code>。相同题干或相同
            <code>id</code> 会更新而非重复插入。
          </p>
          <p v-else class="ivi-hint">
            每题用 <code>## 题目</code> 等分段；多题之间用 <code>---</code> 分隔。支持段落名：题目、题型、框架、参考答案、来源、难度。未知题型名称会自动新建。
          </p>

          <textarea
            v-model="content"
            class="ivi-textarea"
            :class="{ 'ivi-textarea--mono': tab === 'json' }"
            rows="14"
            :placeholder="placeholder"
          />

          <div class="ivi-actions">
            <button type="button" class="ivi-btn ivi-btn--sm" @click="fillExample">填入示例</button>
            <button type="button" class="ivi-btn ivi-btn--sm" @click="copyExample">复制示例</button>
          </div>

          <div v-if="err" class="ivi-err">{{ err }}</div>
        </div>

        <div class="ivi-foot">
          <button type="button" class="ivi-btn" @click="emit('close')">取消</button>
          <button type="button" class="ivi-btn ivi-btn--primary" :disabled="loading" @click="doImport">
            {{ loading ? '导入中…' : '导入到题库' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ivi-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}

.ivi-modal {
  width: min(640px, 96vw);
  max-height: 92vh;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 60px rgb(15 23 42 / 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ivi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e2e8f0;
}

.ivi-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}

.ivi-close {
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 18px;
}

.ivi-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 18px 0;
}

.ivi-tab {
  padding: 6px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px 8px 0 0;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: #64748b;
}

.ivi-tab--active {
  background: #fff;
  border-bottom-color: #fff;
  color: #ea580c;
}

.ivi-body {
  padding: 12px 18px 16px;
  overflow-y: auto;
}

.ivi-hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.55;
  color: #64748b;
}

.ivi-hint code {
  font-size: 11px;
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 4px;
}

.ivi-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.55;
  resize: vertical;
  box-sizing: border-box;
}

.ivi-textarea--mono {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.ivi-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.ivi-err {
  margin-top: 10px;
  font-size: 12px;
  color: #dc2626;
}

.ivi-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 16px;
  border-top: 1px solid #e2e8f0;
}

.ivi-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ivi-btn--sm {
  padding: 5px 10px;
  font-size: 12px;
}

.ivi-btn--primary {
  border: none;
  background: linear-gradient(135deg, #ea580c, #c2410c);
  color: #fff;
}

.ivi-btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
