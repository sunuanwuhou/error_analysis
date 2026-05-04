import { createRouter, createWebHistory } from 'vue-router'
import WorkbenchPage from '@/views/shenlun/WorkbenchPage.vue'
import ResultPage from '@/views/shenlun/ResultPage.vue'

const router = createRouter({
  history: createWebHistory('/new/'),
  routes: [
    {
      path: '/',
      redirect: '/shenlun/workbench',
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
  ],
})

export default router
