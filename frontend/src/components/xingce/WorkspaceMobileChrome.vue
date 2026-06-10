<script setup lang="ts">
import { computed } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'

const props = defineProps<{
  mainTab: 'notes' | 'errors'
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  toggleSidebar: []
  closeSidebar: []
  setTab: [tab: 'notes' | 'errors']
  openAdd: []
  startReview: []
}>()

const store = useXingceStore()

const headerTitle = computed(() => (props.mainTab === 'notes' ? '学习笔记' : '错题列表'))

const reviewBadge = computed(() => store.quizBadge || 0)
</script>

<template>
  <div class="v53-mobile-topbar">
    <div class="v53-mobile-topbar-left">
      <button
        type="button"
        class="v53-icon-btn"
        aria-label="打开目录"
        @click="emit('toggleSidebar')"
      >
        ☰
      </button>
      <div class="v53-mobile-title">
        <div class="v53-mobile-title-main">{{ headerTitle }}</div>
        <div class="v53-mobile-title-sub">Ashore 5.3</div>
      </div>
    </div>
    <div class="v53-mobile-topbar-right">
      <button type="button" class="v53-icon-btn" aria-label="快速录题" @click="emit('openAdd')">＋</button>
      <button type="button" class="v53-icon-btn" aria-label="保存到云端" @click="store.flushSave()">☁</button>
    </div>
  </div>

  <div class="mobile-sidebar-mask" @click="emit('closeSidebar')" />

  <div class="v53-mobile-bottombar">
    <button
      type="button"
      class="v53-quick-btn"
      :class="{ active: mainTab === 'notes' }"
      @click="emit('setTab', 'notes')"
    >
      <strong>笔记</strong>
      <span>知识区</span>
    </button>
    <button
      type="button"
      class="v53-quick-btn"
      :class="{ active: mainTab === 'errors' }"
      @click="emit('setTab', 'errors')"
    >
      <strong>错题</strong>
      <span>列表区</span>
    </button>
    <button type="button" class="v53-quick-btn" @click="emit('openAdd')">
      <strong>录题</strong>
      <span>新建</span>
    </button>
    <button type="button" class="v53-quick-btn" @click="emit('startReview')">
      <strong>复习</strong>
      <span class="v53-badge">{{ reviewBadge }}</span>
    </button>
  </div>
</template>
