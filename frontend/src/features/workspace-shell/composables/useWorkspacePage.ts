import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  AUXILIARY_PANEL_TITLES,
  MOBILE_WORKSPACE_BREAKPOINT,
  type AuxiliaryPanel,
  type PracticePreset,
  type WorkspaceTab,
} from '@/features/workspace-shell/constants/workspace-shell'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useWorkspaceStore } from '@/stores/workspace'

export function useWorkspacePage() {
  const authStore = useAuthStore()
  const syncStore = useSyncStore()
  const workspaceStore = useWorkspaceStore()

  const activeTab = ref<WorkspaceTab>('notes')
  const practicePreset = ref<PracticePreset>('daily')
  const quickCreateOpen = ref(false)
  const auxiliaryPanel = ref<AuxiliaryPanel>('')
  const sidebarOpen = ref(false)
  const viewportWidth = ref<number>(typeof window === 'undefined' ? MOBILE_WORKSPACE_BREAKPOINT + 1 : window.innerWidth)

  const isMobile = computed(() => viewportWidth.value <= MOBILE_WORKSPACE_BREAKPOINT)
  const auxiliaryPanelTitle = computed(() => (auxiliaryPanel.value ? AUXILIARY_PANEL_TITLES[auxiliaryPanel.value] : ''))

  function syncViewport() {
    if (typeof window === 'undefined') return
    viewportWidth.value = window.innerWidth
  }

  function handleTabChange(value: WorkspaceTab) {
    activeTab.value = value
    if (value === 'practice') {
      practicePreset.value = 'daily'
    }
  }

  function openFullPractice() {
    activeTab.value = 'practice'
    practicePreset.value = 'full'
  }

  function openQuickCreate() {
    quickCreateOpen.value = true
    sidebarOpen.value = false
  }

  function closeQuickCreate() {
    quickCreateOpen.value = false
  }

  function openAuxiliaryPanel(value: Exclude<AuxiliaryPanel, ''>) {
    auxiliaryPanel.value = value
    sidebarOpen.value = false
  }

  function closeAuxiliaryPanel() {
    auxiliaryPanel.value = ''
  }

  function openSidebar() {
    if (!isMobile.value) return
    sidebarOpen.value = true
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  function toggleSidebar() {
    if (!isMobile.value) return
    sidebarOpen.value = !sidebarOpen.value
  }

  async function initializeWorkspace() {
    await authStore.loadSession()
    syncStore.restorePendingOps()
    syncStore.startBackgroundSync()
    const backup = await workspaceStore.loadBackup()
    await syncStore.pushOriginStatus({
      lastLoadedAt: backup?.updatedAt || '',
      lastBackupUpdatedAt: backup?.updatedAt || '',
    })
  }

  watch(isMobile, (mobile) => {
    if (!mobile) {
      sidebarOpen.value = false
    }
  })

  watch([isMobile, sidebarOpen, quickCreateOpen, auxiliaryPanel], ([mobile, sidebar, quickCreate, panel]) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = mobile && (sidebar || quickCreate || Boolean(panel)) ? 'hidden' : ''
  })

  onMounted(() => {
    syncViewport()
    window.addEventListener('resize', syncViewport)
    void initializeWorkspace()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncViewport)
    if (typeof document !== 'undefined') {
      document.body.style.overflow = ''
    }
  })

  return {
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
    openSidebar,
    practicePreset,
    quickCreateOpen,
    sidebarOpen,
    toggleSidebar,
    workspaceStore,
  }
}
