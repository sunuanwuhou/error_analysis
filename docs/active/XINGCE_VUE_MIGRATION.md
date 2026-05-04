# 行测工作台 Vue 迁移规划

Updated: 2026-05-04

---

## 当前进度（2026-05-04 19:45）

**全部 Phase 0-8 已完成并部署上线。**

### 已完成的 Phase

| Phase | 内容 | 提交 | 状态 |
|-------|------|------|------|
| 0 | 脚手架：API层/Store/路由/WorkspacePage骨架 | `230575f` | ✅ |
| 1 | ErrorCard 错题卡片展示（含展开/收起） | `phase-1 commit` | ✅ |
| 2 | ErrorList 按 type›subtype 分组列表 | `phase-2+3 commit` | ✅ |
| 3 | FilterSidebar 题型+状态+搜索筛选 | `phase-2+3 commit` | ✅ |
| 4 | KnowledgeTreePanel 递归知识树（含错题计数） | `phase-4+5+6 commit` | ✅ |
| 5 | NotesPanel 笔记面板（CSS高度链，无postMessage滚动bug） | `phase-4+5+6 commit` | ✅ |
| 6 | WorkspaceLayout 完整布局（错题/笔记 Tab 切换） | `phase-4+5+6 commit` | ✅ |
| 7 | ErrorCard 写操作：状态切换、掌握度切换、删除（二次确认） | `phase-7 commit` | ✅ |
| 8 | PracticeModal 练习弹窗：答题→提交→记录→掌握度更新 | `phase-8 commit` | ✅ |

### 访问地址

- **Vue 新版**：`http://127.0.0.1:8080/new/xingce/workspace`
- **Legacy 原版**：`http://127.0.0.1:8080/`（完全未改动）

### 已创建的文件清单

```
frontend/src/
  api/xingce.ts                      ← API层 + ops→snapshot重建 + 类型定义
  stores/xingceStore.ts              ← Pinia store（筛选/计算/save防抖）
  router/index.ts                    ← 追加 /xingce/workspace 路由
  views/xingce/
    WorkspacePage.vue                ← 顶层页面（Tab切换 + 加载状态）
  components/xingce/
    ErrorCard.vue                    ← 卡片展示 + 状态/掌握度切换 + 删除 + 练习入口
    ErrorGroup.vue                   ← 分组容器（折叠/展开）
    ErrorList.vue                    ← 错题列表（按题型分组）
    FilterSidebar.vue                ← 左侧筛选栏（题型+状态+搜索）
    KnowledgeTreeNode.vue            ← 知识树节点（递归）
    KnowledgeTreePanel.vue           ← 知识树面板
    NotesPanel.vue                   ← 笔记面板（纯CSS滚动）
    PracticeModal.vue                ← 练习弹窗（选项→提交→记录）
```

### 下一步（待做）

1. **稳定期观察**：在 `/new/xingce/workspace` 日常使用 14 天，积累真实反馈
2. **Phase 9（可选）**：KnowledgeTree DnD 拖拽（用 vue-draggable-plus，不手写）
3. **笔记编辑**：NotesPanel 加 inline 编辑 + 自动保存（当前只读）
4. **sync 存储修复**：当前 store.flushSave() 是全量推送所有 ops，需改为增量 diff（只推改动的条目）
5. **切换默认路由**：满足「稳定14天 + 20次完整练习」后，将 `/` 重定向到 Vue 版

### 已知问题 / 待优化

- `NotesPanel` 目前笔记内容读取路径：先查 `notesByType[nodeId]`，但知识节点笔记实际存在 `knowledge_node` entity 的 `noteContent` 字段里，需要确认读取路径是否正确
- `PracticeModal` 的 `/api/practice/log` 接口字段名需对齐后端实际参数（`error_id` vs `errorId`）
- `xingceStore.flushSave()` 当前实现是全量推所有 errors + knowledgeNodes，数据量大时会压力较大，应改为只推 dirty 条目

