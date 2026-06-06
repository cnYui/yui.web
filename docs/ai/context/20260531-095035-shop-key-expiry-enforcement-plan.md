# 商店 API key 到期真实禁用设计

## 目标

当前 `yui.web` 只在商店订单里记录 `expires_at`，但真实模型请求由 `/Users/wujianxiang/CodeSpace/CLIProxyAPI` 转发。要让 31 天到期真正生效，必须在 `CLIProxyAPI` 的入站鉴权之后、转发模型请求之前拒绝过期的商店 API key。

## 设计

1. `yui.web` 新增内部状态接口：
   - 路径：`GET /api/internal/api-keys/status?apiKey=...`
   - 鉴权：只接受请求头 `x-internal-token`，值来自 `INTERNAL_TOKEN`
   - 返回：
     - 未导入商店池：`managed: false, active: false, status: "not_found"`
     - 已导入但未兑换：`managed: true, active: false, status: "unused"`
     - 已兑换且未过期：`managed: true, active: true, status: "active"`
     - 已兑换但已过期：`managed: true, active: false, status: "expired"`
     - 已禁用：`managed: true, active: false, status: "disabled"`

2. `CLIProxyAPI` 新增 post-auth middleware：
   - 从 `gin.Context["apiKey"]` 读取已通过原有鉴权的客户端 API key。
   - 通过 `SHOP_KEY_STATUS_URL` 和 `SHOP_KEY_STATUS_TOKEN` 调用 `yui.web` 内部接口。
   - `managed=false` 默认放行，避免影响 CLIProxyAPI 自有本地 key。
   - `managed=true && active=false` 直接拒绝，不再进入模型调用路径。
   - 状态接口不可用时 fail closed，避免公网售卖 key 在依赖故障时绕过到期限制。
   - 使用短 TTL 缓存，减少每个模型请求都打到 `yui.web`。

## 测试计划

1. `yui.web` 先写失败测试：
   - 无内部 token 拒绝。
   - 错误内部 token 拒绝。
   - 未导入 key 返回 `not_found` 且 `managed=false`。
   - 未兑换 key 返回 `unused`。
   - 未过期订单 key 返回 `active`。
   - 已过期订单 key 返回 `expired`。

2. `CLIProxyAPI` 先写失败测试：
   - 未配置 `SHOP_KEY_STATUS_URL` 时不改变现有行为。
   - `managed=false` 放行。
   - `managed=true, active=true` 放行。
   - `managed=true, active=false` 拒绝。
   - 状态接口错误时拒绝。

## 运行配置

`yui.web/.env`：

```env
INTERNAL_TOKEN=<强随机共享密钥>
```

`CLIProxyAPI/.env` 或运行环境：

```env
SHOP_KEY_STATUS_URL=http://127.0.0.1:4173/api/internal/api-keys/status
SHOP_KEY_STATUS_TOKEN=<同一个强随机共享密钥>
```

修改后需要重启 `yui.web` 和 `CLIProxyAPI`，让两个服务读取新的环境变量。
