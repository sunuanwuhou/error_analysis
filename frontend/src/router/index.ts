import { createRouter, createWebHistory } from 'vue-router'
import HubPage from '@/views/shenlun/HubPage.vue'
import WorkbenchPage from '@/views/shenlun/WorkbenchPage.vue'
import ResultPage from '@/views/shenlun/ResultPage.vue'
import XingceWorkspacePage from '@/views/xingce/WorkspacePage.vue'

const router = createRouter({
  history: createWebHistory('/new/'),
  routes: [
    {
      path: '/',
      redirect: '/shenlun',
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
  ],
})

export default router