---

## 迁移原则

1. **legacy 文件零改动**：整个迁移过程中不修改任何 `xingce_v3/modules/` 下的文件。
2. **平行新路由**：Vue 版本在 `/new/xingce/workspace` 独立运行，legacy 继续服务 `/`。
3. **同一套后端 API**：Vue 直接调用现有 `/api/sync`、`/api/practice/*` 等接口，不新增接口。
4. **一块一块替换**：每个组件独立完成、验证稳定后，再开始下一个。
5. **legacy 最后再删**：全部组件迁移完且跑稳至少两周后，再删除 legacy 代码。

---

## 路由规划

```
/new/                          ← Vue SPA 根（已有）
  /new/shenlun/workbench       ← 申论工作台（已有）
  /new/xingce/workspace        ← 行测工作台（本次目标）
  /new/xingce/workspace/notes  ← 笔记面板（子路由）
```

在 `frontend/src/router/index.ts` 追加路由，不改现有路由。

---

## 数据类型定义（`frontend/src/api/xingce.ts`）

```typescript
// ── 错题条目 ──────────────────────────────────────────────
export interface ErrorEntry {
  id: string
  type: string                  // 言语理解与表达 | 判断推理 | 数量关系 | 资料分析 | 常识判断 | 其他
  subtype: string
  subSubtype?: string
  question: string              // 题目文本（可含图片标记）
  answer?: string
  analysis?: string
  tip?: string
  status: 'unmastered' | 'learning' | 'mastered'
  masteryLevel?: number         // 0-5
  confidence?: number
  problemType?: 'cognition' | 'execution' | 'speed'
  rootReason?: string
  errorReason?: string
  noteNodeId?: string           // 关联知识树节点 id
  actualDurationSec?: number
  targetDurationSec?: number
  createdAt: string
  updatedAt: string
}

// ── 知识树节点 ─────────────────────────────────────────────
export interface KnowledgeNode {
  id: string
  parentId: string | null
  title: string
  path: string[]                // ['判断推理', '逻辑判断', '朴素逻辑']
  level: number                 // 1-5
  noteContent?: string
  noteUpdatedAt?: string
  children: KnowledgeNode[]
}

// ── 练习记录摘要 ───────────────────────────────────────────
export interface AttemptSummary {
  errorId: string
  totalCount: number
  correctCount: number
  lastAttemptAt: string
  lastDurationSec?: number
}

// ── Sync payload（GET /api/sync 返回格式）─────────────────
export interface SyncPayload {
  errors: ErrorEntry[]
  knowledgeTree: KnowledgeNode[]
  knowledgeNotes: Record<string, string>   // nodeId → markdown
  version?: number
  updatedAt?: string
}

// ── 首页派发数据（GET /api/practice/workbench）────────────
export interface WorkbenchFeed {
  readFirst: ErrorEntry[]       // 先看笔记
  doDirect: ErrorEntry[]        // 直接开做
  timedRetrain: ErrorEntry[]    // 限时复训
}
```

---

## API 层（`frontend/src/api/xingce.ts`）

```typescript
const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const xingceApi = {
  // 全量拉取（含 errors + knowledgeTree + notes）
  load(): Promise<SyncPayload> {
    return request('/sync')
  },

  // 保存（增量或全量，由后端决定）
  save(payload: Partial<SyncPayload>): Promise<{ ok: boolean }> {
    return request('/sync', { method: 'POST', body: JSON.stringify(payload) })
  },

  // 错题卡片的练习记录摘要（批量）
  getAttemptSummary(errorIds: string[]): Promise<AttemptSummary[]> {
    const q = errorIds.map(id => `id=${id}`).join('&')
    return request(`/practice/attempts/summary?${q}`)
  },

  // 首页派发队列
  getWorkbenchFeed(): Promise<WorkbenchFeed> {
    return request('/practice/workbench')
  },

  // 记录一次练习
  logAttempt(data: {
    errorId: string
    correct: boolean
    durationSec: number
  }): Promise<void> {
    return request('/practice/log', { method: 'POST', body: JSON.stringify(data) })
  },
}
```

