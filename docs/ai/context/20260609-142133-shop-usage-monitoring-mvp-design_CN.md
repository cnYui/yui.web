# Shop API Key 用量监控 MVP 设计

## 背景

`yui.web` 的 Shop 已经是客户、手机号、邀请码、API Key、兑换时间和到期时间的事实来源。真实模型请求由 `CLIProxyAPI` 转发，token 用量由 `CLIProxyAPI` 在 executor 中解析。

第一阶段只做管理员监控面板，不做用户登录、余额、欠费停用、告警或金额展示。

## 目标

- 在 `yui.web` 的 `/shop/admin/` 中增加用量监控区域。
- 管理员可以看到每个 Shop 托管 API Key 的今日、本月、总计用量。
- 管理员也可以看到本地/未托管 API Key 的用量，例如本机 `LOCAL` key。
- 数据以结构化 usage event 记录，不解析普通 request log，不记录 prompt。
- `CLIProxyAPI` 本地保留月度 JSONL，`yui.web` SQLite 持久保存原始流水。
- 实时同步失败不影响用户模型请求，并可通过管理员面板手动导入月度 JSONL 补账。

## 非目标

- 不做用户手机号登录。
- 不向用户展示用量。
- 不计算或展示金额。
- 不做余额、欠费、限额或自动停用。
- 不记录客户端 IP。
- 不做自动告警。
- 不使用普通 request-log 作为账本来源。

## 已确认边界

- 同时改 `CLIProxyAPI` 和 `yui.web`。
- `CLIProxyAPI` 每次 usage record 产生后：
  - 本地写月度 JSONL。
  - 实时 POST 到 `yui.web` 内部接口。
- JSONL 按月切分，例如 `usage-events-2026-06.jsonl`。
- JSONL 保留 90 天。
- API Key 关联使用 hash，不在 usage 表和 event 中保存完整 API Key。
- yui.web 管理员面板中手机号完整显示，API Key 只显示 preview。
- 失败请求如果有 usage 就记录 token；如果没有 usage，只记录失败请求数。
- `request_id` 全局唯一，用于幂等去重。
- 管理员面板加载时拉一次数据，之后手动刷新。
- 管理员面板支持手机号、API Key preview、状态搜索，支持 Shop/未托管分组筛选。
- 管理员面板展示成功请求数、失败请求数、总请求数和 `last_seen_at`。
- 管理员面板展示每个 key 的模型拆分。
- endpoint 写入 event，但默认不在表格展示。
- 价格字段在 schema 中预留，MVP 不计算、不展示。

## 数据流

```text
用户请求 CLIProxyAPI
  -> CLIProxyAPI 完成鉴权，得到 client API Key
  -> executor 调用上游模型并解析 usage
  -> UsageReporter 发布 usage record
  -> usage event 插件生成结构化事件
  -> CLIProxyAPI 写本地月度 JSONL
  -> CLIProxyAPI POST 到 yui.web /api/internal/usage-events
  -> yui.web 校验 token、HMAC、timestamp
  -> yui.web 以 request_id 幂等写入 SQLite usage_events
  -> /shop/admin/ 查询聚合数据并展示
```

## Usage Event

MVP 事件字段：

```json
{
  "version": 1,
  "request_id": "req_...",
  "api_key_hash": "sha256_hex",
  "api_key_preview": "sk-...abcd",
  "provider": "codex",
  "model": "gpt-5.4",
  "endpoint": "/v1/responses",
  "source": "upstream account label or email",
  "auth_index": "0",
  "success": true,
  "failed": false,
  "input_tokens": 0,
  "output_tokens": 0,
  "reasoning_tokens": 0,
  "cached_tokens": 0,
  "total_tokens": 0,
  "latency_ms": 0,
  "requested_at": "2026-06-09T14:21:33+09:00"
}
```

字段规则：

- `request_id`：全局唯一。重复事件不重复计数。
- `api_key_hash`：完整 API Key 的稳定 hash。hash 用于关联订单和本地/未托管 key。
- `api_key_preview`：只用于管理员识别，不能当主键。
- `source` / `auth_index`：保留上游来源，默认不在 MVP 表格展示。
- token 字段缺失或负数时按 `0` 处理。
- `total_tokens` 为 `0` 时可由 `input + output + reasoning` 兜底，但不把 cached token 强行计入 total，避免口径混乱。
- 价格相关字段在表结构中预留，event 第一版不要求传。

