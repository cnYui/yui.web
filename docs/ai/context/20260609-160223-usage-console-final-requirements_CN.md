# Usage Console 完整形态需求文档

## 背景

当前 `yui.web` Shop 管理页已经完成 API Key 用量监控 MVP：`CLIProxyAPI` 生成 usage event，`yui.web` 安全接收并持久化到 SQLite，管理员可以看到今日、本月、总计 token 和每个 key 的基础表格。

下一阶段不能只是在表格上继续堆字段，而要把最终成品定成一个完整的 Usage Console：

- 管理员看到全局经营视角：谁在用、每天用了多少、哪些 key 异常、总成本和收入口径是否可控。
- 用户登录后看到个人控制台：只能看到自己的 key、自己的日历用量、模型拆分、金额和账期。
- 后续所有图表、账单、告警、限额和登录功能都围绕同一套 usage ledger 与聚合口径演进。

## 最终成品定义

最终成品是 `yui.web` 内的「API Key 用量与账单控制台」，由两类界面组成：

1. 管理员控制台
   - URL 建议为 `/shop/admin/usage/`，现有 `/shop/admin/` 保留邀请码和库存管理入口。
   - 管理员能查看所有 Shop 托管 key、未托管本地 key、全局 token、请求、费用、异常和导入状态。
   - 管理员能按用户、手机号、key preview、模型、日期、状态、分组筛选。

2. 用户控制台
   - URL 建议为 `/shop/account/`。
   - 用户通过手机号登录后，只能看到自己名下订单和 API key。
   - 用户能查看当前账期、每日用量、金额、模型拆分、失败请求、到期时间和历史账单。

## 产品目标

- 让管理员清楚知道每个 API key 的真实消耗。
- 让用户清楚知道自己本月用了多少 token、产生多少金额、是否接近限额或到期。
- 把「用量」从调试数据提升为「账本数据」：可追溯、可去重、可导入、可计算金额。
- 保持安全边界：不暴露完整 API key，不记录 prompt、response body、客户端 IP。
- 保持未来可扩展：支持价格表、套餐、余额、限额、告警、导出、用户登录。

## 非目标

- 不在前端展示 prompt 或 response 内容。
- 不用普通 request log 作为计费事实来源。
- 不让用户看到其他用户、未托管 key 或上游账号来源。
- 不用手机号明文作为 usage event 关联键。
- 不把管理员 token 当作长期用户登录方案。

## 角色与权限

### 管理员

管理员拥有全局视角，能看到：

- 所有 Shop key。
- 所有未托管 key。
- 用户手机号、订单、邀请码、兑换时间、到期时间。
- 每个 key 的 token、请求、失败、模型、日期、金额。
- 系统导入和同步状态。

管理员不能在 UI 中直接看到完整 API key，除非未来增加明确的「密钥查看」高危权限和二次确认。默认只显示 preview。

### 普通用户

用户只能看到：

- 自己手机号名下的订单。
- 自己订单绑定的 API key preview。
- 自己 key 的用量、金额、图表、账期、到期时间。
- 自己的历史账单与导出。

用户不能看到：

- 其他手机号。
- 其他 API key。
- 未托管 key。
- 上游账号 `source`、`auth_index`。
- 管理员导入记录和全局成本。

### 系统内部服务

`CLIProxyAPI` 只负责生成真实 usage event：

- 使用 `api_key_hash` 关联 key。
- 本地写月度 JSONL。
- 可选同步到 yui.web 内部接口。
- 不计算金额，不判断 Shop 所属关系。

## 信息架构

### 管理员侧

管理员最终应有这些页面或区域：

- 总览
  - 今日 token、今日请求、今日金额。
  - 本月 token、本月请求、本月金额。
  - 活跃 key 数、活跃用户数、失败率。
  - 同步状态、最近 event 时间、最近导入时间。

- 日历用量
  - 月历热力图。
  - 每天一个格子，颜色深浅表示 token 或金额。
  - 支持切换指标：token、请求数、金额、失败数。
  - 点击某一天后，下方展示当天明细。

- 趋势图
  - 今日按小时折线或柱状图。
  - 本月按日柱状图。
  - 支持堆叠显示模型或 provider。
  - 支持切换范围：今日、近 7 天、本月、上月、自定义。

