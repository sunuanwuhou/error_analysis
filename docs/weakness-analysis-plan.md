# 弱点分析功能改动方案

> 创建日期：2026-04-05
> 工单：无（自发规划）
> 目标：将现有"学习统计"升级为"弱点分析"，深度利用错题数据

---

## 一、背景与现状

### 现状问题

当前"更多 → 学习统计"弹窗与首页 Dashboard 展示**完全相同的内容**（都调用 `buildDashboardOverviewHtml()`），毫无差异，用户点进去看到的东西和首页一模一样，体验价值为零。

### 核心代码位置

文件：`xingce_v3/modules/main/21-dashboard-modules.js`

| 函数 | 行号 | 说明 |
|------|------|------|
| `openDashboardStatsModal()` | ~14 | 触发弹窗，最终调用 `buildDashboardOverviewHtml('pane_0')` |
| `renderHomeDashboard()` | ~135 | 首页渲染，调用 `buildDashboardOverviewHtml('home')` |
| `buildDashboardOverviewHtml()` | ~578 | 15段混合内容（行动建议 + 统计分析），AI 依赖严重 |
| `buildDashboardWeakClusters()` | — | 弱点簇渲染，可复用 |
| `renderClusterList()` | — | 簇列表渲染，可复用 |
| `buildTrendBars()` | — | 趋势图渲染，可复用 |

---

## 二、改动方案（不接入 AI）

### 改动总览

| 序号 | 文件 | 改动类型 | 说明 |
|------|------|---------|------|
| 1 | `v51_frontend/partials/01-sidebar.html` | 文本替换 | 按钮文字 "学习统计" → "弱点分析" |
| 2 | `21-dashboard-modules.js` | 重构 | 首页用新 `buildHomeHtml()`，弹窗用新 `buildWeaknessAnalysisHtml()` |
| 3 | `21-dashboard-modules.js` | 新增 | `buildWeaknessAnalysisHtml()` 含热力图/掌握度/根因TOP5/趋势图 |
| 4 | `v51_frontend/assets/v51-overrides.css` | 新增 | 热力图所需 CSS |

---

### 改动1：侧边栏按钮文字

**文件**：`v51_frontend/partials/01-sidebar.html`，第 20 行

```html
<!-- 改前 -->
<button ... data-onclick="closeMoreMenu();openDashboardStatsModal()">📊 学习统计</button>

<!-- 改后 -->
<button ... data-onclick="closeMoreMenu();openDashboardStatsModal()">🎯 弱点分析</button>
```

---

### 改动2：首页精简为纯行动区

**函数**：`renderHomeDashboard()`（约第 135 行）

现在调用：
```js
host.innerHTML = buildDashboardOverviewHtml('home');
```

改为调用：
```js
host.innerHTML = buildHomeHtml();
```

**`buildHomeHtml()` 只保留以下内容**（从 `buildDashboardOverviewHtml` 拆出的行动区）：

```js
function buildHomeHtml() {
  const clusters = getWeakClusters();  // 复用现有逻辑
  return `
    <div class="home-action-panel">
      <div class="home-section">
        <h3>📌 今日建议</h3>
        ${buildTodaySuggestion(clusters)}
      </div>
      <div class="home-section">
        <h3>🔥 待处理错题</h3>
        ${buildPendingErrors()}
      </div>
    </div>
  `;
}
```

**删除的 AI 依赖内容**（原 `buildDashboardOverviewHtml` 中）：
- 今日行动建议（依赖 `/api/practice/insights`）
- 今日待复盘/待复训（依赖 AI 接口）
- 当前高频错因（AI 推断）
- 薄弱模块（AI 推断）

---

### 改动3：弱点分析弹窗（核心新功能）

**函数**：`openDashboardStatsModal()` 中，将 `buildDashboardOverviewHtml('pane_0')` 改为调用 `buildWeaknessAnalysisHtml()`

新增函数 `buildWeaknessAnalysisHtml()`，包含 4 个分析模块：

#### 3.1 热力图 — 模块 × 星期错误分布

```js
function buildHeatmapHtml(errors) {
  // X轴：一周7天（周一~周日）
  // Y轴：题目模块（数量推理/判断推理/言语理解/资料分析/常识）
  // 色块：当天该模块错题数（0=空白, 1=浅绿, 2-3=中, 4+=深红）

  const modules = ['数量推理', '判断推理', '言语理解', '资料分析', '常识'];
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  // 统计最近30天数据分布
  // ...

  return `
    <div class="heatmap-container">
      <h4>📅 近30天错题热力图</h4>
      <div class="heatmap-grid">
        <!-- 7列 × N行 -->
      </div>
      <div class="heatmap-legend">
        <span class="legend-0">0</span>
        <span class="legend-1">1</span>
        <span class="legend-2">2-3</span>
        <span class="legend-3">4+</span>
      </div>
    </div>
  `;
}
```

