# AI 协作记忆

## 2026-06-16 订阅池长期加量包与页面设计

- 加量包不再是当日额度；未用完的加量包美元额度长期保留，续费和换套餐后也继续保留。
- usage 扣费优先级固定为：先扣东八区当天套餐额度，套餐额度用完后才扣长期加量包余额；每日额度仍按东八区 0 点刷新且不累计。
- 加量包是订阅附属备用额度，不是新的按量余额；无有效订阅时加量包余额保留但不放行 API，续费后继续可用。
- 加量包余额必须使用独立 USD micros 账本，不能写入 `account_balances.balance_nanos`，不能按 `quota_date` 绑定某一天。
- OpenAI 官方价格页存在 short / long context 价格，但本项目第一版只实现用户确认的一套 `openai-standard-short-usd-20260616` 项目计价，不在用户侧暴露上下文计费模式；后续如上游账单偏离，再新增价格版本。
- Account 页面目标主视图改为订阅池：当前套餐、今日额度、加量包余额、购买套餐、购买加量包、API key、模型价格、美元扣费流水。
- Admin 页面目标主视图改为订单与额度运营：订阅 / 加量包订单审核、用户额度面板、美元用量监控、人民币订单收入、扣费来源拆分。
- 详细设计见 `docs/ai/context/20260616-191817-subscription-account-admin-addon-retention-design_CN.md`；实施计划修正见 `docs/ai/context/20260616-191817-subscription-addon-retention-plan-update_CN.md`。

## 2026-06-16 订阅池官方 GPT 计价设计

- 已在独立 worktree 分支 `codex/subscription-pool-pricing-design` 设计订阅池方案，不影响当前 main 上的按量计费分支。
- 当前订阅池口径：29 元 / 月每日 19 美元额度，39 元 / 月每日 29 美元额度，59 元 / 月每日 49 美元额度。
- 项目只使用 `gpt-5.4` 和 `gpt-5.5`；官方价格按 OpenAI API Pricing 的 2026-06-16 快照记录。
- 计价规则只采用用户截图和 OpenAI 官方价格页中的单一表：`gpt-5.4` 输入 / 缓存命中输入 / 输出分别为 2.50 / 0.25 / 15 美元每百万 token，`gpt-5.5` 分别为 5 / 0.5 / 30 美元每百万 token；实现中不要引入长短上下文、Batch、Flex 或 Priority 分支。
- 新规则必须使用独立美元额度账本，不能复用 `account_balances.balance_nanos`，不能污染现有人民币余额和历史 `api_charge_records`。
- 用户已确认采用方案 B，整个计费系统在该分支目标运行态改为美元计费和扣费，东八区 0 点刷新，当天未用完额度不累计，三个套餐都能使用 `gpt-5.4` 和 `gpt-5.5`。
- 设计文档见 `docs/ai/context/20260616-182045-subscription-pool-official-gpt-pricing-design_CN.md`；实施计划见 `docs/ai/context/20260616-182903-subscription-pool-usd-billing-implementation-plan_CN.md`。

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

## 2026-06-11 Shop API key 静态加密

- 配置 `SHOP_API_KEY_ENCRYPTION_SECRET` 后，新导入 API key 使用 AES-256-GCM 写入 `api_key_ciphertext` 和 `api_key_nonce`。
- 密文模式下 `api_key` 列不保存明文，而保存非敏感唯一占位 `enc_<api_key_hash>`，避免旧唯一键冲突。
- 旧明文记录使用 `scripts/shop-encrypt-api-keys.js` 迁移；`--apply` 前必须先备份数据库。
- 2026-06-11 对 `data/shop.sqlite` 的加密迁移 dry-run：`api_keys` 明文 8 条、`orders` 明文 6 条、已加密均为 0；本次未执行 `--apply`。
- reveal 和内部 status 查询必须走 hash/密文读取路径，不能依赖明文 `api_key` 列。
- 实施记录见 `docs/ai/context/20260611-200103-shop-api-key-encryption-implementation_CN.md`。

## 2026-06-11 Shop 完整流程修复实施完成

- 已按完整实施计划修复登录态兑换、Admin 兑换码管理、usage 自动同步、历史补账、API key 静态加密与 reveal 文案。
- 后续改动不能恢复 body.phone 兑换主路径，不能在浏览器引入 `ADMIN_TOKEN`。
- 2026-06-11 20:17-20:22 用户确认后，已对 `data/shop.sqlite` 执行 usage 补账 apply 和 API key 加密迁移 apply。
- usage 补账 apply 总扣费 `32870254600` nanos；apply 后 dry-run 为 0 待处理项。
- API key 加密迁移 apply 后 `api_keys` 8 条、`orders` 6 条均为密文，明文剩余 0 条。
- `.env` 已新增 `SHOP_API_KEY_ENCRYPTION_SECRET`；不记录明文，SHA-256 指纹前 16 位为 `79c09541b842d2c1`，不要删除或替换。
- usage 补账脚本的历史补账记录 id 必须使用 `request_id` 派生稳定 id，不能回到 `Date.now()+random`，否则真实库批量 apply 会撞主键。
- 实施记录见 `docs/ai/context/20260611-201244-shop-complete-flow-security-billing-repair-implementation_CN.md`。
- 真实库执行记录见 `docs/ai/context/20260611-202247-shop-real-db-usage-and-api-key-apply_CN.md`。

## 2026-06-11 当前已兑换 Shop API key 批量充值 50 元

- 已对当前 6 个 Shop 托管、已兑换 API key 所属账号各增加 50 元余额，不包含 `usage_key_profiles` 中的 local / 未托管 key。
- 本次直接更新 `account_balances.balance_cents` 和 `balance_nanos`，并写入 `account_ledger_entries` 的 `admin_adjustment` 流水；不创建充值申请。
- 执行前已备份真实库到 `data/backups/shop-before-active-key-50cny-topup-20260611-205829.sqlite`。
- 验证结果：6 个托管 key 的内部状态接口均返回 `active=true`；local key 仍为 `not_in_shop_api_keys`。
- 计划与实施记录见 `docs/ai/context/20260611-205829-active-shop-key-50cny-topup-plan_CN.md` 和 `docs/ai/context/20260611-205927-active-shop-key-50cny-topup-implementation_CN.md`。

