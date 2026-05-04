# 行测工作台 Vue 重写计划

> 目标路径：`/new/xingce/workspace`  
> 原则：**不动旧版任何文件**，新版与旧版并行，功能完全对齐旧版

---

## 架构总体原则

| 项 | 约定 |
|---|---|
| 旧版入口 | `/`（`v51_frontend/index.html`）**完全不动** |
| 新版入口 | `/new/xingce/workspace`（Vue Router） |
| 样式隔离 | 新版所有组件用 `scoped` CSS，不影响旧版全局 class |
| 数据层 | 共用后端 API（`/api/sync`、`/api/practice/*`），新版用 Pinia store |
| 验证方式 | 每个 Phase 完成后，截图/操作对照旧版，建立验证清单 |

---

## 当前状态（Phase 0-8 已完工）

| 文件 | 状态 |
|---|---|
| `frontend/src/api/xingce.ts` | ✅ 类型定义 + API 封装 |
| `frontend/src/stores/xingceStore.ts` | ✅ load/save/基础筛选（type/status/search） |
| `frontend/src/components/xingce/ErrorCard.vue` | ✅ 基础卡片（无练习统计、无操作按钮） |
| `frontend/src/components/xingce/ErrorGroup.vue` | ✅ 可折叠分组 |
| `frontend/src/components/xingce/ErrorList.vue` | ✅ 按 type\|subtype 分组列表 |
| `frontend/src/components/xingce/FilterSidebar.vue` | ✅ 基础筛选（仅大类 + 状态） |
| `frontend/src/views/xingce/WorkspacePage.vue` | ✅ 基础布局（Header + 侧栏 + 主区） |
| `frontend/src/router/index.ts` | ✅ `/xingce/workspace` 路由已注册 |

---

## 已知待验证问题（Phase 0-8 遗留）

1. **NotesPanel 笔记读取路径**：`knowledge_node` 的 `noteContent` 字段 vs `contentMd` 字段
2. **`/api/practice/log` 字段名**：后端期待 `error_id` 还是 `errorId`（`app/schemas.py` 中核查）
3. **flushSave 改增量 diff**：现在是全量推送所有 errors + knowledgeNodes，性能差

---

## Phase 9：知识树侧边栏

**参考旧版文件：**
- `xingce_v3/modules/main/knowledge/30a-knowledge-tree-state.js`（树结构、节点 CRUD）
- `xingce_v3/modules/main/knowledge/30b-knowledge-tree-render.js`（渲染逻辑）
- `v51_frontend/partials/01-sidebar.html`（`#navScroll` 区域）

**新建/修改文件：**

```
frontend/src/components/xingce/
  KnowledgeTree.vue          # 知识树容器（搜索框 + 专注树 toggle + 树体）
  KnowledgeTreeNode.vue      # 单个节点（递归，展开/折叠，错题计数 badge）
```

**store 新增（`xingceStore.ts`）：**

```ts
// 展开状态（持久化）
const knowledgeExpandedIds = ref<Set<string>>(new Set())

// 知识树搜索
const knowledgeTreeSearch = ref('')

// 专注树模式（只显示有错题的节点）
const knowledgeFocusMode = ref(false)

// 聚合错题数（节点 + 所有子孙节点之和，不含 mastered）
const errorCountByNodeAgg = computed<Record<string, number>>(() => { ... })

// 当前选中节点（已有 activeNodeId）
```

**功能点：**
- [ ] 按 `FIXED_KNOWLEDGE_ROOTS` 顺序排列根节点
- [ ] 每个节点显示：`▸/▾ 标题 [数量badge]`
- [ ] 数量 badge = 该节点及所有子孙的未掌握错题数
- [ ] 点击节点：`store.setActiveNode(nodeId)` → 列表筛选
- [ ] 展开/折叠：点箭头，状态存 `knowledgeExpandedIds`
- [ ] 搜索框：输入关键词 → 只显示匹配节点及其祖先路径
- [ ] 专注树：开启后隐藏 `errorCountByNodeAgg === 0` 的节点
- [ ] 替换 `FilterSidebar.vue` 中的大类平铺列表

