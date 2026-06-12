# Admin 用量监控收银图表实施计划

> 本计划按 inline execution 执行，不使用 subagent。实现必须遵循 TDD：先写失败测试，再写生产代码。

## 目标

在管理员控制台用量监控中新增收银分析图表，同时保留现有卡片、用量表和最近扣费记录。

## 修改文件

- `server.js`
  - 扩展 `buildBillingSummary`，返回收银构成和 Shop 用户消费排行。
- `shop/admin/index.html`
  - 在 `adminBillingUsageCards` 下方新增 `adminRevenueCharts` 容器。
- `shop/shop.js`
  - 新增收银饼图和用户消费排行柱状图渲染函数。
  - 在 Admin usage 刷新后渲染图表。
- `test/shop-flow.test.js`
  - 增加后端口径测试和前端 DOM/脚本测试。
- `AGENTS.md`
  - 记录本次 Admin 收银图表口径。

## 任务 1：后端图表数据口径

- [ ] 在 `test/shop-flow.test.js` 增加测试：Admin usage summary 返回 `billing.todayRevenueParts`、`billing.monthRevenueParts`、`billing.customerSpendingRankings.today`、`billing.customerSpendingRankings.month`。
- [ ] 运行目标测试，确认失败。
- [ ] 在 `server.js` 中按 Shop 扣费记录构建图表数据。
- [ ] 运行目标测试，确认通过。

关键规则：

- 收银构成只从 Shop 扣费记录计算。
- Local 扣费不进入图表数据。
- 排行只包含 Shop 订单手机号。
- 今日 / 本月排行分别按对应金额降序。

## 任务 2：前端图表容器与渲染

- [ ] 在 `test/shop-flow.test.js` 增加测试：Admin 页面包含 `adminRevenueCharts`，脚本包含 `renderAdminRevenueCharts`、`renderRevenuePieChart`、`renderCustomerSpendingBars` 和今日 / 本月切换文案。
- [ ] 运行目标测试，确认失败。
- [ ] 在 `shop/admin/index.html` 增加图表容器。
- [ ] 在 `shop/shop.js` 增加纯 HTML/CSS 图表渲染，并在 `fetchUsage` 中调用。
- [ ] 运行目标测试，确认通过。

关键规则：

- 不移除 `usageSummaryCards`。
- 不移除 `adminBillingUsageCards`。
- 不移除 `usageTable`。
- 不移除 `adminRecentCharges`。
- 不新增第三方依赖。

## 任务 3：文档与全量验证

- [ ] 更新 `AGENTS.md` 的 AI 协作记忆。
- [ ] 运行 `npm test`。
- [ ] 检查 `git diff --check`。
- [ ] 如服务需要手动重启，重启后验证 `/shop/admin/` 和 `/shop/shop.js`。

## 风险

- `api_charge_records.charge_nanos` 是总额事实字段，饼图各分项金额由 token 数乘价格得到，极小金额下可能因 cents 向上取整显示和总额略有视觉差异；因此图表分项使用 nanos 显示，避免 cents 取整偏差。
- 当前前端是单文件脚本，图表渲染会继续放在 `shop/shop.js`，不在本次拆分文件，避免扩大改动。
