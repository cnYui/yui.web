# 商店 API key 状态接口实现记录

## 背景

`CLIProxyAPI` 需要在真实模型请求路径中判断商店售出的 API key 是否仍然有效。`yui.web` 的 SQLite 订单表是兑换和到期时间的事实来源，因此新增一个仅供内部服务调用的状态接口。

## 已实现

- 新增 `GET /api/internal/api-keys/status?apiKey=...`
- 只接受请求头 `x-internal-token`
- token 来源：
  - 测试中可通过 `createShopApp({ internalToken })` 注入
  - 线上通过 `.env` 的 `INTERNAL_TOKEN` 配置
- 不接受 query token，避免 token 出现在 URL、日志或浏览器历史里
- 返回状态：
  - `not_found`：未进入商店 API key 池，`managed=false`
  - `unused`：已导入但未兑换，`managed=true, active=false`
  - `active`：已兑换且未过期，`managed=true, active=true`
  - `expired`：已兑换但已过期，`managed=true, active=false`
  - `disabled`：被手动禁用，`managed=true, active=false`

## 安全边界

接口不返回手机号、订单 ID 或完整订单信息，只返回 CLIProxyAPI 判断是否放行请求所需的最小状态。

## 验证

已通过：

```bash
node --test test/shop-flow.test.js
```
