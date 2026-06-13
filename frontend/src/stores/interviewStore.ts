import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  interviewApi,
  type InterviewPracticeRecord,
  type InterviewQuestion,
  type InterviewQuestionInput,
} from '@/api/interview'
import {
  categoryLabel,
  type InterviewCategory,
  type InterviewCategoryKey,
} from '@/data/interviewCategories'
import {
  isReviewDue,
  matchesListFilter,
  type InterviewListFilter,
  type InterviewReviewRating,
} from '@/lib/interviewReview'

export const useInterviewStore = defineStore('interview', () => {
  const categories = ref<InterviewCategory[]>([])
  const questions = ref<InterviewQuestion[]>([])
  const records = ref<InterviewPracticeRecord[]>([])
  const selectedCategory = ref<InterviewCategoryKey | ''>('')
  const selectedQuestionId = ref<string | null>(null)
  const listFilter = ref<InterviewListFilter>('all')

  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const questionSaving = ref(false)
  const categorySaving = ref(false)

  const categoryLabelMap = computed(() => {
    const map = new Map<string, string>()
    for (const c of categories.value) map.set(c.id, c.label)
    return map
  })

  function labelForCategory(id: string) {
    return categoryLabel(id, categories.value)
  }

  const recordByQuestionId = computed(() => {
    const map = new Map<string, InterviewPracticeRecord>()
    for (const r of records.value) map.set(r.question_id, r)
    return map
  })

  const selectedQuestion = computed(() =>
    questions.value.find((q) => q.id === selectedQuestionId.value) ?? null,
  )

  const selectedRecord = computed(() => {
    const id = selectedQuestionId.value
    if (!id) return null
    return recordByQuestionId.value.get(id) ?? null
  })

  const practicedQuestionIds = computed(() => new Set(records.value.map((r) => r.question_id)))

  const dueReviewCount = computed(
    () => records.value.filter((r) => isReviewDue(r)).length,
  )

  const filteredQuestions = computed(() => {
    const map = recordByQuestionId.value
    return questions.value.filter((q) => matchesListFilter(listFilter.value, map.get(q.id)))
  })

  function setListFilter(filter: InterviewListFilter) {
    listFilter.value = filter
    const ids = filteredQuestions.value.map((q) => q.id)
    if (selectedQuestionId.value && ids.includes(selectedQuestionId.value)) return
    selectedQuestionId.value = ids[0] ?? null
  }

  function selectFirstDueReview() {
    setListFilter('due_review')
  }

  function upsertQuestionInList(q: InterviewQuestion) {
    const idx = questions.value.findIndex((x) => x.id === q.id)
    if (idx >= 0) questions.value[idx] = q
    else questions.value.push(q)
    questions.value.sort((a, b) => {
      const ao = categories.value.find((c) => c.id === a.category)?.sort_order ?? 0
      const bo = categories.value.find((c) => c.id === b.category)?.sort_order ?? 0
      if (ao !== bo) return ao - bo
      return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
    })
  }

  async function loadCategories() {
    const res = await interviewApi.listCategories()
    categories.value = res.items
  }

  async function loadAll() {
    loading.value = true
    loadError.value = null
    try {
      const [cRes, qRes, rRes] = await Promise.all([
        interviewApi.listCategories(),
        interviewApi.listQuestions(selectedCategory.value || undefined),
        interviewApi.listRecords(),
      ])
      categories.value = cRes.items
      questions.value = qRes.items
      records.value = rRes.items
      if (questions.value.length && !selectedQuestionId.value) {
        selectedQuestionId.value = questions.value[0].id
      } else if (
        selectedQuestionId.value &&
        !questions.value.some((q) => q.id === selectedQuestionId.value)
      ) {
        selectedQuestionId.value = questions.value[0]?.id ?? null
      }
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : '加载失败'
    } finally {
      loading.value = false
    }
  }

  async function setCategory(cat: InterviewCategoryKey | '') {
    selectedCategory.value = cat
    await loadAll()
  }

  function selectQuestion(id: string) {
    selectedQuestionId.value = id
  }

  async function createCategory(label: string) {
    categorySaving.value = true
    try {
      const res = await interviewApi.createCategory({ label: label.trim() })
      categories.value = [...categories.value, res.category].sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
      )
      return res.category
    } finally {
      categorySaving.value = false
    }
  }

  async function updateCategory(categoryId: string, label: string) {
    categorySaving.value = true
    try {
      const res = await interviewApi.updateCategory(categoryId, { label: label.trim() })
      const idx = categories.value.findIndex((c) => c.id === categoryId)
      if (idx >= 0) categories.value[idx] = res.category
      categories.value.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
      return res.category
    } finally {
      categorySaving.value = false
    }
  }

  async function deleteCategory(categoryId: string) {
    await interviewApi.deleteCategory(categoryId)
    categories.value = categories.value.filter((c) => c.id !== categoryId)
    if (selectedCategory.value === categoryId) {
      selectedCategory.value = ''
      await loadAll()
    }
  }

  async function createQuestion(data: InterviewQuestionInput) {
    questionSaving.value = true
    try {
      const res = await interviewApi.createQuestion(data)
      upsertQuestionInList(res.question)
      selectedQuestionId.value = res.question.id
      await loadCategories()
      return res.question
    } finally {
      questionSaving.value = false
    }
  }

  async function updateQuestion(questionId: string, data: InterviewQuestionInput) {
    questionSaving.value = true
    try {
      const res = await interviewApi.updateQuestion(questionId, data)
      upsertQuestionInList(res.question)
      await loadCategories()
      return res.question
    } finally {
      questionSaving.value = false
    }
  }

  async function deleteQuestion(questionId: string) {
    await interviewApi.deleteQuestion(questionId)
    questions.value = questions.value.filter((q) => q.id !== questionId)
    records.value = records.value.filter((r) => r.question_id !== questionId)
    if (selectedQuestionId.value === questionId) {
      selectedQuestionId.value = questions.value[0]?.id ?? null
    }
    await loadCategories()
  }

  async function importQuestions(payload: { format: 'json' | 'markdown'; content: string }) {
    const res = await interviewApi.importQuestions(payload)
    await loadAll()
    if (res.items.length) {
      selectedQuestionId.value = res.items[res.items.length - 1].id
    }
    return res
  }

  async function saveRecord(payload: {
    my_answer: string
    polished_answer: string
    note: string
    is_starred: boolean
  }) {
    const qid = selectedQuestionId.value
    if (!qid) return
    saving.value = true
    saveError.value = null
    try {
      const res = await interviewApi.upsertRecord({
        question_id: qid,
        my_answer: payload.my_answer,
        polished_answer: payload.polished_answer,
        note: payload.note,
        is_starred: payload.is_starred,
      })
      const idx = records.value.findIndex((r) => r.question_id === qid)
      if (idx >= 0) records.value[idx] = res.record
      else records.value.unshift(res.record)
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : '保存失败'
      throw e
    } finally {
      saving.value = false
    }
  }

  async function submitReview(questionId: string, rating: InterviewReviewRating) {
    saving.value = true
    saveError.value = null
    try {
      const res = await interviewApi.submitReview({ question_id: questionId, rating })
      const idx = records.value.findIndex((r) => r.question_id === questionId)
      if (idx >= 0) records.value[idx] = res.record
      else records.value.unshift(res.record)
      return res.record
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : '复习记录失败'
      throw e
    } finally {
      saving.value = false
    }
  }

  return {
    categories,
    questions,
    records,
    selectedCategory,
    selectedQuestionId,
    listFilter,
    loading,
    loadError,
    saving,
    saveError,
    questionSaving,
    categorySaving,
    categoryLabelMap,
    labelForCategory,
    recordByQuestionId,
    selectedQuestion,
    selectedRecord,
    practicedQuestionIds,
    dueReviewCount,
    filteredQuestions,
    loadCategories,
    loadAll,
    setCategory,
    selectQuestion,
    setListFilter,
    selectFirstDueReview,
    createCategory,
    updateCategory,
    deleteCategory,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    importQuestions,
    saveRecord,
    submitReview,
  }
})
