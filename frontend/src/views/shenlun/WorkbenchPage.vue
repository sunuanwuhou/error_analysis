<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { useShenlunStore } from '@/stores/shenlunStore'
import IssueTagChip from '@/components/shenlun/IssueTagChip.vue'
import {
  sourceSelectNodes,
  shenlunNodeTitle,
  nodeIdToRouteQuery,
} from '@/data/shenlunTree'

const store = useShenlunStore()
const { fenbiReferenceText, ccPromptDisplayText, ccPasteText } = storeToRefs(store)
const router = useRouter()
const route = useRoute()

const activeParagraph = ref(0)
const currentSeg = computed(() => store.segments[activeParagraph.value] ?? null)

watch(
  () => store.segments.length,
  (n) => {
    if (activeParagraph.value >= n) activeParagraph.value = Math.max(0, n - 1)
  },
)

const finalSummaryModel = computed({
  get: () => store.finalSummary,
  set: (v: string) => store.updateFinalSummary(v),
})

const nodeTitle = computed(() => shenlunNodeTitle(store.selectedNodeId))

const flatNodes = sourceSelectNodes()

const canNewRound = computed(() => {
  const rows = store.attemptSummaries
  return rows.length > 0 && rows[0].cc_status === 'success'
})

const deletingRoundId = ref<string | null>(null)

function onNodeChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value
  void store.patchWorkbenchNode(v)
}

function roundStatusLabel(cc: string): string {
  if (cc === 'success') return '已复盘'
  if (cc === 'failed') return '失败'
  if (cc === 'pending') return '等待中'
  return '进行中'
}

async function handleNewRound() {
  const ok = await store.createNewAIRound()
  if (ok) activeParagraph.value = 0
}

async function confirmDeleteRound(row: { id: string }, ev: Event) {
  ev.preventDefault()
  ev.stopPropagation()
  if (!window.confirm('确定删除这一轮练习/复盘记录？删除后不可恢复。')) return
  deletingRoundId.value = row.id
  try {
    await store.deleteAttemptRecord(row.id)
  } finally {
    deletingRoundId.value = null
  }
}

function openResultRound(id: string) {
  void router.push({ name: 'ShenlunResult', params: { attemptId: id } })
}

watch(
  () => [route.query.node, route.query.source],
  () => void store.bootstrapFromRoute(route.query as Record<string, unknown>),
  { immediate: true },
)

watch(
  () => store.sourceRecord?.id,
  (id) => {
    if (route.name !== 'ShenlunWorkbench') return
    if (!id) return
    if (route.query.source === id) return
    void router.replace({
      name: 'ShenlunWorkbench',
      query: { node: nodeIdToRouteQuery(store.selectedNodeId), source: id },
    })
  },
)

function handleResetInput() {
  store.resetWorkbench()
  void router.replace({
    name: 'ShenlunWorkbench',
    query: { node: nodeIdToRouteQuery(store.selectedNodeId) },
  })
}

function goHub() {
  void router.push({
    name: 'ShenlunHub',
    query: { node: nodeIdToRouteQuery(store.selectedNodeId) },
  })
}

const copied = ref(false)

async function handleFormat() {
  await store.formatMaterial()
}

async function handleGeneratePrompt() {
  await store.generateCCPrompt()
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(ccPromptDisplayText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Fallback: select all in textarea
    const el = document.getElementById('cc-prompt-textarea') as HTMLTextAreaElement | null
    el?.select()
  }
}

async function handleSubmitPaste() {
  const id = await store.submitCCPaste()
  if (id) {
    await router.push({ name: 'ShenlunResult', params: { attemptId: id } })
  }
}

function goResultReview() {
  const id = store.attempt?.id
  if (!id || id.startsWith('local-')) return
  void router.push({ name: 'ShenlunResult', params: { attemptId: id } })
}
</script>

