import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import EntryFlowPage from '@/views/EntryFlowPage.vue'
import KnowledgeManagePage from '@/views/KnowledgeManagePage.vue'
import NotePage from '@/views/NotePage.vue'
import PracticePage from '@/views/PracticePage.vue'
import ProcessCanvasPage from '@/views/ProcessCanvasPage.vue'
import RouteShellPage from '@/views/RouteShellPage.vue'
import WorkspacePage from '@/views/WorkspacePage.vue'

const router = createRouter({
  history: createWebHistory('/next/'),
  routes: [
    { path: '/', redirect: '/workspace' },
    {
      path: '/login',
      name: 'login',
      component: RouteShellPage,
      meta: {
        nativeMode: 'login',
        title: '登录',
        description: '登录 /next 路由树',
      },
    },
    { path: '/workspace', name: 'workspace', component: WorkspacePage },
    { path: '/workspace/errors', name: 'workspace-errors', component: WorkspacePage },
    { path: '/workspace/notes', name: 'workspace-notes', component: WorkspacePage },
    { path: '/workspace/tasks/errors', name: 'workspace-task-errors', component: WorkspacePage },
    { path: '/workspace/tasks/notes', name: 'workspace-task-notes', component: WorkspacePage },
    { path: '/actions/daily', name: 'action-daily', component: PracticePage },
    { path: '/actions/full', name: 'action-full', component: PracticePage },
    { path: '/actions/note', name: 'action-note', component: PracticePage },
    { path: '/actions/direct', name: 'action-direct', component: PracticePage },
    { path: '/actions/speed', name: 'action-speed', component: PracticePage },
    {
      path: '/actions/dashboard',
      name: 'action-dashboard',
      component: RouteShellPage,
      meta: { nativeMode: 'insights', title: '总览面板', description: '原生 /next 学习总览与任务统计。', eyebrow: 'dashboard' },
    },
    { path: '/actions/quickadd', name: 'action-quickadd', component: EntryFlowPage },
    { path: '/tools/add', name: 'tool-add', component: EntryFlowPage },
    { path: '/tools/edit', name: 'tool-edit', component: EntryFlowPage },
    { path: '/tools/note-editor', name: 'tool-note-editor', component: NotePage },
    { path: '/tools/note-viewer', name: 'tool-note-viewer', component: NotePage },
    { path: '/tools/directory', name: 'tool-directory', component: KnowledgeManagePage },
    { path: '/tools/knowledge-move', name: 'tool-knowledge-move', component: KnowledgeManagePage },
    { path: '/tools/knowledge-node', name: 'tool-knowledge-node', component: KnowledgeManagePage },
    { path: '/tools/process-image', name: 'tool-process-image', component: ProcessCanvasPage },
    { path: '/tools/canvas', name: 'tool-canvas', component: ProcessCanvasPage },
    {
      path: '/actions/cloud-load',
      name: 'action-cloud-load',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '云端载入', description: '原生 /next 备份面板，用来处理云端和本地快照。' },
    },
    {
      path: '/actions/cloud-save',
      name: 'action-cloud-save',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '云端保存', description: '原生 /next 备份面板，用来处理云端和本地快照。' },
    },
    {
      path: '/tools/search',
      name: 'tool-search',
      component: RouteShellPage,
      meta: { nativeMode: 'search', title: '全局搜索', description: '原生 /next 知识点和错题搜索。' },
    },
    {
      path: '/tools/export',
      name: 'tool-export',
      component: RouteShellPage,
      meta: { nativeMode: 'export', title: '导出与打印', description: '原生 /next 导出与打印页，保持旧版导出结构。', eyebrow: 'export' },
    },
    {
      path: '/tools/import',
      name: 'tool-import',
      component: RouteShellPage,
      meta: { nativeMode: 'transfer', title: '导入题目', description: '原生 /next JSON 导入页。', eyebrow: 'import' },
    },
    {
      path: '/tools/quick-import',
      name: 'tool-quick-import',
      component: RouteShellPage,
      meta: { nativeMode: 'transfer', title: '快速导入', description: '原生 /next 快速导入页。', eyebrow: 'quick-import' },
    },
    {
      path: '/tools/type-rules',
      name: 'tool-type-rules',
      component: RouteShellPage,
      meta: { nativeMode: 'transfer', title: '题型规则', description: '原生 /next 题型规则页。', eyebrow: 'type-rules' },
    },
    {
      path: '/tools/history',
      name: 'tool-history',
      component: RouteShellPage,
      meta: { nativeMode: 'insights', title: '练习记录', description: '原生 /next 练习记录与轮次回顾。', eyebrow: 'history' },
    },
    {
      path: '/tools/backup',
      name: 'tool-backup',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '本地备份', description: '原生 /next 备份管理。' },
    },
    {
      path: '/tools/backup/create',
      name: 'tool-backup-create',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '创建备份', description: '原生 /next 备份创建页。' },
    },
    {
      path: '/tools/backup/refresh',
      name: 'tool-backup-refresh',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '刷新备份', description: '原生 /next 备份刷新页。' },
    },
    {
      path: '/tools/backup/restore',
      name: 'tool-backup-restore',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '恢复备份', description: '原生 /next 备份恢复页。' },
    },
    {
      path: '/tools/backup/delete',
      name: 'tool-backup-delete',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '删除备份', description: '原生 /next 备份删除页。' },
    },

    // legacy URL compatibility: keep old URLs but render in native Vue routes
    {
      path: '/legacy',
      name: 'legacy-root',
      component: RouteShellPage,
      meta: { nativeMode: 'action', title: '学习工作台', description: '旧版根入口已并入 /next 原生工作台。', eyebrow: 'workspace' },
    },
    {
      path: '/v51',
      name: 'legacy-v51',
      component: RouteShellPage,
      meta: { nativeMode: 'action', title: 'V51 工作台', description: 'V51 入口已迁移到 /next 原生页面。', eyebrow: 'workspace' },
    },
    {
      path: '/v53',
      name: 'legacy-v53',
      component: RouteShellPage,
      meta: { nativeMode: 'action', title: 'V53 工作台', description: 'V53 入口已迁移到 /next 原生页面。', eyebrow: 'workspace' },
    },
    {
      path: '/shenlun',
      name: 'legacy-shenlun',
      component: RouteShellPage,
      meta: { nativeMode: 'action', title: '申论工作台', description: '申论入口已迁移到 /next 原生任务工作区。', eyebrow: 'shenlun' },
    },
    {
      path: '/actions/recommended-notes',
      name: 'action-recommended-notes',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '推荐笔记', description: '按旧版顺序展示今日推荐的笔记分组。', eyebrow: 'recommended' },
    },
    {
      path: '/actions/recommended-notes/return',
      name: 'action-recommended-notes-return',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '返回推荐笔记', description: '返回推荐列表并继续今日笔记主线。', eyebrow: 'recommended' },
    },
    {
      path: '/actions/recommended-note',
      name: 'action-recommended-note',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '当前推荐笔记', description: '定位到当前推荐知识点并打开笔记。', eyebrow: 'recommended' },
    },
    { path: '/tools/markdown-harness', name: 'tool-markdown-harness', component: NotePage },
    { path: '/tools/process-harness', name: 'tool-process-harness', component: ProcessCanvasPage },
    {
      path: '/tools/remarks',
      name: 'tool-remarks',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '系统备注', description: '全局备注清单，支持 Markdown 编辑与预览。', eyebrow: 'remarks' },
    },
    {
      path: '/tools/remarks/daily-log',
      name: 'tool-remarks-daily-log',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '备注日报', description: '在全局备注中插入当日日报模板。', eyebrow: 'remarks' },
    },
    {
      path: '/tools/journal',
      name: 'tool-journal',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '学习日志', description: '按日期管理学习日志条目。', eyebrow: 'journal' },
    },
    {
      path: '/tools/journal/today',
      name: 'tool-journal-today',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '今日日志', description: '自动定位并编辑今天的日志。', eyebrow: 'journal' },
    },
    {
      path: '/tools/journal/template',
      name: 'tool-journal-template',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '日志模板', description: '向今日日志插入模板。', eyebrow: 'journal' },
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.ready) {
    await authStore.bootstrap()
  }

  if (to.name === 'login') {
    return authStore.authenticated ? { name: 'workspace' } : true
  }

  if (!authStore.authenticated) {
    return { name: 'login' }
  }

  return true
})

export default router
