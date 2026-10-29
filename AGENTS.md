# AI 协作记忆

历史协作日志已归档到：

- `docs/ai/context/20260616-190048-current-completed-state_CN.md`

后续新增上下文、设计、计划、实施记录和排查日志，继续按时间创建新文件保存到 `docs/ai/context/`，不要把完整日志继续堆进本文件。

## 2026-06-16 订阅池计费规则

- Shop 当前目标计费系统是订阅池美元额度，不是旧人民币按量余额。
- 套餐固定为 29 / 39 / 59 元，对应每日 19 / 29 / 49 美元额度。
- 每日额度按东八区 0 点刷新，当天未使用完不累计。
- 项目只使用 `gpt-5.4` 和 `gpt-5.5`，两个模型三个套餐都可用。
- 官方美元价格固定按 `openai-standard-short-usd-20260616`：`gpt-5.4` 缓存命中输入 `$0.25`、未命中输入 `$2.50`、输出 `$15.00` 每百万 token；`gpt-5.5` 缓存命中输入 `$0.50`、未命中输入 `$5.00`、输出 `$30.00` 每百万 token。
- 第一版不在用户侧暴露长短上下文、Batch、Flex 或 Priority 价格分支；后续如上游账单偏离，再新增价格版本。
- 新规则使用独立美元账本，不能复用 `account_balances.balance_nanos`，不能污染旧人民币余额和历史 `api_charge_records`。

## 2026-06-16 订阅池 MVP 流程

- 新账户仍不自动分配 API key，用户必须找管理员领取邀请码并在登录态兑换。
- 用户必须先提交并通过套餐订单，才可以购买加量包；无有效套餐时后端返回 `SUBSCRIPTION_REQUIRED_FOR_ADDON`。
- 有效套餐期间不能重复提交或审批新的套餐订单，避免低价套餐覆盖高价套餐；重复场景返回 `ACTIVE_SUBSCRIPTION_EXISTS`。
- 加量包余额长期保留，续费和换套餐后也保留；扣费优先级为先扣当天套餐额度，额度用完后再扣加量包。
- 无有效套餐时，即使还有加量包余额，API key 也不可用；续费后加量包继续可用。
- 退款按剩余会员天数计算人民币金额，不按当天已使用额度计算；管理员批准后套餐立即取消，API key 因无有效订阅立即不可用。
- usage 美元扣费必须按 usage 发生时间判断订阅有效性：`started_at <= requested_at < expires_at`。

## 2026-06-17 订阅池老用户真实库迁移

- 一次性脚本为 `scripts/shop-migrate-subscription-legacy-users.js`，默认 dry-run，`--apply` 前自动备份数据库。
- 已确认白名单老用户：`15776812883`、`17371571728`、`19814722044`、`13813756694`、`18014503779`、`15062376174`、`15995436627`、`18367290091`、`13052071067`、`13584052801`。
- 真实库 `/Users/wujianxiang/CodeSpace/yui.web/data/shop.sqlite` 已执行迁移：上述 10 个手机号均为 `sub_29_daily_19_usd`，有效期 `2026-06-17T00:00:00+08:00` 到 `2026-07-17T00:00:00+08:00`。
- 迁移创建 10 条 active `account_subscriptions` 和 10 条 `LEGACY-SUB-*-20260617` approved 订阅订单。
- 其他用户没有 active 订阅，上线后仍是无套餐状态。
- 旧人民币余额、旧人民币扣费记录和旧 usage 不迁入美元账本；`api_usd_charge_records` 迁移后仍为 0，旧 usage 只保留 token 统计。
- 真实库备份为 `data/backups/shop-before-subscription-legacy-migration-20260617-092557.sqlite`。

## 2026-06-17 订阅池合并上线

- `codex/subscription-pool-pricing-design` 已合并到 `main`，合并前订阅池 worktree `npm test` 为 193/193 通过，`git diff --check` 无输出。
- 合并上线计划记录见 `docs/ai/context/20260617-093450-subscription-merge-main-restart-plan_CN.md`。

## 2026-06-17 删除指定 Shop 用户

- 真实库 `data/shop.sqlite` 已删除 12 个手机号账户：`13128220027`、`13260836689`、`13800147777`、`13854390398`、`13954400811`、`13973747031`、`13813166007`、`13974071717`、`18602596069`、`19301367925`、`15279148391`、`13851890418`。
- 同步删除对应会话、余额、充值、账本、订单、邀请码、API key、usage 与扣费记录；目标订单为 `ORDER650350328777`、`ORDER407573319301`、`ORDER367217111004`。
- 删除前备份为 `data/backups/shop-before-delete-12-users-with-keys-20260617-100015.sqlite`；实施记录见 `docs/ai/context/20260617-100218-delete-users-with-keys-implementation_CN.md`。

## 2026-06-18 Shop 首页极简入口

- Shop 首页只作为 Sub2API 的简短介绍和控制台/购买入口，不再承载使用方法说明。
- 首页唯一主按钮为 `/dashboard` 的 Sub2API 入口；不要恢复 `/shop/guide/` 的首页按钮或三张说明卡。
- 设计计划见 `docs/ai/context/20260618-174848-shop-home-sub2api-minimal-entry-design-plan_CN.md`。

