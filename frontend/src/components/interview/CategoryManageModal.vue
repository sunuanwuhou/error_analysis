<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useInterviewStore } from '@/stores/interviewStore'

const emit = defineEmits<{ close: [] }>()

const store = useInterviewStore()
const { categories, categorySaving } = storeToRefs(store)

const newLabel = ref('')
const editingId = ref<string | null>(null)
const editingLabel = ref('')
const err = ref('')

function startEdit(id: string, label: string) {
  editingId.value = id
  editingLabel.value = label
  err.value = ''
}

function cancelEdit() {
  editingId.value = null
  editingLabel.value = ''
}

async function submitNew() {
  err.value = ''
  const label = newLabel.value.trim()
  if (!label) {
    err.value = '请输入题型名称'
    return
  }
  try {
    await store.createCategory(label)
    newLabel.value = ''
  } catch (e) {
    err.value = e instanceof Error ? e.message : '新增失败'
  }
}

async function submitEdit(id: string) {
  err.value = ''
  const label = editingLabel.value.trim()
  if (!label) {
    err.value = '题型名称不能为空'
    return
  }
  try {
    await store.updateCategory(id, label)
    cancelEdit()
  } catch (e) {
    err.value = e instanceof Error ? e.message : '保存失败'
  }
}

async function removeCategory(id: string, label: string, count: number) {
  err.value = ''
  if (count > 0) {
    err.value = `「${label}」下还有 ${count} 道题，请先删除或改题型后再删`
    return
  }
  if (!window.confirm(`确定删除题型「${label}」？`)) return
  try {
    await store.deleteCategory(id)
  } catch (e) {
    err.value = e instanceof Error ? e.message : '删除失败'
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="ivc-backdrop" @click.self="emit('close')">
      <div class="ivc-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <div class="ivc-head">
          <h2 class="ivc-title">管理题型</h2>
          <button type="button" class="ivc-close" @click="emit('close')">×</button>
        </div>

        <div class="ivc-body">
          <p class="ivc-hint">题型可自由新增；有题目的题型需先处理题目才能删除。导入时遇到新题型名称会自动创建。</p>

          <div class="ivc-add">
            <input
              v-model="newLabel"
              type="text"
              class="ivc-input"
              placeholder="新题型名称，如：漫画题"
              @keydown.enter.prevent="submitNew"
            />
            <button type="button" class="ivc-btn ivc-btn--primary" :disabled="categorySaving" @click="submitNew">
              新增
            </button>
          </div>

          <ul class="ivc-list">
            <li v-for="c in categories" :key="c.id" class="ivc-item">
              <template v-if="editingId === c.id">
                <input v-model="editingLabel" type="text" class="ivc-input ivc-input--inline" />
                <button type="button" class="ivc-btn ivc-btn--sm" :disabled="categorySaving" @click="submitEdit(c.id)">
                  保存
                </button>
                <button type="button" class="ivc-btn ivc-btn--sm" @click="cancelEdit">取消</button>
              </template>
              <template v-else>
                <span class="ivc-label">{{ c.label }}</span>
                <span class="ivc-meta">{{ c.question_count }} 题</span>
                <div class="ivc-item-actions">
                  <button type="button" class="ivc-link" @click="startEdit(c.id, c.label)">重命名</button>
                  <button
                    type="button"
                    class="ivc-link ivc-link--danger"
                    @click="removeCategory(c.id, c.label, c.question_count)"
                  >
                    删除
                  </button>
                </div>
              </template>
            </li>
          </ul>

          <p v-if="!categories.length" class="ivc-empty">暂无题型，请先新增。</p>
          <p v-if="err" class="ivc-err">{{ err }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ivc-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}

.ivc-modal {
  width: min(480px, 96vw);
  max-height: 88vh;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 60px rgb(15 23 42 / 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ivc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e2e8f0;
}

.ivc-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}

.ivc-close {
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 18px;
}

.ivc-body {
  padding: 14px 18px 18px;
  overflow-y: auto;
}

.ivc-hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.55;
  color: #64748b;
}

.ivc-add {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.ivc-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
}

.ivc-input--inline {
  min-width: 0;
}

.ivc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ivc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
}

.ivc-label {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  min-width: 100px;
}

.ivc-meta {
  font-size: 12px;
  color: #94a3b8;
}

.ivc-item-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.ivc-link {
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
  color: #ea580c;
  cursor: pointer;
}

.ivc-link--danger {
  color: #dc2626;
}

.ivc-empty {
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
  padding: 16px 0;
}

.ivc-err {
  margin-top: 10px;
  font-size: 12px;
  color: #dc2626;
}

.ivc-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.ivc-btn--sm {
  padding: 5px 10px;
  font-size: 12px;
}

.ivc-btn--primary {
  border: none;
  background: linear-gradient(135deg, #ea580c, #c2410c);
  color: #fff;
}

.ivc-btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
