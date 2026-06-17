# 订阅池 MVP 实施记录

## 背景

用户确认先做最小 MVP：保留 API key 人工发放流程，用户必须从 29 / 39 / 59 元三个套餐中选择一个提交订单，管理员审批后账号获得订阅池额度。计费使用美元额度，按 OpenAI API Pricing 2026-06-16 快照中的 `gpt-5.4` / `gpt-5.5` 输入、缓存命中输入、输出价格计算 token 成本。

## 本次实现

- 新增订阅池美元计费核心模块 `lib/shop-subscription-billing.js`：
  - 套餐：29 元每日 19 美元额度、39 元每日 29 美元额度、59 元每日 49 美元额度。
  - 加量包：5 / 10 / 20 / 50 元分别增加 5 / 10 / 20 / 50 美元额度。
  - 价格版本：`openai-standard-short-usd-20260616`。
  - `gpt-5.4`：输入 2.50、缓存命中输入 0.25、输出 15 美元 / 百万 token。
  - `gpt-5.5`：输入 5、缓存命中输入 0.5、输出 30 美元 / 百万 token。
- 新增 SQLite 表：
  - `subscription_plans`
  - `account_subscriptions`
  - `subscription_orders`
  - `account_addon_balances`
  - `account_addon_ledger_entries`
  - `api_usd_charge_records`
- 新增用户接口：
  - `GET /api/account/subscription-state`
  - `POST /api/account/subscription-orders`
  - `GET /api/account/subscription-orders`
  - `POST /api/account/addon-orders`
  - `GET /api/account/addon-orders`
  - `GET /api/account/usd-charges`
  - `GET /api/account/addon-ledger`
- 新增管理员接口：
  - `GET /api/admin/subscription-users`
  - `GET /api/admin/subscription-orders`
  - `POST /api/admin/subscription-orders/:id/approve`
  - `POST /api/admin/subscription-orders/:id/reject`
  - `GET /api/admin/addon-orders`
  - `POST /api/admin/addon-orders/:id/approve`
  - `POST /api/admin/addon-orders/:id/reject`
  - `GET /api/admin/usd-charges`
- Account 页面改为订阅池 MVP：
  - 顶部显示当前套餐、今日套餐额度、加量包余额、当前可用额度。
  - 使用黑色长条展示今日套餐额度 + 加量包余额的剩余比例。
  - 套餐购买必须使用下拉框选择 29 / 39 / 59 元套餐后提交。
  - 加量包购买使用下拉框选择加量包后提交。
  - 保留登录态邀请码兑换 API key 区域，不自动分配 API key。
  - 展示订阅订单、加量包订单、美元扣费记录、加量包流水。
- Admin 页面新增订阅池运营视图：
  - 订阅订单审核。
  - 加量包订单审核。
  - 每个用户的套餐、每日额度、今日已用、今日剩余、加量包余额、总可用额度。
  - 用户美元消耗日志。

## 扣费规则

- API key 放行条件改为：托管 API key 已兑换，且账号存在有效订阅，并且今日套餐剩余额度 + 加量包余额大于 0。
- 每条 usage 同时保留旧人民币扣费记录用于兼容旧接口；订阅池真实放行和展示使用新增的美元账本。
- 美元 usage 扣费顺序：
  1. 先扣东八区当天套餐剩余额度。
  2. 套餐额度用完后自动扣长期加量包余额。
  3. 加量包余额不按天清零，续费、换套餐后继续保留。
- 无有效订阅时，加量包余额保留但 API key 不放行，也不消耗订阅池美元账本。
- 历史 usage 导入时，订阅有效性按 usage 发生时间判断：`started_at <= requested_at < expires_at`，不能用当前时间回放旧 usage。

## 验证

- `node --test --test-name-pattern "订阅开通前发生的 usage 不消耗订阅池美元额度" test/shop-flow.test.js` 通过。
- `node --test lib/shop-subscription-billing.test.js test/shop-flow.test.js` 通过，109 个测试通过。
- `node --test test/shop-frontend.test.js` 通过，36 个测试通过。

