# 首页侦探线索墙实施记录（2026-09-19）

## 来源

- Claude Design 项目「侦探线索墙个人主页」（projectId `02553b80-3d01-442c-84ae-ad3efb32fe9f`），实现文件 `Clue Wall Study.dc.html`，数据 `clue-data.js`，行踪图 `travel-map.html` → `assets/travel-map-v3.png`。
- 设计稿图片都是站内原图的拷贝（逐字节比对确认）；design MCP 单文件上限 256 KiB，行踪图 PNG 被截断，改为用 headless Chrome 以 2x 渲染 `travel-map.html` 并裁出 2600 × 1400，与截断原图可解码部分逐像素一致。

## 实现

- `index.html` + `styles/clue-wall.css` + `js/clue-wall.js` + `js/clue-data.js`；dc runtime（React 模板）改写为静态 HTML 与原生 JS，符合 `script-src 'self'`。
- 墙面缩放系数 `k = max(0.35, min(vw / 1440, vh / 900))`，透视 `1100k`；浮层 1400 × 860 画板按 `k` 缩放，窄屏 < 900px 改为单列滚动排版。
- 打开档案 pushState `#id`，ESC / 回到线索墙按钮在有自身历史记录时走 `history.back()`；直接带锚点进入时关闭只清掉锚点。
- 浮层打开时场景、导航、环境音按钮设为 `inert`，关闭后焦点回到原便签；`prefers-reduced-motion` 下关闭漂移与镜头动画，浮层改为淡入淡出。
- 图片派生到 `images/optimized/clue-wall/`（缩略图 640，墙面 720，行踪图 1100 / 2600，质量 78 / 85），`build-optimized-images.js` 支持过滤词并保留 ICC、去掉 EXIF。

## 验证

- 本地 server.js 下用 CDP 驱动 headless Chrome，对比设计稿与实现：1440 × 900 墙面与 5 份档案逐一截图对比一致；点击展开、ESC 关闭、拖动环视、拖动起点在便签上不误开、锚点直达、键盘 Tab / Enter、reduced motion、390 × 844 触屏与单列排版均通过。
