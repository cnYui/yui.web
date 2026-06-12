# Admin 用量监控收银与本地扣费日志实施计划

## 目标

- 管理员控制台把 Shop 客户扣费展示为“收银”，不把 Local 个人使用成本计入收入。
- 确认并用测试锁定当前计费规则：缓存命中输入为 250 nanos/token，即 0.25 元 / 100 万 token。
- 扣费明细除 SQLite 主账本外，追加本地 JSONL 审计日志。

## 文件

- 修改 `server.js`
  - Admin billing 汇总只使用 Shop 托管 key 的扣费记录。
  - 实时扣费后追加审计日志。
- 修改 `shop/shop.js`
  - Admin 页面调用 `renderBillingUsageCards` 时使用收银文案。
  - Account 页面保留消费文案。
- 新增 `lib/shop-charge-audit-log.js`
  - 负责本地 JSONL 路径、序列化和追加写入。
- 修改 `lib/shop-usage-reconcile.js`
  - 历史补账 apply 写入审计日志，dry-run 不写。
- 修改 `test/shop-flow.test.js`
  - 覆盖 Admin 收入口径、前端文案、实时扣费日志。
- 修改 `test/shop-usage-reconcile.test.js`
  - 覆盖补账日志与 dry-run 不写。
- 修改 `AGENTS.md`
  - 记录最终实施结果和计费确认。

## 步骤

1. 写失败测试：Admin usage summary 同时有 Shop 和 Local 扣费，`billing.monthChargeNanos` 只等于 Shop 金额，并断言 Shop 金额包含命中 token 250 nanos/token。
2. 写失败测试：前端脚本包含 Admin 收银文案，且普通账户页仍保留消费文案。
3. 写失败测试：实时 usage 扣费后，在临时目录生成 `api-charge-records-YYYY-MM.jsonl`，内容不包含完整 API key。
4. 写失败测试：补账 dry-run 不生成 JSONL，apply 生成一条 `reconcile` 来源日志。
5. 实现 Shop 收入口径过滤：以 `api_key_hash` 能关联 `api_keys -> orders` 为准，不参考 Local profile。
6. 实现前端 `renderBillingUsageCards(billing, options)`，Admin 传 `mode: 'adminRevenue'`。
7. 实现 `appendShopChargeAuditLog`，默认写 `data/logs/shop-charge-records/api-charge-records-YYYY-MM.jsonl`，测试可传临时目录。
8. 接入实时扣费与补账 apply。
9. 运行目标测试，再运行 `npm test`。

## 验收

- `npm test` 通过。
- Admin “今日收银 / 本月收银”只统计 Shop。
- 0.25 元 / 百万命中 token 由 `lib/shop-pricing.js` 和 Admin 汇总测试共同覆盖。
- 本地 JSONL 只保存 hash、preview 和扣费元数据，不保存完整 API key。