**验证清单（对照旧版 `#navScroll`）：**
- [x] 节点层级深度一致（孤儿节点浮到 root 层，新旧版行为一致，属数据问题）
- [x] 错题数 badge 数字与旧版吻合（言语 35、判断 90、资料 49 等验证通过）
- [ ] 点击节点后，主区错题列表筛选结果与旧版一致
- [ ] 搜索"逻辑判断"，旧版和新版都定位到同一节点
- [ ] 专注树模式下，隐藏节点逻辑与旧版一致

**Phase 9 验证结论（2026-05-04）：**
知识树渲染正常，badge 聚合计数正确，状态筛选和搜索框就位。
待交互验证：节点点击筛选、搜索定位、专注树隐藏逻辑。

---

## Phase 10：筛选栏增强

**参考旧版文件：**
- `xingce_v3/modules/main/15-filters.js`

**store 新增（`xingceStore.ts`）：**

```ts
const taskFilter = ref<'all' | 'diagnose' | 'review_ready' | 'retrain'>('all')
const reasonFilter = ref<string | null>(null)
const dateFrom = ref('')
const dateTo = ref('')
```

`filteredErrors` 升级：

```ts
// taskFilter 映射到 workflowStage
// diagnose    → workflowStage in ['captured', 'diagnosing']
// review_ready → workflowStage === 'review_ready'
// retrain     → workflowStage === 'retrain_due'
```

**`FilterSidebar.vue` 新增 UI：**
- [ ] 任务阶段按钮：全部任务 / 待判因 / 待复盘 / 待复训（带数量）
- [ ] 错因筛选：下拉 or 列表（`rootReason/errorReason`）
- [ ] 日期范围：`addDate` 的 from/to 两个日期 input
- [ ] 搜索升级为多关键词 AND（空格分隔）
- [ ] 当前活跃筛选的 breadcrumb 显示

**验证清单：**
- [x] 任务阶段 chip 显示正确计数（待判因 7、待复盘 4）
- [x] 搜索框 placeholder 提示多关键词 AND 用法
- [x] 错因折叠列表、加入日期折叠输入均渲染正常
- [ ] 点"待判因"后列表数量与旧版一致（待人工交互确认）
- [ ] 日期范围筛选结果与旧版一致（待人工交互确认）
- [ ] 多关键词搜索（如"逻辑 判断"）结果与旧版一致（待人工交互确认）

**Phase 10 验证结论（2026-05-04）：UI 渲染正确，逻辑待人工交互验证。**

---

## Phase 11：ErrorCard 练习统计

**参考旧版文件：**
- `xingce_v3/modules/main/17-error-card-render.js`（`renderCardPracticeMetaChips`）

**API 核查（`app/routers/practice.py`）：**
- 确认 `GET /api/practice/attempts/summary` 的参数名（`error_ids`）
- 确认返回结构（`{ items: { [errorId]: SummaryObj } }`）

**store 新增：**

```ts
interface PracticeSummary {
  lastResult?: 'correct' | 'wrong' | 'skipped'
  recentWrongCount?: number
  lastConfidence?: number
  lastDuration?: number
  avgDuration?: number
  lastTime?: string
}

const practiceSummaries = ref<Record<string, PracticeSummary | null>>({})

async function loadPracticeSummaries(ids: string[]) {
  // 批量请求，只请求缓存中没有的 id
  // 合并到 practiceSummaries
}
```

**`ErrorCard.vue` 新增：**
- [ ] 卡片底部显示练习统计 chips：`错 N 次`、`最近用时 Xs`、`预计用时 Xs`
- [ ] `ErrorList.vue` 渲染完成后触发 `store.loadPracticeSummaries(visibleIds)`

**验证清单：**
- [x] API 参数格式对齐（`error_ids=id1,id2`，逗号分隔）
- [x] 返回格式正确解析（`{ items: { [id]: summary } }`）
- [x] wesly 账号无练习记录时 chips 不显示（正确行为）
- [ ] 有练习记录的账号：chips 数字与旧版 badge 一致（待有记录后验证）
- [x] 时长格式函数（X秒 / X分X秒）已实现

