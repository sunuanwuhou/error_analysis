import { createRouter, createWebHistory } from 'vue-router'
import ModulePortalPage from '@/views/ModulePortalPage.vue'
import AppShell from '@/views/AppShell.vue'

const routePlaceholder = { template: '<div />' }
import { fetchMe, hasModule } from '@/api/authMe'
import type { PortalModuleKey } from '@/lib/modules'
import { savePortalLastModule } from '@/lib/portalPrefs'
import { portalChoiceForRouteName } from '@/lib/shellTabs'

const ROUTE_MODULE: Record<string, PortalModuleKey> = {
  LegacyXingce: 'xingce',
  XingceWorkspace: 'xingce',
  XingceSuiteBank: 'xingce_suite',
  XingceBankDrill: 'xingce_bank_drill',
  XingceBankDrillExport: 'xingce_bank_drill',
  ShenlunHub: 'shenlun',
  ShenlunWorkbench: 'shenlun',
  ShenlunResult: 'shenlun',
  InterviewWorkspace: 'interview',
}

const router = createRouter({
  history: createWebHistory('/new/'),
  routes: [
    {
      path: '/',
      component: AppShell,
      children: [
        {
          path: '',
          name: 'ShellDefault',
          component: routePlaceholder,
          meta: { hidden: true },
        },
        {
          path: 'legacy-xingce',
          name: 'LegacyXingce',
          component: routePlaceholder,
        },
        {
          path: 'xingce/workspace',
          name: 'XingceWorkspace',
          component: routePlaceholder,
        },
        {
          path: 'xingce/suite',
          name: 'XingceSuiteBank',
          component: routePlaceholder,
        },
        {
          path: 'xingce/bank-drill',
          name: 'XingceBankDrill',
          component: routePlaceholder,
        },
        {
          path: 'xingce/bank-drill-export',
          name: 'XingceBankDrillExport',
          component: routePlaceholder,
        },
        {
          path: 'shenlun',
          name: 'ShenlunHub',
          component: routePlaceholder,
        },
        {
          path: 'shenlun/workbench',
          name: 'ShenlunWorkbench',
          component: routePlaceholder,
        },
        {
          path: 'shenlun/result/:attemptId',
          name: 'ShenlunResult',
          component: routePlaceholder,
        },
        {
          path: 'interview/workspace',
          name: 'InterviewWorkspace',
          component: routePlaceholder,
        },
        {
          path: 'admin',
          name: 'AdminUsers',
          component: routePlaceholder,
        },
      ],
    },
    {
      path: '/portal',
      name: 'ModulePortal',
      component: ModulePortalPage,
    },
  ],
})

router.beforeEach(async to => {
  if (to.name === 'ModulePortal') return true

  const meRes = await fetchMe().catch(() => ({ authenticated: false as const }))
  if (!meRes.authenticated || !meRes.user) {
    window.location.href = '/login.html'
    return false
  }

  if (to.name === 'AdminUsers') {
    if (!meRes.user.is_super_admin) {
      return { name: 'ModulePortal' }
    }
    return true
  }

  const mod = ROUTE_MODULE[String(to.name || '')]
  if (mod && !hasModule(meRes.user, mod)) {
    return { name: 'ModulePortal' }
  }

  const choice = portalChoiceForRouteName(String(to.name || ''))
  if (choice && choice !== 'admin') {
    savePortalLastModule(choice)
  }

  return true
})

export default router