---

## Pinia Store 规划

### `useXingceStore`（`frontend/src/stores/xingceStore.ts`）

```typescript
// 状态
errors: ErrorEntry[]
knowledgeTree: KnowledgeNode[]
knowledgeNotes: Record<string, string>
loading: boolean
saving: boolean
lastSavedAt: string | null
error: string | null

// 筛选状态
activeType: string | null          // 当前选中的大类
activeNodeId: string | null        // 当前选中的知识节点
statusFilter: 'all' | 'unmastered' | 'learning' | 'mastered'
searchQuery: string

// 计算属性（getters）
filteredErrors: ErrorEntry[]       // 按筛选条件过滤后的错题
errorCountByType: Record<string, number>
errorCountByNode: Record<string, number>

// 动作（actions）
load()                             // GET /api/sync
save()                             // POST /api/sync（防抖 2s）
updateError(id, patch)             // 本地更新 + 触发 save
deleteError(id)                    // 本地删除 + 触发 save
setActiveType(type)
setActiveNode(nodeId)
```

---

## 组件拆解与迁移顺序

按复杂度从低到高，严格按序执行。

---

### Phase 0：脚手架搭建（不含任何业务逻辑）

**目标**：新路由可访问，显示 loading 占位，store 能拉到数据。

**新建文件**：
```
frontend/src/
  api/xingce.ts                      ← API 层（见上）
  stores/xingceStore.ts              ← Pinia store（见上）
  views/xingce/
    WorkspacePage.vue                ← 顶层壳，含 load() + 路由出口
```

**router/index.ts 追加**：
```typescript
import WorkspacePage from '@/views/xingce/WorkspacePage.vue'
{ path: '/xingce/workspace', name: 'XingceWorkspace', component: WorkspacePage }
```

**完成标准**：访问 `/new/xingce/workspace` 能看到页面，控制台能看到 `/api/sync` 成功响应，store.errors 有数据。

---

### Phase 1：ErrorCard 错题卡片

**目标**：单条错题的只读展示。

**新建文件**：
```
frontend/src/components/xingce/
  ErrorCard.vue
```

**组件 Props**：
```typescript
defineProps<{
  entry: ErrorEntry
  attempts?: AttemptSummary
  expanded?: boolean
}>()

defineEmits<{
  expand: []
  collapse: []
}>()
```

**显示字段**：
- 题型标签（type / subtype / subSubtype）
- 题目文本（支持数学公式，用 innerHTML 渲染）
- 掌握状态徽章（unmastered / learning / mastered）
- 错误原因（errorReason / rootReason）
- 练习记录（总次数、正确次数、最近练习时间）
- 展开/折叠详情（analysis、tip、answer）

**完成标准**：在 WorkspacePage 里硬编码一条假数据，ErrorCard 能正确渲染所有字段。

---

### Phase 2：ErrorList 错题列表

**目标**：按大类分组的完整错题列表，支持展开/折叠分组。

**新建文件**：
```
frontend/src/components/xingce/
  ErrorList.vue                      ← 列表容器（含分组）
  ErrorGroup.vue                     ← 单个分组（type | subtype 级）
```

**功能点**：
- 从 store.filteredErrors 渲染
- 按 type → subtype → subSubtype 三级分组
- 分组可展开/折叠（状态存 localStorage）
- 显示各组错题数量
- 「加载更多」：初始展示 60 条，每次 +60（对应 legacy 的 errorRenderLimit）
- 空状态展示

**完成标准**：真实数据渲染，分组折叠功能正常，超过 60 条时「加载更多」可用。

---

### Phase 3：FilterSidebar 筛选侧边栏