<template>
  <div class="wb-page">
    <!-- Header -->
    <header class="wb-header">
      <div class="wb-header-nav">
        <button type="button" class="btn-link wb-back" @click="goHub">← 知识点首页</button>
        <span class="wb-node-chip">{{ nodeTitle }}</span>
      </div>
      <div class="wb-header-main">
      <span class="wb-tag">归纳概括</span>
      <h1 class="wb-title">申论工作台</h1>
      <div class="wb-header-right">
        <span v-if="store.sourceLoading" class="wb-status saving">保存中…</span>
        <span v-else-if="store.sourceRecord" class="wb-status saved">已自动保存</span>
        <!-- Step indicator -->
        <div class="wb-steps">
          <span class="wb-step" :class="{ active: store.phase === 'input' }">① 录入</span>
          <span class="wb-step-sep">›</span>
          <span class="wb-step" :class="{ active: store.phase === 'formatted' }">② 提炼</span>
          <span class="wb-step-sep">›</span>
          <span class="wb-step" :class="{ active: store.phase === 'cc_prompt' }">③ AI 对比</span>
        </div>
      </div>
      </div>
    </header>

    <section v-if="store.sourceRecord" class="wb-section wb-meta-card">
      <div class="wb-meta-grid">
        <label class="wb-meta-field">
          <span class="wb-label wb-label--small">知识点归类</span>
          <select
            class="wb-select"
            :value="store.selectedNodeId"
            :disabled="store.sourceLoading"
            @change="onNodeChange($event)"
          >
            <option value="">未分类</option>
            <option v-for="opt in flatNodes" :key="opt.id" :value="opt.id">{{ opt.title }}</option>
          </select>
        </label>
      </div>
      <p v-if="store.sourceError" class="wb-error wb-error--compact">{{ store.sourceError }}</p>

      <div class="wb-rounds">
        <div class="wb-rounds-head">
          <h3 class="wb-rounds-title">批改轮次</h3>
          <button
            type="button"
            class="btn btn-secondary wb-round-new"
            :disabled="!canNewRound || store.attemptLoading"
            @click="handleNewRound"
          >
            新开一轮 AI 批改
          </button>
        </div>
        <p class="wb-rounds-hint">
          每轮单独保存；上一轮已复盘后，可在此开新一轮重新生成 AI 对比。未完成当前轮时请先提交结果或删除该轮。
        </p>
        <p v-if="store.attemptSummariesLoading" class="wb-muted">加载轮次…</p>
        <ul v-else-if="store.attemptSummaries.length" class="wb-round-list">
          <li v-for="row in store.attemptSummaries" :key="row.id" class="wb-round-row">
            <div class="wb-round-main">
              <span class="wb-round-no">第 {{ row.attempt_no }} 轮</span>
              <span class="wb-round-st">{{ roundStatusLabel(row.cc_status) }}</span>
              <span class="wb-round-time">{{
                new Date(row.updated_at).toLocaleString('zh-CN', { hour12: false })
              }}</span>
              <span v-if="row.id === store.attempt?.id" class="wb-round-current">当前编辑</span>
              <span v-if="row.issue_tags?.length" class="wb-round-tags">
                <IssueTagChip
                  v-for="tag in row.issue_tags.slice(0, 2)"
                  :key="tag"
                  :tag="tag"
                  size="sm"
                />
              </span>
            </div>
            <div class="wb-round-actions">
              <button
                type="button"
                class="btn-link"
                :disabled="row.cc_status !== 'success'"
                @click="openResultRound(row.id)"
              >
                打开复盘
              </button>
              <button
                type="button"
                class="btn-link wb-round-del"
                :disabled="deletingRoundId === row.id || store.attemptLoading"
                @click="confirmDeleteRound(row, $event)"
              >
                {{ deletingRoundId === row.id ? '…' : '删除' }}
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="wb-muted">暂无练习轮次（保存题目并一键分段后出现）。</p>
      </div>
    </section>

    <!-- ① Input phase -->
    <template v-if="store.phase === 'input'">
      <section class="wb-section wb-paper-card">
        <label class="wb-label">套卷信息（可选，便于日后回顾）</label>
        <div class="wb-paper-grid">
          <label class="wb-field">
            <span class="wb-field-lab">年份</span>
            <input
              v-model="store.paperYear"
              type="text"
              class="wb-input"
              placeholder="如 2024"
              @input="store.scheduleAutosave()"
            />
          </label>
          <label class="wb-field">
            <span class="wb-field-lab">省份</span>
            <input
              v-model="store.paperProvince"
              type="text"
              class="wb-input"
              placeholder="如 江苏"
              @input="store.scheduleAutosave()"
            />
          </label>
          <label class="wb-field">
            <span class="wb-field-lab">试卷类型</span>
            <input
              v-model="store.paperSuiteType"
              type="text"
              class="wb-input"
              placeholder="如 行政执法卷、申论一"
              @input="store.scheduleAutosave()"
            />
          </label>
          <div class="wb-field wb-field--readonly">
            <span class="wb-field-lab">题型（随当前知识点）</span>
            <span class="wb-ro-val">{{ shenlunNodeTitle(store.selectedNodeId) }}</span>
          </div>
        </div>
      </section>

      <section class="wb-section">
        <label class="wb-label">题目</label>
        <textarea
          v-model="store.questionText"
          class="wb-textarea wb-textarea--question"
          placeholder="粘贴题目要求，例如：根据材料，概括…存在的主要问题。"
          @input="store.scheduleAutosave()"
        />
      </section>

      <section class="wb-section">
        <label class="wb-label">材料</label>
        <textarea
          v-model="store.materialText"
          class="wb-textarea wb-textarea--material"
          placeholder="粘贴完整材料文本"
          @input="store.scheduleAutosave()"
        />
      </section>

      <div class="wb-actions">
        <button
          class="btn btn-primary"
          :disabled="!store.questionText.trim() || !store.materialText.trim() || store.attemptLoading"
          @click="handleFormat"
        >
          {{ store.attemptLoading ? '分段中…' : '一键分段 →' }}
        </button>
      </div>
      <p v-if="store.attemptError" class="wb-error">{{ store.attemptError }}</p>
    </template>

    <!-- ② Formatted — fill extractions -->
    <template v-else-if="store.phase === 'formatted'">
      <section class="wb-section wb-section--question-preview">
        <div class="wb-q-row">
          <label class="wb-label">题目</label>
          <button class="btn-link" type="button" @click="handleResetInput">重新输入</button>
        </div>
        <p class="wb-question-text">{{ store.questionText }}</p>
      </section>

      <div
        v-if="
          store.attempt?.cc_status === 'success' &&
          store.attempt &&
          !store.attempt.id.startsWith('local-')
        "
        class="wb-done-hint"
      >
        <span>本题已完成 AI 复盘。</span>
        <button type="button" class="btn-link" @click="goResultReview">查看复盘页 →</button>
      </div>

      <div class="wb-seg-tabrail" aria-label="段落切换">
        <div class="wb-seg-tabscroll">
          <button
            v-for="seg in store.segments"
            :key="seg.index"
            type="button"
            class="wb-seg-tab"
            :class="{ active: activeParagraph === seg.index }"
            @click="activeParagraph = seg.index"
          >
            段落 {{ seg.index + 1 }}
          </button>
        </div>
      </div>

      <div v-if="currentSeg" class="wb-segments">
        <div class="wb-segment">
          <div class="wb-segment-header">
            <span class="wb-segment-num">段落 {{ currentSeg.index + 1 }}</span>
          </div>
          <div class="wb-segment-body">
            <div class="wb-material-block">
              <p class="wb-material-text">{{ currentSeg.source_text }}</p>
            </div>
            <div class="wb-extraction-stack">
              <div class="wb-extraction-block">
                <label class="wb-label wb-label--small">我的提炼</label>
                <textarea
                  :value="currentSeg.my_extraction"
                  class="wb-textarea wb-textarea--extraction"
                  placeholder="从该段材料中提炼要点，逐条写出"
                  @input="store.updateExtraction(currentSeg.index, ($event.target as HTMLTextAreaElement).value)"
                />
              </div>
              <div class="wb-summary-block">
                <label class="wb-label wb-label--small"
                  >最终总结
                  <span class="wb-inline-hint">
                    （全文仅一份；任一段落 Tab 均可编辑，经 Pinia 与各 Tab 实时同步）
                  </span></label
                >
                <textarea
                  v-model="finalSummaryModel"
                  class="wb-textarea wb-textarea--summary"
                  placeholder="综合各段，写出本条题目的最终归纳结论"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="wb-actions">
        <button
          class="btn btn-primary"
          :disabled="!store.canGoToCC || store.attemptLoading"
          @click="handleGeneratePrompt"
        >
          {{ store.attemptLoading ? '生成中…' : '生成 AI 提示词 →' }}
        </button>
        <span v-if="!store.canGoToCC" class="wb-hint"
          >请写完每段「提炼」，并在任一段落 Tab 中填写「最终总结」（全文同一份，实时同步）</span
        >
      </div>
      <p v-if="store.attemptError" class="wb-error">{{ store.attemptError }}</p>
    </template>

    <!-- ③ CC prompt — copy & paste -->
    <template v-else-if="store.phase === 'cc_prompt'">
      <div class="cc-banner">
        <p class="cc-banner-title">第三步：复制提示词 → 粘贴到 AI → 把结果粘回来</p>
        <p class="cc-banner-sub">
          使用 Claude / ChatGPT / DeepSeek：<strong>选填粉笔范文</strong>后点「复制全部」，提示词末尾会自动带上【参考范文】供 AI 对照点评。
        </p>
        <div class="cc-fenbi-embed">
          <label class="cc-fenbi-embed-label" for="cc-fenbi-textarea">
            粉笔等参考答案 <span class="wb-optional-tag">（选填）</span>
          </label>
          <p class="cc-fenbi-hint cc-fenbi-hint--embed">
            留空与原来一致；填写后合并进下方提示词与「复制全部」，无需再手搓拼接。
          </p>
          <textarea
            id="cc-fenbi-textarea"
            v-model="fenbiReferenceText"
            class="wb-textarea wb-textarea--fenbi"
            placeholder="可选：粘贴粉笔等机构给出的本题参考答案或要点…"
          />
        </div>
      </div>

      <!-- Prompt box -->
      <section class="wb-section">
        <div class="cc-label-row">
          <label class="wb-label">提示词（复制这段内容给 AI）</label>
          <button class="btn btn-copy" @click="copyPrompt">
            {{ copied ? '✓ 已复制' : '复制全部' }}
          </button>
        </div>
        <textarea
          id="cc-prompt-textarea"
          class="wb-textarea wb-textarea--prompt"
          :value="ccPromptDisplayText"
          readonly
        />
      </section>

      <!-- Paste-back box -->
      <section class="wb-section">
        <label class="wb-label">AI 的回复（把 JSON 粘贴到这里）</label>
        <textarea
          v-model="ccPasteText"
          class="wb-textarea wb-textarea--paste"
          placeholder='粘贴 AI 返回的 JSON，例如：
{
  "segments": [...],
  "reference_final_summary": "...",
  "overall_comment": "...",
  "overall_issue_tags": [...]
}'
        />
      </section>

      <div class="wb-actions">
        <button
          class="btn btn-secondary"
          @click="store.phase = 'formatted'"
        >
          ← 返回修改
        </button>
        <button
          class="btn btn-primary"
          :disabled="!store.canSubmitPaste || store.ccPasteLoading"
          @click="handleSubmitPaste"
        >
          {{ store.ccPasteLoading ? '解析中…' : '提交结果 →' }}
        </button>
      </div>
      <p v-if="store.ccPasteError" class="wb-error">{{ store.ccPasteError }}</p>
    </template>

    <!-- Done (briefly shown before navigation) -->
    <template v-else>
      <div class="wb-submitted">
        <p>处理完成，正在跳转…</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.wb-page {
  max-width: 860px;
  height: 100%;
  margin: 0 auto;
  padding: 32px 20px 80px;
  box-sizing: border-box;
  overflow-y: auto;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif;
  color: #1a1a2e;
}

