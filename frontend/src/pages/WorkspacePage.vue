<script setup lang="ts">
import { computed } from 'vue'

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
import WorkspaceAuxiliaryDialog from '@/features/workspace-shell/components/WorkspaceAuxiliaryDialog.vue'
import WorkspaceMobileHeader from '@/features/workspace-shell/components/WorkspaceMobileHeader.vue'
import WorkspaceMobileTabbar from '@/features/workspace-shell/components/WorkspaceMobileTabbar.vue'
import WorkspaceQuickCreateDialog from '@/features/workspace-shell/components/WorkspaceQuickCreateDialog.vue'
import WorkspaceSidebarDrawer from '@/features/workspace-shell/components/WorkspaceSidebarDrawer.vue'
import { useWorkspacePage } from '@/features/workspace-shell/composables/useWorkspacePage'

const {
  activeTab,
  auxiliaryPanel,
  auxiliaryPanelTitle,
  closeAuxiliaryPanel,
  closeQuickCreate,
  closeSidebar,
  handleTabChange,
  isMobile,
  openAuxiliaryPanel,
  openFullPractice,
  openQuickCreate,
  practicePreset,
  quickCreateOpen,
  sidebarOpen,
  toggleSidebar,
  workspaceStore,
} = useWorkspacePage()

const selectedNodeTitle = computed(() => workspaceStore.selectedKnowledgeNode?.title || '全局笔记')

function handleSelectKnowledgeNode(nodeId: string) {
  workspaceStore.selectKnowledgeNode(nodeId)
  if (isMobile.value) {
    closeSidebar()
  }
}

function handleOpenAuxiliaryPanel(value: 'claude' | 'ai' | 'stats' | 'settings' | 'transfer' | 'codex') {
  openAuxiliaryPanel(value)
}
</script>

<template>
  <main class="workspace-shell workspace-shell--legacy workspace-shell--responsive">
    <WorkspaceMobileHeader
      v-if="isMobile"
      :active-tab="activeTab"
      :selected-node-title="selectedNodeTitle"
      @open-create="openQuickCreate"
      @open-sidebar="toggleSidebar"
    />

    <section v-if="!isMobile" class="workspace-left-column">
      <CloudStatusBar sidebar @open-create="openQuickCreate" @open-panel="handleOpenAuxiliaryPanel" />

      <KnowledgeTree
        :nodes="workspaceStore.knowledgeTree"
        :selected-id="workspaceStore.selectedKnowledgeNodeId"
        @select="handleSelectKnowledgeNode"
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
        @open-full-practice="openFullPractice"
      />

      <section class="workspace-main">
        <KnowledgeWorkspace
          v-if="activeTab === 'notes'"
          @open-create="openQuickCreate"
          @open-transfer="handleOpenAuxiliaryPanel('transfer')"
        />
        <ErrorList v-else-if="activeTab === 'errors'" :items="workspaceStore.relatedErrors" title="错题列表" />
        <PracticePanel v-else :preset="practicePreset" />
      </section>
    </section>

    <WorkspaceMobileTabbar v-if="isMobile" :model-value="activeTab" @update:model-value="handleTabChange" />

    <WorkspaceSidebarDrawer :open="isMobile && sidebarOpen" @close="closeSidebar">
      <section class="workspace-left-column workspace-left-column--drawer">
        <CloudStatusBar sidebar @open-create="openQuickCreate" @open-panel="handleOpenAuxiliaryPanel" />
        <KnowledgeTree
          :nodes="workspaceStore.knowledgeTree"
          :selected-id="workspaceStore.selectedKnowledgeNodeId"
          @select="handleSelectKnowledgeNode"
        />
      </section>
    </WorkspaceSidebarDrawer>

    <WorkspaceQuickCreateDialog :open="quickCreateOpen" @close="closeQuickCreate">
      <QuickCreatePanel />
    </WorkspaceQuickCreateDialog>

    <WorkspaceAuxiliaryDialog :open="Boolean(auxiliaryPanel)" :title="auxiliaryPanelTitle" @close="closeAuxiliaryPanel">
      <ClaudeBankPanel v-if="auxiliaryPanel === 'claude'" :items="workspaceStore.filteredClaudeBank" />
      <AiWorkbenchPanel v-else-if="auxiliaryPanel === 'ai'" />
      <StatsPanel v-else-if="auxiliaryPanel === 'stats'" :items="workspaceStore.filteredErrors" />
      <SettingsPanel v-else-if="auxiliaryPanel === 'settings'" />
      <DataTransferPanel v-else-if="auxiliaryPanel === 'transfer'" />
      <CodexInboxPanel v-else-if="auxiliaryPanel === 'codex'" />
    </WorkspaceAuxiliaryDialog>
  </main>
</template>
