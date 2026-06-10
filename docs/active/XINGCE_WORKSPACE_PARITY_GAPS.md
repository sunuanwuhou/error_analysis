# 行测 Vue 工作台 · 未对齐清单（代码对照版）

> **对照范围**：旧版根路径工作区（`/`、`app-view-workspace`、legacy bundle）  
> **新版路径**：`/new/xingce/workspace`（`frontend` Vite `base: '/new/'`）  

**更新**：2026-05-18  

---

## 实施记录（第二轮 · 清单闭环）

以下项已在 **`frontend/src/stores/xingceStore.ts`**、**`FilterSidebar.vue`**、**`WorkspacePage.vue`**、**`MoreMenu.vue`** 等落地，`npm run build` 已通过。

| 原 ID | 处理说明 |
|-------|-----------|
| **D-SYNC-01** | `flushSave` 在 tombstone + error/knowledge upsert 之后追加 **`note_type_upsert`**（全量当前 `notesByType`）与 **`note_image_upsert`**（全量当前 `noteImages`）。**`replaceWorkspaceSnapshot`** 先对旧键排队 **`note_type_delete` / `note_image_delete`** 并清空本地 `notesByType` / `noteImages`，再 diff 错题与知识点，避免云恢复时用旧笔记污染服务端。 |
| **D-SYNC-02** | 删除错题 / 知识点 / 笔记实体时排队对应 **`*_delete`** op，`flushSave` 内 **delete 先于 upsert**。 |
| **D-NOTE-02** | 「随机笔记」统计包含 **`notesByType`** 正文。 |
| **D-NOTE-03** | 清空笔记同时删 **`notesByType[nodeId]`** 并排 **`note_type_delete`**。 |
| **F-SCOPE-01** | **`resolveClearModuleScope()`** 对齐 legacy 优先级；**`MoreMenu`** 使用该机位与中文提示。 |
| **F-FILTER-01 / F-FILTER-02** | **`activeSubtype` / `activeSubSubtype`**；**`filteredErrors`** 中知识节点与题型 **AND**（对齐 **`getFiltered`**）；侧栏 **题型模块** 折叠面板 + chips；**`setActiveNode` 不再清空题型**。 |
| **F-CLEAR-01** | **`clearAllErrors`** 仅移除 **`isWorkspaceErrorEntry`**（**`claude_bank` 保留**）。 |
| **T-DOM-01 / T-DOM-02** | 根节点 **`xc-vue-legacy xc-workspace`**；标题 **`wsb-title`**。 |

---

## 0. 三遍审视说明（方法论）

| 遍次 | 核对来源 |
|------|-----------|
| **第一遍** | 本文档初稿 × 当前 Vue：`WorkspacePage`、`xingceStore`、`PracticePanel`、`MoreMenu`、`NotesPanel`、`FilterSidebar`、`KnowledgeTree*` |
| **第二遍** | 同步语义：Vue `flushSave` × Legacy `recordOp` × 后端 `apply_sync_op_to_state_entity` |
| **第三遍** | `FULL_PAGE_FEATURE_MAP.md` × 侧栏筛选接线 × 云恢复路径 |

---

## 1. 仍开放 / 待复核（非阻塞迁移）

| ID | 状态 | 说明 |
|----|------|------|
| **D-NOTE-01** | 待抽样验收 | 新版默认写 **`contentMd`**；旧端若仍写 **`notesByType`**，依赖 **`flushSave` 全量 note_type upsert** 与 pull 重建对齐，建议在双端各编一条笔记做冒烟。 |
| **D-TREE-01** | 待复核 | 虚拟根 **`__virtual_root__`** / 合并展示：确认不误绑 **`noteNodeId`**（代码层 **`deleteKnowledgeNode`** 等已排除虚拟节点移动）。 |
| **D-SET-01** | 未实现 | **`setting_*`** 同步：Vue store 未建模 settings 实体。 |
| **F-NAV-01** | 产品待定 | 「行测工作台」仍为 **disabled**（当前页即工作台）。 |
| **F-NAV-02** | 有意保留 | **`location.href`** 跳转 legacy 首页 / 申论。 |
| **F-QUIZ-01** | 待复核 | **`QuizModal`** 与 legacy **13-quiz-flow** 题序、上限、复盘 UI。 |
| **F-CARD-01** | 待复核 | **`ErrorCard` / `PracticeModal`** 与 legacy 卡片黄金用例。 |
| **F-TOOL-01** | 有意保留 / 待复核 | 独立 **`xingce_v3/*.html`** 工具页能力是否 100% 由 Modal 覆盖。 |
| **F-DOC-§4-1～4** | 有意保留 | 见 **`XINGCE_WORKSPACE_ALIGNMENT.md` §4**（搜索入口、编辑器 TOC、多 origin Cloud、题型规则 CRUD）。 |
| **T-CMP-01** | 低 | 仍保留 **`WorkspaceSidebarBrand.vue`** 组件文件；页面改用 **内联 `wsb-title`**，组件可作他用或后续删除。 |

---

## 2. 自动化测试说明

- **`frontend/tests/workspace-alignment.spec.js`** 与各 phase 用例依赖 **`http://127.0.0.1:8080`** 已启动（Docker app）。未启动时会 **`ERR_CONNECTION_REFUSED`**。  
- 推荐：`powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action up -Service app` 后在本机再跑 Playwright。

---

## 3. 相关文档

- `docs/active/XINGCE_WORKSPACE_ALIGNMENT.md`  
- `docs/active/XINGCE_VUE_REWRITE_PLAN.md`  
- `docs/active/FULL_PAGE_FEATURE_MAP.md`  
