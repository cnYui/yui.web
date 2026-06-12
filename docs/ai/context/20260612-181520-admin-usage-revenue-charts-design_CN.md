# Admin 用量监控收银图表设计

## 背景

管理员控制台 `/shop/admin/` 的用量监控已经区分了 Shop 收银和 Local 自用消耗：

- `今日收银`、`本月收银` 只统计能关联到 `api_keys -> orders` 的 Shop 托管 API key。
- Local / 未托管 key 仍展示在用量明细里，但不计入收银。
- 扣费价格使用当前内部价格版本 `deepseek-v4-pro-rmb-20260612-cache-hit-10x`，其中缓存命中输入为 `250 nanos/token`，即 `0.25 元 / 100 万 token`。

本次需求是在保留现有卡片、表格和最近扣费记录的前提下，为 Admin 用量监控增加图表化分析。

## 目标

新增「收银分析」区域：

- 使用饼图展示今日收银构成。
- 使用饼图展示本月收银构成。
- 使用柱状图展示 Shop 用户已消费金额排行。
- 柱状图支持「今日 / 本月」切换，默认本月。

## 数据口径

### 收银饼图

饼图只统计 Shop 托管 API key 的扣费记录，不统计 Local / 未托管。

饼图按计费类型切分：

- 缓存命中输入
- 缓存未命中输入
- 输出 token

每一块金额用扣费记录里的 token 数和该记录自己的 `price_version` 计算展示值；未知价格版本回退当前价格。总额仍以 `api_charge_records.charge_nanos` 汇总为准，避免展示总额和真实扣费记录不一致。

### 用户消费柱状图

柱状图只展示 Shop 用户，不展示 Local / 未托管。

金额含义是「已消费 / 已扣费金额」，不是余额：

- 今日排行：统计今天已扣费金额。
- 本月排行：统计本月已扣费金额。
- 默认展示本月，从高到低排序。
- 切换到今日时，按今日金额重新排序。

手机号展示可使用现有手机号值；图表横坐标允许斜排，避免拥挤。

## 前端结构

在 `shop/admin/index.html` 的 `adminUsageSection` 内保留现有结构：

- `usageSummaryCards`
- `adminBillingUsageCards`
- `usageTable`
- `adminRecentCharges`

新增：

- `adminRevenueCharts`

插入位置为 `adminBillingUsageCards` 下方、`usageTable` 上方。

前端不引入图表库：

- 饼图使用 CSS `conic-gradient`。
- 柱状图使用普通 div 高度和标签渲染。
- 通过按钮切换 `today` / `month` 排行。

## 后端结构

复用 `/api/admin/usage-summary`，在现有 `billing` 字段里追加图表数据：

- `todayRevenueParts`
- `monthRevenueParts`
- `customerSpendingRankings.today`
- `customerSpendingRankings.month`

图表数据从 `listApiChargeRecordsForShopBilling` 的结果构建，保证与 Admin 收银总额同源。

## 非目标

- 不修改用户账户页。
- 不让 Local 进入收银图表或 Shop 用户排行。
- 不引入第三方图表依赖。
- 不改变扣费价格规则。
- 不重算历史扣费。

## 验收标准

- Admin 页面保留原有卡片、用量表和最近扣费记录。
- Admin 页面新增收银分析容器。
- 今日和本月饼图按缓存命中输入、缓存未命中输入、输出 token 展示。
- Shop 用户消费排行默认按本月消费金额从高到低排列。
- 切换到今日后按今日消费金额从高到低排列。
- Local 扣费不会进入收银饼图或 Shop 用户排行。
