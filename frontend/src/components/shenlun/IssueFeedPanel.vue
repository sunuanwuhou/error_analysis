<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { shenlunApi, type IssueEntry, type IssueStats } from '@/api/shenlun'
import IssueTagChip from '@/components/shenlun/IssueTagChip.vue'
import {
  buildResultIssueLink,
  formatDetectedAt,
  formatIssueScope,
  formatPaperMeta,
} from '@/lib/shenlunIssues'

const props = defineProps<{
  nodeId: string
  initialTag?: string
  initialSourceId?: string
}>()

const router = useRouter()

type FeedView = 'timeline' | 'by-tag' | 'by-source'
const viewMode = ref<FeedView>('timeline')
const activeTag = ref(props.initialTag ?? '')
const activeScope = ref<'segment' | 'overall' | ''>('')
const activeSourceId = ref(props.initialSourceId ?? '')

const items = ref<IssueEntry[]>([])
const total = ref(0)
const stats = ref<IssueStats | null>(null)
const loading = ref(false)
const statsLoading = ref(false)
const error = ref<string | null>(null)

watch(
  () => [props.nodeId, props.initialTag, props.initialSourceId] as const,
  ([nid, tag, sid]) => {
    activeTag.value = tag ?? ''
    activeSourceId.value = sid ?? ''
    void loadAll(nid)
  },
  { immediate: true },
)

async function loadStats(nodeId: string) {
  statsLoading.value = true
  try {
    stats.value = await shenlunApi.getIssueStats(nodeId)
  } catch {
    stats.value = null
  } finally {
    statsLoading.value = false
  }
}

