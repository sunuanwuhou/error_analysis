<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SuitePracticeRecordRow } from '@/api/suiteBank'
import { suiteBankApi } from '@/api/suiteBank'
import { practiceRecordStatusLabel } from '@/lib/suitePracticeCloudSync'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** 打开弹窗时默认选中的 Tab */
    initialTab?: 'paper' | 'module'
  }>(),
  { initialTab: 'paper' },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const tab = ref<'paper' | 'module'>('paper')
const practiceRecordsPaper = ref<SuitePracticeRecordRow[]>([])
const practiceRecordsModule = ref<SuitePracticeRecordRow[]>([])
const loading = ref(false)

const activeRecords = computed(() =>
  tab.value === 'paper' ? practiceRecordsPaper.value : practiceRecordsModule.value,
)

const emptyHint = computed(() =>
  tab.value === 'paper'
    ? '暂无套卷练习记录。做题模式中会定时上传进度；交卷后记为「已交卷」。'
    : '暂无模块随机练记录。做题中会自动同步云端，交卷后记为「已交卷」。',
)

watch(
  () => props.open,
  async v => {
    if (!v) return
    tab.value = props.initialTab
    await refresh()
  },
)

async function refresh() {
  loading.value = true
  try {
    const [paperRows, moduleRows] = await Promise.all([
      suiteBankApi.listPracticeRecords(80, { practiceSubtype: 'paper_exam' }),
      suiteBankApi.listPracticeRecords(80, { practiceSubtype: 'bank_module_drill' }),
    ])
    practiceRecordsPaper.value = paperRows
    practiceRecordsModule.value = moduleRows
  } catch (e) {
    practiceRecordsPaper.value = []
    practiceRecordsModule.value = []
    const msg = String((e as Error)?.message || e)
    if (msg && msg !== 'unauthorized') {
      console.warn('suite practice records load failed', e)
    }
  } finally {
    loading.value = false
  }
}

function close() {
  emit('update:open', false)
}

function formatPracticeRecordAt(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

function formatPracticeDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}时${rm}分${r}秒`
  }
  if (m) return `${m}分${r}秒`
  return `${r}秒`
}

defineExpose({ refresh })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="sb-pr-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sb-pr-dialog-title"
    >
      <div class="sb-pr-backdrop" @click="close" />
      <div class="sb-pr-panel">
        <div class="sb-pr-head">
          <h2 id="sb-pr-dialog-title" class="sb-pr-title">做题记录</h2>
          <button type="button" class="btn btn-ghost sb-pr-close" @click="close">关闭</button>
        </div>
        <div class="sb-pr-body">
          <slot name="prepend" />
          <section class="sb-pr-history">
            <div class="sb-pr-tabs" role="tablist">
              <button
                type="button"
                class="sb-pr-tab"
                :class="{ 'sb-pr-tab--active': tab === 'paper' }"
                @click="tab = 'paper'"
              >
                套卷练习
              </button>
              <button
                type="button"
                class="sb-pr-tab"
                :class="{ 'sb-pr-tab--active': tab === 'module' }"
                @click="tab = 'module'"
              >
                套卷模块
              </button>
            </div>
            <p class="sb-pr-section-hint sb-pr-history-hint">
              做题过程中约每 45 秒自动同步到云端（登录账号），无需交卷。
            </p>
            <p v-if="loading" class="sb-pr-muted">加载中…</p>
            <template v-else>
              <div v-if="activeRecords.length" class="sb-pr-table-wrap">
                <table class="sb-pr-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>{{ tab === 'paper' ? '套卷' : '模块练' }}</th>
                      <th>状态</th>
                      <th>结果</th>
                      <th>用时</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="rec in activeRecords" :key="rec.id">
                      <td>{{ formatPracticeRecordAt(rec.updated_at || rec.created_at) }}</td>
                      <td>
                        <div class="sb-pr-paper">{{ rec.paper_title || rec.paper_id }}</div>
                        <div class="sb-pr-folder">{{ rec.paper_folder }}</div>
                      </td>
                      <td>{{ practiceRecordStatusLabel(rec.record_status) }}</td>
                      <td>
                        ✓ {{ rec.correct_count }}　✗ {{ rec.wrong_count }}　⊙ {{ rec.unanswered_count }}
                      </td>
                      <td>{{ formatPracticeDuration(rec.duration_sec) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="sb-pr-muted">{{ emptyHint }}</p>
            </template>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.sb-pr-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}
.sb-pr-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
}
.sb-pr-panel {
  position: relative;
  z-index: 1;
  width: min(640px, 100%);
  max-height: min(80vh, 720px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
}
.sb-pr-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sb-pr-section-head {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 800;
  color: #475569;
}
.sb-pr-section-hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.55;
  color: #94a3b8;
}
.sb-pr-history-hint {
  padding: 0 18px;
  margin-top: 4px;
}
.sb-pr-tabs {
  display: flex;
  gap: 8px;
  margin: 0 18px 8px;
}
.sb-pr-tab {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}
.sb-pr-tab--active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}
.sb-pr-drafts {
  padding: 14px 18px 0;
}
.sb-pr-draft-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sb-pr-draft-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.sb-pr-draft-meta {
  flex: 1;
  min-width: 140px;
}
.sb-pr-draft-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.sb-pr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid #f1f5f9;
}
.sb-pr-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
}
.sb-pr-close {
  font-size: 13px !important;
}
.sb-pr-muted {
  padding: 8px 18px 14px;
  font-size: 13px;
  color: #64748b;
  margin: 0;
}
.sb-pr-table-wrap {
  overflow: auto;
  flex: 1;
}
.sb-pr-history .sb-pr-table-wrap {
  padding: 0 18px 14px;
}
.sb-pr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.sb-pr-table th,
.sb-pr-table td {
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}
.sb-pr-table th {
  background: #f8fafc;
  color: #64748b;
  font-weight: 700;
  font-size: 12px;
}
.sb-pr-paper {
  font-weight: 600;
  color: #0f172a;
}
.sb-pr-folder {
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
}
</style>
