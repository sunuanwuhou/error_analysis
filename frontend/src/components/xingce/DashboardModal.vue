<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { xingceApi } from '@/api/xingce'

const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const err = ref('')
const insights = ref<Record<string, unknown>>({})

async function load() {
  loading.value = true
  err.value = ''
  try {
    insights.value = await xingceApi.getInsights(12)
  } catch (e) {
    err.value = String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <Teleport to="body">
    <div class="db-backdrop" @click.self="emit('close')">
      <div class="db-modal">
        <div class="db-header">
          <span>学习统计</span>
          <button class="db-close" @click="emit('close')">×</button>
        </div>
        <div class="db-body">
          <div v-if="loading" class="db-empty">加载中…</div>
          <div v-else-if="err" class="db-empty db-err">{{ err }}</div>
          <template v-else>
            <div class="db-card">
              <div class="db-row"><span>任务建议数</span><span>{{ (insights.advice as unknown[])?.length ?? 0 }}</span></div>
              <div class="db-row"><span>待复盘</span><span>{{ (insights.reviewQueue as unknown[])?.length ?? 0 }}</span></div>
              <div class="db-row"><span>待复训</span><span>{{ (insights.retrainQueue as unknown[])?.length ?? 0 }}</span></div>
              <div class="db-row"><span>今日训练队列</span><span>{{ (insights.dailyQueue as unknown[])?.length ?? 0 }}</span></div>
            </div>

            <div class="db-card">
              <div class="db-title">弱项类型</div>
              <div v-if="!((insights.weakestTypes as unknown[])?.length)" class="db-empty-small">暂无</div>
              <div v-else class="db-list">
                <div v-for="(it, i) in (insights.weakestTypes as Record<string, unknown>[])" :key="i" class="db-list-item">
                  <span>{{ String(it.name ?? '-') }}</span>
                  <span>{{ Number(it.count ?? 0) }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.db-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; z-index: 1100; }
.db-modal { width: min(520px, 94vw); max-height: 86vh; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 18px 44px rgba(0,0,0,.2); display: flex; flex-direction: column; }
.db-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 14px; font-weight: 700; color: #111827; }
.db-close { border: none; width: 24px; height: 24px; border-radius: 999px; background: #f1f5f9; cursor: pointer; }
.db-body { padding: 12px; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
.db-empty { text-align: center; color: #64748b; padding: 20px 0; }
.db-err { color: #dc2626; }
.db-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
.db-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 8px; }
.db-row { display: flex; justify-content: space-between; font-size: 13px; color: #475569; padding: 3px 0; }
.db-list { display: flex; flex-direction: column; gap: 4px; }
.db-list-item { display: flex; justify-content: space-between; font-size: 12px; color: #475569; background: #f8fafc; border-radius: 6px; padding: 5px 8px; }
.db-empty-small { font-size: 12px; color: #94a3b8; }
</style>
