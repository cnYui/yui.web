# Shop 预充值余额与人工确认入账设计

## 背景

当前 Shop Account 页面已经能展示登录用户自己的 API key 和 token 使用情况。下一步需要把用量和真实可用额度连接起来：用户先充值，管理员人工确认到账后入账，API 调用按实际用量扣除余额。

由于当前是个人网站，没有公司主体，也无法通过支付宝或微信官方接口自动确认支付结果，因此不能把“用户填写已支付金额”直接等同于“系统已到账”。支付页面可以保留熟人之间的低摩擦体验，但余额入账必须经过管理员确认。

## 目标

1. 新用户账户余额默认 `0`。
2. 用户必须先充值，账户有可用余额后才能使用 API。
3. 充值金额允许用户任意填写。
4. 用户扫码付款后提交充值申请，申请进入 `待确认` 状态。
5. 只有管理员确认到账后，充值金额才进入用户账户余额。
6. API 每次调用都记录用量、费用和余额变动。
7. Account 页面展示：
   - 当前余额。
   - 欠费金额。
   - 待确认充值金额。
   - 最近充值记录。
   - 最近 API 调用扣费记录。
   - 每次调用的 input token、output token、total token、模型、时间、费用和状态。
8. 余额不足时拒绝新调用。
9. 如果调用前余额仍大于 `0`，但调用完成后的实际费用超过剩余余额，允许本次调用完成并把余额扣成负数。
10. 余额为负后，下一次 API 调用直接拒绝，并提示用户充值或补缴欠款。
11. 默认最大允许单次欠费额度为 `10 元`。

## 非目标

- 不接入支付宝或微信官方支付回调。
- 不使用个人免签、监听收款通知、模拟登录等非官方支付方案。
- 不做用户填写金额后自动入账。
- 不在 MVP 中做发票、税务、企业财务功能。
- 不展示 API 原始 prompt、response body 或完整请求内容。
- 不把每日账单作为强支付单位；MVP 先以余额和流水为核心。

## 核心原则

### 余额以流水为事实来源

余额不能只依赖用户表里的一个数字。系统需要有一套账户流水，记录每次余额变化的原因、金额、关联对象和确认人。

可以保留 `account_balance` 作为查询缓存，但权威事实应来自 `account_ledger_entries`：

```text
当前余额 = 所有已确认入账流水 - 所有已结算扣费流水 + 管理员调整流水
```

这样可以支持对账、回滚、审计和用户争议处理。

### 充值申请不等于入账

用户提交付款金额后，只生成充值申请：

```text
用户声明：我支付了 30 元
系统状态：待确认
余额影响：0
```

管理员确认到账后，才生成入账流水：

```text
管理员确认：到账 30 元
系统状态：已入账
余额影响：+30 元
```

### API 调用后按实际费用扣款

模型调用前通常无法准确知道 output token 数量，尤其是流式输出。因此扣费应在调用完成后按实际 token 和价格表结算。

调用前只做资格检查：

- 余额 `> 0`：允许发起调用。
- 余额 `<= 0`：拒绝调用。

调用后做实际扣费：

- 记录 usage event。
- 按价格表计算费用。
- 写入扣费流水。
- 更新余额。
- 如果余额变为负数，账户进入欠费状态。

## 用户流程

### 充值流程

1. 用户登录 `/shop/account/`。
2. 用户点击“充值”。
3. 页面展示：
   - 当前余额。
   - 当前欠费金额。
   - 支付宝收款码。
   - 微信收款码。
   - 建议付款备注码，例如 `YUI-202606-138****1234`。
4. 用户填写：
   - 支付金额。
   - 支付方式：支付宝或微信。
   - 支付时间。
   - 付款备注。
   - 付款截图，可选。
5. 用户提交后，生成 `待确认` 充值申请。
6. Account 页面显示待确认金额，但不增加可用余额。
7. 管理员后台确认到账。
8. 系统生成充值入账流水，余额增加。
9. 用户 Account 页面显示新的余额。

