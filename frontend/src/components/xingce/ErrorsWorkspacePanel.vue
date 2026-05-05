<script setup lang="ts">
import { ref, computed } from 'vue'
import type { KnowledgeNode } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'
import ErrorList from './ErrorList.vue'

const store = useXingceStore()
const batchMoveTarget = ref('')
const showBatchMoveModal = ref(false)

const emit = defineEmits<{
  openGlobalSearch: []
}>()

function walkLeaves(nodes: KnowledgeNode[]): KnowledgeNode[] {
  const out: KnowledgeNode[] = []
  for (const n of nodes) {
    const kids = (n.children ?? []) as KnowledgeNode[]
    if (kids.length) out.push(...walkLeaves(kids))
    else out.push(n)
  }
  return out
}

const batchMountLeaves = computed(() => walkLeaves(store.knowledgeTree))

function applyBatchMount() {
  if (!batchMoveTarget.value) return
  store.batchApplyNoteNode(batchMoveTarget.value)
  batchMoveTarget.value = ''
}

function applyBatchMountFromModal() {
  applyBatchMount()
  showBatchMoveModal.value = false
}
</script>

<template>
  <div class="ewp">
    <div class="ewp-errors-header">
      <h2 class="ewp-h2">错题列表</h2>
      <div class="ewp-actions">
        <div class="ewp-search">
          <span class="ewp-search-ic">搜索</span>
          <input
            v-model="store.searchQuery"
            class="ewp-search-input"
            type="search"
            placeholder="搜索题目、解析…（与侧栏高级筛选一致，空格=AND）"
            @keydown.enter.prevent
          />
          <button
            v-if="store.searchQuery"
            type="button"
            class="ewp-search-clear"
            @click="store.searchQuery = ''"
          >×</button>
        </div>
        <button
          type="button"
          class="ewp-btn"
          :class="{ active: store.batchMode }"
          @click="store.toggleBatchMode()"
        >{{ store.batchMode ? '完成' : '批量操作' }}</button>
      </div>
    </div>

    <div class="ewp-date-bar">
      <span class="ewp-date-label">录入日期：</span>
      <input v-model="store.dateFrom" class="ewp-date" type="date" @change="() => {}">
      <span class="ewp-date-sep">至</span>
      <input v-model="store.dateTo" class="ewp-date" type="date">
      <button type="button" class="ewp-btn-sm" @click="store.dateFrom = ''; store.dateTo = ''">清除日期</button>
      <button type="button" class="ewp-btn-sm" @click="store.clearFilters()">重置筛选</button>
    </div>

    <div class="ewp-content-header">
      <div class="ewp-crumb">{{ store.errorListBreadcrumb }}</div>
      <div class="ewp-head-right">
        <div class="ewp-stats">
          <div class="ewp-stat">
            <div class="ewp-num">{{ store.errorListStats.total }}</div>
            <div class="ewp-lbl">共计</div>
          </div>
          <div class="ewp-stat">
            <div class="ewp-num ewp-n-focus">{{ store.errorListStats.focus }}</div>
            <div class="ewp-lbl">重点</div>
          </div>
          <div class="ewp-stat">
            <div class="ewp-num ewp-n-review">{{ store.errorListStats.review }}</div>
            <div class="ewp-lbl">待复习</div>
          </div>
          <div class="ewp-stat">
            <div class="ewp-num ewp-n-master">{{ store.errorListStats.mastered }}</div>
            <div class="ewp-lbl">已掌握</div>
          </div>
        </div>
        <button type="button" class="ewp-btn-sm" title="Ctrl+K" @click="emit('openGlobalSearch')">
          全局搜索
        </button>
      </div>
    </div>

    <div v-if="store.batchMode" class="ewp-batch-bar">
      <span class="ewp-batch-count">已选 {{ store.batchSelectedIds.length }} 题</span>
      <button type="button" class="ewp-btn-sm primary" @click="showBatchMoveModal = true">
        批量改挂载…
      </button>
      <button type="button" class="ewp-btn-sm danger" @click="store.batchDeleteSelectedErrors">批量删除</button>
    </div>

    <Teleport to="body">
      <div
        v-if="showBatchMoveModal"
        class="ewp-move-mask"
        @click.self="showBatchMoveModal = false"
      >
        <div class="ewp-move-dialog" role="dialog" aria-modal="true" @keydown.escape.prevent="showBatchMoveModal = false">
          <div class="ewp-move-title">批量改挂载</div>
          <p class="ewp-move-hint">将已选题目的知识点挂载到所选叶子节点（与旧版「批量改挂载」弹窗一致）。</p>
          <select v-model="batchMoveTarget" class="ewp-sel ewp-sel-dialog">
            <option value="">请选择目标知识点…</option>
            <option v-for="n in batchMountLeaves" :key="n.id" :value="n.id">
              {{ store.getNodePathText(n.id) ? `${store.getNodePathText(n.id)} › ${n.title}` : n.title }}
            </option>
          </select>
          <div class="ewp-move-actions">
            <button type="button" class="ewp-btn-sm" @click="showBatchMoveModal = false">取消</button>
            <button
              type="button"
              class="ewp-btn-sm primary"
              :disabled="!batchMoveTarget || !store.batchSelectedIds.length"
              @click="applyBatchMountFromModal"
            >
              应用
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="ewp-list-wrap">
      <ErrorList :entries="store.filteredErrors" />
    </div>
  </div>
