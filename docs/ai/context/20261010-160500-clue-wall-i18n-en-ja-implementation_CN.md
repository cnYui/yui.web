# 首页线索墙三语（中 / 英 / 日）

## 背景

- 子页面（项目 / 博客 / 旅行 / 履历 / 音乐 / 动漫）早就有中 / 英 / 日三语，由 `js/lang.js` 的 `data-i18n` 词典驱动，右上角一个循环切换按钮。
- 缺口在首页：v1 / v2 重做线索墙时整页摘掉了 `lang.js`，页面只有中文，也没有任何切换入口。本次只补首页，子页面不动。

## 做了什么

### 切换器

- 位置：右上角，和「环境音」按钮同一排（`#cwToolbar`），分段控件 `中文 · EN · 日本語`，每个按钮用各语言自己的名字，带 `lang` 属性和 `aria-pressed`。
- 层级压过桌上的档案（z-index 30 > 档案层 20），所以读档案时也能直接切，不用先钉回墙上。窄屏档案铺满屏幕时，环境音按钮收起（`.is-reading`），只留语言切换，避免叠在纸上。
- 切换后立即生效，不刷新页面：静态文案按 `data-i18n` 重写，脚本渲染的部分（筛选标签、卡片、桌上正在读的文章、手里举着的封面）由 `yui-clue-lang` 事件触发重画。

### 语言怎么定

- 取值顺序：访客点过切换器后存下的选择 → 浏览器语言（`zh*` 中文、`ja*` 日文，其余英文）。
- 存储 key 是 `yui-portfolio-lang`，和子页面 `js/lang.js` 共用，所以在首页选的语言会带到子页面，反过来也一样。检测结果不写回存储，只有点切换器才写。
- `js/clue-lang-init.js` 是 `<head>` 里第一个同步脚本（CSP 不允许内联）：在首屏绘制前设好 `<html lang>`；非中文时打上 `data-i18n-pending`，样式把墙藏起来，等 `js/clue-i18n.js` 换好文案再摘掉，免得英 / 日访客先看到一闪而过的中文。样式里有 1.5 秒的纯 CSS 兜底（`cw-i18n-reveal` 动画），脚本没加载上也不会一直黑屏。

### 词典与数据

- `js/clue-i18n.js`（约 52 KB，主要是日文字节）：`TEXT` 里每个键同时写 zh / en / ja；`DATA.en` / `DATA.ja` 按下标覆盖 `js/clue-data.js` 里要翻译的字段（项目、文章卡片、旅行照片、筛选标签、奖项、关键词）。`clue-data.js` 本身仍是中文原文，图片、链接、`rot` 这类字段沿用原数据。
- `index.html` 里写的仍是中文，也是无脚本 / 爬虫看到的版本。要翻译的节点带 `data-i18n="键"`（innerHTML 用 `data-i18n-html`，属性用 `data-i18n-attrs="aria-label:键;alt:键"`），共约 120 个键。`test/home-i18n.test.js` 会校验 HTML 里的中文和词典 zh 逐字一致，所以只改一边会报错。
- 英日译文尽量沿用子页面已有的说法：履历取自 `lang.js` 的 resume 段，项目标题 / 描述取自 `js/projects.js`，旅行地名取自 `js/travel.js`，文章标题 / 摘要取自 `js/blog-data.js`。
- 首页是中英混排的设计（「FILE 01 · 关于我」）。英文版去掉中文那一半，只留英文；日文版保留「日文 + 英文」的结构。英文里和中文重复的小标题（例如「谁是悠一？」下面的 `WHO IS YUI?`）换成了不重复的短语。

### 博客文章

- 文章页里 `codex-token-low-cost`、`speakmore-cloud-input`、`ai-native-hackathon` 有英日正文，`ai-image-video`、`vibe-coding` 只有日文，`back-to-vibe-coding-ai-driven-dev-before` 没有译文（文章页的 `en` 其实是中文正文）。
- `scripts/build-blog-articles.js` 现在除了 `js/blog-articles.js`（中文），还生成 `js/blog-articles.en.js`（约 27 KB）和 `js/blog-articles.ja.js`（约 48 KB）：同一个 HTML → 块的转换器，元信息取 `blog-data.js`，标签和正文取文章页的 `articleLocales`。没有译文的文章 `blocks` 为 `null`，阅读器退回中文原文，并在稿纸顶上用当前语言提示一句。
- 译文包只在切到该语言后第一次点开文章时才加载，首屏不下载。`ensureArticles()` 顺手改成带回调队列：原来加载期间进来的调用会被丢掉，现在排队，脚本到了一起执行。

### 其他

