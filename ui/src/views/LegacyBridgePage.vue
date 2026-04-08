<template>
  <main class="login-shell legacy-bridge-shell">
    <section class="panel legacy-bridge-card">
      <div class="eyebrow">Legacy Bridge</div>
      <h1>{{ pageTitle }}</h1>
      <p>{{ pageDescription }}</p>
      <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
      <div class="login-footer">
        <a :href="targetHref">Open legacy page directly</a>
        <a href="/next/workspace">Back to preview home</a>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const errorMessage = ref('')

const pageTitle = computed(() => String(route.meta.title || 'Legacy bridge'))
const pageDescription = computed(() => String(route.meta.description || 'Switching to the real legacy capability.'))
const targetHref = computed(() => {
  const rawTarget = String(route.meta.target || '/')
  const [basePath, existingQuery = ''] = rawTarget.split('?', 2)
  const params = new URLSearchParams(existingQuery)
  const queryMap = (route.meta.queryMap ?? {}) as Record<string, string>

  for (const [sourceKey, targetKey] of Object.entries(queryMap)) {
    const rawValue = route.query[sourceKey]
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    if (typeof value === 'string' && value.trim()) {
      params.set(targetKey, value.trim())
    }
  }

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
})

onMounted(() => {
  try {
    window.location.replace(targetHref.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to open the legacy page'
  }
})
</script>
