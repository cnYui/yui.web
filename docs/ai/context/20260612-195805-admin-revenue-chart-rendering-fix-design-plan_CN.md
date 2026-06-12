# Admin 收银图表渲染修复设计与计划

## 背景

用户反馈 `/shop/admin/` 的收银分析图表没有渲染出来。截图中收银构成金额和图例文字已经出现，但饼图圆形和柱状图柱体不可见，说明后端数据和前端插入流程已经执行，问题集中在图形几何样式。

## 根因判断

- `shop/shop.js` 中新增图表使用了 `h-36`、`w-36`、`h-56`、`max-w-12`、`min-w-[34rem]`、`rotate-[-28deg]` 等 Tailwind class。
- 当前 `styles/site.css` 中查不到这些新 class，导致动态插入的图形容器没有宽高，最终只显示文字。
- `tailwind.config.js` 已包含 `./shop/**/*.js`，因此配置能扫描动态脚本；问题是本次图表提交没有同步重新构建并提交 `styles/site.css`。

## 修复原则

- 不改后端收入口径和计费逻辑。
- 不引入图表库，继续使用原生 HTML/CSS。
- 图表关键几何样式使用稳定组件类，避免依赖大量动态 Tailwind class。
- 重新构建并提交 `styles/site.css`，保证本地服务和静态部署都能渲染图表。
- 增加测试断言，锁住图表容器 class 和构建产物中必需 CSS。

## 实施计划

1. 在现有 Admin 页面测试中补充图表关键 class 与 CSS 产物断言，先确认当前失败。
2. 在 `styles/tailwind.css` 增加 Admin 收银图表组件类。
3. 修改 `shop/shop.js` 使用稳定组件类渲染饼图和柱状图。
4. 执行 `npm run build:css` 生成新的 `styles/site.css`。
5. 运行相关测试和全量测试。
6. 用浏览器/像素或 DOM 尺寸检查确认饼图、柱状图拥有可见尺寸。
