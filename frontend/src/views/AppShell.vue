<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchMe, hasModule } from '@/api/authMe'
import type { MeUser } from '@/lib/modules'
import ModuleTabBar from '@/components/shell/ModuleTabBar.vue'
import LegacyXingceFrame from '@/components/shell/LegacyXingceFrame.vue'
import HubPage from '@/views/shenlun/HubPage.vue'
import WorkbenchPage from '@/views/shenlun/WorkbenchPage.vue'
import ResultPage from '@/views/shenlun/ResultPage.vue'
import XingceWorkspacePage from '@/views/xingce/WorkspacePage.vue'
import SuiteBankPage from '@/views/xingce/SuiteBankPage.vue'
import ExamInsightPage from '@/views/xingce/ExamInsightPage.vue'
import BankDrillPage from '@/views/xingce/BankDrillPage.vue'
import BankDrillExportPage from '@/views/xingce/BankDrillExportPage.vue'
import InterviewWorkspacePage from '@/views/interview/WorkspacePage.vue'
import AdminUsersPage from '@/views/admin/AdminUsersPage.vue'
import { useXingceStore } from '@/stores/xingceStore'
import { defaultShellRouteName, shellTabForRouteName, type ShellTabId } from '@/lib/shellTabs'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const me = ref<MeUser | null>(null)
const mountedPanels = ref<Set<ShellTabId>>(new Set())

const activePanel = computed(() => shellTabForRouteName(String(route.name || '')))

function panelClass(panelId: ShellTabId) {
  return {
    'shell-panel': true,
    'is-active': activePanel.value === panelId,
  }
}

function markPanelMounted(panelId: ShellTabId | null) {
  if (!panelId) return
  if (mountedPanels.value.has(panelId)) return
  mountedPanels.value = new Set([...mountedPanels.value, panelId])
}

watch(
  activePanel,
  panel => {
    markPanelMounted(panel)
  },
  { immediate: true },
)

onMounted(async () => {
  try {
    const res = await fetchMe()
    if (!res.authenticated || !res.user) {
      window.location.href = '/login.html'
      return
    }
    me.value = res.user
    if (hasModule(res.user, 'xingce')) {
      markPanelMounted('legacy_xingce')
      markPanelMounted('xingce_vue')
      void useXingceStore().load()
    }
    if (route.name === 'ShellDefault') {
      const target = defaultShellRouteName(res.user)
      await router.replace({ name: target })
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="app-shell">
    <div v-if="loading" class="app-shell__loading">正在加载模块…</div>
    <template v-else>
      <ModuleTabBar :user="me" />
      <main class="app-shell__main">
        <div
          v-if="mountedPanels.has('legacy_xingce')"
          :class="panelClass('legacy_xingce')"
        >
          <LegacyXingceFrame :active="activePanel === 'legacy_xingce'" />
        </div>

        <div
          v-if="mountedPanels.has('xingce_vue')"
          :class="panelClass('xingce_vue')"
        >
          <KeepAlive>
            <XingceWorkspacePage
              v-if="activePanel === 'xingce_vue'"
              key="xingce-workspace"
            />
          </KeepAlive>
        </div>

        <div
          v-if="mountedPanels.has('xingce_suite')"
          :class="panelClass('xingce_suite')"
        >
          <KeepAlive>
            <ExamInsightPage v-if="route.name === 'XingceExamInsight'" key="exam-insight" />
            <SuiteBankPage v-else key="suite-bank" />
          </KeepAlive>
        </div>

        <div
          v-if="mountedPanels.has('xingce_bank_drill')"
          :class="panelClass('xingce_bank_drill')"
        >
          <KeepAlive>
            <BankDrillPage v-if="route.name === 'XingceBankDrill'" key="bank-drill" />
            <BankDrillExportPage
              v-else-if="route.name === 'XingceBankDrillExport'"
              key="bank-drill-export"
            />
          </KeepAlive>
        </div>

        <div
          v-if="mountedPanels.has('shenlun')"
          :class="panelClass('shenlun')"
        >
          <KeepAlive>
            <HubPage v-if="route.name === 'ShenlunHub'" key="shenlun-hub" />
            <WorkbenchPage v-else-if="route.name === 'ShenlunWorkbench'" key="shenlun-workbench" />
            <ResultPage
              v-else-if="route.name === 'ShenlunResult'"
              :key="`shenlun-result-${String(route.params.attemptId || '')}`"
            />
          </KeepAlive>
        </div>

        <div
          v-if="mountedPanels.has('interview')"
          :class="panelClass('interview')"
        >
          <KeepAlive>
            <InterviewWorkspacePage />
          </KeepAlive>
        </div>

        <div
          v-if="mountedPanels.has('admin')"
          :class="panelClass('admin')"
        >
          <AdminUsersPage />
        </div>
      </main>
    </template>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #f9fafb;
}

.app-shell__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 14px;
}

.app-shell__main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.shell-panel {
  position: absolute;
  inset: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
  z-index: 0;
}

.shell-panel.is-active {
  visibility: visible;
  pointer-events: auto;
  z-index: 1;
}

.shell-panel :deep(> *) {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
