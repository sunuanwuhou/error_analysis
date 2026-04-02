<script setup lang="ts">
defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <teleport to="body">
    <div v-if="open" class="workspace-mobile-drawer">
      <div class="workspace-mobile-drawer__mask" @click="emit('close')"></div>
      <aside class="workspace-mobile-drawer__panel">
        <div class="workspace-mobile-drawer__header">
          <strong>工作台目录</strong>
          <button class="workspace-modal__close workspace-modal__close--inline" type="button" @click="emit('close')">×</button>
        </div>
        <div class="workspace-mobile-drawer__body">
          <slot />
        </div>
      </aside>
    </div>
  </teleport>
</template>
