<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ErrorEntry } from '@/api/xingce'
import { xingceApi } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'

const props = defineProps<{ entry: ErrorEntry }>()
const emit = defineEmits<{ close: [] }>()
const store = useXingceStore()

const selected = ref<string | null>(null)
const submitted = ref(false)
const saving = ref(false)
const startTime = Date.now()

const options = computed(() =>
  props.entry.options
    ? props.entry.options.split(/\n|\|/).map(s => s.trim()).filter(Boolean)
    : ['A', 'B', 'C', 'D']
)
const isCorrect = computed(() => selected.value === props.entry.answer)

async function submit() {
  if (!selected.value || submitted.value) return
  submitted.value = true
  saving.value = true
  const durationSec = Math.round((Date.now() - startTime) / 1000)
  try {
    await xingceApi.logAttempt({
      errorId: props.entry.id,
      correct: isCorrect.value,
      durationSec,
    })
    store.invalidatePracticeSummaries([props.entry.id])
    store.queuePracticeSummaries([props.entry.id])
    // 更新掌握度
    if (isCorrect.value) {
      const next: Record<string, ErrorEntry['masteryLevel']> = {
        not_mastered: 'fuzzy', fuzzy: 'mastered', mastered: 'mastered'
      }
      store.updateError(props.entry.id, {
        masteryLevel: next[props.entry.masteryLevel ?? 'not_mastered'],
        actualDurationSec: durationSec,
      })
    } else {
      store.updateError(props.entry.id, {
        masteryLevel: 'not_mastered',
        actualDurationSec: durationSec,
      })
    }
  } catch { /* 静默失败，不影响 UI */ }
  saving.value = false
}
</script>

<template>
  <div class="pm-overlay" @click.self="emit('close')">
    <div class="pm">
      <div class="pm-header">
        <span class="pm-type">{{ entry.type }} › {{ entry.subtype }}</span>
        <button class="pm-close" @click="emit('close')">✕</button>
      </div>

      <div class="pm-question">{{ entry.question }}</div>

      <div class="pm-options">
        <button
          v-for="(opt, i) in options"
          :key="i"
          class="pm-opt"
          :class="{
            selected: selected === String.fromCharCode(65 + i) && !submitted,
            correct:  submitted && String.fromCharCode(65 + i) === entry.answer,
            wrong:    submitted && selected === String.fromCharCode(65 + i) && !isCorrect,
          }"
          :disabled="submitted"
          @click="selected = String.fromCharCode(65 + i)"
        >{{ opt }}</button>
      </div>

      <div v-if="!submitted" class="pm-footer">
        <button class="pm-btn primary" :disabled="!selected" @click="submit">提交</button>
        <button class="pm-btn" @click="emit('close')">放弃</button>
      </div>

      <div v-else class="pm-result">
        <div class="pm-verdict" :class="isCorrect ? 'ok' : 'fail'">
          {{ isCorrect ? '✓ 正确' : '✕ 错误，正确答案：' + entry.answer }}
        </div>
        <div v-if="entry.analysis" class="pm-analysis">{{ entry.analysis }}</div>
        <button class="pm-btn primary" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pm-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.pm {
  background: #fff;
  border-radius: 12px;
  width: min(680px, 94vw);
  max-height: 88vh;
  overflow-y: auto;
  padding: 24px;
  display: flex; flex-direction: column; gap: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
}
.pm-header { display: flex; justify-content: space-between; align-items: center; }
.pm-type { font-size: 12px; color: #94a3b8; }
.pm-close { background: none; border: none; font-size: 16px; color: #94a3b8; cursor: pointer; }

.pm-question { font-size: 15px; line-height: 1.8; color: #1e293b; white-space: pre-wrap; }

.pm-options { display: flex; flex-direction: column; gap: 8px; }
.pm-opt {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}
.pm-opt:hover:not(:disabled) { border-color: #4a6cf7; background: #eef2ff; }
.pm-opt.selected { border-color: #4a6cf7; background: #eef2ff; }
.pm-opt.correct  { border-color: #16a34a; background: #f0fdf4; color: #15803d; font-weight: 600; }
.pm-opt.wrong    { border-color: #dc2626; background: #fff1f0; color: #b91c1c; }
.pm-opt:disabled { cursor: default; }

.pm-footer, .pm-result { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pm-btn {
  padding: 8px 20px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 14px;
  cursor: pointer;
}
.pm-btn.primary { background: #4a6cf7; color: #fff; border-color: #4a6cf7; }
.pm-btn:disabled { opacity: .5; cursor: default; }

.pm-verdict { font-size: 15px; font-weight: 600; padding: 8px 12px; border-radius: 6px; }
.pm-verdict.ok   { background: #f0fdf4; color: #15803d; }
.pm-verdict.fail { background: #fff1f0; color: #b91c1c; }
.pm-analysis { font-size: 13px; color: #475569; background: #f8fafc; padding: 10px 14px; border-radius: 6px; line-height: 1.7; white-space: pre-wrap; flex: 1 1 100%; }
</style>
