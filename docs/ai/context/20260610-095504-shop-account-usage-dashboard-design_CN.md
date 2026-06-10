# Shop 登录账户与用量图表完整设计

## 背景

当前 Shop 存在两个重复且安全边界不一致的入口：

- `/shop/query/`：公开手机号查询页。用户输入任意手机号后，前端调用 `/api/orders?phone=...`，当前会返回该手机号下的订单和完整 API key。
- `/shop/account/`：登录后的个人账户页。后端按 session 中的手机号返回该用户自己的订单，但当前只显示脱敏 API key，且没有用量图表。

新目标是把手机号查询能力收敛到登录后的个人账户页，删除公开查询入口，并在账户页逐步加入 token 用量分析图表。

## 目标

1. 除 `/shop/login/` 和 `/shop/register/` 外，所有 `/shop/*` 页面未登录访问都跳转到 `/shop/login/`。
2. 删除 Shop 首页的“手机号查询”按钮。
3. `/shop/query/` 不再作为公开手机号查询页面：
   - 未登录访问跳 `/shop/login/`。
   - 已登录访问跳 `/shop/account/`。
4. `/shop/account/` 成为普通用户唯一自助入口：
   - 展示当前登录手机号。
   - 展示该手机号名下的订单和 API key。
   - 登录用户可以查看并复制自己的完整 API key。
   - 展示 token 用量概览与图表。
5. `/shop/admin/` 保持管理员全局视角，只允许唯一管理员手机号访问。
6. 用量图表允许最多 1 小时延迟，不要求实时推送。

## 非目标

- 不做在线支付。
- 不做实时 WebSocket 推送。
- 不做公开手机号查询。
- 不允许用户通过输入手机号查询别人的订单。
- 不在本次 MVP 中实现复杂价格表和账单结算，但文档保留完整设计方向。
- 不改变 CLIProxyAPI 的核心请求执行逻辑，除非现有 usage event 字段无法支撑图表。

## 页面访问规则

### 公开页面

以下页面允许未登录访问：

- `/shop/login/`
- `/shop/login/index.html`
- `/shop/register/`
- `/shop/register/index.html`

原因：用户必须能登录或注册。

### 需要登录的普通页面

以下页面未登录访问时全部跳转 `/shop/login/`：

- `/shop/`
- `/shop/redeem/`
- `/shop/query/`
- `/shop/guide/`
- `/shop/key/`
- `/shop/order/`
- `/shop/pay/`
- `/shop/result/`
- `/shop/content/`
- `/shop/account/`

已登录普通用户访问 `/shop/query/` 时跳转 `/shop/account/`。

已登录普通用户访问 `/shop/` 时建议跳转 `/shop/account/`，避免登录后仍看到公开营销页。

### 管理员页面

`/shop/admin/`：

- 未登录：跳 `/shop/login/`。
- 普通用户：返回 403。
- 唯一管理员手机号：允许访问。

唯一管理员手机号当前为默认值 `15951875192`，也可通过 `SHOP_ADMIN_PHONE` 配置覆盖。

## 数据模型

当前已有核心表：

- `users`
  - `phone`
  - `password_hash`
  - `password_created_at`
  - `updated_at`
- `user_sessions`
  - `token_hash`
  - `phone`
  - `created_at`
  - `expires_at`
  - `revoked_at`
- `orders`
  - `id`
  - `phone`
  - `invite_code`
  - `api_key`
  - `api_key_preview`
  - `product_name`
  - `amount`
  - `redeemed_at`
  - `expires_at`
  - `result_token`
- `usage_events`
  - `request_id`
  - `api_key_hash`
  - `api_key_preview`
  - `provider`
  - `model`
  - `endpoint`
  - `source`
  - `auth_index`
  - `success`
  - `failed`
  - `input_tokens`
  - `output_tokens`
  - `reasoning_tokens`
  - `cached_tokens`
  - `total_tokens`
  - `latency_ms`
  - `requested_at`
  - `received_at`
  - `price_amount_micros`
  - `price_currency`
- `usage_key_profiles`
  - `api_key_hash`
  - `api_key_preview`
  - `group_name`
  - `phone`
  - `created_at`
  - `updated_at`

### 关联方式

用户个人页用当前 session 的手机号作为根：

```text
session.phone
  -> orders.phone
  -> orders.api_key
  -> sha256(api_key)
  -> usage_events.api_key_hash
```

