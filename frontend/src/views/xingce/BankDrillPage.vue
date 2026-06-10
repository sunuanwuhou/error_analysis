<script setup lang="ts">
/**
 * 广东套卷全库 · 按五大模块随机练习（省考/统考 + 自然年多选，默认近 5 年）
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { SuitePracticeItemPayload, SuiteQuestionRow } from '@/api/suiteBank'
import { suiteBankApi } from '@/api/suiteBank'
import {
  BANK_DRILL_PAPER_ID,
  bankDrillApi,
  type BankDrillStartResponse,
  type BankDrillMetaResponse,
  type ExamTrackApi,
} from '@/api/bankDrill'
import SuitePracticeRecordsDialog from '@/components/xingce/SuitePracticeRecordsDialog.vue'
import BankDrillExportRecordsDialog from '@/components/xingce/BankDrillExportRecordsDialog.vue'
import {
  clearCloudSessionId,
  flushSuitePracticeCloudSync,
  registerSuitePracticeCloudSync,
  scheduleSuitePracticeCloudSync,
  unregisterSuitePracticeCloudSync,
} from '@/lib/suitePracticeCloudSync'

const router = useRouter()

const TRACK_LABEL: Record<ExamTrackApi, string> = {
  provincial: '省考',
  unified: '统考',
}

const MODULE_EXPORT_ORDER = ['verbal', 'quant', 'reasoning', 'materials', 'common']

function calendarYearsDefault(): number[] {
  const y = new Date().getFullYear()
  return [y - 4, y - 3, y - 2, y - 1, y]
}

const phase = ref<'setup' | 'quiz'>('setup')
const loadErr = ref('')
const metaLoading = ref(false)
const meta = ref<BankDrillMetaResponse | null>(null)

const examTrack = ref<ExamTrackApi>('provincial')
const selectedYears = ref<number[]>([...calendarYearsDefault()])
const drillCount = ref(10)
const resetHistoryLoading = ref(false)

const sessionId = ref('')
const sessionTrack = ref<ExamTrackApi>('provincial')
const sessionYears = ref<number[]>([])
const sessionModuleId = ref('')
const sessionModuleLabel = ref('')
const requestedCount = ref(10)

const questions = ref<SuiteQuestionRow[]>([])
type QuizSlot = { picked: string | null; revealed: boolean; skipped?: boolean; blankDone?: boolean }
const quizSlots = ref<QuizSlot[]>([])
const qIdx = ref(0)
const sheetExpanded = ref(true)

const examSheetSubmitted = ref(false)
const examRecordSaved = ref(false)
const showPracticeRecords = ref(false)
const showExportRecords = ref(false)
const cloudSyncWarn = ref('')

const examActiveMsAccum = ref(0)
const examSegmentStartedAt = ref(0)
const examTimerPaused = ref(false)
const examDisplayTick = ref(0)
let examTickTimer: ReturnType<typeof setInterval> | null = null

const currentQ = computed(() => questions.value[qIdx.value] ?? null)

const sectionBanner = computed(() => {
  const m = currentQ.value?.meta as Record<string, unknown> | undefined
  const s = m?.section_heading
  return typeof s === 'string' && s.trim() ? s.trim() : ''
})

const stemImageSrc = computed(() => {
  const raw = String(currentQ.value?.img_data ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  return `data:image/png;base64,${raw}`
})

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
  return parts
    .map(part => (/^<img\b/i.test(part) ? sanitizeInlineImgTag(part) : stemWithBlankUnderline(part)))
    .join('')
}

const stemHtml = computed(() => mergeStemRich(String(currentQ.value?.stem ?? '')))

const sharedMaterialRaw = computed(() => {
  const m = currentQ.value?.meta as Record<string, unknown> | undefined
  const s = m?.shared_material
  return typeof s === 'string' ? s.trim() : ''
})

const sharedMaterialHtml = computed(() => mergeStemRich(sharedMaterialRaw.value))

function richOptionHtml(line: string): string {
  const s = String(line ?? '')
  if (!/<img\b/i.test(s)) return escapeHtml(s)
  const parts = s.split(/(<img\b[^>]*\/?>)/gi)
  return parts.map(part => (/^<img\b/i.test(part) ? sanitizeInlineImgTag(part) : escapeHtml(part))).join('')
}

function optionLineHasImg(line: string): boolean {
  return /<img\b/i.test(line)
}

function stripInlineMarkup(line: string): string {
  return line.replace(/<[^>]+>/g, '').trim()
}

const optionLines = computed(() => {
  const raw = String(currentQ.value?.options ?? '').trim()
  if (!raw) return [] as string[]
  return raw.split(/\n|\|/).map(s => s.trim()).filter(Boolean)
})

const currentHasOptions = computed(() => optionLines.value.length > 0)

function letterForLine(line: string, oi: number): string {
  const plain = stripInlineMarkup(line)
  const m = plain.match(/^([A-Da-d])/)
  if (m) return String(m[1]).toUpperCase()
  return String.fromCharCode(65 + oi)
}

function parseAnswerLetters(raw: string): string[] {
  const s = String(raw || '')
    .toUpperCase()
    .trim()
  if (!s) return []
  const seen = new Set<string>()
  const letters: string[] = []
  if (/[,，]/.test(s)) {
    for (const part of s.split(/[,，]/)) {
      const ch = part.trim().charAt(0)
      if (/^[A-D]$/.test(ch) && !seen.has(ch)) {
        seen.add(ch)
        letters.push(ch)
      }
    }
    return letters.sort()
  }
  for (const ch of s.replace(/\s+/g, '')) {
    if (/^[A-D]$/.test(ch) && !seen.has(ch)) {
      seen.add(ch)
      letters.push(ch)
    }
  }
  return letters.sort()
}

function canonicalPickKey(picked: string | null): string {
  return parseAnswerLetters(picked || '').join(',')
}

function canonicalAnswerKey(answerRaw: string): string {
  return parseAnswerLetters(answerRaw).join(',')
}

function isMultiSelectAnswer(answerRaw: string): boolean {
  return parseAnswerLetters(answerRaw).length > 1
}

const currentIsMulti = computed(() => isMultiSelectAnswer(String(currentQ.value?.answer ?? '')))

function getOptionLineCount(q: SuiteQuestionRow | null): number {
  const raw = String(q?.options ?? '').trim()
  if (!raw) return 0
  return raw.split(/\n|\|/).map(s => s.trim()).filter(Boolean).length
}

function slotExamReady(slot: QuizSlot | undefined, q: SuiteQuestionRow | null): boolean {
  if (!slot) return false
  if (slot.skipped || slot.blankDone) return true
  const oc = getOptionLineCount(q)
  if (oc === 0) return !!slot.blankDone
  return !!String(slot.picked || '').trim()
}

const gradingVisibleForCurrent = computed(() => examSheetSubmitted.value)

function optionButtonClass(line: string, oi: number): Record<string, boolean> {
  const letter = letterForLine(line, oi)
  const rev = gradingVisibleForCurrent.value
  const ansLetters = parseAnswerLetters(String(currentQ.value?.answer || ''))
  const pickedLetters = parseAnswerLetters(String(quizSlots.value[qIdx.value]?.picked ?? ''))

  const inAns = ansLetters.includes(letter)
  const picked = pickedLetters.includes(letter)

  if (!rev) return { pick: picked }

  const single = ansLetters.length <= 1
  const ansOnly = ansLetters[0]

  if (single) {
    return {
      ok: !!ansOnly && letter === ansOnly,
      bad: picked && !!ansOnly && letter !== ansOnly,
    }
  }

  return {
    ok: inAns && picked,
    'ok-miss': inAns && !picked,
    bad: picked && !inAns,
  }
}

const analysisExamHtml = computed(() => {
  const s = String(currentQ.value?.analysis || '').trim()
  if (!s) return ''
  return escapeHtml(s).replace(/\n/g, '<br/>')
})

function mergeRunningSegmentIntoAccum(): number {
  let ms = examActiveMsAccum.value
  if (!examTimerPaused.value && examSegmentStartedAt.value) {
    ms += Date.now() - examSegmentStartedAt.value
  }
  return ms
}

function resetExamTimerForNewSession() {
  examActiveMsAccum.value = 0
  examSegmentStartedAt.value = Date.now()
  examTimerPaused.value = false
}

function stopExamTimerDisplay() {
  if (examTickTimer) clearInterval(examTickTimer)
  examTickTimer = null
}

function startExamTimerDisplay() {
  stopExamTimerDisplay()
  examTickTimer = setInterval(() => {
    examDisplayTick.value++
  }, 800)
}

function toggleExamPause() {
  if (examSheetSubmitted.value) return
  if (examTimerPaused.value) {
    examTimerPaused.value = false
    examSegmentStartedAt.value = Date.now()
  } else {
    examActiveMsAccum.value = mergeRunningSegmentIntoAccum()
    examSegmentStartedAt.value = 0
    examTimerPaused.value = true
  }
}

const examClockText = computed(() => {
  void examDisplayTick.value
  const sec = Math.floor(mergeRunningSegmentIntoAccum() / 1000)
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
})

const currentExamSlotReady = computed(() => {
  if (examSheetSubmitted.value) return true
  return slotExamReady(quizSlots.value[qIdx.value], currentQ.value)
})

const examNextLocked = computed(() => !examSheetSubmitted.value && !currentExamSlotReady.value)

const footerNextBlocked = computed(() => {
  if (examSheetSubmitted.value && questions.value.length && qIdx.value >= questions.value.length - 1)
    return true
  return examNextLocked.value
})

const quizTitle = computed(() => {
  const mod = sessionModuleLabel.value || '模块练习'
  return `广东套卷题库 · ${TRACK_LABEL[sessionTrack.value]} · ${mod}`
})

const exportModules = computed(() => {
  return (meta.value?.modules ?? [])
    .filter(m => m.count > 0)
    .sort((a, b) => MODULE_EXPORT_ORDER.indexOf(a.id) - MODULE_EXPORT_ORDER.indexOf(b.id))
})

const exportHref = computed(() => {
  if (!exportModules.value.length) return ''
  const query = new URLSearchParams({
    exam_track: examTrack.value,
    years: [...selectedYears.value].sort((a, b) => b - a).join(','),
    count: String(normalizedDrillCount()),
    modules: exportModules.value.map(m => m.id).join(','),
  })
  return `/api/suite-bank/bank-drill/export-print?${query.toString()}`
})

type SheetGroup = { title: string; indices: number[] }

const sheetGroups = computed((): SheetGroup[] => {
  const qs = questions.value
  if (!qs.length) return []
  const groups: SheetGroup[] = []
  for (let i = 0; i < qs.length; i++) {
    const m = qs[i]?.meta as Record<string, unknown> | undefined
    const title =
      typeof m?.section_heading === 'string' && m.section_heading.trim()
        ? String(m.section_heading).trim()
        : '题目'
    const last = groups[groups.length - 1]
    if (last && last.title === title) last.indices.push(i)
    else groups.push({ title, indices: [i] })
  }
  return groups
})

/** 答题卡按本场顺序 1…N 编号（随机抽题跨套卷，不宜用原卷题号） */
function displayQuestionNo(i: number): string {
  return String(i + 1)
}

