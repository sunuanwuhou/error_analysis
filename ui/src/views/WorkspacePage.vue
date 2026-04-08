<template>
  <main class="workspace-shell legacy-home-shell">
    <aside class="workspace-sidebar legacy-sidebar">
      <div class="legacy-logo panel">
        <div class="legacy-brand">Ashore</div>
        <div class="legacy-runtime">{{ runtimeInfo?.label ?? 'Loading runtime info...' }}</div>
      </div>

      <nav class="legacy-nav">
        <a class="legacy-nav-button is-active" href="/next">Home</a>
        <a class="legacy-nav-button" href="/next/workspace/errors">Error Workspace</a>
        <a class="legacy-nav-button" href="/next/shenlun">Shenlun Workspace</a>
      </nav>

      <section class="panel legacy-quick-card">
        <div class="legacy-tool-row">
          <a class="legacy-primary-link" :href="legacyActionHref('quickadd')">+ Quick Add</a>
          <a class="legacy-secondary-link" href="/next/tools/search">More</a>
        </div>
      </section>

      <section class="panel legacy-cloud-card">
        <div class="legacy-cloud-title">
          <span>Cloud: {{ authStore.user?.username ?? 'Guest' }}</span>
          <span class="legacy-cloud-badge">{{ backupMeta?.exists ? 'Synced' : 'No backup' }}</span>
        </div>
        <div class="legacy-cloud-meta">
          <div>Local origin: {{ backupMeta?.currentOrigin ?? publicEntry?.origin ?? 'Loading' }}</div>
          <div>Last cloud backup: {{ backupMeta?.updatedAt || workspaceSummary.latestUpdatedAt || 'Not recorded' }}</div>
          <div>Local vs cloud: {{ backupMeta?.summary?.errors ?? workspaceSummary.errors ?? 0 }} errors</div>
          <div>Knowledge nodes: {{ backupMeta?.summary?.knowledgeNodes ?? workspaceSummary.knowledgeNodes ?? 0 }}</div>
        </div>
        <div class="legacy-cloud-actions">
          <a class="legacy-small-link" :href="legacyActionHref('cloud_load')">Cloud Load</a>
          <a class="legacy-small-link" :href="legacyActionHref('cloud_save')">Cloud Save</a>
          <button class="legacy-small-link" type="button" @click="handleLogout">Logout</button>
        </div>
        <div class="legacy-subsection">
          <div class="sidebar-card-title">Local backups</div>
          <ul class="result-list legacy-task-list">
            <li v-for="item in localBackups.slice(0, 3)" :key="item.id">
              <strong>{{ item.label || item.id }}</strong>
              <span>{{ buildLocalBackupReason(item) }}</span>
              <span class="legacy-inline-actions">
                <a class="legacy-secondary-link" :href="buildRestoreBackupHref(item.id)">Restore</a>
                <a class="legacy-secondary-link" :href="buildDeleteBackupHref(item.id)">Delete</a>
              </span>
            </li>
            <li v-if="!localBackups.length">No local backup snapshot yet.</li>
          </ul>
        </div>
      </section>

      <section class="panel legacy-practice-card">
        <a class="legacy-practice-button is-red" :href="legacyActionHref('daily')">
          <span>Daily Practice</span>
          <strong>{{ practiceDaily.items.length }}</strong>
        </a>
        <a class="legacy-practice-button is-blue" :href="legacyActionHref('full')">
          <span>Full Practice</span>
          <strong>{{ practiceOverview.totalErrors }}</strong>
        </a>
        <div class="legacy-progress">
          <div class="legacy-progress-label">
            <span>Today Progress</span>
            <span>{{ practiceDaily.practicedTodayCount }}/{{ dailyProgressDenominator }}</span>
          </div>
          <div class="legacy-progress-bar">
            <div class="legacy-progress-fill" :style="{ width: `${dailyProgressPercent}%` }" />
          </div>
        </div>
      </section>

      <section class="panel legacy-knowledge-card">
        <div class="legacy-search-row">
          <input v-model.trim="searchKeyword" type="text" placeholder="Search questions, notes, or knowledge nodes" />
          <button type="button" @click="runKnowledgeSearch">{{ searching ? 'Searching' : 'Focus tree' }}</button>
        </div>
        <p v-if="searchError" class="form-error">{{ searchError }}</p>
        <div class="sidebar-card-title">Knowledge Tree</div>
        <ul class="legacy-tree-list">
          <li v-for="node in visibleKnowledgeRoots" :key="node.id">
            <button type="button" class="legacy-tree-item" @click="selectKnowledgeNode(node)">
              <span>{{ node.title }}</span>
              <strong>{{ node.children?.length ?? 0 }}</strong>
            </button>
          </li>
          <li v-if="!visibleKnowledgeRoots.length">No knowledge nodes yet.</li>
        </ul>
      </section>
    </aside>

    <section class="workspace-main">
      <article class="panel legacy-hero">
        <div v-if="backupMeta?.exists" class="legacy-sync-toast">Cloud data synced in the background</div>
        <div>
          <div class="eyebrow">HOME</div>
          <h1>Decide what to do first, then move into the workspace</h1>
          <p>Use the home screen to schedule tasks, weak points, and notes before moving into the workspace.</p>
          <p v-if="loadError" class="form-error">{{ loadError }}</p>
        </div>
        <div class="legacy-hero-actions">
          <a class="legacy-primary-link" href="/next/workspace/errors">Open Error Workspace</a>
          <a class="legacy-secondary-link" href="/next/tools/note-editor">Continue Input</a>
        </div>
      </article>

      <section class="workspace-split legacy-summary-grid">
        <article class="panel content-card">
          <h2>What to do today</h2>
          <div class="stats-grid stats-grid--legacy">
            <div class="stat-card">
              <span>Note First</span>
              <strong>{{ practiceOverview.noteFirstCount }}</strong>
            </div>
            <div class="stat-card">
              <span>Direct work</span>
              <strong>{{ practiceOverview.directDoCount }}</strong>
            </div>
            <div class="stat-card">
              <span>Speed Drill</span>
              <strong>{{ practiceOverview.speedDrillCount }}</strong>
            </div>
            <div class="stat-card">
              <span>7d Accuracy</span>
              <strong>{{ recentAccuracyText }}</strong>
            </div>
          </div>

          <div class="today-action-row">
            <a class="chip-button" :class="{ 'is-active': activeTodayTab === 'noteFirst' }" :href="legacyActionHref('note')" @mouseenter="focusTodayTab('noteFirst')">
              Note First
            </a>
            <a class="chip-button" :class="{ 'is-active': activeTodayTab === 'directDo' }" :href="legacyActionHref('direct')" @mouseenter="focusTodayTab('directDo')">
              Direct Work
            </a>
            <a class="chip-button" :class="{ 'is-active': activeTodayTab === 'speedDrill' }" :href="legacyActionHref('speed')" @mouseenter="focusTodayTab('speedDrill')">
              Speed Drill
            </a>
            <a class="chip-button" :href="legacyActionHref('dashboard')">Open full stats</a>
          </div>

          <div class="legacy-action-list">
            <div v-for="(item, index) in workflowAdviceItems" :key="`${index}-${item}`" class="legacy-action-item">
              <strong>{{ buildAdviceTitle(item, index) }}</strong>
              <span>{{ item }}</span>
            </div>
            <div v-if="!workflowAdviceItems.length" class="legacy-action-item">
              <strong>Continue input or open the workspace</strong>
              <span>The home screen only schedules priority. Detailed actions still happen inside the legacy workspace.</span>
            </div>
          </div>

          <ul class="result-list legacy-task-list">
            <li v-for="item in activeTodayItems" :key="item.id || item.question">
              <strong>{{ buildItemTitle(item) }}</strong>
              <span>{{ buildItemReason(item) }}</span>
            </li>
            <li v-if="!activeTodayItems.length">No tasks in this lane.</li>
          </ul>
        </article>

        <article class="panel content-card">
          <h2>Note First Queue</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="item in practiceWorkbench.noteFirstQueue.slice(0, 6)" :key="item.id || item.question">
              <strong>{{ buildItemTitle(item) }}</strong>
              <span>{{ buildItemReason(item) }}</span>
            </li>
            <li v-if="!practiceWorkbench.noteFirstQueue.length">All note-first items have been reviewed today.</li>
          </ul>

          <div class="legacy-subsection">
            <h3>Direct work</h3>
            <ul class="result-list legacy-task-list">
              <li v-for="item in practiceWorkbench.directDoQueue.slice(0, 4)" :key="item.id || item.question">
                <strong>{{ buildItemTitle(item) }}</strong>
                <span>{{ buildItemReason(item) }}</span>
              </li>
              <li v-if="!practiceWorkbench.directDoQueue.length">No direct-work items right now.</li>
            </ul>
          </div>

          <div class="legacy-subsection">
            <h3>Speed drill</h3>
            <ul class="result-list legacy-task-list">
              <li v-for="item in practiceWorkbench.speedDrillQueue.slice(0, 4)" :key="item.id || item.question">
                <strong>{{ buildItemTitle(item) }}</strong>
                <span>{{ buildItemReason(item) }}</span>
              </li>
              <li v-if="!practiceWorkbench.speedDrillQueue.length">No speed-drill items right now.</li>
            </ul>
          </div>
        </article>
      </section>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card">
          <div class="legacy-section-header">
            <h2>Error Preview</h2>
            <span v-if="errorPreviewFallback" class="legacy-inline-hint">No results under current filters, showing recent errors instead.</span>
          </div>
          <div class="search-form">
            <input v-model.trim="errorKeyword" type="text" placeholder="Search question, cause, analysis, type" />
            <button type="button" @click="clearErrorFilters">Clear</button>
          </div>
          <div class="chip-row">
            <button
              v-for="typeName in visibleErrorTypes"
              :key="typeName"
              type="button"
              class="chip-button"
              :class="{ 'is-active': selectedErrorType === typeName }"
              @click="toggleErrorType(typeName)"
            >
              {{ typeName }}
            </button>
          </div>
          <div class="error-workspace-grid">
            <ul class="result-list card-list">
              <li
                v-for="error in displayedErrors"
                :key="error.id || error.question"
                class="selectable-card"
                :class="{ 'is-selected': selectedError?.id === error.id }"
              >
                <button class="selectable-card-button" type="button" @click="selectError(error)">
                  <strong>{{ buildErrorTitle(error) }}</strong>
                  <span>{{ error.question || 'Untitled question' }}</span>
                  <span>{{ error.rootReason || error.errorReason || error.analysis || 'More detail pending' }}</span>
                </button>
              </li>
              <li v-if="!displayedErrors.length">No visible errors yet.</li>
            </ul>

            <div class="panel detail-panel">
              <div class="sidebar-card-title">Error Detail</div>
              <template v-if="selectedError">
                <div class="detail-title">{{ selectedError.question || 'Untitled question' }}</div>
                <div class="fact-list">
                  <div>Type: {{ selectedError.type || 'Uncategorized' }}</div>
                  <div>Subtype: {{ selectedError.subtype || 'Unset' }}</div>
                  <div>Mastery: {{ selectedError.masteryLevel || 'Unset' }}</div>
                  <div>Confidence: {{ selectedError.confidence ?? 0 }}</div>
                  <div>Updated: {{ selectedError.updatedAt || 'Not recorded' }}</div>
                </div>
                <div class="detail-block">
                  <strong>Root Cause</strong>
                  <p>{{ selectedError.rootReason || selectedError.errorReason || 'No root cause yet' }}</p>
                </div>
                <div class="detail-block">
                  <strong>Analysis</strong>
                  <p>{{ selectedError.analysis || 'No analysis yet' }}</p>
                </div>
                <div class="detail-block">
                  <strong>Next step</strong>
                  <p>{{ selectedError.tip || selectedError.nextActionType || 'No next step yet' }}</p>
                </div>
                <div class="legacy-subsection">
                  <a class="legacy-secondary-link" :href="buildEditErrorHref(selectedError)">Open legacy edit modal</a>
                </div>
              </template>
              <p v-else>Select an error on the left to show details here.</p>
            </div>
          </div>
        </article>
      </section>

      <section class="workspace-split legacy-main-grid">
        <article class="panel content-card panel--muted">
          <h2>Current Summary</h2>
          <div class="legacy-action-list">
            <div class="legacy-action-item">
              <strong>Today's task pool {{ visibleTaskPoolCount }}</strong>
              <span>Start from a lightweight overview here instead of loading the full workspace immediately.</span>
            </div>
            <div class="legacy-action-item">
              <strong>Full practice pool {{ practiceOverview.totalErrors }}</strong>
              <span>The full error set, knowledge tree, and practice details continue in the legacy workspace.</span>
            </div>
            <div class="legacy-action-item">
              <strong>{{ runtimeInfo?.label ?? 'Loading runtime' }}</strong>
              <span>{{ publicEntry?.origin ?? backupMeta?.currentOrigin ?? 'Loading current entry' }}</span>
            </div>
          </div>
        </article>

        <article class="panel content-card panel--muted">
          <h2>Weakness Hotspots</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="group in visibleWeaknessGroups" :key="group.name">
              <strong>{{ group.name }}</strong>
              <span>{{ buildWeaknessReason(group) }}</span>
            </li>
            <li v-if="!visibleWeaknessGroups.length">No stable weakness group yet.</li>
          </ul>
        </article>

        <article class="panel content-card panel--muted">
          <h2>Extra reminders</h2>
          <div class="legacy-action-list">
            <div class="legacy-action-item">
              <strong>Total task pool {{ visibleTaskPoolCount }}</strong>
              <span>The home screen decides what to review first, what to do next, and where to spend time pressure.</span>
            </div>
            <div class="legacy-action-item">
              <strong>{{ missingNoteCount ? `${missingNoteCount} items are missing readable notes` : (practiceWorkbench.noteFirstQueue.length ? `${practiceWorkbench.noteFirstQueue.length} items should start with notes` : 'No note gap right now') }}</strong>
              <span>{{ missingNoteCount ? 'These items are routed to note-first review, but the readable note content is still missing.' : (practiceWorkbench.noteFirstQueue.length ? 'These items are method-unstable or concept-unstable, so note review comes first.' : 'You can move straight into direct work or speed drill.' ) }}</span>
            </div>
            <div class="legacy-action-item">
              <strong>{{ practiceWorkbench.speedDrillQueue.length ? `${practiceWorkbench.speedDrillQueue.length} items need speed drill` : 'No visible time-risk items' }}</strong>
              <span>{{ practiceWorkbench.speedDrillQueue.length ? 'Compress time first, then decide whether note review is still needed.' : 'This batch does not mainly fail on timing.' }}</span>
            </div>
          </div>
        </article>
      </section>

      <section v-if="hasKnowledgePreview || hasCodexPreview" class="workspace-split legacy-secondary-grid">
        <article v-if="hasKnowledgePreview" class="panel content-card panel--muted">
          <h2>Knowledge tree preview</h2>
          <div v-if="selectedKnowledgeNode" class="info-block">
            <div class="sidebar-card-title">Current Focus</div>
            <div class="fact-list">
              <div>{{ selectedKnowledgeNode.title }}</div>
              <div>Child nodes: {{ selectedKnowledgeNode.children?.length ?? 0 }}</div>
            </div>
          </div>
          <ul class="result-list legacy-task-list">
            <li v-for="node in visibleKnowledgeChildren" :key="node.id">
              <strong>{{ node.title }}</strong>
              <span>Child nodes {{ node.children?.length ?? 0 }}</span>
            </li>
            <li v-if="selectedKnowledgeNode && !visibleKnowledgeChildren.length">No child nodes under the current node.</li>
            <li v-if="!selectedKnowledgeNode && !knowledgeRoots.length">No knowledge nodes yet.</li>
          </ul>
          <div class="legacy-subsection">
            <a class="legacy-secondary-link" href="/next/workspace/notes">Open Notes Workspace</a>
            <a
              v-if="selectedKnowledgeNode?.id"
              class="legacy-secondary-link"
              :href="buildRecommendedNoteHref(selectedKnowledgeNode.id)"
            >
              Open current note in legacy flow
            </a>
          </div>
        </article>

        <article v-if="hasCodexPreview" class="panel content-card panel--muted">
          <h2>Codex Preview</h2>
          <ul class="result-list legacy-task-list">
            <li v-for="thread in codexThreads.slice(0, 6)" :key="thread.id">
              <strong>{{ thread.title || 'Untitled thread' }}</strong>
              <span>{{ thread.latestMessageText || thread.updatedAt || 'No preview yet' }}</span>
            </li>
          </ul>
          <div class="legacy-subsection">
            <a class="legacy-secondary-link" :href="legacyActionHref('codex')">Open Codex Inbox</a>
          </div>
        </article>
      </section>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card panel--muted">
          <h2>Legacy Workspace Tools</h2>
          <div class="legacy-tool-grid">
            <a v-for="tool in legacyToolActions" :key="tool.key" class="legacy-tool-action" :href="tool.href">
              <strong>{{ tool.title }}</strong>
              <span>{{ tool.description }}</span>
            </a>
          </div>
        </article>
      </section>

      <section class="workspace-split workspace-split--wide">
        <article class="panel content-card panel--muted">
          <h2>Legacy page shortcuts</h2>
          <p>These links open real legacy standalone pages directly, without an iframe layer.</p>
          <div class="legacy-tool-grid">
            <a v-for="tool in bridgeTools" :key="tool.key" class="legacy-tool-action" :href="tool.href">
              <strong>{{ tool.label }}</strong>
              <span>{{ tool.description }}</span>
            </a>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError, apiRequest } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { PublicEntry, RuntimeInfo } from '@/types/auth'
