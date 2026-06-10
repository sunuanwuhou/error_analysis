<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'

const props = defineProps<{
  mode: 'rename' | 'move' | 'create-child'
  nodeId?: string
  parentId?: string
  fallbackTitle?: string
}>()

const emit = defineEmits<{ close: []; done: [] }>()
const store = useXingceStore()

const titleInput = ref('')
const targetSearch = ref('')
const selectedTargetId = ref('')

const node = computed(() =>
  props.nodeId ? store.knowledgeNodes.find(n => n.id === props.nodeId) ?? null : null,
)
const parent = computed(() =>
  props.parentId ? store.knowledgeNodes.find(n => n.id === props.parentId) ?? null : null,
)

const modalTitle = computed(() => {
  if (props.mode === 'rename') return '重命名知识点'
  if (props.mode === 'move') return '移动知识点'
  return '新建下级知识点'
})

const subtitle = computed(() => {
  if (props.mode === 'rename' && node.value) return `当前节点：${store.getNodePathText(node.value.id)}`
  if (props.mode === 'move' && node.value) return `当前节点：${store.getNodePathText(node.value.id)}`
  if (props.mode === 'create-child' && parent.value) return `父节点：${store.getNodePathText(parent.value.id)}`
  return ''
})

const targetOptions = computed(() => {
  if (props.mode !== 'move' || !props.nodeId) return []
  return store.getKnowledgeMoveTargetOptions(props.nodeId)
})

const filteredTargets = computed(() => {
  const q = targetSearch.value.trim().toLowerCase()
  if (!q) return targetOptions.value
  return targetOptions.value.filter(o => o.label.toLowerCase().includes(q))
})

watch(
  () => [props.mode, props.nodeId, props.parentId, props.fallbackTitle] as const,
  () => {
    titleInput.value = props.mode === 'rename' && node.value
      ? String(node.value.title || '')
      : String(props.fallbackTitle || '')
    targetSearch.value = ''
    selectedTargetId.value = ''
  },
  { immediate: true },
)

function submit() {
  if (props.mode === 'rename' && props.nodeId) {
    store.renameKnowledgeNode(props.nodeId, titleInput.value)
    emit('done')
    emit('close')
    return
  }
  if (props.mode === 'move' && props.nodeId) {
    if (!selectedTargetId.value) {
      window.alert('请选择目标节点')
      return
    }
    if (store.moveKnowledgeNode(props.nodeId, selectedTargetId.value)) {
      emit('done')
      emit('close')
    }
    return
  }
  if (props.mode === 'create-child' && props.parentId) {
    const created = store.createKnowledgeChildNode(props.parentId, titleInput.value)
    if (created) {
      store.setActiveNode(created.id)
      emit('done')
      emit('close')
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="knm-backdrop" @click.self="emit('close')">
      <div class="knm-modal">
        <div class="knm-header">
          <h2>{{ modalTitle }}</h2>
          <p v-if="subtitle" class="knm-sub">{{ subtitle }}</p>
          <button type="button" class="knm-close" @click="emit('close')">×</button>
        </div>
        <div v-if="mode !== 'move'" class="knm-body">
          <label class="knm-label">节点名称</label>
          <input
            v-model="titleInput"
            class="knm-input"
            type="text"
            autofocus
            @keydown.enter="submit"
          >
        </div>
        <div v-else class="knm-body">
          <input
            v-model="targetSearch"
            class="knm-input"
            type="search"
            placeholder="搜索目标节点…"
          >
          <div class="knm-target-list">
            <button
              v-for="opt in filteredTargets"
              :key="opt.id"
              type="button"
              class="knm-target-item"
              :class="{ active: selectedTargetId === opt.id }"
              @click="selectedTargetId = opt.id"
            >
              {{ opt.label }}
            </button>
            <p v-if="!filteredTargets.length" class="knm-empty">暂无可移动到的目标节点</p>
          </div>
        </div>
        <div class="knm-footer">
          <button type="button" class="btn btn-secondary" @click="emit('close')">取消</button>
          <button type="button" class="btn btn-primary" @click="submit">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.knm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.knm-modal {
  background: #fff;
  border-radius: 12px;
  width: min(480px, 100%);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
}
.knm-header {
  padding: 16px 18px 10px;
  border-bottom: 1px solid #f1f5f9;
  position: relative;
}
.knm-header h2 {
  margin: 0;
  font-size: 16px;
  color: #1e293b;
}
.knm-sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: #64748b;
}
.knm-close {
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: none;
  font-size: 22px;
  cursor: pointer;
  color: #94a3b8;
}
.knm-body {
  padding: 14px 18px;
  overflow: auto;
}
.knm-label {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}
.knm-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
}
.knm-target-list {
  margin-top: 10px;
  max-height: 280px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.knm-target-item {
  text-align: left;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
}
.knm-target-item.active {
  border-color: #e74c3c;
  background: #fff5f5;
}
.knm-empty {
  color: #94a3b8;
  font-size: 13px;
  margin: 8px 0;
}
.knm-footer {
  padding: 12px 18px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #f1f5f9;
}
</style>
