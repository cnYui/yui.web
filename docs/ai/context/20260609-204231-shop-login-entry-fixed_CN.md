# Shop 首页登录入口固定化

## 背景

用户在本地 `/shop/` 页面看到首屏按钮被改成“管理控制台”。这是因为按钮带有 `data-account-link`，页面加载时 `initAccountLinks()` 会请求 `/api/account/me`，如果当前 session 是管理员，就把按钮文案和链接改成管理员控制台。

用户期望：首页只展示“登录”入口；点击后进入登录页。登录成功后再按账号身份进入各自控制台：管理员进入 `/shop/admin/`，普通用户进入 `/shop/account/`。

## 改动

- `/shop/` 首屏账号按钮移除 `data-account-link`，固定显示“登录”，固定链接 `/shop/login/`。
- `/shop/` 不再调用 `window.YuiShop.initAccountLinks()`。
- `initAccountLinks()` 保留为兼容函数，但不再按 session 改写成“管理控制台”或“我的账户”，只会设置为“登录”并链接 `/shop/login/`。
- `/shop/login/` 和 `/shop/register/` 不再因为已有 session 自动重定向；即使当前已经登录，也能看到登录/注册表单。
- 登录成功后的跳转仍保持原有身份分流：
  - 管理员手机号登录后前端跳转 `/shop/admin/`。
  - 普通用户登录后前端跳转 `/shop/account/`。

## 验证

- 新增/调整测试覆盖：
  - `/shop/` 首页没有 `data-account-link`。
  - `/shop/` 正文固定有一个 `href="/shop/login/"` 的“登录”按钮。
  - 已登录管理员访问 `/shop/login/` 仍返回登录表单。
  - 已登录管理员访问 `/shop/register/` 仍返回注册表单。
  - 登录接口仍返回 `user.isAdmin`，供前端登录成功后分流。
