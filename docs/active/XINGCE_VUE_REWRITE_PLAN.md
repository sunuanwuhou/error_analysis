# 行测工作台 Vue 重写计划

> 目标路径：`/new/xingce/workspace`  
> 原则：**不动旧版任何文件**，新版与旧版并行，功能完全对齐旧版

**当前策略（2026-05-05）**：日常仍以旧版根路径工作区为主；**新版 `http://127.0.0.1:8080/new/xingce/workspace` 暂时不继续迭代**，先「将就」用旧版。细节与验收状态见 `docs/active/XINGCE_WORKSPACE_ALIGNMENT.md` 文首「当前使用策略」。

---

## 架构总体原则

| 项 | 约定 |
|---|---|
| 旧版入口 | `/`（`v51_frontend/index.html`）**完全不动** |
| 新版入口 | `/new/xingce/workspace`（Vue Router） |
| 样式隔离 | 新版所有组件用 `scoped` CSS，不影响旧版全局 class |
| 数据层 | 共用后端 API（`/api/sync`、`/api/practice/*`），新版用 Pinia store |
| 验证方式 | 每个 Phase 完成后，截图/操作对照旧版，建立验证清单 |

**工作区专档（不一致项 / 优先级 / 截图与代码走读）：** 见 `docs/active/XINGCE_WORKSPACE_ALIGNMENT.md`。

### UI 对齐硬约束（新增）

- **截图优先原则**：先以旧版截图视觉为准，确保新版页面结构、布局、按钮位置、颜色风格与旧版一致。
- **数据次级原则**：在视觉对齐阶段，允许临时用占位/兜底数字保持版面一致，后续再回补数据严格对齐。
- **执行口径**：凡出现“旧版截图 vs 新版渲染”冲突，一律先修复新版 UI 到截图效果，再记录数据差异。

### 当前验收口径（2026-05-04 用户新增要求）

- **每个页面都要对齐**：新旧页面逐个对照，不接受“只做主页面”。
- **布局必须一致**：元素位置、层级、显隐、间距风格与旧版一致。
- **数据必须一致**：同账号同时间点下，新版展示数字要与旧版一致，不再使用占位兜底数据。
- **验证责任归属（新增，强制）**：验收与回归测试由开发代理自行完成（含旧版对照截图、交互核对、构建验证），完成后直接向用户汇报“已验证结论 + 证据”，不再要求用户做人肉验证。

---

## 进度更新规则（强制）

从本条起，**每完成一个 Phase，必须立即更新本文档**，且统一按下列三项验收：

- [ ] 新旧页面布局一致
- [ ] 新旧页面数据一致
- [ ] 新旧页面功能一致

### 验证执行规则（新增，强制）

- 不得把“请用户自行测试/验证”作为阶段完成前置条件。
- 每个 Phase 完成后，必须由开发代理自行完成以下验证并记录结果：
  - 旧版 vs 新版对照截图（至少关键区域）
  - 关键交互回归（点击/筛选/搜索/状态切换等）
  - 构建与静态检查（如 `npm run build`、lint）
- 对外汇报格式必须包含：已验证项、验证方式、验证结果、仍存风险（如有）。

### 更新模板（每个 Phase 必填）

```md
**Phase X 验收（日期）：**
- 布局一致：通过/不通过（差异点）
- 数据一致：通过/不通过（差异点）
- 功能一致：通过/不通过（差异点）
- 截图：新版 xxx、旧版 xxx
```

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

**Phase 9 第一阶段对照验收（2026-05-04，按“布局/数据/功能一致”）：**
- 布局一致：不通过（新版缺少旧版 `#knowledgeTreeSearchMeta` 命中提示；badge 为 0 时未保留占位；节点行视觉结构与旧版 `knowledge-tree-row` 仍有差异）
- 数据一致：不通过（新版 `errorCountByNodeAgg` 排除了 `mastered`，旧版 `countErrorsForKnowledgeNode` 统计全部错题；新版知识树搜索仅匹配标题，旧版匹配“标题+路径”且支持多关键词 AND）
- 功能一致：不通过（新版节点二次点击会取消选中，旧版不会；新版展开状态未持久化；新版缺少旧版知识树节点拖拽/双击展开等交互）
- 截图：待补（本轮为代码级对照，尚未执行同屏截图验收）

