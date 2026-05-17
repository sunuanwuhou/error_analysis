<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import type { ErrorEntry, KnowledgeNode } from '@/api/xingce'
import type { SuitePaperSearchHit, SuiteSearchHit } from '@/api/suiteBank'
import { suiteBankApi } from '@/api/suiteBank'
import { useXingceStore } from '@/stores/xingceStore'

const emit = defineEmits<{
  close: []
  pickQuestion: [errorId: string]
  pickNote: [nodeId: string]
  pickSuite: [paperId: string, questionId: string]
}>()

const store = useXingceStore()
const query = ref('')
const scope = ref<'all' | 'questions' | 'notes' | 'suite'>('all')
const inputRef = ref<HTMLInputElement | null>(null)

const suiteHits = ref<SuiteSearchHit[]>([])
const suitePaperHits = ref<SuitePaperSearchHit[]>([])
const suiteLoading = ref(false)
let suiteTimer: ReturnType<typeof setTimeout> | null = null

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
  if (scope.value === 'notes' || scope.value === 'suite') return []
  return questionHits.value
})

const visibleNotes = computed(() => {
  if (scope.value === 'questions' || scope.value === 'suite') return []
  return noteHits.value
})

const visibleSuite = computed(() => {
  if (scope.value === 'notes') return []
  return suiteHits.value
})

const visibleSuitePapers = computed(() => {
  if (scope.value === 'notes') return []
  return suitePaperHits.value
})

function scheduleSuiteFetch() {
  if (suiteTimer) clearTimeout(suiteTimer)
  suiteTimer = setTimeout(async () => {
    const ts = terms.value
    const want =
      (scope.value === 'all' || scope.value === 'suite' || scope.value === 'questions') && ts.length > 0
    if (!want) {
      suiteHits.value = []
      suitePaperHits.value = []
      suiteLoading.value = false
      return
    }
    suiteLoading.value = true
    try {
      const { items, papers } = await suiteBankApi.search(ts.join(' '), 80)
      suiteHits.value = items
      suitePaperHits.value = papers
    } catch {
      suiteHits.value = []
      suitePaperHits.value = []
    } finally {
      suiteLoading.value = false
    }
  }, 320)
}

watch([query, scope], scheduleSuiteFetch)

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
  scheduleSuiteFetch()
})

function snippet(text: string, max = 72) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function notePath(n: KnowledgeNode) {
  const p = store.getNodePathText(n.id)
  return p || n.title
}

function suiteMeta(h: SuiteSearchHit) {
  return [h.paper_folder, h.paper_title].filter(Boolean).join(' · ')
}

function suitePaperMeta(h: SuitePaperSearchHit) {
  const bits = [h.folder, `${h.question_count} 题`].filter(Boolean)
  if (String(h.source_rel_path || '').startsWith('word版本/')) bits.push('Word')
  return bits.join(' · ')
}

