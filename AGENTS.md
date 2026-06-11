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

## 2026-06-11 Login 页面文案与布局

- `/shop/login/` 主提示文案改为“登录 悠一 的小店”。
- 删除旧的手机号/密码用途说明和管理员登录说明小字。
- 页面布局保持登录与重置表单 DOM id 不变，只调整文案和 Tailwind 布局类。
- 设计与计划见 `docs/ai/context/20260611-155749-shop-login-copy-layout-design-plan_CN.md`，实施记录见 `docs/ai/context/20260611-160405-shop-login-copy-layout-implementation_CN.md`。

## 2026-06-11 Login 透明人物背景图

- `/shop/login/` 标题改为“这里是登录页面”，弱化正式感。
- 用户提供的 `2080.PNG` 使用代码生成透明背景 PNG，输出为 `shop/assets/login/yui-login-bg.png`。
- 背景图通过页面内居中 `img` 层展示，登录和重置表单 DOM id 不变。
- 设计与计划见 `docs/ai/context/20260611-161311-shop-login-transparent-bg-image-design-plan_CN.md`，实施记录见 `docs/ai/context/20260611-161607-shop-login-transparent-bg-image-implementation_CN.md`。

## 2026-06-11 Login 左侧贴底人物图

- `/shop/login/` 不再显示“这里是登录页面”，`<title>` 简化为“登录”。
- 透明人物图从居中背景改为左侧背景，使用 `bottom: 0` 贴住登录主区域底部。
- 登录表单保持右侧卡片，窄屏时居中并降低人物图透明度，避免影响输入。
- 设计与计划见 `docs/ai/context/20260611-183623-shop-login-left-bottom-figure-design-plan_CN.md`，实施记录见 `docs/ai/context/20260611-183623-shop-login-left-bottom-figure-implementation_CN.md`。
- 最终采用中途截图版本：桌面端 `left: clamp(-380px, -22vw, -260px)`，`width: min(86vw, 1120px)`；不要使用后续更大更靠左的 1320px 版本。记录见 `docs/ai/context/20260611-185005-shop-login-figure-restore-midpoint_CN.md`。

## 2026-06-11 Account API key 卡片精简

- `/shop/account/` 的“我的 API key”卡片按按量计费语义精简。
- Account 场景只展示 API key、兑换时间、复制完整 API key 按钮。
- 金额、手机号、失效时间、订单 id、产品名、31 天说明和状态标签不在 Account API key 卡片中展示。
- 设计与计划见 `docs/ai/context/20260611-164226-account-api-key-card-metered-design-plan_CN.md`，实施记录见 `docs/ai/context/20260611-164432-account-api-key-card-metered-implementation_CN.md`。

## 2026-06-11 未托管 sk-6...e883 删除

- `sk-6...e883` 来自 CLIProxyAPI `config.yaml` 的入口 `api-keys` 列表，不是 yui.web Shop 兑换订单。
- 它在 `2026-06-11T17:43:31.889333+09:00` 到 `2026-06-11T18:00:18.60552+09:00` 写入 6 条成功 usage，共 `348,059` tokens。
- yui.web 显示“未托管”是因为该 usage hash 无法匹配 `api_keys -> orders`，也没有 `usage_key_profiles`。
- 已删除 CLIProxyAPI 活跃配置中的该入口 key、yui.web `usage_events` 中该 hash 的 6 条记录，并备份后过滤当前月 CLIProxyAPI usage JSONL 中该 hash 的 23 行。
- 该 hash 没有 `api_charge_records` 或 ledger 记录，没有对 Shop 账户扣费。
- 操作记录见 `docs/ai/context/20260611-183759-unmanaged-api-key-removal-investigation_CN.md` 和 `docs/ai/context/20260611-184335-unmanaged-api-key-removal-implementation_CN.md`。

## 2026-06-11 账号清空密码与余额归零

- 已将手机号 `150****6174` 恢复为未注册语义：清空密码字段并撤销 7 个未撤销会话，避免旧登录态继续访问。
- 余额归零只修改 `account_balances.balance_cents` 和 `balance_nanos`；充值、订单、扣费历史不删除，`credit_limit_*` 不作为余额处理。
- 执行前已备份数据库到 `data/backups/shop-before-reset-15062376174-20260611-182903.sqlite`。
- 验证结果：无密码、未撤销会话为 0、余额 cents/nanos 均为 0。
- 设计与计划见 `docs/ai/context/20260611-182903-reset-phone-unregistered-zero-balance-plan_CN.md`，实施记录见 `docs/ai/context/20260611-183014-reset-phone-unregistered-zero-balance-implementation_CN.md`。