import type {
  BackupMetaResponse,
  CodexThreadsResponse,
  ErrorSummary,
  KnowledgeTreeNode,
  LocalBackupItem,
  LocalBackupsResponse,
  NextHomeContextResponse,
  PracticeDailyResponse,
  PracticeQueueItem,
  PracticeWorkbenchResponse,
} from '@/types/workspace'

type TodayTabKey = 'noteFirst' | 'directDo' | 'speedDrill' | 'review'

const router = useRouter()
const authStore = useAuthStore()

const runtimeInfo = ref<RuntimeInfo | null>(null)
const publicEntry = ref<PublicEntry | null>(null)
const backupMeta = ref<BackupMetaResponse | null>(null)
const localBackups = ref<LocalBackupItem[]>([])
const workspaceSummary = ref<Record<string, number | string | null>>({})
const knowledgeRoots = ref<KnowledgeTreeNode[]>([])
const selectedKnowledgeNode = ref<KnowledgeTreeNode | null>(null)
const allErrors = ref<ErrorSummary[]>([])
const selectedError = ref<ErrorSummary | null>(null)
const errorKeyword = ref('')
const selectedErrorType = ref('')
const activeTodayTab = ref<TodayTabKey>('noteFirst')
const codexThreads = ref<CodexThreadsResponse['threads']>([])
const practiceDaily = ref<PracticeDailyResponse>({
  ok: true,
  items: [],
  practicedTodayCount: 0,
  advice: [],
})
const practiceWorkbench = ref<PracticeWorkbenchResponse>({
  ok: true,
  overview: {
    totalErrors: 0,
    noteFirstCount: 0,
    directDoCount: 0,
    speedDrillCount: 0,
    reviewCount: 0,
    retrainCount: 0,
    stabilizingCount: 0,
    stableCount: 0,
    attemptTrackedCount: 0,
  },
  advice: [],
  workflowAdvice: [],
  reviewQueue: [],
  retrainQueue: [],
  noteFirstQueue: [],
  directDoQueue: [],
  speedDrillQueue: [],
  weaknessGroups: [],
})
const knowledgeResults = ref({
  ok: true,
  nodes: [] as Array<{ id: string; title: string; path: string[]; excerpt?: string }>,
  errors: [],
})
const searchKeyword = ref('')
const searching = ref(false)
const searchError = ref('')
const loadError = ref('')

