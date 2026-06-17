# 订阅池官方 GPT 计价设计

## 背景

- 本分支：`codex/subscription-pool-pricing-design`。
- 目标：设计一套不影响当前线上按量计费分支的新计价规则。
- 当前项目只允许两个模型：`gpt-5.4` 和 `gpt-5.5`。
- 新规则从“人民币余额按项目内部价格扣费”切到“人民币订阅费购买每日美元 API 成本额度”。
- 用户已确认采用方案 B，整个计费系统在本分支目标运行态切换为美元额度计费和扣费。
- 用户确认三档订阅：
  - 29 元 / 月：每日 19 美元额度。
  - 39 元 / 月：每日 29 美元额度。
  - 59 元 / 月：每日 49 美元额度。
- 加量包口径沿用用户示例：5 元可购买 5 美元额度。
- 每日额度按东八区 0 点刷新，当天未使用完的额度不累计到次日。
- 三个套餐都允许使用 `gpt-5.4` 和 `gpt-5.5`。

## 官方价格调查

来源：OpenAI 官方 API Pricing 页面，`https://developers.openai.com/api/docs/pricing`。

截至 2026-06-16，用户截图和官方价格页中本项目需要采用的价格为：

| 模型 | 输入 Token 价格（每 100 万 tokens） | 命中缓存输入价格（每 100 万 tokens） | 输出 Token 价格（每 100 万 tokens） |
| --- | ---: | ---: | ---: |
| `gpt-5.4` | $2.50 | $0.25 | $15.00 |
| `gpt-5.5` | $5.00 | $0.50 | $30.00 |

本项目第一版只实现这一套计价规则。不要在实现中引入 Batch / Flex / Priority，也不要区分长短上下文。Codex / CLIProxyAPI 侧会处理上下文压缩；yui.web 只按 usage event 最终上报的 token 数和上表价格扣每日美元额度。

## 必须解决的问题

1. 不能污染现有 `account_balances.balance_nanos`。
   - 现有余额字段语义是人民币余额，且已被 Admin 收银、Account 余额、扣费流水、充值审核、API key 放行逻辑使用。
   - 新订阅池是美元额度，不应复用人民币余额字段。
2. 不能重算历史 `api_charge_records`。
   - 现有按量计费历史仍按旧 `price_version` 回放。
   - 新规则只应用新分支上线后的 usage。
3. 必须记录官方价格快照版本。
   - 官方价格会变化，账务记录必须保存当时使用的价格版本，不能根据当前价格重算历史。
4. 必须让超额行为可解释。
   - 请求前额度已用尽：阻止请求。
   - 请求前还有额度，但请求后扣成负数：允许本次完成，下一次阻止。
   - 这与当前“余额很少时本次调用可扣成负数且下一次状态检查拒绝”的项目语义一致。

## 方案对比

### 方案 A：把美元额度折成人民币余额

- 做法：用户购买订阅后按某个汇率写入 `account_balances.balance_nanos`。
- 优点：改动最少，复用现有余额和扣费记录。
- 问题：
  - 汇率和美元额度混在人民币余额里，Admin 收银和 Account 消费会失真。
  - 历史按量计费与订阅池无法清晰拆账。
  - 以后改官方价格或汇率会影响用户理解。
- 结论：不采用。

### 方案 B：独立美元额度账本

- 做法：新增订阅、每日额度、加量包、美元扣费记录四类事实表。
- 优点：
  - 保留现有按量计费分支和历史账务。
  - 新规则可独立灰度，不影响现在线上扣费。
  - Admin 可同时看人民币收入和美元额度消耗。
  - 官方价格版本可以单独回放。
- 问题：
  - 数据表和前端展示改动更多。
- 结论：推荐采用。

### 方案 C：只在 CLIProxyAPI 侧限流，不在 yui.web 记账

- 做法：CLIProxyAPI 直接按 usage JSONL 计算每日额度并拦截。
- 优点：yui.web 改动少。
- 问题：
  - yui.web 不是账务事实来源，Account / Admin 不能可靠展示额度和流水。
  - 容易出现 JSONL 重放、实时同步延迟、手动修正无法审计的问题。
- 结论：不采用。

## 推荐设计

采用方案 B：独立美元额度账本。

核心原则：

- 人民币只表示用户支付金额和商店收入。
- 美元只表示官方 API 成本额度和消耗。
- usage 扣费按 token 和官方价格快照计算。
- 每日额度按 UTC+8 / 东八区 0 点日期边界重置，不结转。
- 加量包默认当日有效，不结转。
- 本分支目标运行态替换为订阅池美元计费；旧人民币余额和旧 `api_charge_records` 只作为历史兼容数据保留，不再作为新 usage 扣费事实。

## 套餐规则

| 套餐 id | 展示名 | 月费 | 每日基础额度 | 周期 |
| --- | --- | ---: | ---: | --- |
| `sub_29_daily_19_usd` | 29 元订阅池 | 29 元 / 月 | $19 / 天 | 自开通日起 30 天 |
| `sub_39_daily_29_usd` | 39 元订阅池 | 39 元 / 月 | $29 / 天 | 自开通日起 30 天 |
| `sub_59_daily_49_usd` | 59 元订阅池 | 59 元 / 月 | $49 / 天 | 自开通日起 30 天 |

