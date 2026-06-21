import type { AttemptSummary, ErrorEntry } from '@/api/xingce'

const STORAGE_KEY = 'xingce_random_question_picks'
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000

type PickRecord = Record<string, string>

function readPickRecord(): PickRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PickRecord
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePickRecord(record: PickRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    /* ignore quota */
  }
}

export function markRandomQuestionPicked(errorId: string, at = new Date()) {
  if (!errorId) return
  const record = readPickRecord()
  record[errorId] = at.toISOString()
  writePickRecord(record)
}

function isMastered(e: ErrorEntry): boolean {
  return e.status === 'mastered' || e.masteryLevel === 'mastered'
}

function daysSince(iso: string): number {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return Infinity
  return (Date.now() - ts) / 86400000
}

function getWrongCount(e: ErrorEntry, summary?: AttemptSummary | null): number {
  const rec = e as Record<string, unknown>
  const quiz = rec.quiz as Record<string, unknown> | undefined
  const values = [
    Number(summary?.recentWrongCount ?? NaN),
    Number(summary?.wrongCount ?? NaN),
    Number(rec.recentWrongCount ?? NaN),
    Number(rec.wrongCount ?? NaN),
    Number(quiz?.wrongCount ?? NaN),
  ].filter(v => Number.isFinite(v) && v >= 0)
  return values.length ? Math.max(...values) : 0
}

function getDurationScore(e: ErrorEntry, summary?: AttemptSummary | null): number {
  const target = Number(e.targetDurationSec ?? 0)
  const lastDuration = Number(
    summary?.lastDuration
    ?? (e as Record<string, unknown>).lastDuration
    ?? e.actualDurationSec
    ?? 0,
  )
  if (!Number.isFinite(lastDuration) || lastDuration <= 0) return 0
  if (Number.isFinite(target) && target > 0) {
    return Math.max(0, Math.min(2, (lastDuration - target) / target))
  }
  return Math.log1p(lastDuration / 30)
}

function computeWeight(e: ErrorEntry, summary?: AttemptSummary | null): number {
  const wrongCount = getWrongCount(e, summary)
  const durationScore = getDurationScore(e, summary)
  return 0.6 * Math.log1p(wrongCount) + 0.4 * Math.log1p(Math.max(durationScore, 0))
}

function weightedPick<T extends { weight: number }>(items: T[]): T | null {
  if (!items.length) return null
  const total = items.reduce((sum, item) => sum + Math.max(item.weight, 0.001), 0)
  let roll = Math.random() * total
  for (const item of items) {
    roll -= Math.max(item.weight, 0.001)
    if (roll <= 0) return item
  }
  return items[items.length - 1] ?? null
}

export function countEligibleRandomQuestions(errors: ErrorEntry[]): number {
  const record = readPickRecord()
  const now = Date.now()
  return errors.filter((e) => {
    if (!e?.id || isMastered(e)) return false
    const pickedAt = record[e.id]
    if (!pickedAt) return true
    const ts = Date.parse(pickedAt)
    return !Number.isFinite(ts) || now - ts >= COOLDOWN_MS
  }).length
}

export function pickRandomQuestion(
  errors: ErrorEntry[],
  summaries: Record<string, AttemptSummary | null> = {},
): { entry: ErrorEntry | null; reason?: string } {
  const record = readPickRecord()
  const now = Date.now()
  const pool = errors.filter((e) => {
    if (!e?.id || isMastered(e)) return false
    const pickedAt = record[e.id]
    if (!pickedAt) return true
    const ts = Date.parse(pickedAt)
    return !Number.isFinite(ts) || now - ts >= COOLDOWN_MS
  })

  if (!pool.length) {
    const cooledSoon = errors
      .filter(e => e?.id && !isMastered(e) && record[e.id])
      .map(e => ({ e, days: daysSince(record[e.id]!) }))
      .sort((a, b) => a.days - b.days)[0]
    if (cooledSoon && cooledSoon.days < 3) {
      const waitDays = Math.ceil(3 - cooledSoon.days)
      return { entry: null, reason: `近 3 天可抽题目已练完，约 ${waitDays} 天后恢复` }
    }
    return { entry: null, reason: '暂无可随机练习的错题' }
  }

  const weighted = pool.map(entry => ({
    entry,
    weight: computeWeight(entry, summaries[entry.id]),
  }))
  const picked = weightedPick(weighted)
  if (!picked) return { entry: null, reason: '抽题失败，请重试' }

  markRandomQuestionPicked(picked.entry.id)
  return { entry: picked.entry }
}
