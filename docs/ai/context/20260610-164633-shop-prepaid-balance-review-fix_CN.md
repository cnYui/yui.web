# Shop 预充值余额 PR Review 修复记录

## 背景

在 `feature/shop-prepaid-balance` 分支发起 PR 后，合并前做客观 review。Review 重点检查账务一致性、幂等、权限边界、余额拦截和用户可见流水。

## 发现的问题

`storeUsageEvent()` 原实现先写入 `usage_events`，再调用扣费逻辑。如果扣费阶段抛错，例如 `price_currency` 不是 `CNY`，接口会返回错误，但已插入的 usage event 会留在数据库中。之后重试同一个 `request_id` 会被 `INSERT OR IGNORE` 当作重复事件跳过，造成 usage event 已入库但没有扣费记录和账户流水。

这会破坏账务一致性，属于合并前必须修复的问题。

## 修复方案

- 新增回归测试：`usage event 扣费失败时不会留下未扣费事件`。
- 把 usage event 插入和扣费放进同一个 SQLite transaction。
- 拆出 `chargeUsageEventInCurrentTransaction()`，让单独扣费事务和插入加扣费事务复用同一段扣费逻辑。
- 扣费失败时整个事务回滚，`usage_events`、`api_charge_records` 和账户余额都不会产生部分写入。

## 验证

- `npm test -- --test-name-pattern='usage event 扣费失败时不会留下未扣费事件'`：67/67 通过。
- `npm test`：67/67 通过。
- `npm run build:css`：通过，仅有 caniuse-lite 过期提示。
