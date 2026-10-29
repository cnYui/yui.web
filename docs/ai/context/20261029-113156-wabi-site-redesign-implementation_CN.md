# 全站侘寂版实施记录（2026-10-29）

## 背景

用户在 Claude Design 画布「侘寂个人网站 · 三稿」（https://claude.ai/artifact/CikB6gVL1Caobt9NQvBkgC）上定稿：

- 首页用「甲 · 竖排」（`Home.dc.html`，挂轴版式，霞鹜文楷 TC，纸色底）。
- 所有子页面用「乙 · 横排」（`*-B.dc.html`）。
- 保留中 / 日 / EN 三语切换（用户在实施前选择「保留三语」）。
- 融入中式美学：日期用汉字数字，首页落款和页脚的节气随日期自动更新。
- 滚动动效选「丙 · 墨洇」（演示页：https://claude.ai/artifact/GRWYXQd2tPVR9TvvmnLDj9）。
- 首页文案定为五列：做视频，／讲一点 AI，／也写代码。／做有人类温度的产品，／极度克制的审美。（「住在日本」删去）

这次替换掉了当天上午合进 main 的深色挂轴首页（PR #78）。

## 做了什么

- 新增 `styles/wabi.css`：全站唯一样式表（首页竖排 + 子页横排 + 文章排版 + 墨洇），只用一种字体和一种金色。
- 新增 `js/site.js`：每个页面 `<head>` 里第一个同步脚本。负责三语（`[data-l]` + `<html data-title-*>`，存储 key 仍是 `yui-portfolio-lang`）、节气与七十二候（`[data-season]`）、墨洇、首页旧锚点跳转，并提供文章脚本沿用的 `window.YuiLang` 接口和切换时的 `languageChanged` 事件。
- 页面全部重写：`index.html`、`projects/`、`blog/index.html` + `js/blog-index.js`（按 `blog-data.js` 渲染）、7 篇文章页及其脚本、`travel/` + `js/travel.js`（85 张照片补了中文说明和宽高）、`resume/`、`shop/`、`skill/` + `js/skill.js`（自带小渲染器，原来的 jsDelivr marked 被 CSP 拦着）、`404.html`。
- 删除：`styles/home.css`、`js/home.js`（PR #78 的深色首页）、`js/projects.js`、`js/projects-earth.js`（旧项目页地球）、`blog/article.html` + `js/blog-article.js`（无人链接的旧模板，默认显示一篇 2023 年的占位文章）。
- 手机号从所有页面拿掉（旧项目、旅行、文章页脚都有）；Skill 页渲染 SKILL.md 时去掉含手机号的行，`/SKILL.md` 原文没动。
- 测试：重写 `test/home.test.js`（含节气对 2026 年 24 个节气日的核对、墨洇拆字）、`test/blog-code-block-theme.test.js`，更新 `test/page-csp.test.js`、`test/shop-frontend.test.js`、`test/shop-flow.test.js`。`npm test` 124 / 124 通过。

## 关键约定

- 三语文案写在页面里，`[data-l="zh|ja|en"]`，CSS 按 `<html lang>` 只显示一种；页面测试会核对数量（日英成对，只有中文正文的文章多一条日英说明）。
- 节气：太阳视黄经（Meeus 简化式），北京时间当天结束时刻判定；`[data-season]` 写 `line`（年份 + 节气，页脚）、`mark`（节气 + 候，首页落款）或单项。中文用《逸周书》系七十二候，日文用本朝七十二候，英文只写节气。「螻蟈鸣」「鶡旦不鸣」写繁体，因为霞鹜文楷 TC 缺简体字形。
- 墨洇：`<main>` 里的 h1–h4、p、li、dt、dd、figcaption 进入视野时才拆字（inline span，不影响换行和复制），图片、代码块、表格整块淡入；不想要的区域加 `data-ink-skip`。减少动态效果时不启用。`html.ink-on` 在拆字前把 `<main>` 藏起来，最迟 2.5 秒放出。
- 商店入口：`shop/index.html` 只能有一个 `data-sub2api-link`，写在 `href` 之后，`server.js` 会把它换成 `SUB2API_PUBLIC_URL`。

## 未完成 / 待定

- 首页「联系」只有邮件、GitHub、小红书：画稿里的 bilibili、抖音、note 缺地址，三档视频节目也还没有链接。
- 五篇文章的封面图（原 hero）在新版式里不再显示。
- `scripts/build-blog-articles.js` 只服务旧线索墙，读 `#articleTags` 时会把「标签」二字算成一个标签；线索墙源码仍按 2026-10-28 的约定保留。

## 验证

- 本地 `npm test`：124 / 124。
- 浏览器（dev server）：首页墨洇首屏 8 段正常洇开；文章页切日文后标题、正文、日期、标签都换成日文；375px 宽下首页、作品、随笔、文章、行旅、履历都没有横向溢出。预览窗口后半程被遮挡，没能截图看墨洇的动态过程。