三个套餐都允许调用 `gpt-5.4` 和 `gpt-5.5`。套餐差异只体现在每日美元额度，不在模型可用性上做区分。

建议第一版使用“30 天周期”，不要绑定自然月。原因：

- 用户任意日期开通都容易解释。
- 续费逻辑简单。
- 当前项目已有订单过期时间语义，可复用一部分展示和状态判断。

## 加量包规则

| 加量包 id | 价格 | 增加额度 | 有效期 |
| --- | ---: | ---: | --- |
| `addon_5_usd_daily` | 5 元 | $5 | 当日有效 |
| `addon_10_usd_daily` | 10 元 | $10 | 当日有效 |
| `addon_20_usd_daily` | 20 元 | $20 | 当日有效 |
| `addon_50_usd_daily` | 50 元 | $50 | 当日有效 |

第一版不做赠送额度，避免用户用低价加量包绕过套餐分层。

## 扣费公式

金额事实字段建议使用 USD micros：

```text
1 USD = 1_000_000 usd_micros
```

官方美元价格：

```text
gpt-5.4:
  cache_hit_input_usd_micros = cache_hit_input_tokens * 0.25
  cache_miss_input_usd_micros = cache_miss_input_tokens * 2.50
  output_usd_micros = output_tokens * 15.00

gpt-5.5:
  cache_hit_input_usd_micros = cache_hit_input_tokens * 0.50
  cache_miss_input_usd_micros = cache_miss_input_tokens * 5.00
  output_usd_micros = output_tokens * 30.00
```

上面的每 token 计算要按“每百万 token 价格”换算：

```text
charge_usd_micros =
  ceil(cache_hit_input_tokens * cache_hit_input_usd_per_million)
+ ceil(cache_miss_input_tokens * cache_miss_input_usd_per_million)
+ ceil(output_tokens * output_usd_per_million)
```

其中 `usd_per_million` 直接等价为每 token 的 `usd_micros`：

```text
$2.50 / 100 万 token = 2.5 usd_micros / token
```

JS 实现不能用浮点直接落库。推荐把价格保存成 `usd_micros_per_million_tokens`，计算时：

```text
ceil(tokens * usd_micros_per_million_tokens / 1_000_000)
```

例如：

```text
gpt-5.4 缓存未命中输入:
  usd_micros_per_million_tokens = 2_500_000
```

## 额度检查

请求前状态接口返回：

```json
{
  "active": true,
  "planId": "sub_39_daily_29_usd",
  "dailyQuotaUsdMicros": 29000000,
  "addonQuotaUsdMicros": 5000000,
  "usedUsdMicros": 13420000,
  "remainingUsdMicros": 20580000,
  "quotaDate": "2026-06-16"
}
```

放行规则：

1. API key 未托管、未兑换、过期：拒绝。
2. 没有有效订阅：拒绝，提示开通订阅。
3. 今日剩余额度 `<= 0`：拒绝，提示今日额度已用完。
4. 今日剩余额度 `> 0`：允许本次调用。
5. usage 回传后按官方价格扣美元额度；如果扣成负数，下一次请求拒绝。

错误建议：

```json
{
  "error": "daily_quota_exhausted",
  "message": "今日额度已用完，请明天再试或购买加量包。"
}
```

## 数据模型

新增表建议：

### `subscription_plans`

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `monthly_price_cents INTEGER NOT NULL`
- `daily_quota_usd_micros INTEGER NOT NULL`
- `period_days INTEGER NOT NULL DEFAULT 30`
- `status TEXT NOT NULL CHECK (status IN ('active', 'archived'))`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

### `account_subscriptions`

- `id TEXT PRIMARY KEY`
- `phone TEXT NOT NULL`
- `plan_id TEXT NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled'))`
- `started_at TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

同一手机号同一时间只能有一个 active 订阅。

### `quota_addon_packages`

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `price_cents INTEGER NOT NULL`
- `quota_usd_micros INTEGER NOT NULL`
- `validity_scope TEXT NOT NULL CHECK (validity_scope IN ('same_day'))`
- `status TEXT NOT NULL CHECK (status IN ('active', 'archived'))`

### `account_quota_addons`

- `id TEXT PRIMARY KEY`
- `phone TEXT NOT NULL`
- `package_id TEXT NOT NULL`
- `quota_date TEXT NOT NULL`
- `quota_usd_micros INTEGER NOT NULL`
- `price_cents INTEGER NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected'))`
- `created_at TEXT NOT NULL`
- `confirmed_at TEXT`
- `confirmed_by_phone TEXT`

### `api_usd_charge_records`

