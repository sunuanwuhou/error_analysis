<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import type { ErrorEntry, KnowledgeNode } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'

const emit = defineEmits<{
  close: []
  pickQuestion: [errorId: string]
  pickNote: [nodeId: string]
}>()

const store = useXingceStore()
const query = ref('')
const scope = ref<'all' | 'questions' | 'notes'>('all')
const inputRef = ref<HTMLInputElement | null>(null)

const terms = computed(() =>
  query.value.trim().toLowerCase().split(/\s+/).filter(Boolean),
)

const questionHits = computed(() => {
  const ts = terms.value
  if (!ts.length) return [] as ErrorEntry[]
  return store.errors.filter(e => store.globalSearchMatchError(e, ts)).slice(0, 120)
})

const noteHits = computed(() => {
  const ts = terms.value
  if (!ts.length) return [] as KnowledgeNode[]
  return store.knowledgeNodes.filter(n => store.globalSearchMatchKnowledgeNode(n, ts)).slice(0, 120)
})

const visibleQuestions = computed(() => {
  if (scope.value === 'notes') return []
  return questionHits.value
})

const visibleNotes = computed(() => {
  if (scope.value === 'questions') return []
  return noteHits.value
})

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
})

function snippet(text: string, max = 72) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function notePath(n: KnowledgeNode) {
  const p = store.getNodePathText(n.id)
  return p || n.title
}
</script>

<template>
  <Teleport to="body">
    <div class="gsm-mask" @click.self="emit('close')">
      <div class="gsm-modal" role="dialog" aria-modal="true" aria-labelledby="gsm-title" @keydown.escape.prevent="emit('close')">
        <div class="gsm-head">
          <h2 id="gsm-title" class="gsm-title">全局搜索</h2>
          <button type="button" class="gsm-close" title="关闭 (Esc)" @click="emit('close')">×</button>
        </div>
        <p class="gsm-hint">与错题侧栏一致：空格分隔多关键词，全部命中（AND）。</p>
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          class="gsm-input"
          placeholder="输入关键词…（Ctrl+K）"
          autocomplete="off"
        >
        <div class="gsm-scope">
          <button
            type="button"
            class="gsm-chip"
            :class="{ active: scope === 'all' }"
            @click="scope = 'all'"
          >全部</button>
          <button
            type="button"
            class="gsm-chip"
            :class="{ active: scope === 'questions' }"
            @click="scope = 'questions'"
          >题目</button>
          <button
            type="button"
            class="gsm-chip"
            :class="{ active: scope === 'notes' }"
            @click="scope = 'notes'"
          >笔记</button>
        </div>

        <div v-if="!terms.length" class="gsm-empty">请输入至少一个关键词。</div>

        <div v-else class="gsm-results">
          <section v-if="visibleQuestions.length" class="gsm-section">
            <div class="gsm-sec-title">题目（{{ visibleQuestions.length }}）</div>
            <button
              v-for="e in visibleQuestions"
              :key="e.id"
              type="button"
              class="gsm-row"
              @click="emit('pickQuestion', e.id)"
            >
              <span class="gsm-row-title">{{ snippet(e.question ?? '', 80) }}</span>
              <span class="gsm-row-meta">{{ e.type }} › {{ e.subtype }}</span>
            </button>
          </section>
          <section v-if="visibleNotes.length" class="gsm-section">
            <div class="gsm-sec-title">知识点笔记（{{ visibleNotes.length }}）</div>
            <button
              v-for="n in visibleNotes"
              :key="n.id"
              type="button"
              class="gsm-row"
              @click="emit('pickNote', n.id)"
            >
              <span class="gsm-row-title">{{ n.title }}</span>
              <span class="gsm-row-meta">{{ notePath(n) }}</span>
            </button>
          </section>
          <div v-if="terms.length && !visibleQuestions.length && !visibleNotes.length" class="gsm-empty">
            无匹配结果，请换词或缩小范围。
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.gsm-mask {
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 16px 24px;
  box-sizing: border-box;
}
.gsm-modal {
  width: min(720px, 100%);
  max-height: min(84vh, 900px);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.gsm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 8px;
  border-bottom: 1px solid #f1f5f9;
}
.gsm-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}
.gsm-close {
  border: none;
  background: #f1f5f9;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  color: #64748b;
}
.gsm-close:hover { background: #e2e8f0; color: #0f172a; }
.gsm-hint {
  margin: 0;
  padding: 6px 18px 0;
  font-size: 11px;
  color: #94a3b8;
}
.gsm-input {
  margin: 10px 18px 8px;
  width: calc(100% - 36px);
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
}
.gsm-input:focus {
  border-color: #4a6cf7;
  box-shadow: 0 0 0 2px rgba(74, 108, 247, 0.15);
}
.gsm-scope {
  display: flex;
  gap: 6px;
  padding: 0 18px 10px;
}
.gsm-chip {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  color: #64748b;
}
.gsm-chip.active {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
  font-weight: 600;
}
.gsm-empty {
  padding: 24px 18px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.gsm-results {
  flex: 1;
  min-height: 120px;
  max-height: 52vh;
  overflow-y: auto;
  padding: 0 12px 14px;
}
.gsm-section { margin-bottom: 12px; }
.gsm-sec-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 8px 6px 4px;
}
.gsm-row {
  width: 100%;
  text-align: left;
  border: 1px solid #f1f5f9;
  background: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background 0.12s, border-color 0.12s;
}
.gsm-row:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}
.gsm-row-title {
  font-size: 13px;
  color: #0f172a;
  line-height: 1.45;
  word-break: break-word;
}
.gsm-row-meta {
  font-size: 11px;
  color: #94a3b8;
}
</style>