## 2026-06-11 两个 Shop 账号直接充值 20 元

- 已为 `173****1728` 和 `156****1160` 两个 Shop 托管账号各增加 20 元余额。
- 本次直接更新 `account_balances.balance_cents` 和 `balance_nanos`，并写入 2 条 `admin_adjustment` 流水；不创建充值申请。
- 执行前已备份真实库到 `data/backups/shop-before-two-accounts-20cny-topup-20260611-210637.sqlite`。
- 验证结果：两个账号对应托管 API key 的内部状态接口均返回 `active=true`。
- 计划与实施记录见 `docs/ai/context/20260611-210637-two-shop-accounts-20cny-topup-plan_CN.md` 和 `docs/ai/context/20260611-210714-two-shop-accounts-20cny-topup-implementation_CN.md`。

## 2026-06-11 单个 Shop 账号直接充值 20 元

- 已为 `185****0179` 对应 Shop 托管账号增加 20 元余额。
- 本次直接更新 `account_balances.balance_cents` 和 `balance_nanos`，并写入 1 条 `admin_adjustment` 流水；不创建充值申请。
- 执行前已备份真实库到 `data/backups/shop-before-one-account-20cny-topup-20260611-211115.sqlite`。
- 验证结果：该账号对应托管 API key 的内部状态接口返回 `active=true`。
- 计划与实施记录见 `docs/ai/context/20260611-211115-one-shop-account-20cny-topup-plan_CN.md` 和 `docs/ai/context/20260611-211152-one-shop-account-20cny-topup-implementation_CN.md`。

## 2026-06-11 单个 Shop 账号 `153****1848` 直接充值 20 元

- 已为 `153****1848` 对应 Shop 托管账号增加 20 元余额。
- 本次直接更新 `account_balances.balance_cents` 和 `balance_nanos`，并写入 1 条 `admin_adjustment` 流水；不创建充值申请。
- 执行前已备份真实库到 `data/backups/shop-before-one-account-15381181848-20cny-topup-20260611-212752.sqlite`。
- 验证结果：该账号对应托管 API key 的内部状态接口返回 `active=true`。
- 计划与实施记录见 `docs/ai/context/20260611-212752-one-shop-account-15381181848-20cny-topup-plan_CN.md` 和 `docs/ai/context/20260611-212836-one-shop-account-15381181848-20cny-topup-implementation_CN.md`。

## 2026-06-11 单个 Shop 账号 `189****6318` 直接充值 20 元

- 已为 `189****6318` 对应 Shop 托管账号增加 20 元余额。
- 本次直接更新 `account_balances.balance_cents` 和 `balance_nanos`，并写入 1 条 `admin_adjustment` 流水；不创建充值申请。
- 执行前已备份真实库到 `data/backups/shop-before-one-account-18939306318-20cny-topup-20260611-214453.sqlite`。
- 验证结果：该账号对应托管 API key 的内部状态接口返回 `active=true`。
- 计划与实施记录见 `docs/ai/context/20260611-214453-one-shop-account-18939306318-20cny-topup-plan_CN.md` 和 `docs/ai/context/20260611-214537-one-shop-account-18939306318-20cny-topup-implementation_CN.md`。

## 2026-06-11 单个 Shop 账号 `198****2044` 直接充值 20 元

- 已为 `198****2044` 对应 Shop 账号增加 20 元余额。
- 本次直接更新 `account_balances.balance_cents` 和 `balance_nanos`，并写入 1 条 `admin_adjustment` 流水；不创建充值申请。
- 执行前已备份真实库到 `data/backups/shop-before-one-account-19814722044-20cny-topup-20260611-220017.sqlite`。
- 验证结果：该账号余额为 20 元；当前 `orders` 中订单数为 0，因此没有托管 API key active 状态可验证。
- 计划与实施记录见 `docs/ai/context/20260611-220017-one-shop-account-19814722044-20cny-topup-plan_CN.md` 和 `docs/ai/context/20260611-220106-one-shop-account-19814722044-20cny-topup-implementation_CN.md`。

## 2026-06-11 `198****2044` API key 加入 CLIProxyAPI 入口

- `198****2044` 后续已兑换 Shop API key，preview 为 `sk-yui-8LKj2...Tv7mfI`。
- 该 key 在 yui.web 内部状态为 `active=true`，余额为 20 元，但一开始 CLIProxyAPI `/v1/models` 返回 `401 Invalid API key`。
- 原因是 CLIProxyAPI `config.yaml` 的入口 `api-keys` 列表尚未包含该 key。
- 已备份配置到 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/backups/config-before-add-19814722044-key-20260611-221404.yaml`，并将 key 追加到 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/config.yaml` 的 `api-keys` 列表。
- 验证结果：无需重启，配置热加载后该 key 请求 `http://127.0.0.1:8317/v1/models` 返回 HTTP 200，模型列表可访问。
- 记录见 `docs/ai/context/20260611-221518-add-19814722044-key-to-cliproxyapi_CN.md`。

## 2026-06-11 5 个 Shop 用户与 API key 硬删除

- 已硬删除 `185****0179`、`173****1728`、`153****1848`、`156****1160`、`189****6318` 的 Shop 账号、余额、会话、订单、邀请码、API key、usage events、扣费记录和账户流水。
- 执行前已备份 yui.web 真实库到 `data/backups/shop-before-delete-five-users-20260611-222832.sqlite`。
- 已备份并更新 CLIProxyAPI 配置，配置备份为 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/backups/config-before-delete-five-shop-users-20260611-222832.yaml`；目标 key 已从入口 `api-keys` 中移除。
- 已备份并过滤当前月 CLIProxyAPI usage JSONL，备份为 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/logs/usage/usage-events-2026-06.before-delete-five-shop-users-20260611-222832.jsonl`；目标 hash 当前均为 0 行。
- 验证结果：目标 key 在 yui.web 内部状态均为 `not_found`，请求 CLIProxyAPI `/v1/models` 均返回 HTTP 401。
- 后续不要从备份或历史文档中恢复这些用户或相同 API key，除非用户明确要求。
- 实施记录见 `docs/ai/context/20260611-222832-delete-five-shop-users-and-keys-implementation_CN.md`。

## 2026-06-12 Shop 涨价策略

