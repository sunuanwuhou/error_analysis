# 画布热修复说明（2026-04-03）

## 当前运行入口
- v51_frontend

## 本次修改入口
- v51_frontend/assets/process-canvas-ultimate.js
- v51_frontend/assets/process-canvas-ultimate.css

## 本次修复问题
- 修复全局 MutationObserver 导致的整页反复 hydrate + redraw
- 修复 DOM 变化触发自循环，导致页面卡死
- 将画布入口固定到底部操作区，避免顶部布局变化导致入口漂移
- 修复编辑态未同步到 `.pc-stage`，导致工具栏/画布层交互不稳定

## 本次实现
- MutationObserver 改为仅处理新增节点，不再对全页卡片做反复重扫
- 通过 requestAnimationFrame 合并增量刷新
- hydrateCard 不再默认 buildStage / bindCanvas / redraw
- 画布入口改挂 `.card-actions`
- 编辑时才创建并激活画布 stage

## 自测
- node --check process-canvas-ultimate.js 通过
- 代码级检查确认不再在 observer 回调内对 allCards 全量 redraw
- 压缩包中文文件名检查通过


## 追加收敛（V2）
- 入口从底部操作区回到题目右上角
- 默认只显示一个“画布”按钮
- 主工具收敛为：撤销 / 清空 / 退出
- 导出图片改入“更多”二级菜单
- 默认改为单色画笔
- 自动保存状态文案统一为：未标注 / 自动保存中 / 已保存
- 自动保存不再强依赖整页 renderAll 刷新
