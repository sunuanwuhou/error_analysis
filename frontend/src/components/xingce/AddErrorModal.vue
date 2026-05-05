<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import type { KnowledgeNode } from '@/api/xingce'

const emit = defineEmits<{ close: []; added: [] }>()
const store = useXingceStore()

const TYPES = ['言语理解与表达', '判断推理', '数量关系', '资料分析', '常识判断', '其他']

const STATUS_OPTIONS = [
  { value: 'focus',    label: '重点复习' },
  { value: 'review',   label: '待复习' },
  { value: 'mastered', label: '已掌握' },
]

const form = reactive({
  type: '言语理解与表达',
  subtype: '',
  subSubtype: '',
  question: '',
  options: '',
  answer: '',
  myAnswer: '',
  rootReason: '',
  analysis: '',
  nextAction: '',
  status: 'focus' as 'focus' | 'review' | 'mastered',
  actualDurationSec: '' as string | number,
  targetDurationSec: '' as string | number,
  noteNodeId: '',
})

const submitting = ref(false)
const errMsg = ref('')

function walkLeaves(nodes: KnowledgeNode[]): KnowledgeNode[] {
  const out: KnowledgeNode[] = []
  for (const n of nodes) {
    const kids = n.children ?? []
    if (kids.length) out.push(...walkLeaves(kids as KnowledgeNode[]))
    else out.push(n)
  }
  return out
}

const knowledgeLeaves = computed(() => walkLeaves(store.knowledgeTree))

function leafLabel(n: KnowledgeNode) {
  const p = store.getNodePathText(n.id)
  return p ? `${p} › ${n.title}` : n.title
}

function validate() {
  if (!form.question.trim()) return '题目不能为空'
  if (!form.subtype.trim()) return '模块（2级）不能为空'
  return null
}

