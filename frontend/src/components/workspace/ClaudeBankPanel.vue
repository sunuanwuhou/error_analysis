<script setup lang="ts">
import ErrorList from '@/components/errors/ErrorList.vue'
import type { ErrorEntry } from '@/types/workspace'

defineProps<{
  items: ErrorEntry[]
}>()
</script>

<template>
  <ErrorList :items="items" title="Claude题库" bank-mode />
</template>
