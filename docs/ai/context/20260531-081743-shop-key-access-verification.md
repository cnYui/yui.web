# 商店结果页访问保护验证

## 本次补充

- `/shop/key/` 需要 `yui_shop_redeemed=1` cookie，否则后端直接跳转 `/shop/redeem/`。
- 兑换成功后后端通过 `Set-Cookie` 写入兑换态 cookie，前端继续展示本次兑换返回的完整 API key。
- `/shop/redeem/` 会清理兑换态 cookie，前端进入兑换页时也会清理最近一次订单缓存，避免重新兑换时误显示旧 key。
- 结果页新增 Codex CLI 配置说明，说明里的 API key 使用当前兑换得到的真实 key 动态替换。

## 验证结果

- `npm test`：9 个测试全部通过。
- `npm run build:css`：构建完成。
- `curl http://localhost:4173/shop/key/`：返回 `302 Location: /shop/redeem/`。
- `curl -H 'Cookie: yui_shop_redeemed=1' http://localhost:4173/shop/redeem/`：返回清理 cookie 的 `Set-Cookie`。
- 浏览器验证：无 cookie 访问 `/shop/key/` 会回到 `/shop/redeem/`。

## 数据清理

浏览器验证使用过一组临时演示数据，验证后已从 `orders`、`invite_codes`、`api_keys`、`users` 删除。
