# 行测工作区：新旧版不一致项、优先级与验收

> 路径：旧版 `/` + 工作区视图；新版 `/new/xingce/workspace`  

**未对齐清单（代码对照、持续更新）**：见 [`XINGCE_WORKSPACE_PARITY_GAPS.md`](./XINGCE_WORKSPACE_PARITY_GAPS.md)。

## 当前使用策略（2026-05-05）

- **日常以旧版为主**：本地默认仍走 **`http://127.0.0.1:8080/`**（或当前部署下的根路径工作区），**不切换默认入口**。  
- **新版地址**：`http://127.0.0.1:8080/new/xingce/workspace`（Vue）已实现并与本文档阶段性对齐，**现阶段暂不继续迭代、不视为默认工作台**；需要时再对照本文档与 `XINGCE_VUE_REWRITE_PLAN.md` 恢复推进。  
- **口径**：旧版「将就继续用」；新版保留作并行参考或后续替换候选，避免在无明确需求下改动新版路由或强行迁移用户习惯。

---

> 更新：2026-05-05（P2 推进：Cloud 详情、批量操作、笔记编辑）  
> 更新：2026-05-05（深度代码走读，补充剩余不一致项与完整对齐计划）  
> 更新：2026-05-05（Phase 18：F4/F5/F6/D4/D5/F7 已落地）  
> 更新：2026-05-05（Phase 19：F8/F9/F10、L4 批量改挂载弹窗、笔记双栏编辑预览已落地）  
> 更新：2026-05-05（产品策略：以旧版为主，新版 `/new/xingce/workspace` 暂时冻结迭代）

---

## 1. 不一致项清单（按域分类）

| ID | 域 | 说明 | 目标状态（当前） |
|----|----|------|------------------|
| L1 | 布局 | 主区双块 | 主区双标签，默认「学习笔记」✅ |
| L2 | 布局 | 侧栏品牌与宽度 | 260px + `WorkspaceSidebarBrand` ✅ |
| L3 | 布局 | 错题区壳层 | `ErrorsWorkspacePanel` ✅ |
| L4 | 布局 | 批量改挂载曾 inline | 独立弹窗（`ErrorsWorkspacePanel` + `Teleport`）✅ |
| D1 | 数据 | 全库/全量练习口径 | `PracticePanel` 提示行 ✅ |
| D2 | 数据 | 空虚拟根 | `KnowledgeTree.displayRoots` ✅ |
| D3 | 数据 | 笔记 `contentMd` 优先 | `NotesPanel` ✅ |
| D4 | 数据 | Cloud 时间重复 | 最后推送 / 最后拉取 分字段 ✅ |
| D5 | 数据 | 导出结构 | `xingce_backup_*.json` 含元数据 + `knowledgeNodes` ✅ |
| F1–F7 | 功能 | 见历史版本记录 | 均已对齐 Phase 18 文档 ✅ |
| F8 | 功能 | 知识点重命名 | 树节点 **双击标题** 内联重命名 + `renameKnowledgeNode` ✅ |
| F9 | 功能 | 学习历史 | `HistoryModal` + `GET /api/practice/attempts` ✅ |
| F10 | 功能 | 题型规则 | `TypeRulesModal`（模块说明 + 与旧版自动规则差异说明）✅ |

---

## 2. 优先级与实施状态

| 优先级 | 内容 | 状态 |
|--------|------|------|
| **P0** | 主区双标签 + 错题区壳层、侧栏品牌、随机笔记（F5） | ✅ |
| **P1** | 顶栏/全量口径/笔记源、Markdown 读（F4）、全局搜索选题（F6） | ✅ |
| **P2** | Cloud/批量/导出/Markdown 专业入口（D4/D5/F7）、**笔记双栏编辑预览** | ✅（读+编辑分栏；无浮动 TOC/工具栏插表，见 §4） |
| **P2** | 批量改挂载 **弹窗**（L4） | ✅ |
| **P3** | 全局搜索弹窗、删知识点 | ✅ |
| **P3** | 知识点重命名（F8）、学习历史（F9）、题型规则（F10） | ✅ |

