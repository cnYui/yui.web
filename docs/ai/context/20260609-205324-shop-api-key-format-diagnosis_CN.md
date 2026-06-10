# Shop API Key 格式排查记录

## 背景

用户在 `/shop/admin/` 看到手机号 `13800138009` 的 Shop key 预览为 `codex_yui_As...3auw4x`，需要确认为什么不是后续导入库存里常见的 `sk-...` 格式。

## 数据库检查

数据库：`data/shop.sqlite`。

脱敏查询结果：

- `users`：存在手机号 `13800138009`，创建时间 `2026-05-30T10:01:50.259Z`。
- `orders`：存在 1 条订单，`api_key_preview = codex_yui_As...3auw4x`，完整 key 长度为 42，前缀为 `codex_yui_`，`invite_code` 为空。
- `api_keys`：对应 key 状态为 `used`，创建时间 `2026-05-30T10:01:50.114Z`，使用时间 `2026-05-30T18:01:50.259+08:00`，关联订单 `ORDER353102596040`。
- `usage_events`：该 key 当前没有用量事件记录。
- `invite_codes`：没有与该订单或手机号关联的邀请码记录。

## 代码依据

`server.js` 中仍保留历史生成函数：

```js
function createApiKey() {
    return `codex_yui_${crypto.randomBytes(24).toString('base64url')}`;
}
```

当前预览规则为：

```js
function keyPreview(apiKey) {
    if (!apiKey) return '';
    return `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}`;
}
```

因此完整 key 如果以 `codex_yui_` 开头，管理员页面会显示成类似 `codex_yui_As...3auw4x`。

## 结论

该账号的 API Key 是早期 Shop 流程自动生成的历史 key，不是当前后续导入的 `sk-...` API key 库存。

判断依据：

- 该订单时间是 `2026-05-30T18:01:50.259+08:00`，早于后续 `sk-...` 库存批量创建时间。
- 该订单 `invite_code` 为空；当前新流程会要求手机号加邀请码兑换，并把 `invite_code` 写入订单。
- 数据库只有这一条 `codex_yui_` 前缀 key，其他 Shop 已使用 key 都是 `sk-...` 前缀。

这不是页面格式化错误。页面显示的是 `api_key_preview`，即完整 key 的前 12 位和后 6 位脱敏预览。
