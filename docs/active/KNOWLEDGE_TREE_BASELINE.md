# Knowledge Tree Baseline (Current Freeze)

Last updated: 2026-05-08

## Canonical Root Set

The canonical level-1 roots are:

1. 言语理解与表达
2. 判断推理
3. 数量关系
4. 资料分析
5. 常识判断
6. 其他

## Legacy/Noisy Root Alias Mapping

The following titles must never stay at root level. They should be re-homed under their canonical roots.

- 片段阅读 -> 言语理解与表达
- 数字推理 -> 数量关系
- 数学运算 -> 数量关系
- 和差倍比 -> 数量关系
- 核心思维-纯笔记 -> 数量关系
- 比例法 -> 数量关系
- 混合 -> 数量关系
- 鸡兔 -> 数量关系
- 年龄问题 -> 数量关系
- 容斥 -> 数量关系
- 数列 -> 数量关系
- 数推 -> 数量关系
- 植树问题 -> 数量关系
- 最不利 -> 数量关系
- 逻辑判断 -> 判断推理
- 物理 -> 常识判断
- 未细分 -> 其他
- 未分类 -> 其他

## Temporary Operation Mode (During Manual Cleanup)

To support one-time manual tree cleanup:

- Level-1 node move restriction is temporarily disabled in legacy workspace.
- Target option `一级根层` is enabled in move dialog.

After manual cleanup is confirmed complete, re-enable root move protection.

## Anti-Regression Rules

1. Do not keep duplicate business logic in both `main/knowledge/*` and `modules/knowledge-node-modal.js`.
2. `modules/knowledge-node-modal.js` must behave as compatibility fallback only, and must not override already-registered workspace functions.
3. Any root-alias behavior change must be updated in all active runtimes:
   - legacy (`xingce_v3/modules/main/knowledge/*`)
   - Vue (`frontend/src/stores/xingceStore.ts`)

## Runtime Verification Checklist

After any knowledge-tree behavior change:

1. Rebuild legacy assets.
2. Redeploy app container.
3. Verify served bundles contain expected markers:
   - no `一级节点暂不支持移动` string
   - contains `__ROOT_LEVEL__`
4. Manually test:
   - move level-1 noisy node to root
   - move node under another parent
   - drag-and-drop still works

