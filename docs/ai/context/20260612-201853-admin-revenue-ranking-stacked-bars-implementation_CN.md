# Admin 用户消费排行堆叠柱实施记录

## 修改内容

- `/api/admin/usage-summary` 的 `billing.customerSpendingRankings.today/month` 中，每个用户排行项新增 `parts`。
- `parts` 按金额拆为三类：
  - `cache_hit_input`：缓存命中输入
  - `cache_miss_input`：缓存未命中输入
  - `output`：输出 token
- 排行仍按每个手机号的总扣费金额从高到低排序。
- 前端 `Shop 用户消费排行` 从单色总额柱改为堆叠柱：
  - 黑色：缓存命中输入
  - 白色：缓存未命中输入
  - 灰色：输出 token
- 今日 / 本月切换保留，两种周期都使用同样的金额拆分。
- `styles/tailwind.css` 新增堆叠柱和图例样式，并重新构建 `styles/site.css`。

## 口径约束

- 只统计 Shop 托管用户，不统计 Local / 未托管。
- 拆分金额按每条扣费记录的 `price_version` 计算，不用当前价格重算历史。
- 柱顶金额是该用户总扣费金额，柱内三段展示三类金额构成。

## 验证

- 新增后端断言：用户排行项包含三类金额拆分，Local 不进入排行。
- 新增前端断言：存在堆叠柱段、黑白灰图例和构建后的 CSS。
- 相关测试已从失败变为通过。
