<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useXingceStore } from '@/stores/xingceStore'
import { xingceApi } from '@/api/xingce'
import MoreMenu from './MoreMenu.vue'

const store = useXingceStore()

onMounted(() => {
  store.loadMe()
  store.loadPracticePanel()
})

const progressText = computed(() => {
  const done = store.todayDone || 0
  const total = store.todayTotal || 0
  return `${done}/${total}`
})

const progressPct = computed(() => {
  const total = store.todayTotal || 0
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round(((store.todayDone || 0) / total) * 100)))
})

const dailyBadge = computed(() => store.quizBadge || 0)
const fullBadge = computed(() => store.eligibleFullPracticeCount)

const cloudDetailsExpanded = ref(false)

function toggleCloudDetails() {
  cloudDetailsExpanded.value = !cloudDetailsExpanded.value
}

const cloudUserLabel = computed(() => {
  const u = store.currentUser?.username
  return u ? `Cloud: ${u}` : 'Cloud: offline'
})

const cloudSyncBadgeClass = computed(() => {
  if (store.saving) return 'saving'
  if (store.loadError) return 'error'
  return 'idle'
})

const cloudSyncBadgeText = computed(() => {
  if (store.saving) return '保存中'
  if (store.loadError) return '错误'
  return 'idle'
})

function fmtLocalTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return String(iso)
  }
}

const emit = defineEmits<{
  startQuiz: [mode: 'daily' | 'full' | 'review' | 'retrain']
  startRandomNote: []
  openAdd: []
  openImport: []
  openMarkdownEditor: []
  openHistory: []
  openTypeRules: []
}>()

function goModuleHome() {
  window.location.href = '/?portal=1'
}

async function logout() {
  if (!confirm('确定退出登录？')) return
  try {
    await xingceApi.logout()
  } catch { /* ignore */ }
  window.location.href = '/login.html'
}
</script>

<template>
  <template v-if="!store.knowledgeFocusMode">
    <div class="sidebar-tools">
      <div class="sidebar-tools-row sidebar-module-portal-slot">
        <button type="button" class="btn btn-module-portal-hero" @click="goModuleHome">
          <span class="btn-module-portal-main">模块首页</span>
          <span class="btn-module-portal-sub">选择行测 / 申论模块</span>
        </button>
      </div>
      <div class="sidebar-tools-row">
        <button type="button" class="btn btn-primary" @click="emit('openAdd')">+ 添加</button>
        <button type="button" class="btn btn-secondary" @click="emit('openImport')">导入错题</button>
        <MoreMenu
          @open-import="emit('openImport')"
          @random-note="emit('startRandomNote')"
          @open-markdown-editor="emit('openMarkdownEditor')"
          @open-history="emit('openHistory')"
          @open-type-rules="emit('openTypeRules')"
        />
      </div>

      <div class="cloud-controls sidebar-cloud-controls">
        <div class="cloud-meta">
          <div class="cloud-status-line">
            <span style="font-size:12px;color:#666">{{ cloudUserLabel }}</span>
            <span class="cloud-status-badge" :class="cloudSyncBadgeClass">{{ cloudSyncBadgeText }}</span>
            <button
              type="button"
              class="cloud-details-toggle"
              style="display:inline-block"
              @click="toggleCloudDetails"
            >
              {{ cloudDetailsExpanded ? '收起' : '详情' }}
            </button>
          </div>
          <div class="cloud-status-hint" style="display:block">Local cache is per origin.</div>
        </div>
        <div v-if="cloudDetailsExpanded" class="cloud-origin-list expanded" style="display:block">
          <p style="margin:2px 0;font-size:9px;color:#64748b">
            最后推送（Cloud Save）：<strong>{{ fmtLocalTime(store.lastSavedAt) }}</strong>
          </p>
          <p style="margin:2px 0;font-size:9px;color:#64748b">
            最后拉取（Cloud Load）：<strong>{{ fmtLocalTime(store.lastPulledAt) }}</strong>
          </p>
          <p style="margin:4px 0 0;font-size:8px;color:#94a3b8;line-height:1.35">
            推送时间为本地保存并入云成功的时刻；拉取时间为最近一次从云端加载的时刻。
          </p>
        </div>
        <p style="margin:2px 0;font-size:10px;color:#94a3b8">同步：增量推送错题与知识树节点</p>
        <div class="sidebar-tools-row sidebar-cloud-actions">
          <button type="button" class="btn btn-secondary" @click="store.load()">Cloud Load</button>
          <button type="button" class="btn btn-secondary" @click="store.flushSave()">Cloud Save</button>
          <button type="button" class="btn btn-secondary" @click="logout">Logout</button>
        </div>
      </div>
    </div>

    <div class="quiz-block">
      <button type="button" class="quiz-btn" @click="emit('startQuiz', 'daily')">
        <span>今日训练</span>
        <span class="badge">{{ dailyBadge }}</span>
      </button>
      <button type="button" class="quiz-btn full-practice" @click="emit('startQuiz', 'full')">
        <span>随机一个模块出题</span>
        <span class="badge">{{ fullBadge }}</span>
      </button>
      <button
        v-if="store.reviewBadge > 0"
        type="button"
        class="quiz-btn review-queue"
        @click="emit('startQuiz', 'review')"
      >
        <span>待复盘</span>
        <span class="badge">{{ store.reviewBadge }}</span>
      </button>
      <button
        v-if="store.retrainBadge > 0"
        type="button"
        class="quiz-btn retrain-queue"
        @click="emit('startQuiz', 'retrain')"
      >
        <span>待复训</span>
        <span class="badge">{{ store.retrainBadge }}</span>
      </button>
      <button type="button" class="quiz-btn random-note" @click="emit('startRandomNote')">
        <span>随机笔记</span>
      </button>
      <RouterLink class="quiz-btn bank-drill" :to="{ name: 'XingceBankDrill' }">
        <span>模块随机练</span>
      </RouterLink>
      <p v-if="store.errors.length !== fullBadge" style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-align:center;line-height:1.35">
        全库共 {{ store.errors.length }} 题，全量练习为未掌握题
      </p>
      <div class="today-progress">
        <div class="prog-label">
          <span>今日进度</span><span>{{ progressText }}</span>
        </div>
        <div class="prog-bar-bg">
          <div class="prog-bar-fill" :style="{ width: progressPct + '%' }" />
        </div>
      </div>
    </div>
  </template>
</template>
