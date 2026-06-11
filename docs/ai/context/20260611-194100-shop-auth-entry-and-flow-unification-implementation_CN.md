# Shop 前台账户入口与流程统一实施记录

## 背景

- 执行计划：`docs/ai/context/20260611-190626-shop-auth-entry-and-flow-unification-plan_CN.md`。
- 用户已选择 Inline Execution。
- 目标是把 Shop 前台账户入口、兑换路径和旧购买页面语义统一到当前按量计费账户模型。

## 已实施

- `/shop/login/`、`/shop/register/`、`/shop/reset-password/` 拆成 3 个独立页面。
- 三个 Auth 页面共用 `styles/tailwind.css` 中的 `.shop-auth-*` 外壳样式，沿用中途版人物背景参数：
  - `left: clamp(-380px, -22vw, -260px)`
  - `width: min(86vw, 1120px)`
  - `bottom: 0`
- `/shop/login/` 删除内嵌重置密码表单，只保留跳转到 `/shop/reset-password/` 的链接。
- `/shop/reset-password/` 新增独立页面，复用原密码重置表单 DOM id 和 `initResetPasswordPage()`。
- `/shop/reset-password/` 在视觉验收中发现桌面 720px 首屏会裁到底部，因此改为紧凑表单：
  - 面板 `md:p-10`
  - 表单 `space-y-4`
  - 输入框 `h-11`
- `/shop/register/` 改成与登录页同款 Auth 背景和右侧表单。
- `/shop/redeem/` 改为登录态兑换，只输入邀请码；手机号来自当前 session，并展示当前登录账号。
- 新增登录态兑换接口 `POST /api/account/invites/redeem`，旧匿名 `/api/invites/redeem` 继续保留兼容。
- `/shop/order/`、`/shop/pay/`、`/shop/result/`、`/shop/content/` 改为前往账户页，清理购买、支付、交付、固定价格、31 天等旧语义。
- Review 后继续删除旧页面中残留的手机号表单、支付按钮、二维码占位、订单摘要和内容解锁容器，避免跳转前短暂露出旧流程。
- `/shop/key/` 改为“API key 已激活”，删除 31 天和重新购买文案。
- Account 页保持既有 DOM id，`accountGuideSection` 和 `accountBillingHistorySection` 默认收起。
- Account API key 卡片继续只展示 API key、兑换时间和复制完整 API key 按钮。

## 视觉验收

- 本地当前代码使用 `PORT=4175 npm start` 启动验收。
- 发现 `4174` 已有旧进程，不作为本次验收依据。
- Browser 插件页面访问可用，但截图接口在 CDP `Page.captureScreenshot` 阶段超时；改用本机 headless Chrome 截图。
- 截图文件：
  - `docs/ai/context/20260611-193530-shop-login-desktop.png`
  - `docs/ai/context/20260611-193530-shop-register-desktop.png`
  - `docs/ai/context/20260611-194025-shop-reset-password-desktop.png`
  - `docs/ai/context/20260611-193530-shop-account-desktop.png`
  - `docs/ai/context/20260611-193530-shop-redeem-desktop.png`
- 登录页人物在 1280x720 桌面视口中左侧放大、底部贴住视口底部，旧“这里是登录页面”未出现。
- 注册页使用同款背景，表单完整展示。
- 重置密码页压缩后面板高度约 570px，底部完整进入 720px 首屏。
- 兑换页无手机号输入、无固定价格和 31 天文案。
- Account 页说明和扣费流水默认收起。

## 验证

- `npm run build:css` 通过；仅出现 Browserslist 数据过期提示。
- `npm test` 通过：112 个测试全部通过。

## 后续注意

- `docs/ai/context/` 被 `.gitignore` 忽略，提交本记录和截图时需要 `git add -f`。
- 旧购买路径前台已经弱化为账户页入口；后续若要彻底移除这些路由，需要另开计划处理兼容影响。
