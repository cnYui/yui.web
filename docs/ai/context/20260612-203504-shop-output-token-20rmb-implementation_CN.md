# Shop 输出 token 涨价到 20 元每百万实施记录

## 改动

- `lib/shop-pricing.js` 当前价格版本改为 `deepseek-v4-pro-rmb-20260612-output-20rmb`。
- 当前输出 token 价格改为 `20000 nanos/token`，即 20 RMB / 100 万 token。
- 缓存命中输入继续为 `250 nanos/token`，缓存未命中输入继续为 `3000 nanos/token`。
- `server.js` 的 Admin 收银历史拆分显式保留旧版本 `deepseek-v4-pro-rmb-20260612-cache-hit-10x`：
  - 缓存命中输入：250 nanos/token
  - 缓存未命中输入：3000 nanos/token
  - 输出：6000 nanos/token
- 未重算历史扣费，未修改数据库数据。

## 测试

- `lib/shop-pricing.test.js` 锁定新版本和输出 token 新单价。
- `test/shop-flow.test.js` 更新实时扣费、余额、流水、Admin 收银构成和用户消费排行预期。
- `test/shop-flow.test.js` 新增旧 `deepseek-v4-pro-rmb-20260612-cache-hit-10x` output 历史记录拆分断言，防止旧记录被当前 20 元输出价重算。

## 验证

- `node --test lib/shop-pricing.test.js`：5 个测试通过。
- `node --test test/shop-flow.test.js`：117 个测试通过。
- `npm test`：133 个测试通过，0 失败。