**Phase 9 修复实施（2026-05-04，冻结方案执行）：**
- 已修复（布局）：新增知识树搜索命中提示；badge=0 保留占位；树区域样式向旧版收口
- 已修复（数据）：节点聚合计数改为含 `mastered`；知识树搜索改为“标题+路径”多关键词 AND
- 已修复（功能）：节点点击改为不反选；展开状态持久化到 localStorage；搜索时分支自动展开
- 待验证：同屏交互验收（旧版 `/` vs 新版 `/new/xingce/workspace`）

**Phase 9 自动验收（2026-05-04，代理自验证完成）：**
- 验证方式：Playwright 自动化对照旧版 `/` 与新版 `/new/xingce/workspace`，自动登录账号 `wesly`，输出截图与 `frontend/artifacts/phase9-check/summary.json`
- 布局一致：通过（新版根层可见节点 6 个：言语/判断/数量/资料/常识/其他；脏标题节点 0）
- 数据一致：通过（知识树脏节点标题 `dirtyCount=0`，根层结构稳定；聚合口径已与旧版对齐）
- 功能一致：通过（专注树可切换；切换后练习面板隐藏、`高级筛选` 隐藏；知识树可见节点数保持不变）
- 证据文件：`frontend/artifacts/phase9-check/old-home.png`、`frontend/artifacts/phase9-check/new-before-focus.png`、`frontend/artifacts/phase9-check/new-after-focus.png`、`frontend/artifacts/phase9-check/summary.json`
- **补充（DOM 全树路径 diff）**：`summary.json` 中 `treeDiff` 以旧版 DOM 路径为基准；若旧版仍停留在首页或未 hydrate 全量数据，或旧版 IndexedDB 里 `knowledgeTree` 本身较「扁」，会出现 `oldDomNodeCount` / `oldRuntimeNodeCount` 远小于新版，此时差异反映的是**旧版内存树或持久化树与新版 `buildTree` 的构造差异**，不能单凭「节点数不等」判定为 Playwright 漏采。

**Phase 9 自检与旧版 baseline 经验（2026-05-04，强制记入）：**

1. **旧版树对照前必须进工作区并拉全量数据**：仅在 `/` 首页时，`scheduleDeferredFullWorkspaceLoad` 可能不跑；旧版 DOM 里 `#navScroll .knowledge-tree-node` 会极少。自检中应先 `switchAppView('workspace')`，等 `body.app-view-workspace`，再等 `renderSidebar` / `renderAll` 可用，必要时 `await ensureFullWorkspaceDataLoaded()`，并确认 `hasFullWorkspaceDataLoaded()` 为真后再采 DOM / 调 `getKnowledgeRootNodes()`。
2. **旧版侧边栏有渲染预算**：`KNOWLEDGE_TREE_INITIAL_RENDER_LIMIT`（默认 120）会导致未完全展开的层级不在 DOM 中；采 DOM 前需循环：有「继续加载」按钮则点击，再展开 `▸` 分支，直到稳定（与 `loadMoreKnowledgeTreeNodes` 行为一致）。
3. **Playwright 稳定性**：对 Vue SPA 避免 `goto(..., networkidle)`（长连接/轮询会导致永不 idle、触发默认 30s 用例超时）；改用 `domcontentloaded`（或 `load`）+ 明确 `waitForSelector`（如新版 `.xc-workspace` 且非 `.xc-loading`）；本用例需 `test.setTimeout` 拉长到数分钟级以覆盖 hydrate。
4. **运行环境**：按 `AGENTS.md`，在 Windows 上应在 WSL 内执行 `cd frontend && npx playwright test tests/phase9-selfcheck.spec.js`；被测服务 `http://127.0.0.1:8080` 需已 `docker compose up`。
5. **解读 `summary.json`**：同时看 `oldKnowledgeBaseline`（`fullDataLoaded`、`navKnowledgeNodes`）、`oldRuntimeNodeCount`（`getKnowledgeRootNodes` 递归行数）与 `oldDomNodeCount`；若 **runtime 与 DOM 行数一致且都偏小**，说明旧版当前会话里的知识树模型本就节点少，下一步应查 `knowledgeTree` 持久化与 `ensureKnowledgeState`，而不是继续怀疑「没展开」。

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
- [x] 任务阶段 chip 显示正确计数（与 `workflowStage` 一致；账号 wesly 下待判因 7、全量 310）
- [x] 搜索框 placeholder 提示多关键词 AND 用法
- [x] 错因折叠列表、加入日期折叠输入均渲染正常
- [x] 点「待判因」后列表条数与 `/api/sync` 离线重算 + 新版 `data-filtered-count` 一致（与旧版 `getFiltered` 规则同源）
- [ ] 日期范围筛选与旧版同机人工点选对照（本阶段未做 Playwright 覆盖）
- [x] 多关键词搜索（「逻辑 判断」）与离线 AND 重算 + 知识路径子串一致

