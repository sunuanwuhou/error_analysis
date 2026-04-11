import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import EntryFlowPage from '@/views/EntryFlowPage.vue'
import KnowledgeManagePage from '@/views/KnowledgeManagePage.vue'
import NotePage from '@/views/NotePage.vue'
import PracticePage from '@/views/PracticePage.vue'
import ProcessCanvasPage from '@/views/ProcessCanvasPage.vue'
import RouteShellPage from '@/views/RouteShellPage.vue'
import ShenlunWorkspacePage from '@/views/ShenlunWorkspacePage.vue'
import WorkspacePage from '@/views/WorkspacePage.vue'

const router = createRouter({
  history: createWebHistory('/next/'),
  routes: [
    { path: '/', redirect: '/workspace' },
    {
      path: '/login',
      name: 'login',
      component: RouteShellPage,
      meta: { nativeMode: 'login', title: '登录', description: '登录 /next 工作台。' },
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
      meta: { nativeMode: 'insights', title: '统计看板', description: '学习统计与回顾。', eyebrow: 'dashboard' },
    },
    { path: '/actions/quickadd', name: 'action-quickadd', component: EntryFlowPage },
    {
      path: '/actions/cloud-load',
      name: 'action-cloud-load',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '云端载入', description: '载入云端备份。' },
    },
    {
      path: '/actions/cloud-save',
      name: 'action-cloud-save',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '云端保存', description: '保存到云端备份。' },
    },
    {
      path: '/actions/recommended-notes',
      name: 'action-recommended-notes',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '推荐笔记', description: '推荐笔记队列。', eyebrow: 'recommended' },
    },
    {
      path: '/actions/recommended-notes/return',
      name: 'action-recommended-notes-return',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '返回推荐笔记', description: '返回推荐笔记队列。', eyebrow: 'recommended' },
    },
    {
      path: '/actions/recommended-note',
      name: 'action-recommended-note',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '当前推荐笔记', description: '定位当前推荐笔记。', eyebrow: 'recommended' },
    },
    {
      path: '/actions/codex',
      name: 'action-codex',
      component: RouteShellPage,
      meta: { nativeMode: 'codex', title: 'Codex 收件箱', description: 'Codex 线程与消息流。', eyebrow: 'codex' },
    },

    { path: '/tools/add', name: 'tool-add', component: EntryFlowPage },
    { path: '/tools/edit', name: 'tool-edit', component: EntryFlowPage },
    { path: '/tools/note-editor', name: 'tool-note-editor', component: NotePage },
    { path: '/tools/note-viewer', name: 'tool-note-viewer', component: NotePage },
    { path: '/tools/directory', name: 'tool-directory', component: KnowledgeManagePage },
    { path: '/tools/knowledge-move', name: 'tool-knowledge-move', component: KnowledgeManagePage },
    { path: '/tools/knowledge-node', name: 'tool-knowledge-node', component: KnowledgeManagePage },
    { path: '/tools/process-image', name: 'tool-process-image', component: ProcessCanvasPage },
    { path: '/tools/canvas', name: 'tool-canvas', component: ProcessCanvasPage },
    { path: '/tools/markdown-harness', name: 'tool-markdown-harness', component: NotePage },
    { path: '/tools/process-harness', name: 'tool-process-harness', component: ProcessCanvasPage },

    {
      path: '/tools/search',
      name: 'tool-search',
      component: RouteShellPage,
      meta: { nativeMode: 'search', title: '全局搜索', description: '知识点与错题搜索。' },
    },
    {
      path: '/tools/export',
      name: 'tool-export',
      component: RouteShellPage,
      meta: { nativeMode: 'export', title: '导出', description: '导出快照与错题。', eyebrow: 'export' },
    },
    {
      path: '/tools/import',
      name: 'tool-import',
      component: RouteShellPage,
      meta: { nativeMode: 'transfer', title: '导入', description: '导入题目数据。', eyebrow: 'import' },
    },
    {
      path: '/tools/quick-import',
      name: 'tool-quick-import',
      component: RouteShellPage,
      meta: { nativeMode: 'transfer', title: '快速导入', description: '快速导入题目数据。', eyebrow: 'quick-import' },
    },
    {
      path: '/tools/type-rules',
      name: 'tool-type-rules',
      component: RouteShellPage,
      meta: { nativeMode: 'transfer', title: '题型规则', description: '题型规则配置。', eyebrow: 'type-rules' },
    },
    {
      path: '/tools/history',
      name: 'tool-history',
      component: RouteShellPage,
      meta: { nativeMode: 'insights', title: '练习记录', description: '练习记录与回顾。', eyebrow: 'history' },
    },
    {
      path: '/tools/backup',
      name: 'tool-backup',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '本地备份', description: '本地备份管理。' },
    },
    {
      path: '/tools/backup/create',
      name: 'tool-backup-create',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '创建备份', description: '创建本地备份。' },
    },
    {
      path: '/tools/backup/refresh',
      name: 'tool-backup-refresh',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '刷新备份', description: '刷新本地备份列表。' },
    },
    {
      path: '/tools/backup/restore',
      name: 'tool-backup-restore',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '恢复备份', description: '恢复本地备份。' },
    },
    {
      path: '/tools/backup/delete',
      name: 'tool-backup-delete',
      component: RouteShellPage,
      meta: { nativeMode: 'backup', title: '删除备份', description: '删除本地备份。' },
    },
    {
      path: '/tools/remarks',
      name: 'tool-remarks',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '系统备注', description: '全局备注编辑。', eyebrow: 'remarks' },
    },
    {
      path: '/tools/remarks/daily-log',
      name: 'tool-remarks-daily-log',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '备注日报', description: '插入每日日志模板。', eyebrow: 'remarks' },
    },
    {
      path: '/tools/journal',
      name: 'tool-journal',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '学习日志', description: '按日期管理日志。', eyebrow: 'journal' },
    },
    {
      path: '/tools/journal/today',
      name: 'tool-journal-today',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '今日日志', description: '跳转今日日志。', eyebrow: 'journal' },
    },
    {
      path: '/tools/journal/template',
      name: 'tool-journal-template',
      component: RouteShellPage,
      meta: { nativeMode: 'notes', title: '日志模板', description: '日志模板插入。', eyebrow: 'journal' },
    },
    {
      path: '/tools/ai',
      name: 'tool-ai',
      component: RouteShellPage,
      meta: { nativeMode: 'ai', title: 'AI 工具', description: 'AI 对话与诊断。', eyebrow: 'ai' },
    },
    {
      path: '/tools/claude-helper',
      name: 'tool-claude-helper',
      component: RouteShellPage,
      meta: { nativeMode: 'ai', title: 'Claude 辅助', description: 'Claude 辅助入口。', eyebrow: 'claude' },
    },
    {
      path: '/tools/claude-bank',
      name: 'tool-claude-bank',
      component: RouteShellPage,
      meta: { nativeMode: 'ai', title: 'Claude 题库', description: 'Claude 题库入口。', eyebrow: 'claude' },
    },
    {
      path: '/tools/claude-bank/refresh',
      name: 'tool-claude-bank-refresh',
      component: RouteShellPage,
      meta: { nativeMode: 'ai', title: '刷新 Claude 题库', description: 'Claude 题库刷新入口。', eyebrow: 'claude' },
    },

    // legacy compatibility: keep old paths available under /next
    {
      path: '/legacy',
      name: 'legacy-root',
      component: WorkspacePage,
    },
    {
      path: '/v51',
      name: 'legacy-v51',
      component: WorkspacePage,
    },
    {
      path: '/v53',
      name: 'legacy-v53',
      component: WorkspacePage,
    },
    {
      path: '/shenlun',
      name: 'legacy-shenlun',
      component: ShenlunWorkspacePage,
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
