# Account 模型价格展示修正设计与计划

## 背景

用户指出个人展示中心中的模型价格不对，需要和此前确认的 OpenAI 官方 GPT-5.4 / GPT-5.5 价格一致。当前 Account 模型总览仍复用旧人民币 `shop-pricing` 表，导致输出价格显示为半价版本。

## 决策

- 只修正 Account 模型价格展示，不修改历史人民币扣费、不重算 `api_charge_records`、不影响 Admin 收银历史价格回放。
- Account 模型总览改为读取订阅池官方美元价格源 `lib/shop-subscription-billing.js`。
- 展示字段改为美元 / 1M tokens：
  - `gpt-5.4`：缓存命中输入 `$0.25`，未命中输入 `$2.50`，输出 `$15.00`。
  - `gpt-5.5`：缓存命中输入 `$0.50`，未命中输入 `$5.00`，输出 `$30.00`。
- 未知模型仍沿用 `gpt-5.4` 的价格模型，并标记 `usesDefaultPrice = true`。

## 实施计划

1. 先修改 `lib/shop-model-overview.test.js`、`test/shop-flow.test.js`、`test/shop-frontend.test.js`，让当前半价展示测试失败。
2. 修改 `lib/shop-model-overview.js`，使用 `officialUsdPrices` 和 `priceForModel` 的官方美元价格。
3. 修改 `shop/js/account.js`，将模型价格格式化为美元，并读取 `cacheHitInputUsdPerMillion` / `cacheMissInputUsdPerMillion` / `outputUsdPerMillion`。
4. 更新 AGENTS 记忆，记录 Account 模型展示价不能回退旧人民币半价表。
5. 执行 targeted tests、`npm test`、`git diff --check`，必要时重启本地 4174 服务。