- 最近扣费快照：2629 条 charged 记录，310,028,974 总 token，当前实收 73.932428 元，平均约 0.238 元 / 100 万总 token。
- 已兑换客户侧：19,760,709 总 token，当前实收 6.762756 元，平均约 0.342 元 / 100 万总 token。
- 推荐新价格版本为 `deepseek-v4-pro-rmb-20260612`：
  - 缓存命中输入：1000 nanos/token，即 1 元 / 100 万 token
  - 缓存未命中输入：30000 nanos/token，即 30 元 / 100 万 token
  - 输出：60000 nanos/token，即 60 元 / 100 万 token
- 新价格只应用未来 usage；不要重算历史扣费，不覆盖旧 `api_charge_records.price_version`。
- 内部或无订单账号占最近用量大头，应作为内部成本或测试流量单独处理，不要混入客户收入判断。
- 策略记录见 `docs/ai/context/20260612-120917-shop-price-increase-strategy_CN.md`。

## 2026-06-12 Shop 缓存命中输入最终涨价

- 用户最终决定采用低冲击涨价：只把缓存命中输入提高 10 倍，缓存未命中输入和输出不变。
- 当时生效价格版本为 `deepseek-v4-pro-rmb-20260612-cache-hit-10x`：
  - 缓存命中输入：250 nanos/token，即 0.25 元 / 100 万 token
  - 缓存未命中输入：3000 nanos/token，即 3 元 / 100 万 token
  - 输出：6000 nanos/token，即 6 元 / 100 万 token
- 此决策覆盖上一节的更激进推荐方案；后续不要误改成 1/30/60 元每百万 token。
- 新价格只应用未来 usage；不要重算历史扣费，不覆盖旧 `api_charge_records.price_version`。
- 设计与计划见 `docs/ai/context/20260612-122658-shop-cache-hit-price-10x-design-plan_CN.md`。

## 2026-06-12 Shop 输出 token 涨价到 20 元每百万

- 用户确认采用方案 1：新增价格版本，不复用旧版本名。
- 当前生效价格版本为 `deepseek-v4-pro-rmb-20260612-output-20rmb`：
  - 缓存命中输入：250 nanos/token，即 0.25 元 / 100 万 token
  - 缓存未命中输入：3000 nanos/token，即 3 元 / 100 万 token
  - 输出：20000 nanos/token，即 20 元 / 100 万 token
- 新价格只应用未来 usage；不要重算历史扣费，不覆盖旧 `api_charge_records.price_version`。
- Admin 收银构成按 `price_version` 回放历史：`deepseek-v4-pro-rmb-20260612-cache-hit-10x` 的输出仍按 6000 nanos/token 拆分，不能被新版本输出单价重算。
- 设计与计划见 `docs/ai/context/20260612-203049-shop-output-token-20rmb-design-plan_CN.md`。
- 实施记录见 `docs/ai/context/20260612-203504-shop-output-token-20rmb-implementation_CN.md`。

## 2026-06-12 `198****2044` models 端口复测

- 按最近上下文验证 `198****2044` 对应 Shop API key，preview 为 `sk-yui-8LKj2...Tv7mfI`。
- 从 `data/shop.sqlite` 解密订单 `ORDER829691158737` 的 API key 后，请求 `http://127.0.0.1:8317/v1/models` 返回 HTTP 200。
- 返回模型数为 5，说明该 key 当前可以连接本机 CLIProxyAPI models 端口。
- 记录见 `docs/ai/context/20260612-152824-19814722044-models-port-verification_CN.md`。

## 2026-06-12 Admin 用量监控收入口径与扣费日志设计

- 管理员控制台收入卡片不应再叫“消费”，应使用“今日收银”和“本月收银”，语义是 Shop 赚到的钱。
- Admin 收入金额只统计分组为 Shop 的托管 API key 扣费；Local 是个人使用成本，未托管 key 也不计入收入。
- 用量 token 汇总和分组列表仍可展示 Local / 未托管，因为它们属于监控视角，不是收入视角。
- 图三扣费明细当前 SQLite 已持久化到 `api_charge_records`，后续应额外追加本地 JSONL 审计日志，实时扣费和历史补账 apply 都要写，dry-run 不写。
- 设计与计划见 `docs/ai/context/20260612-165424-admin-usage-shop-revenue-and-local-charge-log-design-plan_CN.md`。

## 2026-06-12 Admin 用量监控收银与扣费日志实施

- `/shop/admin/` 用量监控的 Admin 账务卡片已改为“今日收银”和“本月收银”；Account 页面仍保留“今日消费 / 本月消费”。
- Admin 收银只统计 `api_charge_records.api_key_hash` 能关联到 `api_keys -> orders` 的 Shop 托管 key；Local 和未托管不计入收入。
- 该实施时计费规则已由测试锁定：缓存命中输入 250 nanos/token，即 0.25 元 / 100 万 token；未命中输入 3000 nanos/token；输出 6000 nanos/token。
- 本地扣费审计日志默认写入 `data/logs/shop-charge-records/api-charge-records-YYYY-MM.jsonl`；可用 `SHOP_CHARGE_AUDIT_LOG_DIR` 或补账脚本 `--audit-log-dir` 覆盖。
- 审计 JSONL 只保存 API key hash / preview 和扣费元数据，不保存完整 API key。
- 实时 usage 扣费和历史补账 apply 都会追加 JSONL；补账 dry-run 不写。
- 实施记录见 `docs/ai/context/20260612-170849-admin-usage-revenue-charge-log-implementation_CN.md`。

## 2026-06-12 Admin 业务办理区合并实施

- `/shop/admin/` 已将兑换码、生成密码重置码、充值审核合并为一个「业务办理」section。
- 顶部统一「刷新」同时刷新邀请码 / API key 池记录和充值审核列表；用量监控仍使用自己的刷新。
- 生成邀请码、生成重置码、补充 API key 池在上方操作台；充值审核优先展示在记录区。
- 未修改后端 API，未降低管理员 session、Same-Origin 和 CSRF 约束，未引入 `ADMIN_TOKEN`。
- 设计记录见 `docs/ai/context/20260612-171645-admin-business-section-merge-design_CN.md`。
- 实施记录见 `docs/ai/context/20260612-172852-admin-business-section-merge-implementation_CN.md`。