## 2026-06-18 shop-flow 旧发 Key 退役测试

- `shop-flow` 测试已按旧业务退役语义调整：旧邀请码生成、旧 API Key 导入、旧兑换发 Key 写路径应返回 `410 SHOP_LEGACY_KEY_ISSUANCE_DISABLED`。
- 历史订单、历史 API Key、加密 reveal、用户隔离和 usage 聚合等只读能力测试，使用 seed 历史数据造数，不再调用旧写接口。
- 后续不要恢复旧发 Key 成功断言；新购买和 Key 发放事实源应放在 Sub2API 侧覆盖。
- 实施记录见 `docs/ai/context/20260618-194554-shop-flow-legacy-retirement-test-fix_CN.md`。

## 2026-06-19 Shop 首页中转站文案

- Shop 首页 hero 只展示 `天才程序员中转站入口`，不再展示 `Sub2API gateway`、`Codex 统一入口` 和旧说明段落。
- 首页按钮仍保留为 `/dashboard` 的 `进入 Sub2API` 入口，避免影响既有控制台跳转。
- 实施记录见 `docs/ai/context/20260619-093448-shop-home-genius-programmer-entry_CN.md`。

## 2026-06-20 Shop 首页图片热区入口

- Shop 首页改为单张背景图入口，页面不再显示旧标题、导航和可见按钮文案。
- 中心“点击进入”使用透明链接热区，仍由 `data-sub2api-link` 注入 Sub2API 公网入口。
- 设计计划见 `docs/ai/context/20260620-204649-shop-home-image-hotspot-design-plan_CN.md`。

## 2026-06-21 公网 502 运维修复

- `aaccx.pw` 的 Cloudflare Tunnel 入口链路是 `cloudflared -> nginx :8080 -> yui.web :4173`。
- 502 根因是 `com.wjx.aaccx.yui-web` LaunchAgent 仍运行旧的 `python -m http.server 8318`，而 nginx 已代理到 `127.0.0.1:4173`。
- 修复方式是让该 LaunchAgent 直接运行 `/opt/homebrew/bin/node /Users/wujianxiang/CodeSpace/yui.web/server.js`，并设置 `PORT=4173`。
- 生产模式下 `ADMIN_TOKEN` 必须为至少 32 字符的强随机值；本次已轮换 `.env` 中旧 9 位弱 token，避免公网服务绕过强密钥校验。

## 2026-06-24 Sub2API 主链路与旧 Shop 退役

- 当前公网主链路为 `Cloudflare Tunnel -> nginx 127.0.0.1:8080 -> Sub2API 127.0.0.1:18080 -> CLIProxyAPI 127.0.0.1:8317`。
- `https://api.aaccx.pw/v1/*` 和控制台前端都经过 Sub2API；控制台前端资源由 Go embed 编进 Sub2API 后端二进制。
- yui.web 的 `/shop` 只保留为 Sub2API 跳转入口，不再维护旧登录、注册、账户、管理后台、计费支付和旧发 Key 页面。
- yui.web 旧浏览器 API 前缀 `/api/auth`、`/api/account`、`/api/admin`、`/api/invites`、`/api/orders` 统一返回 `410 SHOP_LEGACY_API_RETIRED`。
- 后续不要再围绕 yui.web 旧 Shop 控制台做性能优化；无调用方代码应删除或返回明确退役响应。

## 2026-06-25 Shop 入口跳转目标

- `/shop` 中心透明热区入口跳转到 Sub2API `/home`，静态回退链接为 `/home`，服务端默认公网注入为 `https://aaccx.pw/home`。
- 本机 `.env` 的 `SUB2API_PUBLIC_URL` 已同步为 `https://aaccx.pw/home`；若其他生产环境显式设置该变量，也需要保持为 `/home` 目标，否则会覆盖代码默认值。

## 2026-07-09 Shop 入口改跳登录页

- `/shop` 中心透明热区入口已改为跳转 Sub2API `/login`，静态回退链接为 `/login`，服务端默认公网注入为 `https://aaccx.pw/login`。
- 本机 `.env` 的 `SUB2API_PUBLIC_URL` 已同步为 `https://aaccx.pw/login`；若其他生产环境显式设置该变量，也需要同步改为登录页目标，否则会覆盖代码默认值。

## 2026-07-03 Anime 页面真实标题

- `/anime/` 的 31 个卡片标题已从 `Anime Collection N` 占位符替换为视觉识别并确认的真实动漫名称。
- 语言切换不再把卡片标题覆盖为 `番剧收藏 N` 或 `アニメコレクション N`；当前三种语言统一展示同一套真实名称。
- 覆盖测试为 `test/anime-title.test.js`，同时同步生成了 `public-dist/anime/index.html`。

## 2026-07-03 Resume 公开页隐私规则