对于没有 Shop 订单但通过 `usage_key_profiles` 归属到手机号的 local/unmanaged key：

```text
session.phone
  -> usage_key_profiles.phone
  -> usage_key_profiles.api_key_hash
  -> usage_events.api_key_hash
```

MVP 可以先只展示 `orders` 下的 key；完整版本需要同时合并 `orders` 和 `usage_key_profiles`，避免用户自己的 local key 无法进入个人统计。

## 后端 API 设计

### `GET /api/account/me`

用途：账户页基础数据。

权限：必须登录。

返回：

```json
{
  "user": {
    "phone": "15062376174",
    "isAdmin": false
  },
  "orders": [
    {
      "id": "ORDER...",
      "phone": "15062376174",
      "productName": "Codex 按量计费",
      "amount": 30,
      "apiKey": "sk-...",
      "apiKeyPreview": "sk-...xxx",
      "status": "active",
      "redeemedAt": "2026-06-09T01:01:00+08:00",
      "expiresAt": "2026-07-10T01:01:00+08:00"
    }
  ]
}
```

关键约束：

- `apiKey` 只在登录用户自己的账户接口里返回。
- 不允许传 `phone` 参数覆盖当前 session 手机号。
- 管理员如果访问 `/shop/account/`，只返回管理员自己手机号下的数据，不返回全局数据。

### `GET /api/account/usage-summary`

用途：账户页用量图表。

权限：必须登录。

查询参数：

- `range=day|week|month|custom`
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `bucket=hour|day|week`
- `apiKeyHash=<optional>`
- `model=<optional>`

MVP 参数建议：

- 默认 `range=month`
- 默认返回：
  - 今日概览
  - 本周概览
  - 本月概览
  - 最近 24 小时小时桶
  - 本月每日桶

返回结构：

```json
{
  "generatedAt": "2026-06-10T09:55:00+08:00",
  "dataFreshness": {
    "mode": "delayed",
    "maxDelayMinutes": 60,
    "lastEventAt": "2026-06-10T09:02:00+08:00"
  },
  "summary": {
    "today": {
      "inputTokens": 1000,
      "outputTokens": 2000,
      "reasoningTokens": 300,
      "cachedTokens": 400,
      "totalTokens": 3300,
      "requests": 12,
      "failedRequests": 1
    },
    "week": {
      "inputTokens": 8000,
      "outputTokens": 12000,
      "reasoningTokens": 1000,
      "cachedTokens": 900,
      "totalTokens": 21000,
      "requests": 80,
      "failedRequests": 2
    },
    "month": {
      "inputTokens": 30000,
      "outputTokens": 52000,
      "reasoningTokens": 6000,
      "cachedTokens": 4000,
      "totalTokens": 88000,
      "requests": 230,
      "failedRequests": 5
    }
  },
  "hourly": [
    {
      "bucket": "2026-06-10T09:00:00+08:00",
      "inputTokens": 100,
      "outputTokens": 200,
      "reasoningTokens": 20,
      "cachedTokens": 40,
      "totalTokens": 320,
      "requests": 2,
      "failedRequests": 0
    }
  ],
  "daily": [
    {
      "bucket": "2026-06-10",
      "inputTokens": 1000,
      "outputTokens": 2000,
      "reasoningTokens": 300,
      "cachedTokens": 400,
      "totalTokens": 3300,
      "requests": 12,
      "failedRequests": 1
    }
  ],
  "byModel": [
    {
      "model": "gpt-5.4",
      "totalTokens": 50000,
      "requests": 90
    }
  ],
  "byApiKey": [
    {
      "apiKeyHash": "sha256...",
      "apiKeyPreview": "sk-...xxx",
      "totalTokens": 50000,
      "requests": 90
    }
  ]
}
```

### `GET /api/orders`

当前公开手机号查询接口需要收敛。

推荐处理：

- MVP：保留接口但加登录保护，只允许查询当前 session 手机号；忽略或拒绝 `phone` 参数。
- 完整版本：前端不再使用该接口，保留给兼容或测试时也必须登录。

返回完整 API key 的规则：

- 仅当 `req.account.phone === order.phone` 时允许返回。
- 禁止未登录调用。

## 前端页面设计

### `/shop/`

登录后：

- 普通用户跳 `/shop/account/`。
- 管理员可以跳 `/shop/account/` 或 `/shop/admin/`，建议登录页根据身份分流，首页只作为未登录入口时存在。

未登录：

- 根据新规则，直接跳 `/shop/login/`。