## 安全设计

`yui.web` 新增内部接口：

```text
POST /api/internal/usage-events
```

请求头：

```text
x-internal-token: <INTERNAL_TOKEN>
x-usage-timestamp: <unix seconds>
x-usage-signature: <hex hmac>
```

签名规则：

```text
HMAC_SHA256(USAGE_EVENT_HMAC_SECRET, x-usage-timestamp + "\n" + raw_body)
```

校验规则：

- 缺少 `x-internal-token` 拒绝。
- token 与 `INTERNAL_TOKEN` 不匹配拒绝。
- 缺少 timestamp 或 signature 拒绝。
- timestamp 超出服务器当前时间正负 5 分钟拒绝。
- HMAC 不匹配拒绝。
- body 不是合法 JSON 拒绝。
- `request_id` 已存在时返回成功，但标记为 skipped，不重复写入。

部署建议：

- `CLIProxyAPI` 和 `yui.web` 同机时优先使用 `http://127.0.0.1:4173/api/internal/usage-events`。
- 不通过公网域名绕 Cloudflare。
- `/api/internal/*` 不给用户页面调用。
- event 不包含完整 API Key、prompt、response body、客户端 IP。

## SQLite 设计

### api_keys 调整

给现有 `api_keys` 表增加 hash 字段：

```sql
ALTER TABLE api_keys ADD COLUMN api_key_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash_unique
ON api_keys(api_key_hash)
WHERE api_key_hash IS NOT NULL;
```

迁移时对已有 `api_key` 回填 `api_key_hash`。

### usage_events

新增原始流水表：

```sql
CREATE TABLE IF NOT EXISTS usage_events (
  request_id TEXT PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  api_key_preview TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'unknown',
  endpoint TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  auth_index TEXT NOT NULL DEFAULT '',
  success INTEGER NOT NULL DEFAULT 1,
  failed INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  requested_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  price_amount_micros INTEGER,
  price_currency TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_events_key_time
ON usage_events(api_key_hash, requested_at);

CREATE INDEX IF NOT EXISTS idx_usage_events_model_time
ON usage_events(model, requested_at);
```

设计说明：

- `usage_events` 永久保存原始流水，MVP 查询时现场聚合今日、本月、总计。
- `api_key_hash` 关联 `api_keys.api_key_hash`。
- 未匹配到 `api_keys` 的事件照样入库，面板标记为 `unmanaged`。
- `price_amount_micros` 和 `price_currency` 仅预留，不在 MVP 中写入和展示。

## yui.web API

### 接收 usage event

```text
POST /api/internal/usage-events
```

响应：

```json
{
  "inserted": 1,
  "skipped": 0
}
```

重复 `request_id`：

```json
{
  "inserted": 0,
  "skipped": 1
}
```

### 管理员查询用量

```text
GET /api/admin/usage-summary
```

鉴权：

```text
x-admin-token: <ADMIN_TOKEN>
```

支持查询参数：

- `q`：手机号、API Key preview、状态关键词。
- `group`：`all`、`shop`、`unmanaged`。
- `status`：`all`、`active`、`expired`、`unused`、`disabled`、`unmanaged`。

返回结构：

```json
{
  "summary": {
    "today_tokens": 0,
    "month_tokens": 0,
    "total_tokens": 0,
    "today_requests": 0,
    "month_requests": 0,
    "total_requests": 0,
    "failed_requests": 0
  },
  "items": [
    {
      "group": "shop",
      "phone": "<phone>",
      "api_key_preview": "sk-...abcd",
      "status": "active",
      "redeemed_at": "2026-05-31T07:07:26+08:00",
      "expires_at": "2026-07-01T07:07:26+08:00",
      "today_tokens": 0,
      "month_tokens": 0,
      "total_tokens": 0,
      "success_requests": 0,
      "failed_requests": 0,
      "total_requests": 0,
      "last_seen_at": "",
      "models": [
        {
          "model": "gpt-5.4",
          "month_tokens": 0,
          "total_tokens": 0,
          "total_requests": 0
        }
      ]
    }
  ]
}
```

### 手动导入 JSONL

```text
POST /api/admin/usage-imports
```

body：

```json
{
  "month": "2026-06"
}
```

