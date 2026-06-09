# Remove Personal Shop Keys

## 背景

用户要求从 Shop 管理后台中移除个人手机号 `159****5192` 关联的两条托管 API key。当前实际使用量来自未托管的本地 key，不应再把这两条旧 Shop key 显示为该手机号名下的有效托管 key。

## 操作

- 已用 SQLite `.backup` 创建备份：
  - `data/backups/shop-before-remove-15951875192-20260609-155627.sqlite`
- 从 `data/shop.sqlite` 删除该手机号关联的 2 条 `orders`。
- 删除对应的 2 条 `api_keys` 库存记录。
- 删除该手机号在 `users` 表中的记录。
- `invite_codes` 中没有对应行，因此没有删除邀请码记录。

## 删除对象

- `sk-621d57ac0...8b6b5b`
- `sk-0f2bcc8db...9535bd`

## 验证

- `orders` 中该手机号剩余记录数为 0。
- `users` 中该手机号剩余记录数为 0。
- 管理员 usage summary 中该手机号剩余 item 数为 0。
- 当前用量仍显示为未托管 key，不受本次清理影响。
