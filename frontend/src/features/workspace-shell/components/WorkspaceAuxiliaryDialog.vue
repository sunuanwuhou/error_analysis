<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <teleport to="body">
    <div v-if="open" class="workspace-modal-mask" @click.self="emit('close')">
      <div class="workspace-modal workspace-modal--wide workspace-modal--responsive-sheet">
        <button class="workspace-modal__close" type="button" @click="emit('close')">×</button>
        <div class="workspace-modal__panel-label">{{ title }}</div>
        <slot />
      </div>
    </div>
  </teleport>
</template>