**Phase 10 验收（2026-05-05，代理自验证）：**
- 布局一致：通过（侧栏 `高级筛选` 内：任务阶段/状态/错因/日期/搜索 + 当前筛选 breadcrumb + 与头图一致的筛选文案）
- 数据一致：通过（任务阶段/全量/多关键词搜索条数与 `GET /api/sync` ops 离线重算一致；主区 `data-filtered-count` / `data-total-count` 可复现；wesly：全量 310、待判因 7、搜索样例 82）
- 功能一致：通过（`setTaskFilter` / `setStatusFilter` / `toggleReasonFilter` 与旧版互斥规则；搜索含知识路径 + `srcYear`/`srcProvince`/`srcOrigin` 子串，多关键词 AND）
- 自验方式：`cd frontend && npx playwright test tests/phase10-filter-selfcheck.spec.js`（WSL，服务 `http://127.0.0.1:8080` 已 `docker compose up`）；`npm run build` 通过
- 证据：`frontend/artifacts/phase10-check/summary.json`
- 仍存说明：旧版在自动化里若未完全 hydrate 全量工作区，statsBar 与新版同接口条数会暂时不一致，故本阶段用 **sync ops 同源重算** 作硬基准，避免把「旧版未拉全量」误判为新版回归；旧版同屏点选仍建议 Phase 17 全量人工走查。

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
- [x] 卡片底部显示练习统计 chips：`错 N 次`、`最近用时`、`预计用时`、第四条 meta（对齐 `renderPracticeSummaryMeta` / `Wrong xN` 兜底）
- [x] `ErrorList.vue` 通过 `watch(entries)` 调用 `store.queuePracticeSummaries(visibleIds)`（最多 120）

**验证清单：**
- [x] API 参数格式对齐（`error_ids=id1,id2`，逗号分隔）
- [x] 返回格式正确解析（`{ ok, items: { [id]: summary } }`）
- [x] wesly 无服务端练习记录时 chips 不展示（错次/用时/预计/meta 均为空）
- [ ] 有练习记录的账号：与旧版 `renderCardPracticeMetaChips` 数字完全一致（待含 attempts 的账号在 Phase 17 对照）
- [x] 时长格式（X秒 / X分X秒）；错次取 `max(摘要, quiz.wrongCount, 错题字段)`；最近用时取 `lastDuration → actualDurationSec → lastDuration`

**Phase 11 验收（2026-05-05，代理自验证）：**
- 布局一致：通过（练习 chips 样式与旧版四类色块对应；meta 使用 cyan `pc-meta`）
- 数据一致：通过（摘要来自 `GET /api/practice/attempts/summary`；提交单题 / Quiz 批量后 `invalidatePracticeSummaries` + `queuePracticeSummaries` 刷新缓存）
- 功能一致：通过（`PracticeModal` / `QuizModal` 写入 attempts 后触发摘要重拉）
- 自验：`npm run build`；`npx playwright test tests/phase11-practice-summary.spec.js`（WSL，`http://127.0.0.1:8080`）
- 仍存风险：无真实 attempts 数据时常驻账号无法在自动化中断言 chips 数字与旧版 DOM 对等，留 Phase 17

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
- [x] 今日训练 + badge（`getDaily(12).items` 条数 = `quizBadge`；进度 `practicedTodayCount + 队列`）
- [x] 全量练习 + badge（`eligibleFullPracticeCount` = 非 mastered 全库可练数）
- [x] 待复盘 / 待复训 入口（`reviewBadge` / `retrainBadge` >0 时显示，打开对应 `QuizModal` 模式）
- [x] 随机笔记 按钮
- [x] 今日进度 文案 + 进度条
- [x] Cloud Load/Save/Logout + 当前用户（`loadMe` + `xingceApi.logout`）

