# 兑换完成页说明移除与邀请码清理验证

## 改动

- `/shop/key/` 的前端脚本不再渲染“Codex 配置使用方法”模块。
- 使用方法只保留在公开页面 `/shop/guide/`。
- 清理 SQLite 中 `invite_codes.status != 'unused'` 的邀请码记录。

## 数据状态

- `invite_codes`：只剩 `unused = 8`。
- `invite_codes.code`：无重复。
- `api_keys`：保留 `unused = 8` 和 `used = 3`。
- `orders`：保留 3 条历史订单，用于手机号查询和已分配 API key 记录。

## 验证

- `npm test`：11 个测试全部通过。
- `npm run build:css`：构建完成。
- 本机 `/shop/shop.js` 中只保留 `/api/orders/current`，没有结果页使用方法渲染逻辑。
- 公网 `/shop/shop.js?v=20260531-0823` 已返回更新后的脚本。