- `id TEXT PRIMARY KEY`
- `phone TEXT NOT NULL`
- `usage_event_id TEXT NOT NULL UNIQUE`
- `api_key_hash TEXT NOT NULL`
- `model TEXT NOT NULL`
- `input_tokens INTEGER NOT NULL DEFAULT 0`
- `output_tokens INTEGER NOT NULL DEFAULT 0`
- `cache_hit_input_tokens INTEGER NOT NULL DEFAULT 0`
- `cache_miss_input_tokens INTEGER NOT NULL DEFAULT 0`
- `reasoning_tokens INTEGER NOT NULL DEFAULT 0`
- `total_tokens INTEGER NOT NULL DEFAULT 0`
- `official_price_version TEXT NOT NULL`
- `charge_usd_micros INTEGER NOT NULL`
- `quota_before_usd_micros INTEGER NOT NULL`
- `quota_after_usd_micros INTEGER NOT NULL`
- `quota_date TEXT NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('charged', 'failed_no_charge', 'unpriced_no_charge', 'adjusted'))`
- `created_at TEXT NOT NULL`

### `account_quota_ledger_entries`

- `id TEXT PRIMARY KEY`
- `phone TEXT NOT NULL`
- `entry_type TEXT NOT NULL CHECK (entry_type IN ('subscription_daily_grant', 'addon_grant', 'api_usd_charge', 'admin_adjustment', 'refund'))`
- `amount_usd_micros INTEGER NOT NULL`
- `quota_after_usd_micros INTEGER NOT NULL`
- `quota_date TEXT NOT NULL`
- `related_id TEXT`
- `memo TEXT`
- `created_at TEXT NOT NULL`
- `created_by_phone TEXT`

## 价格模块

新增 `lib/shop-official-gpt-pricing.js`，不要直接覆盖现有 `lib/shop-pricing.js`。

建议导出：

- `officialGptUsdPrices`
- `priceOfficialUsageUsd(event)`
- `priceForOfficialVersion(version)`

价格版本命名：

- `openai-gpt-5.4-usd-20260616`
- `openai-gpt-5.5-usd-20260616`

第一版只有这一种计费规则，不设置 `service_tier` 或 `context_tier` 字段。后续如果官方账单口径变化，再新增价格版本，不回写旧记录。

## 前端展示

Account 页建议新增：

- 当前订阅：套餐名、到期时间、今日额度。
- 今日用量：已用美元、剩余美元、进度条。
- 模型价格：展示官方美元价格，不再展示项目内部人民币 token 单价。
- 加量包：5 / 10 / 20 / 50 元购买当日美元额度。
- 扣费流水：显示每次 API 调用消耗多少美元额度，以及模型、缓存命中输入、未命中输入、输出 token。

Admin 页建议新增：

- 订阅用户列表。
- 今日全站美元消耗。
- 今日全站人民币收入。
- 订阅池毛利估算：人民币收入按固定汇率展示为估算，不作为账务事实。
- 每个用户今日额度、今日消耗、是否用尽。
- 异常用户：高频、高输出、高 `gpt-5.5` 占比。

## 风控

这套价格是强超售模型，必须加硬限制：

- 单用户并发限制。
- 单用户每分钟请求数限制。
- 单用户每日最大请求数限制。
- 全站每日官方成本熔断。
- 三档都开放 `gpt-5.5` 后，29 元套餐需要更严格的并发、请求频率和单次请求 token 阈值，避免单个用户长期吃满 $19/天。

## 迁移策略

1. 保留旧表结构和历史数据，避免历史页面、审计和已存在记录丢失。
2. 新增订阅池表，不修改旧表含义。
3. 本分支新 usage 扣费只写美元额度账本，不再从 `account_balances.balance_nanos` 扣人民币余额。
4. 内部 API key 状态接口改为检查有效订阅和今日美元剩余额度。
5. Account 充值入口改为“订阅 / 加量包购买申请”，管理员确认后写入订阅或当日加量包。
6. Admin 收银继续展示人民币收入，但 API 调用消耗展示美元额度；人民币收入来自订阅 / 加量包订单，不再来自 token 逐条人民币扣费。

## 测试计划

- `lib/shop-official-gpt-pricing.test.js`
  - 覆盖 `gpt-5.4` / `gpt-5.5` 官方美元价格。
  - 覆盖缓存命中输入、未命中输入、输出 token 分项。
  - 覆盖失败 usage 不扣额度。
- `test/shop-flow.test.js`
  - 有有效订阅且今日额度大于 0 时 API key active。
  - 今日额度用尽时返回 `daily_quota_exhausted`。
  - usage 扣美元额度后下一次状态检查拒绝。
  - 加量包审核通过后恢复可用额度。
  - `SHOP_BILLING_MODE=metered` 时旧按量计费测试继续通过。
- `lib/shop-billing-summary.test.js`
  - 新增订阅池 summary，不影响旧人民币收银 summary。

## 当前建议结论

在新分支完整实现订阅池美元计费，不影响 main 上正在运行的按量计费：

- 官方价格单独做美元价格模块。
- 美元额度账本独立于人民币余额账本。
- 历史人民币扣费记录不重算、不迁移。
- 新 usage、Account 展示、Admin 业务办理和内部 API key 放行全部切到订阅池美元额度口径。
- 实施计划见 `docs/ai/context/20260616-182903-subscription-pool-usd-billing-implementation-plan_CN.md`。