const bridgeTools = [
  { key: 'legacyRoot', href: '/next/legacy', label: 'Legacy Root', description: 'Open the current legacy main workspace' },
  { key: 'v51Shell', href: '/next/v51', label: 'V51 Shell', description: 'Open the V51 legacy shell entry' },
  { key: 'v53Shell', href: '/next/v53', label: 'V53 Shell', description: 'Open the V53 legacy shell entry' },
  { key: 'shenlun', href: '/next/shenlun', label: 'Shenlun', description: 'Open the legacy Shenlun workspace' },
  { key: 'recommendedNotes', href: '/next/actions/recommended-notes', label: 'Recommended Notes', description: 'Open the legacy recommended notes flow' },
  { key: 'recommendedNotesReturn', href: '/next/actions/recommended-notes/return', label: 'Notes Return', description: 'Return to the legacy recommended notes queue' },
  { key: 'globalSearch', href: '/next/tools/search', label: 'Global Search', description: 'Open the legacy global search page' },
  { key: 'noteEditor', href: '/next/tools/note-editor', label: 'Note Editor', description: 'Open the legacy standalone note editor' },
  { key: 'noteViewer', href: '/next/tools/note-viewer', label: 'Note Viewer', description: 'Open the legacy standalone note viewer' },
  { key: 'processImage', href: '/next/tools/process-image', label: 'Process Image', description: 'Open the legacy process image editor' },
  { key: 'markdownHarness', href: '/next/tools/markdown-harness', label: 'Markdown Harness', description: 'Open the legacy markdown smoke harness' },
  { key: 'processHarness', href: '/next/tools/process-harness', label: 'Process Harness', description: 'Open the legacy process smoke harness' },
  { key: 'quickImport', href: '/next/tools/quick-import', label: 'Quick Import', description: 'Open the legacy quick import entry' },
  { key: 'canvas', href: '/next/tools/canvas', label: 'Canvas', description: 'Open the legacy visual helper canvas' },
] as const
const legacyToolActions = [
  { key: 'history', href: '/next/tools/history', title: 'Practice History', description: 'Open the legacy practice history modal' },
  { key: 'ai_tools', href: '/next/tools/ai', title: 'AI Tools', description: 'Open diagnosis, chat, generation, and summary tools' },
  { key: 'add_modal', href: '/next/tools/add', title: 'Add Modal', description: 'Open the full legacy add modal' },
  { key: 'taskview_errors', href: '/next/workspace/tasks/errors', title: 'Error Task Lane', description: 'Open the legacy workspace focused on error tasks' },
  { key: 'taskview_notes', href: '/next/workspace/tasks/notes', title: 'Notes Task Lane', description: 'Open the legacy workspace focused on note tasks' },
  { key: 'local_backup', href: '/next/tools/backup', title: 'Local Backup', description: 'View and restore local snapshots' },
  { key: 'local_backup_create', href: '/next/tools/backup/create', title: 'Create Backup', description: 'Run the legacy manual local backup flow' },
  { key: 'local_backup_refresh', href: '/next/tools/backup/refresh', title: 'Refresh Backups', description: 'Refresh the legacy local backup list' },
  { key: 'local_backup_restore', href: '/next/tools/backup/restore', title: 'Restore Backup', description: 'Open the legacy restore flow for a specific backup id' },
  { key: 'local_backup_delete', href: '/next/tools/backup/delete', title: 'Delete Backup', description: 'Open the legacy delete flow for a specific backup id' },
  { key: 'export', href: '/next/tools/export', title: 'Export & Print', description: 'Open the legacy export and print tools' },
  { key: 'remark_list', href: '/next/tools/remarks', title: 'Remarks', description: 'Open the global remark list' },
  { key: 'remark_daily_log', href: '/next/tools/remarks/daily-log', title: 'Remark Daily Log', description: 'Insert a daily log block inside the legacy remarks modal' },
  { key: 'daily_journal', href: '/next/tools/journal', title: 'Daily Journal', description: 'Open the daily study journal' },
  { key: 'daily_journal_today', href: '/next/tools/journal/today', title: 'Journal Today', description: 'Jump to today inside the legacy daily journal' },
  { key: 'daily_journal_template', href: '/next/tools/journal/template', title: 'Journal Template', description: 'Insert the legacy journal template' },
  { key: 'global_search', href: '/next/tools/search', title: 'Global Search', description: 'Launch the legacy global search module' },
  { key: 'import', href: '/next/tools/import', title: 'Import Questions', description: 'Open the legacy import entry' },
  { key: 'dir_modal', href: '/next/tools/directory', title: 'Directory Manager', description: 'Open the legacy directory management modal' },
  { key: 'knowledge_move', href: '/next/tools/knowledge-move', title: 'Knowledge Move', description: 'Open the legacy batch knowledge move dialog' },
  { key: 'knowledge_node', href: '/next/tools/knowledge-node', title: 'Knowledge Node', description: 'Open the legacy knowledge node dialog' },
  { key: 'quick_import', href: '/next/tools/quick-import', title: 'Quick Import', description: 'Open the legacy quick import entry' },
  { key: 'type_rules', href: '/next/tools/type-rules', title: 'Type Rules', description: 'Edit the legacy type detection rules' },
  { key: 'claude_helper', href: '/next/tools/claude-helper', title: 'Claude Helper', description: 'Open the legacy Claude helper modal' },
  { key: 'claude_bank', href: '/next/tools/claude-bank', title: 'Claude Bank', description: 'Open the legacy Claude question bank' },
  { key: 'claude_bank_refresh', href: '/next/tools/claude-bank/refresh', title: 'Refresh Claude Bank', description: 'Refresh the legacy Claude bank modal contents' },
  { key: 'canvas', href: '/next/tools/canvas', title: 'Canvas', description: 'Open the legacy canvas helper' },
] as const

