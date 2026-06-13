import type { InterviewPracticeRecord } from '@/api/interview'

export type InterviewListFilter = 'all' | 'unpracticed' | 'draft' | 'polished' | 'due_review'
export type InterviewReviewRating = 'smooth' | 'ok' | 'forgot'

export const REVIEW_INTERVALS_DAYS = [3, 7, 14, 30] as const

export function hasPolishedAnswer(record: InterviewPracticeRecord | null | undefined): boolean {
  return Boolean(record?.polished_answer?.trim())
}

export function isReviewDue(record: InterviewPracticeRecord | null | undefined, now = new Date()): boolean {
  if (!hasPolishedAnswer(record)) return false
  const at = record?.next_review_at?.trim()
  if (!at) return false
  const due = new Date(at)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() <= now.getTime()
}

export function formatReviewDueLabel(record: InterviewPracticeRecord | null | undefined): string {
  if (!hasPolishedAnswer(record)) return '写好完整版后将自动安排复习'
  const at = record?.next_review_at?.trim()
  if (!at) return '尚未安排复习'
  const due = new Date(at)
  if (Number.isNaN(due.getTime())) return '复习时间无效'
  const now = new Date()
  if (due.getTime() <= now.getTime()) return '今日待复习'
  return `下次复习：${due.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}`
}

export function polishedWordCount(text: string): number {
  return (text || '').replace(/\s/g, '').length
}

export function polishedLengthHint(text: string): string {
  const n = polishedWordCount(text)
  if (n === 0) return '建议 150～250 字，能 2～3 分钟口述'
  if (n < 120) return `${n} 字 · 偏短，建议补到 150 字以上`
  if (n > 280) return `${n} 字 · 偏长，口述可能超过 3 分钟`
  return `${n} 字 · 长度合适`
}

export function matchesListFilter(
  filter: InterviewListFilter,
  record: InterviewPracticeRecord | undefined,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'unpracticed':
      return !record
    case 'draft':
      return Boolean(record) && !hasPolishedAnswer(record)
    case 'polished':
      return hasPolishedAnswer(record)
    case 'due_review':
      return isReviewDue(record)
    default:
      return true
  }
}

export const REVIEW_RATING_LABELS: Record<InterviewReviewRating, string> = {
  smooth: '流畅 — 间隔延长',
  ok: '一般 — 保持间隔',
  forgot: '忘了 — 明天再练',
}