function jumpQuestion(i: number) {
  if (i < 0 || i >= questions.value.length) return
  qIdx.value = i
}

function sheetCellClass(i: number): Record<string, boolean> {
  const slot = quizSlots.value[i]
  const q = questions.value[i]
  const ansKey = canonicalAnswerKey(String(q?.answer || ''))
  const pickKey = canonicalPickKey(slot?.picked ?? null)
  const cur = i === qIdx.value
  const graded = !!(slot?.revealed && examSheetSubmitted.value)
  const hasPick = !!pickKey
  const correct = ansKey !== '' && ansKey === pickKey
  const wrong = hasPick && ansKey !== pickKey
  return {
    'is-current': cur,
    'is-touched': !graded && hasPick,
    'is-right': graded && correct && hasPick,
    'is-wrong': graded && wrong,
    'is-skip': graded && !hasPick,
  }
}

async function refreshMeta() {
  metaLoading.value = true
  loadErr.value = ''
  try {
    const ys = [...selectedYears.value].sort((a, b) => a - b)
    const m = await bankDrillApi.meta(examTrack.value, ys)
    meta.value = m
    if (!ys.length && m.default_years?.length) {
      selectedYears.value = m.default_years.filter(y => m.year_catalog.includes(y))
    }
  } catch (e) {
    loadErr.value = String((e as Error).message || e)
    meta.value = null
  } finally {
    metaLoading.value = false
  }
}

