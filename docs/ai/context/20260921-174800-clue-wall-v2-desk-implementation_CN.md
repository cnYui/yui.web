# 首页线索墙 v2：取件动画与桌面档案

## 背景

- 设计稿：Claude Design 项目「侦探线索墙个人主页」（projectId `02553b80-3d01-442c-84ae-ad3efb32fe9f`），实现文件 `Clue Wall Study v2.dc.html`，数据 `clue-data.js`、`blog-articles.js`，行踪图 `travel-map.html` → `assets/travel-map-v4.png`。
- v1（2026-09-19）是「点击便签 → 便签原地放大成全屏浮层」。v2 把交互换成实体动作：一只手伸过来把便签从墙上取下、带到桌前放平，镜头同时从看墙压到看桌；关闭时原路钉回墙上。
- dc runtime 是 React 式模板（`{{ }}`、`sc-if`、`sc-for`），站内改写成静态 HTML + 原生 JS，符合 `script-src 'self'`。

## 做了什么

### 交互与相位

- `js/clue-wall.js` 用一个相位状态机描述取件：`reach → grab(650ms) → carry(900) → land(1980) → sheetFull(2060) → retreat(2200) → open(2800)`；关闭是 `closing → grab2(560) → return(780) → release(1820) → retreat(1980) → idle(2600)`。时间点与设计稿一致。
- 手的落点按「捏住纸的下缘偏左」（`PINCH = { ax: -0.15, ay: 0.38 }`）反推：先算出便签在墙上的真实尺寸（从带倾角的外接矩形反解），再让手腕朝向手臂入场的右下角。
- 镜头分两套：墙面用拖动得到的 `rx / ry`；桌面用 `deskCamera()` 按视口算出的俯视距离，保证桌子远边不会穿出画面顶端、近边不会顶到天花板。
- 被取走的那张便签（`data-card`）在 `grab` 之后加 `is-lifted` 淡出，手里举着的封面（`.cw-carried`）接管，落桌后再交给正式档案。同一份档案的不同便签（肖像、行踪图）各有自己的封面，找不到就退回该档案的封面。

### 内容

- 6 份档案：关于我 / 项目 / 博客 / 履历 / 旅行 / 商店。锚点 `#about`、`#projects`、`#blog`、`#resume`、`#travel`、`#shop`；v1 的 `#photos` 在 `fileFromHash()` 里重定向到 `#travel`，老链接不会失效。
- 项目 25 条 + 分类筛选，旅行 26 张 + 城市筛选，筛选标签用事件委托，`test/home-clue-wall.test.js` 会校验每个标签都能选出东西。
- 博客卡片点开后在桌上按手稿排版读全文：左侧案卷封面（标题 / 日期 / 头图 / 摘要 / 标签），右侧可滚动的报告正文，支持 h2 / h3 / 段落 / 图片 / 代码 / 有序无序列表 / 引用 / 表格 / 分隔线。文章从被点的卡片位置长出来，模糊转清晰。
- 挂钟改成按本地时间走时：60 格刻度 + 数字 + 秒针，角度用「今天已过的秒数」推，跨整点时指针不会倒转。

### 文章数据

- `js/blog-articles.js` 由 `scripts/build-blog-articles.js` 生成，不手抄。它从三种正文来源提取：HTML 里的 `#articleBody`、`js/blog-<slug>.js` 的 `articleLocales.zh.body`、以及 `<article>` 里没有 id 的 `.prose`；元信息取 `js/blog-data.js` 的中文字段，标签取 `#articleTags` 或 locale 的 `tags`。
- 生成结果 67.5 KB / 6 篇 / 344 个块，图片全部指向站内 `images/optimized/`（设计稿里是 `https://aaccx.pw/...` 的外链）。
- 首屏不加载它：`clue-wall.js` 在第一次点开博客档案或文章时才插入 `<script src="/js/blog-articles.js?v=...">`。

### 行踪图

