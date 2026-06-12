# Admin 用量监控 Shop 收入与本地扣费日志设计计划

## 背景

- 管理员控制台 `/shop/admin/` 的用量监控现在把账务卡片显示为“今日消费 / 本月消费”，语义像成本，不符合实际经营视角。
- 后端 `buildUsageSummary` 当前使用全部 `api_charge_records` 聚合 `billing`，会把 `usage_key_profiles` 中的 Local 个人 key 扣费也计入后台账务汇总。
- 图三的扣费明细当前已持久化到 SQLite 的 `api_charge_records`，账户流水另存于 `account_ledger_entries`；但没有追加型本地审计日志文件。

## 必须解决的问题

1. 管理员控制台收入卡片文案改为经营视角：
   - “今日消费”改为“今日收银”
   - “本月消费”改为“本月收银”
   - “今日已扣费”改为“今天收银多少钱”
   - 本月卡片说明改为“本月一共收了多少钱”
2. 管理员控制台的收入金额只累加分组为 Shop 的托管用户扣费。
   - Local 是个人使用成本，不算收入。
   - 未托管 key 没有 Shop 订单归属，也不算收入。
   - token 总量列表仍保留全部分组统计，因为它是用量监控，不是收入统计。
3. 扣费明细保留现有 SQLite 主账本，同时新增本地 JSONL 审计日志。
   - 实时 usage 写入扣费时追加日志。
   - 历史补账 apply 创建或调整扣费时也追加日志。
   - dry-run 不写日志。

## 方案比较

### 方案 A：只改前端文案，不改后端聚合

- 优点：改动最小。
- 缺点：Local 金额仍被当成收入，根本问题没解决。
- 结论：不采用。

### 方案 B：后端只过滤 `api_charge_records.phone` 是否存在订单

- 优点：实现简单，不需要新增字段。
- 缺点：如果 Local profile 使用了管理员手机号，而该手机号也有 Shop 订单，可能误计入收入；判断边界不够干净。
- 结论：不采用。

### 方案 C：按 API key hash 判断 Shop 归属，并追加本地 JSONL 审计日志

- 优点：收入口径以 Shop 托管 API key 为准，Local 与未托管天然排除；账务明细既有 SQLite 主账本，也有本地追加日志，方便离线审计。
- 缺点：需要新增一个小的日志工具模块，并让实时扣费与补账脚本共用。
- 结论：推荐采用。

## 推荐设计

### 后端收入口径

- 新增内部函数判断一条 `api_charge_records` 是否属于 Shop：
  - 依据 `api_key_hash` 能匹配 `api_keys`，并且该 key 通过 `order_id` 或旧兼容 `api_key` 关联到 `orders`。
  - 不参考 `usage_key_profiles`，避免 Local profile 混入收入。
- 管理员 `/api/admin/usage-summary` 的 `billing` 使用 Shop 过滤后的扣费记录。
- `summary` 和 `items` 继续按全部 usage events 聚合，不改变用量监控表格。
- 账户页 `/api/account/usage-summary` 不改变，用户仍看自己的扣费明细。

### 前端文案

- `renderBillingUsageCards` 增加可选场景参数：
  - 管理员页面传入 `mode: 'adminRevenue'`，显示“今日收银 / 本月收银”。
  - 账户页保持“今日消费 / 本月消费”，因为对用户来说确实是消费。
- 不改卡片结构，避免影响现有布局。

### 本地审计日志

- 新增 `lib/shop-charge-audit-log.js`：
  - 默认目录：`data/logs/shop-charge-records/`
  - 默认文件：`api-charge-records-YYYY-MM.jsonl`
  - 支持通过 `SHOP_CHARGE_AUDIT_LOG_DIR` 覆盖目录。
  - 每条日志一行 JSON，包含 `loggedAt`、`source`、`chargeId`、`phone`、`usageEventId`、`apiKeyHash`、`model`、token 拆分、`priceVersion`、`chargeNanos`、扣前/扣后余额、`status`。
  - 日志只追加，不参与业务计算；写失败不应破坏数据库扣费，但应在服务日志输出错误。
- 实时路径 `chargeUsageEventInCurrentTransaction` 在数据库写入成功后追加日志。
- 补账路径 `reconcileUsageBilling(..., { apply: true })` 在 insert/update charge 后追加日志。
- 测试中使用临时目录，避免污染真实 `data/logs`。

## TDD 实施计划

1. 写失败测试：管理员 usage summary 中同时存在 Shop 和 Local 扣费时，`billing.monthChargeNanos` 只等于 Shop 扣费。
2. 写失败测试：Admin 前端脚本包含“今日收银 / 本月收银”，账户页消费文案不被改掉。
3. 写失败测试：实时 usage 扣费后，本地 JSONL 生成一条扣费审计记录。
4. 写失败测试：补账 apply 后，本地 JSONL 生成历史补账审计记录；dry-run 不生成。
5. 实现 Shop 收入口径过滤。
6. 实现前端文案参数化。
7. 实现本地 JSONL 审计日志模块，并接入实时扣费与补账。
8. 运行 `npm test`，必要时运行目标单测反复验证。

## 风险与边界

- 不重算历史扣费金额，不修改旧 `api_charge_records.price_version`。
- 不把 Local 从用量监控表移除，只是不计入“赚的钱”。
- 不在审计日志保存完整 API key，只保存 hash 和 preview，避免本地日志泄露密钥。
- 审计日志是辅助文件，SQLite 仍是账务事实来源。
