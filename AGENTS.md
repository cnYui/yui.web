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

- 设计稿那只骨骼手（WebXR generic-hand，Apache-2.0）已经上线，SVG 平面手退为回退方案。three.js r184、GLTFLoader 和模型全部自托管：`js/vendor/{three.module.min.js,three.core.min.js,GLTFLoader.js,BufferGeometryUtils.js,SkeletonUtils.js}` + `files/webxr-generic-hand-right.glb`，站点 CSP 是 `script-src 'self'` / `connect-src 'self'`，不能从 CDN 引。
- 注意 `three.module.min.js` 会 `import './three.core.min.js'`，两个都要放；GLTFLoader 还会引 `../utils/{BufferGeometryUtils,SkeletonUtils}.js`。vendor 里只把裸导入 `'three'` 改成同目录的相对路径，其余原样，升级时照做即可（浏览器里没有 import map —— `<script type="importmap">` 是内联脚本，同样被 CSP 挡）。
- 合计 1009 KB / gzip 297 KB，**不进首屏**：`js/clue-wall.js` 在第一次 pointerdown、hover 或聚焦便签时才 `import('/js/hand3d.js')`。窄屏（< 900px）和 `prefers-reduced-motion` 下根本不加载（`skipChoreography()` 直接 return）。加载失败或还没就绪时，SVG 手顶着，取件编排一模一样。
- 3D 手同时还画桌上的道具（马克杯、铅笔、放大镜）和左墙的书柜，用的是第二块 canvas（`#cwPropsCanvas`，z-index 12，压在桌面档案下面）；手自己在 `#cwHandCanvas`（z-index 27，压在被举起的便签上面）。3D 书柜就位后 CSS 画的那个用 `.has-hand3d .cw-bookshelf { display:none }` 藏掉，避免两个叠在一起。
- 被捏住的便签由 `hand3d.js` 每帧用 Web Animations 驱动（不是写 style），所以 `.cw-carried` 在 3D 模式下要把 transition 设成 none，`atLand` 的判定也和 SVG 模式不同。
- `test/home-clue-wall.test.js` 会校验：首页没有同步引 hand3d、clue-wall.js 里是动态 import、vendor 里没有 CDN 或裸导入、glb 文件头是 `glTF`。
