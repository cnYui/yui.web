# Shop 兑换流程 TDD 验证计划

## 背景

用户要求按 TDD 跑通从手机号和邀请码兑换 API key，到手机号查询订单，再确认 SQLite 数据库中确实存在对应数据的完整流程。同时需要补充手机号输入格式限制，并讨论邀请码匹配算法。

## 测试目标

- 管理接口生成邀请码和 API key。
- 用户输入手机号和邀请码后，兑换接口返回 API key。
- SQLite 中写入：
  - `users.phone`
  - `invite_codes.status = redeemed`
  - `orders.phone`
  - `orders.api_key`
  - `orders.expires_at`
- 手机号查询接口能查回对应订单。
- 手机号格式错误时后端拒绝。
- 兑换页手机号输入框有 `maxlength`、`pattern` 等前端约束。

## 设计判断

- 手机号校验必须前后端都有：前端提升体验，后端保证安全。
- 邀请码匹配使用 SQLite `code TEXT PRIMARY KEY` 的精确查询 `WHERE code = ?`。
- 不需要额外“快速算法”：主键索引会走 SQLite B-tree 索引，比应用层遍历数组更可靠，也避免近似匹配导致误兑。
- 邀请码是用户输入凭证，必须一比一精确匹配；模糊匹配或相似度匹配会带来安全风险。
