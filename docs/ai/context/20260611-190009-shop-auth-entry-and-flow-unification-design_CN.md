# Shop 前台账户入口与流程统一设计

## 背景

当前 Shop 已从“购买一个 31 天 API key”逐步演进为“登录账户、私下开通、邀请码激活、按量计费、账户内查看余额与用量”的模型，但页面结构还混着旧流程：

- `/shop/register/` 是独立页。
- 重置密码藏在 `/shop/login/` 的隐藏表单里。
- `/shop/redeem/` 仍要求输入手机号，与登录态归属模型冲突。
- `/shop/order/`、`/shop/pay/`、`/shop/result/`、`/shop/content/`、`/shop/key/` 仍保留购买、支付、31 天有效期等旧语义。
- `/shop/account/` 同时承载 API key、余额、充值、使用说明、Token 用量和流水，信息密度偏高。

另有更重的安全与扣费修复设计见 `docs/ai/context/20260611-185334-shop-complete-flow-security-billing-repair-design-plan_CN.md`。本设计只处理前台体验和页面信息架构，不重复定义自动 usage 同步、历史补账、API key 静态加密等后端账务修复。

## 设计目标

1. 让账户入口清晰：登录、注册、重置密码各自独立。
2. 让三类账户入口页面视觉一致：全部使用已确认的左侧贴底人物背景中途版本。
3. 让兑换归属符合当前模型：登录后兑换，手机号来自 session，不再让用户手填。
4. 清掉旧购买/支付/31 天语义，避免用户误以为这是一次性购买页面。
5. 降低 Account 页面认知负担，把最常用内容放前面，把说明和长表格弱化。

## 候选方案

### 方案 A：所有账户动作合在 `/shop/login/`

做法：

- 登录、注册、重置密码都放在登录页，通过按钮切换表单。
- 只维护一个入口页面和一套背景。

优点：

- 路由少，短期改动小。
- 所有账户动作在一个页面内完成。

缺点：

- 登录页会变重，主流程被注册和重置密码干扰。
- 重置密码有 4 个字段，不适合作为登录页下的隐藏子表单。
- 浏览器历史、分享链接、出错后刷新都不够清晰。

结论：不推荐。

### 方案 B：拆成 3 个独立页面，共用同一套 Auth 布局

做法：

- `/shop/login/` 只显示登录表单。
- `/shop/register/` 只显示注册表单。
- `/shop/reset-password/` 只显示重置密码表单。
- 三页都使用同一套左侧人物背景、右侧半透明卡片布局。

优点：

- 每个页面职责单一，路径可直接理解。
- 重置密码适合作为独立流程，用户收到重置码后能明确进入哪里填写。
- 可以复用同一套 CSS，视觉统一。

缺点：

- 多一个静态页面和路由。
- `shop/shop.js` 需要把重置密码逻辑从登录页隐藏表单拆成独立初始化函数。

结论：推荐采用。

### 方案 C：做成一个 Auth Shell + URL 参数切换

做法：

- 一个 `/shop/auth/` 页面，根据 `mode=login/register/reset` 显示不同表单。

优点：

- 代码复用较高。
- URL 可表达模式。

缺点：

- 当前项目是静态 HTML 页面 + `shop/shop.js` 初始化映射，新增 auth shell 会偏离现有结构。
- 需要处理更多前端状态和错误边界。

结论：不推荐；对当前项目来说复杂度不值得。

## 最终方案

采用方案 B：独立登录、注册、重置密码页面，共用同一套 Auth 视觉外壳。

### Auth 视觉外壳

三页统一使用：

- 左侧人物图：`/shop/assets/login/yui-login-bg.png`
- 已确认的中途版桌面参数：
  - `left: clamp(-380px, -22vw, -260px)`
  - `bottom: 0`
  - `width: min(86vw, 1120px)`
  - `opacity: .42`
- 右侧表单卡片：
  - 宽度 `min(100%, 620px)`
  - 白色半透明背景 + `backdrop-filter`
  - 保持输入框和按钮风格一致
- 窄屏：
  - 表单居中
  - 人物图透明度降低，避免影响输入可读性

实现上优先把这些样式沉到 `styles/site.css`，例如：

- `.shop-auth-main`
- `.shop-auth-background-figure`
- `.shop-auth-content`
- `.shop-auth-panel`

各页面只保留最小的 `html[data-ui-ready]` 防闪烁样式，避免在多个 HTML 中复制大段 auth CSS。

### `/shop/login/`

职责：

- 只登录。
- 不再内嵌 `passwordResetForm`。

内容：

- 手机号
- 密码
- 登录按钮
- 链接：
  - `忘记密码？重置密码` -> `/shop/reset-password/`
  - `还没有账号？注册` -> `/shop/register/`

前端：

- `initLoginPage()` 只处理登录。
- 删除或停止依赖登录页内的隐藏重置表单 DOM。

### `/shop/register/`

职责：

- 只注册并登录。

内容：

- 手机号
- 密码
- 再次输入密码
- 注册并登录按钮
- 链接：
  - `已有账号？登录` -> `/shop/login/`

变化：

- 删除左侧解释区块，改成和登录页同款右侧卡片。
- 密码规则可以保留为表单内小字或输入框 placeholder，不再做大段说明。

### `/shop/reset-password/`

职责：

- 只完成重置密码并登录。

内容：

- 手机号
- 重置码
- 新密码
- 再次输入新密码
- 重置并登录按钮
- 链接：
  - `想起密码了？登录` -> `/shop/login/`

