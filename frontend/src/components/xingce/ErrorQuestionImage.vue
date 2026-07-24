<script setup lang="ts">
import { computed, ref } from 'vue'
import { normalizeErrorImageSrc } from '@/lib/errorImage'

const props = withDefaults(
  defineProps<{
    src?: unknown
    variant?: 'card' | 'quiz' | 'analysis'
    heavy?: boolean
    alt?: string
  }>(),
  {
    variant: 'card',
    heavy: false,
    alt: '题目图片',
  },
)

const expanded = ref(false)
const imageSrc = computed(() => normalizeErrorImageSrc(props.src))

function toggleExpand() {
  expanded.value = !expanded.value
}
</script>

<template>
  <div
    v-if="imageSrc"
    class="eq-img-wrap"
    :class="[`eq-img-wrap--${variant}`, { 'eq-img-wrap--heavy': heavy, 'eq-img-wrap--expanded': expanded }]"
  >
    <img
      :src="imageSrc"
      class="cuoti-img"
      :class="{ expanded, 'quiz-image-heavy': heavy && variant === 'quiz' }"
      loading="lazy"
      decoding="async"
      :alt="alt"
      @click="toggleExpand"
    />
    <div v-if="variant === 'quiz'" class="eq-img-actions">
      <button type="button" class="eq-img-btn" @click="toggleExpand">放大预览</button>
      <a class="eq-img-btn eq-img-link" :href="imageSrc" target="_blank" rel="noopener noreferrer">查看原图</a>
    </div>
  </div>
</template>

<style scoped>
.eq-img-wrap {
  max-width: 100%;
}
.eq-img-wrap--quiz {
  margin: 0;
  max-width: 100%;
}
.eq-img-wrap--quiz .cuoti-img {
  margin: 0;
  width: 100%;
  max-width: 100%;
  max-height: 480px;
  object-fit: contain;
  background: #fff;
}
.eq-img-wrap--heavy .cuoti-img,
.eq-img-wrap--quiz.is-image-heavy .cuoti-img {
  max-height: 480px;
}
.eq-img-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.eq-img-btn {
  font-size: 11px;
  padding: 4px 10px;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  background: #fff;
  color: #4a6cf7;
  cursor: pointer;
  text-decoration: none;
}
.eq-img-btn:hover {
  background: #eef2ff;
}
.eq-img-link {
  display: inline-flex;
  align-items: center;
}
</style>
