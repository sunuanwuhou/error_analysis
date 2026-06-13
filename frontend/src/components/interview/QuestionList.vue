<script setup lang="ts">
import { computed } from 'vue'
import {
  INTERVIEW_DIFFICULTY_LABELS,
  type InterviewCategory,
  type InterviewCategoryKey,
} from '@/data/interviewCategories'
import type { InterviewPracticeRecord, InterviewQuestion } from '@/api/interview'
import {
  hasPolishedAnswer,
  isReviewDue,
  type InterviewListFilter,
} from '@/lib/interviewReview'

const props = defineProps<{
  questions: InterviewQuestion[]
  categories: InterviewCategory[]
  labelForCategory: (id: string) => string
  selectedId: string | null
  selectedCategory: InterviewCategoryKey | ''
  listFilter: InterviewListFilter
  recordByQuestionId: Map<string, InterviewPracticeRecord>
}>()

const emit = defineEmits<{
  select: [id: string]
  'update:category': [cat: InterviewCategoryKey | '']
  'update:listFilter': [filter: InterviewListFilter]
  add: []
  import: []
  manageCategories: []
}>()

const categoryOptions = computed(() => [
  { key: '' as const, label: '全部题型' },
  ...props.categories.map((c) => ({ key: c.id as InterviewCategoryKey, label: c.label })),
])

const statusFilterOptions: { key: InterviewListFilter; label: string }[] = [
  { key: 'all', label: '全部状态' },
  { key: 'unpracticed', label: '未练' },
  { key: 'draft', label: '有草稿' },
  { key: 'polished', label: '有完整版' },
  { key: 'due_review', label: '今日待复习' },
]

function onCategoryChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value as InterviewCategoryKey | ''
  emit('update:category', v)
}

function onStatusFilterChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value as InterviewListFilter
  emit('update:listFilter', v)
}

function recordFor(id: string) {
  return props.recordByQuestionId.get(id)
}

function isDue(id: string) {
  return isReviewDue(recordFor(id))
}

function isPolished(id: string) {
  return hasPolishedAnswer(recordFor(id))
}

function isPracticed(id: string) {
  return props.recordByQuestionId.has(id)
}

function isStarred(id: string) {
  return recordFor(id)?.is_starred ?? false
}

const listHint = computed(() => {
  if (!props.questions.length) {
    if (props.listFilter === 'due_review') return '暂无到期复习'
    return '暂无题目'
  }
  return `共 ${props.questions.length} 题`
})
</script>

<template>
  <aside class="iv-sidebar">
    <div class="iv-sidebar-head">
      <div class="iv-sidebar-head-row">
        <h2 class="iv-sidebar-title">面试题库</h2>
        <div class="iv-sidebar-actions">
          <button type="button" class="iv-icon-btn" title="管理题型" @click="emit('manageCategories')">⚙</button>
          <button type="button" class="iv-icon-btn" title="新增题目" @click="emit('add')">＋</button>
          <button type="button" class="iv-icon-btn" title="批量导入" @click="emit('import')">⤓</button>
        </div>
      </div>
      <p class="iv-sidebar-sub">{{ listHint }}</p>
    </div>

    <label class="iv-filter-label">
      题型筛选
      <select class="iv-filter-select" :value="selectedCategory" @change="onCategoryChange">
        <option v-for="opt in categoryOptions" :key="opt.key || 'all'" :value="opt.key">
          {{ opt.label }}
        </option>
      </select>
    </label>

    <label class="iv-filter-label">
      练习状态
      <select class="iv-filter-select" :value="listFilter" @change="onStatusFilterChange">
        <option v-for="opt in statusFilterOptions" :key="opt.key" :value="opt.key">
          {{ opt.label }}
        </option>
      </select>
    </label>

    <ul class="iv-q-list">
      <li v-for="(q, idx) in questions" :key="q.id">
        <button
          type="button"
          class="iv-q-item"
          :class="{ 'iv-q-item--active': q.id === selectedId, 'iv-q-item--due': isDue(q.id) }"
          @click="emit('select', q.id)"
        >
          <span class="iv-q-item-top">
            <span class="iv-q-index">{{ idx + 1 }}</span>
            <span v-if="isDue(q.id)" class="iv-q-due" title="今日待复习">●</span>
            <span v-else-if="isStarred(q.id)" class="iv-q-star" title="已标星">★</span>
            <span v-else-if="isPolished(q.id)" class="iv-q-polished" title="有完整版">稿</span>
            <span v-else-if="isPracticed(q.id)" class="iv-q-done" title="已练草稿">✓</span>
          </span>
          <span class="iv-q-text">{{ q.question_text }}</span>
          <span class="iv-q-meta">
            <span class="iv-q-tag">{{ labelForCategory(q.category) }}</span>
            <span class="iv-q-diff">{{ INTERVIEW_DIFFICULTY_LABELS[q.difficulty] || '中等' }}</span>
          </span>
        </button>
      </li>
    </ul>

    <p v-if="!questions.length" class="iv-empty">
      {{ listFilter === 'due_review' ? '没有到期的复习题，继续写好完整版吧' : '该筛选下暂无题目' }}
    </p>
  </aside>
</template>

<style scoped>
.iv-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
}

.iv-sidebar-head {
  padding: 18px 16px 10px;
}

.iv-sidebar-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.iv-sidebar-actions {
  display: flex;
  gap: 4px;
}

.iv-icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
}

.iv-icon-btn:hover {
  border-color: #ea580c;
  color: #ea580c;
}

.iv-sidebar-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
}

.iv-sidebar-sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: #64748b;
}

.iv-filter-label {
  display: block;
  padding: 0 16px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.iv-filter-select {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  background: #fff;
}

.iv-q-list {
  list-style: none;
  margin: 0;
  padding: 0 10px 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.iv-q-item {
  display: block;
  width: 100%;
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, box-shadow 0.12s;
}

.iv-q-item:hover {
  border-color: #fdba74;
}

.iv-q-item--active {
  border-color: #ea580c;
  box-shadow: 0 0 0 1px rgb(234 88 12 / 0.15);
}

.iv-q-item--due {
  border-color: #fecaca;
}

.iv-q-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.iv-q-index {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
}

.iv-q-due {
  font-size: 10px;
  color: #dc2626;
}

.iv-q-star {
  font-size: 12px;
  color: #ea580c;
}

.iv-q-polished {
  font-size: 10px;
  font-weight: 700;
  color: #0369a1;
  padding: 0 4px;
  border-radius: 4px;
  background: #e0f2fe;
}

.iv-q-done {
  font-size: 11px;
  color: #059669;
  font-weight: 700;
}

.iv-q-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.45;
  color: #1e293b;
}

.iv-q-meta {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  font-size: 11px;
}

.iv-q-tag {
  padding: 2px 6px;
  border-radius: 4px;
  background: #ffedd5;
  color: #c2410c;
}

.iv-q-diff {
  color: #64748b;
}

.iv-empty {
  padding: 16px;
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
}
</style>
