# 删除未使用的历史 codex_yui Shop 记录

## 背景

用户确认手机号 `13800138009` 对应的历史 `codex_yui_` API key 已不再使用，需要从 Shop 数据库删除。

## 删除范围

数据库：`data/shop.sqlite`。

删除前脱敏统计：

- `users`：1 条。
- `orders`：1 条。
- `api_keys`：1 条，预览为 `codex_yui_As...3auw4x`。
- `user_sessions`：0 条。
- `usage_events`：0 条。
- `usage_key_profiles`：0 条。

执行删除时使用事务，并按该手机号关联的 API key hash 清理可能存在的 usage/profile 记录。

## 验证结果

删除后脱敏统计：

- `users`：0 条。
- `orders`：0 条。
- `api_keys`：0 条。
- `user_sessions`：0 条。
- `usage_events`：0 条。
- `usage_key_profiles`：0 条。

本地管理接口验证：

- `GET /api/admin/usage-summary` 返回 `200`。
- 返回项中不再包含手机号 `13800138009`。
- 返回项中不再包含 `codex_yui_As...3auw4x`。

## 结论

该历史 Shop 账号、订单和 API key 已从本地 SQLite 数据库删除。其他 Shop 订单仍保留。