规则：

- 只允许 `YYYY-MM`。
- yui.web 从 `.env` 的 `CLIPROXY_USAGE_LOG_DIR` 读取目录。
- 文件路径固定解析为 `usage-events-YYYY-MM.jsonl`。
- 解析后的路径必须仍在 `CLIPROXY_USAGE_LOG_DIR` 下。
- 每行 JSON 独立处理。
- 重复 `request_id` 跳过。
- 非法行计入 `failed_lines`，不影响其他行导入。

响应：

```json
{
  "month": "2026-06",
  "inserted": 0,
  "skipped": 0,
  "failed_lines": 0
}
```

## 管理员页面设计

扩展现有 `/shop/admin/`，拆成三个区域或 tab：

- 邀请码：保留现有生成邀请码功能。
- 用量监控：新增 usage 看板。
- 日志导入：新增月度 JSONL 手动导入。

用量监控区域：

- 顶部汇总卡：
  - 今日 token
  - 本月 token
  - 总 token
  - 失败请求数
- 筛选：
  - 搜索框：手机号、API Key preview、状态。
  - 分组：全部、Shop、未托管。
  - 状态：全部、使用中、已过期、未使用、已禁用、未托管。
- 表格：
  - 分组
  - 手机号
  - API Key preview
  - 状态
  - 今日 token
  - 本月 token
  - 总 token
  - 成功/失败/总请求数
  - 最近请求时间
  - 模型拆分

展示规则：

- Shop key 显示完整手机号和 API Key preview。
- 未托管 key 的手机号显示 `-`，分组显示 `本地/未托管`。
- 完整 API Key 永不出现在监控表格。
- endpoint、source、auth_index 不默认展示。

## CLIProxyAPI 本地 JSONL

yui.web 依赖 CLIProxyAPI 按月写入：

```text
<usage-log-dir>/usage-events-YYYY-MM.jsonl
```

每行一个 usage event JSON。

保留策略：

- CLIProxyAPI 清理 90 天之前的 usage JSONL。
- yui.web SQLite 中已导入的 usage_events 不随 JSONL 清理而删除。

## 失败处理

- yui.web 同步接口失败时，CLIProxyAPI 不阻断用户请求。
- CLIProxyAPI 已经写入本地 JSONL，因此后续可通过 yui.web 管理员面板补导。
- CLIProxyAPI 本地 JSONL 写失败时，不阻断用户请求，只写应用错误日志。
- yui.web 写 SQLite 失败时，同步请求返回 500，CLIProxyAPI 记录同步失败。
- 手动导入依赖 `request_id` 去重，重复导入不会重复计数。

## 测试范围

### yui.web

- 缺少 `x-internal-token` 拒绝 usage event。
- 错误 `x-internal-token` 拒绝 usage event。
- 缺少 HMAC 拒绝。
- 错误 HMAC 拒绝。
- 过期 timestamp 拒绝。
- 合法 usage event 写入 `usage_events`。
- 重复 `request_id` 跳过，不重复计数。
- Shop key 能通过 `api_key_hash` 关联手机号和到期时间。
- 未知 `api_key_hash` 入库并显示为 `unmanaged`。
- 管理员 usage summary 需要 `x-admin-token`。
- usage summary 返回今日、本月、总计。
- 模型拆分聚合正确。
- JSONL 导入只接受 `YYYY-MM`。
- JSONL 导入不能读取配置目录之外的文件。
- JSONL 导入重复行幂等跳过。
- 现有兑换、查询、状态接口行为不变。

### CLIProxyAPI

- usage event 生成不包含完整 API Key。
- API Key hash 稳定。
- request_id 缺失时生成全局唯一 ID。
- JSONL 文件按月写入。
- 90 天保留策略只清理 usage JSONL。
- yui.web 同步请求包含 token、timestamp、HMAC。
- 同步失败不影响 usage record 处理。
- JSONL 写失败不影响用户请求。
- streaming 和 non-streaming usage 都能产出 event。
- 没有 token usage 的失败请求仍记录失败请求数。

## 后续阶段

第二阶段再考虑：

- 用户手机号登录。
- 用户侧 `/shop/account/` 用量页。
- 价格表和金额展示。
- 余额、欠费、超额停用。
- 自动告警。
- 自动补偿重试队列。
