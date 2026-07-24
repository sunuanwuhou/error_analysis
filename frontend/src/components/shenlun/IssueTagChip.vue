<script setup lang="ts">
import { issueTagClass } from '@/lib/shenlunIssues'

defineProps<{
  tag: string
  active?: boolean
  size?: 'sm' | 'md'
}>()

defineEmits<{
  click: [ev: MouseEvent]
}>()
</script>

<template>
  <button
    type="button"
    :class="[issueTagClass(tag), size === 'sm' ? 'sl-issue-tag--sm' : '', active ? 'sl-issue-tag--active' : '']"
    @click="$emit('click', $event)"
  >
    {{ tag }}
  </button>
</template>

<style scoped>
.sl-issue-tag {
  display: inline-flex;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  cursor: pointer;
  background: #f3f4f6;
  color: #374151;
  transition: filter 0.12s, box-shadow 0.12s;
}
.sl-issue-tag--sm {
  font-size: 11px;
  padding: 2px 8px;
}
.sl-issue-tag:hover {
  filter: brightness(0.97);
}
.sl-issue-tag--active {
  box-shadow: 0 0 0 2px rgb(37 99 235 / 0.35);
}
.sl-issue-tag--miss {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}
.sl-issue-tag--wrong {
  background: #fff7ed;
  color: #c2410c;
  border-color: #fed7aa;
}
.sl-issue-tag--vague {
  background: #fefce8;
  color: #a16207;
  border-color: #fef08a;
}
.sl-issue-tag--copy {
  background: #f5f3ff;
  color: #6d28d9;
  border-color: #ddd6fe;
}
.sl-issue-tag--default {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}
</style>