## 2026-06-12 Admin 用量收银图表设计

- `/shop/admin/` 用量监控保留原有 token 卡片、收银卡片、用量表和最近扣费记录，在收银卡片下方新增「收银分析」图表区。
- 今日收银和本月收银饼图只统计 Shop 托管 API key，不统计 Local / 未托管。
- 饼图按计费类型切分：缓存命中输入、缓存未命中输入、输出 token。
- 饼图分项金额按每条扣费记录的 `price_version` 拆分；未知版本才回退当前价格，不能把旧价格历史记录按新价格重算。
- Shop 用户消费柱状图展示已消费 / 已扣费金额，不展示余额；只包含 Shop 用户，不包含 Local。
- 柱状图默认本月排行，可切换今日排行，切换后按对应金额从高到低排序。
- 不引入第三方图表库；饼图使用 CSS `conic-gradient`，柱状图使用普通 HTML/CSS。
- 设计与计划见 `docs/ai/context/20260612-181520-admin-usage-revenue-charts-design_CN.md` 和 `docs/ai/context/20260612-181520-admin-usage-revenue-charts-plan_CN.md`。

## 2026-06-12 Admin 用量收银图表实施

- `/api/admin/usage-summary` 的 `billing` 新增 `todayRevenueParts`、`monthRevenueParts`、`customerSpendingRankings.today/month`。
- 图表数据继续只统计 Shop 托管 API key，Local / 未托管不进入收银构成或客户消费排行。
- 收银构成兼容旧价格版本 `deepseek-v4-pro-rmb-20260424`，历史缓存命中输入按 25 nanos/token 拆分；当前版本按 250 nanos/token 拆分。
- `/shop/admin/` 新增 `adminRevenueCharts`，位于收银卡片下方、用量明细表上方。
- 前端使用 `conic-gradient` 渲染今日 / 本月收银饼图，使用 HTML/CSS 渲染 Shop 用户消费柱状图。
- 全量验证 `npm test` 130 个测试通过；实施记录见 `docs/ai/context/20260612-182355-admin-usage-revenue-charts-implementation_CN.md`。

## 2026-06-12 Admin 收银图表渲染修复

- 图表文字出现但饼图 / 柱状图不可见的根因是 `shop/shop.js` 新增动态 Tailwind class 后，`styles/site.css` 没有同步重新构建并提交。
- 收银图表关键几何样式改为 `styles/tailwind.css` 中的 `admin-revenue-*` 组件类，避免过度依赖动态 utility class。
- `shop/shop.js` 对饼图和柱状图容器保留必要内联几何兜底，降低旧 CSS 缓存导致图形空白的风险。
- Shop 用户消费柱状图单根柱子使用像素高度，不使用 flex 子项中的百分比高度，否则浏览器可能解析为 0。
- 后续涉及动态 HTML 的新样式必须同步执行 `npm run build:css` 并提交 `styles/site.css`。
- 修复记录见 `docs/ai/context/20260612-195805-admin-revenue-chart-rendering-fix-design-plan_CN.md` 和 `docs/ai/context/20260612-200029-admin-revenue-chart-rendering-fix-implementation_CN.md`。

## 2026-06-12 Admin 用户消费排行堆叠柱

- `Shop 用户消费排行` 不是余额图，也不是 token 数图；柱顶金额和排序都按 Shop 用户已扣费总金额。
- 每个手机号的一根柱内部按金额拆成三段：黑色为缓存命中输入、白色为缓存未命中输入、灰色为输出 token。
- 今日 / 本月两个周期都必须使用同样的三段金额拆分。
- 后端排行项 `customerSpendingRankings.today/month[].parts` 按每条扣费记录的 `price_version` 拆分金额；Local / 未托管不进入排行。
- 白色的缓存未命中输入段必须有可见描边，图例白色点也必须保留边界，否则在白底上会像未渲染。
- 如果运行中的旧服务端尚未返回 `parts`，前端只能用黑色「旧格式总金额」兜底，避免白色空框；真实黑 / 白 / 灰三段需要重启 yui.web 让新版接口生效。
- 设计与实施记录见 `docs/ai/context/20260612-201447-admin-revenue-ranking-stacked-bars-design-plan_CN.md` 和 `docs/ai/context/20260612-201853-admin-revenue-ranking-stacked-bars-implementation_CN.md`。
- 可见性修正记录见 `docs/ai/context/20260612-202326-admin-revenue-stacked-bar-visibility-implementation_CN.md`。
- 旧接口颜色兜底记录见 `docs/ai/context/20260612-203831-admin-revenue-ranking-legacy-parts-color-fallback_CN.md`。

## 2026-06-12 Admin 用户余额面板位置设计

- 用户确认新增的所有用户余额面板合并进 `/shop/admin/` 的「业务办理」section。
- 推荐位置：充值审核下方、邀请码记录 / API key 池记录上方。
- 余额面板是账户台账视图，不属于「今日收银 / 本月收银」收入分析，也不放进「用量监控」。
- 第一版只读：展示总余额、欠费用户数、欠费金额、待确认充值金额，以及手机号、余额、欠费、待确认充值、API key 状态或托管 key 数量、最近更新时间。
- 「业务办理」统一刷新和充值审核确认 / 拒绝后都应刷新余额面板。
- 设计记录见 `docs/ai/context/20260612-195611-admin-account-balance-panel-placement-design_CN.md`。
- 实施计划见 `docs/ai/context/20260612-200053-admin-account-balance-panel-implementation-plan_CN.md`。

## 2026-06-12 Admin 用户余额面板实施

- `/shop/admin/` 的「业务办理」section 已新增只读「用户余额」面板，位置在充值审核下方、邀请码记录 / API key 池记录上方。
- 新接口 `/api/admin/account-balances` 返回 Shop 用户余额、欠费、待确认充值和托管 key 数量；管理员账号、Local / 未托管 usage key 不作为余额用户展示。
- 「业务办理」统一刷新和充值审核确认 / 拒绝后都会刷新余额面板。
- 余额面板是账户台账视图，不计入 Admin 用量监控的今日 / 本月收银。
- 第一版不提供直接调余额操作。
- 实施记录见 `docs/ai/context/20260612-202347-admin-account-balance-panel-implementation_CN.md`。

