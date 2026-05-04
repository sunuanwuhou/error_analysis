import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { shenlunApi, type SourceRecord, type Attempt, type Segment } from '@/api/shenlun'

// input → formatted → cc_prompt → done
type WorkbenchPhase = 'input' | 'formatted' | 'cc_prompt' | 'done'

function splitMaterial(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export const useShenlunStore = defineStore('shenlun', () => {
  const questionText = ref('')
  const materialText = ref('')

  const sourceRecord = ref<SourceRecord | null>(null)
  const sourceLoading = ref(false)
  const sourceError = ref<string | null>(null)

  const attempt = ref<Attempt | null>(null)
  const attemptLoading = ref(false)
  const attemptError = ref<string | null>(null)

  const phase = ref<WorkbenchPhase>('input')

  // CC step
  const ccPromptText = ref('')       // generated prompt user copies
  const ccPasteText = ref('')        // raw text user pastes back
  const ccPasteError = ref<string | null>(null)
  const ccPasteLoading = ref(false)

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  let attemptSaveTimer: ReturnType<typeof setTimeout> | null = null

  // --- computed ---
  const segments = computed<Segment[]>(() => attempt.value?.segments ?? [])
  const finalSummary = computed(() => attempt.value?.my_final_summary ?? '')
  const canGoToCC = computed(
    () =>
      phase.value === 'formatted' &&
      segments.value.every((s) => s.my_extraction.trim().length > 0) &&
      finalSummary.value.trim().length > 0,
  )
  const canSubmitPaste = computed(() => ccPasteText.value.trim().length > 10)

  // --- autosave source ---
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
      })
      sourceRecord.value = rec
    } catch (e) {
      sourceError.value = (e as Error).message
    } finally {
      sourceLoading.value = false
    }
  }

  // --- one-click format ---
  async function formatMaterial() {
    if (!questionText.value.trim() || !materialText.value.trim()) return
    try {
      attemptLoading.value = true
      attemptError.value = null

      if (!sourceRecord.value) await autosave()
      if (!sourceRecord.value) throw new Error('保存来源记录失败')

      try {
        const att = await shenlunApi.createAttempt(sourceRecord.value.id)
        attempt.value = att
      } catch {
        // Client-side fallback if server unavailable
        const segs = splitMaterial(materialText.value)
        attempt.value = {
          id: `local-${Date.now()}`,
          source_id: sourceRecord.value.id,
          attempt_no: 1,
          segments: segs.map((text, i) => ({ index: i, source_text: text, my_extraction: '' })),
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

  // --- extraction editing ---
  function updateExtraction(index: number, text: string) {
    if (!attempt.value) return
    attempt.value.segments[index].my_extraction = text
    scheduleAutoSaveAttempt()
  }

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
      // silent best-effort
    }
  }

  // --- generate CC prompt ---
  async function generateCCPrompt() {
    if (!attempt.value) return
    try {
      attemptLoading.value = true
      attemptError.value = null

      // Flush any pending saves
      if (attemptSaveTimer) clearTimeout(attemptSaveTimer)
      if (!attempt.value.id.startsWith('local-')) await saveAttemptProgress()

      if (attempt.value.id.startsWith('local-')) {
        // Build prompt client-side as fallback
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

  // --- paste CC result back ---
  async function submitCCPaste(): Promise<string | null> {
    if (!attempt.value || attempt.value.id.startsWith('local-')) return null
    try {
      ccPasteLoading.value = true
      ccPasteError.value = null
      const updated = await shenlunApi.pasteCCResult(attempt.value.id, ccPasteText.value)
      attempt.value = updated
      phase.value = 'done'
      return updated.id
    } catch (e) {
      ccPasteError.value = (e as Error).message
      return null
    } finally {
      ccPasteLoading.value = false
    }
  }

  // --- reset ---
  function resetWorkbench() {
    questionText.value = ''
    materialText.value = ''
    sourceRecord.value = null
    attempt.value = null
    sourceError.value = null
    attemptError.value = null
    ccPromptText.value = ''
    ccPasteText.value = ''
    ccPasteError.value = null
    phase.value = 'input'
    if (autosaveTimer) clearTimeout(autosaveTimer)
    if (attemptSaveTimer) clearTimeout(attemptSaveTimer)
  }

  return {
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
    formatMaterial,
    updateExtraction,
    updateFinalSummary,
    generateCCPrompt,
    submitCCPaste,
    resetWorkbench,
  }
})

// ---------------------------------------------------------------------------
// Client-side prompt builder (fallback when server is unavailable)
// ---------------------------------------------------------------------------

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
    lines.push(`【材料段落 ${idx}】`, seg.source_text.trim(), '')
    lines.push(`【用户提炼 ${idx}】`, seg.my_extraction.trim() || '（未填写）', '')
  }

  lines.push(
    '【用户最终总结】',
    finalSummary.trim() || '（未填写）',
    '',
    '══════════════════════',
    '请返回纯 JSON，不要任何代码块标记，格式如下：',
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
