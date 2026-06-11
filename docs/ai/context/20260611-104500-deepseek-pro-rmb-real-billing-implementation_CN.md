# DeepSeek Pro 人民币真实扣费实施记录

## 目标

把 Shop 的真实扣费依据从上游 `price_amount_micros` 改为 yui.web 内部固定的 DeepSeek V4 Pro 人民币价格，并在 Account/Admin 页面展示真实账务拆分。

固定价格版本：

- `deepseek-v4-pro-rmb-20260424`
- 缓存命中输入：25 nanos/token
- 缓存未命中输入：3000 nanos/token
- 输出：6000 nanos/token
- `1 元 = 1,000,000,000 nanos`

## 实际改动

- `server.js`
  - 新增 `usage_events.cache_hit_input_tokens`、`usage_events.cache_miss_input_tokens`。
  - 新增 `account_balances`、`account_ledger_entries`、`api_charge_records` 的 nanos 字段。
  - 充值、余额、流水、扣费记录同步写入 nanos 和旧 cents 兼容字段。
  - `normalizeUsageEvent()` 支持 DeepSeek 原生字段、CLIProxyAPI 新字段、旧 JSONL `cached_tokens` 推导未命中输入。
  - API 扣费改为固定人民币 nanos 公式，不再信任 usage event 的 `price_amount_micros` 或 `price_currency`。
  - `reasoning_tokens` 只展示，不重复计费。
  - Account/Admin usage summary 新增 `billing`：今日消费、本月消费、缓存命中输入、缓存未命中输入、输出 token、最近扣费明细。

- `shop/account/index.html`
  - 新增个人消费概览容器。
  - 扣费流水容器增加移动端宽度约束。

- `shop/admin/index.html`
  - 新增全站消费概览容器和最近扣费明细容器。
  - 表格滚动容器补充 `min-w-0`，日志导入长路径允许断行。

- `shop/shop.js`
  - 新增 nanos 金额格式化。
  - 新增消费概览卡片渲染。
  - 扣费明细展示命中输入、未命中输入、输出、Reasoning、费用、扣后余额和状态。
  - Account/Admin 页面接入 summary.billing。

- `test/shop-flow.test.js`
  - 覆盖 schema、DeepSeek RMB nanos 扣费、旧 usage event 兼容、Account/Admin billing summary、页面容器。
  - 更新旧 `price_amount_micros` 断言为真实人民币 nanos 口径。

## 验证

- `node --test --test-name-pattern='DeepSeek 人民币 nanos 扣费字段' test/shop-flow.test.js` 通过。
- `node --test --test-name-pattern='DeepSeek Pro 人民币 nanos|旧 usage event' test/shop-flow.test.js` 通过。
- `node --test --test-name-pattern='管理员 usage summary 返回 Shop 和未托管 key 的聚合用量|Account usage summary 只聚合当前登录手机号关联的 token 用量' test/shop-flow.test.js` 通过。
- `npm test` 通过，69 个测试全部通过。
- `npm run build:css` 通过；仅有 Browserslist 过期提示。
- 浏览器验证：
  - Account 页面显示今日/本月消费、三段 token、扣费明细。
  - Admin 页面显示全站今日/本月消费、三段 token、最近扣费明细。
  - Admin 手机宽度 390px 下 `scrollWidth = clientWidth = 390`。

## 注意

- 旧 cents 字段只做兼容展示和旧接口兼容；账务事实以 nanos 字段为准。
- 最近扣费明细来自 `api_charge_records`，消费汇总只累计 `status = 'charged'` 的记录。
- 未托管 usage event 如果没有绑定手机号，不会生成账户扣费记录，因此不会进入真实消费汇总。
