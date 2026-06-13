<script setup lang="ts">
import { computed, ref } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import { FIXED_TYPES, type DirTree } from '@/lib/xingceDefaults'

const emit = defineEmits<{ close: [] }>()
const store = useXingceStore()

const selType = ref<string>(FIXED_TYPES[0])
const selSub = ref('')
const addSub = ref('')
const addSub2 = ref('')

const subs = computed(() => store.getDirSubs(selType.value))
const sub2s = computed(() => (selSub.value ? store.getDirSub2s(selType.value, selSub.value) : []))

function localTree(): DirTree {
  return JSON.parse(JSON.stringify(store.dirTree)) as DirTree
}

function persist(tree: DirTree) {
  store.setDirTree(tree)
}

function selectType(t: string) {
  selType.value = t
  selSub.value = ''
}

function selectSub(s: string) {
  selSub.value = s
}

function addItem(level: 2 | 3) {
  const tree = localTree()
  if (level === 2) {
    const v = addSub.value.trim()
    if (!v) return
    if (!tree[selType.value]) tree[selType.value] = {}
    if (!tree[selType.value][v]) tree[selType.value][v] = []
    addSub.value = ''
    selSub.value = v
  } else {
    if (!selSub.value) {
      window.alert('请先选择二级分类')
      return
    }
    const v = addSub2.value.trim()
    if (!v) return
    if (!tree[selType.value]) tree[selType.value] = {}
    if (!tree[selType.value][selSub.value]) tree[selType.value][selSub.value] = []
    if (!tree[selType.value][selSub.value].includes(v)) {
      tree[selType.value][selSub.value].push(v)
    }
    addSub2.value = ''
  }
  persist(tree)
}

function delSub(s: string) {
  if (!window.confirm(`确定删除二级分类「${s}」以及其下三级分类吗？`)) return
  const tree = localTree()
  if (tree[selType.value]) delete tree[selType.value][s]
  if (selSub.value === s) selSub.value = ''
  persist(tree)
}

function delSub2(s2: string) {
  const tree = localTree()
  const arr = tree[selType.value]?.[selSub.value]
  if (!arr) return
  const idx = arr.indexOf(s2)
  if (idx >= 0) arr.splice(idx, 1)
  persist(tree)
}

function reset() {
  if (!window.confirm('确定重置分类目录吗？这会清空你手动维护的分类层级。')) return
  store.resetDirTree()
  selSub.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div class="dm-backdrop" @click.self="emit('close')">
      <div class="dm-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <div class="dm-head">
          <h2 class="dm-title">📂 目录管理</h2>
          <button type="button" class="dm-close" @click="emit('close')">×</button>
        </div>
        <p class="dm-lead">管理三级分类树，添加题目时子类型可从下拉选择，与题型规则联动。</p>
        <div class="dir-panel">
          <div class="dir-col">
            <div class="dir-col-hd">题型（一级）</div>
            <div class="dir-list">
              <button
                v-for="t in FIXED_TYPES"
                :key="t"
                type="button"
                class="dir-item"
                :class="{ active: selType === t }"
                @click="selectType(t)"
              >
                {{ t }}
              </button>
            </div>
          </div>
          <div class="dir-col">
            <div class="dir-col-hd">子类型（二级）</div>
            <div class="dir-list">
              <button
                v-for="s in subs"
                :key="s"
                type="button"
                class="dir-item dir-item-with-del"
                :class="{ active: selSub === s }"
                @click="selectSub(s)"
              >
                <span>{{ s }}</span>
                <span class="dir-del" @click.stop="delSub(s)">✕</span>
              </button>
            </div>
            <div class="dir-add-row">
              <input
                v-model="addSub"
                placeholder="新子类型名称..."
                @keydown.enter.prevent="addItem(2)"
              />
              <button type="button" class="dir-add-btn" @click="addItem(2)">＋ 添加</button>
            </div>
          </div>
          <div class="dir-col">
            <div class="dir-col-hd">细分类型（三级）</div>
            <div class="dir-list">
              <div v-for="s2 in sub2s" :key="s2" class="dir-item dir-item-with-del static">
                <span>{{ s2 }}</span>
                <span class="dir-del" @click="delSub2(s2)">✕</span>
              </div>
            </div>
            <div class="dir-add-row">
              <input
                v-model="addSub2"
                placeholder="新细分名称..."
                :disabled="!selSub"
                @keydown.enter.prevent="addItem(3)"
              />
              <button type="button" class="dir-add-btn" :disabled="!selSub" @click="addItem(3)">＋ 添加</button>
            </div>
          </div>
        </div>
        <div class="dm-foot">
          <button type="button" class="dm-btn" @click="reset">恢复默认</button>
          <button type="button" class="dm-btn primary" @click="emit('close')">完成</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}
.dm-modal {
  width: min(700px, 96vw);
  max-height: 92vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 18px 14px;
  box-sizing: border-box;
}
.dm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.dm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.dm-close {
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 18px;
}
.dm-lead {
  margin: 0 0 12px;
  font-size: 12px;
  color: #94a3b8;
}
.dir-panel {
  display: flex;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.dir-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.dir-col-hd {
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}
.dir-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 160px;
  max-height: 320px;
}
.dir-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  color: #334155;
}
.dir-item.static { cursor: default; }
.dir-item.active {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #4338ca;
  font-weight: 600;
}
.dir-del {
  color: #cbd5e1;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
}
.dir-del:hover { color: #ef4444; }
.dir-add-row {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid #e2e8f0;
}
.dir-add-row input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
}
.dir-add-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.dir-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.dm-foot {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
}
.dm-btn {
  border: 1px solid #d9dee5;
  background: #fff;
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
}
.dm-btn.primary {
  background: #4a6cf7;
  border-color: #4a6cf7;
  color: #fff;
}
</style>
