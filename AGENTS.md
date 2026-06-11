# AI 协作记忆

## 2026-06-11 DeepSeek 真实扣费

- Shop 真实扣费以 yui.web 内部固定人民币价格为准，不信任 usage event 的 `price_amount_micros`。
- 当前固定价格版本为 `deepseek-v4-pro-rmb-20260424`：
  - 缓存命中输入：25 nanos/token
  - 缓存未命中输入：3000 nanos/token
  - 输出：6000 nanos/token
- `reasoning_tokens` 只展示，不重复计费。
- 旧 JSONL 兼容规则：`cache_hit_input_tokens = cached_tokens`，`cache_miss_input_tokens = max(input_tokens - cached_tokens, 0)`。
- 账务事实字段使用 nanos；旧 cents 字段只做兼容展示和旧接口兼容。
- 相关实施记录见 `docs/ai/context/20260611-104500-deepseek-pro-rmb-real-billing-implementation_CN.md`。

## 2026-06-11 临时激活 API key

- 已临时激活 `sk-8d2c17931...2e1124`，订单 `ORDER563714471162`，临时手机号 `13900000000`。
- 用户稍后提供真实手机号后，需要从临时手机号迁移订单、余额、流水和扣费记录；迁移前先备份数据库。
- 操作记录见 `docs/ai/context/20260611-144003-temp-api-key-activation.md`。

## 2026-06-11 登录态邀请码兑换设计

- 新账户默认不自动分配 API key。
- 用户登录后应在 `/shop/account/` 输入兑换码激活 API key。
- 新兑换接口使用当前登录账号手机号作为订单归属，不接受请求体手机号。
- 旧 `/api/invites/redeem` 暂时保留兼容；账户页只使用新的登录态兑换接口。
- 设计与计划见 `docs/ai/context/20260611-144216-account-session-invite-redeem-design.md` 和 `docs/ai/context/20260611-144216-account-session-invite-redeem-implementation-plan.md`。

## 2026-06-11 临时激活订单迁移与充值

- 已将临时手机号 `13900000000` 下的订单 `ORDER563714471162` 迁移到真实手机号 `183****0091`。
- 已抵消临时激活 1 元额度，并为真实手机号入账 30 元，最终余额为 30 元。
- 记录见 `docs/ai/context/20260611-145032-phone-migration-and-30cny-topup.md`。

## 2026-06-11 默认密码设置

- 已为真实手机号 `183****0091` 设置默认密码哈希，使用 `scrypt$16384$8$1`。
- 不在项目记忆中保存明文密码。
- 记录见 `docs/ai/context/20260611-145404-set-default-password-for-phone.md`。

## 2026-06-11 Account 退出登录来源校验

- `/api/auth/logout` 的 403 “请求来源不被允许”来自 `requireSameOrigin` 对 `Origin/Referer` 与服务端推导 origin 的比较。
- 生产反代如果缺少 `X-Forwarded-Proto: https` 或 `PUBLIC_BASE_URL=https://aaccx.pw`，服务端可能把同 Host 推导成 `http://aaccx.pw`，从而误拒 `https://aaccx.pw`。
- 修复方向：同一 `Host` 下允许 `http` 与 `https` 两种 origin，跨 Host 继续拒绝；CSRF token 校验不降级。
- 设计与计划见 `docs/ai/context/20260611-151347-shop-logout-origin-proxy-design_CN.md` 和 `docs/ai/context/20260611-151347-shop-logout-origin-proxy-plan_CN.md`。
- 实施记录见 `docs/ai/context/20260611-151750-shop-logout-origin-proxy-implementation_CN.md`。

## 2026-06-11 Shop CSP 字体与 forwarded host

- Shop 页面引用 Google Fonts 和 Material Symbols，CSP 必须显式允许 `https://fonts.googleapis.com` 样式和 `https://fonts.gstatic.com` 字体，否则浏览器会阻止字体样式加载。
- 生产反代可能把应用侧 `Host` 改为内部域名；同源校验需要同时参考 `X-Forwarded-Host` 的第一个 host 值。
- 安全边界仍是同 Host；跨 Host 继续拒绝，CSRF token 校验不降级。
- 设计与计划见 `docs/ai/context/20260611-152919-shop-csp-font-and-forwarded-origin-design_CN.md` 和 `docs/ai/context/20260611-152919-shop-csp-font-and-forwarded-origin-plan_CN.md`。
- 实施记录见 `docs/ai/context/20260611-153159-shop-csp-font-and-forwarded-origin-implementation_CN.md`。

## 2026-06-11 X-Forwarded-Host 信任收紧

- 默认不信任客户端传入的 `X-Forwarded-Host`；只有当前请求来自 Express `trust proxy fn` 判定可信的代理时才把它用于同源候选 origin。
- 受限 `trust proxy` 配置必须按当前请求远端地址判定可信代理；不能只因为配置项非 false 就信任 `X-Forwarded-Host`。
- 生产更推荐配置 `PUBLIC_BASE_URL=https://aaccx.pw`，把公网 origin 固定在环境变量里。
- 记录见 `docs/ai/context/20260611-154244-forwarded-host-trust-tightening_CN.md` 和 `docs/ai/context/20260611-155226-trust-proxy-per-request-review_CN.md`。

## 2026-06-11 Redeem 页面按量计费文案

- `/shop/redeem/` 不再展示 Codex 月额度、31 天有效期或固定 30 元价格。
- 说明文案固定为“私下付款后，你会收到一个邀请码。输入手机号和邀请码后，系统会生成 API key。”
- Product 下方产品名显示为 `codex api key`，价格区域移除，以符合当前按量计费。
- 设计与计划见 `docs/ai/context/20260611-154117-shop-redeem-metered-copy-design-plan_CN.md`。

## 2026-06-11 Admin 页面栏目折叠

- `/shop/admin/` 的生成密码重置码、充值审核、用量监控、日志导入 4 个栏目使用统一折叠按钮。
- 折叠行为复用 `shop/shop.js` 的 `initCollapsibleSections`，Admin 初始化时调用，不新增专用状态逻辑。
- 设计与计划见 `docs/ai/context/20260611-154357-admin-collapsible-sections-design-plan_CN.md`。
