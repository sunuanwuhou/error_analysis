<script setup lang="ts">
import { WORKSPACE_TAB_LABELS, type WorkspaceTab } from '@/features/workspace-shell/constants/workspace-shell'

const props = defineProps<{
  modelValue: WorkspaceTab
}>()

const emit = defineEmits<{
  'update:modelValue': [value: WorkspaceTab]
}>()

const tabs: WorkspaceTab[] = ['notes', 'errors', 'practice']
</script>

<template>
  <nav class="workspace-mobile-tabbar panel" aria-label="工作区切换">
    <button
      v-for="tab in tabs"
      :key="tab"
      class="workspace-mobile-tabbar__item"
      :class="{ 'is-active': props.modelValue === tab }"
      type="button"
      @click="emit('update:modelValue', tab)"
    >
      {{ WORKSPACE_TAB_LABELS[tab] }}
    </button>
  </nav>
</template>