首页按钮：

- 删除“手机号查询”。
- 保留 `登录账户` 作为主要入口。
- 是否保留 `使用方法` 和 `兑换 API key` 取决于最终是否允许未登录访问这些页面；在“所有 Shop 页面需登录”规则下，这些按钮应在登录后账户页提供。

### `/shop/query/`

不再展示手机号输入框。

路由行为：

- 未登录：302 `/shop/login/`。
- 已登录：302 `/shop/account/`。

### `/shop/account/`

页面结构：

1. 顶部账户信息
   - 标题：`我的账户`
   - 当前手机号
   - 退出登录

2. API key / 订单区
   - 标题：`我的 API key`
   - 每个 key 一张卡片
   - 显示完整 API key
   - 复制按钮
   - 状态：使用中 / 已过期 / 已禁用
   - 兑换时间
   - 到期时间
   - 关联产品或套餐名

3. 用量概览
   - 今日 total tokens
   - 本周 total tokens
   - 本月 total tokens
   - 本月请求数
   - 失败请求数
   - 最近更新时间 / 数据可能延迟 1 小时

4. Token 类型拆分
   - input tokens
   - output tokens
   - reasoning tokens
   - cached tokens
   - total tokens

5. 图表区
   - 最近 24 小时：小时柱状图，展示每小时 total tokens。
   - 本月每日：日折线图或柱状图，展示每天 total tokens。
   - Token 类型拆分：堆叠柱状图或横向条形图，展示 input/output/reasoning/cached。
   - 模型占比：完整版本可用条形图展示各模型 total tokens。

6. 空状态
   - 没有订单：提示先联系开通或兑换邀请码。
   - 没有 usage event：显示“暂无用量记录，用量统计可能最多延迟 1 小时。”

## 图表设计

### MVP 图表

MVP 只需要原生 HTML/CSS/JS 实现，不引入大型图表库。

原因：

- 当前页面是静态 HTML + 原生 JS。
- MVP 只需要柱状图和基础趋势图。
- 避免引入构建复杂度。

MVP 图表组件：

1. `renderMiniBars(items, options)`
   - 输入：`[{ label, value }]`
   - 输出：一组 CSS bar。
   - 用于最近 24 小时和每日用量。

2. `renderTokenBreakdown(summary)`
   - 输入：input/output/reasoning/cached。
   - 输出：四个横向进度条或四张小卡。

3. `formatTokenCount(value)`
   - 低于 1000：原样展示。
   - 千级：`1.2K`。
   - 百万级：`1.2M`。

### 完整版本图表

完整版本可以引入轻量图表库，例如 Chart.js，或继续使用原生 SVG。

完整图表清单：

1. 最近 24 小时用量
   - 类型：柱状图。
   - X 轴：小时。
   - Y 轴：total tokens。
   - 悬浮提示：input/output/reasoning/cached/requests。

2. 最近 7 天 / 本周用量
   - 类型：折线图或柱状图。
   - X 轴：日期。
   - Y 轴：total tokens。
   - 支持显示失败请求数。

3. 本月每日用量
   - 类型：柱状图。
   - X 轴：日期。
   - Y 轴：total tokens。
   - 支持点击某天展开小时明细。

4. Token 类型拆分
   - 类型：堆叠柱状图。
   - 维度：input/output/reasoning/cached。
   - 用于回答“钱主要花在哪里”。

5. 模型用量排行
   - 类型：横向条形图。
   - 维度：model。
   - 指标：total tokens、requests。

6. API key 用量排行
   - 类型：表格 + 条形图。
   - 普通用户：只显示自己的 key。
   - 管理员：显示全局 key。

7. 金额估算
   - 类型：小卡 + 表格。
   - 前提：后续引入价格表。
   - 计算方式：
     ```text
     amount =
       input_tokens * input_price
       + output_tokens * output_price
       + reasoning_tokens * reasoning_price
       + cached_tokens * cached_price
     ```

## 1 小时延迟策略

不需要实时展示，但要向用户明确数据延迟。

MVP 实现：

- API 每次直接从 `usage_events` 聚合。
- 页面显示 `generatedAt` 和 `lastEventAt`。
- 文案：`用量统计可能最多延迟 1 小时。`

完整版本：

- 增加聚合缓存表，例如 `usage_hourly_rollups`、`usage_daily_rollups`。
- 每小时定时任务从 `usage_events` 增量聚合。
- 账户页优先读聚合表。
- 近 1 小时可以选择不展示，或标记为“统计中”。

