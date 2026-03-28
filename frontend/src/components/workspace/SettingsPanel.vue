<script setup lang="ts">
import { ref, watch } from 'vue'

import { useSyncStore } from '@/stores/sync'
import { useWorkspaceStore } from '@/stores/workspace'

const workspaceStore = useWorkspaceStore()
const syncStore = useSyncStore()

const typeRulesText = ref('')
const dirTreeText = ref('')
const message = ref('')

watch(
  () => workspaceStore.typeRules,
  (value) => {
    typeRulesText.value = JSON.stringify(value ?? [], null, 2)
  },
  { immediate: true },
)

watch(
  () => workspaceStore.dirTree,
  (value) => {
    dirTreeText.value = JSON.stringify(value ?? {}, null, 2)
  },
  { immediate: true },
)

function saveTypeRules() {
  try {
    const parsed = JSON.parse(typeRulesText.value || '[]')
    workspaceStore.updateTypeRules(parsed)
    syncStore.enqueueOp('setting_upsert', 'type_rules', { key: 'type_rules', value: parsed })
    message.value = '题型规则已保存。'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '题型规则 JSON 格式有误。'
  }
}

function saveDirTree() {
  try {
    const parsed = JSON.parse(dirTreeText.value || '{}')
    workspaceStore.updateDirTree(parsed)
    syncStore.enqueueOp('setting_upsert', 'dir_tree', { key: 'dir_tree', value: parsed })
    message.value = '目录树已保存。'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '目录树 JSON 格式有误。'
  }
}
</script>

<template>
  <section class="panel transfer-panel">
    <header class="panel__header">
      <div>
        <h2>规则与目录</h2>
        <p class="panel__subtle">题型规则和目录树也会跟随工作区一起备份与同步。</p>
      </div>
    </header>

    <div class="transfer-grid">
      <article class="transfer-card">
        <h3>Type Rules</h3>
        <textarea v-model="typeRulesText" class="transfer-textarea" rows="18" />
        <div class="transfer-actions">
          <button class="ghost-button ghost-button--small" type="button" @click="saveTypeRules">保存题型规则</button>
        </div>
      </article>

      <article class="transfer-card">
        <h3>Dir Tree</h3>
        <textarea v-model="dirTreeText" class="transfer-textarea" rows="18" />
        <div class="transfer-actions">
          <button class="ghost-button ghost-button--small" type="button" @click="saveDirTree">保存目录树</button>
        </div>
      </article>
    </div>

    <div v-if="message" class="transfer-message">{{ message }}</div>
  </section>
</template>
