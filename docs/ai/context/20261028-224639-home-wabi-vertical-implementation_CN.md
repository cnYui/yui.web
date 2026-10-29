# 首页改为侘寂竖排单屏：实施记录

日期：2026-10-28
分支：`claude/home-wabi-vertical`（从 `origin/main` 8326841 拉出）

## 需求

用户在 Claude Design 画布「侘寂个人网站 · 三稿」里选了「壹 · 挂轴」的版式，要求换成「贰 · 金缮」的配色，并用它重写 aaccx.pw 首页：只保留最基本的信息，画面里的内容极度克制，展示的内容极度压缩，最直观地说明「我是谁」。

## 做了什么

- `index.html` 整页重写，只有一屏、全部竖排，从右往左读：
  1. 姓名「悠一」+ 小字 YUI；
  2. 四句介绍，用散らし書き 的方式错落起笔：AI 原生开发者 / 福井大学研究生 / 在 AI Mage 实习 / 接受远程工作（最后一句用次要色）；
  3. 联系：邮件、GitHub（`cnYui`）、SKILL.md；
  4. 金色落款圆点；
  5. 一条极淡的竖线（床柱）把左边的留白隔开；
  6. 左下角是项目 / 博客 / 履历 / 旅行 / 商店五个子页面入口，左上角是中 / 日 / EN 切换。
- 配色取金缮：底 `#1E1D1A`，正文 `#D2CCC0`，姓名 `#E4DFD4`，次要字 `#9A9488`，床柱 `#34312C`，金色 `#B0925A` 只用在落款、链接悬停和键盘焦点上；底上叠一层透明度 0.1 的噪点（CSS 里的 SVG data URI，CSP 的 `img-src` 允许 `data:`）。
- 字体：Google Fonts 的 Noto Serif SC（中文、英文）和 Noto Serif JP（日文），300 / 400 两档。隐藏语言的文字不渲染，所以只会下载当前语言用到的字形分片。
- 三种语言的文案都写在页面里，`[data-l]` 默认隐藏，`html[lang]` 决定显示哪一种；换语言不改 DOM，没有闪烁，脚本失败时停在默认中文。
- `js/home.js`（`<head>` 里唯一的同步脚本）：
  - 语言：存储（`yui-portfolio-lang`，和子页面共用）→ 浏览器语言（zh / ja，其余英语）；只有点击切换器才写回存储。
  - 旧线索墙的分享锚点 `#projects`、`#blog`、`#resume`、`#travel`、`#photos`、`#shop` 直接 `location.replace` 到对应子页面；停在首页时改锚点由 `hashchange` 处理。`#about` 不转。
- 手机号、肖像、奖项、时间线、照片、GitHub 贡献图、环境音都不再出现在首页；它们各自的子页面还在。

## 线索墙源码的处理

首页不再引用线索墙，但这些文件这次**没有删**：`styles/clue-wall.css`、`js/clue-data.js`、`js/clue-i18n.js`、`js/clue-lang-init.js`、`js/clue-wall.js`、`js/clue-board.js`、`js/hand3d.js`、`js/three/`、`files/webxr-generic-hand-right.glb`、`js/github-contributions.js`、`js/resume-download.js`（简历页还在用）、`js/blog-articles.js`，以及 server.js 里的 GitHub 贡献图接口。

原因：主工作区和其他 worktree 里还有正在进行的线索墙改动（例如新博客文章同步改 `js/clue-data.js`、`js/blog-articles.js`），这时删文件会让它们的分支产生修改 / 删除冲突。等这些分支收尾后再统一删除。

只测旧首页结构的 5 个测试已删除：`test/home-clue-board.test.js`、`test/home-clue-files.test.js`、`test/home-clue-wall.test.js`、`test/home-i18n.test.js`、`test/github-contributions-card.test.js`。要恢复线索墙，从 8326841 取回 `index.html` 和这 5 个测试即可。

## 测试

- 新增 `test/home.test.js`（8 个）：只同步加载 home.js、样式只有 home.css 和 Google Fonts、竖排、配色、三种语言一一对应、子页面入口和联系方式齐全且没有手机号、首屏语言判定、切换器写回、旧锚点跳转（含 hashchange）。
- `test/resume-download-endpoint.test.js`：首页不再有简历下载入口，第三个用例改为只校验简历页。
- `test/page-csp.test.js`：只更新了一句注释。
- `npm test`：除了改动前就失败的「Resume 页面所有 data-i18n key 都有中英日翻译」，其余全部通过。

## 本地预览核对

用 server.js 的 `createShopApp`（临时 token、临时库）起本地服务，在 1440×900、1366×657、1024×768、375×812 下分别切到中 / 日 / 英，都没有横向或纵向滚动；1100px 以下不画床柱，720px 以下联系方式折到介绍下面、落款省掉、入口占一整行靠左。控制台没有报错。

## 上线

和以往一样：合并到 main 后，把仓库覆盖拷贝到 Mac 的 `/Users/wujianxiang/CodeSpace/yui.web`。这次没有新增公开目录，不用改 cloudflared ingress。`js/home.js`、`styles/home.css` 是新文件，`?v=20261028-1` 不会撞上旧缓存。