后端：

- 复用现有 `POST /api/auth/password-reset`。
- 新页面应加入 `shopPublicPagePaths`，允许未登录访问：
  - `/shop/reset-password`
  - `/shop/reset-password/`
  - `/shop/reset-password/index.html`

前端：

- 新增 `initResetPasswordPage()`。
- 复用现有 `normalizeResetCodeInput()`、`isPhone()`、`isStrongPassword()`、`requestJson()`。
- `window.YuiShop.initPage()` 路由映射新增 `/shop/reset-password/`。

## 兑换流程设计

当前 `/shop/redeem/` 仍让用户输入手机号，这不符合登录态归属模型。后续应改为登录后兑换。

### 推荐行为

- 未登录访问 `/shop/redeem/`：跳 `/shop/login/`。
- 已登录访问 `/shop/redeem/`：显示当前账户手机号，只输入邀请码。
- 提交兑换时调用登录态接口：
  - `POST /api/account/invites/redeem`
  - 请求体只含 `{ "code": "..." }`
  - 后端只信任 `req.account.phone`
- 旧 `POST /api/invites/redeem` 保留兼容，但前台页面不再使用。

### Account 内入口

Account 页的“兑换新的 API key”继续保留，指向 `/shop/redeem/`。

若后续要更顺手，可以在 Account 的 API key 区域内直接嵌入兑换码输入框；但本轮先保持独立 `/shop/redeem/`，避免 Account 再变重。

## 旧页面处理

以下页面还带旧购买语义：

- `/shop/order/`
- `/shop/pay/`
- `/shop/result/`
- `/shop/content/`
- `/shop/key/`

推荐处理：

1. `/shop/order/`、`/shop/pay/`、`/shop/content/`：前台不再入口展示，后续可改成静态重定向到 `/shop/account/` 或 `/shop/`。
2. `/shop/result/`：保留兼容跳转，但文案不再出现“等待支付确认”。
3. `/shop/key/`：改成“API key 已激活”，删除“31 天有效期”和“重新购买”文案；引导去 `/shop/account/` 查看 API key、余额和用量。

如果担心历史链接失效，先不删除文件，只改文案和跳转。

## Account 页面信息层级

当前 Account 页面内容完整但偏重。推荐调整为：

1. 第一屏：
   - 当前手机号
   - 账户余额卡片
   - 我的 API key
2. 第二层：
   - 充值入口与充值记录
   - Token 用量摘要
3. 默认收起或弱化：
   - 使用说明
   - API 扣费记录
   - 账户流水

使用说明不建议在 Account 内完整复制一遍。推荐：

- `/shop/guide/` 保留完整说明。
- Account 里只放一个“查看配置使用方法”按钮或折叠摘要。

## 导航一致性

公开营销页 `/shop/` 可以保留完整 Portfolio 导航。

账户入口页建议使用轻量 Shop 头部：

- `Portfolio.`
- `Shop`

业务页如 Account/Admin/Redeem 使用同一类轻量 Shop 头部，保持一致。

## 实施顺序

### 第一阶段：账户入口统一

1. 新增 `/shop/reset-password/index.html`。
2. 把登录页内嵌重置表单迁移到新页面。
3. 注册页换成同款 Auth 背景布局。
4. 抽出共用 Auth CSS。
5. 更新 `shop/shop.js` 初始化函数和路由映射。
6. 更新 public page whitelist。
7. 更新测试和浏览器截图验证。

### 第二阶段：兑换与旧页面语义整理

1. `/shop/redeem/` 改成登录态兑换，只输入邀请码。
2. 新增或启用 `POST /api/account/invites/redeem`。
3. `/shop/key/` 删除 31 天和购买文案。
4. `/shop/order/`、`/shop/pay/`、`/shop/result/`、`/shop/content/` 处理旧语义和跳转。

### 第三阶段：Account 降噪

1. Account 保留余额和 API key 在前。
2. 使用说明改成入口或默认收起。
3. 扣费流水和账务明细默认收起。
4. 保持所有已有数据容器 id 不变，避免破坏前端初始化。

## 测试计划

### 静态测试

- 登录页不包含 `passwordResetForm`。
- 登录页链接到 `/shop/reset-password/` 和 `/shop/register/`。
- 注册页包含 Auth 背景人物图和 `registerForm`。
- 重置页包含 Auth 背景人物图和 `passwordResetForm`。
- 重置页被加入 public page whitelist。
- `/shop/key/` 不包含 `31 天`、`重新购买`。

### API/路由测试

- 未登录访问 `/shop/reset-password/` 返回 200。
- 未登录访问 `/shop/redeem/` 跳登录。
- 登录用户兑换邀请码时订单手机号等于当前 session 手机号。
- 请求体传入其他手机号不会影响订单归属。

### 浏览器验证

- 1280x720：登录、注册、重置密码三页人物图位置一致，表单可读。
- 2048x1152：三页人物图仍保持左侧，不压表单。
- 移动宽度：表单居中，人物图降低透明度，不遮挡输入。

## 非目标

- 不在本设计中实现 Admin 邀请码管理。
- 不在本设计中实现自动 usage 同步。
- 不在本设计中实现历史补账。
- 不在本设计中改动 API key 加密存储。
- 不把 Shop 改成单页应用。

## 自检

- 没有未定项或占位符。
- 推荐方案与用户已同意的“三页拆分”一致。
- Auth 背景参数使用用户指定的中途版本，不使用 1320px 版本。
- 前台体验整理和后端安全扣费修复边界分开。
