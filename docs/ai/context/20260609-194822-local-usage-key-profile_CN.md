# 本地 usage key 归属映射记录

## 背景

管理员用量面板中，CLIProxyAPI 上报的 usage event 如果无法匹配 Shop 托管 `api_keys` 表，会被归类为“未托管”。用户当前自己的本地 `LOCAL` API key 也属于这种情况，但希望它显示为 `local` 分组，并绑定到手机号 `15951875192`，方便后续在个人视角中继续扩展用量归属。

## 设计取舍

- 不把本地 key 伪造成 Shop 订单。
- 不要求完整 API key，只使用 usage event 中已有的 `api_key_hash` 做稳定关联。
- 新增 `usage_key_profiles` 表保存本地归属覆盖：
  - `api_key_hash`
  - `api_key_preview`
  - `group_name`
  - `phone`
- 当前只允许 `local` 分组，并要求绑定合法手机号。
- Shop 托管 key 仍优先按 Shop 订单归属；profile 只影响未匹配 Shop 库存的 usage key。

## 当前绑定

- 手机号：`15951875192`
- 分组：`local`
- API key preview：`sk-L...8804`
- API key hash：`65d3c9fe55c3a4d32b3e40d10f334d4acf5f1459f4778a16fb1d8f18711ceecd`
- 修改前数据库备份：`data/backups/shop-before-local-profile-20260609-194920.sqlite`

## 验证目标

- `GET /api/admin/usage-summary?group=local` 能返回该 key。
- 返回项包含 `group: "local"` 和 `phone: "15951875192"`。
- 原 Shop 托管 key 的归属不受影响。
- 测试覆盖管理员创建 local profile 的行为。

## 验证结果

- `npm test`：33 个测试通过。
- `npm run build:css`：构建成功；仅出现 Browserslist/caniuse-lite 过期提示。
- 本地 API 验证：`GET /api/admin/usage-summary?group=local` 返回 1 条，包含 `group: "local"`、`phone: "15951875192"`、`api_key_preview: "sk-L...8804"`。
