<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import { xingceApi } from '@/api/xingce'
import MoreMenu from './MoreMenu.vue'

const store = useXingceStore()
const cloudDetailsOpen = ref(false)

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

const cloudUserLabel = computed(() => {
  const u = store.currentUser?.username
  return u ? `Cloud: ${u}` : 'Cloud: offline'
})

const cloudSyncBadge = computed(() => {
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
  window.location.href = '/'
}

function goShenlunWorkbench() {
  window.location.href = '/new/shenlun'
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
  <div class="pp quiz-block">
    <div class="pp-portal-block">
      <button type="button" class="pp-module-hero" @click="goModuleHome">
        <span class="pp-module-hero-main">模块首页</span>
        <span class="pp-module-hero-sub">点击进入 · 门户选行测 / 申论</span>
      </button>
      <button type="button" class="pp-shenlun-pill" @click="goShenlunWorkbench">申论工作台 →</button>
    </div>

    <div class="pp-actions">
      <button type="button" class="pp-action-btn add" @click="emit('openAdd')">+ 添加</button>
      <button type="button" class="pp-action-btn" @click="emit('openImport')">导入错题</button>
      <MoreMenu
        @open-import="emit('openImport')"
        @random-note="emit('startRandomNote')"
        @open-markdown-editor="emit('openMarkdownEditor')"
        @open-history="emit('openHistory')"
        @open-type-rules="emit('openTypeRules')"
      />
    </div>

    <div class="pp-cloud-card">
      <div class="pp-cloud-line">
        <span class="pp-cloud-user-line">{{ cloudUserLabel }}</span>
        <span class="pp-cloud-status-badge" :class="cloudSyncBadge">{{ cloudSyncBadgeText }}</span>
        <button type="button" class="pp-cloud-details-btn" @click="cloudDetailsOpen = !cloudDetailsOpen">
          {{ cloudDetailsOpen ? '收起' : '详情' }}
        </button>
      </div>
      <p class="pp-cloud-hint">Local cache is per origin.</p>
      <div v-if="cloudDetailsOpen" class="pp-cloud-details">
        <p class="pp-cloud-meta">最后推送（Cloud Save）：<span class="pp-ts">{{ fmtLocalTime(store.lastSavedAt) }}</span></p>
        <p class="pp-cloud-meta">最后拉取（Cloud Load）：<span class="pp-ts">{{ fmtLocalTime(store.lastPulledAt) }}</span></p>
        <p class="pp-cloud-meta-note">推送时间为本地保存并入云成功的时刻；拉取时间为最近一次从云端加载的时刻。</p>
      </div>
      <p class="pp-cloud-desc">同步：增量推送错题与知识树节点</p>
      <div class="pp-cloud-row">
        <button type="button" class="pp-cloud-btn" @click="store.load()">Cloud Load</button>
        <button type="button" class="pp-cloud-btn" @click="store.flushSave()">Cloud Save</button>
        <button type="button" class="pp-cloud-btn" @click="logout">Logout</button>
      </div>
    </div>

    <!-- 练习按钮 -->
    <div class="pp-btns">
      <button type="button" class="pp-btn pp-daily" @click="emit('startQuiz', 'daily')">
        <span class="pp-btn-label">今日训练</span>
        <span class="pp-badge">{{ dailyBadge }}</span>
      </button>
      <button type="button" class="pp-btn pp-full" @click="emit('startQuiz', 'full')">
        <span class="pp-btn-label">全量练习</span>
        <span class="pp-badge">{{ fullBadge }}</span>
      </button>
      <button
        v-if="store.reviewBadge > 0"
        type="button"
        class="pp-btn pp-review"
        @click="emit('startQuiz', 'review')"
      >
        <span class="pp-btn-label">待复盘</span>
        <span class="pp-badge">{{ store.reviewBadge }}</span>
      </button>
      <button
        v-if="store.retrainBadge > 0"
        type="button"
        class="pp-btn pp-retrain"
        @click="emit('startQuiz', 'retrain')"
      >
        <span class="pp-btn-label">待复训</span>
        <span class="pp-badge">{{ store.retrainBadge }}</span>
      </button>
      <button type="button" class="pp-btn pp-note" @click="emit('startRandomNote')">
        <span class="pp-btn-label">随机笔记</span>
      </button>
    </div>
    <p v-if="store.errors.length !== fullBadge" class="pp-full-hint">
      全库共 {{ store.errors.length }} 题，全量练习为未掌握题
    </p>

    <!-- 今日进度 -->
    <div class="pp-progress">
      <div class="pp-progress-label">
        <span>今日进度</span><span>{{ progressText }}</span>
      </div>
      <div class="pp-progress-bar">
        <div class="pp-progress-fill" :style="{ width: progressPct + '%' }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pp {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pp-portal-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pp-module-hero {
  width: 100%;
  border: none;
  border-radius: 14px;
  padding: 12px 14px;
  min-height: 52px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: linear-gradient(135deg, #4338ca 0%, #4f46e5 42%, #7c3aed 100%);
  color: #fff;
  font: inherit;
  box-shadow: 0 8px 22px rgb(79 70 229 / 0.35);
  transition: filter 0.14s ease, transform 0.12s ease;
}

.pp-module-hero:hover {
  filter: brightness(1.06);
}

.pp-module-hero:active {
  transform: scale(0.99);
}

.pp-module-hero-main {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-shadow: 0 1px 0 rgb(0 0 0 / 0.2);
}

.pp-module-hero-sub {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.95;
}

.pp-shenlun-pill {
  align-self: stretch;
  min-height: 38px;
  border: 1px solid #cbd5e1;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  color: #0f766e;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.pp-shenlun-pill:hover {
  border-color: #14b8a6;
  background: #f0fdfa;
}

.pp-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.pp-action-btn {
  border: 1px solid #d9dee5;
  background: #fff;
  color: #475569;
  border-radius: 6px;
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
  white-space: nowrap;
}

.pp-action-btn.add {
  background: #e25743;
  border-color: #e25743;
  color: #fff;
}

.pp-cloud-card {
  border: 1px solid #d9dee5;
  border-radius: 10px;
  background: #f8fafc;
  padding: 8px 10px;
}

.pp-cloud-line {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #666;
}
.pp-cloud-user-line { flex: 1; min-width: 0; }
.pp-cloud-status-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
  text-transform: none;
}
.pp-cloud-status-badge.saving { background: #fff7e6; color: #d46b08; border-color: #ffd591; }
.pp-cloud-status-badge.error { background: #fff1f0; color: #cf1322; border-color: #ffccc7; }
.pp-cloud-details-btn {
  font-size: 10px;
  border: 1px solid #d9dee5;
  background: #fff;
  border-radius: 6px;
  padding: 1px 6px;
  cursor: pointer;
  color: #64748b;
}
.pp-cloud-hint {
  font-size: 9px;
  line-height: 1.35;
  color: #94a3b8;
  margin: 4px 0 0;
}
.pp-cloud-details {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.pp-cloud-meta {
  font-size: 9px;
  color: #64748b;
  margin: 0;
  line-height: 1.35;
}
.pp-ts { color: #334155; }
.pp-cloud-meta-note { font-size: 8px; color: #94a3b8; margin: 4px 0 0; line-height: 1.35; }

.pp-cloud-desc {
  font-size: 10px;
  color: #94a3b8;
  margin: 2px 0;
}

.pp-cloud-row {
  margin-top: 6px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.pp-cloud-btn {
  border: 1px solid #d9dee5;
  background: #fff;
  color: #475569;
  border-radius: 999px;
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
}

.pp-btns {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.pp-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  transition: opacity 0.15s;
}
.pp-btn:hover { opacity: 0.88; }
.pp-btn:active { opacity: 0.75; }

.pp-daily { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.pp-full  { background: linear-gradient(135deg, #3498db, #2471a3); }
.pp-review { background: linear-gradient(135deg, #f97316, #c2410c); }
.pp-retrain { background: linear-gradient(135deg, #9333ea, #6b21a8); }
.pp-note  { background: linear-gradient(135deg, #16a34a, #15803d); }

.pp-btn-label { flex: 1; text-align: left; }

.pp-badge {
  background: rgba(255,255,255,0.35);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 8px;
  min-width: 20px;
  text-align: center;
}

.pp-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pp-progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #64748b;
}
.pp-progress-bar {
  height: 5px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}
.pp-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a6cf7, #7c3aed);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.pp-full-hint {
  margin: 0 0 2px;
  font-size: 10px;
  line-height: 1.35;
  color: #94a3b8;
  text-align: center;
}
</style>