/** 与套卷页一致：仅允许 data:image base64 行内图，其余 HTML 转义 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stemWithBlankUnderline(raw: string): string {
  let s = escapeHtml(raw)
  s = s.replace(/[_＿]{3,}/g, '<span class="sb-blank"></span>')
  s = s.replace(/(?:[\u00a0\t ]|\u3000){3,}/g, '<span class="sb-blank"></span>')
  return s
}

function sanitizeInlineImgTag(tag: string): string {
  const m = tag.match(/\bsrc\s*=\s*["'](data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)["']/i)
  if (!m) return ''
  return `<img class="sb-inline-img" alt="" src="${m[1]}" />`
}

function mergeStemRich(raw: string): string {
  const s = String(raw ?? '')
  if (!/<img\b/i.test(s)) return stemWithBlankUnderline(s)
  const parts = s.split(/(<img\b[^>]*\/?>)/gi)
  return parts.map(part => (/^<img\b/i.test(part) ? sanitizeInlineImgTag(part) : stemWithBlankUnderline(part))).join('')
}

/** 全局搜索列表：题干可含行内图 */
function suiteStemPreviewHtml(stem: string | undefined): string {
  return mergeStemRich(String(stem ?? ''))
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
        <p class="gsm-hint">
          「题目」含<b>侧栏错题</b>与<b>套卷小题</b>（仍搜套卷库）；「套卷题库」仅套卷；错题 / 笔记与侧栏一致（关键词 AND）。
        </p>
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
          <button
            type="button"
            class="gsm-chip"
            :class="{ active: scope === 'suite' }"
            @click="scope = 'suite'"
          >套卷题库</button>
        </div>

        <div v-if="!terms.length" class="gsm-empty">请输入至少一个关键词。</div>

        <div v-else-if="scope === 'suite' && suiteLoading" class="gsm-empty">正在搜索套卷题库…</div>

        <div v-else class="gsm-results">
          <p
            v-if="suiteLoading && (scope === 'all' || scope === 'questions')"
            class="gsm-inline-loading"
          >
            正在检索套卷小题…
          </p>
          <section v-if="visibleQuestions.length" class="gsm-section">
            <div class="gsm-sec-title">错题题目（{{ visibleQuestions.length }}）</div>
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
          <section v-if="visibleSuitePapers.length" class="gsm-section">
            <div class="gsm-sec-title">匹配套卷（{{ visibleSuitePapers.length }}）</div>
            <button
              v-for="h in visibleSuitePapers"
              :key="`p-${h.id}`"
              type="button"
              class="gsm-row gsm-row-suite gsm-row-suite-paper"
              @click="emit('pickSuite', h.id, '')"
            >
              <span class="gsm-row-title">{{ snippet(h.title ?? '', 96) }}</span>
              <span class="gsm-row-meta">{{ suitePaperMeta(h) }}</span>
            </button>
          </section>
          <section v-if="visibleSuite.length" class="gsm-section">
            <div class="gsm-sec-title">套卷小题（{{ visibleSuite.length }}）</div>
            <button
              v-for="h in visibleSuite"
              :key="h.id"
              type="button"
              class="gsm-row gsm-row-suite"
              @click="emit('pickSuite', h.paper_id, h.id)"
            >
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="gsm-row-title gsm-row-title-rich" v-html="suiteStemPreviewHtml(h.stem)" />
              <span class="gsm-row-meta">{{ suiteMeta(h) }}</span>
            </button>
          </section>
          <div
            v-if="terms.length && !visibleQuestions.length && !visibleNotes.length && !visibleSuite.length && !visibleSuitePapers.length && !suiteLoading"
            class="gsm-empty"
          >
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
  flex-wrap: wrap;
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
.gsm-inline-loading {
  margin: 0 6px 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 8px;
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
.gsm-row-suite {
  border-color: #e9d5ff;
  background: #faf5ff;
}
.gsm-row:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}
.gsm-row-suite:hover {
  background: #f3e8ff;
  border-color: #d8b4fe;
}
.gsm-row-suite-paper {
  border-color: #bfdbfe;
  background: #eff6ff;
}
.gsm-row-suite-paper:hover {
  background: #dbeafe;
  border-color: #93c5fd;
}
.gsm-row-title {
  font-size: 13px;
  color: #0f172a;
  line-height: 1.45;
  word-break: break-word;
}
.gsm-row-title-rich {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: left;
}
.gsm-row-title-rich :deep(.sb-inline-img) {
  max-width: 100%;
  max-height: 100px;
  width: auto;
  height: auto;
  vertical-align: middle;
  border-radius: 4px;
  object-fit: contain;
}
.gsm-row-title-rich :deep(.sb-blank) {
  border-bottom: 1px solid #cbd5e1;
  min-width: 1.25em;
  display: inline-block;
}
.gsm-row-meta {
  font-size: 11px;
  color: #94a3b8;
}
</style>
