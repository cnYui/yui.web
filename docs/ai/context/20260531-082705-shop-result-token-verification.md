# result token 会话验证记录

## 改动结果

- 新增 `orders.result_token` 和唯一索引 `idx_orders_result_token_unique`。
- 兑换成功后写入 `yui_shop_result_token` HttpOnly cookie。
- `/shop/key/` 只接受数据库中存在的 result token。
- `/api/orders/current` 只返回当前 cookie token 绑定的订单。
- 前端结果页不再使用 `localStorage` 保存或读取完整 API key。

## 验证

- `npm test`：10 个测试全部通过。
- `npm run build:css`：构建完成。
- 本机：
  - 无 token 访问 `/shop/key/` 返回 `302 /shop/redeem/`。
  - 假 token 访问 `/shop/key/` 返回 `302 /shop/redeem/`。
  - 无 token 访问 `/api/orders/current` 返回 `401 CURRENT_ORDER_NOT_FOUND`。
- 公网：
  - `https://aaccx.pw/shop/key/` 无 token 返回 `302 /shop/redeem/`。
  - `https://aaccx.pw/api/orders/current` 无 token 返回 `401 CURRENT_ORDER_NOT_FOUND`。
- 浏览器：
  - 直接打开 `http://localhost:4173/shop/key/` 会落到 `/shop/redeem/`。

## 临时数据

验证时用临时兑换码和临时 API key 跑了一次真实兑换，然后已删除对应 `orders`、`invite_codes`、`api_keys`、`users` 数据。正式库存仍为 9 组未使用，无重复。
