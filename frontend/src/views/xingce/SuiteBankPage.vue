<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import type { SuitePaperRow, SuitePracticeItemPayload, SuiteQuestionRow } from '@/api/suiteBank'
import { suiteBankApi } from '@/api/suiteBank'
import GlobalSearchModal from '@/components/xingce/GlobalSearchModal.vue'
import SuitePracticeRecordsDialog from '@/components/xingce/SuitePracticeRecordsDialog.vue'
import {
  clearCloudSessionId,
  getOrCreateCloudSessionId,
  registerSuitePracticeCloudSync,
  scheduleSuitePracticeCloudSync,
  unregisterSuitePracticeCloudSync,
  flushSuitePracticeCloudSync,
} from '@/lib/suitePracticeCloudSync'

type ExamChoice = 'province' | 'unified' | 'other'

const router = useRouter()
const route = useRoute()

/** Router query 可能是 string | string[]，重复参数时直接 String(query) 会变成 "a,b"，导致误判模式 */
function firstQueryValue(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return String(v[0] ?? '').trim()
  return String(v).trim()
}

const showGlobalSearch = ref(false)
const loading = ref(true)
const loadErr = ref('')
const papers = ref<SuitePaperRow[]>([])
const filter = ref('')

/** 未选题库类型时为 null，入口先选省考 / 统考 */
const examChoice = ref<ExamChoice | null>(null)
const selectedYear = ref('')

const mode = ref<'list' | 'quiz'>('list')
const activePaperTitle = ref('')
const questions = ref<SuiteQuestionRow[]>([])
const qIdx = ref(0)

/** 每题作答状态（答题卡着色 / 往返题目保留选项） */
type QuizSlot = {
  picked: string | null
  revealed: boolean
  /** 做题模式：明确「不会做」 */
  skipped?: boolean
  /** 做题模式：无选项题已确认 */
  blankDone?: boolean
  /** 做题模式：历史草稿字段（曾用于多选翻题门槛，已废弃） */
  lockedIn?: boolean
}
const quizSlots = ref<QuizSlot[]>([])
const sheetExpanded = ref(true)
const booted = ref(false)

/** preview：随时「看答案」；exam：整场不交卷不批改，整体交卷后统一揭晓 */
const sessionPracticeMode = ref<'preview' | 'exam'>('preview')
const examSheetSubmitted = ref(false)
const examRecordSaved = ref(false)
const quizPaperId = ref('')
const quizPaperFolder = ref('')
const showPracticeRecords = ref(false)
const practiceRecordsDialogRef = ref<InstanceType<typeof SuitePracticeRecordsDialog> | null>(null)
const cloudClientSessionId = ref('')
const draftListRev = ref(0)

/** 做题模式草稿（未交卷），按套卷 id 存 sessionStorage */
const EXAM_DRAFT_KEY_PREFIX = 'xingce_suite_exam_draft_v1:'

type ExamDraftV1 = {
  v: 1
  paperId: string
  paperTitle: string
  paperFolder: string
  qIdx: number
  slots: QuizSlot[]
  activeMsAccum: number
  paused: boolean
  questionCount: number
}

/** 有效计时：累计 + 当前运行段 */
const examActiveMsAccum = ref(0)
const examSegmentStartedAt = ref(0)
const examTimerPaused = ref(false)
const examDisplayTick = ref(0)
let examTickTimer: ReturnType<typeof setInterval> | null = null

function examDraftStorageKey(paperId: string) {
  return EXAM_DRAFT_KEY_PREFIX + paperId
}

function mergeRunningSegmentIntoAccum(): number {
  let ms = examActiveMsAccum.value
  if (!examTimerPaused.value && examSegmentStartedAt.value) {
    ms += Date.now() - examSegmentStartedAt.value
  }
  return ms
}

function getExamElapsedMs(): number {
  void examDisplayTick.value
  if (examTimerPaused.value) return examActiveMsAccum.value
  if (!examSegmentStartedAt.value) return examActiveMsAccum.value
  return examActiveMsAccum.value + (Date.now() - examSegmentStartedAt.value)
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
  if (sessionPracticeMode.value !== 'exam' || examSheetSubmitted.value) return
  if (examTimerPaused.value) {
    examTimerPaused.value = false
    examSegmentStartedAt.value = Date.now()
  } else {
    examActiveMsAccum.value = mergeRunningSegmentIntoAccum()
    examSegmentStartedAt.value = 0
    examTimerPaused.value = true
  }
}

function examHasMeaningfulProgress(): boolean {
  return (
    quizSlots.value.some(
      s =>
        !!(s?.picked?.trim?.() || s?.skipped || s?.blankDone || s?.lockedIn || s?.revealed),
    ) ||
    qIdx.value > 0 ||
    mergeRunningSegmentIntoAccum() > 3000
  )
}

function saveExamDraftToStorage(): void {
  if (sessionPracticeMode.value !== 'exam' || !quizPaperId.value || !questions.value.length) return
  if (!examHasMeaningfulProgress()) {
    try {
      sessionStorage.removeItem(examDraftStorageKey(quizPaperId.value))
      draftListRev.value++
    } catch {
      /* ignore */
    }
    return
  }
  try {
    const activeMsAccum = mergeRunningSegmentIntoAccum()
    const draft: ExamDraftV1 = {
      v: 1,
      paperId: quizPaperId.value,
      paperTitle: activePaperTitle.value,
      paperFolder: quizPaperFolder.value,
      qIdx: qIdx.value,
      slots: quizSlots.value.map(s => ({ ...s })),
      activeMsAccum,
      paused: true,
      questionCount: questions.value.length,
    }
    sessionStorage.setItem(examDraftStorageKey(quizPaperId.value), JSON.stringify(draft))
    draftListRev.value++
  } catch {
    /* ignore */
  }
}