function toggleYear(y: number) {
  const set = new Set(selectedYears.value)
  if (set.has(y)) {
    if (set.size <= 1) return
    set.delete(y)
  } else {
    set.add(y)
  }
  selectedYears.value = [...set].sort((a, b) => b - a)
}

function restoreDefaultYears() {
  const m = meta.value
  const cy = new Date().getFullYear()
  const fallback = [cy - 4, cy - 3, cy - 2, cy - 1, cy]
  const src = m?.default_years?.length ? m.default_years : fallback
  const cat = new Set(m?.year_catalog ?? [])
  selectedYears.value = src.filter(y => cat.has(y)).sort((a, b) => b - a)
  if (!selectedYears.value.length && m?.year_catalog?.length) {
    selectedYears.value = [...m.year_catalog].slice(0, Math.min(5, m.year_catalog.length))
  }
}

watch(
  [examTrack, selectedYears],
  () => {
    void refreshMeta()
  },
  { deep: true, immediate: true },
)

function normalizedDrillCount(): number {
  return Math.min(80, Math.max(1, Number(drillCount.value) || 10))
}

async function requestBankDrill(mid: string): Promise<BankDrillStartResponse> {
  return bankDrillApi.start({
    exam_track: examTrack.value,
    major_module: mid,
    count: normalizedDrillCount(),
    years: selectedYears.value,
  })
}