- Key / 用户表
  - 每行一个 key。
  - 展示分组、手机号、key preview、状态、到期时间、今日、本月、总计、金额、请求成功/失败、最近使用时间。
  - 支持排序、搜索、筛选、分页。

- Key 详情抽屉
  - 点击表格行打开。
  - 展示该 key 的日历热力图、每日趋势、模型拆分、失败请求、最近事件。
  - 管理员能看到 `source`、`auth_index`、endpoint 聚合，但不看 prompt/body。

- 用户详情页
  - 以手机号或用户 ID 聚合多个订单/key。
  - 展示用户所有 key 的当前账期用量。
  - 展示历史账单、续费记录、到期状态。

- 导入与同步
  - 展示实时 sync 成功/失败状态。
  - 展示 JSONL 导入历史：月份、插入数、跳过数、失败行数、导入时间。
  - 支持按月补导。

- 价格与账单设置
  - 管理员配置模型价格。
  - 管理员配置套餐、赠送额度、汇率和展示币种。
  - 管理员查看计算出的金额和手动校正记录。

### 用户侧

用户控制台最终应有这些页面或区域：

- 登录
  - 手机号 + 短信验证码。
  - 本地开发可支持管理员生成一次性登录码。
  - 登录后建立 httpOnly session cookie。

- 我的 API Key
  - 展示用户名下订单和 key preview。
  - 展示状态：使用中、已过期、已禁用。
  - 展示兑换时间、到期时间、当前账期。

- 我的用量
  - 今日 token、今日金额。
  - 本月 token、本月金额。
  - 本月请求数、失败请求数。
  - 最近使用时间。

- 我的日历
  - 月历热力图展示每日 token 或金额。
  - 点击某天展示当天模型拆分和请求数。
  - 用户可以在不同 key 之间切换，也可以看全部自己的 key。

- 我的账单
  - 当前账期预计金额。
  - 历史账单列表。
  - 模型价格说明。
  - 导出 CSV。

- 用量详情
  - 模型拆分。
  - 每日趋势。
  - 失败请求数量。
  - 不展示上游账号、完整 event、source、auth_index。

## 核心图表需求

### KPI 卡片

管理员：

- 今日 token
- 今日金额
- 本月 token
- 本月金额
- 活跃 key
- 失败率

用户：

- 今日 token
- 今日金额
- 本月 token
- 本月金额
- 剩余额度或预计账单
- 到期时间

### 日历热力图

日历热力图是最终产品的核心视图。

需求：

- 默认展示当前月份。
- 每天一个固定尺寸格子。
- 无数据为浅色，有数据按强度分 4 到 5 个颜色级别。
- 支持切换指标：
  - token
  - 请求数
  - 金额
  - 失败请求数
- 鼠标悬停显示 tooltip：
  - 日期
  - token
  - 金额
  - 请求数
  - 失败请求数
- 点击日期后，页面下方或右侧详情区展示当天明细。
- 管理员日历展示全局数据，也可被筛选器限制到某个用户/key。
- 用户日历只展示自己的数据。

### 今日小时图

需求：

- 展示今天 0 点到当前小时的用量。
- X 轴为小时，Y 轴为 token 或金额。
- 支持柱状图或折线图。
- 管理员可按模型堆叠；用户可按 key 或模型堆叠。

### 本月每日趋势

需求：

- 展示本月每天 token、请求数或金额。
- 支持与上月同期对比。
- 支持展示累计曲线：本月累计 token / 金额。

### 模型拆分图

需求：

- 展示不同模型的 token 占比和金额占比。
- 管理员可看到所有模型；用户只看到自己使用过的模型。
- 建议图形：
  - 用量占比：横向条形图。
  - 金额占比：横向条形图。
  - 不建议默认使用饼图，因为模型多时难读。

### 异常与失败图

需求：

- 展示失败请求数量趋势。
- 展示失败率最高的 key。
- 展示最近失败事件的 endpoint、model、时间。
- 用户只看到自己的失败数量和模型，不看到系统内部来源。

## 用量与金额口径

### Token 口径

`total_tokens` 优先使用 event 中的 `total_tokens`。

如果 `total_tokens = 0`，则使用：

```text
input_tokens + output_tokens + reasoning_tokens
```

`cached_tokens` 单独展示，不强行计入 total，避免和上游口径重复。

### 金额口径

金额计算放在 yui.web，不放在 CLIProxyAPI。