- `/resume/` 页面依据原始履历 PDF 整理为公开版网页，只展示邮箱、学历、经历、资格、能力摘要和奖项。
- PDF 中的现住所和手机号不直接展示在网页中；原始 PDF 只通过下载按钮提供。
- Resume PDF 站内下载路径为 `/files/WU_JIANXIANG_resume.pdf`，发布构建需要包含 `files/` 目录。

## 2026-09-19 页面脚本外置（CSP）

- `server.js` 对所有页面发送 `script-src 'self'`，页面里不能写内联 `<script>`、`on*` 事件属性或 `javascript:` 链接；页面逻辑放在 `js/` 顶层文件（Tailwind 只扫描 `./js/*.js`），在原位置用同步 `<script src>` 引用。
- `<head>` 首屏预初始化统一使用 `<script src="/js/ui-init.js"></script>`，必须是 `<head>` 里第一个同步脚本；回退语言为中文的页面加 `data-default-lang="zh-CN"`。
- `test/page-csp.test.js` 会在 server.js 下枚举所有公开页面校验上述规则。
- `.js` 响应缓存 7 天，修改已上线的页面脚本（例如文章翻译）时在引用处更新 `?v=` 版本号。
- 实施记录见 `docs/ai/context/20260919-192123-csp-inline-scripts-externalize-implementation_CN.md`。

## 2026-09-19 aaccx.pw 根目录恢复 yui.web

- Mac 上 `/Users/wujianxiang/CodeSpace/yui.web` 于 2026-09-08 被整体删除（废纸篓已清空），旧 node 进程空转导致全站 404；已从本地仓库重新部署到原路径（不是 git 仓库，更新方式为覆盖拷贝），LaunchAgent `com.wjx.aaccx.yui-web` 仍以 `PORT=4173` 运行。`.env` 重新生成了强随机密钥，`data/shop.sqlite` 为新建空库，旧 Shop 数据随目录一起删除。
- 当前公网链路：Cloudflare Tunnel（LaunchAgent `com.sub2api.cloudflared`，配置 `~/.cloudflared/config.yml`）按路径分流：yui.web 路径 -> `127.0.0.1:4173`；`/SKILL.md` -> nginx `127.0.0.1:8081`（`/opt/homebrew/etc/nginx/servers/yui-web-extras.conf`）；其余路径及 `api.aaccx.pw` -> Sub2API Docker（OrbStack，`~/sub2api`）`127.0.0.1:8080`。
- 交给 yui.web 的路径：`/`、`/index.html`、`/404.html`、`/CNAME`、`/custom.geo.json`、带扩展名的 `/images/*`，以及 `files|styles|js|blog|music|anime|travel|projects|resume|skill|shop` 目录。`/images/generations`、`/images/edits` 是 Sub2API 接口，不能交给 yui.web。
- 新增公开目录时必须同步修改 tunnel ingress，否则会落到 Sub2API 的 SPA 兜底页。改 ingress 需要重启 cloudflared：先用新配置另起临时连接器（`--metrics 127.0.0.1:20242`），就绪后 `kill -TERM` 主连接器让 launchd 以新配置拉起，最后再停临时连接器，这样不会中断 Sub2API。改动前的原配置备份为 `~/.cloudflared/config.yml.bak-20260919-193006`。
- Homebrew nginx `*:8080` 上的旧配置（`aaccx-root.conf`、`cliproxy.conf`，上游 18084）已不在公网链路中：`127.0.0.1:8080` 被 OrbStack 的端口转发优先占用。

## 2026-09-19 动漫、音乐页面暂时下线

- `/anime/`、`/music/` 以及 `images/animate`、`images/music_pic`、`images/optimized/{animate,music_pic}` 在 `lib/static-public-policy.js` 中屏蔽（返回 404），所有公开页面的导航入口已去掉，`public-dist` 也不再打包；源码保留，恢复时需同时还原白名单、导航链接和 `scripts/build-public-dist.js`。
- 新增照片统一去除 EXIF（含 GPS）：旅行照片的压缩原图（≤2000px）放 `images/travel/`，页面引用 `images/optimized/travel/*.webp`（1200px、质量 78）；黑客松照片直接使用 WebP。

## 2026-09-19 首页改为侦探线索墙

- 首页 `index.html` 按 Claude Design 项目「侦探线索墙个人主页」的 `Clue Wall Study.dc.html` 实现为 3D 侦探书房：拖动环视，点击便签从原位放大为档案浮层（关于我 / 项目 / 博客 / 履历 / 照片）；打开档案会写入 `#about`、`#projects`、`#blog`、`#resume`、`#photos`，可直接分享，返回键或 ESC 关闭。
- 文件：`styles/clue-wall.css`（墙面按 1440 × 900、浮层按 1400 × 860 排版后整体缩放，窄屏 < 900px 时浮层改为单列滚动）、`js/clue-wall.js`（交互与合成环境音）、`js/clue-data.js`（时间线、文章、照片、奖项、关键词）。首页不再使用 Tailwind、`ui-init.js`、`lang.js` 与主题切换，`js/home.js` 已删除。
- 图片统一引用 `images/optimized/clue-wall/*.webp`，用 `node scripts/build-optimized-images.js clue-wall` 从站内原图生成（脚本现在保留 ICC、去掉 EXIF）；行踪图源图 `images/clue-wall/travel-map.png` 是设计稿 `travel-map.html`（d3 + Natural Earth）的 2x 渲染，改路线要在设计稿里改完再重新渲染。
- 设计稿之外的补充：左上角站内导航（项目 / 博客 / 旅行 / 履历 / 商店）、每份档案右上角的完整页面入口（关于我指向 `https://aaccx.pw/SKILL.md`），履历奖项补上 2026 大阪 Rokid Mini Hackathon 同率第 2 位。