**Phase 11 验证结论（2026-05-04）：API 对齐、UI 正确，wesly 无历史记录故 chips 不显示，属预期。**

---

## Phase 12：左侧练习面板

**参考旧版：**
- `v51_frontend/partials/01-sidebar.html`（`.quiz-block` 区域）
- `/api/practice/workbench` 返回 badge 数量

**新建文件：**

```
frontend/src/components/xingce/PracticePanel.vue
```

**store 新增：**

```ts
const quizBadge = ref(0)         // 今日训练题数
const fullPracticeBadge = ref(0) // 全量练习题数
const todayProgress = ref({ done: 0, total: 0 })

async function loadPracticeWorkbench() {
  const data = await fetch('/api/practice/workbench')
  quizBadge.value = data.dailyCount
  fullPracticeBadge.value = data.totalCount
  todayProgress.value = { done: data.todayDone, total: data.todayTotal }
}
```

**`PracticePanel.vue` 内容：**
- [ ] 今日训练 按钮 + badge 数量
- [ ] 全量练习 按钮 + badge 数量
- [ ] 随机笔记 按钮
- [ ] 今日进度文字（X/Y）+ 进度条

**验证清单：**
- [ ] badge 数字与旧版一致（同一账号同一数据）
- [ ] 今日进度条百分比与旧版一致

---

## Phase 13：Quiz Modal（答题流程）

**参考旧版文件：**
- `xingce_v3/modules/main/13-quiz-flow.js`（完整答题流程，~960 行）

**新建文件：**

```
frontend/src/components/xingce/QuizModal.vue
```

**流程：**

```
开始 → 拉取题包（/api/practice/daily 或全量队列）
→ 逐题展示（题目 + 选项 + 限时提示）
→ 选项点击 → 标记对错（不立即显示答案）
→ 全部完成 → 回顾阶段（每题显示对错 + 解析）
→ 批量提交 POST /api/practice/log（每题一条）
→ 关闭 → 刷新 badge + 进度
```

**模式：**
- `daily`：今日训练（`/api/practice/daily?limit=12`）
- `full`：全量练习（本地 `filteredErrors` 全部）
- `review`：待复盘队列
- `retrain`：待复训队列

**验证清单：**
- [ ] 题目文字 + 选项与旧版渲染一致
- [ ] 计时模式（speed）下显示目标用时
- [ ] 提交后 badge 数量更新
- [ ] 批量提交 API 字段名与后端 schema 对齐

---

## Phase 14：添加 / 导入错题

**参考旧版文件：**
- `xingce_v3/modules/main/modal/`（import modal）
- `xingce_v3/modules/main/19-import-export.js`

**新建文件：**

```
frontend/src/components/xingce/AddErrorModal.vue
frontend/src/components/xingce/ImportModal.vue
```

**`AddErrorModal.vue` 字段：**
- 题目文本、选项、答案、错误原因、题型（大类/子类）
- 关联知识节点（下拉选知识树叶子节点）
- 状态（focus/review/mastered）

**`ImportModal.vue` 功能：**
- 粘贴文本（支持粉笔格式）
- 自动解析 → 预览列表
- 确认导入 → `store.addErrors()`

**验证清单：**
- [ ] 手动添加一题后，在列表中能看到
- [ ] 导入 N 题后，数量与旧版导入结果一致

---

## Phase 15：ErrorCard 操作区

**参考旧版文件：**
- `xingce_v3/modules/main/workspace/17a-error-card-actions.js`

**`ErrorCard.vue` 新增操作按钮（展开后可见）：**
- [ ] 状态切换：重点复习 / 待复习 / 已掌握（三态按钮）
- [ ] 掌握度切换：未掌握 → 模糊 → 已掌握（循环，同 `cyclemastery`）
- [ ] workflowStage 修改：待判因 / 待复盘 / 待复训
- [ ] 删除（需二次确认）
- [ ] 移动到知识节点（弹出节点选择器）
- [ ] 保存备注（`note` 字段行内编辑）

**store 已有：**
- `updateError(id, patch)` ✅
- `deleteError(id)` ✅

