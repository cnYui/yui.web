# Account 额度、用量与模型价格布局调整

## 背景

用户反馈 `/shop/account/` 中「Token 用量」位置过低。页面上方已经有「今日可用额度」进度条，具体的今日 / 本月消费、缓存命中输入、未命中输入、输出 token 等信息应放在进度条附近，方便用户把额度变化和 token 消耗对应起来。

同时，模型价格是购买套餐前的决策信息，应放在「购买套餐」上方，而不是放在订单和退款区域之后。

## 设计

- 保持现有接口、数据结构和渲染函数不变，只调整 Account HTML 信息顺序。
- `accountQuotaCards` 仍放在订阅池顶部，作为当前套餐、今日额度、加量包余额、当前可用的摘要。
- `accountQuotaBar` 下方立即展示 `accountUsageSection`，让用户先看到今日额度条，再看到具体 token 与消费卡片。
- `accountModelOverview` 放在购买套餐 / 购买加量包双栏之前，形成「额度状态 -> 用量明细 -> 模型价格 -> 购买」的阅读顺序。
- 保持 `accountUsageSection` 的折叠行为和默认展开状态，保持 `accountGuideSection`、`accountBillingHistorySection` 的折叠默认值不变。

## 计划

1. 更新 `test/shop-frontend.test.js`，新增顺序断言：`accountQuotaCards`、`accountQuotaBar`、`accountUsageSection`、`accountModelOverview`、`subscriptionOrderForm` 必须依次出现。
2. 先运行目标测试，确认它因为旧顺序失败。
3. 调整 `shop/account/index.html` 中 section 顺序，不改后端逻辑。
4. 运行前端静态测试、CSS 构建、全量测试和 diff 检查。

## 验收

- 「Token 用量」在「今日可用额度」进度条下方。
- 「模型价格」在「购买套餐」上方。
- 页面元素 id 不变，前端 JS 不需要改调用。
- 所有现有测试通过。