## 2026-09-19 全站图片压缩

- 页面 HTML 与页面脚本只引用 `images/optimized/` 下的 WebP；`images/hackathon`、`images/blog`、`images/profile`、`images/travel`、`images/clue-wall` 等目录只放源图，不进 `public-dist`（`test/build-public-dist.test.js` 会逐页校验图片引用）。
- 派生规格集中在 `scripts/build-optimized-images.js`：旅行 1000px / q72（旅行页头图单独 1600px / q70）、项目 1000px / q76、博客 1400px / q76（`ai-native-hackathon` 1200px）、头像与首页肖像 q80。新增或替换图片后用 `node scripts/build-optimized-images.js <过滤词>` 重建对应任务。
- Cloudflare 会按 `max-age=604800` 缓存图片：同名图片重新压缩后要改引用处的版本号，旅行照片统一由 `js/travel.js` 的 `travelImageVersion` 控制。
- 首页行踪图源图改为 256 色 PNG（1.4 MB → 390 KB，PSNR 47 dB）；图片总量约 26.7 MB → 12.8 MB，项目页 6.6 MB → 1.8 MB。

## 2026-09-21 首页线索墙 v2：取件动画与桌面档案

- 首页按 Claude Design「侦探线索墙个人主页」的 `Clue Wall Study v2.dc.html` 重做：点击便签后，一只手把它从墙上取下来、带到桌前摊开，镜头同时压到桌面；关闭时原路钉回墙上。档案从 5 份扩到 6 份（关于我 / 项目 / 博客 / 履历 / 旅行 / 商店），锚点相应变成 `#about`、`#projects`、`#blog`、`#resume`、`#travel`、`#shop`，旧的 `#photos` 会重定向到 `#travel`。
- 新增内容：项目 25 条带分类筛选（获奖 / 黑客松 / 聚会 / 项目），旅行 26 张带城市筛选，商店档案（Sub2API 通行券），博客卡片点开后在桌上按手稿排版读全文，挂钟改成按本地时间走时。
- 文件：`index.html`、`styles/clue-wall.css`（墙面 1440 × 900、桌上的档案 1280 × 760）、`js/clue-wall.js`（相位编排 + 取件手 + 阅读器）、`js/clue-data.js`、`js/blog-articles.js`。
- `js/blog-articles.js`（约 67 KB）由 `node scripts/build-blog-articles.js` 从 `blog/*.html` 正文和 `js/blog-data.js` 的中文元信息生成，不要手改；博客正文改动后重新跑一次。它不在首屏同步加载，由 `clue-wall.js` 在第一次点开文章时插入 `<script>`。
- 设计稿里的 3D 手（`hand3d.js`）依赖 esm.sh 的 three.js 和 jsDelivr 的 `.glb`，被 CSP 挡住，本次先用设计稿自带的 SVG 手回退路径；当天晚些时候改成自托管，见下一条。
- 行踪图换成 v4：源图 `images/clue-wall/travel-map-v4.png`（比 v3 多了奈良与冲绳），仍用无头 Chrome 2x 渲染设计稿的 `travel-map.html` 再转 256 色 PNG；派生图只保留 1100px 一档（页面最大只显示到 540 CSS px），`travel-map.webp` + `travel-map-1100.webp` 两档共 315 KB 降到 52 KB。
- 首屏体积：文本 gzip 22 KB → 36 KB、图片 150 KB → 224 KB，合计约 172 KB → 260 KB；商店便签用 420px 的 `shop-entry.webp` 而不是 1800px 的店面原图。
- 实施记录见 `docs/ai/context/20260921-174800-clue-wall-v2-desk-implementation_CN.md`。

## 2026-09-21 首页线索墙 3D 手（自托管 three.js）

