# Account 模型总览官方美元价格修正实施记录

## 已完成

- `/api/account/model-overview` 改为使用订阅池官方美元价格源 `lib/shop-subscription-billing.js`。
- `lib/shop-subscription-billing.js` 为 `officialUsdPrices` 补充 `model`、`version`，并导出 `priceForModel`，供模型总览复用。
- `shop/js/account.js` 模型价格展示改为美元格式，读取：
  - `cacheHitInputUsdPerMillion`
  - `cacheMissInputUsdPerMillion`
  - `outputUsdPerMillion`
- Account 展示价格修正为：
  - `gpt-5.4`：`$0.25 / $2.50 / $15.00`
  - `gpt-5.5`：`$0.50 / $5.00 / $30.00`
- 保留旧人民币 `lib/shop-pricing.js` 价格版本和历史账务回放，不重算历史扣费。

## 测试

- `lib/shop-model-overview.test.js` 锁定官方美元展示字段。
- `test/shop-flow.test.js` 锁定 Account 模型总览接口和前端渲染美元价格。
- `lib/shop-subscription-billing.test.js` 继续覆盖订阅池美元扣费。

## 注意

这次只修个人展示中心模型价格，不改变订阅池美元扣费逻辑，因为订阅池扣费本来已经使用官方美元价格。