---

## 3. 新旧代码走读对照（关键映射）

| 旧版（Legacy） | 新版（Vue） | 说明 |
|------------------|-------------|------|
| `04-main-area.html` | `WorkspacePage` + `NotesWorkspacePanel` + `ErrorsWorkspacePanel` | 主区 |
| `01-sidebar.html` `openBatchKnowledgeMove()` | `ErrorsWorkspacePanel` 批量模式 →「批量改挂载…」弹窗 | 批量改挂载 |
| `19-history-modal.html` | `HistoryModal.vue` + `/api/practice/attempts` | 学习历史 |
| `21-type-rules-modal.html` | `TypeRulesModal.vue`（说明型；非可编辑规则表） | 题型规则 |
| 知识点重命名 | `KnowledgeTreeNode` 双击 + `xingceStore.renameKnowledgeNode` | 重命名 |

---

## 4. 仍存差异（记录口径）

1. **全局搜索**：侧栏「高级筛选」仍为列表窄化；弹窗搜索为独立入口。  
2. **笔记编辑器**：已有 **编辑态 Markdown | 预览** 双栏；**无**旧版浮动目录（TOC）、插入表格工具条等全量编辑器能力。  
3. **Cloud 多源时间**：旧版可多 origin 列表行；当前仍为单会话推送/拉取时间 + 文案。  
4. **题型自动识别规则**：旧版可编辑顺序规则表；新版 `TypeRulesModal` 为模块说明，**规则 CRUD** 未迁移（可按需接配置接口）。  

---

## 5. Phase 18 / 19 明细索引

- **Phase 18**：F4/F5/F6/D4/D5/F7（见历史提交与 Git）。  
- **Phase 19**：F8（`renameKnowledgeNode`）、F9（`HistoryModal` + API）、F10（`TypeRulesModal`）、L4（批量改挂载弹窗）、笔记双栏编辑预览（`NotesPanel`）。

---

## 6. 本地验收步骤（强制）

1. `cd frontend && npm run build`  
2. 根目录：`powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action up -Service app`  
3. `cd frontend && npx playwright test tests/workspace-alignment.spec.js`  
4. `npx playwright test tests/phase9-selfcheck.spec.js`

---

## 7. 验收记录

**验收日期：** 2026-05-05  

| 项 | 结果 | 证据 / 说明 |
|----|------|----------------|
| 布局一致 | 通过 | 双标签 + 侧栏 + 错题壳层 + 批量挂载弹窗 |
| 数据一致 | 部分通过 | 与 Cloud 多 origin 仍有 §4 口径差异 |
| 功能一致 | 通过（文档列项） | Phase 18+19 清单均已实现；§4 为刻意保留之差异 |
| 构建 | 通过 | `npm run build` |

---

## 8. 实施项汇总（已全部关闭）

| ID | 说明 |
|----|------|
| L4 | `ErrorsWorkspacePanel`：`Teleport` 弹窗 + 叶子下拉 + 应用/取消 |
| F8 | `KnowledgeTreeNode` 双击标题；`xingceStore.renameKnowledgeNode` |
| F9 | `HistoryModal.vue`；`xingceApi.getPracticeAttempts` |
| F10 | `TypeRulesModal.vue`；`MoreMenu` → 侧栏「更多」入口 |
| P2 笔记 | `NotesPanel` 编辑态左右：Markdown 源 / 实时预览 |

---

## 9. 与总计划文档关系

本文件专用于 **工作区页** 新旧对齐；总体路线图仍以 `XINGCE_VUE_REWRITE_PLAN.md` 为准。

**Phase 18 + Phase 19（本文档列出的不一致项）已全部交付**；后续仅 §4 所列增强（多 origin UI、可编辑题型规则表、TOC 等）按产品优先级另排。

**与「当前使用策略」一致**：在明确重启 Vue 工作台迁移前，可不对 `/new/xingce/workspace` 做功能性跟进；文档与代码仍保留供对照与恢复。