.wb-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
}

.wb-header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.wb-node-chip {
  font-size: 12px;
  color: #374151;
  background: #f3f4f6;
  padding: 4px 10px;
  border-radius: 999px;
}

.wb-header-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.wb-back {
  text-decoration: none;
}

.wb-tag {
  background: #e8f4fd;
  color: #1a73e8;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
}

.wb-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  flex: 1;
}

.wb-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.wb-status {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
}
.wb-status.saving { background: #fff8e1; color: #f57f17; }
.wb-status.saved  { background: #e8f5e9; color: #2e7d32; }

.wb-steps {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.wb-step { padding: 2px 6px; border-radius: 4px; }
.wb-step.active { background: #eff6ff; color: #2563eb; font-weight: 700; }
.wb-step-sep { color: #d1d5db; }

.wb-meta-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px 16px;
  background: #fafafa;
}

.wb-meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}

.wb-meta-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;
}

.wb-select {
  font-size: 14px;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #1f2937;
}

.wb-error--compact {
  margin: 10px 0 0;
  font-size: 13px;
}

.wb-rounds {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
}

.wb-rounds-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.wb-rounds-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}

.wb-round-new {
  font-size: 13px;
  padding: 6px 12px;
}

.wb-rounds-hint {
  margin: 8px 0 12px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.45;
}

.wb-muted {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

.wb-round-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wb-round-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.wb-round-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  font-size: 13px;
  color: #4b5563;
}

.wb-round-no {
  font-weight: 600;
  color: #1f2937;
}

.wb-round-st {
  color: #2563eb;
  font-weight: 500;
}

.wb-round-time {
  font-size: 12px;
  color: #9ca3af;
}

.wb-round-current {
  font-size: 11px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}

.wb-round-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.wb-round-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wb-round-del {
  color: #dc2626;
}

/* Sections */
.wb-section { margin-bottom: 20px; }

.wb-section--question-preview {
  background: #f8f9fc;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 24px;
}

.wb-done-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: -12px 0 16px;
  padding: 10px 14px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  font-size: 13px;
  color: #065f46;
}