- 设计稿那只骨骼手（WebXR generic-hand，Apache-2.0）已经上线，SVG 平面手退为回退方案。three.js r184、GLTFLoader 和模型全部自托管：`js/three/{three.module.min.js,three.core.min.js,GLTFLoader.js,BufferGeometryUtils.js,SkeletonUtils.js}` + `files/webxr-generic-hand-right.glb`，站点 CSP 是 `script-src 'self'` / `connect-src 'self'`，不能从 CDN 引。
- 目录叫 `js/three/` 而不是 `js/vendor/`：aaccx.pw 的 Cloudflare 把 `/js/vendor/` 下的一切都拦成 403（连 `.txt` 也拦），源站本身是 200。`js/three/`、`js/lib3d/` 实测都放行，改名比动 WAF 规则安全。
- 注意 `three.module.min.js` 会 `import './three.core.min.js'`，两个都要放；GLTFLoader 还会引 `../utils/{BufferGeometryUtils,SkeletonUtils}.js`。vendor 里只把裸导入 `'three'` 改成同目录的相对路径，其余原样，升级时照做即可（浏览器里没有 import map —— `<script type="importmap">` 是内联脚本，同样被 CSP 挡）。
- 合计 1009 KB / gzip 297 KB，**不进首屏**：`js/clue-wall.js` 在第一次 pointerdown、hover 或聚焦便签时才 `import('/js/hand3d.js')`。窄屏（< 900px）和 `prefers-reduced-motion` 下根本不加载（`skipChoreography()` 直接 return）。加载失败或还没就绪时，SVG 手顶着，取件编排一模一样。
- 3D 手同时还画桌上的道具（马克杯、铅笔、放大镜）和左墙的书柜，用的是第二块 canvas（`#cwPropsCanvas`，z-index 12，压在桌面档案下面）；手自己在 `#cwHandCanvas`（z-index 27，压在被举起的便签上面）。3D 书柜就位后 CSS 画的那个用 `.has-hand3d .cw-bookshelf { display:none }` 藏掉，避免两个叠在一起。
- 被捏住的便签由 `hand3d.js` 每帧用 Web Animations 驱动（不是写 style），所以 `.cw-carried` 在 3D 模式下要把 transition 设成 none，`atLand` 的判定也和 SVG 模式不同。
- `test/home-clue-wall.test.js` 会校验：首页没有同步引 hand3d、clue-wall.js 里是动态 import、vendor 里没有 CDN 或裸导入、glb 文件头是 `glTF`。

## 2026-09-21 案卷墙补齐 11 张照片

- `js/clue-data.js` 的 25 条案卷里原本有 11 条 `img: ''`（OpenClaw 飞书插件、南京 OPC、AI 视频/漫画、上海圣诞黑客松、火山引擎 Force、n8n + 小红书、抖音创作者大赛、南客松 S1、TRAE Friends 南京 / 苏州、2025 AdventureX），桌上的案卷只有文字。源图项目页 `js/projects.js` 一直在用，只是没生成线索墙那一档缩略图。
- 在 `scripts/build-optimized-images.js` 的线索墙任务表里补了这 11 条（640px / q78，和其余案卷图一档），`node scripts/build-optimized-images.js clue-wall` 生成到 `images/optimized/clue-wall/`，合计 364 KB。源图里 `image copy.png` / `image copy 2.png` 这种名字换成了 `douyin-coze.webp` / `xhs-n8n.webp`，与目录里其余 ASCII 文件名一致。
- `js/clue-data.js` 改了内容，`index.html` 里它的版本号抬到 `?v=20260921-4`（同一天另外几次改动已经把线索墙三个文件抬到 -3，Cloudflare 按 `max-age` 缓存）。图片都是新文件名，不涉及缓存。

## 2026-09-29 首页线索墙 GitHub 贡献图

- 首页软木板右下角新增一张只展示的 GitHub 贡献图（`#cwGithub`，样式 `.cw-github`）：不是 `.cw-card`，没有点击、悬停、聚焦，整张 `pointer-events: none`；数据到达前保持透明，取不到数据时一直不显示，墙面其余部分不受影响。
- 数据流：`js/github-contributions.js` 读 `GET /files/github-contributions`（`server.js`），由 `lib/github-contributions.js` 从 GitHub 公开页面 `https://github.com/users/<login>/contributions?from=<年>-01-01&to=<年>-12-31` 拉取并解析，服务端内存缓存 15 分钟；拉取失败时继续给旧数据（响应带 `stale: true`），从没成功过返回 503（前端保持隐藏）。前端每 30 分钟刷新一次，页面在后台时不请求。年份取服务器本地时间的当年，跨年自动换成新一年（年初几周图会很空，属预期）。
- 页面 CSP 是 `connect-src 'self'`，浏览器不能直连 GitHub；接口路径也不能放 `/api/`：cloudflared 只把 `files|styles|js|blog|music|anime|travel|projects|resume|skill|shop` 转给本服务，所以挂在 `/files/` 下，并且不带 `.json` 扩展名，否则 `scripts/check-static-assets.js` 会把它当成缺失的静态文件。
- 公开页面只含公开仓库的贡献：2026-09-29 实测 1,227，而账号主人登录后看到 1,741，差的 514 次来自私有仓库（用截图逐格比对过，365 格里 311 格完全一致，其余是等级刻度随总数移动和私有活动造成的）。想让看板和本人看到的一致，在 GitHub 个人主页的 Contribution settings 里勾选 “Private contributions”（以匿名计数显示），代码和服务器都不用改；不要为此把个人 token 放进服务器。
- 可选环境变量：`GITHUB_CONTRIBUTIONS_LOGIN`（默认 `cnYui`）、`GITHUB_CONTRIBUTIONS_TTL_MS`（默认 900000）。用户名只接受合法的 GitHub 登录名，写错会退回默认并打一条警告。
- 为给卡片腾位置，履历卡上移到 y=452、高度从 270 缩到 250，拍立得上移到 y=500，两者的红线终点与图钉（`index.html` 里 `1525 464`、`1210 507`）同步上移 68px；贡献图卡片钉在软木板右下角 (1096, 722)、宽 584，压住拍立得的下巴。软木板这一带已经没有空位，再往上加东西先看布局。
- 测试：`lib/github-contributions.test.js`（解析与缓存）、`test/github-contributions-endpoint.test.js`（接口与隧道前缀）、`test/github-contributions-card.test.js`（卡片在假 DOM 里的行为与“只展示”约束），仿 GitHub 的假 HTML 由 `test/helpers/github-calendar-fixture.js` 生成。
- `index.html` 里 `clue-wall.css` 与新脚本的版本号都是 `?v=20260929-1`；改这两个文件时先看线上已经请求过哪些版本号，别复用。

