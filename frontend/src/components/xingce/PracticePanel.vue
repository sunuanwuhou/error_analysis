<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import { xingceApi } from '@/api/xingce'
import MoreMenu from './MoreMenu.vue'

const store = useXingceStore()

onMounted(() => {
  store.loadMe()
  store.loadPracticePanel()
})

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
  startRandomNote: []
  openAdd: []
  openImport: []
  openMarkdownEditor: []
  openHistory: []
  openTypeRules: []
  openDir: []
  openClaudeBank: []
  openClaudeImport: []
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
          @open-dir="emit('openDir')"
          @open-claude-bank="emit('openClaudeBank')"
          @open-claude-import="emit('openClaudeImport')"
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
          <button type="button" class="btn btn-secondary" @click="store.load({ force: true })">Cloud Load</button>
          <button type="button" class="btn btn-secondary" @click="store.flushSave()">Cloud Save</button>
          <button type="button" class="btn btn-secondary" @click="logout">Logout</button>
        </div>
      </div>
    </div>
  </template>
</template>
