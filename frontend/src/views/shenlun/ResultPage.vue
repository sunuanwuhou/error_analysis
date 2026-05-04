<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { shenlunApi, type Attempt, type SegmentReview } from '@/api/shenlun'

const route = useRoute()
const router = useRouter()

const attempt = ref<Attempt | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const activeSegmentIndex = ref(0)
const activeTab = ref<'segments' | 'overall'>('segments')

// submit-cc is synchronous, so result should already be ready.
// Polling is kept as a safety fallback (e.g. if user navigates directly to URL).
let pollCount = 0
async function loadAttempt() {
  const id = route.params.attemptId as string
  try {
    const att = await shenlunApi.getAttempt(id)
    attempt.value = att

    if (att.cc_status === 'pending' && pollCount < 20) {
      pollCount++
      setTimeout(() => void loadAttempt(), 3000)
      return
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(() => void loadAttempt())

const ccResult = computed(() => attempt.value?.cc_result_json ?? null)
const segments = computed<SegmentReview[]>(() => ccResult.value?.segments ?? [])
const activeSegment = computed<SegmentReview | null>(
  () => segments.value[activeSegmentIndex.value] ?? null,
)

const statusLabel = computed(() => {
  const s = attempt.value?.cc_status
  if (s === 'pending') return '等待 CC 返回中…'
  if (s === 'success') return '已完成复盘'
  if (s === 'failed') return 'CC 返回失败'
  return ''
})

function tagClass(tag: string): string {
  if (tag.includes('遗漏')) return 'tag tag--miss'
  if (tag.includes('错误') || tag.includes('偏差')) return 'tag tag--wrong'
  if (tag.includes('空泛') || tag.includes('过虚')) return 'tag tag--vague'
  return 'tag tag--default'
}
</script>

<template>
  <div class="rp-page">
    <!-- Loading / Error -->
    <div v-if="loading" class="rp-center">
      <div class="rp-spinner" />
      <p>加载中…</p>
    </div>

    <div v-else-if="error" class="rp-center rp-error">
      <p>加载失败：{{ error }}</p>
      <button class="btn btn-secondary" @click="router.back()">返回</button>
    </div>

    <template v-else-if="attempt">
      <!-- Header -->
      <header class="rp-header">
        <div class="rp-header-left">
          <span class="rp-tag">归纳概括</span>
          <span class="rp-status" :class="attempt.cc_status">{{ statusLabel }}</span>
        </div>
        <button class="btn btn-secondary" @click="router.push({ name: 'ShenlunWorkbench' })">
          新建练习
        </button>
      </header>

      <!-- Waiting state -->
      <div v-if="attempt.cc_status === 'pending'" class="rp-waiting">
        <div class="rp-spinner" />
        <p>CC 正在分析，请稍候…</p>
      </div>

      <!-- Failed state -->
      <div v-else-if="attempt.cc_status === 'failed'" class="rp-fail-banner">
        CC 返回失败，请稍后重试或联系管理员。
      </div>

      <!-- Result -->
      <template v-else-if="ccResult">
        <!-- Tab bar -->
        <div class="rp-tabs">
          <button
            class="rp-tab"
            :class="{ active: activeTab === 'segments' }"
            @click="activeTab = 'segments'"
          >
            分段对比
          </button>
          <button
            class="rp-tab"
            :class="{ active: activeTab === 'overall' }"
            @click="activeTab = 'overall'"
          >
            整体点评
          </button>
        </div>

        <!-- Segment tab -->
        <template v-if="activeTab === 'segments'">
          <!-- Segment navigator -->
          <div class="seg-nav">
            <button
              v-for="(_, i) in segments"
              :key="i"
              class="seg-nav-btn"
              :class="{ active: activeSegmentIndex === i }"
              @click="activeSegmentIndex = i"
            >
              材料 {{ i + 1 }}
            </button>
          </div>

          <!-- Active segment detail -->
          <div v-if="activeSegment" class="seg-detail">
            <!-- Source material -->
            <section class="seg-section">
              <h3 class="seg-section-title">材料原文</h3>
              <p class="seg-text seg-text--source">{{ activeSegment.source_segment_text }}</p>
            </section>

            <!-- Comparison row -->
            <div class="seg-compare-grid">
              <section class="seg-section">
                <h3 class="seg-section-title seg-section-title--mine">我的提炼</h3>
                <p class="seg-text">{{ activeSegment.my_extraction || '（未填写）' }}</p>
              </section>
              <section class="seg-section">
                <h3 class="seg-section-title seg-section-title--ref">参考提炼</h3>
                <p class="seg-text">{{ activeSegment.reference_extraction }}</p>
              </section>
            </div>

            <!-- Point breakdown -->
            <div class="seg-points-grid">
              <div v-if="activeSegment.matched_points.length" class="seg-points seg-points--matched">
                <h4 class="seg-points-title">✓ 命中</h4>
                <ul>
                  <li v-for="(pt, i) in activeSegment.matched_points" :key="i">{{ pt }}</li>
                </ul>
              </div>
              <div v-if="activeSegment.missed_points.length" class="seg-points seg-points--missed">
                <h4 class="seg-points-title">✗ 遗漏</h4>
                <ul>
                  <li v-for="(pt, i) in activeSegment.missed_points" :key="i">{{ pt }}</li>
                </ul>
              </div>
              <div v-if="activeSegment.wrong_points.length" class="seg-points seg-points--wrong">
                <h4 class="seg-points-title">△ 有误</h4>
                <ul>
                  <li v-for="(pt, i) in activeSegment.wrong_points" :key="i">{{ pt }}</li>
                </ul>
              </div>
            </div>

            <!-- Issue tags -->
            <div v-if="activeSegment.issue_tags.length" class="seg-tags">
              <span
                v-for="tag in activeSegment.issue_tags"
                :key="tag"
                :class="tagClass(tag)"
              >{{ tag }}</span>
            </div>

            <!-- CC comment -->
            <section v-if="activeSegment.cc_comment" class="seg-section seg-section--comment">
              <h3 class="seg-section-title">点评</h3>
              <p class="seg-text seg-text--comment">{{ activeSegment.cc_comment }}</p>
            </section>
          </div>
        </template>

        <!-- Overall tab -->
        <template v-else>
          <div class="overall-grid">
            <section class="overall-section">
              <h3 class="overall-title overall-title--mine">我的总结</h3>
              <p class="overall-text">{{ attempt.my_final_summary || '（未填写）' }}</p>
            </section>
            <section class="overall-section">
              <h3 class="overall-title overall-title--ref">参考总结</h3>
              <p class="overall-text">{{ ccResult.reference_final_summary }}</p>
            </section>
          </div>

          <div v-if="ccResult.overall_issue_tags?.length" class="overall-tags">
            <span
              v-for="tag in ccResult.overall_issue_tags"
              :key="tag"
              :class="tagClass(tag)"
            >{{ tag }}</span>
          </div>

          <section v-if="ccResult.overall_comment" class="overall-comment-section">
            <h3 class="overall-title">整体点评</h3>
            <p class="overall-text overall-text--comment">{{ ccResult.overall_comment }}</p>
          </section>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.rp-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 20px 80px;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif;
  color: #1a1a2e;
}

.rp-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 0;
  color: #6b7280;
}

.rp-error {
  color: #dc2626;
}

.rp-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 12px;
}