## 2026-10-10 首页线索墙三语（中 / 英 / 日）

- 子页面本来就有三语（`js/lang.js`）；本次补的是首页线索墙。右上角工具栏新增分段切换器 `中文 · EN · 日本語`，层级高于桌上的档案，读档案时也能直接切；窄屏档案铺满屏幕时环境音按钮收起，只留语言切换。
- 语言取值：存储里的选择 → 浏览器语言（`zh*` / `ja*`，其余英文）。存储 key 是 `yui-portfolio-lang`，和子页面共用；检测结果不写回存储，只有点切换器才写。子页面首次访问（没存过语言）仍默认英文，首页按浏览器语言判断，两边的默认值没有统一。
- 文件：`js/clue-lang-init.js`（`<head>` 里第一个同步脚本，首屏前定语言，非中文先藏墙，CSS 有 1.5 秒兜底）、`js/clue-i18n.js`（词典 + 引擎）、`js/blog-articles.en.js` / `.ja.js`（文章译文包，切到该语言后点开文章才加载）、`test/home-i18n.test.js`。
- `index.html` 里写的仍是中文（无脚本 / 爬虫看到的版本），节点带 `data-i18n="键"`；词典 `TEXT` 里每个键同时写 zh / en / ja，测试会校验 HTML 中文和词典 zh 逐字一致。改首页文案要两边一起改，别只改 HTML。`js/clue-data.js` 仍是中文，英日文按下标写在 `DATA.en` / `DATA.ja`，新增项目 / 照片 / 文章卡片要同一下标补译文。
- 博客文章正文：有英日译文的（文章页 `js/blog-<slug>.js` 的 `articleLocales`）用译文，没有的退回中文并在稿纸顶上提示；`node scripts/build-blog-articles.js` 现在一次生成中 / 英 / 日三个文件。
- 衬线体 `'Noto Serif SC'` 在 `styles/clue-wall.css` 里只在 `--cw-serif` 定义一处，日文时换成本机日文明朝体；别再往样式里写死这个字体名（测试会拦）。
- `js/resume-download.js`（首页和 `/resume/` 共用的口令对话框）现在自带三语词典，按 `<html lang>` 取词；两个页面引用它的 `?v=` 必须一致（`resume/index.html` 也要跟着改）。
- 实施记录见 `docs/ai/context/20261010-160500-clue-wall-i18n-en-ja-implementation_CN.md`。

## 2026-10-13 首页线索墙卡片：一张一个大标签，只用一种语言

- 墙上每张便签只留一个大标签（关于我 / 项目 / 博客 / 履历 / 旅行 / 商店，毛笔体）加一两行关键信息；`FILE 01`、`CASE TIMELINE`、`CONFIDENTIAL`、`SUBJECT` 这类侦探味的二级文字和印章已经删掉，别再加回去。文案只用当前语言写一遍，三语靠词典：`test/home-i18n.test.js` 的「墙上和档案页头的文案是单一语言」会拦住 zh / ja 里 4 个以上大写字母的英文标签、en 里夹汉字假名（品牌和证书名在测试里登记白名单）。
- 便签里的数字（项目数、奖项数、文章数）不要写死：由 `js/clue-wall.js` 的 `renderStats()` 数 `clue-data.js`，词典模板用 `{n}` / `{a}`；`index.html` 里的静态中文数字有测试核对。新增项目或文章后页面自己会变，只要补同下标的英日译文。
- 档案标题和墙上便签的大标签是同一个词（测试守着），手里举着的封面只有这一个标题，直接按便签标签的词典键取词（`COVERS[...].key`）。
- 大标签字号按语言微调（`styles/clue-wall.css` 里的 `:lang(en)` / `:lang(ja)` 覆盖块）：毛笔体里拉丁字母偏小要放大，日文假名占整格、窄便签上要缩小；新增语言或改标签文字后用 `scrollWidth > clientWidth` 探针把三种语言各扫一遍。
- GitHub 贡献图卡片只留 `GitHub` + 总数 + 单位 · 年份和方块图，单位走词典；月份、星期、图例、同步时间已删。
- 档案里面的分节标签（`教育 · EDUCATION`、`姓名 NAME`）和数据字段（`city` 的 `大阪 Osaka`、案件徽章 `2ND PLACE`）仍是中英并排，这次没动。
- 实施记录见 `docs/ai/context/20261013-173520-clue-wall-card-clarity-implementation_CN.md`。

