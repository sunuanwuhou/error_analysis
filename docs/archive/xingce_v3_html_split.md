# xingce_v3 HTML 拆分说明

真实运行入口 `xingce_v3/xingce_v3.html` 已拆为资源装配页。

- `xingce_v3/styles/main/`：按原页面样式章节拆分
- `xingce_v3/modules/main/`：按原页面脚本章节拆分
- `xingce_v3/modules/mathjax-config.js`：MathJax 配置

拆分策略：保留原 DOM 结构与执行顺序，只把内联 CSS / JS 外提，优先保证兼容性与可继续维护。
