# 项目结构调整说明

## 本次调整目标
- 把前端工作台从“大页面总控”拆成更清晰的壳层、弹层、移动端交互层。
- 把后端 `app/main.py` 顶部的配置、数据库、认证、请求模型拆分到独立模块。
- 在不改接口协议的前提下，为主工作台补齐移动端布局和抽屉式导航。

## 前端新增结构

```text
frontend/src/features/workspace-shell/
├── components/
│   ├── WorkspaceAuxiliaryDialog.vue
│   ├── WorkspaceMobileHeader.vue
│   ├── WorkspaceMobileTabbar.vue
│   ├── WorkspaceQuickCreateDialog.vue
│   └── WorkspaceSidebarDrawer.vue
├── composables/
│   └── useWorkspacePage.ts
└── constants/
    └── workspace-shell.ts
```

### 说明
- `WorkspacePage.vue` 只负责页面编排。
- `useWorkspacePage.ts` 集中管理 tab、抽屉、弹层、移动端断点、初始化逻辑。
- 移动端新增：顶部工作台头部、侧边抽屉、底部 tab bar。

## 后端新增结构

```text
app/
├── config.py
├── database.py
├── runtime.py
├── schemas.py
├── security.py
└── main.py
```

### 说明
- `config.py`：路径、运行模式、AI 路由、常量。
- `database.py`：数据库连接和建表。
- `security.py`：密码、session、账号创建、token 用户解析。
- `runtime.py`：origin、https、运行环境标签、隧道地址读取。
- `schemas.py`：所有 Pydantic 请求模型。
- `main.py`：保留 FastAPI 应用装配、业务函数和接口。

## 移动端适配策略
- 宽度 <= 1080px 时，主工作台从双栏切到单栏。
- 左侧知识树切为抽屉式导航。
- 快速录题、统计、AI 等辅助面板切为响应式弹层。
- 顶部工具条按钮、筛选条、状态按钮改为横向滚动，避免拥挤换行。
- 笔记区、错题列表、统计区域在移动端统一单列展示。