- `js/github-contributions.js`：卡片上可见的字是 GitHub 自己的英文界面，保持英文；读屏用的 `aria-label` 原来是写死的中文，改成跟页面语言走，切换语言时同步更新。
- `js/resume-download.js`（首页和 `/resume/` 共用的口令对话框）：文案原来写死「中文 · English」，改成按 `<html lang>` 取三语词典，每次打开时重写，所以 `/resume/` 页的对话框也跟着语言走。因此 `resume/index.html` 的脚本版本号要和首页保持一致（`test/resume-download-endpoint.test.js` 守着）。
- 字体：`styles/clue-wall.css` 里 41 处写死的 `'Noto Serif SC'` 改成变量 `--cw-serif`，日文时指向本机日文明朝体（Hiragino Mincho ProN / Yu Mincho / Noto Serif CJK JP），避免日文汉字用到简体字形；只用本机字体，没有新增网络请求。手写标题的 `Ma Shan Zheng` 没动，英文字母在里面是毛笔风，观感不错。

## 取舍与限制

- **文章正文不是全部三语。** 只有文章页本来就有英日译文的那几篇有，其余退回中文并提示。没有为首页另翻译长文。
- **子页面的默认语言没动。** 子页面首次访问（没存过语言）仍默认英文，而首页现在按浏览器语言判断，所以中文浏览器从首页点进子页面，首次会看到英文，要点一下切换。这和改动前「首页中文、子页面英文」的不一致是同一件事，没有变糟，但值得后续统一（改 `js/lang.js` 的 `getCurrentLang()` 和 `js/ui-init.js` 的回退值即可）。
- 英 / 日版的几处便签文案是缩写或缩短的（例如履历便签只留学校、公司、年份），因为便签尺寸固定，原样直译会撑出纸外。
- `shop/index.html` 的隐形入口只有一个 `aria-label`，没有处理。

## 维护

- 新增或修改首页文案：同时改 `index.html`（中文）和 `js/clue-i18n.js` 的 `TEXT`（三种语言）；改完跑 `npm test`，`home-i18n.test.js` 会指出漏掉的键或对不上的中文。
- 新增项目 / 照片 / 文章卡片：在 `js/clue-data.js` 加中文数据，同时在 `DATA.en` / `DATA.ja` 对应数组的同一下标补译文（长度不一致测试会失败）。
- 博客正文有改动：`node scripts/build-blog-articles.js` 重新生成三个文件，并把 `js/clue-wall.js` 里 `ARTICLES_VERSION` 和中文包的 `?v=` 换新（避开 Cloudflare 7 天缓存）。
- 本次新增文件：`js/clue-lang-init.js`、`js/clue-i18n.js`、`js/blog-articles.en.js`、`js/blog-articles.ja.js`、`test/home-i18n.test.js`；`index.html` 引用的 `clue-wall.css`、`clue-data.js`、`clue-wall.js`、`github-contributions.js`、`resume-download.js` 以及 `resume/index.html` 里的 `resume-download.js` 版本号都升到 `20261010-2`。
- **`clue-wall.js?v=20261010-1` 和 `clue-data.js?v=20261010-1` 这两个 key 已经被污染，不要再用。** 并行的 #70（新博客文章）也把这两个文件升到了 `20261010-1`，内容和本次不同；我在部署前用真实 key 探了一次线上，Cloudflare 把 Mac 上当时的旧文件缓存在了这两个 key 下（7 天）。所以本次统一用 `-2`。探线上要用从没请求过的 `?v=probe-<时间戳>`，不要拿真实 key 探。
- rebase 到 #70 之后，首页文章卡片多了一条（`clue-data.js` 的 `posts` 有 7 条，新文章在最前），`DATA.en` / `DATA.ja` 的 `posts` 同步补了一条，译文包重新生成；新文章在文章页只有中文正文，所以英日文下阅读器退回中文并提示。首页写死的「6 ENTRIES」等计数在 #70 里没更新，本次没有动。

## 验证

- `npm test` 140 / 140 通过（新增 10 个，覆盖词典三语键齐全、HTML 中文与词典一致、数据覆盖对齐、引擎切换与兜底、首屏语言判定、译文包完整、样式约束、口令对话框词典）。
- 内置浏览器里肉眼看过：三种语言的墙面；英文的关于我 / 项目 / 履历 / 旅行 / 商店；日文的关于我 / 项目 / 旅行；点便签走完取件动画后日文档案正常展开；阅读器在日文 → 英文 → 中文间来回切换（有译文的文章换成对应语言正文，没译文的显示提示）；手机宽度（375px）下工具栏与返回按钮不重叠（数值确认，截图被隐藏的面板裁掉了右半边）。
- 没有肉眼看过的：日文的履历 / 商店档案、英日文的博客列表页，以及手机宽度下除「关于我」以外的档案；这些只用脚本量过文字是否超出容器。
- 用脚本逐个量过便签和档案里的文字是否超出容器（以中文版为基线），英文和日文版新增的溢出已全部修掉；`.cw-projects-stamp` 的斜盖章本来就伸出便签，中文版也一样，不算。
- 已知限制：商店档案里的店面插图（`images/optimized/shop/code-transit-entry.webp`）是把中文「天才程序员中转站 / 点击进入」画在图里的，文字翻译动不了它，英日文下它还是中文，要换图才能解决（墙上商店便签用的 `shop-entry.webp` 没有逐一核对）。
