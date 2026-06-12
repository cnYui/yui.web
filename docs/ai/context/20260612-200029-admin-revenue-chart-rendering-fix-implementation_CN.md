# Admin 收银图表渲染修复实施记录

## 问题

`/shop/admin/` 的收银分析中，今日 / 本月收银构成和用户消费排行的数据文字正常显示，但饼图圆形和柱状图柱体没有渲染。

## 根因

本次图表前端使用了新的 Tailwind 动态 class，但 `styles/site.css` 没有随提交重新构建。页面加载了新的 `shop/shop.js` 后，动态插入的图表 DOM 存在，但旧 CSS 中缺少图形容器宽高与布局 class，导致图形区域不可见。

## 修改

- `styles/tailwind.css` 新增 `admin-revenue-*` 组件类，固定饼图、图例点、柱状图、手机号标签等关键几何样式。
- `shop/shop.js` 改用稳定组件类渲染收银图表，并给饼图和柱状图容器保留必要内联几何兜底。
- Shop 用户消费柱状图的单根柱子不再使用百分比高度；改为按金额比例计算像素高度，避免 flex 子项中的百分比高度解析为 0。
- 重新执行 `npm run build:css`，提交更新后的 `styles/site.css`。
- `test/shop-flow.test.js` 增加回归测试，断言图表关键 class 存在于脚本，且构建 CSS 中包含饼图和柱状图几何样式。

## 验证

- 先运行新增测试，确认当前失败：找不到 `admin-revenue-pie` 和 CSS 产物样式。
- 修改并构建后，新增测试通过：`1 pass / 0 fail`。
- 浏览器临时本地验证页确认饼图为 `144x144`，柱状图容器高度为 `224px`，单根柱子高度不再为 0。

## 后续注意

动态图表如果依赖新的 Tailwind class，必须同步执行并提交 `npm run build:css` 后的 `styles/site.css`。更稳妥的做法是把关键几何样式放入 `styles/tailwind.css` 的组件类中。