#### 3.2 掌握度分布

```js
function buildMasteryProgressHtml(errors) {
  // 按 workflowStage 统计比例
  const stages = {
    'diagnosing':   { label: '待诊断', color: '#888' },
    'review_ready': { label: '待复盘', color: '#f0a500' },
    'retrain_due':  { label: '待复训', color: '#e05c00' },
    'mastered':     { label: '已掌握', color: '#3a9' },
  };
  // 横向进度条 + 数量
  return `<div class="mastery-bars">...</div>`;
}
```

#### 3.3 根因 TOP5

```js
function buildRootReasonTop5Html(errors) {
  // 统计 rootReason 字段出现频次
  // 只看 workflowStage = review_ready | retrain_due 的错题
  // 排序取前5，展示：根因描述 + 次数 + 最近发生
  return `
    <div class="rootreason-list">
      <h4>⚠️ 高频根因 TOP5</h4>
      ${reasonRows}
    </div>
  `;
}
```

#### 3.4 趋势图（复用现有）

复用 `buildTrendBars()`，展示最近30天每日错题数折线/柱状图。

**完整函数结构**：

```js
function buildWeaknessAnalysisHtml() {
  const errors = getAllActiveErrors();  // 从 state_entities 取全量活跃错题
  return `
    <div class="weakness-analysis-panel">
      <div class="wa-section">${buildHeatmapHtml(errors)}</div>
      <div class="wa-section">${buildMasteryProgressHtml(errors)}</div>
      <div class="wa-section">${buildRootReasonTop5Html(errors)}</div>
      <div class="wa-section">${buildTrendBars(errors)}</div>
    </div>
  `;
}
```

---

### 改动4：热力图 CSS

追加到 `v51_frontend/assets/v51-overrides.css`：

```css
/* ===== 弱点分析热力图 ===== */
.heatmap-container { padding: 12px 0; }
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
  margin-top: 8px;
}
.heatmap-cell {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 3px;
  background: #eee;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}
.heatmap-cell.level-0 { background: #f0f0f0; }
.heatmap-cell.level-1 { background: #b7e4c7; }
.heatmap-cell.level-2 { background: #74c69d; }
.heatmap-cell.level-3 { background: #d62828; color: #fff; }
.heatmap-legend { display: flex; gap: 8px; margin-top: 6px; font-size: 11px; color: #888; }
.heatmap-label-row { display: flex; gap: 3px; margin-bottom: 3px; }
.heatmap-label-cell { flex: 1; text-align: center; font-size: 10px; color: #999; }

/* ===== 掌握度进度条 ===== */
.mastery-bars { padding: 8px 0; }
.mastery-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.mastery-label { width: 60px; font-size: 12px; color: #555; }
.mastery-bar-bg { flex: 1; height: 10px; background: #eee; border-radius: 5px; overflow: hidden; }
.mastery-bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s; }
.mastery-count { font-size: 12px; color: #888; width: 30px; text-align: right; }

/* ===== 根因列表 ===== */
.rootreason-list { padding: 8px 0; }
.rootreason-row {
  display: flex; justify-content: space-between;
  padding: 5px 0; border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}
.rootreason-text { flex: 1; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rootreason-count { color: #e05c00; font-weight: bold; margin-left: 8px; }
```

---

## 三、数据现状分析

### state_entities 表

```
总记录：154
├── 活跃（deleted_at IS NULL）：12
│   └── 全部有 workflowStage 字段
└── 软删除（deleted_at IS NOT NULL）：142
    └── 历史数据，不参与分析
```

### user_backups 表

```
记录数：1 条
备份大小：7.9MB
包含错题：136 条
├── 有 rootReason 字段：107 条（78.7%）
└── 无 rootReason 字段：29 条（21.3%）
└── 有 workflowStage：0 条（全部缺失）
```

### 问题

**仅 12 条活跃错题，数据量严重不足**，热力图、根因分析、趋势图都无法有效展示。

---

## 四、数据迁移方案

### 迁移规则

| 条件 | 推断 workflowStage | 数量 |
|------|--------------------|------|
| 有 `rootReason` 字段 | `review_ready`（已找到根因，待复盘） | 107 |
| 无 `rootReason` 字段 | `diagnosing`（尚未诊断） | 29 |
| `problemType` | 全部设为 `unknown` | 136 |

- 使用 `INSERT OR IGNORE`：12 条已有数据安全跳过，不覆盖
- 迁移后预期活跃错题：**148 条**（12 原有 + 136 新增）

### 迁移脚本

