import type { ErrorEntry } from '@/api/xingce'

export const ERROR_STATUS_OPTIONS = [
  { value: 'focus' as const, label: '重点复习' },
  { value: 'review' as const, label: '待复习' },
  { value: 'mastered' as const, label: '已掌握' },
]

export const ERROR_WORKFLOW_OPTIONS = [
  { value: 'captured', label: '待判因' },
  { value: 'diagnosing', label: '判因中' },
  { value: 'review_ready', label: '待复盘' },
  { value: 'retrain_due', label: '待复训' },
  { value: 'mastered', label: '已闭环' },
]

const MASTERY_CYCLE: Record<string, ErrorEntry['masteryLevel']> = {
  not_mastered: 'fuzzy',
  fuzzy: 'mastered',
  mastered: 'not_mastered',
}

const MASTERY_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  not_mastered: { label: '未掌握', color: '#ff7875', bg: '#fff2f0', border: '#ffa39e' },
  fuzzy: { label: '模糊', color: '#fa8c16', bg: '#fff7e6', border: '#ffd591' },
  mastered: { label: '已掌握', color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
}

export function masteryButtonStyle(level: ErrorEntry['masteryLevel'] | undefined) {
  return MASTERY_STYLE[level ?? 'not_mastered'] ?? MASTERY_STYLE.not_mastered
}

export function nextMasteryLevel(level: ErrorEntry['masteryLevel'] | undefined): ErrorEntry['masteryLevel'] {
  return MASTERY_CYCLE[level ?? 'not_mastered'] ?? 'not_mastered'
}

/** 对齐 legacy `updateStatus` */
export function buildStatusPatch(
  entry: ErrorEntry,
  status: ErrorEntry['status'],
): Partial<ErrorEntry> {
  const patch: Partial<ErrorEntry> = { status }
  if (status === 'mastered') patch.masteryLevel = 'mastered'
  else if (entry.masteryLevel === 'mastered') patch.masteryLevel = 'fuzzy'
  return patch
}

/** 对齐 legacy `updateWorkflowStage` */
export function buildWorkflowPatch(
  entry: ErrorEntry,
  stage: string,
): Partial<ErrorEntry> {
  const patch: Partial<ErrorEntry> = { workflowStage: stage }
  if (stage === 'mastered') {
    patch.status = 'mastered'
    patch.masteryLevel = 'mastered'
  } else if (entry.status === 'mastered') {
    patch.status = 'review'
    if (entry.masteryLevel === 'mastered') patch.masteryLevel = 'fuzzy'
  }
  return patch
}

/** 对齐 legacy `cyclemastery` */
export function buildMasteryCyclePatch(entry: ErrorEntry): Partial<ErrorEntry> {
  const masteryLevel = nextMasteryLevel(entry.masteryLevel)
  const patch: Partial<ErrorEntry> = {
    masteryLevel,
    masteryUpdatedAt: new Date().toISOString(),
  }
  if (masteryLevel === 'mastered') patch.status = 'mastered'
  else if (entry.status === 'mastered') patch.status = 'review'
  return patch
}

export function getErrorCardMarkdown(entry: ErrorEntry): string {
  const question = String(entry.question || '').trim()
  const options = String(entry.options || '')
    .split(/\n|\|/)
    .map(part => part.trim())
    .filter(Boolean)
    .join('\n')
  const answer = String(entry.answer || '').trim()
  const analysis = String(entry.analysis || '').trim()
  const scoreTip = String(entry.nextAction || entry.tip || '').trim()
  const questionBlock = [question, options].filter(Boolean).join('\n\n')
  return [
    '# 题目导出',
    '',
    '## 题目',
    questionBlock || '未填写',
    '',
    '## 答案',
    answer || '未填写',
    '',
    '## 解析',
    analysis || '未填写',
    '',
    '## 提分',
    scoreTip || '未填写',
  ].join('\n')
}

/** legacy `getQuestionAndOptionsText`：复制答案/解析/提分（按钮名仍为「复制题干」） */
function getQuestionAndOptionsText(entry: ErrorEntry): string {
  const answer = String(entry.answer || '').trim()
  const analysis = String(entry.analysis || '').trim()
  const scoreTip = String(entry.nextAction || entry.tip || '').trim()
  const sections = ['【答案】', answer || '(空)']
  if (analysis) sections.push('', '【解析】', analysis)
  if (scoreTip) sections.push('', '【提分】', scoreTip)
  return sections.join('\n')
}

function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  return ok
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const matched = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!matched) return null
  try {
    const mime = matched[1] || 'application/octet-stream'
    const binary = atob(matched[2] || '')
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

function copyTextWithOptionalImage(
  text: string,
  imageDataUrl: string | undefined,
  onSuccess: () => void,
  onFailure: () => void,
) {
  const imageBlob = imageDataUrl ? dataUrlToBlob(imageDataUrl) : null
  if (navigator.clipboard?.write && imageBlob && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/plain': new Blob([text], { type: 'text/plain' }),
      [imageBlob.type || 'image/png']: imageBlob,
    })
    navigator.clipboard.write([item]).then(onSuccess).catch(onFailure)
    return
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(onFailure)
    return
  }
  onFailure()
}

export function showErrorActionToast(msg: string, tone = 'success') {
  const w = window as Window & { showToast?: (m: string, t?: string) => void }
  if (typeof w.showToast === 'function') w.showToast(msg, tone)
}

export function copyErrorMarkdown(entry: ErrorEntry) {
  const text = getErrorCardMarkdown(entry)
  const onSuccess = () => showErrorActionToast('该题 MD 已复制到剪贴板', 'success')
  const onFailure = () => {
    if (fallbackCopyText(text)) onSuccess()
    else showErrorActionToast('复制失败，请稍后重试', 'error')
  }
  copyTextWithOptionalImage(text, entry.imgData, onSuccess, onFailure)
}

export function copyQuestionAndOptions(entry: ErrorEntry) {
  const text = getQuestionAndOptionsText(entry)
  const onSuccess = () => showErrorActionToast('答案与解析已复制到剪贴板', 'success')
  const onFailure = () => {
    if (fallbackCopyText(text)) onSuccess()
    else showErrorActionToast('复制失败，请稍后重试', 'error')
  }
  copyTextWithOptionalImage(text, entry.imgData, onSuccess, onFailure)
}
