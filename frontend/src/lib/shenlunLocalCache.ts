/**
 * 申论 Hub 本地缓存（手动同步模式：切节点只读本地，点「同步」才与云端交换）。
 */

import type { IssueStats, ShenlunCustomNode, SourceSummary } from '@/api/shenlun'

const CACHE_PREFIX = 'shenlun:cache:v1:'
const NOTES_PREFIX = 'shenlun:hubNotes:v1:'

export type ShenlunCacheMeta = {
  lastManualSyncAt: string | null
}

type CachedSources = {
  items: SourceSummary[]
  fetchedAt: string
  maxUpdatedAt: string
}

type CachedIssueStats = {
  stats: IssueStats
  fetchedAt: string
}

type CachedKnowledgeTree = {
  custom_nodes: ShenlunCustomNode[]
  fetchedAt: string
}

function noteKey(nodeId: string): string {
  return NOTES_PREFIX + (nodeId === '' ? '_uncategorized_' : nodeId)
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage full or disabled */
  }
}

export function readCacheMeta(): ShenlunCacheMeta {
  return readJson<ShenlunCacheMeta>('meta') ?? { lastManualSyncAt: null }
}

export function writeCacheMeta(meta: ShenlunCacheMeta): void {
  writeJson('meta', meta)
}

export function readKnowledgeTreeCache(): CachedKnowledgeTree | null {
  return readJson<CachedKnowledgeTree>('knowledgeTree')
}

export function writeKnowledgeTreeCache(custom_nodes: ShenlunCustomNode[]): void {
  writeJson('knowledgeTree', {
    custom_nodes,
    fetchedAt: new Date().toISOString(),
  } satisfies CachedKnowledgeTree)
}

export function readSourcesCache(nodeId: string): CachedSources | null {
  return readJson<CachedSources>(`sources:${nodeId}`)
}

function maxSourceUpdatedAt(items: SourceSummary[]): string {
  let max = ''
  for (const row of items) {
    const u = (row.updated_at ?? '').trim()
    if (u && u > max) max = u
  }
  return max
}

export function writeSourcesCache(nodeId: string, items: SourceSummary[]): void {
  writeJson(`sources:${nodeId}`, {
    items,
    fetchedAt: new Date().toISOString(),
    maxUpdatedAt: maxSourceUpdatedAt(items),
  } satisfies CachedSources)
}

export function readIssueStatsCache(nodeId: string): CachedIssueStats | null {
  return readJson<CachedIssueStats>(`issueStats:${nodeId}`)
}

export function writeIssueStatsCache(nodeId: string, stats: IssueStats): void {
  writeJson(`issueStats:${nodeId}`, {
    stats,
    fetchedAt: new Date().toISOString(),
  } satisfies CachedIssueStats)
}

export function readNoteLocal(nodeId: string): string {
  try {
    return localStorage.getItem(noteKey(nodeId)) ?? ''
  } catch {
    return ''
  }
}

export function writeNoteLocal(nodeId: string, bodyMd: string): void {
  try {
    localStorage.setItem(noteKey(nodeId), bodyMd)
  } catch {
    /* ignore */
  }
}

function readDirtyNoteIds(): string[] {
  const raw = readJson<string[]>('notesDirty')
  return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []
}

export function isNoteDirty(nodeId: string): boolean {
  return readDirtyNoteIds().includes(nodeId)
}

export function markNoteDirty(nodeId: string): void {
  const ids = new Set(readDirtyNoteIds())
  ids.add(nodeId)
  writeJson('notesDirty', [...ids])
}

export function clearNoteDirty(nodeId: string): void {
  const ids = readDirtyNoteIds().filter((id) => id !== nodeId)
  writeJson('notesDirty', ids)
}

export function listDirtyNoteIds(): string[] {
  return readDirtyNoteIds()
}

export function countDirtyNotes(): number {
  return readDirtyNoteIds().length
}

export function formatCacheTime(iso: string | null | undefined): string {
  const s = (iso ?? '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', { hour12: false })
}
