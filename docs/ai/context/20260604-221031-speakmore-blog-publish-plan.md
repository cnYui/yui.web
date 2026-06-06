# SpeakMore 三语博客发布计划

## 目标

把 SpeakMore 项目文章和封面加入 `yui.web`，按现有博客格式支持中文、日文、英文三种语言，并在完成后重启当前公网反代理对应的本地服务。

## 现有结构判断

- 博客列表由 `js/blog-data.js` 的 `window.YuiBlogData` 驱动。
- 较新的长文使用独立 HTML 页面，例如 `blog/ai-native-hackathon.html`。
- 独立文章页通过 `window.YuiLang` 切换语言，正文可在页面内维护 `articleLocales`。
- 项目已有 `docs/ai/context/`，本次只新增上下文文档，不覆盖历史记录。

## 实施方案

1. 复制高精度封面图到 `images/blog/speakmore-note-cover-guizang.png`。
2. 新增 `blog/speakmore-cloud-input.html`，复用现有文章页结构。
3. 在页面内写入三语标题、摘要、正文、标签和分享文案。
4. 更新 `js/blog-data.js`，把 SpeakMore 文章加入博客列表首位。
5. 运行基础测试，检查页面可访问性。
6. 定位当前运行进程，重启服务，使反代理公网入口加载新内容。

## 取舍

- 封面使用 4x 高精度图，优先满足用户对像素和精度的要求。
- 页面结构沿用现有独立文章，避免改造全站路由或博客渲染逻辑。
- 英文内容不做逐字直译，而是保持 Yui 技术博客的第一人称实践口吻。