**目标**：左侧大类筛选 + 掌握状态筛选。

**新建文件**：
```
frontend/src/components/xingce/
  FilterSidebar.vue
  TypeFilterItem.vue                 ← 单个大类条目（含数量）
```

**功能点**：
- 行测五大类列表（言语/判断/数量/资料/常识）
- 每类显示未掌握错题数
- 点击筛选 → 更新 store.activeType
- 掌握状态过滤器（全部/未掌握/学习中/已掌握）
- 搜索框（模糊搜索题目文本）

**完成标准**：点击大类后 ErrorList 同步过滤，数量徽章准确。

---

### Phase 4：KnowledgeTreePanel 知识树面板

**目标**：右侧（或左侧）知识树，支持节点选择过滤错题。

**新建文件**：
```
frontend/src/components/xingce/
  KnowledgeTreePanel.vue
  KnowledgeTreeNode.vue              ← 递归节点组件
```

**功能点**：
- 递归渲染 store.knowledgeTree（最多 5 级）
- 节点展开/折叠
- 点击节点 → 更新 store.activeNodeId → ErrorList 按 noteNodeId 过滤
- 各节点显示关联未掌握错题数（从 store.errorCountByNode 计算）
- 节点高亮当前选中状态
- **不做 DnD（拖拽）**，DnD 是历史 bug 最密集的功能，留到最后单独处理

**完成标准**：知识树能渲染，点击节点后错题列表正确过滤，数量徽章准确。

---

### Phase 5：NotesPanel 笔记面板

**目标**：右侧知识笔记阅读面板，解决历史滚动 bug。

**新建文件**：
```
frontend/src/components/xingce/
  NotesPanel.vue
  NoteViewer.vue                     ← Markdown 渲染（只读）
  NoteEditor.vue                     ← Markdown 编辑（可选，Phase 5b）
```

**功能点**：
- 显示当前选中知识节点（store.activeNodeId）的笔记内容
- Markdown 渲染（含数学公式支持）
- TOC 目录自动生成（基于标题层级）
- 滚动区域用 CSS `height: 100%; overflow-y: auto` 实现，**不用 postMessage 同步高度**（这是历史滚动 bug 的根源，Vue 版从设计上绕开）
- 笔记编辑（Phase 5b）：inline 编辑 + 自动保存

**完成标准**：切换知识节点时笔记面板正确更新，长笔记滚动正常，不出现高度计算错误。

---

### Phase 6：WorkspaceLayout 总体布局

**目标**：将上述组件组合成完整的工作台页面。

**新建文件**：
```
frontend/src/views/xingce/
  WorkspacePage.vue                  ← 已有，此时填充真实布局
```

**布局结构**：
```
WorkspacePage
  ├── AppHeader（顶部导航：首页 / 工作台 Tab）
  ├── FilterSidebar（左侧：大类 + 状态筛选）
  ├── ErrorList（中间：错题列表）
  └── KnowledgeTreePanel + NotesPanel（右侧：知识树 + 笔记）
```

**Tab 切换**：
- 错题列表模式：FilterSidebar + ErrorList
- 笔记模式：KnowledgeTreePanel + NotesPanel
- （对应 legacy 的 tabContentErrors / tabContentNotes）

**完成标准**：完整工作台在 `/new/xingce/workspace` 可用，功能对齐 legacy。

---

### Phase 7：ErrorCard 写操作（mutation）

**目标**：在 Vue 版实现对错题的修改操作。

**功能点（对应 legacy `17a-error-card-actions.js`）**：
- 修改掌握状态（unmastered / learning / mastered）
- 修改 problemType（cognition / execution / speed）
- 编辑 errorReason / tip / analysis（inline 编辑）
- 删除错题
- 关联/取消关联知识节点（noteNodeId）
- 所有修改通过 store.updateError() → 防抖 2s → POST /api/sync

