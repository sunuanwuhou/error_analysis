<script setup lang="ts">
type WorkspaceTab = 'notes' | 'errors' | 'practice'
type StatusFilter = 'all' | 'focus' | 'review' | 'mastered'

defineProps<{
  modelValue: WorkspaceTab
  search: string
  statusFilter: StatusFilter
}>()

const emit = defineEmits<{
  'update:modelValue': [value: WorkspaceTab]
  'update:search': [value: string]
  'update:statusFilter': [value: StatusFilter]
  'open-full-practice': []
}>()

const primaryTabs: Array<{ key: WorkspaceTab; label: string }> = [
  { key: 'notes', label: '知识工作区' },
  { key: 'errors', label: '错题列表' },
  { key: 'practice', label: '每日练习' },
]

const statusOptions: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '全部题目' },
  { key: 'focus', label: '重点复习' },
  { key: 'review', label: '复习中' },
  { key: 'mastered', label: '已掌握' },
]
</script>

<template>
  <section class="workspace-toolbar panel">
    <div class="workspace-toolbar__row">
      <div class="workspace-tabs">
        <button
          v-for="tab in primaryTabs"
          :key="tab.key"
          class="workspace-tab"
          :class="{ 'is-active': modelValue === tab.key }"
          type="button"
          @click="emit('update:modelValue', tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="workspace-toolbar__search">
        <div class="workspace-search-box">
          <span class="workspace-search-box__icon">🔍</span>
          <input
            class="workspace-search"
            :value="search"
            type="text"
            placeholder="搜索题目、题型、错因、解析"
            @input="emit('update:search', ($event.target as HTMLInputElement).value)"
          />
          <button
            v-if="search"
            class="workspace-search-box__clear"
            type="button"
            @click="emit('update:search', '')"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <div class="workspace-toolbar__row workspace-toolbar__row--secondary">
      <div class="workspace-toolbar__filters">
        <button
          v-for="option in statusOptions"
          :key="option.key"
          class="ghost-button ghost-button--small"
          :class="{ 'ghost-button--active': statusFilter === option.key }"
          type="button"
          @click="emit('update:statusFilter', option.key)"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="workspace-toolbar__actions">
        <button class="ghost-button ghost-button--small ghost-button--accent" type="button" @click="emit('open-full-practice')">
          全量练习
        </button>
      </div>
    </div>
  </section>
</template>
