# Shop 预充值余额实施记录

## 范围

- 新增预充值余额表、充值申请表、账户流水表和 API 扣费记录表。
- 新增用户充值申请、余额查询、流水查询和扣费记录查询接口。
- 新增管理员充值确认和拒绝接口。
- API key 状态接口按余额拦截调用。
- usage event 入库后按 `price_amount_micros` 扣余额。
- Account 页面展示余额、充值申请、扣费记录和账户流水。
- Admin 页面展示充值审核。

## 验证

- `npm test`：通过，66 个测试全部通过。
- `npm run build:css`：通过，仅有 caniuse-lite 过期提示。
- 临时数据库 HTTP 验证：通过，`/shop/account/` 和 `/shop/admin/` 在有效 session 下返回 200，页面包含新增账务容器。

## 重要边界

- 用户提交充值申请不自动入账。
- 管理员确认金额是最终入账金额。
- 余额小于等于 0 时 API key 状态返回 `insufficient_balance`。
- 调用后允许余额变负，负余额后下一次调用拒绝。
- 默认欠费上限为 10 元。
- usage event 重复上报不会重复扣费。
