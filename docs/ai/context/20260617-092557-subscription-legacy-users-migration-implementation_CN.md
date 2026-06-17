# 订阅池老用户迁移实施记录

## 实施内容

新增一次性迁移脚本：

- `scripts/shop-migrate-subscription-legacy-users.js`

脚本能力：

- 默认 dry-run，不写数据库。
- `--apply` 前使用 SQLite backup API 备份数据库。
- 使用 `openShopDatabase(dbPath)` 确保订阅池表和默认套餐存在。
- 固定白名单 10 个手机号。
- 为白名单中存在的用户创建 29 元档 active 订阅。
- 为每个迁移用户创建一条 `subscription_orders` approved 迁移订单，便于后续审计。
- 不回填旧 `api_usd_charge_records`，旧 usage 只保留 token 统计。
- 幂等：重复执行会识别已有 active 订阅，不重复创建。

## 迁移规则

- 计划：`sub_29_daily_19_usd`
- 每日额度：`19000000` USD micros，即 `$19.00`
- 生效时间：`2026-06-17T00:00:00+08:00`
- 到期时间：`2026-07-17T00:00:00+08:00`
- 批次：`legacy-subscription-20260617`

## 已执行真实库迁移

目标数据库：

- `/Users/wujianxiang/CodeSpace/yui.web/data/shop.sqlite`

备份文件：

- `/Users/wujianxiang/CodeSpace/yui.web/data/backups/shop-before-subscription-legacy-migration-20260617-092557.sqlite`

迁移手机号：

- `15776812883`
- `17371571728`
- `19814722044`
- `13813756694`
- `18014503779`
- `15062376174`
- `15995436627`
- `18367290091`
- `13052071067`
- `13584052801`

执行结果：

- 创建 active 订阅：10 条
- 创建迁移订阅订单：10 条
- 缺失用户：0 个
- 额外 active 订阅用户：0 个
- `api_usd_charge_records`：0 条，没有回填旧美元扣费

## 验证

- dry-run 首次确认 10 个手机号全部存在，且各有 1 条兑换订单和 1 个托管 key。
- apply 后查询 `account_subscriptions`：只有上述 10 个手机号有 active 订阅。
- apply 后查询 `subscription_orders`：10 条 `LEGACY-SUB-*-20260617` 订单均为 approved。
- apply 后再次 dry-run：`skippedExistingSubscriptions = 10`，`createdSubscriptions = 0`，`createdOrders = 0`。
