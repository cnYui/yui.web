# 预置兑换码和 API Key 池设计

## 背景

用户希望提前把兑换码和 API key 都放进数据库。前端不能直接读取这些池数据。用户输入兑换码后，后端从未使用的 API key 池中取出一个，创建订单并开始 31 天倒计时。

## 新规则

- 兑换码先生成 10 个，写入数据库。
- API key 由用户提供 10 个，写入数据库。
- 兑换码唯一，不能重复。
- API key 唯一，不能重复。
- 兑换码被兑换后标记为 `redeemed`。
- API key 被分配后标记为 `used`，不能再分配给其他人。
- 一个订单绑定一个手机号、一个兑换码、一个 API key。

## 数据库设计调整

- `invite_codes` 不再保存 `api_key`，只保存兑换码状态和兑换关联。
- 新增 `api_keys` 表：
  - `api_key TEXT PRIMARY KEY`
  - `api_key_preview TEXT NOT NULL`
  - `status TEXT NOT NULL CHECK (status IN ('unused', 'used', 'disabled'))`
  - `created_at TEXT NOT NULL`
  - `used_at TEXT`
  - `order_id TEXT`
- `orders` 新增 `invite_code` 字段，用于追踪订单来源。

## 分配算法

- 兑换码：`SELECT ... FROM invite_codes WHERE code = ?`，`code` 是主键，精确匹配。
- API key：`SELECT ... FROM api_keys WHERE status = 'unused' ORDER BY created_at ASC LIMIT 1`。
- 分配过程放在 SQLite transaction 中，确保兑换码和 API key 状态、订单创建原子一致。

## 安全说明

- 前端只知道用户输入的邀请码和兑换后返回的 API key。
- 未使用的 API key 池只能通过管理员接口或人工数据库读取。
- 管理接口需要 `ADMIN_TOKEN`。
