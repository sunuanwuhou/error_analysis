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
  <div class="errors-area">
    <div class="errors-header">
      <h2>错题列表</h2>
      <div class="errors-header-actions">
        <div class="search-box">
          <span class="search-icon">搜索</span>
          <input
            v-model="store.searchQuery"
            type="search"
            placeholder="搜索题目、解析..."
            @keydown.enter.prevent
          />
          <button
            v-if="store.searchQuery"
            type="button"
            class="search-clear"
            @click="store.searchQuery = ''"
          >×</button>
        </div>
        <button
          type="button"
          :class="['btn', store.batchMode ? 'btn-primary' : 'btn-secondary']"
          @click="store.toggleBatchMode()"
        >{{ store.batchMode ? '完成' : '批量操作' }}</button>
      </div>
    </div>

    <div class="date-filter-bar">
      录入日期：
      <input v-model="store.dateFrom" type="date">
      <span style="color:#ccc">至</span>
      <input v-model="store.dateTo" type="date">
      <button type="button" class="btn btn-sm btn-secondary" @click="store.dateFrom = ''; store.dateTo = ''">清除日期</button>
      <button type="button" class="btn btn-sm btn-secondary" @click="store.clearFilters()">重置筛选</button>
    </div>

    <div class="content-header">
      <div class="breadcrumb">{{ store.errorListBreadcrumb }}</div>
      <div class="head-right-cluster">
        <div class="error-sort-controls">
          <span class="error-sort-label">排序</span>
          <select
            class="error-sort-select"
            :value="store.errorSortBy"
            @change="store.setErrorSortBy(($event.target as HTMLSelectElement).value)"
          >
            <option value="created_at">创建时间</option>
            <option value="wrong_count">错题次数</option>
          </select>
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            @click="store.toggleErrorSortOrder()"
          >
            {{ store.errorSortOrder === 'asc' ? '升序' : '降序' }}
          </button>
        </div>
        <div class="stats-bar">
          <div class="stat-item">
            <div class="stat-num">{{ store.errorListStats.total }}</div>
            <div class="stat-label">共计</div>
          </div>
          <div class="stat-item">
            <div class="stat-num" style="color:#e74c3c">{{ store.errorListStats.focus }}</div>
            <div class="stat-label">重点</div>
          </div>
          <div class="stat-item">
            <div class="stat-num" style="color:#fa8c16">{{ store.errorListStats.review }}</div>
            <div class="stat-label">待复习</div>
          </div>
          <div class="stat-item">
            <div class="stat-num" style="color:#52c41a">{{ store.errorListStats.mastered }}</div>
            <div class="stat-label">已掌握</div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-secondary" title="Ctrl+K" @click="emit('openGlobalSearch')">
          全局搜索
        </button>
      </div>
    </div>

    <div v-if="store.batchMode" class="batch-bar">
      <span>已选 {{ store.batchSelectedIds.length }} 题</span>
      <button type="button" class="btn btn-sm btn-secondary" @click="showBatchMoveModal = true">
        批量改挂载
      </button>
      <button type="button" class="btn btn-sm btn-secondary" @click="store.batchDeleteSelectedErrors">批量删除</button>
      <button type="button" class="btn btn-sm btn-secondary" @click="store.toggleBatchMode()">完成</button>
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
            <button type="button" class="btn btn-sm btn-secondary" @click="showBatchMoveModal = false">取消</button>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="!batchMoveTarget || !store.batchSelectedIds.length"
              @click="applyBatchMountFromModal"
            >
              应用
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="errors-list">
      <ErrorList :entries="store.filteredErrors" />
    </div>
  </div>
</template>

<style scoped>
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
.ewp-sel {
  flex: 1;
  min-width: 120px;
  max-width: 360px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
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
