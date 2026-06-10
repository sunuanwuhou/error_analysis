<script setup lang="ts">
import { ref, watch } from 'vue'
import { bankDrillApi, type BankDrillExportRecord } from '@/api/bankDrill'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const loading = ref(false)
const items = ref<BankDrillExportRecord[]>([])
const deletingId = ref('')

watch(
  () => props.open,
  async value => {
    if (!value) return
    await refresh()
  },
)

async function refresh() {
  loading.value = true
  try {
    items.value = await bankDrillApi.listExports(80)
  } catch (e) {
    items.value = []
    const msg = String((e as Error)?.message || e)
    if (msg && msg !== 'unauthorized') {
      console.warn('bank drill exports load failed', e)
    }
  } finally {
    loading.value = false
  }
}

function close() {
  emit('update:open', false)
}

function formatAt(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

function openExport(rec: BankDrillExportRecord) {
  window.open(bankDrillApi.exportPrintUrl(rec.id), '_blank', 'noopener')
}

async function deleteExport(rec: BankDrillExportRecord) {
  if (deletingId.value) return
  if (!window.confirm(`确定删除导出记录「${rec.file_name}」？删除后将无法从列表中重复下载。`)) return
  deletingId.value = rec.id
  try {
    await bankDrillApi.deleteExport(rec.id)
    items.value = items.value.filter(item => item.id !== rec.id)
  } finally {
    deletingId.value = ''
  }
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
      aria-labelledby="sb-export-dialog-title"
    >
      <div class="sb-pr-backdrop" @click="close" />
      <div class="sb-pr-panel">
        <div class="sb-pr-head">
          <h2 id="sb-export-dialog-title" class="sb-pr-title">导出记录</h2>
          <button type="button" class="btn btn-ghost sb-pr-close" @click="close">关闭</button>
        </div>
        <div class="sb-pr-body">
          <p class="sb-pr-section-hint sb-pr-history-hint">
            这里保存的是当时导出的固定题目快照。重复下载不会重新随机，也不会重复增加去重历史。
          </p>
          <p v-if="loading" class="sb-pr-muted">加载中…</p>
          <template v-else>
            <div v-if="items.length" class="sb-pr-table-wrap">
              <table class="sb-pr-table">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>年份</th>
                    <th>题量</th>
                    <th>时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="rec in items" :key="rec.id">
                    <td>
                      <div class="sb-pr-paper">{{ rec.file_name }}</div>
                      <div class="sb-pr-folder">{{ rec.modules.join('、') || '全部题型' }}</div>
                    </td>
                    <td>{{ rec.years.join('、') || '—' }}</td>
                    <td>{{ rec.question_ids.length || rec.count }}</td>
                    <td>{{ formatAt(rec.created_at) }}</td>
                    <td>
                      <div class="sb-export-actions">
                        <button type="button" class="btn btn-secondary" @click="openExport(rec)">重复下载</button>
                        <button
                          type="button"
                          class="btn btn-ghost sb-export-delete"
                          :disabled="deletingId === rec.id"
                          @click="deleteExport(rec)"
                        >
                          {{ deletingId === rec.id ? '删除中…' : '删除' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="sb-pr-muted">暂无导出记录。首次导出 PDF 后会出现在这里。</p>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sb-export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sb-export-delete {
  color: #b91c1c;
}
</style>