**文件**：`scripts/migrate_backup_to_state.py`

```python
#!/usr/bin/env python3
"""
从 user_backups 迁移错题数据到 state_entities
用途：补充历史错题，支撑弱点分析功能
运行：python3 scripts/migrate_backup_to_state.py
"""

import sqlite3
import json
import uuid
from datetime import datetime, timezone

DB_PATH = "data/xingce.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1. 读取最新备份
    cur.execute("""
        SELECT data FROM user_backups
        ORDER BY created_at DESC LIMIT 1
    """)
    row = cur.fetchone()
    if not row:
        print("❌ user_backups 表为空，退出")
        return

    backup = json.loads(row["data"])

    # 兼容两种备份结构
    errors = backup.get("errors") or backup.get("errorEntities") or []
    print(f"📦 备份中发现 {len(errors)} 条错题")

    inserted = 0
    skipped = 0
    now = datetime.now(timezone.utc).isoformat()

    for err in errors:
        entity_id = err.get("id") or str(uuid.uuid4())
        root_reason = err.get("rootReason") or err.get("root_reason")

        # 推断 workflowStage
        if root_reason:
            workflow_stage = "review_ready"
        else:
            workflow_stage = "diagnosing"

        # 构建 entity_data（保留原始字段，补充缺失字段）
        entity_data = {
            **err,
            "workflowStage": workflow_stage,
            "problemType": err.get("problemType") or "unknown",
            "migratedAt": now,
            "migratedFrom": "user_backups",
        }

        try:
            cur.execute("""
                INSERT OR IGNORE INTO state_entities
                    (id, entity_type, entity_data, created_at, updated_at)
                VALUES (?, 'error', ?, ?, ?)
            """, (
                entity_id,
                json.dumps(entity_data, ensure_ascii=False),
                err.get("createdAt") or now,
                now,
            ))
            if cur.rowcount > 0:
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  ⚠️ 跳过 {entity_id}: {e}")
            skipped += 1

    conn.commit()
    conn.close()

    print(f"✅ 迁移完成：新增 {inserted} 条，跳过（已存在）{skipped} 条")
    print(f"   迁移分布：review_ready（有根因）约107条，diagnosing（无根因）约29条")

if __name__ == "__main__":
    migrate()
```

---

## 五、执行步骤

### Step 1：运行数据迁移

```bash
cd /Users/10030299/Documents/Playground/error_analysis
python3 scripts/migrate_backup_to_state.py
```

预期输出：
```
📦 备份中发现 136 条错题
✅ 迁移完成：新增 136 条，跳过（已存在）0 条
   迁移分布：review_ready（有根因）约107条，diagnosing（无根因）约29条
```

验证：
```sql
SELECT COUNT(*), workflowStage
FROM state_entities
WHERE deleted_at IS NULL
GROUP BY workflowStage;
```

### Step 2：修改侧边栏按钮文字

**文件**：`v51_frontend/partials/01-sidebar.html`，第 20 行
- 将 `📊 学习统计` 改为 `🎯 弱点分析`

### Step 3：在 21-dashboard-modules.js 中拆分函数

1. 新增 `buildHomeHtml()` — 仅行动内容
2. 新增 `buildWeaknessAnalysisHtml()` — 弱点分析4模块
3. `renderHomeDashboard()` 改调 `buildHomeHtml()`
4. `openDashboardStatsModal()` 改调 `buildWeaknessAnalysisHtml()`

### Step 4：追加热力图 CSS

在 `v51_frontend/assets/v51-overrides.css` 末尾追加改动4中的样式。

---

## 六、验收标准

| 验收项 | 预期结果 |
|--------|---------|
| 侧边栏按钮 | 显示"🎯 弱点分析" |
| 首页 Dashboard | 只有行动区，无统计分析内容 |
| 弱点分析弹窗 | 包含热力图、掌握度、根因TOP5、趋势图 |
| 热力图 | 有色块差异（需要≥2周数据才明显） |
| 根因TOP5 | 至少展示3条（迁移后数据充足） |
| 数据库 | state_entities 活跃记录 ≥ 100 条 |
| 无 AI 依赖 | 所有数据来自本地 SQLite，无外部 API 调用 |

---

## 七、文件改动汇总

```
改动文件（4个）：
├── v51_frontend/partials/01-sidebar.html         （文字替换）
├── xingce_v3/modules/main/21-dashboard-modules.js（函数拆分+新增）
├── v51_frontend/assets/v51-overrides.css         （追加CSS）
└── scripts/migrate_backup_to_state.py            （新建迁移脚本）
```

> 注意：`v51-bootstrap.js` 按文件加载各模块（非打包），直接改源文件即刻生效，无需构建步骤。