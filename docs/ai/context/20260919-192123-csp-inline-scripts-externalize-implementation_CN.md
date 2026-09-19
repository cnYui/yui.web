# 页面内联脚本外置以符合 server.js CSP 实施记录

## 问题

- `server.js` 的 `setSecurityHeaders` 对所有响应发送 `script-src 'self'`（没有 `'unsafe-inline'`），14 个页面的内联 `<script>` 经 server.js 访问时（含公网 aaccx.pw）全部被浏览器拦截；GitHub Pages 不发这个 CSP，不受影响。
- 首页表现：控制台 2 条 `Executing inline script violates ... 'script-src 'self''`，`applyHomeLocalizedContent` 为 `undefined`，切换语言时导航会变但精选作品卡片不变；`<head>` 预初始化脚本（`data-ui-ready` / `dark` / `html.lang` / 背景色）也没有执行。

## 方案

- 不放宽 CSP，把内联脚本原样移到 `js/` 下的外部文件，在原位置用普通同步 `<script src>` 引用（不加 `defer` / `async`），执行顺序不变。
- `<head>` 预初始化：13 个页面统一改为 `<script src="/js/ui-init.js"></script>`，该文件由 `js/blog-ui-init.js` 改名并通用化，`blog/index.html` 同步改引用。
  - `blog/back-to-vibe-coding-ai-driven-dev-before.html` 和 `blog/speakmore-cloud-input.html` 原来的回退语言是 `zh-CN`（其他页面是 `en`），改为在标签上写 `data-default-lang="zh-CN"`，`ui-init.js` 通过 `document.currentScript.dataset.defaultLang` 读取。
- 页面脚本一页一个文件：`js/home.js`、`js/anime.js`、`js/music.js`、`js/projects.js`、`js/projects-earth.js`、`js/travel.js`、`js/skill.js`，以及 7 篇文章各自的 `js/blog-<文章名>.js`。
  - 文件必须放在 `js/` 顶层：`tailwind.config.js` 的 `content` 只扫描 `./js/*.js`，放进子目录会导致模板字符串里的类名在下次 `build:css` 时被裁掉。
- 迁移用一次性脚本完成：只在字符串 / 模板 / 正则 token 之外去缩进、去行尾空格；用 sucrase tokenizer 比对新旧 token 流逐个一致，并用 `vm.Script` 做编译检查。
  - 唯一例外：`js/projects.js` 模板字符串里 6 处 HTML 标记的行尾空格被去掉（属性之间的空格和 flex 容器里的空白行，不影响渲染），为了让 `git diff --check` 无输出。

## 静态白名单与构建

- `lib/static-public-policy.js`：`/js/` 已在允许前缀内，无需修改。
- `scripts/check-static-assets.js`：已扫描 html / js 里的 `/js/...` 引用，无需修改，检查通过。
- `scripts/build-public-dist.js`：整体复制 `js` 目录，无需修改；`public-dist/js` 已包含全部新文件。

## 测试

- 新增 `test/page-csp.test.js`：进程内启动 `createShopApp`，按 `isAllowedPublicStaticPath` 枚举所有公开 HTML，读取真实 CSP 响应头，断言：
  - 页面返回 200 且带 CSP；
  - CSP 不允许时不得出现内联 `<script>`、`on*` 事件属性、`javascript:` 链接；
  - 页面引用的站内脚本都能以 200 + JavaScript 类型访问；
  - `/js/ui-init.js` 是 `<head>` 里第一个脚本且同步加载，且页面同时加载 `lang.js`（否则 `data-ui-ready="false"` 会让 body 一直透明）。
- 已用原始代码（HEAD 导出副本）确认该测试会失败，并列出全部 14 个页面。
- `test/build-public-dist.test.js`：新增「public-dist 包含页面引用的全部站内脚本」，两个测试共用一次构建。
- `test/anime-title.test.js`：动漫标题数据已移到 `js/anime.js`，改为读取该文件，并断言页面引用它。

## 验证结果

- `npm test`：Windows 工作区 69/70。唯一失败的是既有的「Resume 页面所有 data-i18n key 都有中英日翻译」，原因是 CRLF 工作区下正则 `\},\n` 不匹配，与本次无关（改动前基线同样失败）；在 LF 副本（等同 CI）上 70/70 通过。
- `npm run check:assets`：通过。
- Tailwind 构建产物与改动前逐字节一致，没有类名因迁移被裁掉。
- `git diff --check`：无输出。
- 浏览器验证（内置浏览器，修复版 server.js 跑在 4180，原始代码对照跑在 4181；4173 上已有的进程未动）：
  - 原始代码首页：2 条内联脚本 CSP 报错，`applyHomeLocalizedContent` 为 `undefined`，切到日文时导航变日文但精选卡片仍是英文。
  - 修复后：首页、anime、music、projects、travel、resume、blog 首页、7 篇文章、404、shop 都没有内联脚本报错，页面脚本正常渲染。
  - 首页 EN → JA → ZH → EN 切换时精选作品卡片和最新文章同步更新；文章页切换语言正常。
  - 存了 dark 主题时，`ui-init.js` 在首帧前设置 `dark` 类、`#0f0f0f` 背景和 `color-scheme: dark`。
  - `data-default-lang` 实测：无存储语言且有属性时为 `zh-CN`，无属性时为 `en`，存了 `ja` 时仍为 `ja`。
  - 浏览器面板处于隐藏状态时 `requestAnimationFrame` 不触发，projects 的粒子地球不会绘制；用定时器替代 rAF 重新执行 `js/projects-earth.js` 后正常绘制。

## 仍存在的问题（本次未处理）

- `/skill/`：`https://cdn.jsdelivr.net/npm/marked/marked.min.js` 被 `script-src 'self'` 拦截；同时 `/SKILL.md` 在 `blockedStaticFiles` 里、也不在 public-dist 中，两种部署下都返回 404，页面内容本来就加载不出来，而首页仍链接 `https://aaccx.pw/SKILL.md`。需要先决定 SKILL.md 是否公开，再决定自托管 marked 还是放宽 CSP。
- `/blog/article.html`：示例文章模板里 3 张 `images.unsplash.com` 图片被 `img-src 'self' data:` 拦截。当前 `js/blog-data.js` 里的文章都有独立 `link`，不会进入这个模板。
- 缓存：`.js` 响应是 `max-age=604800`（7 天），HTML 是 60 秒。文章翻译等内容现在放在 js 文件里，之后修改这些 js 时，要像 `lang.js` 一样在引用处加 / 更新 `?v=` 版本号，否则老访客最长 7 天看到旧脚本。