最终需要价格表：

```text
provider
model
input_price_per_1m_tokens
output_price_per_1m_tokens
reasoning_price_per_1m_tokens
cached_input_price_per_1m_tokens
currency
effective_from
effective_to
```

每条 usage event 入库时可以不立即计算金额。推荐后台或查询时按价格版本计算，并把月度账单固化到 `billing_invoices`，避免价格表变更影响历史账单。

### 账期口径

支持两种账期：

- 自然月账期：每月 1 日到月末。
- 订单账期：从兑换时间到到期时间。

管理员可以切换查看。用户默认看自己的订单账期，同时提供自然月视图。

## 数据模型需求

现有 `usage_events` 继续作为原始流水表，保持不可变和幂等。

最终建议增加这些表或等价结构：

- `usage_daily_rollups`
  - 按 `api_key_hash + date + model + provider` 聚合每日 token、请求、金额。
  - 用于日历和趋势图快速查询。

- `usage_monthly_rollups`
  - 按 `api_key_hash + month + model + provider` 聚合月度数据。
  - 用于月度 summary 和账单。

- `billing_model_prices`
  - 模型价格表。
  - 支持价格版本和生效时间。

- `billing_invoices`
  - 月度或订单账期账单。
  - 固化应付金额、token、状态、生成时间。

- `usage_import_jobs`
  - JSONL 导入历史。
  - 记录月份、文件路径、插入数、跳过数、失败行数、执行时间。

- `user_sessions`
  - 用户登录 session。
  - httpOnly cookie 绑定，不把 session 放在 URL。

- `login_challenges`
  - 手机号验证码或一次性登录码。
  - 有过期时间和尝试次数限制。

## API 需求

### 内部接口

保留：

```text
POST /api/internal/usage-events
```

新增或扩展：

```text
POST /api/internal/usage-events/batch
GET /api/internal/usage-events/health
```

说明：

- batch 用于补导或异步队列。
- health 用于确认最近接收时间、签名配置、导入状态。

### 管理员接口

建议：

```text
GET /api/admin/usage/overview
GET /api/admin/usage/calendar
GET /api/admin/usage/trends
GET /api/admin/usage/models
GET /api/admin/usage/keys
GET /api/admin/usage/keys/:keyHash
GET /api/admin/usage/users/:userId
POST /api/admin/usage-imports
GET /api/admin/usage-imports
GET /api/admin/billing/prices
PUT /api/admin/billing/prices
GET /api/admin/billing/invoices
```

管理员 API 使用管理员 session 或管理员 token。最终建议从 `x-admin-token` 过渡到登录 session + CSRF 防护。

### 用户接口

建议：

```text
POST /api/auth/login/start
POST /api/auth/login/verify
POST /api/auth/logout
GET /api/account/me
GET /api/account/keys
GET /api/account/usage/overview
GET /api/account/usage/calendar
GET /api/account/usage/trends
GET /api/account/usage/models
GET /api/account/billing/invoices
GET /api/account/billing/export.csv
```

用户接口必须从 session 中解析用户身份，不能通过 query 传手机号决定数据范围。

## 查询与筛选需求

管理员筛选：

- 时间范围：今日、近 7 天、本月、上月、自定义。
- 分组：Shop、未托管、全部。
- 状态：使用中、已过期、未使用、已禁用、未托管。
- 搜索：手机号、key preview、模型、用户标签。
- 模型：单选或多选。
- 指标：token、金额、请求数、失败数。

用户筛选：

- 时间范围。
- key。
- 模型。
- 指标。

## 安全需求

- usage event、数据库、API 响应不保存或返回完整 client API key。
- 用户登录后只能访问自己的 `api_key_hash` 集合。
- 管理员能看到手机号，用户只能看到自己的手机号。
- 内部接口必须保留 HMAC + timestamp + internal token。
- 用户登录 session 使用 httpOnly、sameSite cookie。
- 管理员 token 不放 URL。
- 导出文件不包含完整 key。
- 价格和账单导出不包含 prompt、response body、客户端 IP。

## 隐私需求

- 不记录 prompt。
- 不记录 response body。
- 不记录客户端 IP。
- 不在日志中打印完整 API key。
- 不在文档中记录真实完整 API key。
- 用户明细页不展示上游账号 source。

## 性能需求

