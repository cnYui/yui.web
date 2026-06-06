# 商店结果页 result token 会话设计

## 问题

当前 `/shop/key/` 只用一个“兑换过”的 cookie 做门禁，并且前端把最近订单保存在 `localStorage`。公网多人使用时，同一浏览器环境可能看到上一位用户留下的 API key；cookie 也没有绑定具体订单。

## 必须满足

- 兑换成功后生成一个随机 `result_token`，只绑定本次订单。
- `result_token` 写入数据库，并通过 HttpOnly cookie 发给浏览器。
- `/shop/key/` 只能在 cookie token 对应有效订单时访问。
- 结果页通过后端接口读取“当前 token 对应的订单”，不再从 `localStorage` 读取完整 API key。
- 进入兑换页时清理 result token cookie，方便下一位用户重新兑换。

## 数据结构

`orders` 新增：

- `result_token TEXT`

并创建唯一索引：

- `idx_orders_result_token_unique`

旧订单允许 `result_token` 为空；新兑换订单必须写入 token。

## 接口

- `POST /api/invites/redeem`
  - 创建订单时生成 `result_token`。
  - 设置 `yui_shop_result_token` HttpOnly cookie。
- `GET /api/orders/current`
  - 从 cookie 读取 token。
  - 查到订单才返回完整 API key。
  - 无 token 或 token 无效返回 `401`。
- `GET /shop/key/`
  - 服务端校验 token。
  - 无效则跳转 `/shop/redeem/`。

## Tradeoff

- 这不是完整账号系统，只解决“兑换完成后的结果页会话隔离”。
- 手机号查询页仍保留按手机号查询订单，这是当前业务的唯一找回方式。
