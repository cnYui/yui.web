# Shop 管理员账号访问边界

## 背景

用户希望 `/shop/admin/` 的进入方式并入 Shop 登录页：使用手机号 `15951875192` 和已注册密码登录后进入管理员控制台。其他未登录或非管理员账号都不能进入该页面。

同时，用户明确不希望“生成邀请码”出现在前端。邀请码生成和 API key 池管理继续留作后端能力，不通过网页登录 session 开放。

## 实际边界

- 默认唯一管理员手机号为 `15951875192`。
- 可通过环境变量 `SHOP_ADMIN_PHONE` 覆盖默认管理员手机号，便于测试或迁移。
- 管理员手机号不能通过公开注册接口创建或补密码，避免新数据库中被抢占。
- `/api/auth/register` 和 `/api/auth/login` 返回 `user.isAdmin`。
- 登录页前端根据 `user.isAdmin` 决定跳转：
  - 管理员账号进入 `/shop/admin/`。
  - 普通用户进入 `/shop/account/`。
- `/shop/login/` 和 `/shop/register/` 在已有 session 时按同样规则重定向。
- `/shop/admin/` 服务端保护：
  - 未登录：302 到 `/shop/login/`。
  - 已登录但不是管理员手机号：403。
  - 管理员手机号：允许读取页面。

## Admin API 拆分

保留两类管理员能力，避免把邀请码管理暴露给网页登录 session：

- 后端 token-only：
  - `POST /api/admin/invites`
  - `GET /api/admin/invites`
  - `POST /api/admin/api-keys`
  - 这些接口只接受请求头 `x-admin-token`。
- 用量监控：
  - `GET /api/admin/usage-summary`
  - `POST /api/admin/usage-key-profiles`
  - `POST /api/admin/usage-imports`
  - 这些接口接受 `x-admin-token`，也接受唯一管理员账号的登录 session。

## 前端变更

- `/shop/admin/` 删除管理员 token 输入框、解锁按钮和 `adminAccessForm`。
- 管理员页面直接用 httpOnly account session 调用用量监控 API。
- 管理员页面增加退出登录按钮。
- `/shop/login/` 增加“管理员账号登录后进入控制台。”提示。
- 首页账号入口在管理员已登录时显示“管理控制台”，普通用户显示“我的账户”。

## 数据库确认

本地 `data/shop.sqlite` 中 `15951875192` 已存在，并且已经设置密码。此次没有修改该账号密码，也没有输出密码哈希。

## 验证

- 新增测试覆盖：
  - 未登录访问 `/shop/admin/` 会跳转登录页。
  - 普通账号登录后访问 `/shop/admin/` 和用量 API 会被拒绝。
  - `15951875192` 登录后可以访问 `/shop/admin/` 和用量 API。
  - 公开注册接口不能创建唯一管理员手机号。
  - 邀请码与 API key 池管理接口不接受网页登录 session，只接受 `x-admin-token`。
  - 管理员登录后进入 `/shop/admin/`，普通用户登录后进入 `/shop/account/`。
- `npm test`：37 个测试通过。
- `npm run build:css`：构建通过，仅有 Browserslist/caniuse-lite 过期提示。
- 本地 `http://localhost:4173` 路由检查：
  - 未登录访问 `/shop/admin/` 返回 302，跳转 `/shop/login/`。
  - `/shop/login/` 返回 200，包含管理员账号入口提示。
  - 公开注册 `15951875192` 返回 403 和 `ADMIN_ACCOUNT_REGISTRATION_DISABLED`。
  - 未登录访问 `/api/admin/usage-summary` 返回 401。
  - 使用本地 `.env` 中的 `ADMIN_TOKEN` 访问 `/api/admin/usage-summary` 返回 200。