- 设计稿的 `assets/travel-map-v4.png` 超过 design MCP 的 256 KiB 单文件上限（只能取到前 192 KB，PNG 没有 IEND），所以沿用 v1 的做法：把设计稿的 `travel-map.html` 用无头 Chrome 以 2x 渲染，裁出 2600 × 1400 再转 256 色 PNG（553 KB，PSNR 45.8 dB）。
- v4 比仓库里的 v3 多了奈良与冲绳：卡图小标题从「…京都 · 广岛」变成「…京都 · 奈良 · 广岛 · 冲绳」，并多了福井 → 冲绳的旅行虚线。
- 派生图只保留 1100px 一档（页面最大只显示到 540 CSS px），旧的 `travel-map.webp`（2600px，255 KB）+ `travel-map-1100.webp` 两档换成 `travel-map-v4.webp` 一档 52 KB。新文件名同时绕开 Cloudflare 的 7 天图片缓存。

## 取舍

- **3D 手没有实现。** 设计稿的 `hand3d.js` 从 esm.sh 引 three.js、从 jsDelivr 拉 WebXR `generic-hand/right.glb`，被站点 CSP 的 `script-src 'self'` 和 `connect-src 'self'` 挡住。线上用的是设计稿自带的 SVG 手——设计里 `svgHandOpacity: s.hand3d ? 0 : 1` 那条回退路径，取件编排、捏点、落点完全一致，只是手本身是平面的。要上 3D 手需要自托管 three.js（365 KB）、GLTFLoader（115 KB）和 `right.glb`（94 KB），合计约 574 KB / gzip 约 145 KB，建议放 `js/vendor/` 与 `files/` 并改成首次点击便签后再懒加载。
- 同样因为没有 three.js，设计稿里由 `hand3d.js` 画的桌面道具（马克杯、铅笔、放大镜）和左墙的 3D 书架没有实现；桌面上 CSS 画的绿色台面、铜牌、案卷、照片、备忘条都在，左墙保留 v1 的 CSS 书架。
- 窄屏（< 900px）与 `prefers-reduced-motion` 下跳过整套取件动画，档案直接铺满屏幕单列滚动，手和封面不出现。

## 验证

- `npm test`：80 项 79 过。唯一失败的 `Resume 页面所有 data-i18n key 都有中英日翻译` 在改动前的 `HEAD` 上同样失败（用 `git worktree` 检出 HEAD 复现过），与本次无关。
- `test/home-clue-wall.test.js` 按 v2 重写：6 份档案与便签一一对应、每份都有带 id 的标题、8 张便签的 `data-card` 不重复且都能解析出封面、筛选标签都能选出内容、每篇博客都有手稿且图片在站内、`blog-articles.js` 不在首屏同步加载。
- `node scripts/build-public-dist.js` + `node scripts/check-static-assets.js` 通过，`js/blog-articles.js` 和 45 张 clue-wall 派生图都进了 `public-dist`。
- 浏览器实测（本地起带线上同款 CSP 的静态服务器）：墙面、取件动画、6 份档案、项目 / 旅行筛选、文章阅读器、375 × 812 窄屏都走了一遍，控制台无报错，首屏只有 6 张图 + CSS/JS。

## 体积

| | v1 | v2 |
| --- | --- | --- |
| 首屏文本（gzip） | 22.0 KB | 36.4 KB |
| 首屏图片 | 149.9 KB | 223.8 KB |
| 合计 | 172.0 KB | 260.1 KB |

- 商店便签用 420px 的 `shop-entry.webp`（35 KB）而不是 1800px 的店面原图（310 KB）；店面大图只在商店档案里懒加载。
- `images/optimized/clue-wall/` 从 21 张 / 约 1.4 MB 变成 46 张 / 1.9 MB。

## 后续：3D 手上线（同日）

- 设计稿那只骨骼手已经实现，SVG 手退为回退方案，详见 AGENTS.md「2026-09-21 首页线索墙 3D 手（自托管 three.js）」与 PR #45。
- 上面「取舍」里关于 3D 手体积的估算（574 KB / gzip 145 KB）是错的：漏了 `three.core.min.js`（minified build 拆成两个文件）和 GLTFLoader 依赖的两个 utils，而且 `.glb` 几乎压不动。实测 1009 KB / gzip 297 KB。
- 因此没有放进首屏：第一次 pointerdown、hover 便签或聚焦便签时才动态 import，窄屏与 `prefers-reduced-motion` 下完全不加载。