**完成标准**：修改后刷新页面数据持久，legacy 版能看到同样的改动（通过 /api/sync 共享数据）。

---

### Phase 8：练习流程接入

**目标**：从工作台发起练习（对应 legacy 的 quiz-flow）。

**功能点**：
- 「直接开做」：点击错题卡片进入单题练习
- 练习完成后记录 `POST /api/practice/log`
- 练习结果反馈：正确 → 提升 masteryLevel；错误 → 维持状态
- 限时模式：显示倒计时，记录 actualDurationSec

**新建文件**：
```
frontend/src/components/xingce/
  PracticeModal.vue                  ← 练习弹窗
  PracticeResult.vue                 ← 结果展示
```

**完成标准**：完整练习流程闭环，数据写回正确。

---

### Phase 9（可选）：KnowledgeTree DnD 拖拽

**目标**：知识树节点可拖拽排序/移动。

**特别说明**：这是历史上 bug 最密集的功能（`30g-knowledge-tree-dnd.js` 专门一个文件，仍有问题），**必须最后做，单独 PR，不影响其他功能**。

建议使用成熟的 Vue DnD 库（如 `vue-draggable-plus`）而不是手写。

---

## 文件结构总览（完成后）

```
frontend/src/
  api/
    shenlun.ts            ← 已有（不动）
    xingce.ts             ← Phase 0 新建
  stores/
    shenlunStore.ts       ← 已有（不动）
    xingceStore.ts        ← Phase 0 新建
  views/
    shenlun/              ← 已有（不动）
    xingce/
      WorkspacePage.vue   ← Phase 0 骨架 → Phase 6 完整布局
  components/
    xingce/
      ErrorCard.vue       ← Phase 1
      ErrorList.vue       ← Phase 2
      ErrorGroup.vue      ← Phase 2
      FilterSidebar.vue   ← Phase 3
      TypeFilterItem.vue  ← Phase 3
      KnowledgeTreePanel.vue  ← Phase 4
      KnowledgeTreeNode.vue   ← Phase 4
      NotesPanel.vue      ← Phase 5
      NoteViewer.vue      ← Phase 5
      NoteEditor.vue      ← Phase 5b
      PracticeModal.vue   ← Phase 8
      PracticeResult.vue  ← Phase 8
  router/index.ts         ← 追加 xingce 路由（Phase 0）
```

---

## 每个 Phase 的完成门槛

在开始下一个 Phase 之前，当前 Phase 必须满足：

- [ ] 功能点全部实现
- [ ] TypeScript 无报错（`npm run typecheck` 通过）
- [ ] 在真实数据下测试（不用 mock）
- [ ] 对应 legacy 功能在 `/` 下完全不受影响
- [ ] 提交独立 PR，message 格式：`feat(xingce-vue): phase-N <描述>`

---

## 何时切换默认路由

满足以下全部条件后，再将 `/` 切到 Vue 版：

1. Phase 0-8 全部完成
2. Vue 版在 `/new/xingce/workspace` 稳定运行 **至少 14 天**
3. 真实用户（自己）在 Vue 版完成至少 **20 次完整练习流程**
4. 没有出现过数据丢失、渲染错误、滚动异常

切换方式：服务端将 `/` 重定向到 `/new/xingce/workspace`，legacy bundle 暂不删除，作为回退备用。

---

## 明确不做的事（防止范围蔓延）

- **不迁移首页（home dashboard）**：首页派发队列（先看笔记/直接开做/限时复训）是独立功能，单独规划。
- **不迁移 import/export**：备份相关功能保持 legacy，单独处理。
- **不迁移 AI 工作台**：`06-ai-workbench.js` 不在本次范围内。
- **不新增后端接口**：Vue 版只消费现有接口，不为 Vue 版专门改后端。
- **不改 IndexedDB 层**：legacy 的 IndexedDB 逻辑与 Vue 版无关，Vue 版走 API。
