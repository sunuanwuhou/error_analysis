export const SHENLUN_ISSUE_TAGS = [
  '要点遗漏',
  '表述空泛',
  '表述过虚',
  '归类有误',
  '照抄原文',
  '理解偏差',
] as const

export type ShenlunIssueTag = (typeof SHENLUN_ISSUE_TAGS)[number] | string

export function issueTagClass(tag: string): string {
  if (tag.includes('遗漏')) return 'sl-issue-tag sl-issue-tag--miss'
  if (tag.includes('错误') || tag.includes('偏差') || tag.includes('有误')) {
    return 'sl-issue-tag sl-issue-tag--wrong'
  }
  if (tag.includes('空泛') || tag.includes('过虚')) return 'sl-issue-tag sl-issue-tag--vague'
  if (tag.includes('照抄')) return 'sl-issue-tag sl-issue-tag--copy'
  return 'sl-issue-tag sl-issue-tag--default'
}

export function formatIssueScope(scope: 'segment' | 'overall', segmentIndex: number | null): string {
  if (scope === 'overall') return '整体总结'
  if (segmentIndex === null || segmentIndex === undefined) return '分段'
  return `段落 ${segmentIndex + 1}`
}

export function formatPaperMeta(parts: {
  paper_year?: string
  paper_province?: string
  paper_suite_type?: string
}): string {
  return [parts.paper_year, parts.paper_province, parts.paper_suite_type]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' · ')
}

export function buildResultIssueLink(attemptId: string, entry: {
  scope: 'segment' | 'overall'
  segment_index: number | null
}): { name: string; params: { attemptId: string }; query: Record<string, string> } {
  const query: Record<string, string> = { focus: 'issues' }
  if (entry.scope === 'segment' && entry.segment_index !== null) {
    query.segment = String(entry.segment_index)
  } else {
    query.tab = 'overall'
  }
  return {
    name: 'ShenlunResult',
    params: { attemptId },
    query,
  }
}

export function formatDetectedAt(iso: string): string {
  const s = (iso ?? '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}