const practiceOverview = computed(() => practiceWorkbench.value.overview)
const workflowAdviceItems = computed(() =>
  practiceWorkbench.value.workflowAdvice.length ? practiceWorkbench.value.workflowAdvice : practiceWorkbench.value.advice,
)
const searchedKnowledgeNodes = computed<KnowledgeTreeNode[]>(() =>
  (knowledgeResults.value.nodes ?? []).map((node) => ({
    id: node.id,
    title: node.title,
    children: [],
  })),
)
const visibleKnowledgeRoots = computed(() => {
  if (searchedKnowledgeNodes.value.length) {
    return searchedKnowledgeNodes.value.slice(0, 8)
  }
  return knowledgeRoots.value.slice(0, 8)
})
const visibleKnowledgeChildren = computed(() => {
  if (searchedKnowledgeNodes.value.length) {
    return searchedKnowledgeNodes.value.slice(0, 8)
  }
  if (!selectedKnowledgeNode.value) {
    return knowledgeRoots.value.slice(0, 8)
  }
  return selectedKnowledgeNode.value.children ?? []
})
const activeTodayItems = computed(() => {
  if (activeTodayTab.value === 'noteFirst') {
    return practiceWorkbench.value.noteFirstQueue
  }
  if (activeTodayTab.value === 'directDo') {
    return practiceWorkbench.value.directDoQueue
  }
  if (activeTodayTab.value === 'speedDrill') {
    return practiceWorkbench.value.speedDrillQueue
  }
  return practiceWorkbench.value.reviewQueue
})
const visibleErrorTypes = computed(() => {
  const values = new Set<string>()
  for (const item of allErrors.value) {
    const value = (item.type ?? '').trim()
    if (value) {
      values.add(value)
    }
  }
  return Array.from(values).slice(0, 8)
})
const filteredErrors = computed(() => {
  const keyword = errorKeyword.value.trim().toLowerCase()
  return allErrors.value.filter((item) => {
    if (selectedErrorType.value && item.type !== selectedErrorType.value) {
      return false
    }
    if (selectedKnowledgeNode.value && item.noteNodeId && item.noteNodeId !== selectedKnowledgeNode.value.id) {
      return false
    }
    if (!keyword) {
      return true
    }
    const haystack = [item.type, item.subtype, item.question, item.rootReason, item.errorReason, item.analysis]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(keyword)
  })
})
const errorPreviewFallback = computed(
  () => allErrors.value.length > 0 && filteredErrors.value.length === 0 && Boolean(errorKeyword.value || selectedErrorType.value || selectedKnowledgeNode.value),
)
const displayedErrors = computed(() => {
  if (filteredErrors.value.length) {
    return filteredErrors.value.slice(0, 10)
  }
  if (errorPreviewFallback.value) {
    return allErrors.value.slice(0, 10)
  }
  return []
})
const dailyProgressDenominator = computed(() => Math.max(practiceDaily.value.practicedTodayCount + practiceDaily.value.items.length, 1))
const dailyProgressPercent = computed(() => Math.min(100, Math.round((practiceDaily.value.practicedTodayCount / dailyProgressDenominator.value) * 100)))
const recentAccuracyText = computed(() => {
  const total = practiceOverview.value.attemptTrackedCount
  if (total <= 0) {
    return '0%'
  }
  const stable = practiceOverview.value.stableCount + practiceOverview.value.stabilizingCount
  return `${Math.max(0, Math.min(100, Math.round((stable / total) * 100)))}%`
})
const hasKnowledgePreview = computed(() => knowledgeRoots.value.length > 0 || visibleKnowledgeChildren.value.length > 0)
const hasCodexPreview = computed(() => codexThreads.value.length > 0)
const visibleWeaknessGroups = computed(() => practiceWorkbench.value.weaknessGroups.slice(0, 6))
const visibleTaskPoolCount = computed(
  () =>
    practiceWorkbench.value.noteFirstQueue.length +
    practiceWorkbench.value.directDoQueue.length +
    practiceWorkbench.value.speedDrillQueue.length +
    practiceWorkbench.value.reviewQueue.length,
)
const missingNoteCount = computed(
  () => practiceWorkbench.value.noteFirstQueue.filter((item) => !String(item.noteNodeId || '').trim()).length,
)

