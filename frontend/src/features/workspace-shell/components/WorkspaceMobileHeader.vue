<script setup lang="ts">
import { WORKSPACE_TAB_LABELS, type WorkspaceTab } from '@/features/workspace-shell/constants/workspace-shell'

const props = defineProps<{
  activeTab: WorkspaceTab
  selectedNodeTitle: string
}>()

const emit = defineEmits<{
  'open-sidebar': []
  'open-create': []
}>()
</script>

<template>
  <header class="workspace-mobile-header panel">
    <div class="workspace-mobile-header__top">
      <button class="ghost-button ghost-button--small" type="button" @click="emit('open-sidebar')">目录</button>
      <div class="workspace-mobile-header__title-group">
        <div class="workspace-mobile-header__eyebrow">{{ WORKSPACE_TAB_LABELS[props.activeTab] }}</div>
        <strong class="workspace-mobile-header__title">{{ props.selectedNodeTitle }}</strong>
      </div>
      <button class="ghost-button ghost-button--small ghost-button--accent" type="button" @click="emit('open-create')">
        录题
      </button>
    </div>
  </header>
</template>
