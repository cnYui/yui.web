# Admin 收银排行旧接口颜色兜底

## 问题

用户截图显示 `Shop 用户消费排行` 的柱状图变成白色空框。图例已经出现黑 / 白 / 灰三类，但每根柱内部没有颜色段。

## 根因

前端堆叠柱依赖 `customerSpendingRankings.today/month[].parts`。如果本地页面已经加载新版 `shop.js`，但 yui.web 服务尚未重启，`/api/admin/usage-summary` 仍可能返回旧排行格式：

- `phone`
- `chargeNanos`
- `chargeAmount`
- 缺少 `parts`

当前渲染逻辑在 `parts` 缺失时把三段金额都当作 0，导致柱体只剩 `.admin-revenue-bar-stack` 的白色背景和黑色边框。

## 方案

- `parts` 存在且至少有一段金额大于 0：按黑 / 白 / 灰三段展示。
- `parts` 缺失但 `chargeNanos > 0`：渲染一整段黑色金额柱，避免白框误导。
- `parts` 存在但三段合计为 0 且总金额大于 0：同样使用黑色兜底。
- 这只是前端兼容兜底；服务重启并返回新版 `parts` 后，仍展示真实三段拆分。

## 验证

- 增加静态回归测试，覆盖旧排行数据缺少 `parts` 时不会只输出 0 高度段。
- 运行 Admin 图表相关测试和 `npm run build:css`。
