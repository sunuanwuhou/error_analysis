import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { shenlunApi, type Attempt, type AttemptSummary, type Segment, type SourceDetailResponse, type SourceRecord } from '@/api/shenlun'
import { SL_DEFAULT_NODE_ID, routeQueryToNodeId } from '@/data/shenlunTree'

type WorkbenchPhase = 'input' | 'formatted' | 'cc_prompt' | 'done'

function splitMaterial(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function normalizeSegmentsInPlace(segs: Segment[]) {
  for (const s of segs) {
    if (s.my_segment_summary === undefined) s.my_segment_summary = ''
  }
}

export const useShenlunStore = defineStore('shenlun', () => {
  const selectedNodeId = ref<string>(SL_DEFAULT_NODE_ID)

  const questionText = ref('')
  const materialText = ref('')
  const paperYear = ref('')
  const paperProvince = ref('')
  const paperSuiteType = ref('')

  const sourceRecord = ref<SourceRecord | null>(null)
  const sourceLoading = ref(false)
  const sourceError = ref<string | null>(null)

  const attempt = ref<Attempt | null>(null)
  const attemptLoading = ref(false)
  const attemptError = ref<string | null>(null)

  const phase = ref<WorkbenchPhase>('input')

  const ccPromptText = ref('')
  const ccPasteText = ref('')
  const ccPasteError = ref<string | null>(null)
  const ccPasteLoading = ref(false)

  const attemptSummaries = ref<AttemptSummary[]>([])
  const attemptSummariesLoading = ref(false)

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  let attemptSaveTimer: ReturnType<typeof setTimeout> | null = null

  const segments = computed<Segment[]>(() => attempt.value?.segments ?? [])
  const finalSummary = computed(() => attempt.value?.my_final_summary ?? '')
  const canGoToCC = computed(
    () =>
      phase.value === 'formatted' &&
      segments.value.every((s) => s.my_extraction.trim().length > 0) &&
      finalSummary.value.trim().length > 0,
  )
  const canSubmitPaste = computed(() => ccPasteText.value.trim().length > 10)

  function applySourceDetail(detail: SourceDetailResponse) {
    sourceRecord.value = detail.source
    questionText.value = detail.source.question_text_raw
    materialText.value = detail.source.material_text_raw
    paperYear.value = detail.source.paper_year ?? ''
    paperProvince.value = detail.source.paper_province ?? ''
    paperSuiteType.value = detail.source.paper_suite_type ?? ''
    selectedNodeId.value =
      detail.source.node_id !== undefined && detail.source.node_id !== null
        ? detail.source.node_id
        : selectedNodeId.value

    const la = detail.latest_attempt
    if (la) {
      normalizeSegmentsInPlace(la.segments)
      attempt.value = la
      phase.value = 'formatted'
    } else {
      attempt.value = null
      phase.value = 'input'
    }
    ccPromptText.value = ''
    ccPasteText.value = ''
  }

  async function loadAttemptSummaries(sourceId: string) {
    attemptSummariesLoading.value = true
    try {
      const res = await shenlunApi.listAttemptsForSource(sourceId)
      attemptSummaries.value = res.items
    } catch {
      attemptSummaries.value = []
    } finally {
      attemptSummariesLoading.value = false
    }
  }

  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => void autosave(), 1500)
  }

  async function autosave() {
    if (!questionText.value.trim() && !materialText.value.trim()) return
    try {
      sourceLoading.value = true
      sourceError.value = null
      const rec = await shenlunApi.upsertSource({
        question_text_raw: questionText.value,
        material_text_raw: materialText.value,
        node_id: selectedNodeId.value,
        paper_year: paperYear.value,
        paper_province: paperProvince.value,
        paper_suite_type: paperSuiteType.value,
      })
      sourceRecord.value = rec
      paperYear.value = rec.paper_year ?? ''
      paperProvince.value = rec.paper_province ?? ''
      paperSuiteType.value = rec.paper_suite_type ?? ''
    } catch (e) {
      sourceError.value = (e as Error).message
    } finally {
      sourceLoading.value = false
    }
  }

  async function formatMaterial() {
    if (!questionText.value.trim() || !materialText.value.trim()) return
    try {
      attemptLoading.value = true
      attemptError.value = null

      if (!sourceRecord.value) await autosave()
      if (!sourceRecord.value) throw new Error('保存来源记录失败')

      try {
        const att = await shenlunApi.createAttempt(sourceRecord.value.id)
        normalizeSegmentsInPlace(att.segments)
        attempt.value = att
      } catch {
        const segs = splitMaterial(materialText.value)
        attempt.value = {
          id: `local-${Date.now()}`,
          source_id: sourceRecord.value.id,
          attempt_no: 1,
          segments: segs.map((text, i) => ({
            index: i,
            source_text: text,
            my_extraction: '',
          })),
          my_final_summary: '',
          cc_status: 'none',
          cc_result_json: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }

      phase.value = 'formatted'
    } catch (e) {
      attemptError.value = (e as Error).message
    } finally {
      attemptLoading.value = false
    }
  }

  function updateExtraction(index: number, text: string) {
    if (!attempt.value) return
    attempt.value.segments[index].my_extraction = text
    scheduleAutoSaveAttempt()
  }

  /** 全文最终总结一份，各段落 Tab 共用这个字段 */
  function updateFinalSummary(text: string) {
    if (!attempt.value) return
    attempt.value.my_final_summary = text
    scheduleAutoSaveAttempt()
  }

  function scheduleAutoSaveAttempt() {
    if (attemptSaveTimer) clearTimeout(attemptSaveTimer)
    attemptSaveTimer = setTimeout(() => void saveAttemptProgress(), 2000)
  }

  async function saveAttemptProgress() {
    if (!attempt.value || attempt.value.id.startsWith('local-')) return
    try {
      await shenlunApi.saveAttempt(attempt.value.id, {
        segments: attempt.value.segments,
        my_final_summary: attempt.value.my_final_summary,
      })
    } catch {
      //
    }
  }

  async function generateCCPrompt() {
    if (!attempt.value) return
    try {
      attemptLoading.value = true
      attemptError.value = null

      if (attemptSaveTimer) clearTimeout(attemptSaveTimer)
      if (!attempt.value.id.startsWith('local-')) await saveAttemptProgress()

      if (attempt.value.id.startsWith('local-')) {
        ccPromptText.value = _buildLocalPrompt(
          questionText.value,
          attempt.value.segments,
          attempt.value.my_final_summary,
        )
      } else {
        const res = await shenlunApi.getCCPrompt(attempt.value.id)
        ccPromptText.value = res.prompt
      }

      ccPasteText.value = ''
      ccPasteError.value = null
      phase.value = 'cc_prompt'
    } catch (e) {
      attemptError.value = (e as Error).message
    } finally {
      attemptLoading.value = false
    }
  }

  async function submitCCPaste(): Promise<string | null> {
    if (!attempt.value || attempt.value.id.startsWith('local-')) return null
    try {
      ccPasteLoading.value = true
      ccPasteError.value = null
      const updated = await shenlunApi.pasteCCResult(attempt.value.id, ccPasteText.value)
      attempt.value = updated
      phase.value = 'done'
      if (sourceRecord.value?.id) await loadAttemptSummaries(sourceRecord.value.id)
      return updated.id
    } catch (e) {
      ccPasteError.value = (e as Error).message
      return null
    } finally {
      ccPasteLoading.value = false
    }
  }

  async function patchWorkbenchNode(nodeId: string) {
    if (!sourceRecord.value?.id) return
    try {
      sourceLoading.value = true
      sourceError.value = null
      const rec = await shenlunApi.patchSourceNode(sourceRecord.value.id, nodeId)
      sourceRecord.value = rec
      selectedNodeId.value = rec.node_id ?? ''
    } catch (e) {
      sourceError.value = (e as Error).message
    } finally {
      sourceLoading.value = false
    }
  }

  async function createNewAIRound(): Promise<boolean> {
    if (!sourceRecord.value?.id || attempt.value?.id.startsWith('local-')) return false
    const summaries = attemptSummaries.value
    const latestCcStatus =
      summaries.length > 0 ? summaries[0].cc_status : attempt.value?.cc_status ?? ''
    if (!latestCcStatus) return false
    if (latestCcStatus !== 'success') {
      attemptError.value =
        '当前最近一轮尚未完成复盘，请先提交 AI 结果，或在该轮记录上点「删除」后再开新轮。'
      return false
    }

    attemptError.value = null
    try {
      attemptLoading.value = true
      await shenlunApi.createAttempt(sourceRecord.value.id)
      const detail = await shenlunApi.getSource(sourceRecord.value.id)
      applySourceDetail(detail)
      await loadAttemptSummaries(sourceRecord.value.id)
      return true
    } catch (e) {
      attemptError.value = (e as Error).message
      return false
    } finally {
      attemptLoading.value = false
    }
  }

  async function deleteAttemptRecord(attemptId: string): Promise<boolean> {
    const sid = sourceRecord.value?.id
    if (!sid) return false
    try {
      attemptLoading.value = true
      attemptError.value = null
      await shenlunApi.deleteAttempt(attemptId)
      const detail = await shenlunApi.getSource(sid)
      applySourceDetail(detail)
      await loadAttemptSummaries(sid)
      return true
    } catch (e) {
      attemptError.value = (e as Error).message
      return false
    } finally {
      attemptLoading.value = false
    }
  }

  async function bootstrapFromRoute(query: Record<string, unknown>) {
    selectedNodeId.value = routeQueryToNodeId(query.node)

    const rawSource = query.source
    const sourceId = typeof rawSource === 'string' ? rawSource : ''

    attemptError.value = null
    ccPasteError.value = null

    if (!sourceId) {
      questionText.value = ''
      materialText.value = ''
      paperYear.value = ''
      paperProvince.value = ''
      paperSuiteType.value = ''
      sourceRecord.value = null
      attempt.value = null
      phase.value = 'input'
      ccPromptText.value = ''
      ccPasteText.value = ''
      attemptSummaries.value = []
      return
    }

    try {
      sourceLoading.value = true
      const detail = await shenlunApi.getSource(sourceId)
      applySourceDetail(detail)
      await loadAttemptSummaries(sourceId)
    } catch (e) {
      attemptError.value = (e as Error).message
      questionText.value = ''
      materialText.value = ''
      paperYear.value = ''
      paperProvince.value = ''
      paperSuiteType.value = ''
      sourceRecord.value = null
      attempt.value = null
      phase.value = 'input'
      attemptSummaries.value = []
    } finally {
      sourceLoading.value = false
    }
  }

  function resetWorkbench() {
    questionText.value = ''
    materialText.value = ''
    paperYear.value = ''
    paperProvince.value = ''
    paperSuiteType.value = ''
    sourceRecord.value = null
    attempt.value = null
    sourceError.value = null
    attemptError.value = null
    ccPromptText.value = ''
    ccPasteText.value = ''
    ccPasteError.value = null
    phase.value = 'input'
    attemptSummaries.value = []
    if (autosaveTimer) clearTimeout(autosaveTimer)
    if (attemptSaveTimer) clearTimeout(attemptSaveTimer)
  }

  return {
    selectedNodeId,
    questionText,
    materialText,
    sourceRecord,
    sourceLoading,
    sourceError,
    attempt,
    attemptLoading,
    attemptError,
    phase,
    segments,
    finalSummary,
    canGoToCC,
    canSubmitPaste,
    ccPromptText,
    ccPasteText,
    ccPasteError,
    ccPasteLoading,
    scheduleAutosave,
    paperYear,
    paperProvince,
    paperSuiteType,
    formatMaterial,
    updateExtraction,
    updateFinalSummary,
    generateCCPrompt,
    submitCCPaste,
    resetWorkbench,
    bootstrapFromRoute,
    attemptSummaries,
    attemptSummariesLoading,
    patchWorkbenchNode,
    createNewAIRound,
    deleteAttemptRecord,
  }
})

