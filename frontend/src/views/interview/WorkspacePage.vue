<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useInterviewStore } from '@/stores/interviewStore'
import QuestionList from '@/components/interview/QuestionList.vue'
import QuestionDetail from '@/components/interview/QuestionDetail.vue'
import QuestionFormModal from '@/components/interview/QuestionFormModal.vue'
import ImportModal from '@/components/interview/ImportModal.vue'
import CategoryManageModal from '@/components/interview/CategoryManageModal.vue'
import { savePortalLastModule } from '@/lib/portalPrefs'
import type { InterviewCategoryKey } from '@/data/interviewCategories'
import type { InterviewQuestionInput } from '@/api/interview'

const store = useInterviewStore()
const {
  questions,
  categories,
  selectedCategory,
  selectedQuestionId,
  selectedQuestion,
  selectedRecord,
  recordByQuestionId,
  listFilter,
  filteredQuestions,
  dueReviewCount,
  loading,
  loadError,
  saving,
  saveError,
  questionSaving,
} = storeToRefs(store)

const showFormModal = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const showImportModal = ref(false)
const showCategoryModal = ref(false)

onMounted(async () => {
  savePortalLastModule('interview')
  await store.loadAll()
})

async function onCategoryChange(cat: InterviewCategoryKey | '') {
  await store.setCategory(cat)
}

function onSelect(id: string) {
  store.selectQuestion(id)
}

async function onSave(payload: {
  my_answer: string
  polished_answer: string
  note: string
  is_starred: boolean
}) {
  await store.saveRecord(payload)
}

async function onReview(rating: 'smooth' | 'ok' | 'forgot') {
  const qid = selectedQuestionId.value
  if (!qid) return
  try {
    await store.submitReview(qid, rating)
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '复习记录失败')
  }
}

function onListFilterChange(filter: typeof listFilter.value) {
  store.setListFilter(filter)
}

function openCreate() {
  if (!categories.value.length) {
    window.alert('请先通过「管理题型」添加至少一种题型')
    showCategoryModal.value = true
    return
  }
  formMode.value = 'create'
  showFormModal.value = true
}

function openEdit() {
  if (!selectedQuestion.value) return
  formMode.value = 'edit'
  showFormModal.value = true
}

async function onFormSave(payload: InterviewQuestionInput) {
  try {
    if (formMode.value === 'edit' && selectedQuestion.value) {
      await store.updateQuestion(selectedQuestion.value.id, payload)
    } else {
      await store.createQuestion(payload)
    }
    showFormModal.value = false
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '保存题目失败')
  }
}

async function onDeleteQuestion() {
  const q = selectedQuestion.value
  if (!q) return
  if (!window.confirm(`确定删除题目？\n\n${q.question_text.slice(0, 80)}${q.question_text.length > 80 ? '…' : ''}`)) {
    return
  }
  try {
    await store.deleteQuestion(q.id)
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '删除失败')
  }
}
</script>

<template>
  <div class="iv-workspace">
    <header class="iv-topbar">
      <div class="iv-topbar-row">
        <div class="iv-topbar-brand">
          <RouterLink class="iv-topbar-home" :to="{ name: 'ModulePortal', query: { portal: '1' } }">
            模块首页
          </RouterLink>
          <span class="iv-topbar-sep">/</span>
          <span class="iv-topbar-title">公务员面试</span>
        </div>
        <div class="iv-topbar-actions">
          <button
            v-if="dueReviewCount > 0"
            type="button"
            class="iv-topbar-btn iv-topbar-btn--review"
            @click="store.selectFirstDueReview()"
          >
            今日待复习 {{ dueReviewCount }}
          </button>
          <button type="button" class="iv-topbar-btn" @click="openCreate">新增题目</button>
          <button type="button" class="iv-topbar-btn iv-topbar-btn--ghost" @click="showCategoryModal = true">
            管理题型
          </button>
          <button type="button" class="iv-topbar-btn iv-topbar-btn--ghost" @click="showImportModal = true">
            批量导入
          </button>
        </div>
      </div>
      <p class="iv-topbar-sub">结构化面试 · 完整版口播稿 · 间隔复习</p>
    </header>

    <div v-if="loading" class="iv-state">正在加载题库…</div>
    <div v-else-if="loadError" class="iv-state iv-state--error">
      {{ loadError }}
      <button type="button" class="iv-retry" @click="store.loadAll()">重试</button>
    </div>

    <div v-else-if="!questions.length" class="iv-state iv-state--empty">
      <p>题库还是空的，点击「新增题目」或「批量导入」开始录入。</p>
      <div class="iv-empty-actions">
        <button type="button" class="iv-topbar-btn" @click="openCreate">新增题目</button>
        <button type="button" class="iv-topbar-btn iv-topbar-btn--ghost" @click="showImportModal = true">
          批量导入
        </button>
      </div>
    </div>

    <div v-else class="iv-layout">
      <QuestionList
        class="iv-layout-sidebar"
        :questions="filteredQuestions"
        :categories="categories"
        :label-for-category="store.labelForCategory"
        :selected-id="selectedQuestionId"
        :selected-category="selectedCategory"
        :list-filter="listFilter"
        :record-by-question-id="recordByQuestionId"
        @select="onSelect"
        @update:category="onCategoryChange"
        @update:list-filter="onListFilterChange"
        @add="openCreate"
        @import="showImportModal = true"
        @manage-categories="showCategoryModal = true"
      />
      <QuestionDetail
        class="iv-layout-main"
        :question="selectedQuestion"
        :record="selectedRecord"
        :label-for-category="store.labelForCategory"
        :saving="saving"
        :save-error="saveError"
        @save="onSave"
        @review="onReview"
        @edit="openEdit"
        @delete="onDeleteQuestion"
      />
    </div>

    <QuestionFormModal
      :open="showFormModal"
      :mode="formMode"
      :question="selectedQuestion"
      :categories="categories"
      :saving="questionSaving"
      @close="showFormModal = false"
      @save="onFormSave"
    />

    <ImportModal v-if="showImportModal" @close="showImportModal = false" @imported="showImportModal = false" />
    <CategoryManageModal v-if="showCategoryModal" @close="showCategoryModal = false" />
  </div>
</template>

<style scoped>
.iv-workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 100vh;
  background: #f1f5f9;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

.iv-topbar {
  flex-shrink: 0;
  padding: 14px 20px 12px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.iv-topbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.iv-topbar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.iv-topbar-actions {
  display: flex;
  gap: 8px;
}

.iv-topbar-btn {
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #ea580c, #c2410c);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.iv-topbar-btn--ghost {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
}

.iv-topbar-btn--review {
  border: 1px solid #fca5a5;
  background: #fef2f2;
  color: #b91c1c;
}

.iv-topbar-btn--review:hover {
  border-color: #f87171;
}

.iv-topbar-home {
  color: #64748b;
  text-decoration: none;
}

.iv-topbar-home:hover {
  color: #ea580c;
}

.iv-topbar-sep {
  color: #cbd5e1;
}

.iv-topbar-title {
  font-weight: 800;
  color: #0f172a;
}

.iv-topbar-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.iv-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
  color: #64748b;
}

.iv-state--error {
  color: #dc2626;
}

.iv-state--empty p {
  margin: 0;
}

.iv-empty-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.iv-retry {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.iv-layout {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(280px, 340px) 1fr;
  min-height: 0;
}

.iv-layout-sidebar {
  min-height: 0;
}

.iv-layout-main {
  min-height: 0;
}

@media (max-width: 860px) {
  .iv-layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(240px, 38vh) 1fr;
  }
}
</style>
