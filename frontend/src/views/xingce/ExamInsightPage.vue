<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { examInsightApi, type ExamInsightResponse } from '@/api/examInsight'
import { bankDrillApi, type BankDrillMetaResponse } from '@/api/bankDrill'

const router = useRouter()

function calendarYearsDefault(): number[] {
  const y = new Date().getFullYear()
  return [y - 4, y - 3, y - 2, y - 1, y]
}

const examTrack = ref<'provincial' | 'unified'>('provincial')
const selectedYears = ref<number[]>([...calendarYearsDefault()])
const loading = ref(false)
const loadErr = ref('')
const data = ref<ExamInsightResponse | null>(null)
const meta = ref<BankDrillMetaResponse | null>(null)

const activeModuleId = ref('')
const showZero = ref(true)
const expandedCats = ref<Set<string>>(new Set())

const trackLabel = computed(() => (examTrack.value === 'provincial' ? '省考' : '统考'))

const activeModule = computed(() => {
  const mods = data.value?.modules ?? []
  if (!mods.length) return null
  const hit = mods.find(m => m.id === activeModuleId.value)
  return hit ?? mods[0]
})

const filteredCategories = computed(() => {
  const mod = activeModule.value
  if (!mod) return []
  if (showZero.value) return mod.categories
  return mod.categories
    .map(cat => ({
      ...cat,
      knowledge_points: cat.knowledge_points.filter(kp => kp.count > 0),
    }))
    .filter(cat => cat.knowledge_points.length > 0)
})

function toggleYear(y: number) {
  const set = new Set(selectedYears.value)
  if (set.has(y)) set.delete(y)
  else set.add(y)
  selectedYears.value = [...set].sort((a, b) => a - b)
}

function restoreDefaultYears() {
  selectedYears.value = [...calendarYearsDefault()]
}

function toggleCat(catId: string) {
  const next = new Set(expandedCats.value)
  if (next.has(catId)) next.delete(catId)
  else next.add(catId)
  expandedCats.value = next
}

function expandAllCats() {
  const ids = filteredCategories.value.map(c => c.id)
  expandedCats.value = new Set(ids)
}

