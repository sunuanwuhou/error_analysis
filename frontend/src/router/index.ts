import { createRouter, createWebHistory } from 'vue-router'
import HubPage from '@/views/shenlun/HubPage.vue'
import WorkbenchPage from '@/views/shenlun/WorkbenchPage.vue'
import ResultPage from '@/views/shenlun/ResultPage.vue'
import XingceWorkspacePage from '@/views/xingce/WorkspacePage.vue'
import SuiteBankPage from '@/views/xingce/SuiteBankPage.vue'
import BankDrillPage from '@/views/xingce/BankDrillPage.vue'
import BankDrillExportPage from '@/views/xingce/BankDrillExportPage.vue'
import ModulePortalPage from '@/views/ModulePortalPage.vue'
import AdminUsersPage from '@/views/admin/AdminUsersPage.vue'
import { fetchMe, hasModule } from '@/api/authMe'
import type { PortalModuleKey } from '@/lib/modules'

const ROUTE_MODULE: Record<string, PortalModuleKey> = {
  XingceWorkspace: 'xingce',
  XingceSuiteBank: 'xingce_suite',
  XingceBankDrill: 'xingce_bank_drill',
  XingceBankDrillExport: 'xingce_bank_drill',
  ShenlunHub: 'shenlun',
  ShenlunWorkbench: 'shenlun',
  ShenlunResult: 'shenlun',
}

const router = createRouter({
  history: createWebHistory('/new/'),
  routes: [
    {
      path: '/',
      name: 'ModulePortal',
      component: ModulePortalPage,
    },
    {
      path: '/admin',
      name: 'AdminUsers',
      component: AdminUsersPage,
    },
    {
      path: '/shenlun',
      name: 'ShenlunHub',
      component: HubPage,
    },
    {
      path: '/shenlun/workbench',
      name: 'ShenlunWorkbench',
      component: WorkbenchPage,
    },
    {
      path: '/shenlun/result/:attemptId',
      name: 'ShenlunResult',
      component: ResultPage,
    },
    {
      path: '/xingce/workspace',
      name: 'XingceWorkspace',
      component: XingceWorkspacePage,
    },
    {
      path: '/xingce/suite',
      name: 'XingceSuiteBank',
      component: SuiteBankPage,
    },
    {
      path: '/xingce/bank-drill',
      name: 'XingceBankDrill',
      component: BankDrillPage,
    },
    {
      path: '/xingce/bank-drill-export',
      name: 'XingceBankDrillExport',
      component: BankDrillExportPage,
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.name === 'ModulePortal') return true

  const meRes = await fetchMe().catch(() => ({ authenticated: false as const }))
  if (!meRes.authenticated || !meRes.user) {
    window.location.href = '/login.html'
    return false
  }

  if (to.name === 'AdminUsers') {
    if (!meRes.user.is_super_admin) {
      return { name: 'ModulePortal', query: { portal: '1' } }
    }
    return true
  }

  const mod = ROUTE_MODULE[String(to.name || '')]
  if (mod && !hasModule(meRes.user, mod)) {
    return { name: 'ModulePortal', query: { portal: '1' } }
  }

  return true
})

export default router