### API 使用流程

1. 用户使用自己的 API key 发起请求。
2. 服务端根据 API key 找到归属用户。
3. 服务端读取用户当前余额。
4. 如果余额 `<= 0`，返回余额不足错误。
5. 如果余额 `> 0`，继续请求上游模型。
6. 请求完成后记录 token 用量。
7. 系统按价格表计算本次费用。
8. 系统写入 API 扣费流水。
9. 余额减少。
10. Account 页面展示该次调用记录。

### 欠费流程

示例：

- 调用前余额：`0.05 元`
- 本次实际费用：`0.20 元`
- 调用后余额：`-0.15 元`

本次调用成功完成。下一次调用时，因为余额已经小于等于 `0`，服务端直接拒绝。

Account 页面应显示：

- 当前余额：`-0.15 元`
- 状态：欠费
- 需补缴：`0.15 元`
- 提示：充值会先抵扣欠费，余额转正后才能继续使用 API

## 欠费上限

MVP 默认最大允许单次欠费额度为 `10 元`。

含义：

- 调用前余额大于 `0` 时，可以允许调用完成后余额变成负数。
- 如果单次调用结算后导致欠费超过 `10 元`，系统应记录高风险状态并禁止后续调用。
- 后续可以在管理员后台按用户设置不同的 `credit_limit`。

MVP 可以先实现为全局配置：

```text
SHOP_DEFAULT_CREDIT_LIMIT_CENTS=1000
```

后续完整版本再扩展到用户级配置：

```text
users.credit_limit_cents
```

## 页面设计

### Account 页面

Account 页面成为普通用户唯一的账户与账务入口。

建议模块：

- 账户概览
  - 当前余额。
  - 欠费金额。
  - 待确认充值金额。
  - 本月消费。
- 充值入口
  - 支付宝码。
  - 微信码。
  - 充值金额输入。
  - 支付方式选择。
  - 付款时间。
  - 付款截图或备注。
- API 调用记录
  - 时间。
  - 模型。
  - input token。
  - output token。
  - total token。
  - 费用。
  - 调用状态。
  - 扣费后余额。
- 账户流水
  - 充值入账。
  - API 扣费。
  - 管理员调整。
  - 退款或冲正。
- 图表
  - 每日消费折线图或柱状图。
  - 每周消费合计。
  - 每月消费合计。
  - input/output token 拆分。

MVP 页面不需要实时刷新，允许 1 小时以内延迟；充值申请状态可以在用户刷新页面后更新。

### 管理员页面

管理员后台需要增加充值确认视图。

建议模块：

- 待确认充值申请列表
  - 用户手机号。
  - 用户填写金额。
  - 支付方式。
  - 支付时间。
  - 付款备注。
  - 截图链接。
  - 当前用户余额。
- 管理操作
  - 确认入账。
  - 拒绝申请。
  - 修改确认金额后入账。
  - 添加管理员备注。
- 历史充值记录
  - 方便对账。
- 用户余额视图
  - 当前余额。
  - 欠费金额。
  - 最近扣费。
  - 最近充值。

管理员确认金额不一定必须等于用户填写金额。以管理员确认金额为准。

## 数据模型草案

### `account_balances`

用户余额缓存表。

```text
phone TEXT PRIMARY KEY
balance_cents INTEGER NOT NULL DEFAULT 0
pending_topup_cents INTEGER NOT NULL DEFAULT 0
credit_limit_cents INTEGER NOT NULL DEFAULT 1000
updated_at TEXT NOT NULL
```

说明：

- `balance_cents` 可以为负数。
- `pending_topup_cents` 是待确认充值申请合计，不能用于 API 调用。
- `credit_limit_cents` MVP 默认 `1000`，后续管理员可单独调整。

### `topup_requests`

充值申请表。