**验证清单：**
- [ ] 点"已掌握"后，卡片 badge 变绿，旧版同样操作结果一致
- [ ] 删除后列表减少，旧版同等
- [ ] 移动知识节点后，知识树 badge 数字实时更新

---

## Phase 16：更多菜单 & 数据工具

**参考旧版：**
- `v51_frontend/partials/01-sidebar.html`（`.more-menu-panel` 内容）

**新建文件：**

```
frontend/src/components/xingce/MoreMenu.vue
frontend/src/components/xingce/LocalBackupModal.vue
frontend/src/components/xingce/DashboardModal.vue
```

**MoreMenu 项目清单：**
- [ ] 导出（JSON 格式，与旧版 `openExportModal` 一致）
- [ ] 备份数据列表（`LocalBackupModal`，调 `/api/local-backups`）
- [ ] 从本地到云端全量（`PUT /api/backup`）
- [ ] 全量从云端同步（`GET /api/backup` 覆盖本地）
- [ ] 发给CC（`openClaudeHelper` 同等，格式化当前列表发 claude）
- [ ] 学习统计（`DashboardModal`，调 `/api/practice/insights`）
- [ ] 打印（`window.print()`）
- [ ] 高级：清空当前模块 / 清空全部 / 重置学习数据

**左侧栏顶部按钮（`WorkspacePage.vue`）：**
- [ ] Cloud Load / Cloud Save 按钮 + 同步状态 badge
- [ ] 用户名显示（`/api/me`）

**验证清单：**
- [ ] 导出 JSON 与旧版格式字段一致
- [ ] 备份列表能加载、能还原
- [ ] 学习统计数字与旧版 Dashboard 一致

---

## Phase 17：端到端对照验证

**验证账号：**
- 用户名：`wesly` / 密码：`admin123456`
- 验证环境：`http://127.0.0.1:8080`

**验证方法：**
1. 同一浏览器，左 tab 旧版 `/`，右 tab 新版 `/new/xingce/workspace`
2. 以 `wesly` 账号登录，使用其真实数据做对照
3. 逐项对照以下清单

**全量对照清单：**

| 功能点 | 旧版位置 | 新版位置 | 验证结果 |
|---|---|---|---|
| 总错题数 | header 右侧 | WorkspacePage header | |
| 知识树节点数量 | `#navScroll` | `KnowledgeTree.vue` | |
| 知识树 badge 数字 | 每个节点 | `KnowledgeTreeNode.vue` | |
| 筛选后列表数量 | 主区 | ErrorList | |
| 卡片展开内容 | `buildCardLowerPanelHtml` | `ErrorCard.vue` | |
| 练习统计（错N次） | `renderCardPracticeMetaChips` | `ErrorCard.vue` | |
| 今日训练 badge | `#quizBadge` | `PracticePanel.vue` | |
| 今日进度 | `#progText` | `PracticePanel.vue` | |
| 答题流程 | `13-quiz-flow.js` | `QuizModal.vue` | |
| 导出 JSON 字段 | `19-import-export.js` | `MoreMenu.vue` | |
| 备份列表 | local backup modal | `LocalBackupModal.vue` | |

---

## 文件变动边界（严格禁止修改）

以下文件/目录**严格不动**：

```
v51_frontend/          # 旧版 HTML shell
xingce_v3/             # 旧版所有 JS/CSS/HTML
app/                   # 后端（除非对齐字段名必须微调）
```

**新版只在这里动：**

```
frontend/src/
  api/xingce.ts
  stores/xingceStore.ts
  components/xingce/*.vue
  views/xingce/*.vue
  router/index.ts
```

---

## 执行顺序

```
Phase 9（知识树）→ Phase 10（筛选增强）→ Phase 11（练习统计）
→ Phase 12（练习面板）→ Phase 13（Quiz Modal）
→ Phase 14（添加/导入）→ Phase 15（Card 操作）
→ Phase 16（更多菜单）→ Phase 17（全量验证）
```

每个 Phase 完成后：
1. 本地跑 `npm run build`，确认无 TypeScript 错误
2. 部署到容器（`wsl.ps1 -Action up`）
3. 截图 + 与旧版对照，确认验证清单全绿
4. Commit

---

_最后更新：2026-05-04_
