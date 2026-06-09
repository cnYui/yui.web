# Shop 账号登录与个人中心实现计划

> 本计划按当前用户要求在本会话内执行，不使用 subagent。实现必须先写失败测试，再写生产代码。

## 目标

在现有 Shop 中增加手机号密码注册、登录、受保护的 `/shop/account/`、个人订单视图和退出登录。后续用户用量图表以这个账号 session 作为身份边界。

## 架构

- 后端继续使用 `server.js` 中的 Express + better-sqlite3。
- 密码使用 Node 内置 `crypto.scryptSync` 哈希，保存哈希字符串，不保存明文。
- 浏览器保存 `httpOnly` session cookie；SQLite `user_sessions` 只保存 token hash。
- `/api/account/me` 只按当前 session 的手机号返回自己的订单。
- 现有 result token 只保留给兑换成功后的 key 结果页，不复用为账号登录。

## 需要修改的文件

- `server.js`：账号 schema、密码工具、session 工具、auth/account API、account 页面路由保护。
- `shop/shop.js`：登录、注册、账户页和首页账号入口初始化。
- `shop/index.html`：增加登录/我的账户入口。
- `shop/login/index.html`：新增登录页。
- `shop/register/index.html`：新增注册页。
- `shop/account/index.html`：新增个人中心页。
- `test/shop-flow.test.js`：新增账号功能测试。
- `docs/ai/context/*shop-account-auth-implementation_CN.md`：完成后记录实现说明和验证结果。

## 任务 1：先写失败测试

- [ ] 在 `test/shop-flow.test.js` 增加数据库测试：`users` 包含 `password_hash`、`password_created_at`、`updated_at`，并存在 `user_sessions` 表。
- [ ] 增加注册校验测试：非法手机号返回 `INVALID_PHONE`；弱密码返回 `WEAK_PASSWORD`；确认密码不一致返回 `PASSWORD_MISMATCH`。
- [ ] 增加注册成功测试：返回 201，设置 `yui_shop_account_session`，cookie 含 `HttpOnly`，数据库 password hash 不包含明文密码。
- [ ] 增加历史兑换用户补密码注册测试：已有 `users.phone` 但无密码时允许注册，已有密码时重复注册返回 `USER_EXISTS`。
- [ ] 增加登录测试：正确密码返回 200 并设置 session；错误密码返回 `INVALID_CREDENTIALS`。
- [ ] 增加账户隔离测试：`/api/account/me` 必须登录，并且只返回当前登录手机号自己的订单；个人中心订单不返回完整 `apiKey`。
- [ ] 增加页面保护测试：未登录访问 `/shop/account/` 302 到 `/shop/login/`，登录后可访问。
- [ ] 增加退出测试：`POST /api/auth/logout` 撤销 session、清理 cookie，旧 cookie 不能继续访问 `/api/account/me`。
- [ ] 增加静态页面测试：首页包含 `data-account-link` 和 `/shop/login/`，登录页包含 `loginForm`，注册页包含 `registerForm` 和密码规则，账户页包含 `logoutButton`。
- [ ] 运行 `npm test -- test/shop-flow.test.js`，确认这些新增测试因为功能缺失而失败。

## 任务 2：实现后端账号能力

- [ ] 在 `server.js` 增加常量：`accountCookieName`、`accountSessionMaxAgeMs`、密码 hash 参数。
- [ ] 增加工具函数：`createAccountSessionToken`、`hashSessionToken`、`validatePassword`、`hashPassword`、`verifyPassword`。
- [ ] 扩展 `openShopDatabase`：给 `users` 补 `password_hash`、`password_created_at`、`updated_at`；创建 `user_sessions`；增加 session 查询索引。
- [ ] 增加 prepared statements：按手机号取用户、设置密码、插入 session、按 token hash 取有效 session、撤销 session。
- [ ] 增加 `registerUser` 事务：新用户创建；历史无密码用户补密码；已有密码用户拒绝。
- [ ] 增加 `loginUser`：校验用户存在、密码存在、密码正确。
- [ ] 增加 `createAccountSessionForPhone`，返回原始 token 并只在 DB 保存 hash。
- [ ] 增加 `requireAccount` middleware，从 cookie 解析当前 session，拒绝过期或已撤销 session。
- [ ] 增加 API：`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/account/me`。
- [ ] 增加页面保护：`/shop/account/` 未登录跳转 `/shop/login/`。
- [ ] 运行 `npm test -- test/shop-flow.test.js`，确认后端相关测试转绿。

## 任务 3：实现前端页面

- [ ] 新建 `shop/login/index.html`：手机号、密码、登录按钮、注册链接，调用 `window.YuiShop.initLoginPage()`。
- [ ] 新建 `shop/register/index.html`：手机号、密码、确认密码、密码规则、注册按钮、登录链接，调用 `window.YuiShop.initRegisterPage()`。
- [ ] 新建 `shop/account/index.html`：当前手机号、订单列表、空状态、退出按钮，调用 `window.YuiShop.initAccountPage()`。
- [ ] 更新 `shop/shop.js`：增加手机号输入规整、`initLoginPage`、`initRegisterPage`、`initAccountPage`、`initAccountLinks`。
- [ ] `initAccountPage` 通过 `/api/account/me` 拉取当前用户；失败时跳回 `/shop/login/`；订单复用 `renderOrderCard(order, { showFullKey: false })`。
- [ ] `initLoginPage` 和 `initRegisterPage` 成功后跳转 `/shop/account/`。
- [ ] `initAccountLinks` 在首页尝试请求 `/api/account/me`，已登录时把带 `data-account-link` 的链接改成 `/shop/account/` 和“我的账户”。
- [ ] 更新 `shop/index.html`：桌面导航、移动菜单和 CTA 增加账号入口；引入 `/shop/shop.js` 并调用 `initAccountLinks()`。
- [ ] 运行 `npm test -- test/shop-flow.test.js`，确认页面和脚本测试转绿。

## 任务 4：最终验证与记录

- [ ] 运行 `npm test`。
- [ ] 如果本地服务正在跑，重启或确认 yui.web 仍在 `127.0.0.1:4173`。
- [ ] 可选用浏览器检查 `/shop/`、`/shop/login/`、`/shop/register/`、`/shop/account/` 的基本跳转。
- [ ] 新建实现说明文档，记录实际改动、安全边界和验证命令结果。
- [ ] 检查 `git -C /Users/wujianxiang/CodeSpace/yui.web status --short`，确认没有回滚既有用量监控改动。

## 验收标准

- 首页能看到登录入口。
- 注册必须使用合法手机号、强密码和一致的确认密码。
- 登录成功进入 `/shop/account/`。
- 未登录不能访问 `/shop/account/` 和 `/api/account/me`。
- 账户页只展示当前手机号自己的订单。
- 账户页可以退出，退出后旧 session 不再可用。
- 完整 API key 不通过 `/api/account/me` 暴露。
- `npm test` 通过。
