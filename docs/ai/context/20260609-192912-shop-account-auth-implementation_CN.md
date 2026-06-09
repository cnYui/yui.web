# Shop 账号登录与个人中心实现记录

## 背景

本次实现承接 `20260609-185332-shop-account-auth-design_CN.md` 和 `20260609-185332-shop-account-auth-implementation-plan_CN.md`。目标是在 Shop 中加入手机号密码账号体系，让用户后续可以登录后查看自己的订单、月度用量和金额。

## 实际改动

- `server.js`
  - 新增 `yui_shop_account_session` 账号 session cookie。
  - 新增 `users.password_hash`、`users.password_created_at`、`users.updated_at` 字段。
  - 新增 `user_sessions` 表，只保存 session token hash，不保存原始 token。
  - 新增 `POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/account/me`。
  - 新增 `/shop/account/` 页面保护：未登录跳转 `/shop/login/`。
  - 新增 `/shop/login/`、`/shop/register/` 已登录跳转：已有 session 时跳转 `/shop/account/`。
  - 账号 session 过期时间解析失败时按无效 session 处理。
- `shop/shop.js`
  - 新增手机号输入规整、密码强度校验、登录页初始化、注册页初始化、账号页初始化、首页账号入口状态初始化。
  - 账号页调用 `/api/account/me`，只渲染当前手机号自己的订单。
  - 个人中心订单只展示 API key preview，不展示完整 API key。
- `shop/index.html`
  - 增加桌面导航、移动菜单和主 CTA 区的登录入口。
- `shop/login/index.html`
  - 新增手机号密码登录页。
- `shop/register/index.html`
  - 新增手机号密码注册页，要求密码至少 8 位，包含英文大写、英文小写和数字。
- `shop/account/index.html`
  - 新增个人中心页，包含当前登录手机号、订单列表和退出登录按钮。
- `test/shop-flow.test.js`
  - 新增账号 schema、注册校验、历史手机号补密码注册、登录失败、重复注册、退出登录、页面保护、个人订单隔离、无效 session 过期时间和静态入口测试。

## 安全边界

- 密码使用 Node `crypto.scryptSync` 生成 scrypt hash，数据库不保存明文密码。
- 账号 session 原始 token 只写入浏览器 `HttpOnly` cookie，数据库只保存 SHA-256 hash。
- Cookie 使用 `SameSite=Lax`，HTTPS 反代下自动启用 `Secure`。
- `/api/account/me` 必须登录，只按当前 session 的手机号查询订单。
- `/api/account/me` 返回的订单不包含完整 `apiKey`，只包含 `apiKeyPreview`。
- 兑换成功后查看完整 API key 的 result token 仍独立存在，不复用为账号登录凭证。

## MVP 限制

- 当前版本没有短信验证码。历史兑换手机号可以直接补密码注册，这适合先做本地和小范围 MVP；如果要向外部用户开放“用量”和“金额”等更敏感数据，必须增加短信验证码或等价的手机号归属校验。
- 当前版本没有找回密码流程。上线用户账号前需要补充密码重置能力。

## 验证记录

本轮实现后已重新运行：

- `npm test`：32 个测试全部通过。
- `npm run build:css`：构建成功；仅出现 Browserslist/caniuse-lite 过期提示。

本地页面检查目标：

- `/shop/`：HTTP 200，包含 `data-account-link` 和 `/shop/login/` 登录入口。
- `/shop/login/`：HTTP 200，包含 `loginForm`、手机号和密码输入框。
- `/shop/register/`：HTTP 200，包含 `registerForm`、密码规则和登录入口。
- `/shop/account/`：未登录 HTTP 302，跳转 `/shop/login/`。

说明：本地服务运行在 `http://localhost:4173`。页面检查没有在真实本地数据库中注册测试手机号，避免污染现有 Shop 数据。