.rp-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rp-tag {
  background: #e8f4fd;
  color: #1a73e8;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
}

.rp-status {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
}

.rp-status.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.rp-status.failed {
  background: #fef2f2;
  color: #dc2626;
}

.rp-status.pending {
  background: #fff8e1;
  color: #f57f17;
}

.rp-waiting {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: #fafafa;
  border-radius: 10px;
  color: #6b7280;
  font-size: 14px;
}

.rp-fail-banner {
  padding: 16px;
  background: #fef2f2;
  border-radius: 8px;
  color: #dc2626;
  font-size: 14px;
}

.rp-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 24px;
}

.rp-tab {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.15s, border-color 0.15s;
}

.rp-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

/* Segment navigator */
.seg-nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.seg-nav-btn {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: #374151;
  transition: background 0.12s, border-color 0.12s;
}

.seg-nav-btn:hover {
  background: #f3f4f6;
}

.seg-nav-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

/* Segment detail */
.seg-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.seg-section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.seg-section--comment {
  background: #f0f9ff;
  border-color: #bae6fd;
}

.seg-section-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.seg-section-title--mine {
  color: #d97706;
}

.seg-section-title--ref {
  color: #059669;
}

.seg-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
  white-space: pre-wrap;
}

.seg-text--source {
  background: #f9fafb;
  border-radius: 6px;
  padding: 10px 12px;
}

.seg-text--comment {
  color: #0369a1;
}

.seg-compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.seg-points-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.seg-points {
  flex: 1;
  min-width: 160px;
  border-radius: 8px;
  padding: 12px 14px;
}

.seg-points ul {
  margin: 6px 0 0;
  padding-left: 16px;
}

.seg-points li {
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
}

.seg-points--matched {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.seg-points--missed {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.seg-points--wrong {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.seg-points-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
}

.seg-points--matched .seg-points-title { color: #15803d; }
.seg-points--missed .seg-points-title { color: #dc2626; }
.seg-points--wrong .seg-points-title { color: #d97706; }

/* Tags */
.seg-tags,
.overall-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.tag--miss { background: #fef2f2; color: #dc2626; }
.tag--wrong { background: #fffbeb; color: #d97706; }
.tag--vague { background: #f5f3ff; color: #7c3aed; }
.tag--default { background: #f3f4f6; color: #374151; }

/* Overall tab */
.overall-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.overall-section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.overall-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.overall-title--mine { color: #d97706; }
.overall-title--ref { color: #059669; }

.overall-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
  white-space: pre-wrap;
}

.overall-text--comment {
  color: #0369a1;
}

.overall-comment-section {
  margin-top: 20px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 16px;
}

/* Buttons */
.btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

@media (max-width: 640px) {
  .seg-compare-grid,
  .overall-grid {
    grid-template-columns: 1fr;
  }
}
</style>