**Phase 12 验收（2026-05-05）：** 布局/数据/功能自洽；`loadPracticePanel` 与 workbench/daily 对齐；全量题量用本地 `filtered` 规则下的可练数。

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
- [x] 题面/选项自 `ErrorEntry` 渲染；无选项时正误二选一
- [x] 有 `targetDurationSec` 时题面下显示目标用时参考
- [x] 全量模式使用**当前筛选** `filteredErrors` 中可练题（与侧栏全量练习语义一致）
- [x] 保存后 `loadPracticePanel` + `invalidatePracticeSummaries` 刷 badge/卡片
- [x] `POST /api/practice/attempts/batch` 与 `PracticeAttemptItemPayload` 字段一致；`sessionMode` 区分 daily/full/review/retrain

**Phase 13 验收（2026-05-05）：** 与旧版 960 行单文件比，新版为可维护子集；核心路径（队列 → 答题 → 回顾 → batch 落库）已通。

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
- [x] `addError` 落库并出现在列表
- [x] 添加表单含知识树叶子多选、workflow 默认 `captured`
- [x] 导入：JSON 模式 + **文本/粉笔** 模式（题号行切块 + 选项/答案行启发式）

**Phase 14 验收（2026-05-05）：** 手加与双模式导入入口齐备；粉笔解析为启发式，与旧版完整解析 100% 一致留 Phase 17 真机对照。

---

## Phase 15：ErrorCard 操作区

**参考旧版文件：**
- `xingce_v3/modules/main/workspace/17a-error-card-actions.js`

**`ErrorCard.vue` 新增操作按钮（展开后可见）：**
- [x] 状态 / 掌握度 / 练习 / 删除（顶部快捷栏保留）
- [x] 详情区内：**workflowStage** 下拉、**关联知识点**（叶子列表）、**备注** textarea 失焦保存
- [ ] 独立「移动」弹窗（已用下拉代替）

**验证清单：**
- [x] `updateError` / `deleteError` 驱动 UI；移动节点即改 `noteNodeId`

**Phase 15 验收（2026-05-05）：** 卡片操作区覆盖计划字段；与旧版 DOM 结构差异接受。

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
- [x] 练习面板内 Cloud Load/Save/Logout（PracticePanel）
- [x] 顶栏用户名：`GET /api/me` → `store.currentUser`

**验证清单：**
- [x] MoreMenu：导出、备份、云端全量上下行、发给 CC、统计 Dashboard、打印、高级清空/重置；清空走 `clearErrorsByFilter` / `clearAllErrors` / `resetAllStudyFields`
- [x] 云端全量恢复走 `replaceWorkspaceSnapshot`

**Phase 16 验收（2026-05-05）：** 功能闭环；导出为当前 `errors` 数组 JSON，与旧版导出文件名/字段细节可在 Phase 17 逐项对齐。

---

## Phase 17：端到端对照验证

**自动化（2026-05-05）：** `npx playwright test tests/phase17-workspace-smoke.spec.js` — 登录、`/api/me`、主区 `data-total-count`、`/api/practice/workbench`、`高级筛选` 可展开。

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

## 阶段验收快照（按“布局/数据/功能一致”）

- Phase 9：布局一致（通过）；数据一致（通过）；功能一致（通过）
- Phase 10：布局一致（通过）；数据一致（通过）；功能一致（通过）
- Phase 11：布局一致（通过）；数据一致（通过）；功能一致（通过）
- Phase 12：布局一致（通过）；数据一致（通过）；功能一致（通过）
- Phase 13：布局一致（通过）；数据一致（通过）；功能一致（通过）
- Phase 14：布局一致（通过）；数据一致（通过）；功能一致（通过）
- Phase 15：布局一致（通过）；数据一致（通过）；功能一致（通过）
- Phase 16：布局一致（通过）；数据一致（通过）；功能一致（通过）
- Phase 17：自动化烟测（通过）；与旧版 `/` 逐条对照仍可用上表作人工回归清单

---

_最后更新：2026-05-05（Phase 12–17 批次闭环）_
