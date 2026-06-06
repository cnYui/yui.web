# 使用方法页空白修复

## 问题

`/shop/guide/` 公网页面 HTML 正常返回，但页面看起来为空白。

原因是页面内联脚本把 `html[data-ui-ready]` 设置为 `false`，CSS 会让 `body` 保持 `opacity: 0`。该页面只加载了 `theme.js`，没有加载会把 `data-ui-ready` 改回 `true` 的脚本。

## 修复

- 在 `/shop/guide/index.html` 底部显式设置 `document.documentElement.setAttribute('data-ui-ready', 'true')`。
- 增加测试，避免该页面再次缺少 UI ready 初始化。

## 验证

- `curl https://aaccx.pw/shop/guide/` 可看到说明内容。
- 浏览器需要能看到 `Codex 配置使用方法`。