watch(displayedErrors, (items) => {
  if (!items.length) {
    selectedError.value = null
    return
  }
  if (!selectedError.value || !items.some((item) => item.id === selectedError.value?.id)) {
    selectedError.value = items[0]
  }
})

function buildItemTitle(item: PracticeQueueItem): string {
  const typeName = item.type?.trim()
  const question = item.question?.trim()
  if (typeName && question) {
    return `${typeName} ${question}`
  }
  return typeName || question || 'Pending item'
}

function buildItemReason(item: PracticeQueueItem): string {
  return item.taskReason || item.lastMistakeType || item.rootReason || item.errorReason || 'Recommended from current practice state'
}

function buildErrorTitle(error: ErrorSummary): string {
  if (error.type && error.subtype) {
    return `${error.type} / ${error.subtype}`
  }
  return error.type || 'Uncategorized'
}

function buildAdviceTitle(item: string, index: number): string {
  const normalized = item.toLowerCase()
  if (normalized.includes('note')) {
    return 'Note First'
  }
  if (normalized.includes('speed') || normalized.includes('time')) {
    return 'Speed Drill'
  }
  if (normalized.includes('direct')) {
    return 'Direct work'
  }
  return `Action ${index + 1}`
}

function buildWeaknessReason(group: { count: number; topType?: string }): string {
  const typeText = group.topType?.trim() ? `, focused on ${group.topType}` : ''
  return `Seen ${group.count} times${typeText}`
}

