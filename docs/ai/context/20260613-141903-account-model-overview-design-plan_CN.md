# Account 模型总览设计与计划

## 背景

用户希望在 `/shop/account/` 的账户余额顶部新增「模型总览」，展示当前中转站提供的模型和计费价格。计费必须沿用当前人民币价格表，并区分 `gpt-5.4` 与 `gpt-5.5`；未知模型按 `gpt-5.4` 价格展示和计费。

## 当前模型端点验证

- 使用 `data/shop.sqlite` 中最近兑换的托管 API key preview `sk-yui-oDUW3...vpe3s4` 请求本机中转站 `http://127.0.0.1:8317/v1/models`。
- 返回 HTTP 200。
- 当前模型数为 5：
  - `codex-auto-review`
  - `gpt-5.3-codex-spark`
  - `gpt-5.4`
  - `gpt-5.4-mini`
  - `gpt-5.5`

## 方案比较

1. 后端新增账户只读接口，前端渲染表格。
   - 优点：完整 API key 只在服务端读取和使用；价格源复用 `lib/shop-pricing.js`；可测试、可回退。
   - 缺点：需要新增一个接口。
2. 前端直接请求 `/v1/models`。
   - 优点：实现少。
   - 缺点：浏览器需要接触完整 API key 或额外代理鉴权，不符合当前 Shop 安全边界。
3. 页面硬编码模型列表和价格。
   - 优点：最简单。
   - 缺点：无法反映当前中转站真实可用模型，容易和后端计费价格漂移。

采用方案 1。

## 设计

- 新增 `GET /api/account/model-overview`，必须登录。
- 后端从当前账号已兑换订单中读取第一把可解密的 API key，请求模型端点。
- 模型端点地址优先使用 `options.modelListBaseUrl` 或 `CLIPROXY_BASE_URL`，默认 `http://127.0.0.1:8317/v1`。
- 如果账号没有 API key、模型端点不可用或返回异常，接口仍返回价格表模型，`source` 标记为 `pricing_fallback`。
- 接口返回每个模型的：
  - `id`
  - `available`
  - `priceModel`
  - `usesDefaultPrice`
  - `priceVersion`
  - `cacheHitInputCnyPerMillion`
  - `cacheMissInputCnyPerMillion`
  - `outputCnyPerMillion`
- 前端在账户余额 section 的内容顶部渲染「模型总览」表格，列为模型、状态、缓存命中输入 / 1M、未命中输入 / 1M、输出 / 1M、计价。
- 未知模型显示 `沿用 gpt-5.4`，但保留原始模型名。

## 测试计划

1. 先写失败测试：
   - Account 页面存在 `accountModelOverview`，且位于 `accountBalanceCards` 前。
   - Account 初始化会请求 `/api/account/model-overview` 并渲染表格。
   - 未登录访问 `/api/account/model-overview` 返回 401。
   - 登录后接口返回实时模型列表与人民币价格，未知模型沿用 `gpt-5.4`。
2. 实现最小后端和前端代码。
3. 跑目标测试和全量 `npm test`。
4. 使用数据库中的托管 API key 再次请求本机模型端点，记录模型列表。

## 风险与取舍

- 模型端点探测失败不能影响账户页核心账务信息，因此接口提供价格表回退。
- 不在浏览器暴露完整 API key。
- 第一版不做模型端点结果缓存；账户页访问量低，先保持简单。