function clearExamDraftForPaper(paperId: string) {
  try {
    sessionStorage.removeItem(examDraftStorageKey(paperId))
    draftListRev.value++
  } catch {
    /* ignore */
  }
}

/** 切换到其它题目前，把当前套卷计时合并进草稿 */
function stashCurrentExamBeforeNavigation() {
  if (sessionPracticeMode.value !== 'exam' || !quizPaperId.value || !questions.value.length) return
  saveExamDraftToStorage()
}

function tryRestoreExamDraft(paperId: string, focusQid?: string | null): boolean {
  if (firstQueryValue(route.query.examNew) === '1') {
    clearExamDraftForPaper(paperId)
    return false
  }
  try {
    const raw = sessionStorage.getItem(examDraftStorageKey(paperId))
    if (!raw) return false
    const draft = JSON.parse(raw) as ExamDraftV1
    if (draft?.v !== 1 || draft.paperId !== paperId || draft.questionCount !== questions.value.length)
      return false
    quizSlots.value = (draft.slots || []).slice(0, questions.value.length).map(s => ({
      picked: s?.picked ?? null,
      revealed: false,
      skipped: !!s?.skipped,
      blankDone: !!s?.blankDone,
      lockedIn: !!s?.lockedIn,
    }))
    while (quizSlots.value.length < questions.value.length)
      quizSlots.value.push({ picked: null, revealed: false })
    qIdx.value = Math.min(Math.max(0, draft.qIdx || 0), Math.max(0, questions.value.length - 1))
    examActiveMsAccum.value = Math.max(0, draft.activeMsAccum || 0)
    examSegmentStartedAt.value = 0
    examTimerPaused.value = true
    if (focusQid) {
      const ix = questions.value.findIndex(x => String(x.id) === String(focusQid))
      if (ix >= 0) qIdx.value = ix
    }
    return true
  } catch {
    return false
  }
}

type DraftSummaryRow = {
  paperId: string
  title: string
  folder: string
  answered: number
  total: number
  updatedHint: string
}

const draftSummaries = computed((): DraftSummaryRow[] => {
  void draftListRev.value
  const rows: DraftSummaryRow[] = []
  try {
    const seen = new Set<string>()
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (!key || !key.startsWith(EXAM_DRAFT_KEY_PREFIX)) continue
      const raw = sessionStorage.getItem(key)
      if (!raw || seen.has(key)) continue
      seen.add(key)
      const draft = JSON.parse(raw) as ExamDraftV1
      if (draft?.v !== 1 || !draft.paperId) continue
      const answered =
        draft.slots?.filter(
          s =>
            !!(s?.skipped || s?.blankDone || s?.lockedIn || String(s?.picked || '').trim()),
        ).length ?? 0
      rows.push({
        paperId: draft.paperId,
        title: draft.paperTitle || '未命名',
        folder: draft.paperFolder || '',
        answered,
        total: draft.questionCount || 0,
        updatedHint: '',
      })
    }
  } catch {
    /* ignore */
  }
  return rows.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
})

const examClockText = computed(() => {
  void examDisplayTick.value
  const sec = Math.floor(getExamElapsedMs() / 1000)
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
})

function paperHaystack(p: SuitePaperRow): string {
  return `${p.folder}\u0000${p.title}\u0000${p.source_rel_path}`
}

/**
 * 与素材目录一致：顶层文件夹即类型（例：广东省考 → 省考，广东统考 → 统考）。
 * 优先读 folder；文件夹无法识别时再读标题与路径。
 */
function classifyFromPathText(s: string): ExamChoice | null {
  const t = String(s || '')
  if (/统考/.test(t)) return 'unified'
  if (/省考/.test(t)) return 'province'
  return null
}

function classifyExam(p: SuitePaperRow): ExamChoice {
  const fromFolder = classifyFromPathText(p.folder)
  if (fromFolder) return fromFolder
  const fromRest = classifyFromPathText(`${p.title}\u0000${p.source_rel_path}`)
  if (fromRest) return fromRest
  return 'other'
}

function paperYear(p: SuitePaperRow): string | null {
  const s = paperHaystack(p).replace(/\s+/g, '')
  const m = s.match(/(?:^|[^\d])(20\d{2}|19\d{2})(?:[^\d]|$)/)
  return m ? m[1] : null
}

const examLabel: Record<ExamChoice, string> = {
  province: '省考',
  unified: '统考',
  other: '其他',
}

const papersForExam = computed(() => {
  if (!examChoice.value) return []
  const k = examChoice.value
  return papers.value.filter(p => classifyExam(p) === k)
})

const yearOptions = computed(() => {
  const ys = new Set<string>()
  for (const p of papersForExam.value) {
    const y = paperYear(p)
    if (y) ys.add(y)
  }
  return [...ys].sort((a, b) => b.localeCompare(a))
})

const otherPaperCount = computed(() => papers.value.filter(p => classifyExam(p) === 'other').length)

const filteredPapers = computed(() => {
  let list = papersForExam.value
  if (selectedYear.value) list = list.filter(p => paperYear(p) === selectedYear.value)
  const q = filter.value.trim().toLowerCase()
  if (q) {
    list = list.filter(p => {
      const b = `${p.title} ${p.folder} ${p.source_rel_path}`.toLowerCase()
      return b.includes(q)
    })
  }
  return [...list].sort((a, b) => {
    const ya = paperYear(a)
    const yb = paperYear(b)
    if (ya !== yb) {
      if (!ya) return 1
      if (!yb) return -1
      return yb.localeCompare(ya)
    }
    return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN')
  })
})

