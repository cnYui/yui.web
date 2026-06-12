# Shop 输出 token 调价到 20 元每百万设计与计划

## 背景

- 用户确认采用方案 1：只把当前项目输出 token 的后续扣费价格改为 20 RMB / 100 万 token。
- 当前生效价格版本是 `deepseek-v4-pro-rmb-20260612-cache-hit-10x`：
  - 缓存命中输入：250 nanos/token
  - 缓存未命中输入：3000 nanos/token
  - 输出：6000 nanos/token
- 20 RMB / 100 万 token 等于 `20000 nanos/token`。

## 设计

- 新增价格版本 `deepseek-v4-pro-rmb-20260612-output-20rmb`，只影响后续 usage 扣费。
- 缓存命中输入和缓存未命中输入价格保持不变。
- 不重算历史 `api_charge_records`，不覆盖旧记录的 `price_version`。
- Admin 收银构成按扣费记录的 `price_version` 回放：
  - `deepseek-v4-pro-rmb-20260424` 保持缓存命中输入 25 nanos/token、输出 6000 nanos/token。
  - `deepseek-v4-pro-rmb-20260612-cache-hit-10x` 保持缓存命中输入 250 nanos/token、输出 6000 nanos/token。
  - 新版本和未知版本使用当前价格，输出为 20000 nanos/token。

## 取舍

- 不直接复用旧版本名，避免历史图表按新输出价格拆分旧记录。
- 不增加配置项，价格仍然是项目内部固定人民币价格，符合现有 Shop 计费模型。
- 不做数据库迁移；真实扣费事实由 `api_charge_records.price_version` 和 `charge_nanos` 记录。

## 实施计划

1. 先改 `lib/shop-pricing.test.js`，让当前价格版本和输出扣费断言失败。
2. 更新 `lib/shop-pricing.js` 的版本号和 `outputNanosPerToken`。
3. 更新 `server.js` 的 `billingPriceForVersion`，显式保留旧 `cache-hit-10x` 版本价格。
4. 更新 `test/shop-flow.test.js` 中 Admin 收银图表的新价格预期，并补充旧 `cache-hit-10x` 输出拆分不被重算的断言。
5. 更新 `AGENTS.md` 项目记忆。
6. 运行定向测试，再运行全量 `npm test`。
7. 新增实施记录到 `docs/ai/context/`。