function submit() {
  const err = validate()
  if (err) { errMsg.value = err; return }
  errMsg.value = ''
  submitting.value = true

  try {
    store.addError({
      type: form.type.trim(),
      subtype: form.subtype.trim(),
      subSubtype: form.subSubtype.trim() || undefined,
      question: form.question.trim(),
      options: form.options.trim() || undefined,
      answer: form.answer.trim() || undefined,
      myAnswer: form.myAnswer.trim() || undefined,
      rootReason: form.rootReason.trim() || undefined,
      analysis: form.analysis.trim() || undefined,
      nextAction: form.nextAction.trim() || undefined,
      status: form.status,
      actualDurationSec: form.actualDurationSec ? Number(form.actualDurationSec) : undefined,
      targetDurationSec: form.targetDurationSec ? Number(form.targetDurationSec) : undefined,
      noteNodeId: form.noteNodeId.trim() || undefined,
      workflowStage: 'captured',
    })
    emit('added')
    emit('close')
  } catch (e) {
    errMsg.value = String(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="am-backdrop" @click.self="emit('close')">
      <div class="am-modal">
        <div class="am-header">
          <span class="am-title">添加错题</span>
          <button class="am-close" @click="emit('close')">×</button>
        </div>

        <div class="am-body">
          <!-- 知识路径 -->
          <div class="am-row am-row-3col">
            <div class="am-field">
              <label class="am-label">1级 <span class="req">*</span></label>
              <select v-model="form.type" class="am-select">
                <option v-for="t in TYPES" :key="t">{{ t }}</option>
              </select>
            </div>
            <div class="am-field">
              <label class="am-label">2级（模块）<span class="req">*</span></label>
              <input v-model="form.subtype" class="am-input" placeholder="如：逻辑判断" />
            </div>
            <div class="am-field">
              <label class="am-label">3级（可选）</label>
              <input v-model="form.subSubtype" class="am-input" placeholder="如：必然推理" />
            </div>
          </div>

          <!-- 题目 -->
          <div class="am-field">
            <label class="am-label">题目 <span class="req">*</span></label>
            <textarea
              v-model="form.question"
              class="am-textarea"
              rows="4"
              placeholder="请输入题目正文"
            />
          </div>

          <!-- 选项 -->
          <div class="am-field">
            <label class="am-label">选项（每行或用 | 分隔，可选）</label>
            <textarea v-model="form.options" class="am-textarea" rows="3"
              placeholder="A. 选项一&#10;B. 选项二&#10;C. 选项三&#10;D. 选项四" />
          </div>

          <!-- 答案 -->
          <div class="am-row am-row-2col">
            <div class="am-field">
              <label class="am-label">正确答案</label>
              <input v-model="form.answer" class="am-input" placeholder="如：A" />
            </div>
            <div class="am-field">
              <label class="am-label">我的答案</label>
              <input v-model="form.myAnswer" class="am-input" placeholder="如：B" />
            </div>
          </div>

          <!-- 错因 & 解析 -->
          <div class="am-field">
            <label class="am-label">错误原因</label>
            <input v-model="form.rootReason" class="am-input" placeholder="如：粗心看错题目" />
          </div>
          <div class="am-field">
            <label class="am-label">解析</label>
            <textarea v-model="form.analysis" class="am-textarea" rows="3"
              placeholder="解析内容…" />
          </div>
          <div class="am-field">
            <label class="am-label">下一步行动</label>
            <input v-model="form.nextAction" class="am-input" placeholder="如：回看公式" />
          </div>

          <!-- 状态 & 用时 -->
          <div class="am-field">
            <label class="am-label">关联知识节点</label>
            <select v-model="form.noteNodeId" class="am-select">
              <option value="">（不关联）</option>
              <option v-for="n in knowledgeLeaves" :key="n.id" :value="n.id">
                {{ leafLabel(n) }}
              </option>
            </select>
          </div>

          <div class="am-row am-row-3col">
            <div class="am-field">
              <label class="am-label">状态</label>
              <select v-model="form.status" class="am-select">
                <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div class="am-field">
              <label class="am-label">实际用时（秒）</label>
              <input v-model="form.actualDurationSec" class="am-input" type="number" min="0" placeholder="如：90" />
            </div>
            <div class="am-field">
              <label class="am-label">目标用时（秒）</label>
              <input v-model="form.targetDurationSec" class="am-input" type="number" min="0" placeholder="如：60" />
            </div>
          </div>

          <!-- 错误提示 -->
          <div v-if="errMsg" class="am-err">{{ errMsg }}</div>
        </div>

        <div class="am-footer">
          <button class="am-cancel" @click="emit('close')">取消</button>
          <button class="am-submit" :disabled="submitting" @click="submit">
            {{ submitting ? '保存中…' : '添加错题' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.am-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.am-modal {
  background: #fff;
  border-radius: 12px;
  width: min(620px, 96vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
}

.am-header {
  display: flex;
  align-items: center;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}
.am-title { font-size: 15px; font-weight: 700; color: #1e293b; flex: 1; }
.am-close {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: #f1f5f9; color: #475569;
  font-size: 16px; cursor: pointer;
}
.am-close:hover { background: #e2e8f0; }

.am-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.am-label {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 4px;
}
.req { color: #ef4444; }

.am-input, .am-select, .am-textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1.5px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  font-family: inherit;
  color: #1e293b;
  background: #fff;
  box-sizing: border-box;
  transition: border-color 0.12s;
}
.am-input:focus, .am-select:focus, .am-textarea:focus { border-color: #4a6cf7; }
.am-textarea { resize: vertical; min-height: 60px; }

.am-row { display: flex; gap: 10px; }
.am-row-2col .am-field { flex: 1; }
.am-row-3col .am-field { flex: 1; }

.am-field { display: flex; flex-direction: column; }

.am-err {
  padding: 8px 12px;
  background: #fff1f2;
  color: #dc2626;
  border-radius: 6px;
  font-size: 12.5px;
}

.am-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.am-cancel {
  padding: 8px 18px;
  border: 1.5px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  cursor: pointer;
}
.am-cancel:hover { background: #f8fafc; }

.am-submit {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  background: #4a6cf7;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.am-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.am-submit:not(:disabled):hover { background: #3a5ce5; }
</style>
