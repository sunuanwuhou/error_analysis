# 画布终极整合版（Phase 1+2+3+4）

## 本次完成
- 运行入口命中 `v51_frontend`
- 错题卡片右上角新增画布入口，与题目区同层
- 题目内容区域支持透明覆盖画布，不跳转页面
- 工具支持：保存 / 撤销 / 重做 / 清空 / 导出图片 / 退出
- 画笔支持：普通笔 / 高亮 / 橡皮擦 / 颜色 / 线宽
- 自动保存与再次打开自动恢复
- 导出 JSON / 模块备份默认带出 `processCanvas` 原始数据、预览图和统计字段
- 新增画布联动总览：统计已有画布题目、保存次数、笔迹数和最近事件
- 做题记录面板新增“回到题卡打开”桥接按钮

## 数据结构
每题新增或扩展：
- `processCanvas.version`
- `processCanvas.strokes`
- `processCanvas.canvasSize`
- `processCanvas.updatedAt`
- `processCanvas.savedAt`
- `processCanvas.previewDataUrl`
- `processCanvas.stats`
- `reviewMeta.canvas`

## 联动说明
- 错题卡片：画布入口、保存状态、恢复
- 导出：沿用错题序列化链路，自动带出画布字段
- 学习记录：本地记录 `canvas_save` / `canvas_export_image` 等事件
- 统计：侧边栏增加“画布联动”入口

## 验收基线
- 页面可见改动必须落在 `v51_frontend`
- 当前页面可直接看到画布按钮与覆盖层
- 导出时 `processCanvas` 不丢失
- 自测包含语法、运行入口、文件名编码


## V2 收敛补充
- 入口位置：题目卡片右上角
- 默认入口：仅保留一个“画布”按钮
- 主工具：撤销 / 清空 / 退出
- 导出：放入“更多”二级菜单
- 画笔：默认单色
- 保存：自动保存
- 状态：未标注 / 自动保存中 / 已保存
- 导出图片：优先包含题目内容与画布笔迹