## 2026-06-12 Account 充值与用量展示精简

- `/shop/account/` 充值区域不再展示 `付款备注：YUI-...`，但后端 `paymentReference` 字段保留兼容。
- 充值申请备注框 placeholder 固定为 `备注可填写微信号`。
- Token 用量区域已删除 `accountUsageCards` 四个总览卡片，以及 `最近 24 小时` / `本月每日` 两个趋势卡片；保留本月消费、三段 token 和扣费流水。
- Account 场景的本月消费卡片不再显示内部价格版本名，副标题为 `本月已扣费`；Admin 收银卡片不受影响。
- 设计与实施记录见 `docs/ai/context/20260612-210011-account-recharge-and-usage-card-cleanup-design-plan_CN.md` 和 `docs/ai/context/20260612-210011-account-recharge-and-usage-card-cleanup-implementation_CN.md`。
- 趋势卡删除记录见 `docs/ai/context/20260612-210422-account-usage-trend-card-removal-design-plan_CN.md` 和 `docs/ai/context/20260612-210422-account-usage-trend-card-removal-implementation_CN.md`。

## 2026-06-13 GPT 模型人民币分模型计费

- 当前计费规则按 usage event 的 `model` 区分 `gpt-5.4` 和 `gpt-5.5`，金额数字按人民币元 / 100 万 tokens 理解，不做美元汇率换算。
- 当前价格版本：
  - `gpt-5.4-rmb-20260613`：缓存命中输入 250 nanos/token，缓存未命中输入 2500 nanos/token，输出 15000 nanos/token。
  - `gpt-5.5-rmb-20260613`：缓存命中输入 500 nanos/token，缓存未命中输入 5000 nanos/token，输出 30000 nanos/token。
- 未知模型沿用 `gpt-5.4-rmb-20260613` 价格扣费，但 `api_charge_records.model`、ledger memo 和审计日志继续保留原始模型名。
- 新价格只应用未来 usage；不要重算历史扣费，不覆盖旧 `api_charge_records.price_version`。
- Admin / Account 的收银构成必须按每条 `price_version` 回放历史价格；旧 DeepSeek 价格版本只作为历史记录解析保留。
- 设计与计划见 `docs/ai/context/20260613-090855-gpt-model-rmb-pricing-design_CN.md` 和 `docs/ai/context/20260613-090855-gpt-model-rmb-pricing-plan_CN.md`。
- 实施记录见 `docs/ai/context/20260613-091616-gpt-model-rmb-pricing-implementation_CN.md`。

## 2026-06-13 Account Token 英文总览卡片删除

- `/shop/account/` 的 Token 用量区域不再展示 `Input`、`Output`、`Reasoning`、`Cached` 四张英文总览卡片。
- 保留 `今日消费`、`本月消费`、`缓存命中输入`、`缓存未命中输入`、`输出 token` 五张业务卡片。
- 前端不再保留 `accountTokenBreakdown` 空容器或 `renderTokenBreakdown` 渲染函数。
- 设计与计划见 `docs/ai/context/20260613-092144-account-token-breakdown-card-removal-design-plan_CN.md`。

## 2026-06-13 Blog 文章列表 CSP 修复

- 线上 `/blog/` 文章不显示的直接原因是 CSP `script-src 'self'` 阻止了页面内联渲染脚本，不是 `js/blog-data.js` 缺数据。
- `/blog/index.html` 不应再依赖无 `src` 的内联 `<script>` 渲染文章；列表逻辑已迁移到 `js/blog-index.js`。
- Blog 首屏主题 / 语言预初始化逻辑已迁移到 `js/blog-ui-init.js`，保持同源外部脚本以符合 CSP。
- Cloudflare beacon CSP 报错和 favicon 404 是旁支，不是文章列表为空的根因。
- 设计与计划见 `docs/ai/context/20260613-093905-blog-inline-script-csp-rendering-fix-design-plan_CN.md`，实施记录见 `docs/ai/context/20260613-094115-blog-inline-script-csp-rendering-fix-implementation_CN.md`。

## 2026-06-13 `173****1728` API key 加入 CLIProxyAPI 入口

- 已从 `data/shop.sqlite` 找到手机号 `17371571728` 的已兑换订单 `ORDER266688966871`，API key preview 为 `sk-yui-oDUW3...vpe3s4`。
- 该 key 已追加到 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/config.yaml` 顶层 `api-keys` 列表；完整 key 不写入项目记忆。
- 配置备份为 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/backups/config-before-add-17371571728-key-20260613T050542Z.yaml`。
- 验证结果：使用该 key 请求 `http://127.0.0.1:8317/v1/models` 返回 HTTP 200，模型数为 5。
- 记录见 `docs/ai/context/20260613-140406-add-17371571728-key-to-cliproxyapi-plan_CN.md` 和 `docs/ai/context/20260613-140542-add-17371571728-key-to-cliproxyapi-implementation_CN.md`。

## 2026-06-13 Account 模型总览

