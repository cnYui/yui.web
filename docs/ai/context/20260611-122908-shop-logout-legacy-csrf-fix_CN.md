# Account 退出登录缺少 CSRF token 修复

## 背景

用户反馈 `/shop/account/` 页面点击“退出登录”失败，错误为“缺少 CSRF token。”现有前端会从 `yui_shop_csrf` cookie 读取 token，并在非 GET 请求里写入 `x-csrf-token` header；服务端 `/api/auth/logout` 也要求 `requireSameOrigin` 和 `requireAccountCsrf`。

## 根因判断

CSRF 机制是后加的安全能力。迁移后的历史登录态仍可通过 session cookie 访问 Account 页面，因为 GET `/api/account/me` 只要求有效 session；但这些历史 `user_sessions` 行没有 `csrf_token_hash`，浏览器侧也没有对应的 `yui_shop_csrf` cookie。用户点击退出时，请求会进入 `/api/auth/logout`，在 `requireAccountCsrf` 因 session 缺少 `csrf_token_hash` 被拦下，用户无法通过正常 UI 清除旧登录态。

## 设计

- 保留 CSRF 保护，不把全局策略降级。
- 新登录态仍严格要求 `x-csrf-token` 与 session 里的 `csrf_token_hash` 匹配。
- 仅对退出登录接口兼容旧 session：如果 session 存在但没有 `csrf_token_hash`，且请求已经通过同源校验，则允许继续执行退出，撤销 session 并清理 cookie。
- 其它会产生业务变更的接口继续使用严格 CSRF 校验。

## TDD 计划

1. 新增失败测试：模拟旧 session 缺少 `csrf_token_hash` 且请求只带 session cookie，确认旧代码会返回 `CSRF_TOKEN_REQUIRED`。
2. 实现专用于退出登录的 CSRF 中间件。
3. 验证旧 session 能退出，新 session 的 CSRF 行为不变，全量测试通过。