## 2026-10-14 首页线索墙：去掉肖像卡，便签可拖动，红线由访客自己连

- 墙上没有肖像卡了（它和「关于我」指向同一份 `#about`），个人介绍只剩「关于我」一个入口；别再加回去。肖像照片仍在「关于我」档案里。墙上点得开的便签是 6 张。
- 红线和图钉不再写死在 `index.html`：红线由访客点两枚不同的图钉拉出（再点同一对剪断），默认墙面没有任何线。交互全在 `js/clue-board.js`：墙上每张纸（便签、联系卡、拍立得、GitHub 贡献图）都能按住拖动，图钉跟着走，点一下仍是打开；联系卡、拍立得、贡献图只能拖和连线，点不开。
- 新增一张纸时在 `index.html` 里给它写 `data-pins`（颜色 + 可选位置，见脚本顶部注释）和 `data-tilt`（必须等于样式里的 `rotate()`，`test/home-clue-board.test.js` 会核对），不用再手算图钉坐标。
- 屏幕位移到软木板位移靠四个角上的隐形探针（`.cw-probe`）每帧现解单应矩阵，别改成直接除以缩放系数：墙面被 3D 镜头拍着，那样在镜头转过的角度下会漂。不持久化，刷新回到默认布局。
- 默认布局（`styles/clue-wall.css` 里各纸的 `left` / `top`）：「关于我」居中，博客、联系卡、拍立得排在左列。
- 实施记录见 `docs/ai/context/20261014-110420-clue-wall-draggable-pins-implementation_CN.md`。

## 2026-10-14 首页线索墙：子页面（档案）重做

- 点开便签后的档案统一成一个骨架：返回键 + 大标题 + 一块可滚动的内容区 `.cw-pane`。别再往里加印章、胶带、倾斜的小纸片、分类标签和红线图钉；这次专门去掉了它们。纸摊开后按 `sheetScale()`（窗口宽、高各算一个取小）缩放，档案里的字号设计尺寸下不小于 17px，`test/home-clue-files.test.js` 会拦住更小的字。
- 履历是两张 A4（宽 800、`min-height` 1131）；项目是时间线，一个节点一场比赛、正好占满内容区（616px）、`scroll-snap` 一格翻一个，获奖节点靠 `cat === 'award'` 标红，不分类；旅行是路线图 + 两列大照片，不分城市。新增项目 / 照片只要往 `js/clue-data.js` 加一条（并补同下标的英日译文），页面自己会排。
- 内容区在窄屏（< 900px）改成不自己滚、由整张纸滚，字号单独按手机设置；改桌面字号时别忘了窄屏那一段。
- 实施记录见 `docs/ai/context/20261014-114017-clue-wall-dossier-redesign-implementation_CN.md`。

## 2026-10-28 首页改为侘寂竖排单屏

> 已被 2026-10-29「全站侘寂版」取代：深色金缮首页、`styles/home.css`、`js/home.js` 都已删除，下面只作历史记录（线索墙源码的保留约定仍有效）。

- 首页 `index.html` 按 Claude Design 画布「侘寂个人网站 · 三稿」的「壹 · 挂轴」版式重写，配色取「贰 · 金缮」：底 `#1E1D1A`、正文 `#D2CCC0`、次要字 `#9A9488`，金色 `#B0925A` 只用在落款圆点、链接悬停和键盘焦点上。
- 只有一屏、全部竖排、从右往左读：姓名 → 四句介绍（散らし書き 错落起笔）→ 邮件 / GitHub / SKILL.md → 金色落款；左下角是项目 / 博客 / 履历 / 旅行 / 商店入口，左上角是中 / 日 / EN 切换。手机号、肖像、奖项、照片不再上首页，别再往首页加内容，细节放子页面。
- 文件：`index.html`、`styles/home.css`、`js/home.js`。三种语言的文案都写在页面里，`html[lang]` 决定显示哪一种（`[data-l]`），改文案时三种语言一起改，`test/home.test.js` 会校验数量一致。`js/home.js` 是 `<head>` 里唯一的同步脚本，和子页面共用 `yui-portfolio-lang`，只有点击切换器才写回；旧线索墙锚点（`#projects` 等）由它转到对应子页面。
- 线索墙源码（`styles/clue-wall.css`、`js/clue-*.js`、`js/hand3d.js`、`js/three/` 等）暂时保留但首页已不引用，对应的 5 个首页测试已删除；其他线索墙分支收尾后再删源码。要恢复线索墙，从 `8326841` 取回 `index.html` 和那 5 个测试。
- 实施记录见 `docs/ai/context/20261028-224639-home-wabi-vertical-implementation_CN.md`。