</template>

<style scoped>
.ewp {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 0;
  overflow: hidden;
}
.ewp-errors-header {
  padding: 14px 18px;
  border-bottom: 1px solid #e8e8e8;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.ewp-h2 {
  font-size: 17px;
  margin: 0;
  color: #2c3e50;
  letter-spacing: 0.2px;
}
.ewp-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  justify-content: flex-end;
  min-width: 200px;
}
.ewp-search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  max-width: 420px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 4px 8px;
  background: #fafafa;
}
.ewp-search-ic {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
}
.ewp-search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  min-width: 0;
  outline: none;
}
.ewp-search-clear {
  border: none;
  background: none;
  cursor: pointer;
  color: #999;
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
}
.ewp-btn {
  border: 1px solid #d9dee5;
  background: #fff;
  color: #475569;
  border-radius: 8px;
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
  white-space: nowrap;
}
.ewp-btn:hover { background: #f8fafc; }
.ewp-btn.active {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}
.ewp-btn-dim { opacity: 0.85; }

.ewp-batch-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 18px;
  border-bottom: 1px solid #fde68a;
  background: #fffbeb;
  font-size: 13px;
}
.ewp-batch-count { font-weight: 600; color: #92400e; }
.ewp-sel {
  flex: 1;
  min-width: 120px;
  max-width: 360px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
}
.ewp-btn-sm.primary {
  background: #4a6cf7;
  border-color: #4a6cf7;
  color: #fff;
}
.ewp-btn-sm.primary:hover:not(:disabled) { filter: brightness(1.05); }
.ewp-btn-sm.primary:disabled { opacity: 0.45; cursor: not-allowed; }
.ewp-btn-sm.danger {
  background: #fff1f0;
  border-color: #ffa39e;
  color: #cf1322;
}
.ewp-btn-sm.danger:hover { background: #ffe4e1; }

.ewp-date-bar {
  padding: 10px 18px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #444;
  background: rgba(255, 255, 255, 0.92);
}
.ewp-date-label { color: #666; }
.ewp-date-sep { color: #ccc; }
.ewp-date {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
}
.ewp-btn-sm {
  border: 1px solid #d9dee5;
  background: #fff;
  color: #475569;
  border-radius: 6px;
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
}
.ewp-btn-sm:hover { background: #f1f5f9; }

.ewp-content-header {
  padding: 10px 18px;
  border-bottom: 1px solid #f0f0f0;
  border-top: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.92);
}
.ewp-crumb {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
}
.ewp-head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ewp-stats {
  display: flex;
  gap: 12px;
}
.ewp-stat {
  text-align: center;
  padding: 0 8px;
  border-right: 1px solid #f0f0f0;
}
.ewp-stat:last-child { border-right: none; }
.ewp-num {
  font-size: 15px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.2;
}
.ewp-n-focus { color: #e74c3c; }
.ewp-n-review { color: #fa8c16; }
.ewp-n-master { color: #52c41a; }
.ewp-lbl {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.ewp-list-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 14px 16px;
  background: #fafafa;
}

.ewp-move-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  z-index: 1150;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.ewp-move-dialog {
  width: min(440px, 94vw);
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
}
.ewp-move-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
}
.ewp-move-hint {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 14px;
  line-height: 1.45;
}
.ewp-sel-dialog {
  width: 100%;
  max-width: none;
  margin-bottom: 14px;
}
.ewp-move-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
