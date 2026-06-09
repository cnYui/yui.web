# Shop 账号登录与个人中心设计

## 背景

Shop 已经具备邀请码兑换、手机号查询、管理员用量监控和 CLIProxyAPI usage event 接收能力。当前用户只能通过手机号公开查询订单，或通过兑换后的 result token 临时查看完整 API key；这不足以支撑后续“用户登录后只看自己的月度用量和金额”。

本设计把“用户身份”独立出来：手机号成为登录账号，账户 session 控制 `/shop/account/` 和用户侧 API。CLIProxyAPI 仍只负责上报 usage event，不参与用户登录。

## 目标

- Shop 首页增加登录入口；已登录时显示“我的账户”入口。
- 用户可以用中国大陆手机号注册和登录。
- 注册需要密码与确认密码。
- 密码必须满足规则：长度至少 8 位，包含英文小写字母、英文大写字母和数字。
- 密码只保存哈希，不保存明文。
- 登录成功后进入 `/shop/account/`。
- `/shop/account/` 只展示当前登录手机号自己的订单。
- 用户可以退出登录。
- 该账号体系后续可以承接用户个人 token 用量、每日图表、月度金额等功能。

## 非目标

- 本次不做短信验证码。
- 本次不做找回密码。
- 本次不做用户侧 usage 图表，只预留清晰身份边界。
- 本次不替换现有管理员 token 后台。
- 本次不移除现有手机号订单查询页；它可以继续作为旧入口存在。

## 方案选择

### 推荐方案：SQLite 用户密码 + 服务端 session

在现有 `server.js` 内扩展 SQLite schema：

- `users` 表新增 `password_hash`、`password_created_at`、`updated_at`。
- 新增 `user_sessions` 表，保存 session token 的 SHA-256 哈希、手机号、创建时间、过期时间和撤销时间。
- 浏览器 cookie 只保存随机 session token；数据库只保存 token hash。

优点：

- 不需要引入第三方认证服务。
- 和现有 Shop SQLite 数据、测试方式一致。
- 服务端可以主动撤销 session，适合退出登录和后续安全控制。

取舍：

- 没有短信验证时，手机号归属不能被强证明。MVP 先用“知道手机号和密码”作为账户凭证；后续如果进入正式商用，应补短信验证码或一次性登录码。

### 备选方案：只用手机号验证码

优点是手机号归属更强，缺点是需要短信服务、成本和失败链路。当前项目还没有短信供应商，不适合 MVP。

### 备选方案：无状态 JWT

优点是实现少一张 session 表，缺点是退出登录和强制失效更麻烦。后续用户用量涉及账单视图，服务端 session 更稳。

## 数据模型

`users`：

- `phone TEXT PRIMARY KEY`
- `created_at TEXT NOT NULL`
- `password_hash TEXT`
- `password_created_at TEXT`
- `updated_at TEXT`

`user_sessions`：

- `token_hash TEXT PRIMARY KEY`
- `phone TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `revoked_at TEXT`
- 外键 `phone` 指向 `users(phone)`

现有订单仍通过 `orders.phone` 关联用户。注册不会要求已有订单；没有订单的账号进入个人中心时显示空状态。兑换时已有 `ensureUser`，需要保留已有用户的密码字段。

## 密码与 session

密码哈希使用 Node 内置 `crypto.scryptSync`：

- 随机 16 字节 salt。
- 保存格式：`scrypt$16384$8$1$<saltBase64Url>$<hashBase64Url>`。
- 校验时解析参数并使用 `timingSafeEqual` 比较。

session：

- Cookie 名称：`yui_shop_account_session`。
- 有效期：31 天，与当前商品周期一致。
- Cookie 属性：`httpOnly`、`sameSite=lax`、HTTPS 下 `secure`、`path=/`。
- Logout 时设置 `revoked_at` 并清理 cookie。

## 后端接口

`POST /api/auth/register`

- 入参：`phone`、`password`、`confirmPassword`。
- 校验手机号、密码规则、确认密码一致。
- 新手机号创建用户；已有且已经设置密码则返回 409。
- 若手机号因历史兑换已存在但没有密码，则补充密码并完成注册。
- 注册成功后创建 session，返回 `{ user: { phone } }`。

`POST /api/auth/login`

- 入参：`phone`、`password`。
- 校验手机号和密码。
- 成功后创建 session，返回 `{ user: { phone } }`。

`POST /api/auth/logout`

- 读取当前 session，撤销并清 cookie。
- 即使没有 session 也返回 200，便于前端幂等处理。

`GET /api/account/me`

- 必须登录。
- 返回当前用户手机号与该手机号订单列表。
- 订单复用 `publicOrder`，但个人中心先只展示 key preview，不返回完整 API key；完整 key 仍保留在兑换结果页和旧查询页。

页面保护：

- `GET /shop/account/` 未登录时 302 到 `/shop/login/`。
- 登录页和注册页已登录时可以直接跳转账户页。

## 前端页面

新增页面：

- `/shop/login/`：手机号 + 密码登录，提供注册链接。
- `/shop/register/`：手机号、密码、确认密码注册，展示密码规则。
- `/shop/account/`：展示当前手机号、订单列表、退出按钮。

更新页面：

- `/shop/` 桌面导航、移动菜单和主 CTA 加入账号入口。
- 账号入口默认文案为“登录”，前端加载后通过 `/api/account/me` 判断已登录则改为“我的账户”。

## 安全边界

- 不通过 URL query 识别用户身份。
- 不在前端 localStorage/sessionStorage 保存 session 或密码。
- 不把完整 API key 放进个人中心 API。
- 所有 auth/account API 使用 `Cache-Control: no-store`。
- 登录/注册走限流，避免密码暴力尝试。
- session token 只存 hash，数据库泄漏时不能直接拿 cookie 使用。

## 测试策略

新增 Node test 覆盖：

- 数据库迁移包含用户密码字段和 `user_sessions`。
- 注册校验手机号、密码规则、确认密码。
- 注册成功设置 `HttpOnly` account session cookie。
- 已存在历史兑换用户可以补密码注册。
- 登录成功和错误密码失败。
- `/shop/account/` 未登录重定向，登录后可访问。
- `/api/account/me` 只返回当前登录手机号的订单。
- logout 撤销 session 并清 cookie。
- Shop 首页包含登录入口。

## 后续接入用量图表

用户用量图表应以 account session 中的 `phone` 为唯一身份来源：

1. 通过 `orders.phone` 找到用户拥有的 Shop-managed API key。
2. 用 `api_keys.api_key_hash` 关联 `usage_events`。
3. 聚合今日、本月、每日日历热力图和模型明细。

未托管本地 key 仍只在管理员全局视角展示，除非未来额外绑定到某个用户账号。
