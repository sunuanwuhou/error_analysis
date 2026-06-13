<script setup lang="ts">
import { ref } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'

const emit = defineEmits<{ close: []; imported: [] }>()
const store = useXingceStore()

const rawQuestion = ref('')
const templateText = ref('')
const showTemplate = ref(false)
const claudeResult = ref('')
const copyHint = ref(false)
const err = ref('')

function genTemplate() {
  const raw = rawQuestion.value.trim()
  if (!raw) {
    window.alert('请先粘贴题目')
    return
  }
  const tmpl = `请分析以下行测错题，只返回 JSON 数组，供错题系统直接导入。

【错题内容】
${raw}

【核心要求】
1. rootReason = 根本原因，必须提炼本质，写深层能力短板，不要复述题面，不要写过程。
2. errorReason = 表象原因，必须提炼当次失误现象，不要展开解释。
3. rootReason 限制在 20 个字以内。
4. errorReason 限制在 8 个字以内。
5. analysis 里先写【根本主因分析】，再写【解题思路】。
6. actualDurationSec = 实际用时（秒），没有就填 0。
7. targetDurationSec = 理想用时（秒），必须返回数字。
8. problemType = cognition / execution / mixed / unknown
9. workflowStage = captured / diagnosing / review_ready / retrain_due / mastered
10. nextActionType = review_note / retrain / mixed_train / observe
11. confidence = 0-5 整数
12. tip = 短句提醒
13. 只返回 JSON，不要任何额外说明

【返回格式】
[
  {
    "type": "判断推理",
    "subtype": "逻辑判断",
    "subSubtype": "条件推理",
    "question": "题目原文",
    "options": "A. 选项一|B. 选项二|C. 选项三|D. 选项四",
    "answer": "A",
    "myAnswer": "B",
    "actualDurationSec": 95,
    "targetDurationSec": 60,
    "problemType": "cognition",
    "rootReason": "条件链提炼能力不稳",
    "errorReason": "逆命题误判",
    "analysis": "【根本主因分析】......\\n\\n【解题思路】......",
    "tip": "先把条件链顺着写清，再判断能否逆推。",
    "nextActionType": "review_note",
    "confidence": 2,
    "workflowStage": "review_ready",
    "status": "focus"
  }
]`
  templateText.value = tmpl
  showTemplate.value = true
}

async function copyTemplate() {
  try {
    await navigator.clipboard.writeText(templateText.value)
    copyHint.value = true
    window.setTimeout(() => { copyHint.value = false }, 2000)
  } catch {
    window.alert('复制失败，请手动全选复制')
  }
}

function tryParseJson(raw: string): unknown[] | null {
  try {
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return data as unknown[]
    return null
  } catch {
    return null
  }
}

function doImport() {
  err.value = ''
  const raw = claudeResult.value.trim()
  if (!raw) {
    err.value = '请先粘贴 JSON'
    return
  }
  const data = tryParseJson(raw)
  if (!data) {
    err.value = 'JSON 解析失败，请确认内容是完整的 JSON 数组'
    return
  }
  const { added, updated } = store.mergeClaudeImport(data as Record<string, unknown>[])
  claudeResult.value = ''
  window.alert(`Claude 题库导入完成：新增 ${added} 题，更新 ${updated} 题`)
  emit('imported')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="ci-backdrop" @click.self="emit('close')">
      <div class="ci-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <div class="ci-head">
          <h2 class="ci-title">🤖 导入 Claude 题库</h2>
          <button type="button" class="ci-close" @click="emit('close')">×</button>
        </div>
        <div class="ci-body">
          <p class="ci-lead">粘贴题目 → 复制模板 → 发到 Claude.ai → 粘贴结果导入到题库</p>

          <div class="step-label"><span class="step-num">1</span>粘贴原始题目（可多题）</div>
          <textarea v-model="rawQuestion" rows="5" placeholder="直接粘贴题目原文，包括选项..." />
          <button type="button" class="ci-btn primary sm" @click="genTemplate">生成发送模板 →</button>

          <div v-if="showTemplate" class="ci-template">
            <div class="step-label">
              <span class="step-num">2</span>复制下方内容，发给 Claude.ai
              <span v-if="copyHint" class="copy-hint">✓ 已复制！</span>
            </div>
            <textarea v-model="templateText" class="template-out" readonly rows="10" />
            <button type="button" class="ci-btn sm" @click="copyTemplate">📋 一键复制</button>
          </div>

          <hr class="divider" />

          <div class="step-label"><span class="step-num">3</span>粘贴 Claude.ai 返回的 JSON</div>
          <textarea
            v-model="claudeResult"
            class="mono"
            rows="6"
            placeholder='[{"type":"判断推理","question":"...","answer":"A","analysis":"..."}]'
          />
          <div class="ci-import-row">
            <button type="button" class="ci-btn primary sm" @click="doImport">导入到 Claude 题库</button>
            <span class="ci-hint">自动合并，不会重复，也不会算进错题</span>
          </div>
          <div v-if="err" class="ci-err">{{ err }}</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ci-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}
.ci-modal {
  width: min(640px, 96vw);
  max-height: 92vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ci-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.ci-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
}
.ci-close {
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 18px;
}
.ci-body {
  overflow-y: auto;
  padding: 14px 16px 16px;
  font-size: 13px;
}
.ci-lead {
  margin: 0 0 14px;
  font-size: 12px;
  color: #94a3b8;
}
.step-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.step-num {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #4a6cf7;
  color: #fff;
  font-size: 10px;
}
textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  margin-bottom: 8px;
}
textarea.mono {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.template-out {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  background: #f8fafc;
}
.ci-template { margin-top: 14px; }
.divider {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 16px 0;
}
.ci-import-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.ci-hint {
  font-size: 11px;
  color: #94a3b8;
}
.ci-err {
  margin-top: 8px;
  color: #dc2626;
  font-size: 12px;
}
.copy-hint {
  color: #16a34a;
  font-size: 11px;
  font-weight: 400;
}
.ci-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}
.ci-btn.sm { padding: 5px 10px; }
.ci-btn.primary {
  background: #4a6cf7;
  border-color: #4a6cf7;
  color: #fff;
}
</style>
