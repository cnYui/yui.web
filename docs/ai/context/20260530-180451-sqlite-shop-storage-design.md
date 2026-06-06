# Shop SQLite 存储设计

## 背景

当前邀请码、手机号和订单使用 JSON 文件保存，只适合演示。用户确认要使用本地 SQLite，并明确手机号是用户主键，一个手机号可以对应多个 API key。

## 数据模型

### users

手机号作为用户主键。

```sql
CREATE TABLE users (
  phone TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
```

### invite_codes

邀请码表。每个邀请码绑定一个预生成 API key，兑换后关联手机号和订单。

```sql
CREATE TABLE invite_codes (
  code TEXT PRIMARY KEY,
  api_key TEXT NOT NULL UNIQUE,
  api_key_preview TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unused', 'redeemed', 'disabled')),
  created_at TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_by_phone TEXT,
  order_id TEXT
);
```

### orders

订单表。一个 API key 只对应一个订单，一个手机号可以对应多个订单。

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  api_key_preview TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);
```

## 查询规则

- 手机号查询订单：

```sql
SELECT *
FROM orders
WHERE phone = ?
ORDER BY redeemed_at DESC;
```

- API key 状态由 `expires_at` 动态判断：
  - 当前时间小于 `expires_at`：`active`
  - 当前时间大于等于 `expires_at`：`expired`

## 业务规则

- 用户私下付款后，站长生成邀请码和 API key。
- 用户兑换时必须输入手机号和邀请码。
- 兑换成功时写入 `users` 和 `orders`。
- API 使用时间从兑换成功时开始计时，持续 31 天。
- 用户续费时获得新的邀请码，兑换后生成新的订单和新的 API key。
