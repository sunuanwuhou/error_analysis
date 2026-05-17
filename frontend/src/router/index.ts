import { createRouter, createWebHistory } from 'vue-router'
import HubPage from '@/views/shenlun/HubPage.vue'
import WorkbenchPage from '@/views/shenlun/WorkbenchPage.vue'
import ResultPage from '@/views/shenlun/ResultPage.vue'
import XingceWorkspacePage from '@/views/xingce/WorkspacePage.vue'
import SuiteBankPage from '@/views/xingce/SuiteBankPage.vue'
import ModulePortalPage from '@/views/ModulePortalPage.vue'

const router = createRouter({
  history: createWebHistory('/new/'),
  routes: [
    {
      path: '/',
      name: 'ModulePortal',
      component: ModulePortalPage,
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
  ],
})

export default router