## 2026-06-11 Shop 完整流程安全与扣费修复计划

- Shop 修复不能只做 P1；必须覆盖登录态兑换归属、Admin 兑换码管理、自动 usage 同步、历史漏扣补账、API key 静态加密和验收测试。
- 主兑换路径必须改为登录态：订单手机号只能来自当前 session，不能信任请求体手机号。
- Admin 页面新增兑换码管理时不能在浏览器使用 `ADMIN_TOKEN`；页面写操作必须走管理员 session、Same-Origin 与 CSRF。
- 用量自动同步优先在 yui.web 内按当前月 JSONL 定时幂等导入；手动导入只作为补救入口。
- 历史漏扣不能靠重导 JSONL 修复，必须有 dry-run/apply 补账脚本，apply 前备份数据库并写 ledger。
- 完整设计与修复计划见 `docs/ai/context/20260611-185334-shop-complete-flow-security-billing-repair-design-plan_CN.md`。
- 可执行实施计划已写入 `docs/ai/context/20260611-185745-shop-complete-flow-security-billing-repair-implementation-plan_CN.md`；后续执行必须覆盖 Phase 0 到 Phase 6，不能缩回只修 P1。

## 2026-06-11 Shop 前台账户入口与流程统一设计

- 登录、注册、重置密码应拆成 3 个独立页面，而不是把重置密码藏在登录页里。
- 三个账户入口页面统一使用已确认的左侧贴底人物背景中途版本：`left: clamp(-380px, -22vw, -260px)`，`width: min(86vw, 1120px)`。
- `/shop/redeem/` 后续应改为登录态兑换，只输入邀请码，手机号来自当前 session。
- 旧 `/shop/order/`、`/shop/pay/`、`/shop/result/`、`/shop/content/`、`/shop/key/` 需要清理购买、支付、31 天有效期等旧语义。
- Account 页后续应降低信息密度：余额和 API key 前置，使用说明改入口或默认收起，扣费流水默认收起。
- 设计文档见 `docs/ai/context/20260611-190009-shop-auth-entry-and-flow-unification-design_CN.md`。
- 实施计划见 `docs/ai/context/20260611-190626-shop-auth-entry-and-flow-unification-plan_CN.md`。

## 2026-06-11 Shop 前台账户入口与流程统一实施

- 已实施 3 个独立 Auth 页面：`/shop/login/`、`/shop/register/`、`/shop/reset-password/`。
- 三页共用 `.shop-auth-*` 外壳和中途版左侧贴底人物背景；重置密码页因 4 个输入框较高，使用更紧凑的面板间距避免桌面首屏裁切。
- `/shop/redeem/` 已改为登录态兑换，只提交邀请码；订单手机号来自当前 session。
- 旧购买、支付、结果和内容页面前台改为账户页入口，删除固定价格、31 天、演示交付以及手机号表单、支付按钮、二维码占位等旧控件。
- Account 页说明和扣费流水默认收起；API key 卡片只展示 key、兑换时间和复制完整 key 按钮。
- 验证：`npm run build:css` 通过，`npm test` 112 个测试通过；视觉截图见实施记录。
- 实施记录见 `docs/ai/context/20260611-194100-shop-auth-entry-and-flow-unification-implementation_CN.md`。

## 2026-06-11 Shop usage 历史补账脚本

- 历史 usage 补账使用 `scripts/shop-reconcile-usage-billing.js` 手动执行，默认 dry-run，不随服务启动自动运行。
- `--apply` 前必须先复制 sqlite 备份，备份文件命名为 `shop-before-usage-reconcile-<timestamp>.sqlite`。
- 补账逻辑来自 `lib/shop-usage-reconcile.js`，按内部 nanos 价格补写 `api_charge_records`、`account_ledger_entries` 和余额。
- 实施记录见 `docs/ai/context/20260611-195133-shop-usage-reconcile-script-implementation_CN.md`。
