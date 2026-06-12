# Admin 用量监控收银与本地扣费日志实施记录

## 已实施

- `/shop/admin/` 用量监控的账务卡片在 Admin 场景改为：
  - 今日收银：今天收银多少钱
  - 本月收银：本月一共收了多少钱
- `Account` 场景保留“今日消费 / 本月消费”，因为这是用户视角。
- Admin 收银金额改为只统计 Shop 托管 API key 的 `api_charge_records`：
  - 判断依据是 `api_charge_records.api_key_hash` 能关联到 `api_keys -> orders`。
  - 不参考 `usage_key_profiles`，避免 Local profile 被当成收入。
  - Local 和未托管 key 仍保留在 token 用量监控列表里，但不计入收银。
- 当前价格规则已由测试锁定：
  - 缓存命中输入：250 nanos/token，即 0.25 元 / 100 万 token。
  - 缓存未命中输入：3000 nanos/token，即 3 元 / 100 万 token。
  - 输出：6000 nanos/token，即 6 元 / 100 万 token。
- 新增本地扣费审计日志模块 `lib/shop-charge-audit-log.js`：
  - 默认目录为 `data/logs/shop-charge-records/`。
  - 文件名为 `api-charge-records-YYYY-MM.jsonl`。
  - 支持 `SHOP_CHARGE_AUDIT_LOG_DIR` 或测试参数覆盖目录。
  - 只保存 API key hash / preview 和扣费元数据，不保存完整 API key。
- 实时 usage 扣费和历史补账 apply 都会追加 JSONL；补账 dry-run 不写。
- `scripts/shop-reconcile-usage-billing.js` 新增 `--audit-log-dir` 可选参数；未传时跟随数据库目录写到 `data/logs/shop-charge-records/`。
- 测试 helper 默认把扣费审计日志写到临时目录，避免污染真实 `data/logs`。

## 验证

- 已执行 `node --test test/shop-flow.test.js test/shop-usage-reconcile.test.js`：115 个测试通过。
- 已执行 `npm test`：128 个测试通过。
- 已确认测试后没有真实 `data/logs/shop-charge-records` JSONL 残留。

## 后续约束

- 后续不要把 Admin 收银改回全量 `api_charge_records` 聚合。
- 后续不要把 Local 个人使用扣费计入收入。
- 后续不要在本地 JSONL 写完整 API key。
- 新价格只影响未来 usage，不重算历史扣费。
