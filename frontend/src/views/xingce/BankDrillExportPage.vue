<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { SuiteQuestionRow } from '@/api/suiteBank'
import { bankDrillApi, type BankDrillStartResponse, type ExamTrackApi } from '@/api/bankDrill'

interface ExportPayload {
  title: string
  examTrackLabel: string
  years: number[]
  requestedCount: number
  exportedAt: string
  groups: Array<{
    moduleLabel: string
    questions: SuiteQuestionRow[]
  }>
}

const TRACK_LABEL: Record<ExamTrackApi, string> = {
  provincial: '省考',
  unified: '统考',
}

const route = useRoute()
const payload = ref<ExportPayload | null>(null)
const loadErr = ref('')
const loadingText = ref('正在生成导出题单…')

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeInlineImgTag(tag: string): string {
  const m = tag.match(/\bsrc\s*=\s*["'](data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)["']/i)
  if (!m) return ''
  return `<img class="print-inline-img" alt="" src="${m[1]}" />`
}

function stemWithBlankUnderline(raw: string): string {
  let s = escapeHtml(raw)
  s = s.replace(/[_＿]{3,}/g, '<span class="print-blank"></span>')
  s = s.replace(/(?:[\u00a0\t ]|\u3000){3,}/g, '<span class="print-blank"></span>')
  return s
}

function mergeRich(raw: string): string {
  const s = String(raw ?? '')
  if (!/<img\b/i.test(s)) return stemWithBlankUnderline(s)
  const parts = s.split(/(<img\b[^>]*\/?>)/gi)
  return parts
    .map(part => (/^<img\b/i.test(part) ? sanitizeInlineImgTag(part) : stemWithBlankUnderline(part)))
    .join('')
}

function richOptionHtml(line: string): string {
  const s = String(line ?? '')
  if (!/<img\b/i.test(s)) return escapeHtml(s)
  const parts = s.split(/(<img\b[^>]*\/?>)/gi)
  return parts.map(part => (/^<img\b/i.test(part) ? sanitizeInlineImgTag(part) : escapeHtml(part))).join('')
}

function optionLineHasImg(line: string): boolean {
  return /<img\b/i.test(line)
}

function optionLinesOf(q: SuiteQuestionRow): string[] {
  const raw = String(q?.options ?? '').trim()
  if (!raw) return []
  return raw.split(/\n|\|/).map(s => s.trim()).filter(Boolean)
}

function stripInlineMarkup(line: string): string {
  return line.replace(/<[^>]+>/g, '').trim()
}

function letterForLine(line: string, oi: number): string {
  const plain = stripInlineMarkup(line)
  const m = plain.match(/^([A-Da-d])/)
  if (m) return String(m[1]).toUpperCase()
  return String.fromCharCode(65 + oi)
}

function stemImageSrc(q: SuiteQuestionRow): string {
  const raw = String(q?.img_data ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  return `data:image/png;base64,${raw}`
}

function sectionHeadingOf(q: SuiteQuestionRow): string {
  const meta = q?.meta as Record<string, unknown> | undefined
  const raw = meta?.section_heading
  return typeof raw === 'string' ? raw.trim() : ''
}

function sharedMaterialOf(q: SuiteQuestionRow): string {
  const meta = q?.meta as Record<string, unknown> | undefined
  const raw = meta?.shared_material
  return typeof raw === 'string' ? raw.trim() : ''
}

const exportedAtText = computed(() => {
  const raw = String(payload.value?.exportedAt || '')
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('zh-CN', { hour12: false })
})

const flatQuestions = computed(() => {
  const rows: Array<{ question: SuiteQuestionRow; displayNo: number; moduleLabel: string }> = []
  let no = 1
  for (const group of payload.value?.groups ?? []) {
    for (const question of group.questions ?? []) {
      rows.push({ question, displayNo: no, moduleLabel: group.moduleLabel })
      no += 1
    }
  }
  return rows
})

function parseExamTrack(): ExamTrackApi {
  const raw = String(route.query.examTrack || '').trim()
  if (raw === 'provincial' || raw === 'unified') return raw
  throw new Error('考试类型参数无效，请返回上一页重新导出。')
}

function parseYears(): number[] {
  const years = String(route.query.years || '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n > 0)
  if (!years.length) throw new Error('年份参数缺失，请返回上一页重新导出。')
  return years
}

function parseCount(): number {
  const count = Number(String(route.query.count || '').trim())
  if (!Number.isFinite(count) || count < 1) throw new Error('题量参数无效，请返回上一页重新导出。')
  return Math.min(80, Math.max(1, Math.floor(count)))
}

function parseModules(): string[] {
  const modules = String(route.query.modules || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (!modules.length) throw new Error('题型参数缺失，请返回上一页重新导出。')
  return modules
}

async function requestOneModule(examTrack: ExamTrackApi, years: number[], count: number, moduleId: string) {
  return bankDrillApi.start({
    exam_track: examTrack,
    years,
    count,
    major_module: moduleId,
  })
}

function toGroup(res: BankDrillStartResponse) {
  return {
    moduleLabel: res.major_module_label,
    questions: res.questions ?? [],
  }
}

onMounted(async () => {
  try {
    const examTrack = parseExamTrack()
    const years = parseYears()
    const count = parseCount()
    const modules = parseModules()
    const groups: ExportPayload['groups'] = []

    for (const moduleId of modules) {
      loadingText.value = `正在生成 ${moduleId} 题单…`
      const res = await requestOneModule(examTrack, years, count, moduleId)
      if (res.questions?.length) groups.push(toGroup(res))
    }

    if (!groups.length) {
      throw new Error('当前筛选条件下无可导出的题目。')
    }

    payload.value = {
      title: '今日练习',
      examTrackLabel: TRACK_LABEL[examTrack],
      years,
      requestedCount: count,
      exportedAt: new Date().toISOString(),
      groups,
    }

    await nextTick()
    window.setTimeout(() => {
      window.print()
    }, 120)
  } catch (err) {
    loadErr.value = String((err as Error)?.message || err || '导出失败')
  }
})
</script>

<template>
  <div class="print-page">
    <div v-if="loadErr" class="print-error">
      <h1>导出失败</h1>
      <p>{{ loadErr }}</p>
    </div>

    <div v-else-if="!payload" class="print-loading">
      <h1>正在准备 PDF</h1>
      <p>{{ loadingText }}</p>
    </div>

    <template v-else>
      <header class="print-head">
        <h1>{{ payload.title }}</h1>
        <div class="print-meta">
          <span>考试类型：{{ payload.examTrackLabel }}</span>
          <span>年份：{{ payload.years.join('、') }}</span>
          <span>每题型题量：{{ payload.requestedCount }}</span>
          <span>总题量：{{ flatQuestions.length }}</span>
          <span>导出时间：{{ exportedAtText }}</span>
        </div>
      </header>

      <main class="print-body">
        <section v-for="group in payload.groups" :key="group.moduleLabel" class="print-group">
          <h2 class="print-group-title">{{ group.moduleLabel }}</h2>
          <section
            v-for="row in flatQuestions.filter(item => item.moduleLabel === group.moduleLabel)"
            :key="row.question.id || row.displayNo"
            class="print-question"
          >
            <div class="print-q-head">
              <span class="print-q-no">第 {{ row.displayNo }} 题</span>
              <span class="print-q-module">{{ row.moduleLabel }}</span>
              <span v-if="sectionHeadingOf(row.question)" class="print-q-section">{{ sectionHeadingOf(row.question) }}</span>
            </div>
            <div v-if="sharedMaterialOf(row.question)" class="print-material">
              <div class="print-material-label">给定资料</div>
              <div class="print-rich" v-html="mergeRich(sharedMaterialOf(row.question))"></div>
            </div>
            <img v-if="stemImageSrc(row.question)" class="print-stem-img" :src="stemImageSrc(row.question)" alt="题干插图" />
            <div class="print-stem print-rich" v-html="mergeRich(String(row.question.stem || ''))"></div>
            <div v-if="optionLinesOf(row.question).length" class="print-options">
              <div v-for="(line, oi) in optionLinesOf(row.question)" :key="oi" class="print-option">
                <span class="print-option-letter">{{ letterForLine(line, oi) }}.</span>
                <span v-if="optionLineHasImg(line)" class="print-option-text" v-html="richOptionHtml(line)" />
                <span v-else class="print-option-text">{{ line }}</span>
              </div>
            </div>
          </section>
        </section>

        <section class="print-answer-sheet">
          <h2>参考答案</h2>
          <div class="print-answer-grid">
            <div
              v-for="row in flatQuestions"
              :key="`${row.question.id || row.displayNo}-answer`"
              class="print-answer-item"
            >
              <span>第 {{ row.displayNo }} 题</span>
              <strong>{{ row.question.answer || '—' }}</strong>
            </div>
          </div>
        </section>
      </main>
    </template>
  </div>
</template>

<style scoped>
.print-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 20px 48px;
  color: #0f172a;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
.print-error,
.print-loading {
  border-radius: 16px;
  padding: 20px;
}
.print-error {
  border: 1px solid #fecaca;
  background: #fef2f2;
}
.print-loading {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
}
.print-head {
  margin-bottom: 20px;
  border-bottom: 2px solid #cbd5e1;
  padding-bottom: 14px;
}
.print-head h1 {
  margin: 0 0 12px;
  font-size: 28px;
}
.print-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  font-size: 13px;
  color: #475569;
}
.print-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.print-group {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.print-group-title {
  margin: 4px 0 0;
  font-size: 22px;
}
.print-question {
  break-inside: avoid;
  page-break-inside: avoid;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px;
  background: #fff;
}
.print-q-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}
.print-q-no {
  font-size: 17px;
  font-weight: 800;
}
.print-q-module {
  font-size: 12px;
  color: #075985;
  background: #e0f2fe;
  border: 1px solid #bae6fd;
  border-radius: 999px;
  padding: 3px 10px;
}
.print-q-section {
  font-size: 12px;
  color: #3730a3;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  padding: 3px 10px;
}
.print-material {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
}
.print-material-label {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 8px;
}
.print-stem-img,
:deep(.print-inline-img) {
  max-width: 100%;
  height: auto;
  display: block;
}
.print-stem-img {
  margin-bottom: 12px;
}
.print-stem {
  font-size: 15px;
  line-height: 1.8;
  margin-bottom: 12px;
}
.print-rich {
  line-height: 1.8;
  word-break: break-word;
}
:deep(.print-blank) {
  display: inline-block;
  min-width: 4.5em;
  border-bottom: 1.6px solid #0f172a;
  margin: 0 4px;
  vertical-align: baseline;
}
.print-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.print-option {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  line-height: 1.7;
}
.print-option-letter {
  min-width: 22px;
  font-weight: 700;
}
.print-option-text {
  flex: 1;
}
.print-answer-sheet {
  margin-top: 8px;
  break-before: page;
  page-break-before: always;
  border: 1px solid #cbd5e1;
  border-radius: 16px;
  padding: 20px;
  background: #fff;
}
.print-answer-sheet h2 {
  margin: 0 0 14px;
  font-size: 22px;
}
.print-answer-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 14px;
}
.print-answer-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 14px;
}

@media (max-width: 720px) {
  .print-page {
    padding: 18px 14px 40px;
  }
  .print-answer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media print {
  .print-page {
    max-width: none;
    padding: 0;
  }
  .print-question,
  .print-answer-sheet {
    border-color: #cbd5e1;
    box-shadow: none;
  }
}
</style>