async function loadFeed(nodeId: string) {
  loading.value = true
  error.value = null
  try {
    const res = await shenlunApi.listIssueFeed({
      nodeId,
      tag: activeTag.value,
      scope: activeScope.value,
      sourceId: activeSourceId.value,
      limit: 100,
    })
    items.value = res.items
    total.value = res.total
  } catch (e) {
    error.value = (e as Error).message
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadAll(nodeId: string) {
  await Promise.all([loadStats(nodeId), loadFeed(nodeId)])
}

function applyFilter() {
  void loadFeed(props.nodeId)
}

function clearFilters() {
  activeTag.value = ''
  activeScope.value = ''
  activeSourceId.value = ''
  applyFilter()
}

function onTagFilter(tag: string) {
  activeTag.value = activeTag.value === tag ? '' : tag
  applyFilter()
}

const groupedByTag = computed(() => {
  const map = new Map<string, IssueEntry[]>()
  for (const row of items.value) {
    const list = map.get(row.issue_tag) ?? []
    list.push(row)
    map.set(row.issue_tag, list)
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
})

const groupedBySource = computed(() => {
  const map = new Map<string, { preview: string; paper: string; rows: IssueEntry[] }>()
  for (const row of items.value) {
    const existing = map.get(row.source_id)
    if (existing) {
      existing.rows.push(row)
    } else {
      map.set(row.source_id, {
        preview: row.question_preview,
        paper: formatPaperMeta(row),
        rows: [row],
      })
    }
  }
  return [...map.entries()].sort(
    (a, b) =>
      new Date(b[1].rows[0]?.detected_at ?? 0).getTime() -
      new Date(a[1].rows[0]?.detected_at ?? 0).getTime(),
  )
})

function openResult(entry: IssueEntry) {
  void router.push(buildResultIssueLink(entry.attempt_id, entry))
}

function evidenceLines(entry: IssueEntry): string[] {
  const lines: string[] = []
  if (entry.missed_points.length) lines.push(`遗漏：${entry.missed_points.slice(0, 3).join('；')}`)
  if (entry.wrong_points.length) lines.push(`有误：${entry.wrong_points.slice(0, 3).join('；')}`)
  return lines
}

defineExpose({ reload: () => loadAll(props.nodeId) })
</script>

<template>
  <div class="issue-feed">
    <div v-if="stats && stats.total_entries > 0" class="issue-feed-summary">
      <p class="issue-feed-summary-line">
        共 <strong>{{ stats.total_entries }}</strong> 条弱点记录 ·
        来自 <strong>{{ stats.sources_with_issues }}</strong> 题 ·
        <strong>{{ stats.attempts_with_issues }}</strong> 轮复盘
        <template v-if="stats.recent_7d_count > 0">
          · 近 7 天 <strong>+{{ stats.recent_7d_count }}</strong>
        </template>
      </p>
      <div v-if="stats.tag_counts.length" class="issue-feed-tagrow">
        <IssueTagChip
          v-for="row in stats.tag_counts"
          :key="row.tag"
          :tag="`${row.tag} ×${row.count}`"
          size="sm"
          :active="activeTag === row.tag"
          @click="onTagFilter(row.tag)"
        />
      </div>
    </div>

    <div class="issue-feed-toolbar">
      <div class="issue-feed-views" role="tablist">
        <button
          type="button"
          class="issue-feed-view-btn"
          :class="{ active: viewMode === 'timeline' }"
          @click="viewMode = 'timeline'"
        >
          时间线
        </button>
        <button
          type="button"
          class="issue-feed-view-btn"
          :class="{ active: viewMode === 'by-tag' }"
          @click="viewMode = 'by-tag'"
        >
          按标签
        </button>
        <button
          type="button"
          class="issue-feed-view-btn"
          :class="{ active: viewMode === 'by-source' }"
          @click="viewMode = 'by-source'"
        >
          按题目
        </button>
      </div>
      <div class="issue-feed-filters">
        <select v-model="activeScope" class="issue-feed-select" @change="applyFilter">
          <option value="">全部分段/整体</option>
          <option value="segment">仅分段</option>
          <option value="overall">仅整体总结</option>
        </select>
        <button v-if="activeTag || activeScope || activeSourceId" type="button" class="issue-feed-clear" @click="clearFilters">
          清除筛选
        </button>
      </div>
    </div>

    <p v-if="loading || statsLoading" class="issue-feed-muted">加载中…</p>
    <p v-else-if="error" class="issue-feed-error">加载失败：{{ error }}</p>
    <p v-else-if="!items.length" class="issue-feed-empty">
      还没有 AI 复盘弱点。完成一次「生成提示词 → 粘贴结果」后，弱点会自动汇总到这里（含题号、轮次、段落来源）。
    </p>

    <template v-else>
      <p v-if="total > items.length" class="issue-feed-muted">
        显示最近 {{ items.length }} / {{ total }} 条
      </p>

      <!-- Timeline -->
      <ul v-if="viewMode === 'timeline'" class="issue-card-list">
        <li v-for="entry in items" :key="entry.id" class="issue-card">
          <div class="issue-card-head">
            <IssueTagChip :tag="entry.issue_tag" size="sm" />
            <span class="issue-card-loc">
              {{ formatIssueScope(entry.scope, entry.segment_index) }} · 第 {{ entry.attempt_no }} 轮
            </span>
            <span class="issue-card-time">{{ formatDetectedAt(entry.detected_at) }}</span>
          </div>
          <p class="issue-card-q" :title="entry.question_preview">{{ entry.question_preview }}</p>
          <p v-if="formatPaperMeta(entry)" class="issue-card-paper">{{ formatPaperMeta(entry) }}</p>
          <ul v-if="evidenceLines(entry).length" class="issue-card-evidence">
            <li v-for="(line, i) in evidenceLines(entry)" :key="i">{{ line }}</li>
          </ul>
          <p v-if="entry.cc_comment" class="issue-card-comment">{{ entry.cc_comment }}</p>
          <button type="button" class="issue-card-go" @click="openResult(entry)">查看复盘 →</button>
        </li>
      </ul>

      <!-- By tag -->
      <div v-else-if="viewMode === 'by-tag'" class="issue-groups">
        <section v-for="[tag, rows] in groupedByTag" :key="tag" class="issue-group">
          <h3 class="issue-group-title">
            <IssueTagChip :tag="tag" size="sm" /> <span class="issue-group-count">{{ rows.length }} 条</span>
          </h3>
          <ul class="issue-card-list issue-card-list--compact">
            <li v-for="entry in rows" :key="entry.id" class="issue-card issue-card--compact">
              <div class="issue-card-head">
                <span class="issue-card-loc">
                  {{ formatIssueScope(entry.scope, entry.segment_index) }} · 第 {{ entry.attempt_no }} 轮
                </span>
                <span class="issue-card-time">{{ formatDetectedAt(entry.detected_at) }}</span>
              </div>
              <p class="issue-card-q">{{ entry.question_preview }}</p>
              <button type="button" class="issue-card-go" @click="openResult(entry)">查看复盘 →</button>
            </li>
          </ul>
        </section>
      </div>

      <!-- By source -->
      <div v-else class="issue-groups">
        <section v-for="[sourceId, group] in groupedBySource" :key="sourceId" class="issue-group">
          <h3 class="issue-group-title issue-group-title--q">{{ group.preview }}</h3>
          <p v-if="group.paper" class="issue-group-paper">{{ group.paper }}</p>
          <ul class="issue-card-list issue-card-list--compact">
            <li v-for="entry in group.rows" :key="entry.id" class="issue-card issue-card--compact">
              <div class="issue-card-head">
                <IssueTagChip :tag="entry.issue_tag" size="sm" />
                <span class="issue-card-loc">
                  {{ formatIssueScope(entry.scope, entry.segment_index) }} · 第 {{ entry.attempt_no }} 轮
                </span>
              </div>
              <p v-if="entry.cc_comment" class="issue-card-comment">{{ entry.cc_comment }}</p>
              <button type="button" class="issue-card-go" @click="openResult(entry)">查看复盘 →</button>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.issue-feed-summary {
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
}
.issue-feed-summary-line {
  margin: 0 0 10px;
  font-size: 13px;
  color: #4b5563;
}
.issue-feed-tagrow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.issue-feed-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.issue-feed-views {
  display: flex;
  gap: 6px;
}
.issue-feed-view-btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
}
.issue-feed-view-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.issue-feed-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}
.issue-feed-select {
  font-size: 12px;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
}
.issue-feed-clear {
  border: none;
  background: none;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}
.issue-feed-muted {
  font-size: 13px;
  color: #9ca3af;
  margin: 0 0 12px;
}
.issue-feed-error {
  font-size: 13px;
  color: #dc2626;
  margin: 0 0 12px;
}
.issue-feed-empty {
  margin: 24px 0;
  padding: 20px 16px;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  background: #fafafa;
}
.issue-card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.issue-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
  background: #fff;
}
.issue-card--compact {
  padding: 10px 12px;
}
.issue-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 8px;
}
.issue-card-loc {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
}
.issue-card-time {
  font-size: 11px;
  color: #9ca3af;
  margin-left: auto;
}
.issue-card-q {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.45;
}
.issue-card-paper {
  margin: 0 0 8px;
  font-size: 12px;
  color: #6b7280;
}
.issue-card-evidence {
  margin: 0 0 8px;
  padding-left: 18px;
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
}
.issue-card-comment {
  margin: 0 0 10px;
  font-size: 13px;
  color: #4b5563;
  line-height: 1.5;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 6px;
}
.issue-card-go {
  border: none;
  background: none;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.issue-card-go:hover {
  text-decoration: underline;
}
.issue-groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.issue-group-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}
.issue-group-title--q {
  font-weight: 600;
  line-height: 1.45;
}
.issue-group-count {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}
.issue-group-paper {
  margin: -4px 0 10px;
  font-size: 12px;
  color: #6b7280;
}
</style>
