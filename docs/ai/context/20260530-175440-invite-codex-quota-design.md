# Codex 月额度邀请码兑换设计

## 背景

支付宝和微信官方直连支付对个人主体不友好，本项目改为私下收款后发放邀请码。用户在网站中输入手机号和邀请码，兑换后获得一个 API key。手机号是唯一查询方式，查询页按 API key 展示订单，一个 API key 对应一个订单。

## 商品规则

- 商品：Codex 每月额度。
- 价格：30 元人民币 / 月。
- 有效期：兑换成功后开始计时 31 天。
- 到期后：该 API key 失效。
- 续费方式：用户重新付款，站长生成新的邀请码和新的 API key。

## 页面调整

- `/shop/`：介绍 Codex 每月额度、价格、流程和有效期。
- `/shop/redeem/`：输入手机号和邀请码，兑换 API key。
- `/shop/key/`：兑换成功后展示 API key、到期时间和复制入口。
- `/shop/query/`：输入手机号，查询该手机号下的订单列表；每个订单按 API key 单独展示。
- `/shop/admin/`：站长输入管理员 token，生成邀请码和对应 API key。
- `/shop/order/`：兼容旧路径，跳转到 `/shop/redeem/`。
- `/shop/pay/`、`/shop/result/`：兼容旧路径，提示支付流程已移除并引导兑换。

## 后端数据模型

本地开发阶段使用 JSON 文件持久化，生产环境应替换为数据库。

- `invites[]`
  - `code`：邀请码。
  - `apiKey`：兑换后交付给用户的 API key。
  - `status`：`unused`、`redeemed`、`disabled`。
  - `createdAt`。
  - `redeemedAt`。
  - `expiresAt`。
  - `phone`。
  - `orderId`。
- `orders[]`
  - `id`。
  - `phone`。
  - `apiKey`。
  - `apiKeyPreview`。
  - `status`：动态计算，未过期为 `active`，过期为 `expired`。
  - `redeemedAt`。
  - `expiresAt`。
  - `amount`：30。
  - `productName`：Codex 每月额度。

## 后端接口

- `POST /api/admin/invites`：生成邀请码和 API key，需要 `ADMIN_TOKEN`。
- `GET /api/admin/invites`：查看邀请码列表，需要 `ADMIN_TOKEN`。
- `POST /api/invites/redeem`：手机号 + 邀请码兑换 API key。
- `GET /api/orders?phone=手机号`：手机号查询订单。

## 安全取舍

- 管理接口必须使用 `ADMIN_TOKEN`，避免任何人生成邀请码。
- 当前为了满足查询订单和展示 API key 的需求，本地 JSON 会保存完整 API key。生产环境更安全的做法是只在兑换成功时展示完整 key，查询页只展示尾号。
- API key 到期逻辑由服务端按 `expiresAt` 动态判断，避免依赖前端时间。