## 安全设计

1. 公开手机号查询必须移除或登录保护。
2. 完整 API key 只允许当前登录手机号查看。
3. `/api/account/*` 全部使用 session cookie，不接受手机号参数作为授权依据。
4. `/shop/admin/` 只允许唯一管理员手机号访问。
5. 管理员全局 usage API 和普通用户 usage API 分开。
6. usage event 仍只存 API key hash 和 preview，不在 usage 表存明文 key。
7. 前端不记录完整 API key 到 localStorage/sessionStorage。
8. 复制 API key 只在用户点击按钮时发生。

## MVP 实施拆分

### MVP 1：登录保护和查询页收敛

- 删除首页“手机号查询”按钮。
- `/shop/query/` 改为登录后跳 `/shop/account/`。
- 所有非 login/register 的 `/shop/*` 页面未登录跳 `/shop/login/`。
- `/api/orders?phone=...` 不再公开返回完整 API key。

### MVP 2：账户页合并查询能力

- `/api/account/me` 返回当前用户自己的完整 API key。
- `/shop/account/` 订单卡显示完整 API key 和复制按钮。
- 复用现有 `renderOrderCard(order, { showFullKey: true })`。

### MVP 3：账户页基础用量图表

- 新增 `/api/account/usage-summary`。
- 返回今日、本周、本月、最近 24 小时、本月每日、token 类型拆分。
- 账户页渲染数字卡片和基础柱状图。
- 无数据时显示延迟说明。

### 完整版本：图表与账单细化

- 引入模型筛选、API key 筛选、日期范围筛选。
- 加模型排行、key 用量排行。
- 加价格表和金额估算。
- 增加 hourly/daily rollup 表，减少每次查询的聚合成本。

## 测试计划

### 路由测试

- 未登录访问 `/shop/` 跳 `/shop/login/`。
- 未登录访问 `/shop/query/` 跳 `/shop/login/`。
- 未登录访问 `/shop/account/` 跳 `/shop/login/`。
- 未登录访问 `/shop/admin/` 跳 `/shop/login/`。
- `/shop/login/` 和 `/shop/register/` 未登录可访问。
- 普通用户访问 `/shop/admin/` 返回 403。
- 已登录访问 `/shop/query/` 跳 `/shop/account/`。

### API 测试

- 未登录访问 `/api/account/me` 返回 401。
- 登录用户访问 `/api/account/me` 只能看到自己的订单。
- 登录用户访问 `/api/account/me` 可以看到自己的完整 API key。
- 登录用户不能通过 `/api/orders?phone=其他手机号` 获取他人订单。
- `/api/account/usage-summary` 只聚合当前登录手机号对应的 key。

### 前端静态测试

- Shop 首页不再包含“手机号查询”按钮。
- Query 页面不再包含 `queryForm`、`queryPhone`。
- Account 页面包含 usage summary 容器和 chart 容器。
- Account 页面包含复制 API key 按钮。

### 数据聚合测试

- 同一用户多个 API key 的 usage 会合并到用户月统计。
- 不同手机号的 usage 不会混入当前用户。
- input/output/reasoning/cached/total 分别正确求和。
- hourly bucket 按小时聚合。
- daily bucket 按日期聚合。
- failed requests 计数正确。

## 风险与处理

1. 历史订单仍显示 `Codex 每月额度`
   - MVP 可以先显示历史 productName。
   - 后续可以迁移展示名为 `Codex 按量计费`，但不直接改历史数据。

2. local/unmanaged key 不在 `orders` 表
   - MVP 可以先只处理 Shop 订单。
   - 完整版本必须合并 `usage_key_profiles.phone`。

3. 图表性能
   - MVP 直接聚合 `usage_events`。
   - 完整版本加 rollup 表。

4. 完整 API key 展示的安全风险
   - 只在登录后的账号页展示。
   - 不放入公开接口。
   - 不存浏览器 localStorage。

5. 注册页公开访问
   - 必须保留，否则新用户无法注册。
   - 登录页和注册页是唯一公开例外。

## 当前结论

推荐先实现 MVP 1 到 MVP 3：

1. 先修正安全边界，取消公开手机号查询。
2. 再把完整 API key 和复制能力移动到账户页。
3. 最后给账户页加基础 token 用量图表。

完整图表、价格表和 rollup 表作为后续增强，但本设计已经保留数据结构、API 形态和 UI 方向。
