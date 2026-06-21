<script setup lang="ts">
import { computed } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import { countEligibleRandomQuestions } from '@/lib/randomQuestionPick'

const store = useXingceStore()

const dailyBadge = computed(() => store.quizBadge || 0)
const fullBadge = computed(() => store.eligibleFullPracticeCount)
const randomQuestionBadge = computed(() =>
  countEligibleRandomQuestions(store.workspaceErrors),
)

const emit = defineEmits<{
  startQuiz: [mode: 'daily' | 'full' | 'review' | 'retrain']
  startRandomNote: []
  startRandomQuestion: []
}>()
</script>

<template>
  <div class="practice-action-bar">
    <button
      type="button"
      class="quiz-btn quiz-btn--compact"
      data-testid="practice-daily"
      @click="emit('startQuiz', 'daily')"
    >
      <span>今日训练</span>
      <span class="badge">{{ dailyBadge }}</span>
    </button>
    <button
      type="button"
      class="quiz-btn quiz-btn--compact full-practice"
      data-testid="practice-full"
      @click="emit('startQuiz', 'full')"
    >
      <span>全量练习</span>
      <span class="badge">{{ fullBadge }}</span>
    </button>
    <button
      type="button"
      class="quiz-btn quiz-btn--compact random-question"
      data-testid="practice-random-question"
      @click="emit('startRandomQuestion')"
    >
      <span>随机题目</span>
      <span class="badge">{{ randomQuestionBadge }}</span>
    </button>
    <button
      type="button"
      class="quiz-btn quiz-btn--compact random-note"
      data-testid="practice-random-note"
      @click="emit('startRandomNote')"
    >
      <span>随机笔记</span>
    </button>
  </div>
</template>