async function startModule(mid: string) {
  loadErr.value = ''
  try {
    const res = await requestBankDrill(mid)
    if (!res.questions?.length) {
      window.alert('当前筛选条件下，未做过/未导出过的题已经用完。可扩大年份范围，或先手动清零去重历史。')
      return
    }
    sessionId.value = res.session_id
    sessionTrack.value = examTrack.value
    sessionYears.value = [...res.years]
    sessionModuleId.value = res.major_module
    sessionModuleLabel.value = res.major_module_label
    requestedCount.value = res.requested_count

    questions.value = res.questions
    quizSlots.value = res.questions.map(() => ({ picked: null, revealed: false }))
    qIdx.value = 0
    sheetExpanded.value = true
    examSheetSubmitted.value = false
    examRecordSaved.value = false
    resetExamTimerForNewSession()
    startExamTimerDisplay()
    phase.value = 'quiz'
    cloudSyncWarn.value = ''
    startModuleCloudSync()
    scheduleSuitePracticeCloudSync(true)
    void tryCloudSyncNow()
    if (res.actual_count < res.requested_count) {
      window.alert(`已按“排除历史导出过或做过的题”去重，本次仅剩 ${res.actual_count} 题可练。`)
    }
  } catch (e) {
    loadErr.value = String((e as Error).message || e)
  }
}

async function resetDrillHistory() {
  if (resetHistoryLoading.value) return
  if (!window.confirm('清零后，历史导出过或做过的题都会重新进入随机池。确定继续？')) return
  resetHistoryLoading.value = true
  loadErr.value = ''
  try {
    const res = await bankDrillApi.resetHistory()
    await refreshMeta()
    window.alert(`已清零 ${res.cleared_count} 道题的去重历史。`)
  } catch (e) {
    loadErr.value = String((e as Error).message || e)
  } finally {
    resetHistoryLoading.value = false
  }
}

function revealAllExamSlots() {
  quizSlots.value.forEach(s => {
    if (s) s.revealed = true
  })
}

function countExamUnanswered(): number {
  let n = 0
  for (let i = 0; i < questions.value.length; i++) {
    if (!slotExamReady(quizSlots.value[i], questions.value[i])) n++
  }
  return n
}

function buildModuleDrillStats(): {
  items: SuitePracticeItemPayload[]
  correctCount: number
  wrongCount: number
  unansweredCount: number
  submittedCount: number
} {
  const items: SuitePracticeItemPayload[] = []
  let correctCount = 0
  let wrongCount = 0
  let unansweredCount = 0
  const submittedCount = questions.value.length

  for (let i = 0; i < questions.value.length; i++) {
    const slot = quizSlots.value[i]
    const qrow = questions.value[i]
    const oc = getOptionLineCount(qrow)
    const pickTrim = String(slot?.picked || '').trim()
    const explicitSkip = !!slot?.skipped
    const blankAck = !!slot?.blankDone

    const unansweredRow = !explicitSkip && (oc > 0 ? !pickTrim : !blankAck)
    const skippedForApi = explicitSkip || unansweredRow

    const ak = canonicalAnswerKey(String(qrow?.answer || ''))
    let rowCorrect = false
    if (!skippedForApi && pickTrim) {
      const pk = canonicalPickKey(slot.picked)
      rowCorrect = ak !== '' && ak === pk
    }

    if (skippedForApi) unansweredCount += 1
    else if (rowCorrect) correctCount += 1
    else wrongCount += 1

    items.push({
      question_id: String(qrow.id),
      question_no: String(qrow.question_no || ''),
      picked: skippedForApi ? null : slot?.picked ?? null,
      answer: String(qrow.answer || ''),
      correct: rowCorrect && !skippedForApi && !!pickTrim,
      skipped: skippedForApi,
    })
  }

  return { items, correctCount, wrongCount, unansweredCount, submittedCount }
}

function buildModuleDrillCloudBody(recordStatus: 'in_progress' | 'completed') {
  if (!questions.value.length || !sessionId.value) return null
  const { items, correctCount, wrongCount, unansweredCount, submittedCount } = buildModuleDrillStats()
  const durationSec = Math.max(0, Math.floor(mergeRunningSegmentIntoAccum() / 1000))
  return {
    paper_id: BANK_DRILL_PAPER_ID,
    paper_title: quizTitle.value,
    paper_folder: `广东 · ${TRACK_LABEL[sessionTrack.value]} · ${sessionYears.value.join(',')}年`,
    mode: 'exam' as const,
    duration_sec: durationSec,
    correct_count: correctCount,
    wrong_count: wrongCount,
    unanswered_count: unansweredCount,
    submitted_count: submittedCount,
    items,
    practice_subtype: 'bank_module_drill' as const,
    client_session_id: sessionId.value,
    record_status: recordStatus,
    bank_drill_session_id: sessionId.value,
    bank_drill_exam_track: sessionTrack.value,
    bank_drill_years: [...sessionYears.value],
    bank_drill_major_module: sessionModuleId.value,
    bank_drill_requested_count: requestedCount.value,
  }
}

async function tryCloudSyncNow(): Promise<void> {
  const id = await flushSuitePracticeCloudSync()
  if (!id && phase.value === 'quiz' && questions.value.length && !examRecordSaved.value) {
    cloudSyncWarn.value =
      '做题进度未能同步到服务器（请确认已登录且账号已开通套卷权限）。交卷后仍会尝试写入记录。'
  } else if (id) {
    cloudSyncWarn.value = ''
  }
}