## 2026-10-29 全站侘寂版（首页挂轴 + 子页横排 + 三语 + 节气 + 墨洇）

- 设计源：Claude Design 画布「侘寂个人网站 · 三稿」（https://claude.ai/artifact/CikB6gVL1Caobt9NQvBkgC），首页按 `Home.dc.html`（甲 · 竖排），所有子页面按 `*-B.dc.html`（乙 · 横排）。纸色 `#f0eee8`、墨色 `#25231f`、次要字 `#66625a`、细线 `#dad6cd`、金色 `#917347` 只用于圆点、当前页标记和焦点框；字体只有霞鹜文楷 TC（Google Fonts）。不要再加深色模式、卡片、阴影、筛选器、计数器或「加载更多」。
- 文件：`styles/wabi.css` 是全站唯一样式表；`js/site.js` 必须是每个公开页面 `<head>` 里第一个同步脚本（`test/page-csp.test.js` 会查）。旧的 `ui-init.js`、`lang.js`、`theme.js`、`mobile-menu.js`、`styles/site.css` 只剩下线的动漫、音乐页面在用，新页面别再引用。
- 三语：文案写三份 `<span data-l="zh|ja|en">`，`<html data-title-zh/ja/en>` 给标题；改文案三种语言一起改，测试核对数量。脚本渲染的内容（`js/blog-index.js`、`js/travel.js`、文章的 `js/blog-<slug>.js`）监听 `languageChanged` 重排，取当前语言用 `window.YuiSite.getLang()` / `window.YuiLang.getCurrentLang()`。
- 日期：中文、日文都用汉字数字（二〇二六年九月十八日、十月十日、十二分钟），英文用 Sep 18, 2026。节气不要写死：`[data-season="line"]`（页脚年份 + 节气）、`[data-season="mark"]`（首页落款：节气 + 候）由 `js/site.js` 按日期推算填字。
- 墨洇：`<main>` 里的文字块进入视野时一个字一个字洇开，自动生效；某块不想要就加 `data-ink-skip`。新增的块级文字元素用 h1–h4 / p / li / dt / dd / figcaption，图片、`pre`、`table` 会整块淡入。
- 首页只放五列介绍（做视频，／讲一点 AI，／也写代码。／做有人类温度的产品，／极度克制的审美。）、作品（四个黑客松获奖作品）、茶叙、联系方式，不放手机号和图片；「住在日本」已按用户要求删去。联系里 bilibili、抖音、note 还缺地址，拿到后再加。
- 行旅照片数据在 `js/travel.js`，每条要写 `w` / `h`（图片实际像素）和 zh / ja / en 标题说明，有日期的写 ISO `date`。
- 实施记录见 `docs/ai/context/20261029-113156-wabi-site-redesign-implementation_CN.md`。

## 2026-10-29 行旅页「此刻」（iPhone 推城市级位置）

- 用户要求：iPhone 发定位、只公开到城市级、在现有行踪图上打点。行旅页照片列表上方的「此刻」（`#now`）读 `GET /travel/now`，在 `images/optimized/clue-wall/travel-map-v4.webp`（褪成墨色）上点一个金点，下面一行「此刻在 大阪市　三小时前」；没有数据、`hidden`、或者三十天没更新时整块不显示。
- 写入：iPhone 快捷指令 `POST /travel/now`，头 `Authorization: Bearer <NOW_LOCATION_TOKEN>`，JSON `{ lat, lon, city }`；`{ "hidden": true }` 收起。坐标写盘前四舍五入到 0.1°，原始坐标不落盘；存在 `data/now-location.json`。口令错八次限流十分钟；没配 `NOW_LOCATION_TOKEN` 时写入返回 503。
- 接口挂在 `/travel/` 下而不是 `/api/`：cloudflared 只把固定前缀转给 yui.web，所以不用改 tunnel。
- 点的位置按墨卡托投影算，常数在 `js/travel-now.js`，用图上四个标记点拟合；换行踪图要重新拟合。落进标题框、图例或长三角放大图的位置不画点。
- 快捷指令的设置步骤见 `docs/ai/context/20261029-134128-travel-now-location_CN.md`。

## 2026-10-29 首页茶叙（飞书预约）

- 首页「作品」和「联系」之间加了「茶叙」（`#coffee-chat`），照 stv.pm 的 Coffee chat 区块：右边竖排说明和「新窗口打开」，左边直接 iframe 嵌飞书预约页（`https://<租户>.feishu.cn/scheduler/embed/<id>`），新窗口链接是去掉 `/embed` 的同一个预约。只有这张卡片横排。
- 不能用飞书给的 `scheduler-inline-widget` 脚本（第三方脚本被 `script-src 'self'` 挡），所以手写 iframe；`server.js` 的 CSP 加了 `frame-src https://*.feishu.cn`。换成 Lark（larksuite.com）预约页时要同步改这条。
- 飞书预约页窄于约 360px 会切掉日历最右一列，所以手机上卡片去掉页边距通栏显示。
- `test/home.test.js` 会校验 iframe 和新窗口链接是同一个预约、CSP 放行飞书。
