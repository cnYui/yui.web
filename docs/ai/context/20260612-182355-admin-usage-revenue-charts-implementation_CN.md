# Admin 用量监控收银图表实施记录

## 实施内容

已在 `/shop/admin/` 用量监控中新增「收银分析」图表区，并保留原有内容：

- token 概览卡片仍保留。
- 今日收银 / 本月收银卡片仍保留。
- 用量明细表仍保留。
- 最近扣费记录仍保留。

新增图表：

- 今日收银构成饼图。
- 本月收银构成饼图。
- Shop 用户消费排行柱状图。

## 后端改动

`/api/admin/usage-summary` 的 `billing` 字段新增：

- `todayRevenueParts`
- `monthRevenueParts`
- `customerSpendingRankings.today`
- `customerSpendingRankings.month`

数据口径：

- 图表数据只来自 `listApiChargeRecordsForShopBilling`，因此只统计 Shop 托管 API key。
- Local / 未托管 key 不进入收银构成和 Shop 用户消费排行。
- 收银构成按缓存命中输入、缓存未命中输入、输出 token 拆分。
- 收银构成按每条扣费记录的 `price_version` 拆分金额，历史旧价格记录不会被当前缓存命中价格重算。
- Shop 用户消费排行展示已扣费金额，不展示余额。

## 前端改动

`shop/admin/index.html` 新增 `adminRevenueCharts` 容器，位置在收银卡片下方、用量明细表上方。

`shop/shop.js` 新增：

- `renderRevenuePieChart`
- `renderCustomerSpendingBars`
- `renderAdminRevenueCharts`

图表不引入第三方依赖：

- 饼图使用 CSS `conic-gradient`。
- 柱状图使用 HTML/CSS 高度。
- 用户排行支持今日 / 本月切换，默认本月。

## 验证

已按 TDD 执行：

- 后端测试先失败于缺少 `todayRevenueParts`，实现后通过。
- 历史价格版本测试先失败于旧缓存命中记录被当前价格拆分，实现按 `price_version` 拆分后通过。
- 前端测试先失败于缺少 `adminRevenueCharts`，实现后通过。

最终验证：

- `npm test`：130 个测试全部通过。
- `git diff --check`：无空白错误。
- 本地服务已重启到新 PID `5694`。
- `curl http://127.0.0.1:4173/shop/shop.js` 可确认脚本包含 `renderAdminRevenueCharts`、`Shop 用户消费排行` 和排行切换属性。
- 浏览器访问 `/shop/admin/` 未登录时跳转 `/shop/login/`，管理员保护仍生效。
