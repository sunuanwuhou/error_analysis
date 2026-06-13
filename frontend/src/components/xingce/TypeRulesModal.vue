<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useXingceStore } from '@/stores/xingceStore'
import { FIXED_TYPES, type TypeRule } from '@/lib/xingceDefaults'

const emit = defineEmits<{ close: [] }>()
const store = useXingceStore()

type DraftRule = { keywords: string; type: string; subtype: string }

const draft = ref<DraftRule[]>([])

onMounted(() => {
  draft.value = store.typeRules.map(r => ({
    keywords: r.keywords.join(','),
    type: r.type,
    subtype: r.subtype || '',
  }))
})

function addRule() {
  draft.value.push({ keywords: '关键词', type: '判断推理', subtype: '' })
}

function removeRule(i: number) {
  draft.value.splice(i, 1)
}

function save() {
  const rules: TypeRule[] = draft.value
    .map(r => ({
      keywords: r.keywords.split(',').map(k => k.trim()).filter(Boolean),
      type: r.type,
      subtype: r.subtype.trim(),
    }))
    .filter(r => r.keywords.length)
  store.setTypeRules(rules)
  window.alert(`规则已保存（共 ${rules.length} 条）`)
  emit('close')
}

function reset() {
  if (!window.confirm('恢复默认规则？当前自定义规则将被清除')) return
  store.resetTypeRules()
  draft.value = store.typeRules.map(r => ({
    keywords: r.keywords.join(','),
    type: r.type,
    subtype: r.subtype || '',
  }))
}
</script>

<template>
  <Teleport to="body">
    <div class="tr-backdrop" @click.self="emit('close')">
      <div class="tr-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <div class="tr-head">
          <h2 class="tr-title">题型自动识别规则</h2>
          <button type="button" class="tr-close" title="关闭" @click="emit('close')">×</button>
        </div>
        <div class="tr-body">
          <p class="tr-lead">
            按顺序匹配关键词，命中后自动填充录入表单的「题型 / 子类型」。规则会同步到云端。
          </p>
          <div v-if="!draft.length" class="tr-empty">暂无规则</div>
          <div v-for="(rule, i) in draft" :key="i" class="tr-row">
            <div class="tr-field tr-field-kw">
              <label>关键词（逗号分隔）</label>
              <input v-model="rule.keywords" type="text" />
            </div>
            <div class="tr-field tr-field-type">
              <label>题型</label>
              <select v-model="rule.type">
                <option v-for="t in FIXED_TYPES" :key="t">{{ t }}</option>
              </select>
            </div>
            <div class="tr-field tr-field-sub">
              <label>子类型（可空）</label>
              <input v-model="rule.subtype" type="text" />
            </div>
            <button type="button" class="tr-del" title="删除" @click="removeRule(i)">✕</button>
          </div>
          <button type="button" class="tr-add" @click="addRule">＋ 添加规则</button>
        </div>
        <div class="tr-foot">
          <button type="button" class="tr-btn" @click="reset">恢复默认</button>
          <div class="tr-foot-right">
            <button type="button" class="tr-btn" @click="emit('close')">取消</button>
            <button type="button" class="tr-btn primary" @click="save">保存</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tr-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}
.tr-modal {
  width: min(720px, 96vw);
  max-height: 88vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.tr-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}
.tr-close {
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  color: #64748b;
}
.tr-body {
  overflow-y: auto;
  padding: 14px 16px;
  font-size: 13px;
}
.tr-lead {
  margin: 0 0 12px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.tr-empty {
  text-align: center;
  color: #cbd5e1;
  padding: 24px;
}
.tr-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 10px;
}
.tr-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tr-field label {
  font-size: 10px;
  color: #94a3b8;
}
.tr-field input,
.tr-field select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}
.tr-field-kw { flex: 2; min-width: 0; }
.tr-field-type { width: 130px; flex-shrink: 0; }
.tr-field-sub { flex: 1; min-width: 80px; }
.tr-del {
  margin-bottom: 2px;
  background: none;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  flex-shrink: 0;
}
.tr-del:hover { color: #ef4444; }
.tr-add {
  margin-top: 4px;
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  width: 100%;
}
.tr-foot {
  padding: 10px 16px 14px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.tr-foot-right {
  display: flex;
  gap: 8px;
}
.tr-btn {
  border: 1px solid #d9dee5;
  background: #fff;
  color: #475569;
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
}
.tr-btn.primary {
  background: #4a6cf7;
  border-color: #4a6cf7;
  color: #fff;
}
</style>