function buildLocalBackupReason(item: LocalBackupItem): string {
  const createdAt = item.createdAt || 'Unknown time'
  const counts = [`${item.errorCount ?? 0} errors`, `${item.knowledgeNodeCount ?? 0} nodes`]
  return `${createdAt} · ${counts.join(' · ')}`
}

function focusTodayTab(tab: TodayTabKey) {
  activeTodayTab.value = tab
}

function legacyActionHref(action: string): string {
  const normalized = String(action || '').trim()
  if (!normalized) {
    return '/'
  }
  const routeMap: Record<string, string> = {
    quickadd: '/next/actions/quickadd',
    cloud_load: '/next/actions/cloud-load',
    cloud_save: '/next/actions/cloud-save',
    daily: '/next/actions/daily',
    full: '/next/actions/full',
    note: '/next/actions/note',
    recommended_notes: '/next/actions/recommended-notes',
    recommended_notes_return: '/next/actions/recommended-notes/return',
    direct: '/next/actions/direct',
    speed: '/next/actions/speed',
    dashboard: '/next/actions/dashboard',
    codex: '/next/actions/codex',
    taskview_errors: '/next/workspace/tasks/errors',
    taskview_notes: '/next/workspace/tasks/notes',
    local_backup_restore: '/next/tools/backup/restore',
    local_backup_delete: '/next/tools/backup/delete',
    remark_daily_log: '/next/tools/remarks/daily-log',
    quick_import: '/next/tools/quick-import',
    claude_bank_refresh: '/next/tools/claude-bank/refresh',
    canvas: '/next/tools/canvas',
  }
  return routeMap[normalized] ?? `/?home_action=${encodeURIComponent(normalized)}`
}