```text
id TEXT PRIMARY KEY
phone TEXT NOT NULL
requested_amount_cents INTEGER NOT NULL
confirmed_amount_cents INTEGER
payment_method TEXT NOT NULL
payment_time TEXT
payment_note TEXT
screenshot_path TEXT
status TEXT NOT NULL
admin_note TEXT
created_at TEXT NOT NULL
confirmed_at TEXT
confirmed_by_phone TEXT
rejected_at TEXT
rejected_by_phone TEXT
```

状态：

- `pending`：待确认。
- `approved`：已确认入账。
- `rejected`：已拒绝。
- `cancelled`：用户取消，MVP 可不做。

### `account_ledger_entries`

账户流水表。

```text
id TEXT PRIMARY KEY
phone TEXT NOT NULL
entry_type TEXT NOT NULL
amount_cents INTEGER NOT NULL
balance_after_cents INTEGER NOT NULL
currency TEXT NOT NULL DEFAULT 'CNY'
related_id TEXT
memo TEXT
created_at TEXT NOT NULL
created_by_phone TEXT
```

`entry_type`：

- `topup_approved`：管理员确认充值入账，金额为正。
- `api_charge`：API 调用扣费，金额为负。
- `admin_adjustment`：管理员手动调整，可正可负。
- `refund`：退款或冲正，金额按实际方向记录。

### `api_charge_records`

API 扣费记录表。

可以复用现有 `usage_events`，也可以新增一张扣费记录表承接价格计算结果。推荐新增表，避免把原始 usage event 和账务结算强耦合。

```text
id TEXT PRIMARY KEY
phone TEXT NOT NULL
usage_event_id TEXT NOT NULL
api_key_hash TEXT NOT NULL
model TEXT
input_tokens INTEGER NOT NULL DEFAULT 0
output_tokens INTEGER NOT NULL DEFAULT 0
total_tokens INTEGER NOT NULL DEFAULT 0
price_version TEXT NOT NULL
charge_cents INTEGER NOT NULL
balance_before_cents INTEGER NOT NULL
balance_after_cents INTEGER NOT NULL
status TEXT NOT NULL
created_at TEXT NOT NULL
```

状态：

- `charged`：已扣费。
- `failed_no_charge`：调用失败且不扣费。
- `adjusted`：后续被管理员调整。

## API 草案

### 用户接口

`GET /api/account/balance`

返回当前余额、欠费金额、待确认充值金额和信用额度。

`POST /api/account/topups`

用户提交充值申请。请求字段：

- `amount`
- `paymentMethod`
- `paymentTime`
- `paymentNote`
- `screenshot`

返回 `pending` 状态的充值申请。

`GET /api/account/topups`

用户查看自己的充值申请历史。

`GET /api/account/ledger`

用户查看自己的账户流水，分页返回。

`GET /api/account/api-charges`

用户查看自己的 API 调用扣费记录，分页返回。

### 管理员接口

`GET /api/admin/topups?status=pending`

管理员查看待确认充值申请。

`POST /api/admin/topups/:id/approve`

管理员确认入账。请求字段：

- `confirmedAmount`
- `adminNote`

确认时必须在同一个事务内完成：

1. 校验充值申请仍是 `pending`。
2. 更新充值申请为 `approved`。
3. 写入 `account_ledger_entries`。
4. 更新 `account_balances.balance_cents`。
5. 更新 `account_balances.pending_topup_cents`。

`POST /api/admin/topups/:id/reject`

管理员拒绝充值申请，拒绝不影响余额。

`POST /api/admin/accounts/:phone/adjust`

管理员手动调整余额，用于退款、补偿或修正。

## 扣费规则

### 调用前

```text
if balance_cents <= 0:
  reject("账户余额不足，请充值或补缴欠款")
else:
  allow
```

### 调用后

```text
charge_cents = calculateCharge(usage_tokens, price_table)
balance_after = balance_before - charge_cents
```

系统写入：

- usage event。
- api charge record。
- account ledger entry。
- account balance update。

这些写入应尽量在事务中完成。若现有 usage event 的写入与请求代理流程难以共用同一事务，则至少保证扣费记录具有幂等键，例如 `request_id`，避免重复扣费。

