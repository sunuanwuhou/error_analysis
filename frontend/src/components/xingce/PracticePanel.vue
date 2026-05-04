<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'

const store = useXingceStore()

onMounted(() => {
  store.loadPracticePanel()
})

const progressPct = computed(() => {
  if (!store.todayTotal) return 0
  return Math.round((store.todayDone / store.todayTotal) * 100)
})

const emit = defineEmits<{
  startQuiz: [mode: 'daily' | 'full' | 'review' | 'retrain']
  startRandomNote: []
}>()
</script>

<template>
  <div class="pp">
    <!-- 练习按钮行 -->
    <div class="pp-btns">
      <button class="pp-btn pp-daily" @click="emit('startQuiz', 'daily')">
        <span class="pp-btn-label">今日训练</span>
        <span v-if="store.quizBadge > 0" class="pp-badge">{{ store.quizBadge }}</span>
      </button>
      <button class="pp-btn pp-full" @click="emit('startQuiz', 'full')">
        <span class="pp-btn-label">全量练习</span>
        <span v-if="store.errors.filter(e => e.status !== 'mastered').length > 0" class="pp-badge">
          {{ store.errors.filter(e => e.status !== 'mastered').length }}
        </span>
      </button>
      <button class="pp-btn pp-note" @click="emit('startRandomNote')">
        <span class="pp-btn-label">随机笔记</span>
      </button>
    </div>

    <!-- 今日进度 -->
    <div v-if="store.todayTotal > 0" class="pp-progress">
      <div class="pp-progress-label">
        <span>今日进度</span>
        <span>{{ store.todayDone }}/{{ store.todayTotal }}</span>
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
  gap: 8px;
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

/* 今日进度 */
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
</style>