.wb-q-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.wb-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}
.wb-label--small { font-size: 12px; color: #6b7280; margin-bottom: 6px; }
.wb-inline-hint {
  font-weight: 400;
  color: #9ca3af;
  font-size: 11px;
}

.wb-question-text {
  margin: 0;
  font-size: 14px;
  color: #1f2937;
  line-height: 1.6;
}

.btn-link {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
.btn-link:hover { color: #374151; }

/* Textareas */
.wb-textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
  font-family: inherit;
  color: #1f2937;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.wb-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.wb-textarea--question  { min-height: 80px; }
.wb-textarea--material  { min-height: 220px; }
.wb-textarea--extraction {
  min-height: 90px;
  background: #fffde7;
  border-color: #fde68a;
}
.wb-textarea--extraction:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}
.wb-textarea--summary {
  min-height: 120px;
  background: #f0fdf4;
  border-color: #bbf7d0;
}
.wb-textarea--summary:focus {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}
.wb-textarea--prompt {
  min-height: 260px;
  font-family: "SFMono-Regular", "Consolas", "Liberation Mono", monospace;
  font-size: 13px;
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #334155;
  cursor: text;
}
.wb-textarea--paste {
  min-height: 160px;
  font-family: "SFMono-Regular", "Consolas", "Liberation Mono", monospace;
  font-size: 13px;
  background: #fafff5;
  border-color: #bbf7d0;
}
.wb-textarea--paste:focus {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

/* Segments */
.wb-segments {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}
.wb-segment {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: clip;
}
.wb-segment-header {
  background: #f9fafb;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.wb-segment-num {
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
/* 双列同高：Grid 明确行高，避免 flex+textarea 固有高度不参与分配 */
.wb-segment-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: stretch;
  min-height: 0;
}
.wb-segment-body > .wb-material-block {
  min-width: 0;
}
.wb-extraction-stack {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(90px, 1fr) auto;
  padding: 0;
  background: #fffbeb;
}
.wb-extraction-stack .wb-extraction-block,
.wb-extraction-stack .wb-summary-block {
  padding: 14px 16px;
}
.wb-extraction-stack .wb-extraction-block {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* textarea 在 flex 里必须用 height:0 + flex-grow 才会占满剩余高度（否则受 min-height:auto 限制） */
.wb-extraction-stack .wb-extraction-block .wb-textarea--extraction {
  height: 0;
  flex-grow: 1;
  flex-shrink: 1;
  min-height: 90px;
  resize: vertical;
  overflow: auto;
}
.wb-extraction-stack .wb-summary-block {
  display: flex;
  flex-direction: column;
  border-top: 1px dashed #fcd34d;
  background: #f0fdf4;
  min-height: 0;
}
.wb-extraction-stack .wb-summary-block .wb-textarea--summary {
  min-height: 100px;
  resize: vertical;
}

.wb-paper-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}
.wb-paper-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}
@media (max-width: 560px) {
  .wb-paper-grid {
    grid-template-columns: 1fr;
  }
}
.wb-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}
.wb-field-lab {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.wb-input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 14px;
  font-family: inherit;
}
.wb-field--readonly .wb-ro-val {
  font-size: 14px;
  color: #1e40af;
  font-weight: 600;
  padding: 8px 10px;
  background: #eff6ff;
  border-radius: 6px;
  border: 1px solid #bfdbfe;
}

.wb-seg-tabrail {
  margin-bottom: 12px;
}
.wb-seg-tabscroll {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
}
.wb-seg-tab {
  flex: 0 0 auto;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 999px;
  cursor: pointer;
}
.wb-seg-tab:hover {
  border-color: #bfdbfe;
  color: #1d4ed8;
}
.wb-seg-tab.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.wb-material-block {
  padding: 14px 16px;
  border-right: 1px solid #e5e7eb;
  background: #fff;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.wb-material-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
  white-space: pre-wrap;
}
.wb-extraction-stack .wb-extraction-block .wb-label,
.wb-extraction-stack .wb-summary-block .wb-label {
  flex-shrink: 0;
}

/* CC banner */
.cc-banner {
  background: linear-gradient(135deg, #eff6ff, #f0fdf4);
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 24px;
}
.cc-banner-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
  color: #1d4ed8;
}
.cc-banner-sub {
  margin: 0;
  font-size: 13px;
  color: #3b82f6;
}

.cc-fenbi-embed {
  margin-top: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(30, 64, 175, 0.06);
}

.cc-fenbi-embed-label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #1e3a8a;
  margin-bottom: 4px;
}

