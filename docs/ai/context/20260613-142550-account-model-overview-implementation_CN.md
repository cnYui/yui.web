# Account 模型总览实施记录

## 实施内容

- `/shop/account/` 的账户余额区域顶部新增「模型总览」栏目，位于余额卡片前。
- 前端新增 `renderAccountModelOverview`，以表格展示模型、状态、缓存命中输入价格、未命中输入价格、输出价格和计价规则。
- 新增 `GET /api/account/model-overview`，需要登录态。
- 后端通过当前账号已兑换订单的托管 API key 请求模型端点 `/v1/models`。
- 模型端点默认使用 `http://127.0.0.1:8317/v1`，可通过 `CLIPROXY_BASE_URL` 或测试注入的 `modelListBaseUrl` 覆盖。
- 价格统一复用 `lib/shop-pricing.js` 中的 `gptModelRmbPrices` 与 `priceForModel`。
- 未知模型展示为沿用 `gpt-5.4`，与真实计费回退规则一致。
- 模型端点不可用或账号暂无 API key 时，接口回退到价格表模型，避免影响账户余额展示。

## 当前模型端点复测

- 使用数据库中最近兑换托管 API key preview `sk-yui-oDUW3...vpe3s4` 请求 `http://127.0.0.1:8317/v1/models`。
- 返回 HTTP 200。
- 模型列表：`codex-auto-review`、`gpt-5.3-codex-spark`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.5`。

## 验证

- 已按 TDD 先补失败测试，再实现。
- 目标测试 `node --test --test-name-pattern "模型总览|预充值余额" test/shop-flow.test.js` 通过。
- 已执行 `npm run build:css`，同步更新 `styles/site.css`。