function startModuleCloudSync() {
  registerSuitePracticeCloudSync(() => buildModuleDrillCloudBody('in_progress'))
}

function stopModuleCloudSync() {
  unregisterSuitePracticeCloudSync()
}

async function persistExamPracticeRecord(): Promise<void> {
  if (examRecordSaved.value || !questions.value.length) return
  try {
    loadErr.value = ''
    const body = buildModuleDrillCloudBody('completed')
    if (!body) return
    await suiteBankApi.appendPracticeRecord(body)
    examRecordSaved.value = true
    clearCloudSessionId(BANK_DRILL_PAPER_ID)
    stopModuleCloudSync()
  } catch (e) {
    const msg = String((e as Error)?.message || e)
    loadErr.value = `做题记录未写入服务器：${msg}。请先登录；答题仍在本页可回看。可点页头「做题记录」查看历史。`
    window.alert(loadErr.value)
  }
}

async function confirmSubmitExamSheet() {
  if (examRecordSaved.value || examSheetSubmitted.value) return
  if (!questions.value.length) return

  const touched = quizSlots.value.some(
    s => !!(s.skipped || s.blankDone || String(s.picked || '').trim()),
  )
  if (!touched) {
    window.alert('尚未作答任何题目，无法交卷。')
    return
  }

  const remain = countExamUnanswered()
  if (remain && !window.confirm(`还有 ${remain} 题未完成，将以未作答记入记录。确定交卷？`)) return
  if (!remain && !window.confirm('确定交卷？交卷后可查看参考答案与解析。')) return

  examActiveMsAccum.value = mergeRunningSegmentIntoAccum()
  examSegmentStartedAt.value = Date.now()
  examTimerPaused.value = true

  examSheetSubmitted.value = true
  revealAllExamSlots()

  await persistExamPracticeRecord()
}

function pickLetter(L: string) {
  const slot = quizSlots.value[qIdx.value]
  if (!slot || slot.revealed || examSheetSubmitted.value) return
  const ansRaw = String(currentQ.value?.answer || '')
  if (!isMultiSelectAnswer(ansRaw)) {
    slot.picked = L
    scheduleSuitePracticeCloudSync(true)
    if (!examSheetSubmitted.value && getOptionLineCount(currentQ.value) > 0) {
      nextTick(() => nextQuestion())
    }
    return
  }
  const cur = parseAnswerLetters(slot.picked || '')
  const set = new Set(cur)
  if (set.has(L)) set.delete(L)
  else set.add(L)
  const next = [...set].sort()
  slot.picked = next.length ? next.join(',') : null
  scheduleSuitePracticeCloudSync(true)
}

function submitExamQuestion() {
  if (examSheetSubmitted.value) return
  const slot = quizSlots.value[qIdx.value]
  if (!slot || slot.revealed) return
  if (currentHasOptions.value) return
  slot.blankDone = true
}

function skipExamQuestion() {
  if (examSheetSubmitted.value) return
  const slot = quizSlots.value[qIdx.value]
  if (!slot || slot.revealed) return
  slot.picked = null
  slot.skipped = true
  slot.blankDone = false
  scheduleSuitePracticeCloudSync(true)
}

function nextQuestion() {
  if (examNextLocked.value) return
  if (qIdx.value + 1 >= questions.value.length) {
    if (!examSheetSubmitted.value) void confirmSubmitExamSheet()
    return
  }
  qIdx.value += 1
}

function handleFooterNext() {
  if (footerNextBlocked.value) {
    if (examNextLocked.value) {
      window.alert(
        '请先完成本题：有选项时选好选项后点「下一题」即可；亦可点「不会做」。无选项题点「本题无选项，继续」。',
      )
    }
    return
  }
  nextQuestion()
}

async function backToSetup() {
  stopExamTimerDisplay()
  if (phase.value === 'quiz' && !examRecordSaved.value && questions.value.length) {
    await flushSuitePracticeCloudSync()
  }
  stopModuleCloudSync()
  phase.value = 'setup'
  questions.value = []
  quizSlots.value = []
  qIdx.value = 0
  examSheetSubmitted.value = false
  examRecordSaved.value = false
  loadErr.value = ''
  void refreshMeta()
}

function goWorkspace() {
  window.location.href = '/'
}

function goSuiteBank() {
  void router.push({ name: 'XingceSuiteBank' })
}

function goPortal() {
  window.location.href = '/?portal=1'
}

watch(
  () => [quizSlots.value, qIdx.value, examActiveMsAccum.value, examTimerPaused.value],
  () => {
    if (phase.value === 'quiz' && !examRecordSaved.value && !examSheetSubmitted.value) {
      scheduleSuitePracticeCloudSync()
    }
  },
  { deep: true },
)

onBeforeUnmount(() => {
  stopExamTimerDisplay()
  if (phase.value === 'quiz' && !examRecordSaved.value && questions.value.length) {
    void flushSuitePracticeCloudSync()
  }
  stopModuleCloudSync()
})
</script>