function syncListQuery() {
  const q: Record<string, string> = {}
  if (examChoice.value) q.exam = examChoice.value
  if (selectedYear.value) q.year = selectedYear.value
  void router.replace({ name: 'XingceSuiteBank', query: q })
}

function pickExam(kind: ExamChoice) {
  examChoice.value = kind
  selectedYear.value = ''
  filter.value = ''
  syncListQuery()
}

function changeExamType() {
  examChoice.value = null
  selectedYear.value = ''
  filter.value = ''
  void router.replace({ name: 'XingceSuiteBank', query: {} })
}

function setYear(y: string) {
  selectedYear.value = y
  syncListQuery()
}

const currentQ = computed(() => questions.value[qIdx.value] ?? null)

const sectionBanner = computed(() => {
  const m = currentQ.value?.meta as Record<string, unknown> | undefined
  const s = m?.section_heading
  return typeof s === 'string' && s.trim() ? s.trim() : ''
})

/** img_data：导入脚本写入的 data:image/*;base64,... */
const stemImageSrc = computed(() => {
  const raw = String(currentQ.value?.img_data ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  return `data:image/png;base64,${raw}`
})

const currentPicked = computed(() => quizSlots.value[qIdx.value]?.picked ?? null)
const currentRevealed = computed(() => quizSlots.value[qIdx.value]?.revealed ?? false)

/** 当前题：选项对错色、参考答案、解析（预览=点「看答案」后；做题=整场交卷后） */
const gradingVisibleForCurrent = computed(() => {
  if (sessionPracticeMode.value === 'preview') return currentRevealed.value
  if (sessionPracticeMode.value === 'exam') return examSheetSubmitted.value
  return false
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

/** Word 行内插图入库为 `<img class="sb-inline-img" src="data:…">`，仅允许 data:image base64 */
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

const stemHtml = computed(() => mergeStemRich(String(currentQ.value?.stem ?? '')))

/** 资料分析等多题共用：上一题答案后与下一题小题头之间的段落（导入写入 meta.shared_material） */
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

function displayQuestionNo(i: number): string {
  const q = questions.value[i]
  return String(q?.question_no || i + 1)
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

  let graded = false
  const m = sessionPracticeMode.value
  if (m === 'exam') graded = !!(slot?.revealed && examSheetSubmitted.value)
  else if (m === 'preview') graded = !!slot?.revealed

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

function isWordImportPaper(p: SuitePaperRow): boolean {
  return String(p.source_rel_path || '').startsWith('word版本/')
}

const optionLines = computed(() => {
  const raw = String(currentQ.value?.options ?? '').trim()
  if (!raw) return [] as string[]
  return raw.split(/\n|\|/).map(s => s.trim()).filter(Boolean)
})

/** 本题是否有可选项行（导入失败时可为空——须允许先做不卡「下一题」） */
const currentHasOptions = computed(() => optionLines.value.length > 0)

function letterForLine(line: string, oi: number): string {
  const plain = stripInlineMarkup(line)
  const m = plain.match(/^([A-Da-d])/)
  if (m) return String(m[1]).toUpperCase()
  return String.fromCharCode(65 + oi)
}

/** 参考答案中的选项字母（支持「A,B,D」或连续「ABD」） */
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
  const pickTrim = String(slot.picked || '').trim()
  if (!pickTrim) return false
  return true
}

const currentExamSlotReady = computed(() => {
  if (sessionPracticeMode.value !== 'exam' || examSheetSubmitted.value) return true
  return slotExamReady(quizSlots.value[qIdx.value], currentQ.value)
})

const examNextLocked = computed(
  () => sessionPracticeMode.value === 'exam' && !examSheetSubmitted.value && !currentExamSlotReady.value,
)

const footerNextBlocked = computed(() => {
  if (sessionPracticeMode.value === 'exam' && examSheetSubmitted.value && questions.value.length) {
    return qIdx.value >= questions.value.length - 1
  }
  return examNextLocked.value
})

const quizNextFooterLabel = computed(() => {
  if (sessionPracticeMode.value !== 'exam') return '下一题'
  if (examSheetSubmitted.value && questions.value.length && qIdx.value >= questions.value.length - 1)
    return '已是最后一题'
  if (questions.value.length && qIdx.value >= questions.value.length - 1) return '交卷'
  return '下一题'
})

const analysisExamHtml = computed(() => {
  const s = String(currentQ.value?.analysis || '').trim()
  if (!s) return ''
  return escapeHtml(s).replace(/\n/g, '<br/>')
})

function optionButtonClass(line: string, oi: number): Record<string, boolean> {
  const letter = letterForLine(line, oi)
  const rev = gradingVisibleForCurrent.value
  const ansLetters = parseAnswerLetters(String(currentQ.value?.answer || ''))
  const pickedLetters = parseAnswerLetters(currentPicked.value || '')
  const inAns = ansLetters.includes(letter)
  const picked = pickedLetters.includes(letter)

  if (!rev) {
    return { pick: picked }
  }

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

async function boot() {
  loading.value = true
  loadErr.value = ''
  try {
    papers.value = await suiteBankApi.listPapers()
  } catch (e) {
    loadErr.value = String((e as Error).message || e)
  } finally {
    loading.value = false
  }
}

function buildExamPracticeStats(): {
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

function buildPaperExamCloudBody(recordStatus: 'in_progress' | 'completed') {
  if (sessionPracticeMode.value !== 'exam' || !quizPaperId.value || !questions.value.length) return null
  if (!cloudClientSessionId.value) return null
  const { items, correctCount, wrongCount, unansweredCount, submittedCount } = buildExamPracticeStats()
  const durationSec = Math.max(0, Math.floor(mergeRunningSegmentIntoAccum() / 1000))
  return {
    paper_id: quizPaperId.value,
    paper_title: activePaperTitle.value || '',
    paper_folder: quizPaperFolder.value || '',
    mode: 'exam' as const,
    duration_sec: durationSec,
    correct_count: correctCount,
    wrong_count: wrongCount,
    unanswered_count: unansweredCount,
    submitted_count: submittedCount,
    items,
    practice_subtype: 'paper_exam' as const,
    client_session_id: cloudClientSessionId.value,
    record_status: recordStatus,
  }
}

function startPaperExamCloudSync() {
  registerSuitePracticeCloudSync(() => buildPaperExamCloudBody('in_progress'))
}

function stopPaperExamCloudSync() {
  unregisterSuitePracticeCloudSync()
}

async function persistExamPracticeRecord(): Promise<void> {
  if (examRecordSaved.value || sessionPracticeMode.value !== 'exam') return
  if (!quizPaperId.value || !questions.value.length) return
  try {
    const body = buildPaperExamCloudBody('completed')
    if (!body) return
    await suiteBankApi.appendPracticeRecord(body)
    examRecordSaved.value = true
    clearExamDraftForPaper(quizPaperId.value)
    clearCloudSessionId(quizPaperId.value)
    stopPaperExamCloudSync()
    void refreshPracticeRecords()
  } catch (e) {
    window.alert(
      `做题记录未写入服务器：${String((e as Error)?.message || e)}。请先登录后再交卷；本场答题仍可在本页回看。`,
    )
  }
}

async function refreshPracticeRecords() {
  await practiceRecordsDialogRef.value?.refresh()
}

function openPracticeRecordsModal() {
  draftListRev.value++
  showPracticeRecords.value = true
}

function discardExamDraft(pid: string) {
  if (!window.confirm('确定删除这套卷的未交卷草稿？删除后不可恢复。')) return
  clearExamDraftForPaper(pid)
}

async function loadQuiz(paperId: string, focusQid?: string | null) {
  stashCurrentExamBeforeNavigation()
  stopPaperExamCloudSync()
  examRecordSaved.value = false
  examSheetSubmitted.value = false
  const suiteModeQ = firstQueryValue(route.query.suiteMode).toLowerCase()
  const incomingMode: 'preview' | 'exam' = suiteModeQ === 'exam' ? 'exam' : 'preview'
  sessionPracticeMode.value = incomingMode

  loadErr.value = ''
  try {
    const d = await suiteBankApi.getPaper(paperId)
    quizPaperId.value = paperId
    quizPaperFolder.value = d.folder || ''
    activePaperTitle.value = d.title || '套卷'
    questions.value = d.questions ?? []
    quizSlots.value = (d.questions ?? []).map(() => ({ picked: null, revealed: false }))
    qIdx.value = 0
    sheetExpanded.value = true
    if (focusQid) {
      const ix = questions.value.findIndex(x => String(x.id) === String(focusQid))
      if (ix >= 0) qIdx.value = ix
    }
    mode.value = 'quiz'
    if (incomingMode === 'exam') {
      const restored = tryRestoreExamDraft(paperId, focusQid)
      if (!restored) {
        resetExamTimerForNewSession()
      } else {
        examSegmentStartedAt.value = Date.now()
        examTimerPaused.value = false
      }
      startExamTimerDisplay()
    } else {
      stopExamTimerDisplay()
      examActiveMsAccum.value = 0
      examSegmentStartedAt.value = 0
      examTimerPaused.value = false
    }
    if (incomingMode === 'exam' && firstQueryValue(route.query.examNew) === '1') {
      const qrest = { ...route.query }
      delete (qrest as Record<string, unknown>).examNew
      await router.replace({ name: route.name ?? 'XingceSuiteBank', query: qrest })
    }
    if (incomingMode === 'exam') {
      const forceNew = firstQueryValue(route.query.examNew) === '1'
      cloudClientSessionId.value = getOrCreateCloudSessionId(paperId, forceNew)
      startPaperExamCloudSync()
      scheduleSuitePracticeCloudSync(true)
    } else {
      cloudClientSessionId.value = ''
      stopPaperExamCloudSync()
    }
  } catch (e) {
    loadErr.value = String((e as Error).message || e)
  }
}

function goPaper(
  paperId: string,
  focusQid?: string | null,
  suiteModeChoice: 'preview' | 'exam' = 'preview',
  opts?: { examNew?: boolean },
) {
  const q: Record<string, string> = {}
  if (examChoice.value) q.exam = examChoice.value
  if (selectedYear.value) q.year = selectedYear.value
  q.paper = paperId
  if (focusQid) q.qid = String(focusQid)
  q.suiteMode = suiteModeChoice
  if (suiteModeChoice === 'exam' && opts?.examNew) q.examNew = '1'
  void router.push({ name: 'XingceSuiteBank', query: q })
}

function resumeDraftExam(paperId: string) {
  showPracticeRecords.value = false
  goPaper(paperId, null, 'exam')
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

async function confirmSubmitExamSheet() {
  if (sessionPracticeMode.value !== 'exam' || examRecordSaved.value || examSheetSubmitted.value) return
  if (!quizPaperId.value || !questions.value.length) return

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

async function backToList() {
  stopExamTimerDisplay()
  const wasExam = sessionPracticeMode.value === 'exam' && !examRecordSaved.value
  const pid = quizPaperId.value
  if (wasExam && pid && questions.value.length) {
    saveExamDraftToStorage()
    await flushSuitePracticeCloudSync()
  }
  stopPaperExamCloudSync()
  cloudClientSessionId.value = ''
  mode.value = 'list'
  questions.value = []
  quizSlots.value = []
  qIdx.value = 0
  quizPaperId.value = ''
  quizPaperFolder.value = ''
  activePaperTitle.value = ''
  sessionPracticeMode.value = 'preview'
  examActiveMsAccum.value = 0
  examSegmentStartedAt.value = 0
  examTimerPaused.value = false
  examSheetSubmitted.value = false
  syncListQuery()
}

function pickLetter(L: string) {
  const slot = quizSlots.value[qIdx.value]
  if (!slot || slot.revealed || examSheetSubmitted.value) return
  const ansRaw = String(currentQ.value?.answer || '')
  if (!isMultiSelectAnswer(ansRaw)) {
    slot.picked = L
    if (
      sessionPracticeMode.value === 'exam' &&
      !examSheetSubmitted.value &&
      getOptionLineCount(currentQ.value) > 0
    ) {
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
}

function showAnswer() {
  if (sessionPracticeMode.value === 'exam') return
  const slot = quizSlots.value[qIdx.value]
  if (slot) slot.revealed = true
}

function submitExamQuestion() {
  if (sessionPracticeMode.value !== 'exam' || examSheetSubmitted.value) return
  const slot = quizSlots.value[qIdx.value]
  if (!slot || slot.revealed) return
  if (currentHasOptions.value) return
  slot.blankDone = true
}

function skipExamQuestion() {
  if (sessionPracticeMode.value !== 'exam' || examSheetSubmitted.value) return
  const slot = quizSlots.value[qIdx.value]
  if (!slot || slot.revealed) return
  slot.picked = null
  slot.skipped = true
  slot.lockedIn = false
  slot.blankDone = false
}

function nextQuestion() {
  if (examNextLocked.value) return
  if (qIdx.value + 1 >= questions.value.length) {
    if (sessionPracticeMode.value === 'exam' && !examSheetSubmitted.value) void confirmSubmitExamSheet()
    else if (sessionPracticeMode.value !== 'exam') {
      if (window.confirm('已是最后一题，返回套卷列表？')) void backToList()
    }
    return
  }
  qIdx.value += 1
}

/** 「下一题/交卷」：避免禁用态静默无反馈，并统一入口方便以后埋点 */
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

function applyExamYearFromRoute() {
  const pid = String(route.query.paper || '')
  if (pid) return
  const ex = String(route.query.exam || '')
  if (ex === 'province' || ex === 'unified' || ex === 'other') examChoice.value = ex as ExamChoice
  else examChoice.value = null
  const yr = String(route.query.year || '')
  selectedYear.value = /^\d{4}$/.test(yr) ? yr : ''
}

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown)
  await boot()
  booted.value = true
  applyExamYearFromRoute()
  const pid = String(route.query.paper || '')
  if (pid) await loadQuiz(pid, route.query.qid ? String(route.query.qid) : undefined)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  if (
    sessionPracticeMode.value === 'exam' &&
    quizPaperId.value &&
    questions.value.length &&
    !examRecordSaved.value
  ) {
    saveExamDraftToStorage()
    void flushSuitePracticeCloudSync()
  }
  stopPaperExamCloudSync()
})

watch(
  () => [quizSlots.value, qIdx.value, examActiveMsAccum.value, examTimerPaused.value],
  () => {
    if (sessionPracticeMode.value === 'exam' && !examRecordSaved.value && !examSheetSubmitted.value) {
      scheduleSuitePracticeCloudSync()
    }
  },
  { deep: true },
)

watch(
  () => route.query,
  async () => {
    if (!booted.value || loading.value) return
    const pid = String(route.query.paper || '')
    if (!pid) {
      mode.value = 'list'
      applyExamYearFromRoute()
      return
    }
    await loadQuiz(pid, route.query.qid ? String(route.query.qid) : undefined)
  },
)

function goWorkspace() {
  window.location.href = '/'
}

function goPortal() {
  window.location.href = '/?portal=1'
}

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    showGlobalSearch.value = true
  }
}

function onGlobalPickSuite(paperId: string, questionId: string) {
  showGlobalSearch.value = false
  goPaper(paperId, questionId || null, 'preview')
}

function onGlobalPickQuestion(_id: string) {
  showGlobalSearch.value = false
  window.location.href = '/'
}

function onGlobalPickNote(_nodeId: string) {
  showGlobalSearch.value = false
  window.location.href = '/'
}
</script>

<template>
  <div class="sb-page" :class="{ 'sb-page--quiz': mode === 'quiz' && questions.length }">
    <header class="sb-head">
      <div class="sb-head-row">
        <h1 class="sb-title">套卷练习</h1>
        <div class="sb-actions">
          <button v-if="mode === 'quiz'" type="button" class="btn btn-secondary" @click="backToList">
            ← 套卷列表
          </button>
          <button
            v-if="mode === 'list' && booted && !loading"
            type="button"
            class="btn btn-secondary"
            @click="openPracticeRecordsModal"
          >
            做题记录
          </button>
          <button type="button" class="btn btn-secondary" title="Ctrl+K" @click="showGlobalSearch = true">
            全局搜索
          </button>
          <button type="button" class="btn btn-secondary" @click="goWorkspace">行测工作台</button>
          <RouterLink class="btn btn-secondary" :to="{ name: 'XingceBankDrill' }">套卷模块练</RouterLink>
          <button type="button" class="btn btn-ghost" @click="goPortal">模块首页</button>
        </div>
      </div>
      <p class="sb-meta">
        类型优先按<b>文件夹名</b>区分（与素材目录一致，如「广东省考」「广东统考」），文件夹无法识别时再参考标题与路径；然后按年份筛选，也可用关键词搜索。
      </p>
    </header>

    <p v-if="loadErr" class="sb-err">{{ loadErr }}</p>

    <div v-if="loading" class="sb-loading">加载套卷列表…</div>

    <p v-else-if="mode === 'list' && !papers.length" class="sb-empty">无套卷数据。</p>

    <template v-else-if="mode === 'list' && examChoice === null">
      <div class="sb-pick-grid">
        <button type="button" class="sb-pick-card" @click="pickExam('province')">
          <span class="sb-pick-title">省考</span>
          <span class="sb-pick-sub">与文件夹「××省考」一致（如广东省考）</span>
        </button>
        <button type="button" class="sb-pick-card" @click="pickExam('unified')">
          <span class="sb-pick-title">统考</span>
          <span class="sb-pick-sub">与文件夹「××统考」一致（如广东统考）</span>
        </button>
      </div>
      <button
        v-if="otherPaperCount > 0"
        type="button"
        class="sb-pick-other"
        @click="pickExam('other')"
      >
        其他 / 未标注（{{ otherPaperCount }}）
      </button>
    </template>

    <template v-else-if="mode === 'list'">
      <div class="sb-browse-head">
        <div class="sb-browse-current">
          当前：<strong>{{ examChoice ? examLabel[examChoice] : '' }}</strong>
        </div>
        <button type="button" class="btn btn-secondary sb-change-type" @click="changeExamType">
          切换类型
        </button>
      </div>
      <div class="sb-years" role="group" aria-label="按年份筛选">
        <button
          type="button"
          class="sb-chip"
          :class="{ active: !selectedYear }"
          @click="setYear('')"
        >
          全部年份
        </button>
        <button
          v-for="y in yearOptions"
          :key="y"
          type="button"
          class="sb-chip"
          :class="{ active: selectedYear === y }"
          @click="setYear(y)"
        >
          {{ y }}
        </button>
      </div>
      <input v-model="filter" type="search" class="sb-search" placeholder="筛选套卷标题、文件夹…">
      <ul v-if="filteredPapers.length" class="sb-list">
        <li v-for="p in filteredPapers" :key="p.id" class="sb-card sb-card-split">
          <div
            class="sb-card-main"
            role="button"
            tabindex="0"
            @click="goPaper(p.id, null, 'preview')"
            @keydown.enter.prevent="goPaper(p.id, null, 'preview')"
          >
            <div class="sb-card-title">{{ p.title || '未命名' }}</div>
            <div class="sb-card-sub hint">点击预览：随时看答案、自由翻题</div>
            <div class="sb-card-sub">
              {{ p.folder || '—' }} · {{ p.question_count }} 题
              <span v-if="isWordImportPaper(p)" class="sb-src-tag">Word</span>
            </div>
          </div>
          <div class="sb-card-actions">
            <button
              type="button"
              class="btn btn-primary sb-mini"
              @click.stop="goPaper(p.id, null, 'exam')"
            >
              做题模式
            </button>
            <button
              type="button"
              class="btn btn-secondary sb-mini"
              title="清空本地草稿并从第一题重做"
              @click.stop="goPaper(p.id, null, 'exam', { examNew: true })"
            >
              重做
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="sb-empty">
        暂无符合条件的套卷（可换一个年份或检查导入数据中标题/文件夹是否含类型与年份）。
      </p>
    </template>

    <div v-else class="sb-quiz">
      <h2 class="sb-quiz-title">{{ activePaperTitle }}</h2>
      <div
        v-if="sessionPracticeMode === 'exam' && !examSheetSubmitted"
        class="sb-exam-hint"
      >
        <strong>做题模式：</strong>整场不交卷不显示参考答案与解析；全部做完后点「交卷」统一揭晓并记入做题记录。单选题点选项即记录并跳到下一题；多选题选好选项后直接点「下一题」即可，亦可点「不会做」。无选项题点「本题无选项，继续」。中途退出可在「做题记录」继续草稿。
      </div>
      <div
        v-if="sessionPracticeMode === 'exam' && examSheetSubmitted"
        class="sb-exam-done-banner"
      >
        <strong>已交卷。</strong>以下为参考答案与解析，可通过答题卡回看任意题目。
        <button type="button" class="btn btn-secondary sb-exam-done-back" @click="backToList">
          返回套卷列表
        </button>
      </div>
      <div v-if="sessionPracticeMode === 'exam' && !examSheetSubmitted" class="sb-exam-toolbar">
        <span class="sb-exam-clock" aria-live="polite">{{ examClockText }}</span>
        <button type="button" class="btn btn-secondary sb-exam-pause" @click="toggleExamPause">
          {{ examTimerPaused ? '继续计时' : '暂停' }}
        </button>
        <button type="button" class="btn btn-secondary" @click="confirmSubmitExamSheet">交卷</button>
      </div>
      <div v-if="currentQ" class="sb-quiz-meta">
        {{ qIdx + 1 }} / {{ questions.length }} · 第 {{ currentQ.question_no || qIdx + 1 }} 题
        <span v-if="currentIsMulti" class="sb-multi-tag">多选</span>
        <span v-if="sessionPracticeMode === 'preview'" class="sb-mode-pill preview">预览</span>
        <span v-else-if="sessionPracticeMode === 'exam'" class="sb-mode-pill exam">做题模式</span>
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
          <span
            v-if="optionLineHasImg(line)"
            class="sb-opt-inner"
            v-html="richOptionHtml(line)"
          />
          <span v-else class="sb-opt-inner">{{ line }}</span>
        </button>
      </div>
      <div v-else-if="currentQ" class="sb-no-opt">（未识别到选项行，仅看题干）</div>
      <div v-if="gradingVisibleForCurrent && currentQ?.answer" class="sb-answer">
        参考答案：<strong>{{ currentQ.answer }}</strong>
      </div>
      <div v-if="gradingVisibleForCurrent && currentQ?.analysis" class="sb-analysis-wrap">
        <div class="sb-analysis-label">解析</div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="sb-analysis-body" v-html="analysisExamHtml"></div>
      </div>
      <div class="sb-bar">
        <template v-if="sessionPracticeMode === 'exam' && !examSheetSubmitted">
          <button
            v-if="!currentHasOptions"
            type="button"
            class="btn btn-primary"
            title="本题未识别选项行时可确认后继续"
            @click="submitExamQuestion"
          >
            本题无选项，继续
          </button>
          <button
            v-if="currentHasOptions"
            type="button"
            class="btn btn-secondary"
            @click="skipExamQuestion"
          >
            不会做
          </button>
        </template>
        <template v-else>
          <button type="button" class="btn btn-secondary" @click="showAnswer">看答案</button>
        </template>
        <button
          type="button"
          class="btn btn-primary sb-footer-next"
          :class="{ 'sb-footer-next--blocked': footerNextBlocked }"
          :title="
            footerNextBlocked
              ? examNextLocked
                ? '请先完成本题作答（见上方说明）'
                : ''
              : ''
          "
          @click="handleFooterNext"
        >
          {{ quizNextFooterLabel }}
        </button>
      </div>

      <aside v-if="mode === 'quiz' && questions.length" class="sb-sheet-dock" aria-label="答题卡">
        <button type="button" class="sb-sheet-tab" @click="sheetExpanded = !sheetExpanded">
          <span class="sb-sheet-tab-label">答题卡</span>
          <span class="sb-sheet-caret" aria-hidden="true">{{ sheetExpanded ? '▼' : '▲' }}</span>
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

    <GlobalSearchModal
      v-if="showGlobalSearch"
      @close="showGlobalSearch = false"
      @pick-question="onGlobalPickQuestion"
      @pick-note="onGlobalPickNote"
      @pick-suite="onGlobalPickSuite"
    />

    <SuitePracticeRecordsDialog
      ref="practiceRecordsDialogRef"
      v-model:open="showPracticeRecords"
      initial-tab="paper"
    >
      <template #prepend>
        <section v-if="draftSummaries.length" class="sb-pr-drafts">
          <h3 class="sb-pr-section-head">未完成（本地草稿）</h3>
          <p class="sb-pr-section-hint">保存在本浏览器；换设备不可用。列表点「重做」会从第一题新开并清空该套草稿。</p>
          <ul class="sb-pr-draft-list">
            <li v-for="d in draftSummaries" :key="d.paperId" class="sb-pr-draft-row">
              <div class="sb-pr-draft-meta">
                <div class="sb-pr-paper">{{ d.title }}</div>
                <div class="sb-pr-folder">{{ d.folder || '—' }} · 已作答 {{ d.answered }} / {{ d.total }}</div>
              </div>
              <div class="sb-pr-draft-actions">
                <button type="button" class="btn btn-primary sb-mini" @click="resumeDraftExam(d.paperId)">
                  继续做题
                </button>
                <button type="button" class="btn btn-secondary sb-mini" @click="discardExamDraft(d.paperId)">
                  删除草稿
                </button>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </SuitePracticeRecordsDialog>
  </div>
</template>

<style scoped>
.sb-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 20px 18px 40px;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  color: #0f172a;
  min-height: 100vh;
  box-sizing: border-box;
  background: #f8fafc;
}
.sb-page--quiz {
  padding-bottom: 200px;
}
.sb-head {
  margin-bottom: 16px;
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
.sb-loading {
  color: #64748b;
  font-size: 14px;
}
.sb-pick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  margin-bottom: 12px;
}
.sb-pick-card {
  text-align: left;
  padding: 22px 20px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  transition: 0.15s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sb-pick-card:hover {
  border-color: #818cf8;
  box-shadow: 0 10px 28px rgba(79, 70, 229, 0.1);
}
.sb-pick-title {
  font-size: 18px;
  font-weight: 800;
  color: #1e293b;
}
.sb-pick-sub {
  font-size: 12px;
  color: #64748b;
  line-height: 1.55;
}
.sb-pick-other {
  margin-top: 4px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.sb-pick-other:hover {
  color: #4f46e5;
}
.sb-browse-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.sb-browse-current {
  font-size: 14px;
  color: #475569;
}
.sb-change-type {
  font-size: 13px;
}
.sb-years {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
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
.sb-chip:hover {
  border-color: #a5b4fc;
}
.sb-chip.active {
  background: #eef2ff;
  border-color: #6366f1;
  color: #3730a3;
  font-weight: 600;
}
.sb-search {
  width: 100%;
  max-width: 420px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 14px;
  margin-bottom: 14px;
  box-sizing: border-box;
}
.sb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.sb-card {
  padding: 14px 16px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: 0.15s;
}
.sb-card:hover {
  border-color: #a5b4fc;
  box-shadow: 0 8px 22px rgba(79, 70, 229, 0.08);
}
.sb-card-title {
  font-weight: 700;
  font-size: 15px;
  line-height: 1.5;
}
.sb-card-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}
.sb-empty {
  color: #94a3b8;
  font-size: 14px;
}
.sb-quiz {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
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
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #a16207;
  background: #fef9c3;
  border: 1px solid #eab308;
  padding: 2px 8px;
  border-radius: 999px;
  vertical-align: middle;
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
  margin: 0 0 14px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.sb-material-label {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.02em;
  margin-bottom: 8px;
}
.sb-material-body {
  margin: 0;
  max-height: min(52vh, 420px);
  overflow: auto;
}
.sb-stem-img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 0 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #fff;
}
.sb-src-tag {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #4338ca;
  vertical-align: middle;
}
.sb-stem-rich {
  margin: 0 0 16px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 15px;
  line-height: 1.85;
  font-family: inherit;
}
.sb-stem-rich :deep(.sb-blank) {
  display: inline-block;
  min-width: 3em;
  border-bottom: 2px solid #475569;
  vertical-align: baseline;
  margin: 0 0.06em;
  height: 1.08em;
}
/* 选项里的小公式图（约一行高），勿用于题干/给定资料大图 */
.sb-opt-inner :deep(.sb-inline-img) {
  display: inline-block;
  max-height: 1.12em;
  width: auto;
  vertical-align: -0.12em;
  margin: 0 0.06em;
  object-fit: contain;
}
/* 题干与给定资料：段落/表格内嵌入图按可读大图展示 */
.sb-stem.sb-stem-rich :deep(.sb-inline-img),
.sb-material-body :deep(.sb-inline-img) {
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
  max-height: min(85vh, 1400px);
  margin: 12px auto;
  object-fit: contain;
}
.sb-opt-inner {
  display: inline;
  vertical-align: baseline;
}
.sb-opts {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}
.sb-opt {
  text-align: left;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.5;
}
.sb-opt:hover {
  border-color: #818cf8;
}
.sb-opt.pick {
  background: #eef2ff;
  border-color: #6366f1;
}
.sb-opt.ok {
  background: #dcfce7;
  border-color: #22c55e;
}
.sb-opt.bad {
  background: #fee2e2;
  border-color: #ef4444;
}
.sb-opt.ok-miss {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #78350f;
}
.sb-no-opt {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 12px;
}
.sb-answer {
  padding: 12px;
  border-radius: 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  font-size: 14px;
  margin-bottom: 12px;
}
.sb-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding-right: 8px;
  /* 右下角固定答题卡在「下一题」之下，避免误点整块蒙层 */
  position: relative;
  z-index: 80;
}
.sb-footer-next.sb-footer-next--blocked {
  opacity: 0.55;
  cursor: not-allowed;
}
.sb-sheet-dock {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 50;
  width: min(360px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
}
.sb-sheet-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px 12px 0 0;
  border: 1px solid #e2e8f0;
  border-bottom: none;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
  color: #1e293b;
}
.sb-sheet-tab-label {
  letter-spacing: 0.02em;
}
.sb-sheet-caret {
  font-size: 11px;
  color: #64748b;
}
.sb-sheet-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.14);
  max-height: min(58vh, 480px);
  overflow-y: auto;
  padding: 12px 12px 14px;
}
.sb-sheet-group {
  margin-bottom: 14px;
}
.sb-sheet-group:last-child {
  margin-bottom: 0;
}
.sb-sheet-group-title {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 8px;
  padding-left: 2px;
}
.sb-sheet-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sb-sheet-cell {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 9px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  line-height: 1;
}
.sb-sheet-cell:hover {
  border-color: #818cf8;
  background: #fff;
}
.sb-sheet-cell.is-current {
  box-shadow: 0 0 0 2px #4f46e5;
  border-color: #4f46e5;
}
.sb-sheet-cell.is-touched {
  background: #fef9c3;
  border-color: #eab308;
}
.sb-sheet-cell.is-right {
  background: #22c55e;
  border-color: #16a34a;
  color: #fff;
}
.sb-sheet-cell.is-wrong {
  background: #ef4444;
  border-color: #dc2626;
  color: #fff;
}
.sb-sheet-cell.is-skip {
  background: #e2e8f0;
  border-color: #94a3b8;
  color: #475569;
}
.sb-card-split {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sb-card-main {
  text-align: left;
  flex: 1;
  outline: none;
}
.sb-card-sub.hint {
  font-size: 11px;
  color: #94a3b8;
}
.sb-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.sb-mini {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 8px;
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
  line-height: 1.55;
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
  color: #0f172a;
  letter-spacing: 0.03em;
  flex: 1;
  min-width: 4.5em;
}
.sb-mode-pill {
  margin-left: 8px;
  display: inline-block;
  vertical-align: middle;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}
.sb-mode-pill.preview {
  color: #1d4ed8;
  border: 1px solid #93c5fd;
  background: #eff6ff;
}
.sb-mode-pill.exam {
  color: #92400e;
  border: 1px solid #fbbf24;
  background: #fffbeb;
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
