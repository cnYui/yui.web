# 管理员每日额度只监控不限制

## 背景

管理员 `15951875192` 已加入 Admin「用户额度」面板，并按 `sub_59_daily_49_usd` 展示每日 `$49` 额度。
用户确认管理员的每日使用金额不能用于停用 API key：即使超过 `$49`，也要继续可用。

## 规则

- 普通用户：套餐每日额度 + 加量包余额用完后，API key 不可用。
- 管理员：`$49` 只作为监控和统计基准，不作为停用阈值。
- 管理员超过 `$49` 后：
  - 继续写入 `api_usd_charge_records`。
  - `daily_quota_deducted_usd_micros` 最多扣到 `$49`。
  - 超出部分写入 `overrun_usd_micros`。
  - Admin「用户额度」中 `dailyRemainingUsdMicros` 可以为 0，但 `active` 和 `status` 仍保持可用。
  - 内部 API key 状态接口对管理员手机号也使用管理员监控状态，避免托管 key 被真实套餐检查误停。

## 实施

- `adminSubscriptionMonitorQuotaStatus` 固定返回 `active: true` 和 `code: 'active'`。
- 新增 `subscriptionQuotaStatusForPhone(phone, date)`：
  - 管理员手机号走 `adminSubscriptionMonitorQuotaStatus`。
  - 其他用户走 `accountSubscriptionQuotaStatus`。
- 实时 usage 美元扣费和内部 API key 状态检查共用该 helper。

## 验证

- 新增回归测试：`管理员超过 59 元套餐每日美元额度后仍保持可用`。
- 测试覆盖：
  - 管理员单次 usage 产生 `$60` 消耗。
  - 其中 `$49` 计入每日套餐额度，`$11` 进入 overrun。
  - Admin 用户额度面板仍返回 `active`。
  - `/api/internal/api-keys/status` 仍返回 `active`。
