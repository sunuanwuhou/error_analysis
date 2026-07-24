import type { ErrorEntry } from '@/api/xingce'

/** 题目/解析图：支持 data URL 与同域 `/api/images/{hash}` */
export function normalizeErrorImageSrc(raw: unknown): string {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  if (value.startsWith('data:image/')) return value
  if (value.startsWith('/api/images/')) return value
  return ''
}

export function hasErrorImage(
  entry: Pick<ErrorEntry, 'imgData' | 'analysisImgData'>,
  field: 'imgData' | 'analysisImgData' = 'imgData',
): boolean {
  return !!normalizeErrorImageSrc(entry[field])
}

/** 对齐旧版 quiz：题干很短或为空时以图片为主 */
export function isImageHeavyQuestion(entry: Pick<ErrorEntry, 'question' | 'imgData'>): boolean {
  const q = String(entry.question ?? '').trim()
  return hasErrorImage(entry, 'imgData') && q.length < 20
}

/** 用 store 全量错题补齐 API 摘要项（保留 imgData / 长题干） */
export function resolveErrorQueueItems(
  items: Array<{ id?: string }>,
  errors: ErrorEntry[],
): ErrorEntry[] {
  const byId = new Map(errors.map(e => [e.id, e]))
  const out: ErrorEntry[] = []
  for (const item of items) {
    const id = String(item?.id || '').trim()
    if (!id) continue
    const full = byId.get(id)
    if (full) {
      out.push(full)
      continue
    }
    if (item && typeof item === 'object' && 'question' in item) {
      out.push(item as ErrorEntry)
    }
  }
  return out
}
