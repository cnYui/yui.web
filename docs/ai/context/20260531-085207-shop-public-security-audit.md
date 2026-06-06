# Shop 公网安全排查

## 已确认并修复

### P0：SQLite 数据库被静态服务暴露

问题：`express.static(rootDir)` 会把 `data/shop.sqlite` 作为静态文件返回。公网访问 `/data/shop.sqlite` 可以下载数据库。

修复：

- 静态服务前增加敏感路径拦截。
- 禁止 `/data`、`/.env`、`/.git`、`/node_modules`、`/docs/ai` 等路径。
- 测试覆盖 `/data/shop.sqlite` 返回 404。

### P0：公网运行使用弱管理员 token

问题：当前服务曾使用 `ADMIN_TOKEN=dev-token` 启动，公网请求带 `x-admin-token: dev-token` 可访问管理接口。

修复：

- 生成随机强 token 写入本机 `.env`。
- 重启服务时不再通过命令行传 `ADMIN_TOKEN=dev-token`。
- 管理 token 只允许通过 `x-admin-token` 请求头提交，禁用 URL query token。
- 测试覆盖 query token 不可用。

### P1：批量撞库风险

问题：邀请码兑换和手机号查询没有限流，攻击者可以批量尝试邀请码或手机号。

修复：

- 管理接口、兑换接口、查询接口增加内存限流。
- API 响应增加 `Cache-Control: no-store`。
- 增加 `X-Content-Type-Options: nosniff` 和 `Referrer-Policy: same-origin`。

## 仍存在的产品级风险

### P1：手机号查询返回完整 API key

当前业务要求手机号是唯一查询方式，并且查询页展示完整 API key。这意味着只要攻击者知道某个用户手机号，就可以直接查询该手机号下的完整 API key。

这不是邀请码绕过，而是“找回 API key 的认证因子太弱”。

可选方案：

- 查询页只展示订单和 masked key，不展示完整 API key。
- 完整 key 只能在兑换完成后的 result token 会话页查看一次。
- 如果要长期找回完整 key，需要增加第二因子：短信验证码、查询密码、邮箱验证码，或购买后单独生成的查询码。

## 验证

- `npm test`：16 个测试全部通过。
- 公网 `/data/shop.sqlite` 返回 404。
- 公网 `x-admin-token: dev-token` 返回 401。
- 公网 `?adminToken=dev-token` 返回 401。
- 公网 `/api/orders/current` 无 result token 返回 401。
