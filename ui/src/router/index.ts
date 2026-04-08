import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import LegacyBridgePage from '@/views/LegacyBridgePage.vue'
import WorkspacePage from '@/views/WorkspacePage.vue'

const router = createRouter({
  history: createWebHistory('/next/'),
  routes: [
    {
      path: '/',
      redirect: '/workspace',
    },
    {
      path: '/login',
      name: 'login',
      component: LegacyBridgePage,
      meta: {
        title: 'Login',
        description: 'Opening the legacy login page.',
        target: '/login',
      },
    },
    {
      path: '/workspace',
      name: 'workspace',
      component: WorkspacePage,
    },
    {
      path: '/workspace/errors',
      name: 'workspace-errors',
      component: LegacyBridgePage,
      meta: {
        title: 'Error workspace',
        description: 'Opening the legacy error workspace.',
        target: '/?home_action=workspace_errors',
      },
    },
    {
      path: '/legacy',
      name: 'legacy-root',
      component: LegacyBridgePage,
      meta: {
        title: 'Legacy root',
        description: 'Opening the legacy main workspace.',
        target: '/',
      },
    },
    {
      path: '/v51',
      name: 'legacy-v51',
      component: LegacyBridgePage,
      meta: {
        title: 'V51 shell',
        description: 'Opening the V51 legacy shell.',
        target: '/v51',
      },
    },
    {
      path: '/v53',
      name: 'legacy-v53',
      component: LegacyBridgePage,
      meta: {
        title: 'V53 shell',
        description: 'Opening the V53 legacy shell.',
        target: '/v53',
      },
    },
    {
      path: '/shenlun',
      name: 'legacy-shenlun',
      component: LegacyBridgePage,
      meta: {
        title: 'Shenlun workspace',
        description: 'Opening the legacy Shenlun workspace.',
        target: '/shenlun',
      },
    },
    {
      path: '/workspace/notes',
      name: 'workspace-notes',
      component: LegacyBridgePage,
      meta: {
        title: 'Notes workspace',
        description: 'Opening the legacy notes workspace.',
        target: '/?home_action=workspace_notes',
      },
    },
    {
      path: '/workspace/tasks/errors',
      name: 'workspace-task-errors',
      component: LegacyBridgePage,
      meta: {
        title: 'Error task lane',
        description: 'Opening the legacy workspace focused on error tasks.',
        target: '/?home_action=taskview_errors',
      },
    },
    {
      path: '/workspace/tasks/notes',
      name: 'workspace-task-notes',
      component: LegacyBridgePage,
      meta: {
        title: 'Notes task lane',
        description: 'Opening the legacy workspace focused on note tasks.',
        target: '/?home_action=taskview_notes',
      },
    },
    {
      path: '/actions/quickadd',
      name: 'action-quickadd',
      component: LegacyBridgePage,
      meta: {
        title: 'Quick add',
        description: 'Opening legacy quick add.',
        target: '/?home_action=quickadd',
      },
    },
    {
      path: '/actions/cloud-load',
      name: 'action-cloud-load',
      component: LegacyBridgePage,
      meta: {
        title: 'Cloud load',
        description: 'Running legacy Cloud Load.',
        target: '/?home_action=cloud_load',
      },
    },
    {
      path: '/actions/cloud-save',
      name: 'action-cloud-save',
      component: LegacyBridgePage,
      meta: {
        title: 'Cloud save',
        description: 'Running legacy Cloud Save.',
        target: '/?home_action=cloud_save',
      },
    },
    {
      path: '/actions/daily',
      name: 'action-daily',
      component: LegacyBridgePage,
      meta: {
        title: 'Daily practice',
        description: 'Opening legacy daily practice.',
        target: '/?home_action=daily',
      },
    },
    {
      path: '/actions/full',
      name: 'action-full',
      component: LegacyBridgePage,
      meta: {
        title: 'Full practice',
        description: 'Opening legacy full practice.',
        target: '/?home_action=full',
      },
    },
    {
      path: '/actions/note',
      name: 'action-note',
      component: LegacyBridgePage,
      meta: {
        title: 'Note first',
        description: 'Opening legacy note-first flow.',
        target: '/?home_action=note',
      },
    },
    {
      path: '/actions/recommended-notes',
      name: 'action-recommended-notes',
      component: LegacyBridgePage,
      meta: {
        title: 'Recommended notes',
        description: 'Opening the legacy recommended notes modal.',
        target: '/?home_action=recommended_notes',
      },
    },
    {
      path: '/actions/recommended-notes/return',
      name: 'action-recommended-notes-return',
      component: LegacyBridgePage,
      meta: {
        title: 'Return to recommended notes',
        description: 'Returning to the legacy recommended notes flow.',
        target: '/?home_action=recommended_notes_return',
      },
    },
    {
      path: '/actions/recommended-note',
      name: 'action-recommended-note',
      component: LegacyBridgePage,
      meta: {
        title: 'Recommended note',
        description: 'Opening a specific legacy recommended note.',
        target: '/?home_action=recommended_note',
        queryMap: {
          nodeId: 'node_id',
        },
      },
    },
    {
      path: '/actions/direct',
      name: 'action-direct',
      component: LegacyBridgePage,
      meta: {
        title: 'Direct work',
        description: 'Opening legacy direct work flow.',
        target: '/?home_action=direct',
      },
    },
    {
      path: '/actions/speed',
      name: 'action-speed',
      component: LegacyBridgePage,
      meta: {
        title: 'Speed drill',
        description: 'Opening legacy speed drill flow.',
        target: '/?home_action=speed',
      },
    },
    {
      path: '/actions/dashboard',
      name: 'action-dashboard',
      component: LegacyBridgePage,
      meta: {
        title: 'Dashboard',
        description: 'Opening legacy dashboard stats.',
        target: '/?home_action=dashboard',
      },
    },
    {
      path: '/actions/codex',
      name: 'action-codex',
      component: LegacyBridgePage,
      meta: {
        title: 'Codex',
        description: 'Opening the legacy Codex inbox.',
        target: '/?home_action=codex',
      },
    },
    {
      path: '/tools/history',
      name: 'tool-history',
      component: LegacyBridgePage,
      meta: {
        title: 'Practice history',
        description: 'Opening legacy practice history.',
        target: '/?home_action=history',
      },
    },
    {
      path: '/tools/ai',
      name: 'tool-ai',
      component: LegacyBridgePage,
      meta: {
        title: 'AI tools',
        description: 'Opening legacy AI tools.',
        target: '/?home_action=ai_tools',
      },
    },
    {
      path: '/tools/backup',
      name: 'tool-backup',
      component: LegacyBridgePage,
      meta: {
        title: 'Local backup',
        description: 'Opening legacy local backup.',
        target: '/?home_action=local_backup',
      },
    },
    {
      path: '/tools/backup/create',
      name: 'tool-backup-create',
      component: LegacyBridgePage,
      meta: {
        title: 'Create backup',
        description: 'Running legacy manual backup creation.',
        target: '/?home_action=local_backup_create',
      },
    },
    {
      path: '/tools/backup/refresh',
      name: 'tool-backup-refresh',
      component: LegacyBridgePage,
      meta: {
        title: 'Refresh backups',
        description: 'Refreshing legacy local backups.',
        target: '/?home_action=local_backup_refresh',
      },
    },
    {
      path: '/tools/backup/restore',
      name: 'tool-backup-restore',
      component: LegacyBridgePage,
      meta: {
        title: 'Restore backup',
        description: 'Restoring a specific legacy local backup.',
        target: '/?home_action=local_backup_restore',
        queryMap: {
          id: 'backup_id',
        },
      },
    },
    {
      path: '/tools/backup/delete',
      name: 'tool-backup-delete',
      component: LegacyBridgePage,
      meta: {
        title: 'Delete backup',
        description: 'Deleting a specific legacy local backup.',
        target: '/?home_action=local_backup_delete',
        queryMap: {
          id: 'backup_id',
        },
      },
    },
    {
      path: '/tools/export',
      name: 'tool-export',
      component: LegacyBridgePage,
      meta: {
        title: 'Export and print',
        description: 'Opening legacy export and print tools.',
        target: '/?home_action=export',
      },
    },
    {
      path: '/tools/remarks',
      name: 'tool-remarks',
      component: LegacyBridgePage,
      meta: {
        title: 'Remarks',
        description: 'Opening legacy remarks.',
        target: '/?home_action=remark_list',
      },
    },
    {
      path: '/tools/remarks/daily-log',
      name: 'tool-remarks-daily-log',
      component: LegacyBridgePage,
      meta: {
        title: 'Remark daily log',
        description: 'Opening the legacy remarks modal and inserting a daily log block.',
        target: '/?home_action=remark_daily_log',
      },
    },
    {
      path: '/tools/journal',
      name: 'tool-journal',
      component: LegacyBridgePage,
      meta: {
        title: 'Daily journal',
        description: 'Opening legacy daily journal.',
        target: '/?home_action=daily_journal',
      },
    },
    {
      path: '/tools/journal/today',
      name: 'tool-journal-today',
      component: LegacyBridgePage,
      meta: {
        title: 'Journal today',
        description: 'Jumping to today in the legacy daily journal.',
        target: '/?home_action=daily_journal_today',
      },
    },
    {
      path: '/tools/journal/template',
      name: 'tool-journal-template',
      component: LegacyBridgePage,
      meta: {
        title: 'Journal template',
        description: 'Inserting the legacy daily journal template.',
        target: '/?home_action=daily_journal_template',
      },
    },
    {
      path: '/tools/search',
      name: 'tool-search',
      component: LegacyBridgePage,
      meta: {
        title: 'Global search',
        description: 'Opening legacy global search.',
        target: '/?home_action=global_search',
      },
    },
    {
      path: '/tools/add',
      name: 'tool-add',
      component: LegacyBridgePage,
      meta: {
        title: 'Add modal',
        description: 'Opening the legacy add modal.',
        target: '/?home_action=add_modal',
      },
    },
    {
      path: '/tools/edit',
      name: 'tool-edit',
      component: LegacyBridgePage,
      meta: {
        title: 'Edit error',
        description: 'Opening the legacy edit modal for a specific error.',
        target: '/?home_action=edit_error',
        queryMap: {
          id: 'error_id',
        },
      },
    },
    {
      path: '/tools/note-editor',
      name: 'tool-note-editor',
      component: LegacyBridgePage,
      meta: {
        title: 'Note editor',
        description: 'Opening the legacy note editor.',
        target: '/assets/note_editor.html',
      },
    },
    {
      path: '/tools/note-viewer',
      name: 'tool-note-viewer',
      component: LegacyBridgePage,
      meta: {
        title: 'Note viewer',
        description: 'Opening the legacy note viewer.',
        target: '/assets/note_viewer.html',
      },
    },
    {
      path: '/tools/process-image',
      name: 'tool-process-image',
      component: LegacyBridgePage,
      meta: {
        title: 'Process image editor',
        description: 'Opening the legacy process image editor.',
        target: '/assets/process_image_editor.html',
      },
    },
    {
      path: '/tools/markdown-harness',
      name: 'tool-markdown-harness',
      component: LegacyBridgePage,
      meta: {
        title: 'Markdown harness',
        description: 'Opening the legacy markdown smoke harness.',
        target: '/assets/markdown_smoke_harness.html',
      },
    },
    {
      path: '/tools/process-harness',
      name: 'tool-process-harness',
      component: LegacyBridgePage,
      meta: {
        title: 'Process harness',
        description: 'Opening the legacy process image smoke harness.',
        target: '/assets/process_image_smoke_harness.html',
      },
    },
    {
      path: '/tools/import',
      name: 'tool-import',
      component: LegacyBridgePage,
      meta: {
        title: 'Import questions',
        description: 'Opening the legacy import entry.',
        target: '/?home_action=import',
      },
    },
    {
      path: '/tools/directory',
      name: 'tool-directory',
      component: LegacyBridgePage,
      meta: {
        title: 'Directory manager',
        description: 'Opening the legacy directory manager.',
        target: '/?home_action=dir_modal',
      },
    },
    {
      path: '/tools/knowledge-move',
      name: 'tool-knowledge-move',
      component: LegacyBridgePage,
      meta: {
        title: 'Knowledge move',
        description: 'Opening the legacy knowledge move dialog.',
        target: '/?home_action=knowledge_move',
      },
    },
    {
      path: '/tools/knowledge-node',
      name: 'tool-knowledge-node',
      component: LegacyBridgePage,
      meta: {
        title: 'Knowledge node',
        description: 'Opening the legacy knowledge node dialog.',
        target: '/?home_action=knowledge_node',
      },
    },
    {
      path: '/tools/quick-import',
      name: 'tool-quick-import',
      component: LegacyBridgePage,
      meta: {
        title: 'Quick import',
        description: 'Opening the legacy quick import entry.',
        target: '/?home_action=quick_import',
      },
    },
    {
      path: '/tools/type-rules',
      name: 'tool-type-rules',
      component: LegacyBridgePage,
      meta: {
        title: 'Type rules',
        description: 'Opening the legacy type rules.',
        target: '/?home_action=type_rules',
      },
    },
    {
      path: '/tools/claude-bank',
      name: 'tool-claude-bank',
      component: LegacyBridgePage,
      meta: {
        title: 'Claude bank',
        description: 'Opening the legacy Claude bank.',
        target: '/?home_action=claude_bank',
      },
    },
    {
      path: '/tools/claude-bank/refresh',
      name: 'tool-claude-bank-refresh',
      component: LegacyBridgePage,
      meta: {
        title: 'Refresh Claude bank',
        description: 'Refreshing the legacy Claude bank modal.',
        target: '/?home_action=claude_bank_refresh',
      },
    },
    {
      path: '/tools/claude-helper',
      name: 'tool-claude-helper',
      component: LegacyBridgePage,
      meta: {
        title: 'Claude helper',
        description: 'Opening the legacy Claude helper.',
        target: '/?home_action=claude_helper',
      },
    },
    {
      path: '/tools/canvas',
      name: 'tool-canvas',
      component: LegacyBridgePage,
      meta: {
        title: 'Canvas',
        description: 'Opening the legacy canvas.',
        target: '/?home_action=canvas',
      },
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
