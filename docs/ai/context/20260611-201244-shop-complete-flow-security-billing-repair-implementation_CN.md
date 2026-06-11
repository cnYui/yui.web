# Shop 完整流程安全与扣费修复实施记录

- 执行计划：`docs/ai/context/20260611-185745-shop-complete-flow-security-billing-repair-implementation-plan_CN.md`
- 完成阶段：Phase 0 到 Phase 6
- 当前分支：`codex/shop-flow-security-billing-repair`

## 已完成修复

- 登录态兑换：Account / Redeem 只把邀请码兑换到当前登录手机号，忽略请求体手机号。
- Admin 兑换码管理：管理员 session 可生成邀请码、导入 API key 池、查看 invite console；页面不展示 `ADMIN_TOKEN`。
- usage 自动同步：内置 JSONL 自动导入状态和手动触发接口，导入保持幂等。
- Token 与扣费：统一使用 `lib/shop-pricing.js` 的 DeepSeek RMB nanos 固定价格；缓存命中输入、未命中输入、输出、reasoning 明细可展示。
- 历史 usage 补账：新增 dry-run/apply CLI，apply 前备份，重复执行不重复扣费。
- API key 静态加密：配置 `SHOP_API_KEY_ENCRYPTION_SECRET` 后新写入密文；旧明文兼容读取；迁移 CLI 支持旧 schema dry-run。
- Reveal 文案：完整 API key 响应不再声称服务端 60 秒过期，只提示“本次响应返回”。

## 验证

- `npm test`：通过，125 个测试通过。
- `npm run build:css`：通过，Tailwind 构建完成；仅有 Browserslist 数据旧的维护提示。
- `node --test lib/shop-api-key-crypto.test.js`：通过，6 个测试通过。
- `SHOP_API_KEY_ENCRYPTION_SECRET=... node scripts/shop-encrypt-api-keys.js --dry-run --db data/shop.sqlite`：通过，只读未 apply。

## 临时库流程验收

使用临时 SQLite 启动本地 app 完整走通：

- 登录页、注册页可访问。
- 未登录访问 Account 跳转登录页。
- 管理员登录后可访问 Admin，页面包含“兑换码管理”，不包含 `ADMIN_TOKEN` / `x-admin-token`。
- 管理员可通过 session 接口导入 API key、生成邀请码。
- 新用户注册后初始没有 API key。
- Account 页存在邀请码兑换入口。
- Redeem 页不再出现手机号输入。
- 用户兑换时请求体伪造手机号被忽略，订单绑定当前 session 手机号。
- 用户充值后，管理员审核入账，余额增加。
- usage event 通过 `api_key_hash` 入库后生成扣费记录，命中/未命中/输出 token 明细正确。
- Admin invite console 可看到已使用 API key。

## 真实库操作

- usage 补账 dry-run 已执行，记录见 `docs/ai/context/20260611-195135-shop-usage-billing-reconcile-dry-run_CN.md`。
  - 预计新增/调整扣费总额：`32870254600` nanos。
  - 本次未执行 usage 补账 `--apply`。
- API key 加密迁移 dry-run 已执行，记录见 `docs/ai/context/20260611-200103-shop-api-key-encryption-implementation_CN.md`。
  - `api_keys` 明文 8 条，已加密 0 条。
  - `orders` 明文 6 条，已加密 0 条。
  - 本次未执行 API key 加密迁移 `--apply`。

## 剩余风险

- 真实库 usage 补账 apply 需要用户确认后执行，并保留备份。
- 真实库 API key 加密迁移 apply 需要先配置稳定的 `SHOP_API_KEY_ENCRYPTION_SECRET`，用户确认 dry-run 数字后执行。
- 生产环境需要确认 usage JSONL 路径和自动导入权限配置正确。