## 价格计算

MVP 可以沿用现有 usage event 的价格字段：

- `price_amount_micros`
- `price_currency`

如果现有字段已经记录每次调用费用，则扣费记录直接从 usage event 转换成人民币分。

如果现有字段只记录 token，不记录费用，则需要增加价格表：

```text
model
input_price_per_1m_tokens_cents
output_price_per_1m_tokens_cents
reasoning_price_per_1m_tokens_cents
effective_from
price_version
```

账务结算必须固化 `price_version`，避免以后价格变化污染历史扣费记录。

## 幂等与并发

充值确认和 API 扣费都必须考虑重复提交。

### 充值确认

- 同一个 `topup_request.id` 只能确认一次。
- 确认接口必须检查状态为 `pending`。
- 已 `approved` 的申请再次确认应返回幂等成功或明确冲突，不得重复加余额。

### API 扣费

- 同一个 `usage_event_id` 或 `request_id` 只能扣费一次。
- 扣费失败时不能静默吞掉，需要进入后台异常记录。
- 多个请求并发扣费时，余额更新必须是原子操作。

## 错误处理

### 用户充值

- 金额必须大于 `0`。
- 金额单位以人民币元输入，后端以分存储。
- 支付方式必须是允许值：`alipay` 或 `wechat`。
- 截图上传失败不应阻止用户提交，截图在 MVP 中可以是可选项。

### API 调用拒绝

余额不足时返回明确错误：

```json
{
  "error": {
    "code": "insufficient_balance",
    "message": "账户余额不足，请充值或补缴欠款。"
  }
}
```

### 扣费异常

如果模型调用成功但扣费写入失败，需要记录后台告警。不能因为扣费失败就把用户余额默默放过，后续应由管理员处理异常账务。

## 隐私与安全

- Account 页面不展示 prompt、response body、完整请求 header。
- API key 仍只在登录后的 Account 页面展示。
- 充值截图如果保存，路径不能可枚举，访问必须鉴权。
- 管理员操作必须记录 `confirmed_by_phone` 或 `created_by_phone`。
- 管理员确认时不信任用户填写金额，以管理员确认金额为准。
- 所有金额以后端计算为准，前端金额只用于展示和提交申请。

## MVP 范围

第一阶段建议只做：

1. 用户余额表。
2. 充值申请表。
3. 账户流水表。
4. API 扣费记录表或 usage event 到扣费流水的映射。
5. Account 页面展示余额、欠费、待确认充值、充值申请入口、最近 API 扣费记录。
6. 管理员页面展示待确认充值申请，并支持确认入账、拒绝。
7. API 调用前余额检查。
8. API 调用后扣费并允许一次调用后进入负余额。
9. 默认欠费上限 `10 元`。

不做：

- 自动支付回调。
- 月度正式账单。
- 发票。
- 复杂套餐。
- 用户级信用额度配置界面。
- 实时推送。

## 后续完整版本

后续可以继续增加：

- 用户级信用额度。
- 价格表管理。
- 月度账单固化。
- 每日消费日报。
- 欠费提醒。
- 管理员异常扣费队列。
- 充值截图管理。
- 用户流水 CSV 导出。
- 按 API key、模型、日期筛选扣费记录。
- 余额低于阈值时 Account 页面提醒。

## 已确认决策

- 采用预充值余额制，不以月结账单作为 MVP 主流程。
- 新用户初始余额为 `0`。
- 用户充值金额任意。
- 用户填写金额后不会自动入账。
- 管理员确认到账后才增加余额。
- API 调用会逐步扣减账户余额。
- 每次 API 调用都需要生成用户可见记录。
- 调用前余额 `<= 0` 时直接拒绝。
- 调用前余额 `> 0` 时允许发起调用。
- 调用后可以因实际费用结算把余额扣成负数。
- 余额为负后，下一次调用拒绝，并要求用户充值或补缴欠款。
- 默认最大允许欠费额度为 `10 元`。