- `/shop/account/` 的账户余额区域顶部新增「模型总览」表格，展示当前中转站模型和人民币计费价格。
- 模型总览后端接口为 `GET /api/account/model-overview`，必须登录；浏览器不接触完整 API key。
- 后端优先使用当前账号已兑换托管 API key 请求 `CLIPROXY_BASE_URL` 或默认 `http://127.0.0.1:8317/v1` 的 `/models`。
- 同账号有多把已兑换 key 时，模型总览会跳过不可用 key 继续尝试下一把；全部失败才回退价格表。
- 模型端点失败或账号暂无 API key 时，接口回退到 `lib/shop-pricing.js` 的价格表模型，不影响余额展示。
- 当前模型端点返回 5 个模型：`codex-auto-review`、`gpt-5.3-codex-spark`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.5`。
- 未知模型在模型总览中标记为沿用 `gpt-5.4`，与计费回退规则一致。
- 浏览器验证使用临时 SQLite 服务完成：未兑换时显示价格表回退，兑换后显示实时 5 个模型。
- 设计与计划见 `docs/ai/context/20260613-141903-account-model-overview-design-plan_CN.md`，实施记录见 `docs/ai/context/20260613-142550-account-model-overview-implementation_CN.md`，浏览器验证见 `docs/ai/context/20260613-142846-account-model-overview-browser-verification_CN.md`，多 key 修正见 `docs/ai/context/20260613-143322-account-model-overview-multi-key-retry_CN.md`。

## 2026-06-13 Account 模型总览删除计价列

- `/shop/account/` 模型总览前端不再展示「计价」列，也不展示 `gpt-5.4`、`gpt-5.5` 或 `沿用 gpt-5.4` 文案。
- 后端 `/api/account/model-overview` 仍保留 `priceModel` 和 `usesDefaultPrice` 字段，真实计费与未知模型沿用 `gpt-5.4` 的规则不变。
- 记录见 `docs/ai/context/20260613-144235-account-model-overview-remove-pricing-column_CN.md`。

## 2026-06-13 Shop B 级模块化重构设计

- 用户确认采用 B 级重构：中等力度拆分 Shop 前端模块和后端纯逻辑，不做一次性 C 级路由 / SQL / 迁移深拆。
- 当前本地运行网页会映射到公网；实现阶段不能在当前公网实例目录直接改业务代码，必须使用独立 worktree。
- 开发验收实例使用独立端口，例如 `4174`，并使用独立 SQLite，例如 `data/dev/shop-refactor.sqlite`。
- 开发实例必须禁用 usage 自动导入，避免写入真实账务库或读取 CLIProxyAPI usage 日志。
- 后端优先抽 `shop-money`、价格版本回放、收银统计和模型总览纯逻辑；`server.js` 暂保留路由、SQL statement 和事务边界。
- 前端保留 `/shop/shop.js` 作为入口，页面逻辑拆到 `shop/js/*`，并保持 `window.YuiShop` 对外初始化函数兼容。
- 设计见 `docs/ai/context/20260613-144411-shop-modular-refactor-design_CN.md`；实施计划见 `docs/ai/context/20260613-144411-shop-modular-refactor-plan_CN.md`。

## 2026-06-13 Account 模型总览删除来源提示

- `/shop/account/` 模型总览前端不再展示「价格表回退 / 实时模型，更新时间 ...」提示。
- 后端 `/api/account/model-overview` 仍保留 `source` 和 `checkedAt` 字段，模型端点探测与价格表回退逻辑不变。
- 记录见 `docs/ai/context/20260613-144458-account-model-overview-remove-source-hint_CN.md`。

## 2026-06-13 Shop B 级模块化重构实施

- Shop B 级模块化重构已在隔离 worktree `codex/shop-modular-refactor-20260613` 中实施，不影响当前公网映射实例。
- 后端金额、历史价格回放、收银统计、周消费和模型总览纯逻辑已拆入 `lib/shop-money.js`、`lib/shop-pricing.js`、`lib/shop-billing-summary.js`、`lib/shop-model-overview.js`。
- `server.js` 暂保留路由、SQL statement 和事务边界；后续不要把已抽出的纯逻辑再合回 `server.js`。
- Shop 前端已拆为 `shop/js/core.js`、`charts.js`、`auth.js`、`account.js`、`admin.js`、`legacy-redirects.js`；`shop/shop.js` 只做入口和 `window.YuiShop` 兼容层。
- 所有 Shop HTML 只直接加载 `/shop/shop.js` 入口，入口脚本会动态加载 `shop/js/*` 模块；后续新增 Shop 页面不要重复硬编码模块列表。
- `test/shop-frontend.test.js` 承接前端 VM、HTML、CSS 静态断言；`test/shop-flow.test.js` 保留后端集成流程和数据库行为测试。
- 独立验收实例使用 `http://127.0.0.1:4174` 和 `data/dev/shop-refactor.sqlite`，usage 自动导入关闭；后续涉及公网映射时继续使用独立 worktree、独立端口、独立 SQLite。
- 实施记录见 `docs/ai/context/20260613-152130-shop-modular-refactor-implementation_CN.md`。

## 2026-06-13 `193****7925` API key 加入 CLIProxyAPI 入口

- `193****7925` 对应 Shop 订单为 `ORDER367217111004`，API key preview 为 `sk-yui-3l5x_...fWnc6g`。
- 该 key 在 yui.web 内部状态为 `used`，hash 前 16 位为 `e21fa6adcd3c2b8e`，账号余额为 30 元。
- CLIProxyAPI 当前入口白名单来自 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/config.yaml` 顶层 `api-keys`，不是 `.env`。
- 已备份配置到 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/backups/config-before-add-19301367925-key-20260613-165117.yaml`，并将该 key 追加到 `api-keys`。
- 验证结果：请求 `http://127.0.0.1:8317/v1/models` 返回 HTTP 200，模型数 5，说明热加载已生效。
- 计划与实施记录见 `docs/ai/context/20260613-165117-add-19301367925-key-to-cliproxyapi-plan_CN.md` 和 `docs/ai/context/20260613-165117-add-19301367925-key-to-cliproxyapi-implementation_CN.md`。

## 2026-06-13 `152****8391` API key 加入 CLIProxyAPI 入口

- `152****8391` 对应 Shop 订单为 `ORDER407573319301`，API key preview 为 `sk-yui-OKeCq...hc9zuG`。
- 该 key 在 yui.web 内部状态为 `used`，hash 前 16 位为 `1124b890fb5fbc5c`，账号余额为 5 元。
- CLIProxyAPI 当前入口白名单来自 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/config.yaml` 顶层 `api-keys`，不是 `.env`。
- 已备份配置到 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/backups/config-before-add-15279148391-key-20260613-203919.yaml`；检查发现该完整 key 已存在于 `api-keys`，本次未重复写入。
- 验证结果：请求 `http://127.0.0.1:8317/v1/models` 返回 HTTP 200，模型数 5。
- 计划与实施记录见 `docs/ai/context/20260613-203919-add-15279148391-key-to-cliproxyapi-plan_CN.md` 和 `docs/ai/context/20260613-203919-add-15279148391-key-to-cliproxyapi-implementation_CN.md`。

## 2026-06-13 `193****7925` usage 导入排查

- CLIProxyAPI 本地 JSONL 已记录该用户 usage，但 yui.web 一开始只收到 1 条失败 usage event，`total_tokens=0`，所以 Admin 和 Account 都没有真实 token 消耗。
- 根因是 yui.web 本地 `.env` 未启用 `SHOP_USAGE_AUTO_IMPORT_ENABLED=true`；当前月 JSONL 没有被定时导入 SQLite。
- 已备份真实库到 `data/backups/shop-before-usage-auto-import-19301367925-20260613-170418.sqlite`。
- 已开启 `SHOP_USAGE_AUTO_IMPORT_ENABLED=true` 并重启 yui.web，启动自动导入当前月 JSONL。
- 验证结果：Admin 和 Account 侧均可看到该用户 `71385` tokens，5 次成功请求、2 次失败请求，扣费记录共 7 条。
- 记录见 `docs/ai/context/20260613-170613-19301367925-usage-import-investigation_CN.md`。

## 2026-06-13 usage 实时同步链路排查

- yui.web `/api/internal/usage-events` 接收端隔离验证正常：坏签名 401，合法签名 201，重复 `request_id` 幂等跳过。
- `193****7925` 的 2 条失败 usage 几乎实时入库，但 5 条成功 usage 是后来由 JSONL 自动导入补齐，说明问题集中在 CLIProxyAPI 实时 POST 链路。
- CLIProxyAPI 当前运行 dirty build，二进制包含 `internal/usage` publisher；干净实现位于 `codex/usage-event-publisher-clean`，当前 main 源码没有这些文件。
- CLIProxyAPI usage manager 会把请求 context 放进异步队列；sync client 使用该 context 发 POST。临时测试确认已取消 context 下 sync 请求不会到达接收端。
- 可靠兜底是 yui.web 自动导入 JSONL；如果需要秒级实时同步，应修 CLIProxyAPI publisher：事后 POST 使用独立短超时 context，不继承请求 context。
- 记录见 `docs/ai/context/20260613-171756-usage-realtime-sync-investigation_CN.md`。

## 2026-06-13 Admin / Account 消费统计日期口径

- `183****0091` 截图中的今日 `¥16.37` 是历史 usage 在 `2026-06-13 16:05 +08` 补导 / 补扣后按 `api_charge_records.created_at` 统计造成的，不是该账号当天实际调用消费。
- 该账号本月总扣费 `¥18.8035458` 是真实账本金额；按 usage 发生时间计算，当前今日消费为 `0`。
- Admin 收银构成、Shop 用户消费排行、Account billing 和周消费图表改为优先按 `usage_events.requested_at` 切分周期；缺失 usage 时才回退 `created_at`。
- 近期扣费记录仍按 `created_at` 排序，用于审计入账 / 补扣时间。
- 测试 helper 默认禁用 usage 自动导入，避免本地 `.env` 污染临时测试库。
- 已重启本地 `yui.web` 4173 服务；验证 `npm test` 160 个测试通过。
- 设计与计划见 `docs/ai/context/20260613-172727-admin-account-spending-date-basis-design-plan_CN.md`，实施记录见 `docs/ai/context/20260613-172727-admin-account-spending-date-basis-implementation_CN.md`。

## 2026-06-13 补充 20 个 Shop API key 池

- 已向 `data/shop.sqlite` 的 `api_keys` 池新增 20 个 `sk-yui-...` API key；导入完成时均为 `unused`。
- 最终复核时其中 1 个新增 key 已被兑换，当前状态为 `unused=19`、`used=14`；已兑换 preview 为 `sk-yui-OKeCq...hc9zuG`，订单 `ORDER407573319301`，手机号 `152****8391`。
- 新增 key 使用 `SHOP_API_KEY_ENCRYPTION_SECRET` 加密保存，`api_key` 列为 `enc_<hash>` 占位；完整 key 不写入协作文档或 AGENTS。
- 执行前已备份真实库到 `data/backups/shop-before-add-20-api-keys-20260613-174633.sqlite`。
- 导入脚本先把 `created_at` 写成了 UTC 时间加 `+08:00` 后缀，已修正为实际北京时间 `2026-06-13T16:47:24.506+08:00`；修正前备份为 `data/backups/shop-before-fix-add-20-api-key-created-at-20260613-175300.sqlite`。
- 已将同一批 key 追加到 CLIProxyAPI `/Users/wujianxiang/CodeSpace/CLIProxyAPI/config.yaml` 顶层 `api-keys`，配置备份为 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/backups/config-before-add-20-shop-api-keys-20260613-174633.yaml`。
- 验证结果：CLIProxyAPI 入口 key 数量为 35 且无重复。
- 抽样新 key 请求 `/v1/models` 返回 `401 api_key_inactive` 是预期行为：CLIProxyAPI 已识别该入口 key，但 Shop 内仍未兑换，未绑定订单和余额，不能直接使用。
- 后续兑换后 key 状态会变为 `used` 并绑定订单；账户余额有效时内部状态接口才会返回 active。
- 计划与实施记录见 `docs/ai/context/20260613-174633-add-20-shop-api-keys-plan_CN.md` 和 `docs/ai/context/20260613-174633-add-20-shop-api-keys-implementation_CN.md`。

## 2026-06-13 Shop 账务时间口径与历史补账价格

- 扣费统计周期按 usage 实际发生时间 `usage_events.requested_at` 归属今日 / 本月 / 每日；`api_charge_records.created_at` 只表示入账或补扣时间。
- 历史补账价格必须按 usage 发生时间选择价格版本，不能按补账执行时间套用当前价格。
- `priceUsageTokens(event)` 应传入 `requestedAt` / `requested_at`；缺失或非法时间才回退当前模型价格。
- `lib/shop-usage-reconcile.js` 补账候选必须查询并传入 `requested_at`。
- Admin usage summary 的 token 统计、收银统计和 Account usage summary 都使用 UTC+8 日期边界。
- `183****0091` 当前真实账本本月消费为 `18.803545800` 元，但按发生时价格应扣 `6.914881000` 元，净多扣 `11.888664800` 元；本次只修代码和 dry-run，未改真实库余额 / 流水 / 历史扣费记录。
- Admin `/api/admin/usage-summary` 的 `q/group/status` 当前只过滤 `items` 用量分组表，不过滤 `summary` 和 `billing`；排查单个手机号时不要把全局收银卡片误读为该手机号金额。
- 核对与实施记录见 `docs/ai/context/20260613-174516-billing-temporal-pricing-audit-plan_CN.md` 和 `docs/ai/context/20260613-175610-billing-temporal-pricing-audit-implementation_CN.md`。

## 2026-06-13 Admin 用户余额状态文案修复

- `/shop/admin/` 用户余额面板的 `billingStatusText is not defined` 来自前端模块化后的作用域隔离，不是后端余额接口错误。
- `billingStatusText` 和 `topupStatusText` 由 `window.YuiShopAccount` 导出；Admin 模块使用时必须显式解构，不要假设它们是全局函数。
- 已新增前端 VM 回归测试覆盖 `renderAdminBalanceTable` 和 `renderAdminTopups` 状态文案渲染。
- 设计与计划见 `docs/ai/context/20260613-175752-admin-balance-status-helper-fix-design-plan_CN.md`，实施记录见 `docs/ai/context/20260613-175845-admin-balance-status-helper-fix-implementation_CN.md`。

## 2026-06-14 Account 兑换自动同步 CLIProxyAPI 入口

- 新兑换 API key 出现 401 的根因是 yui.web SQLite 状态已 active，但 CLIProxyAPI 入口鉴权只读取 `/Users/wujianxiang/CodeSpace/CLIProxyAPI/config.yaml` 顶层 `api-keys`。
- 已采用方案 A：`redeemInvite()` 分配出完整 key 后、订单落库前同步追加到 CLIProxyAPI `api-keys`。
- 生产或真实本机服务需配置 `CLIPROXY_CONFIG_PATH=/Users/wujianxiang/CodeSpace/CLIProxyAPI/config.yaml`；可选 `CLIPROXY_CONFIG_BACKUP_DIR` 指向备份目录。
- 未配置 `CLIPROXY_CONFIG_PATH` 时同步禁用，测试 helper 默认传空路径，避免 `.env` 污染测试误写真实配置。
- 同步失败返回 `CLIPROXY_SYNC_FAILED` 并回滚兑换事务，避免用户拿到 Shop 已兑换但代理入口不可用的半成功 key。
- 后续不要再依赖手工为单个兑换用户追加 CLIProxyAPI `api-keys`，除非是在修复历史遗留 key。
- 设计、计划与实施记录见 `docs/ai/context/20260614-130424-account-redeem-cliproxy-auto-sync-design_CN.md`、`docs/ai/context/20260614-130424-account-redeem-cliproxy-auto-sync-plan_CN.md` 和 `docs/ai/context/20260614-130800-account-redeem-cliproxy-auto-sync-implementation_CN.md`。

## 2026-06-14 GPT 缓存命中与输出价格砍半

- 当前生效价格版本改为：
  - `gpt-5.4-rmb-20260614-half-cache-hit-output`：缓存命中输入 125 nanos/token，即 0.125 元 / 100 万 token；缓存未命中输入 2500 nanos/token，即 2.5 元 / 100 万 token；输出 7500 nanos/token，即 7.5 元 / 100 万 token。
  - `gpt-5.5-rmb-20260614-half-cache-hit-output`：缓存命中输入 250 nanos/token，即 0.25 元 / 100 万 token；缓存未命中输入 5000 nanos/token，即 5 元 / 100 万 token；输出 15000 nanos/token，即 15 元 / 100 万 token。
- 本次只砍半缓存命中输入和输出价格；未命中输入保持 2026-06-13 价格不变。
- 新价格从 `2026-06-14T13:01:06+09:00` 起按 usage 实际发生时间生效；之前的 GPT usage 继续按 `gpt-5.4-rmb-20260613` / `gpt-5.5-rmb-20260613` 回放。
- 未知模型继续沿用当前默认模型 `gpt-5.4`，因此新 usage 使用 `gpt-5.4-rmb-20260614-half-cache-hit-output`。
- 不重算历史扣费，不覆盖旧 `api_charge_records.price_version`，不修改真实库余额。
- 设计与计划见 `docs/ai/context/20260614-130106-gpt-price-half-cache-hit-output-design-plan_CN.md`。

## 2026-06-14 Account 模型价格展示精度

- `/shop/account/` 模型总览价格展示不能固定 `toFixed(2)`，否则 `0.125 元 / 100 万 token` 会被四舍五入成 `¥0.13`。
- Account 模型价格展示规则：能用两位精确表达的价格显示两位，例如 `¥2.50`、`¥15.00`；需要三位才能精确表达的价格显示三位，例如 `¥0.125`。
- Account 页和动态加载的 `shop/js/account.js` 已更新缓存版本为 `20260614-account-price-display`。
- 设计与计划见 `docs/ai/context/20260614-131025-account-model-price-display-design-plan_CN.md`，实施记录见 `docs/ai/context/20260614-131025-account-model-price-display-implementation_CN.md`。

## 2026-06-14 Admin 收银金额核对

- `/shop/admin/` 收银分析和 Shop 用户消费排行当前金额按每条 `api_charge_records.price_version` 回放历史价格并汇总，不按当前最新价格重算历史 usage。
- 2026-06-14 13:05 核对真实库：本月 Shop charged 记录 1350 条，按 `price_version` 复算与账本 `charge_nanos` 完全一致，0 条不匹配。
- 截图今日 `¥5.30` 来自 `19301367925` 的 41 条 `gpt-5.5-rmb-20260613` 记录；若按 2026-06-14 最新 `gpt-5.5` 半价规则重算则为 `¥3.684334`，不应替代真实账本收银。
- 截图本月 `¥97.07` 是多个历史价格版本混合回放；若按当前最新模型价格强行重算本月全部 Shop token，则为 `¥84.446874500`。
- 如果后续需要“按当前最新价模拟重算历史区间”，应新增模拟分析口径，不能覆盖 Admin 收银金额、真实扣费、余额和流水。
- 核账记录见 `docs/ai/context/20260614-130541-admin-revenue-ranking-pricing-audit_CN.md`。

## 2026-06-16 Account 欠费上限展示移除

- 当前 API key 放行逻辑是余额必须大于 0；余额等于 0 或负数都会返回 `insufficient_balance`。
- `account_balances.credit_limit_*` 的 10 元字段不参与 API 调用放行，只保留为历史兼容字段。
- `/shop/account/` 不应展示「欠费上限」，避免用户误解为可以欠费 10 元后才停用。
- 设计与计划见 `docs/ai/context/20260616-101833-account-remove-credit-limit-display-design-plan_CN.md`。