function buildRecommendedNoteHref(nodeId: string): string {
  const normalized = String(nodeId || '').trim()
  if (!normalized) {
    return '/next/actions/recommended-notes'
  }
  return `/next/actions/recommended-note?nodeId=${encodeURIComponent(normalized)}`
}

function buildEditErrorHref(error: ErrorSummary): string {
  const normalized = String(error.id || '').trim()
  if (!normalized) {
    return '/next/tools/add'
  }
  return `/next/tools/edit?id=${encodeURIComponent(normalized)}`
}

function buildRestoreBackupHref(backupId: string): string {
  const normalized = String(backupId || '').trim()
  if (!normalized) {
    return '/next/tools/backup'
  }
  return `/next/tools/backup/restore?id=${encodeURIComponent(normalized)}`
}

function buildDeleteBackupHref(backupId: string): string {
  const normalized = String(backupId || '').trim()
  if (!normalized) {
    return '/next/tools/backup'
  }
  return `/next/tools/backup/delete?id=${encodeURIComponent(normalized)}`
}

function selectKnowledgeNode(node: KnowledgeTreeNode) {
  selectedKnowledgeNode.value = selectedKnowledgeNode.value?.id === node.id ? null : node
}

function selectError(error: ErrorSummary) {
  selectedError.value = error
}