function pctText(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

function yearTrend(byYear: Record<string, number>) {
  const keys = Object.keys(byYear).map(Number).sort((a, b) => a - b)
  if (!keys.length) return '—'
  return keys.map(y => `${y}:${byYear[String(y)]}`).join(' · ')
}

async function loadInsight() {
  if (!selectedYears.value.length) {
    loadErr.value = '请至少选择一个年份'
    return
  }
  loading.value = true
  loadErr.value = ''
  try {
    data.value = await examInsightApi.fetch({
      examTrack: examTrack.value,
      years: selectedYears.value,
    })
    if (!activeModuleId.value && data.value.modules.length) {
      activeModuleId.value = data.value.modules[0].id
    }
    expandAllCats()
  } catch (e) {
    loadErr.value = String((e as Error)?.message || e)
  } finally {
    loading.value = false
  }
}

function goSuiteBank() {
  void router.push({ name: 'XingceSuiteBank' })
}

function goPortal() {
  void router.push({ name: 'ModulePortal' })
}

onMounted(async () => {
  try {
    meta.value = await bankDrillApi.meta(examTrack.value, selectedYears.value)
  } catch {
    meta.value = null
  }
  await loadInsight()
})

watch(examTrack, async () => {
  try {
    meta.value = await bankDrillApi.meta(examTrack.value, selectedYears.value)
  } catch {
    /* ignore */
  }
})

watch([examTrack, selectedYears], () => {
  void loadInsight()
}, { deep: true })
</script>

<template>
  <div class="sb-page ei-page">
    <header class="sb-head">
      <div class="sb-head-row">
        <h1 class="sb-title">考情分析</h1>
        <div class="sb-actions">
          <button type="button" class="btn btn-secondary" @click="goSuiteBank">套卷列表</button>
          <button type="button" class="btn btn-ghost" @click="goPortal">模块首页</button>
        </div>
      </div>
      <p class="sb-meta">
        基于<strong>广东</strong>套卷真题，按公开考纲展开<strong>每一个知识点</strong>（含 0 次出现项）；
        题目标签来自粉笔「考点」字段，经规则映射到考纲知识点树。
      </p>
    </header>

    <div class="ei-filters">
      <div class="bd-row">
        <span class="bd-label">考试类型</span>
        <div class="bd-tabs">
          <button
            type="button"
            class="bd-tab"
            :class="{ active: examTrack === 'provincial' }"
            @click="examTrack = 'provincial'"
          >
            省考
          </button>
          <button
            type="button"
            class="bd-tab"
            :class="{ active: examTrack === 'unified' }"
            @click="examTrack = 'unified'"
          >
            统考
          </button>
        </div>
      </div>
      <div class="bd-row bd-years-row">
        <span class="bd-label">试卷年份</span>
        <div class="sb-years">
          <button type="button" class="sb-chip" @click="restoreDefaultYears">恢复默认 5 年</button>
          <button
            v-for="y in meta?.year_catalog ?? selectedYears"
            :key="y"
            type="button"
            class="sb-chip"
            :class="{ active: selectedYears.includes(y) }"
            @click="toggleYear(y)"
          >
            {{ y }}
          </button>
        </div>
      </div>
      <label class="ei-zero-toggle">
        <input v-model="showZero" type="checkbox" />
        显示 0 次出现的知识点（完整考纲）
      </label>
    </div>

    <p v-if="loadErr" class="sb-err">{{ loadErr }}</p>
    <div v-if="loading" class="sb-loading">正在统计考情…</div>

    <template v-else-if="data">
      <section class="ei-summary">
        <div class="ei-stat">
          <span class="ei-stat-num">{{ data.summary.paper_count }}</span>
          <span class="ei-stat-label">套卷</span>
        </div>
        <div class="ei-stat">
          <span class="ei-stat-num">{{ data.summary.question_count }}</span>
          <span class="ei-stat-label">题目</span>
        </div>
        <div class="ei-stat">
          <span class="ei-stat-num">{{ data.summary.knowledge_point_total }}</span>
          <span class="ei-stat-label">知识点（考纲）</span>
        </div>
        <div class="ei-stat">
          <span class="ei-stat-num">{{ data.summary.unmapped_tag_count }}</span>
          <span class="ei-stat-label">未映射标签</span>
        </div>
        <p class="ei-summary-note">
          {{ trackLabel }} · {{ data.filters.years.join('、') }} 年 · {{ data.summary.taxonomy_source_note }}
        </p>
      </section>

      <section class="ei-module-bar">
        <button
          v-for="mod in data.by_major_module"
          :key="mod.id"
          type="button"
          class="ei-mod-chip"
          :class="{ active: activeModuleId === mod.id }"
          @click="activeModuleId = mod.id"
        >
          {{ mod.label }}
          <em>{{ mod.count }}</em>
          <small>{{ pctText(mod.pct) }}</small>
        </button>
      </section>

      <section v-if="activeModule" class="ei-detail">
        <header class="ei-detail-head">
          <h2>{{ activeModule.label }}</h2>
          <span>{{ activeModule.count }} 题 · {{ pctText(activeModule.pct) }}</span>
          <button type="button" class="btn btn-secondary btn-sm" @click="expandAllCats">全部展开</button>
        </header>

        <div v-for="cat in filteredCategories" :key="cat.id" class="ei-cat">
          <button type="button" class="ei-cat-head" @click="toggleCat(cat.id)">
            <span class="ei-cat-arrow">{{ expandedCats.has(cat.id) ? '▼' : '▶' }}</span>
            <span class="ei-cat-title">{{ cat.label }}</span>
            <span class="ei-cat-meta">{{ cat.count }} 题 · {{ pctText(cat.pct) }}</span>
          </button>

          <table v-if="expandedCats.has(cat.id)" class="ei-kp-table">
            <thead>
              <tr>
                <th>知识点</th>
                <th class="num">题量</th>
                <th class="num">占比</th>
                <th>年度分布</th>
                <th>映射标签（粉笔考点）</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="kp in cat.knowledge_points"
                :key="kp.id"
                :class="{ 'is-zero': kp.count === 0 }"
              >
                <td class="kp-label">{{ kp.label }}</td>
                <td class="num">{{ kp.count }}</td>
                <td class="num">{{ pctText(kp.pct) }}</td>
                <td class="kp-years">{{ yearTrend(kp.by_year) }}</td>
                <td class="kp-tags">
                  <span v-if="kp.source_tags.length">{{ kp.source_tags.join('、') }}</span>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="data.unmapped_tags.length" class="ei-unmapped">
        <h2>未映射到考纲的粉笔标签</h2>
        <p class="ei-unmapped-hint">以下标签在题库中出现，但尚未纳入考纲知识点树；可据此补充 taxonomy。</p>
        <table class="ei-kp-table">
          <thead>
            <tr>
              <th>原始标签</th>
              <th class="num">题量</th>
              <th class="num">占比</th>
              <th>年度分布</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.unmapped_tags" :key="row.tag">
              <td>{{ row.tag }}</td>
              <td class="num">{{ row.count }}</td>
              <td class="num">{{ pctText(row.pct) }}</td>
              <td>{{ yearTrend(row.by_year) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ei-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem 1.25rem 2.5rem;
}
.sb-head {
  margin-bottom: 1rem;
}
.sb-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.sb-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 650;
}
.sb-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.sb-meta {
  margin: 0.5rem 0 0;
  color: var(--muted, #666);
  font-size: 0.9rem;
  line-height: 1.5;
}
.sb-err {
  color: #b42318;
}
.sb-loading {
  padding: 2rem;
  text-align: center;
  color: var(--muted, #666);
}
.ei-filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding: 1rem;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 10px;
  background: var(--surface, #fafafa);
}
.bd-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.bd-label {
  min-width: 4.5rem;
  padding-top: 0.35rem;
  font-size: 0.85rem;
  color: var(--muted, #666);
}
.bd-tabs {
  display: flex;
  gap: 0.35rem;
}
.bd-tab {
  border: 1px solid var(--border, #d1d5db);
  background: #fff;
  border-radius: 8px;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
}
.bd-tab.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}
.sb-years {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.sb-chip {
  border: 1px solid var(--border, #d1d5db);
  background: #fff;
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  font-size: 0.85rem;
  cursor: pointer;
}
.sb-chip.active {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}
.ei-zero-toggle {
  font-size: 0.85rem;
  color: var(--muted, #666);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.ei-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #f8fafc, #eff6ff);
  border: 1px solid #dbeafe;
}
.ei-stat {
  display: flex;
  flex-direction: column;
  min-width: 5rem;
}
.ei-stat-num {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.1;
}
.ei-stat-label {
  font-size: 0.8rem;
  color: var(--muted, #666);
}
.ei-summary-note {
  flex: 1 1 100%;
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted, #666);
}
.ei-module-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.ei-mod-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  border: 1px solid var(--border, #d1d5db);
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  background: #fff;
  cursor: pointer;
  min-width: 6.5rem;
}
.ei-mod-chip.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px #2563eb;
}
.ei-mod-chip em {
  font-style: normal;
  font-weight: 700;
  font-size: 1.1rem;
}
.ei-mod-chip small {
  color: var(--muted, #666);
  font-size: 0.75rem;
}
.ei-detail-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.ei-detail-head h2 {
  margin: 0;
  font-size: 1.1rem;
}
.ei-detail-head span {
  color: var(--muted, #666);
  font-size: 0.9rem;
}
.btn-sm {
  font-size: 0.8rem;
  padding: 0.2rem 0.55rem;
}
.ei-cat {
  margin-bottom: 0.5rem;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.ei-cat-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border: none;
  background: #f9fafb;
  cursor: pointer;
  text-align: left;
}
.ei-cat-title {
  font-weight: 600;
  flex: 1;
}
.ei-cat-meta {
  font-size: 0.85rem;
  color: var(--muted, #666);
}
.ei-kp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}
.ei-kp-table th,
.ei-kp-table td {
  padding: 0.45rem 0.75rem;
  border-top: 1px solid #f0f0f0;
  vertical-align: top;
}
.ei-kp-table th {
  background: #fafafa;
  font-weight: 600;
  text-align: left;
}
.ei-kp-table th.num,
.ei-kp-table td.num {
  text-align: right;
  white-space: nowrap;
  width: 4rem;
}
.ei-kp-table tr.is-zero {
  opacity: 0.55;
}
.kp-label {
  font-weight: 500;
}
.kp-years {
  font-size: 0.8rem;
  color: var(--muted, #555);
  white-space: nowrap;
}
.kp-tags {
  font-size: 0.78rem;
  color: #4b5563;
  max-width: 16rem;
}
.muted {
  color: #9ca3af;
}
.ei-unmapped {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 2px dashed #e5e7eb;
}
.ei-unmapped h2 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}
.ei-unmapped-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--muted, #666);
}
</style>