const _ISSUE_TAGS = '要点遗漏 / 表述空泛 / 表述过虚 / 归类有误 / 照抄原文 / 理解偏差'

function _buildLocalPrompt(
  question: string,
  segments: Array<{ index: number; source_text: string; my_extraction: string }>,
  finalSummary: string,
): string {
  const lines: string[] = [
    '你是申论阅卷专家，专注于「归纳概括」题型的批改。',
    '请逐段评价用户的提炼质量，并给出参考答案。',
    '',
    '══════════════════════',
    `【题目】${question.trim()}`,
    '══════════════════════',
    '',
  ]

  for (const seg of segments) {
    const idx = seg.index + 1
    lines.push(`【段落 ${idx}】`, seg.source_text.trim(), '')
    lines.push(`【用户提炼 ${idx}】`, seg.my_extraction.trim() || '（未填写）', '')
  }

  lines.push(
    '【用户最终总结】',
    finalSummary.trim() || '（未填写）',
    '',
    '══════════════════════',
    '请返回纯 JSON，不要任何代码块标记；所有字符串值内如需引号请用中文直角引号「」，不要使用英文双引号嵌套。格式如下：',
    '',
    '{',
    '  "segments": [',
    '    {',
    '      "segment_index": 0,',
    '      "reference_extraction": "参考提炼（要点换行分隔）",',
    '      "matched_points": ["命中的要点"],',
    '      "missed_points": ["遗漏的要点"],',
    '      "wrong_points": ["有误的表述"],',
    `      "issue_tags": ["从以下选择：${_ISSUE_TAGS}"],`,
    '      "cc_comment": "简短点评 1-2 句"',
    '    }',
    '  ],',
    '  "reference_final_summary": "参考总结答案",',
    '  "overall_comment": "整体点评（100 字内）",',
    '  "overall_issue_tags": ["同上选项"]',
    '}',
    '',
    `共 ${segments.length} 个段落，segments 数组下标从 0 开始，与上面段落一一对应。`,
    '只返回 JSON，不要任何其他文字。',
  )

  return lines.join('\n')
}
