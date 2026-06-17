# 管理员 local key 每日美元额度扣费修复

## 背景

管理员账号 `15951875192` 已加入 Admin「用户额度」监控，并按 `sub_59_daily_49_usd` 固定展示每日 `$49` 额度。
实际使用的 key 是 `usage_key_profiles` 中的 local key，hash 前缀为 `65d3c9fe55c3`，preview 为 `sk-L...8804`。

## 根因

实时 usage 写入 `api_usd_charge_records` 时，只调用 `accountSubscriptionQuotaStatus(owner.phone)`。
管理员的 `$49` 套餐是监控用虚拟套餐，不存在 `account_subscriptions` 真实记录，因此 local key 能进入 `usage_events` 和旧人民币扣费表，但不会写入美元订阅扣费表。

Admin「用户额度」面板的今日已用来自 `api_usd_charge_records.daily_quota_deducted_usd_micros`，所以管理员今日已用显示为 0 不是前端延迟，而是美元扣费记录缺失。

## 影响范围

- 真实 Shop 托管 key 且已有有效套餐的普通用户链路正常；现场验证 `18014503779` 今天已有美元扣费记录。
- 未托管且无手机号映射的 key 不进入用户额度监控，不应写入用户套餐美元扣费。
- 本次确认的问题主要影响管理员这种 `usage_key_profiles(local)` 且使用虚拟 59 元套餐监控的账号。

## 修复

`chargeUsageEventInCurrentTransaction` 在写美元扣费时：

- 管理员手机号使用 `adminSubscriptionMonitorQuotaStatus(owner.phone, usageDate)`。
- 其他账号继续使用 `accountSubscriptionQuotaStatus(owner.phone, usageDate)`。

这样管理员 local key 的新 usage 会按官方美元价格写入 `api_usd_charge_records`，并自动反映到 Admin「用户额度」今日已用。

## 数据补写

补写前已备份真实库：

`data/backups/shop-before-admin-local-usd-backfill-20260617-1057.sqlite`

第一次补写范围：

- phone：`15951875192`
- key hash：`65d3c9fe55c3a4d32b3e40d10f334d4acf5f1459f4778a16fb1d8f18711ceecd`
- quota date：`2026-06-17`
- 条件：成功 usage、尚无 `api_usd_charge_records`

补写结果：

- 241 条 usage
- 总美元消耗：`30627276` micros，即 `$30.627276`
- 今日套餐额度扣除：`30627276` micros
- 加量包扣除：0
- overrun：0
- 当日剩余额度：`18372724` micros，即 `$18.372724`

服务重启切换窗口内又进入 7 条旧逻辑处理的 usage，已用相同范围再次补写：

- 7 条 usage
- 新增美元消耗：`440591` micros，即 `$0.440591`
- 新增加量包扣除：0
- 新增 overrun：0

最终管理员 `2026-06-17` 当日美元扣费汇总：

- 250 条记录
- 今日已用：`31172554` micros，即 `$31.172554`
- 今日剩余：`17827446` micros，即 `$17.827446`
- 加量包扣除：0
- overrun：0
- 管理员 local key 缺失美元扣费记录数：0

4173 公网服务已重启到修复后的 `node server.js`，新 PID 为 `13532`。
`/api/admin/subscription-users` 已返回管理员套餐 `sub_59_daily_49_usd`、今日已用 `31172554`、今日剩余 `17827446`。

## 验证

- 新增回归测试：`管理员 local usage key 消耗固定 59 元套餐的每日美元额度`
- 红灯：修复前 `api_usd_charge_records` 查不到对应记录。
- 绿灯：修复后管理员 local key usage 写入美元扣费，Admin 用户额度显示今日已用。
- `npm test`：195 个测试通过。