function clearErrorFilters() {
  errorKeyword.value = ''
  selectedErrorType.value = ''
  selectedKnowledgeNode.value = null
}

function toggleErrorType(typeName: string) {
  selectedErrorType.value = selectedErrorType.value === typeName ? '' : typeName
}

function collectKnowledgeMatches(nodes: KnowledgeTreeNode[], keyword: string, path: string[] = []) {
  const normalized = keyword.trim().toLowerCase()
  const results: Array<{ id: string; title: string; path: string[]; excerpt?: string }> = []
  for (const node of nodes) {
    const nextPath = [...path, node.title]
    const haystack = nextPath.join(' / ').toLowerCase()
    if (haystack.includes(normalized)) {
      results.push({
        id: node.id,
        title: node.title,
        path: nextPath,
      })
    }
    if (node.children?.length) {
      results.push(...collectKnowledgeMatches(node.children, keyword, nextPath))
    }
  }
  return results
}

function applyKnowledgeTree(tree: KnowledgeTreeNode[] | { roots?: KnowledgeTreeNode[] } | undefined) {
  if (Array.isArray(tree)) {
    knowledgeRoots.value = tree
  } else if (tree && Array.isArray(tree.roots)) {
    knowledgeRoots.value = tree.roots
  } else {
    knowledgeRoots.value = []
  }
  if (selectedKnowledgeNode.value && !knowledgeRoots.value.some((node) => node.id === selectedKnowledgeNode.value?.id)) {
    selectedKnowledgeNode.value = null
  }
}

async function runKnowledgeSearch() {
  searchError.value = ''
  if (!searchKeyword.value) {
    knowledgeResults.value = { ok: true, nodes: [], errors: [] }
    return
  }
  searching.value = true
  try {
    knowledgeResults.value = {
      ok: true,
      nodes: collectKnowledgeMatches(knowledgeRoots.value, searchKeyword.value).slice(0, 8),
      errors: [],
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      searchError.value = error.message
    } else {
      searchError.value = 'Search failed. Please try again later.'
    }
  } finally {
    searching.value = false
  }
}

async function loadWorkspaceContext() {
  loadError.value = ''

  void apiRequest<RuntimeInfo>('/api/runtime-info')
    .then((payload) => {
      runtimeInfo.value = payload
    })
    .catch(() => {
      runtimeInfo.value = null
    })

  void apiRequest<PublicEntry>('/api/public-entry')
    .then((payload) => {
      publicEntry.value = payload
    })
    .catch(() => {
      publicEntry.value = null
    })

  try {
    const homeContext = await apiRequest<NextHomeContextResponse>('/api/next/home-context?limit=6')
    practiceWorkbench.value = homeContext.workbench
    practiceDaily.value = homeContext.daily
    workspaceSummary.value = homeContext.summary ?? {}
    allErrors.value = homeContext.errors ?? []
    applyKnowledgeTree(homeContext.knowledgeTree)
    selectedKnowledgeNode.value = null

    window.setTimeout(() => {
      void apiRequest<BackupMetaResponse>('/api/backup?meta=true')
        .then((payload) => {
          backupMeta.value = payload
        })
        .catch(() => {
          backupMeta.value = null
        })
    }, 200)

    window.setTimeout(() => {
      void apiRequest<LocalBackupsResponse>('/api/local-backups')
        .then((payload) => {
          localBackups.value = payload.items ?? []
        })
        .catch(() => {
          localBackups.value = []
        })
    }, 300)

    window.setTimeout(() => {
      void apiRequest<CodexThreadsResponse>('/api/codex/threads')
        .then((payload) => {
          codexThreads.value = payload.threads
        })
        .catch(() => {
          codexThreads.value = []
        })
    }, 800)
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      await router.push({ name: 'login' })
      return
    }
    loadError.value = error instanceof Error ? error.message : 'Workspace data failed to load'
    knowledgeRoots.value = []
    allErrors.value = []
    selectedKnowledgeNode.value = null
    selectedError.value = null
    localBackups.value = []
  }
}

async function handleLogout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}

onMounted(() => {
  void loadWorkspaceContext()
})
</script>