.cc-fenbi-hint--embed {
  margin: 0 0 8px;
}

.cc-fenbi-embed .wb-textarea--fenbi {
  min-height: 88px;
  margin-bottom: 0;
}

.wb-optional-tag {
  font-weight: 500;
  color: #9ca3af;
  font-size: 12px;
  margin-left: 4px;
}

.cc-fenbi-hint {
  margin: -4px 0 10px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.45;
}

.wb-textarea--fenbi {
  min-height: 100px;
  background: #faf5ff;
  border-color: #e9d5ff;
}
.wb-textarea--fenbi:focus {
  border-color: #a855f7;
  box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.12);
}

.cc-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.cc-label-row .wb-label { margin-bottom: 0; }

/* Actions */
.wb-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.wb-hint { font-size: 12px; color: #9ca3af; }

/* Buttons */
.btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s, opacity 0.15s;
}
.btn-primary {
  background: #3b82f6;
  color: #fff;
}
.btn-primary:hover:not(:disabled) { background: #2563eb; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}
.btn-secondary:hover { background: #e5e7eb; }

.btn-copy {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-copy:hover { background: #dbeafe; }

.wb-error {
  margin-top: 10px;
  font-size: 13px;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 6px;
  padding: 8px 12px;
}

.wb-submitted {
  padding: 40px;
  text-align: center;
  color: #6b7280;
  font-size: 15px;
}

@media (max-width: 640px) {
  .wb-segment-body {
    grid-template-columns: 1fr;
  }
  .wb-extraction-stack {
    grid-template-rows: auto auto;
  }
  .wb-extraction-stack .wb-extraction-block {
    overflow: visible;
  }
  .wb-extraction-stack .wb-extraction-block .wb-textarea--extraction {
    height: auto;
    flex-grow: 0;
    flex-shrink: 0;
    min-height: 120px;
  }
  .wb-material-block { border-right: none; border-bottom: 1px solid #e5e7eb; }
  .wb-header { gap: 8px; }
}
</style>