- 原始 `usage_events` 可以长期保留，但图表查询不直接扫全表。
- 日历和趋势优先读 rollup 表。
- 管理员 key 表分页，默认每页 50。
- 用户侧查询默认限制在当前账期或最近 90 天。
- JSONL 导入要可重复执行，重复 request_id 不重复计数。

## 错误处理需求

- 实时 sync 失败不影响 CLIProxyAPI 用户请求。
- yui.web 接收失败时，CLIProxyAPI 本地 JSONL 仍保留。
- 手动导入显示插入、跳过、失败行数。
- 图表接口没有数据时返回空数组，不返回错误。
- 价格表缺失时：
  - token 图表仍展示。
  - 金额显示为未配置，不用 0 元误导用户。

## 页面体验要求

管理员页面应是工作台风格，不做营销页。

设计原则：

- 信息密度适中，适合反复查看。
- 图表优先服务判断，不做装饰。
- 卡片只用于 KPI、表格行详情、抽屉，不把页面分成大量浮动卡片。
- 日历格子尺寸稳定，不因 tooltip 或数值变化撑开。
- 表格横向滚动可接受，但关键列固定：手机号/key preview/本月 token/金额。
- 移动端能查看 summary 和日历，复杂表格可以横向滚动。

## 分阶段交付

### 阶段 1：管理员图表增强

目标：

- 在现有 `/shop/admin/` 或新 `/shop/admin/usage/` 增加：
  - 今日小时图
  - 本月日历热力图
  - 本月每日趋势
  - 模型拆分条形图
- API 新增 calendar/trends/models。
- 仍然不做用户登录和金额计算。

验收：

- 管理员能看到每天用量。
- 点击日历某天能过滤当天明细。
- 未托管 key 能出现在图表中。

### 阶段 2：金额与价格表

目标：

- 增加模型价格表。
- 管理员能看到本月预估金额。
- key 表和图表支持 token/金额切换。

验收：

- 价格未配置时清楚提示。
- 价格配置后金额可按模型/input/output/reasoning 计算。
- 历史账单不因价格修改被静默改变。

### 阶段 3：用户登录与个人控制台

目标：

- 手机号登录。
- 用户只能看自己的 key。
- 用户有个人日历、趋势、账单和导出。

验收：

- 未登录不能访问 `/shop/account/` 数据。
- A 用户不能通过改 query 看到 B 用户。
- 用户页面不显示未托管 key。

### 阶段 4：账单、限额、告警

目标：

- 固化账单。
- 支持套餐额度和超额计费。
- 支持管理员告警和用户接近限额提示。

验收：

- 管理员能看到超额用户。
- 用户能看到剩余额度或预计费用。
- 到期、禁用、欠费状态有清晰展示。

## 最终验收标准

最终成品完成时，应满足：

- 管理员可以回答：
  - 今天用了多少 token。
  - 本月用了多少 token。
  - 哪些天用量最高。
  - 哪些 key 或用户用量最高。
  - 哪些模型消耗最多。
  - 预计金额是多少。
  - 哪些请求失败较多。
  - 实时同步和导入是否正常。

- 用户可以回答：
  - 我今天用了多少。
  - 我本月用了多少。
  - 哪天用得最多。
  - 哪个模型用得最多。
  - 预计要花多少钱。
  - 我的 key 什么时候到期。
  - 我的历史账单在哪里。

- 系统可以保证：
  - usage event 幂等。
  - 不泄露完整 API key。
  - 用户只能看自己的数据。
  - 价格变更不会污染历史账单。
  - 实时同步失败后能通过 JSONL 补导恢复。

## 当前 MVP 到最终形态的差距

当前已经具备：

- usage event 原始流水。
- 管理员 summary。
- key 表。
- 手动 JSONL 导入。
- Shop key 和未托管 key 分组。

还缺：

- 日历热力图。
- 今日小时图。
- 本月每日趋势。
- 模型拆分图。
- key 详情抽屉。
- rollup 聚合表。
- 价格表和金额计算。
- 用户登录。
- 用户个人控制台。
- 账单固化。
- 导入历史和同步健康状态。

## 已定方向

最终方向定为：

```text
先把管理员 Usage Console 做成真正可观察的图表工作台；
再加价格表和金额口径；
最后做用户登录后的个人 Usage Console。
```

也就是说，图表不是独立装饰功能，而是最终账单控制台的第一步。
