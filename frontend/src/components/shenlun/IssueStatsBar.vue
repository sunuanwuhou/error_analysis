<script setup lang="ts">
import type { IssueStats } from '@/api/shenlun'
import IssueTagChip from '@/components/shenlun/IssueTagChip.vue'

const props = defineProps<{
  stats: IssueStats | null
  nodeTitle: string
  activeTag: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:activeTag': [tag: string]
  viewAll: []
}>()

function onTagClick(tag: string) {
  emit('update:activeTag', props.activeTag === tag ? '' : tag)
}

function onViewAll() {
  emit('viewAll')
}
</script>

<template>
  <div v-if="loading" class="issue-stats issue-stats--loading">加载弱点统计…</div>
  <div v-else-if="stats && stats.total_entries > 0" class="issue-stats">
    <div class="issue-stats-head">
      <span class="issue-stats-title">{{ nodeTitle }} · 高频弱点</span>
      <button type="button" class="issue-stats-link" @click="onViewAll">查看全部 →</button>
    </div>
    <p class="issue-stats-meta">
      共 {{ stats.total_entries }} 条 · 来自 {{ stats.sources_with_issues }} 题
      <template v-if="stats.recent_7d_count > 0"> · 近 7 天 +{{ stats.recent_7d_count }}</template>
    </p>
    <div class="issue-stats-tags">
      <IssueTagChip
        v-for="row in stats.tag_counts"
        :key="row.tag"
        :tag="`${row.tag} ×${row.count}`"
        size="sm"
        :active="activeTag === row.tag"
        @click="onTagClick(row.tag)"
      />
    </div>
  </div>
</template>

<style scoped>
.issue-stats {
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: linear-gradient(135deg, #fffbeb 0%, #eff6ff 100%);
}
.issue-stats--loading {
  color: #6b7280;
  font-size: 13px;
  background: #f9fafb;
}
.issue-stats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.issue-stats-title {
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
}
.issue-stats-link {
  border: none;
  background: none;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.issue-stats-link:hover {
  text-decoration: underline;
}
.issue-stats-meta {
  margin: 6px 0 10px;
  font-size: 12px;
  color: #6b7280;
}
.issue-stats-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
