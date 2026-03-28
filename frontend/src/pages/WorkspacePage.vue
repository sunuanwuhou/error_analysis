<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import CloudStatusBar from '@/components/cloud/CloudStatusBar.vue'
import ErrorList from '@/components/errors/ErrorList.vue'
import KnowledgeWorkspace from '@/components/knowledge/KnowledgeWorkspace.vue'
import KnowledgeTree from '@/components/sidebar/KnowledgeTree.vue'
import AiWorkbenchPanel from '@/components/workspace/AiWorkbenchPanel.vue'
import ClaudeBankPanel from '@/components/workspace/ClaudeBankPanel.vue'
import CodexInboxPanel from '@/components/workspace/CodexInboxPanel.vue'
import DataTransferPanel from '@/components/workspace/DataTransferPanel.vue'
import PracticePanel from '@/components/workspace/PracticePanel.vue'
import QuickCreatePanel from '@/components/workspace/QuickCreatePanel.vue'
import SettingsPanel from '@/components/workspace/SettingsPanel.vue'
import StatsPanel from '@/components/workspace/StatsPanel.vue'
import WorkspaceToolbar from '@/components/workspace/WorkspaceToolbar.vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useWorkspaceStore } from '@/stores/workspace'

type WorkspaceTab = 'notes' | 'errors' | 'practice'
type AuxiliaryPanel = '' | 'claude' | 'ai' | 'stats' | 'settings' | 'transfer' | 'codex'
type PracticePreset = 'daily' | 'current' | 'full'

const authStore = useAuthStore()
const syncStore = useSyncStore()
const workspaceStore = useWorkspaceStore()

const activeTab = ref<WorkspaceTab>('notes')
const practicePreset = ref<PracticePreset>('daily')
const quickCreateOpen = ref(false)
const auxiliaryPanel = ref<AuxiliaryPanel>('')

function handleTabChange(value: WorkspaceTab) {
  activeTab.value = value
  if (value === 'practice') {
    practicePreset.value = 'daily'
  }
}

const auxiliaryPanelTitle = computed(() => {
  const titleMap: Record<Exclude<AuxiliaryPanel, ''>, string> = {
    claude: 'Claude题库',
    ai: 'AI工作台',
    stats: '统计',
    settings: '规则目录',
    transfer: '导入导出',
    codex: 'Codex',
  }
  return auxiliaryPanel.value ? titleMap[auxiliaryPanel.value] : ''
})

onMounted(async () => {
  await authStore.loadSession()
  syncStore.restorePendingOps()
  syncStore.startBackgroundSync()
  const backup = await workspaceStore.loadBackup()
  void syncStore.pushOriginStatus({
    lastLoadedAt: backup?.updatedAt || '',
    lastBackupUpdatedAt: backup?.updatedAt || '',
  })
})
</script>

<template>
  <main class="workspace-shell workspace-shell--legacy">
    <section class="workspace-left-column">
      <CloudStatusBar sidebar @open-create="quickCreateOpen = true" @open-panel="auxiliaryPanel = $event" />

      <KnowledgeTree
        :nodes="workspaceStore.knowledgeTree"
        :selected-id="workspaceStore.selectedKnowledgeNodeId"
        @select="workspaceStore.selectKnowledgeNode"
      />
    </section>

    <section class="workspace-main-area">
      <WorkspaceToolbar
        :model-value="activeTab"
        :search="workspaceStore.searchQuery"
        :status-filter="workspaceStore.statusFilter"
        @update:model-value="handleTabChange"
        @update:search="workspaceStore.setSearchQuery"
        @update:status-filter="workspaceStore.setStatusFilter"
        @open-full-practice="
          activeTab = 'practice';
          practicePreset = 'full'
        "
      />

      <section class="workspace-main">
        <KnowledgeWorkspace
          v-if="activeTab === 'notes'"
          @open-create="quickCreateOpen = true"
          @open-transfer="auxiliaryPanel = 'transfer'"
        />
        <ErrorList v-else-if="activeTab === 'errors'" :items="workspaceStore.relatedErrors" title="错题列表" />
        <PracticePanel v-else :preset="practicePreset" />
      </section>
    </section>

    <div v-if="quickCreateOpen" class="workspace-modal-mask" @click.self="quickCreateOpen = false">
      <div class="workspace-modal workspace-modal--wide">
        <button class="workspace-modal__close" type="button" @click="quickCreateOpen = false">×</button>
        <QuickCreatePanel />
      </div>
    </div>

    <div v-if="auxiliaryPanel" class="workspace-modal-mask" @click.self="auxiliaryPanel = ''">
      <div class="workspace-modal workspace-modal--wide">
        <button class="workspace-modal__close" type="button" @click="auxiliaryPanel = ''">×</button>
        <div class="workspace-modal__panel-label">{{ auxiliaryPanelTitle }}</div>
        <ClaudeBankPanel v-if="auxiliaryPanel === 'claude'" :items="workspaceStore.filteredClaudeBank" />
        <AiWorkbenchPanel v-else-if="auxiliaryPanel === 'ai'" />
        <StatsPanel v-else-if="auxiliaryPanel === 'stats'" :items="workspaceStore.filteredErrors" />
        <SettingsPanel v-else-if="auxiliaryPanel === 'settings'" />
        <DataTransferPanel v-else-if="auxiliaryPanel === 'transfer'" />
        <CodexInboxPanel v-else />
      </div>
    </div>
  </main>
</template>
