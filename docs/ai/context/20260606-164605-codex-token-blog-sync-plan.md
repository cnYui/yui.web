# Codex Token 低成本文章同步计划

## 背景

用户要求把已经整理并生成 note 草稿的《Codex Tokenを低コストで使うためのいくつかの方法》和对应封面同步到 `yui.web` 项目中“发文章”的位置。目标项目现有博客采用静态文章页加 `js/blog-data.js` 索引数据的方式发布内容。

## 现有格式

- 博客列表数据位于 `js/blog-data.js`，通过 `window.YuiBlogData` 提供多语言标题、日期、阅读时间、摘要、封面和链接。
- 文章详情页位于 `blog/*.html`，例如 `blog/speakmore-cloud-input.html`，页面内部通过 `articleLocales` 提供 `zh`、`en`、`ja` 三语言正文和标签。
- Express 静态服务已启用 `.html` 扩展回退，因此新增 `blog/codex-token-low-cost.html` 后，`/blog/codex-token-low-cost` 可以直接访问。
- 封面资源放在 `images/blog/` 下，博客列表和详情页共用同一张主图。

## 同步设计

本次只做内容同步，不调整站点架构。

1. 新增封面文件 `images/blog/codex-token-low-cost-cover.png`，来源为 CLIProxyAPI 输出目录中的黄色日文封面。
2. 新增文章页 `blog/codex-token-low-cost.html`，沿用最近的 SpeakMore 文章结构、移动端菜单、语言切换、主题切换、标签和分享按钮逻辑。
3. 在 `js/blog-data.js` 顶部新增 id `11` 的文章索引，发布时间为 `2026-06-06`，分类为 `AI`，链接为 `/blog/codex-token-low-cost`。
4. 文章正文以日文 note 草稿为主，同时补齐中文与英文版本，保证站点切换语言时不会出现元数据和正文语言不一致。

## 边界

- 不同步 note 编辑器草稿 URL 到页面正文，避免把后台编辑链接暴露给站点访客。
- 不写跨区支付、批量注册、规避风控或滥用试用流程。
- 只使用用户最终确认的黄色封面，不使用灰色版或带连载编号的旧封面。