<template>
  <div class="sb-page" :class="{ 'sb-page--quiz': phase === 'quiz' && questions.length }">
    <header class="sb-head">
      <div class="sb-head-row">
        <h1 class="sb-title">套卷模块随机练</h1>
        <div class="sb-actions">
          <button v-if="phase === 'quiz'" type="button" class="btn btn-secondary" @click="backToSetup">
            ← 返回筛选
          </button>
          <button type="button" class="btn btn-secondary" @click="showPracticeRecords = true">做题记录</button>
          <button type="button" class="btn btn-secondary" @click="showExportRecords = true">导出记录</button>
          <button type="button" class="btn btn-secondary" @click="goSuiteBank">套卷列表</button>
          <button type="button" class="btn btn-secondary" @click="goWorkspace">行测工作台</button>
          <button type="button" class="btn btn-ghost" @click="goPortal">模块首页</button>
        </div>
      </div>
      <p class="sb-meta">
        仅限<strong>广东</strong>套卷题库；<strong>省考</strong>与<strong>统考</strong>分层抽题互不混合。默认勾选<strong>当前自然日起算连续
        5 个自然年</strong>（可在年份标签中调整）。随机练与 PDF 导出默认都会<strong>排除历史导出过或做过的题</strong>；全部刷完后可手动清零。
      </p>
    </header>

    <p v-if="loadErr" class="sb-err">{{ loadErr }}</p>
    <p v-if="cloudSyncWarn" class="sb-sync-warn">{{ cloudSyncWarn }}</p>

    <template v-if="phase === 'setup'">
      <div class="bd-setup">
        <div class="bd-row">
          <span class="bd-label">考试类型</span>
          <div class="bd-tabs">
            <button
              type="button"
              class="bd-tab"
              :class="{ active: examTrack === 'provincial' }"
              @click="examTrack = 'provincial'"
            >
              省考
            </button>
            <button
              type="button"
              class="bd-tab"
              :class="{ active: examTrack === 'unified' }"
              @click="examTrack = 'unified'"
            >
              统考
            </button>
          </div>
        </div>

        <div class="bd-row bd-years-row">
          <span class="bd-label">试卷年份</span>
          <div class="sb-years">
            <button type="button" class="sb-chip" @click="restoreDefaultYears">恢复默认 5 年</button>
            <button
              v-for="y in meta?.year_catalog ?? []"
              :key="y"
              type="button"
              class="sb-chip"
              :class="{ active: selectedYears.includes(y) }"
              @click="toggleYear(y)"
            >
              {{ y }}
            </button>
          </div>
        </div>

        <div class="bd-row bd-count-row">
          <span class="bd-label">本次题量</span>
          <input v-model.number="drillCount" class="bd-count-input" type="number" min="1" max="80" />
          <span class="bd-hint">默认 10，上限 80；题量按“去重后剩余可用题数”计算</span>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="resetHistoryLoading"
            @click="resetDrillHistory"
          >
            {{ resetHistoryLoading ? '清零中…' : '清零去重历史' }}
          </button>
          <a
            class="btn btn-secondary bd-export-all-btn"
            :class="{ 'is-disabled': metaLoading || !exportHref }"
            :href="exportHref || undefined"
            target="_blank"
            rel="noopener"
          >
            导出下方全部题型 PDF
          </a>
        </div>

        <p v-if="metaLoading" class="sb-loading">加载题池统计…</p>

        <div v-else class="bd-modules">
          <div
            v-for="m in meta?.modules ?? []"
            :key="m.id"
            class="bd-mod-card"
          >
            <span class="bd-mod-title">{{ m.label }}</span>
            <span class="bd-mod-sub">剩余 {{ m.count }} / 总 {{ m.total_count }} 题</span>
            <span v-if="m.used_count > 0" class="bd-mod-sub bd-mod-sub--used">已排除 {{ m.used_count }} 题历史</span>
            <div class="bd-mod-actions">
              <button
                type="button"
                class="btn btn-primary bd-mod-btn"
                :disabled="m.count <= 0"
                @click="startModule(m.id)"
              >
                开始练习
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="sb-quiz">
      <h2 class="sb-quiz-title">{{ quizTitle }}</h2>
      <div class="sb-src-line" v-if="currentQ?.paper_title">
        本题出自：<strong>{{ currentQ.paper_title }}</strong>
      </div>

      <div v-if="!examSheetSubmitted" class="sb-exam-hint">
        <strong>做题模式：</strong>随机抽取 {{ questions.length }} 题；交卷后揭晓答案并写入服务器做题记录（须已登录）。
        做题进度约每 45 秒自动同步云端；点右上角<strong>做题记录</strong>可查看（含未交卷的「进行中」）。
      </div>
      <div v-else class="sb-exam-done-banner">
        <strong>已交卷。</strong>可回看任意题目。
        <button type="button" class="btn btn-secondary sb-exam-done-back" @click="backToSetup">
          返回筛选
        </button>
      </div>

      <div v-if="!examSheetSubmitted" class="sb-exam-toolbar">
        <span class="sb-exam-clock">{{ examClockText }}</span>
        <button type="button" class="btn btn-secondary" @click="toggleExamPause">
          {{ examTimerPaused ? '继续计时' : '暂停' }}
        </button>
        <button type="button" class="btn btn-secondary" @click="confirmSubmitExamSheet">交卷</button>
      </div>

      <div v-if="currentQ" class="sb-quiz-meta">
        {{ qIdx + 1 }} / {{ questions.length }} · 第 {{ currentQ.question_no || qIdx + 1 }} 题
        <span v-if="currentIsMulti" class="sb-multi-tag">多选</span>
      </div>
      <div v-if="currentQ && sectionBanner" class="sb-section">{{ sectionBanner }}</div>
      <div v-if="currentQ && sharedMaterialRaw" class="sb-material-card">
        <div class="sb-material-label">给定资料</div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="sb-stem-rich sb-material-body" v-html="sharedMaterialHtml"></div>
      </div>
      <img v-if="stemImageSrc" class="sb-stem-img" :src="stemImageSrc" alt="题干插图" />
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="currentQ" class="sb-stem sb-stem-rich" v-html="stemHtml"></div>
      <div v-if="currentQ && optionLines.length" class="sb-opts">
        <button
          v-for="(line, oi) in optionLines"
          :key="oi"
          type="button"
          class="sb-opt"
          :class="optionButtonClass(line, oi)"
          @click="pickLetter(letterForLine(line, oi))"
        >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span v-if="optionLineHasImg(line)" class="sb-opt-inner" v-html="richOptionHtml(line)" />
          <span v-else class="sb-opt-inner">{{ line }}</span>
        </button>
      </div>
      <div v-else-if="currentQ" class="sb-no-opt">（未识别到选项行）</div>
      <div v-if="gradingVisibleForCurrent && currentQ?.answer" class="sb-answer">
        参考答案：<strong>{{ currentQ.answer }}</strong>
      </div>
      <div v-if="gradingVisibleForCurrent && currentQ?.analysis" class="sb-analysis-wrap">
        <div class="sb-analysis-label">解析</div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="sb-analysis-body" v-html="analysisExamHtml"></div>
      </div>

      <div class="sb-bar">
        <template v-if="!examSheetSubmitted">
          <button
            v-if="!currentHasOptions"
            type="button"
            class="btn btn-primary"
            @click="submitExamQuestion"
          >
            本题无选项，继续
          </button>
          <button v-if="currentHasOptions" type="button" class="btn btn-secondary" @click="skipExamQuestion">
            不会做
          </button>
        </template>
        <button
          type="button"
          class="btn btn-primary sb-footer-next"
          :class="{ 'sb-footer-next--blocked': footerNextBlocked }"
          @click="handleFooterNext"
        >
          {{ examSheetSubmitted && qIdx >= questions.length - 1 ? '已是最后一题' : '下一题' }}
        </button>
      </div>

      <aside v-if="questions.length" class="sb-sheet-dock" aria-label="答题卡">
        <button type="button" class="sb-sheet-tab" @click="sheetExpanded = !sheetExpanded">
          <span class="sb-sheet-tab-label">答题卡</span>
          <span class="sb-sheet-caret">{{ sheetExpanded ? '▼' : '▲' }}</span>
        </button>
        <div v-show="sheetExpanded" class="sb-sheet-panel">
          <div v-for="(g, gi) in sheetGroups" :key="gi" class="sb-sheet-group">
            <div class="sb-sheet-group-title">{{ g.title }}</div>
            <div class="sb-sheet-grid">
              <button
                v-for="idx in g.indices"
                :key="idx"
                type="button"
                class="sb-sheet-cell"
                :class="sheetCellClass(idx)"
                @click="jumpQuestion(idx)"
              >
                {{ displayQuestionNo(idx) }}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <SuitePracticeRecordsDialog v-model:open="showPracticeRecords" initial-tab="module" />
    <BankDrillExportRecordsDialog v-model:open="showExportRecords" />
  </div>
