# Legacy 入口最终优化说明

当前真实运行入口为 `xingce_v3/xingce_v3.html`，本轮继续优化目标是：

- 保留旧入口可运行性
- 保留拆分后的源码可维护性
- 进一步降低 HTML 主文件复杂度
- 降低静态资源请求数量
- 去掉主入口内联事件绑定，避免结构层直接耦合行为代码

## 本轮新增优化

### 1. Bundle 化静态资源

新增脚本：`scripts/build_legacy_assets.py`

用途：
- 将 `xingce_v3/styles/main/*.css` 合并为 `xingce_v3/styles/legacy-app.bundle.css`
- 将 `xingce_v3/modules/main/*.js` 以及知识树相关模块合并为 `xingce_v3/modules/legacy-app.bundle.js`

这样做的结果：
- `xingce_v3.html` 不再手工引用几十个 CSS / JS 文件
- 线上请求数更少
- 入口页更清晰
- 源文件仍然保留，后续仍可继续维护模块源码

### 2. 去除入口页内联事件

新增模块：`xingce_v3/modules/main/00-event-dispatcher.js`

入口页中原有的 `onclick/oninput/onchange/onkeydown` 已统一替换为 `data-onclick/data-oninput/data-onchange/data-onkeydown`。

调度器会通过事件委托调用原先的全局函数，保持原有交互行为基本不变。

这样做的结果：
- HTML 更干净
- 结构与行为分离程度更高
- 后续继续拆 DOM 片段时不会再把行为逻辑绑在标签上

## 现在的结构

- `xingce_v3/xingce_v3.html`：主页面骨架
- `xingce_v3/styles/main/`：原始拆分样式源码
- `xingce_v3/styles/legacy-app.bundle.css`：生产入口样式包
- `xingce_v3/modules/main/`：原始拆分脚本源码
- `xingce_v3/modules/legacy-app.bundle.js`：生产入口脚本包
- `scripts/build_legacy_assets.py`：Bundle 重建脚本

## 后续维护方式

当你修改：
- `xingce_v3/styles/main/` 下任意 CSS
- `xingce_v3/modules/main/` 下任意 JS
- `xingce_v3/modules/knowledge-*.js`
- `xingce_v3/modules/data-management.js`

都需要重新执行：

```bash
python scripts/build_legacy_assets.py
```

然后再启动后端。
