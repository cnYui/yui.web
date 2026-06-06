# 商店兑换码无法兑换排查计划

## 问题

兑换码 `YUI-CDAO5B-DDF7D6` 当前无法在 `yui.web` 的 shop 页面换出 API key。需要确认问题出在兑换码数据、API key 池、订单状态、接口逻辑，还是 `CLIProxyAPI` 的 API key 管理联动。

## 必须事实

- 该兑换码是否存在于 `invite_codes`。
- 该兑换码是否已被标记为已兑换或禁用。
- `api_keys` 池是否仍有 `unused` key 可分配。
- 兑换接口实际连接的是哪一个 SQLite 数据库。
- 前端传参与后端校验是否一致。
- 如已分配 API key，需要确认是否已经同步进入 `CLIProxyAPI` 的入站 `api-keys`。

## 排查顺序

1. 阅读 `server.js`、shop 前端脚本和测试，确认兑换流程。
2. 查询本地 shop SQLite 表结构和指定兑换码状态。
3. 用本地接口复现兑换请求，定位返回错误。
4. 如果是数据问题，优先做最小数据修复；如果是逻辑问题，补测试后改代码。

## 决策原则

- 不绕过兑换事务，不手工发放未入账 API key。
- 不暴露完整 API key，只使用 preview 或计数确认状态。
- 若涉及 `CLIProxyAPI` 配置，只做必要核对，避免误改账号池。
