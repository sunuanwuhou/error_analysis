<script setup lang="ts">
defineProps<{
  total: number
  focus: number
  review: number
  mastered: number
  topType: [string, number]
}>()
</script>

<template>
  <section class="summary-strip">
    <article class="summary-card">
      <span class="summary-card__label">错题总数</span>
      <strong class="summary-card__value">{{ total }}</strong>
    </article>
    <article class="summary-card">
      <span class="summary-card__label">重点复习</span>
      <strong class="summary-card__value">{{ focus }}</strong>
    </article>
    <article class="summary-card">
      <span class="summary-card__label">复习中</span>
      <strong class="summary-card__value">{{ review }}</strong>
    </article>
    <article class="summary-card">
      <span class="summary-card__label">已掌握</span>
      <strong class="summary-card__value">{{ mastered }}</strong>
    </article>
    <article class="summary-card summary-card--wide">
      <span class="summary-card__label">最高频题型</span>
      <strong class="summary-card__value">{{ topType[0] }}</strong>
      <span class="summary-card__hint">{{ topType[1] }} 题</span>
    </article>
  </section>
</template>