</template>

<style scoped>
.sb-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 20px 18px 120px;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
.sb-page--quiz {
  padding-bottom: 200px;
}
.sb-head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
}
.sb-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
}
.sb-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sb-meta {
  margin: 8px 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
}
.sb-err {
  color: #b91c1c;
  font-size: 13px;
}
.sb-sync-warn {
  color: #b45309;
  font-size: 13px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 8px 12px;
  margin: 0 0 10px;
}
.sb-loading {
  color: #64748b;
  font-size: 14px;
}
.bd-setup {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.bd-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.bd-years-row {
  align-items: flex-start;
}
.bd-label {
  font-size: 13px;
  font-weight: 700;
  color: #475569;
  min-width: 72px;
}
.bd-tabs {
  display: flex;
  gap: 8px;
}
.bd-tab {
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  font-weight: 600;
  color: #475569;
}
.bd-tab.active {
  border-color: #6366f1;
  background: #eef2ff;
  color: #3730a3;
}
.sb-years {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}
.sb-chip {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  color: #475569;
}
.sb-chip.active {
  background: #eef2ff;
  border-color: #6366f1;
  color: #3730a3;
  font-weight: 600;
}
.bd-count-input {
  width: 72px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 14px;
}
.bd-hint {
  font-size: 12px;
  color: #94a3b8;
}
.bd-export-all-btn {
  margin-left: auto;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.bd-export-all-btn.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}
.bd-modules {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.bd-mod-card {
  text-align: left;
  padding: 16px 14px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bd-mod-title {
  font-weight: 800;
  font-size: 15px;
}
.bd-mod-sub {
  font-size: 12px;
  color: #64748b;
}
.bd-mod-sub--used {
  color: #92400e;
}
.bd-mod-actions {
  display: flex;
  margin-top: auto;
}
.bd-mod-btn {
  width: 100%;
}
.sb-quiz {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
}
.sb-src-line {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 10px;
}
.sb-quiz-title {
  margin: 0 0 6px;
  font-size: 18px;
}
.sb-quiz-meta {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 12px;
}
.sb-multi-tag {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #a16207;
  background: #fef9c3;
  border: 1px solid #eab308;
  padding: 2px 8px;
  border-radius: 999px;
}
.sb-section {
  font-size: 14px;
  font-weight: 700;
  color: #4338ca;
  margin: -6px 0 12px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
}
.sb-material-card {
  margin-bottom: 14px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.sb-material-label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  margin-bottom: 8px;
}
.sb-stem-img {
  max-width: 100%;
  border-radius: 10px;
  margin-bottom: 12px;
}
.sb-stem {
  font-size: 15px;
  line-height: 1.75;
  margin-bottom: 14px;
}
:deep(.sb-blank) {
  display: inline-block;
  min-width: 4.5em;
  border-bottom: 2px solid #334155;
  margin: 0 4px;
  vertical-align: baseline;
}
.sb-opts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}
.sb-opt {
  text-align: left;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.65;
}
.sb-opt.pick {
  border-color: #6366f1;
  background: #eef2ff;
}
.sb-opt.ok {
  border-color: #22c55e;
  background: #ecfdf5;
}
.sb-opt.bad {
  border-color: #f97316;
  background: #fff7ed;
}
.sb-opt.ok-miss {
  border-style: dashed;
  border-color: #86efac;
}
.sb-no-opt {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 12px;
}
.sb-answer {
  font-size: 14px;
  margin-bottom: 10px;
}
.sb-exam-hint {
  font-size: 13px;
  line-height: 1.65;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.sb-exam-done-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #bbf7d0;
  background: #ecfdf5;
  font-size: 13px;
  color: #166534;
}
.sb-exam-done-back {
  margin-left: auto;
}
.sb-exam-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f1f5f9;
}
.sb-exam-clock {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 15px;
  flex: 1;
}
.sb-analysis-wrap {
  padding: 12px;
  border-radius: 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  margin-bottom: 12px;
}
.sb-analysis-label {
  font-size: 12px;
  font-weight: 700;
  color: #166534;
  margin-bottom: 6px;
}
.sb-analysis-body {
  font-size: 14px;
  line-height: 1.85;
  color: #166534;
  word-break: break-word;
}
.sb-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}
.sb-footer-next--blocked {
  opacity: 0.45;
  pointer-events: none;
}
.sb-sheet-dock {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 50;
  width: min(320px, calc(100vw - 32px));
}
.sb-sheet-tab {
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 12px 12px 0 0;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  font-weight: 700;
}
.sb-sheet-panel {
  border: 1px solid #e2e8f0;
  border-top: none;
  background: #fff;
  border-radius: 0 0 12px 12px;
  max-height: 46vh;
  overflow-y: auto;
  padding: 10px;
}
.sb-sheet-group-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  margin: 6px 0;
}
.sb-sheet-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sb-sheet-cell {
  min-width: 36px;
  height: 34px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  cursor: pointer;
  font-size: 12px;
}
.sb-sheet-cell.is-current {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px #c7d2fe;
}
.sb-sheet-cell.is-touched {
  background: #fef9c3;
  border-color: #eab308;
}
.sb-sheet-cell.is-skip {
  background: #e2e8f0;
  border-color: #94a3b8;
  color: #475569;
}
.sb-sheet-cell.is-right {
  background: #dcfce7;
  border-color: #22c55e;
}
.sb-sheet-cell.is-wrong {
  background: #ffedd5;
  border-color: #fb923c;
}
.btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 13px;
}
.btn-primary {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #fff;
}
.btn-secondary:hover {
  background: #f1f5f9;
}
.btn-ghost {
  background: transparent;
}
</style>
