<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { INTERVIEW_DIFFICULTY_LABELS, type InterviewCategory, type InterviewCategoryKey } from '@/data/interviewCategories'
import type { InterviewQuestion, InterviewQuestionInput } from '@/api/interview'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  question: InterviewQuestion | null
  categories: InterviewCategory[]
  saving: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [payload: InterviewQuestionInput]
}>()

const category = ref<InterviewCategoryKey>('comprehensive')
const difficulty = ref(2)
const questionText = ref('')
const framework = ref('')
const sampleAnswer = ref('')
const source = ref('')

const title = computed(() => (props.mode === 'create' ? '新增题目' : '编辑题目'))

watch(
  () => [props.open, props.question, props.mode] as const,
  () => {
    if (!props.open) return
    if (props.mode === 'edit' && props.question) {
      category.value = props.question.category
      difficulty.value = props.question.difficulty
      questionText.value = props.question.question_text
      framework.value = props.question.framework
      sampleAnswer.value = props.question.sample_answer
      source.value = props.question.source
    } else {
      category.value = (props.categories[0]?.id as InterviewCategoryKey) || 'comprehensive'
      difficulty.value = 2
      questionText.value = ''
      framework.value = ''
      sampleAnswer.value = ''
      source.value = ''
    }
  },
  { immediate: true },
)

function submit() {
  const qtext = questionText.value.trim()
  if (!qtext) {
    window.alert('请填写题干')
    return
  }
  emit('save', {
    category: category.value,
    difficulty: difficulty.value,
    question_text: qtext,
    framework: framework.value.trim(),
    sample_answer: sampleAnswer.value.trim(),
    source: source.value.trim(),
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="ivf-backdrop" @click.self="emit('close')">
      <div class="ivf-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <div class="ivf-head">
          <h2 class="ivf-title">{{ title }}</h2>
          <button type="button" class="ivf-close" @click="emit('close')">×</button>
        </div>
        <div class="ivf-body">
          <label class="ivf-field">
            题干 <span class="ivf-req">*</span>
            <textarea v-model="questionText" rows="4" placeholder="面试题目原文…" />
          </label>

          <div class="ivf-row">
            <label class="ivf-field ivf-field--half">
              题型
              <select v-model="category">
                <option v-for="c in categories" :key="c.id" :value="c.id">
                  {{ c.label }}
                </option>
              </select>
            </label>
            <label class="ivf-field ivf-field--half">
              难度
              <select v-model.number="difficulty">
                <option v-for="(label, n) in INTERVIEW_DIFFICULTY_LABELS" :key="n" :value="Number(n)">
                  {{ label }}
                </option>
              </select>
            </label>
          </div>

          <label class="ivf-field">
            来源
            <input v-model="source" type="text" placeholder="如：2024 国考 / 自拟" />
          </label>

          <label class="ivf-field">
            答题框架
            <textarea v-model="framework" rows="5" placeholder="分点列出答题结构…" />
          </label>

          <label class="ivf-field">
            参考答案
            <textarea v-model="sampleAnswer" rows="5" placeholder="示范作答要点…" />
          </label>
        </div>
        <div class="ivf-foot">
          <button type="button" class="ivf-btn" @click="emit('close')">取消</button>
          <button type="button" class="ivf-btn ivf-btn--primary" :disabled="saving" @click="submit">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ivf-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}

.ivf-modal {
  width: min(560px, 96vw);
  max-height: 92vh;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 60px rgb(15 23 42 / 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ivf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e2e8f0;
}

.ivf-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}

.ivf-close {
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 18px;
}

.ivf-body {
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ivf-row {
  display: flex;
  gap: 12px;
}

.ivf-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  flex: 1;
}

.ivf-field--half {
  flex: 1;
  min-width: 0;
}

.ivf-req {
  color: #dc2626;
}

.ivf-field textarea,
.ivf-field input,
.ivf-field select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 400;
  box-sizing: border-box;
}

.ivf-field textarea {
  resize: vertical;
  line-height: 1.55;
}

.ivf-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 16px;
  border-top: 1px solid #e2e8f0;
}

.ivf-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ivf-btn--primary {
  border: none;
  background: linear-gradient(135deg, #ea580c, #c2410c);
  color: #fff;
}

.ivf-btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
