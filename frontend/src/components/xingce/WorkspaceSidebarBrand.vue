<script setup lang="ts">
import { computed } from 'vue'

const runtimeLabel = computed(() => {
  if (typeof window === 'undefined') return 'unknown'
  const { hostname, port } = window.location
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return port ? `${hostname}:${port}` : hostname
  }
  return hostname
})
</script>

<template>
  <div class="wsb">
    <div class="wsb-title">Ashore</div>
    <div class="wsb-badge" data-mode="local">Runtime: {{ runtimeLabel }}</div>
  </div>
</template>

<style scoped>
.wsb {
  padding: 16px 14px 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}
.wsb-title {
  font-size: 15px;
  font-weight: 700;
  color: #2c3e50;
  letter-spacing: 0.2px;
}
.wsb-badge {
  font-size: 10px;
  line-height: 1.3;
  color: #8a5a1c;
  background: #fff4e3;
  border: 1px solid #f0d8b4;
  border-radius: 6px;
  padding: 2px 8px;
  width: fit-content;
  max-width: 100%;
  word-break: break-all;
}
</style>
