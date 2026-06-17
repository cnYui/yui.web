# AI 协作记忆

历史协作日志已归档到：

- `docs/ai/context/20260616-190048-current-completed-state_CN.md`

后续新增上下文、设计、计划、实施记录和排查日志，继续按时间创建新文件保存到 `docs/ai/context/`，不要把完整日志继续堆进本文件。

## 2026-06-16 订阅池计费规则

- Shop 当前目标计费系统是订阅池美元额度，不是旧人民币按量余额。
- 套餐固定为 29 / 39 / 59 元，对应每日 19 / 29 / 49 美元额度。
- 每日额度按东八区 0 点刷新，当天未使用完不累计。
- 项目只使用 `gpt-5.4` 和 `gpt-5.5`，两个模型三个套餐都可用。
- 官方美元价格固定按 `openai-standard-short-usd-20260616`：`gpt-5.4` 缓存命中输入 `$0.25`、未命中输入 `$2.50`、输出 `$15.00` 每百万 token；`gpt-5.5` 缓存命中输入 `$0.50`、未命中输入 `$5.00`、输出 `$30.00` 每百万 token。
- 第一版不在用户侧暴露长短上下文、Batch、Flex 或 Priority 价格分支；后续如上游账单偏离，再新增价格版本。
- 新规则使用独立美元账本，不能复用 `account_balances.balance_nanos`，不能污染旧人民币余额和历史 `api_charge_records`。

## 2026-06-16 订阅池 MVP 流程

- 新账户仍不自动分配 API key，用户必须找管理员领取邀请码并在登录态兑换。
- 用户必须先提交并通过套餐订单，才可以购买加量包；无有效套餐时后端返回 `SUBSCRIPTION_REQUIRED_FOR_ADDON`。
- 有效套餐期间不能重复提交或审批新的套餐订单，避免低价套餐覆盖高价套餐；重复场景返回 `ACTIVE_SUBSCRIPTION_EXISTS`。
- 加量包余额长期保留，续费和换套餐后也保留；扣费优先级为先扣当天套餐额度，额度用完后再扣加量包。
- 无有效套餐时，即使还有加量包余额，API key 也不可用；续费后加量包继续可用。
- 退款按剩余会员天数计算人民币金额，不按当天已使用额度计算；管理员批准后套餐立即取消，API key 因无有效订阅立即不可用。
- usage 美元扣费必须按 usage 发生时间判断订阅有效性：`started_at <= requested_at < expires_at`。

## 2026-06-17 订阅池老用户真实库迁移

- 一次性脚本为 `scripts/shop-migrate-subscription-legacy-users.js`，默认 dry-run，`--apply` 前自动备份数据库。
- 已确认白名单老用户：`15776812883`、`17371571728`、`19814722044`、`13813756694`、`18014503779`、`15062376174`、`15995436627`、`18367290091`、`13052071067`、`13584052801`。
- 真实库 `/Users/wujianxiang/CodeSpace/yui.web/data/shop.sqlite` 已执行迁移：上述 10 个手机号均为 `sub_29_daily_19_usd`，有效期 `2026-06-17T00:00:00+08:00` 到 `2026-07-17T00:00:00+08:00`。
- 迁移创建 10 条 active `account_subscriptions` 和 10 条 `LEGACY-SUB-*-20260617` approved 订阅订单。
- 其他用户没有 active 订阅，上线后仍是无套餐状态。
- 旧人民币余额、旧人民币扣费记录和旧 usage 不迁入美元账本；`api_usd_charge_records` 迁移后仍为 0，旧 usage 只保留 token 统计。
- 真实库备份为 `data/backups/shop-before-subscription-legacy-migration-20260617-092557.sqlite`。

## 2026-06-17 订阅池合并上线

- `codex/subscription-pool-pricing-design` 已合并到 `main`，合并前订阅池 worktree `npm test` 为 193/193 通过，`git diff --check` 无输出。
- 合并上线计划记录见 `docs/ai/context/20260617-093450-subscription-merge-main-restart-plan_CN.md`。
