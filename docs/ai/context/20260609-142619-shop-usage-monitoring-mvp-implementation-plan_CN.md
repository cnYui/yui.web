# Shop Usage Monitoring MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-version Shop admin usage monitor that records CLIProxyAPI usage events, stores them in yui.web SQLite, and shows per-key token/request usage in `/shop/admin/`.

**Architecture:** CLIProxyAPI remains the source of runtime usage facts and writes every usage event to local monthly JSONL before syncing it to yui.web. yui.web becomes the durable ledger and admin UI, linking usage by `api_key_hash` to Shop orders when possible and showing unmatched keys as local/unmanaged.

**Tech Stack:** Go usage plugin and JSONL/HMAC client in CLIProxyAPI; Express 5, better-sqlite3, static HTML/JS, and Node test runner in yui.web.

---

## Reference Documents

- yui.web canonical design: `/Users/wujianxiang/CodeSpace/yui.web/docs/ai/context/20260609-142133-shop-usage-monitoring-mvp-design_CN.md`
- CLIProxyAPI sender design: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/docs/ai/context/20260609-142133-usage-event-publisher-design_CN.md`
- yui.web expiry endpoint context: `/Users/wujianxiang/CodeSpace/yui.web/docs/ai/context/20260531-095633-shop-key-status-endpoint-implementation.md`
- CLIProxyAPI existing usage plugin: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/usage/logger_plugin.go`
- CLIProxyAPI usage reporter helper: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/runtime/executor/helps/usage_helpers.go`

## File Structure

### CLIProxyAPI

- Create `internal/usage/event_types.go`: usage event DTO, key hash/preview helpers, request id and endpoint resolution helpers.
- Create `internal/usage/event_writer.go`: monthly JSONL append writer and 90-day retention cleanup.
- Create `internal/usage/event_sync.go`: yui.web HMAC signed POST client.
- Create `internal/usage/event_plugin.go`: usage plugin that converts `sdk/cliproxy/usage.Record` to event, writes JSONL, and syncs to yui.web.
- Create `internal/usage/event_plugin_test.go`: unit tests for event conversion, no full API key leakage, JSONL writing, HMAC, non-blocking failures.
- Modify `cmd/server/main.go`: initialize usage event plugin from environment.
- Modify `config.example.yaml` or `.env.example` if the repo uses one for runtime examples: document env-only MVP settings.

### yui.web

- Modify `server.js`: add schema migration for `api_keys.api_key_hash`, `usage_events`, internal usage event endpoint, admin usage summary endpoint, admin JSONL import endpoint, and helper functions.
- Modify `.env.example`: add `INTERNAL_TOKEN`, `USAGE_EVENT_HMAC_SECRET`, and `CLIPROXY_USAGE_LOG_DIR`.
- Modify `shop/admin/index.html`: add admin sections for usage monitor and JSONL import while keeping invite generation.
- Modify `shop/shop.js`: add admin usage rendering, filters, manual refresh, and monthly import form.
- Modify `test/shop-flow.test.js`: add yui.web API and admin page tests.

## Task 1: CLIProxyAPI Usage Event Model

**Files:**
- Create: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/usage/event_types.go`
- Test: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/usage/event_plugin_test.go`

- [ ] **Step 1: Write failing tests for event conversion**

Add tests covering stable key hash, masked preview, token normalization, endpoint extraction, and absence of full API key in marshaled JSON.

```go
func TestUsageEventFromRecordMasksAPIKey(t *testing.T) {
	apiKey := "sk-test-secret-value-123456"
	record := coreusage.Record{
		Provider: "codex",
		Model: "gpt-5.4",
		APIKey: apiKey,
		RequestedAt: time.Date(2026, 6, 9, 12, 0, 0, 0, time.UTC),
		Latency: 1500 * time.Millisecond,
		Detail: coreusage.Detail{InputTokens: 10, OutputTokens: 20},
	}

	event := newUsageEvent(context.Background(), record)
	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("marshal event: %v", err)
	}
	if strings.Contains(string(data), apiKey) {
		t.Fatalf("event contains full api key: %s", string(data))
	}
	if event.APIKeyHash == "" {
		t.Fatalf("api_key_hash is empty")
	}
	if event.APIKeyPreview == "" || event.APIKeyPreview == apiKey {
		t.Fatalf("api_key_preview = %q", event.APIKeyPreview)
	}
	if event.TotalTokens != 30 {
		t.Fatalf("total_tokens = %d, want 30", event.TotalTokens)
	}
}
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
go test ./internal/usage -run TestUsageEventFromRecordMasksAPIKey -count=1
```

Expected: fail because `newUsageEvent` and `UsageEvent` do not exist.

- [ ] **Step 3: Implement event DTO and helpers**

Create `event_types.go` with:

```go
package usage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/logging"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/util"
	coreusage "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/usage"
)

type UsageEvent struct {
	Version int `json:"version"`
	RequestID string `json:"request_id"`
	APIKeyHash string `json:"api_key_hash"`
	APIKeyPreview string `json:"api_key_preview"`
	Provider string `json:"provider"`
	Model string `json:"model"`
	Endpoint string `json:"endpoint"`
	Source string `json:"source"`
	AuthIndex string `json:"auth_index"`
	Success bool `json:"success"`
	Failed bool `json:"failed"`
	InputTokens int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
	ReasoningTokens int64 `json:"reasoning_tokens"`
	CachedTokens int64 `json:"cached_tokens"`
	TotalTokens int64 `json:"total_tokens"`
	LatencyMs int64 `json:"latency_ms"`
	RequestedAt string `json:"requested_at"`
}

func newUsageEvent(ctx context.Context, record coreusage.Record) UsageEvent {
	requestedAt := record.RequestedAt
	if requestedAt.IsZero() {
		requestedAt = time.Now()
	}
	totalTokens := record.Detail.TotalTokens
	if totalTokens == 0 {
		totalTokens = record.Detail.InputTokens + record.Detail.OutputTokens + record.Detail.ReasoningTokens
	}
	model := strings.TrimSpace(record.Model)
	if model == "" {
		model = "unknown"
	}
	failed := record.Failed
	return UsageEvent{
		Version: 1,
		RequestID: resolveEventRequestID(ctx),
		APIKeyHash: hashAPIKey(record.APIKey),
		APIKeyPreview: util.HideAPIKey(record.APIKey),
		Provider: strings.TrimSpace(record.Provider),
		Model: model,
		Endpoint: resolveEventEndpoint(ctx),
		Source: strings.TrimSpace(record.Source),
		AuthIndex: strings.TrimSpace(record.AuthIndex),
		Success: !failed,
		Failed: failed,
		InputTokens: nonNegative(record.Detail.InputTokens),
		OutputTokens: nonNegative(record.Detail.OutputTokens),
		ReasoningTokens: nonNegative(record.Detail.ReasoningTokens),
		CachedTokens: nonNegative(record.Detail.CachedTokens),
		TotalTokens: nonNegative(totalTokens),
		LatencyMs: normaliseLatency(record.Latency),
		RequestedAt: requestedAt.Format(time.RFC3339Nano),
	}
}

func hashAPIKey(apiKey string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(apiKey)))
	return hex.EncodeToString(sum[:])
}

func resolveEventRequestID(ctx context.Context) string {
	if ginCtx, ok := ctx.Value("gin").(*gin.Context); ok && ginCtx != nil {
		if requestID := logging.GetGinRequestID(ginCtx); requestID != "" {
			return requestID
		}
	}
	if requestID := logging.GetRequestID(ctx); requestID != "" {
		return requestID
	}
	return "usage_" + logging.GenerateRequestID() + fmt.Sprintf("_%d", time.Now().UnixNano())
}

func resolveEventEndpoint(ctx context.Context) string {
	if ginCtx, ok := ctx.Value("gin").(*gin.Context); ok && ginCtx != nil {
		if path := ginCtx.FullPath(); path != "" {
			return path
		}
		if ginCtx.Request != nil && ginCtx.Request.URL != nil {
			return ginCtx.Request.URL.Path
		}
	}
	return ""
}

func nonNegative(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
go test ./internal/usage -run TestUsageEventFromRecordMasksAPIKey -count=1
```

Expected: pass.

- [ ] **Step 5: Commit CLI event model**

```bash
git -C /Users/wujianxiang/CodeSpace/CLIProxyAPI add internal/usage/event_types.go internal/usage/event_plugin_test.go
git -C /Users/wujianxiang/CodeSpace/CLIProxyAPI commit -m "feat: add usage event model"
```

## Task 2: CLIProxyAPI Monthly JSONL Writer

**Files:**
- Create: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/usage/event_writer.go`
- Test: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/usage/event_plugin_test.go`

- [ ] **Step 1: Write failing tests for JSONL write and retention**

Add tests:

```go
func TestUsageEventWriterAppendsMonthlyJSONL(t *testing.T) {
	dir := t.TempDir()
	writer := newUsageEventWriter(dir, 90)
	event := UsageEvent{
		Version: 1,
		RequestID: "req-jsonl",
		APIKeyHash: hashAPIKey("sk-jsonl"),
		APIKeyPreview: "sk-j...sonl",
		Model: "gpt-5.4",
		RequestedAt: "2026-06-09T12:00:00Z",
	}
	if err := writer.write(event); err != nil {
		t.Fatalf("write event: %v", err)
	}
	data, err := os.ReadFile(filepath.Join(dir, "usage-events-2026-06.jsonl"))
	if err != nil {
		t.Fatalf("read jsonl: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 1 {
		t.Fatalf("line count = %d, want 1", len(lines))
	}
	if !json.Valid([]byte(lines[0])) {
		t.Fatalf("line is not json: %s", lines[0])
	}
}
```

- [ ] **Step 2: Run test and verify it fails**

```bash
go test ./internal/usage -run TestUsageEventWriterAppendsMonthlyJSONL -count=1
```

Expected: fail because `newUsageEventWriter` does not exist.

- [ ] **Step 3: Implement writer**

Create `event_writer.go` with append-only monthly file logic, `0600` file permissions, and retention cleanup limited to `usage-events-*.jsonl`.

- [ ] **Step 4: Run usage package tests**

```bash
go test ./internal/usage -count=1
```

Expected: pass.

- [ ] **Step 5: Commit JSONL writer**

```bash
git -C /Users/wujianxiang/CodeSpace/CLIProxyAPI add internal/usage/event_writer.go internal/usage/event_plugin_test.go
git -C /Users/wujianxiang/CodeSpace/CLIProxyAPI commit -m "feat: write usage events to jsonl"
```

## Task 3: CLIProxyAPI HMAC Sync Client

**Files:**
- Create: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/usage/event_sync.go`
- Test: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/usage/event_plugin_test.go`

- [ ] **Step 1: Write failing HMAC sync tests**

Test headers and non-blocking HTTP failure behavior with `httptest.Server`.

- [ ] **Step 2: Run test and verify it fails**

```bash
go test ./internal/usage -run TestUsageEventSyncClientSignsRequest -count=1
```

Expected: fail because sync client does not exist.

- [ ] **Step 3: Implement sync client**

Implement a small client that:

- Marshals `UsageEvent`.
- Adds `x-internal-token`.
- Adds unix timestamp.
- Signs `timestamp + "\n" + rawBody` using HMAC SHA-256.
- Uses a short client timeout only for this bookkeeping POST.
- Returns errors to plugin logging, never to model request handling.

- [ ] **Step 4: Run tests**

```bash
go test ./internal/usage -count=1
```

Expected: pass.

- [ ] **Step 5: Commit sync client**

```bash
git -C /Users/wujianxiang/CodeSpace/CLIProxyAPI add internal/usage/event_sync.go internal/usage/event_plugin_test.go
git -C /Users/wujianxiang/CodeSpace/CLIProxyAPI commit -m "feat: sync usage events to yui web"
```

## Task 4: CLIProxyAPI Usage Event Plugin Registration

**Files:**
- Create: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/usage/event_plugin.go`
- Modify: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/cmd/server/main.go`
- Modify: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/config.example.yaml`
- Test: `/Users/wujianxiang/CodeSpace/CLIProxyAPI/internal/usage/event_plugin_test.go`

- [ ] **Step 1: Write failing plugin tests**

Test that plugin:

- Writes JSONL when enabled.
- Does not require `usage-statistics-enabled`.
- Continues when sync fails.
- Skips registration when `USAGE_EVENTS_ENABLED` is not `true`.

- [ ] **Step 2: Run test and verify it fails**

```bash
go test ./internal/usage -run TestUsageEventPlugin -count=1
```

Expected: fail because plugin registration is missing.

- [ ] **Step 3: Implement plugin and env config**

Add `RegisterUsageEventPluginFromEnv()` in `internal/usage/event_plugin.go`. It should read:

```env
USAGE_EVENTS_ENABLED=true
USAGE_EVENTS_LOG_DIR=logs/usage
USAGE_EVENTS_RETENTION_DAYS=90
YUI_USAGE_EVENT_URL=http://127.0.0.1:4173/api/internal/usage-events
YUI_USAGE_EVENT_TOKEN=change-me-internal-token
YUI_USAGE_EVENT_HMAC_SECRET=change-me-hmac-secret
```

Call it from `cmd/server/main.go` after existing usage setup.

- [ ] **Step 4: Run CLIProxyAPI verification**

```bash
go test ./internal/usage -count=1
go build -o test-output ./cmd/server
rm test-output
```

Expected: tests pass and build succeeds.

- [ ] **Step 5: Commit plugin registration**

```bash
git -C /Users/wujianxiang/CodeSpace/CLIProxyAPI add internal/usage/event_plugin.go internal/usage/event_plugin_test.go cmd/server/main.go config.example.yaml
git -C /Users/wujianxiang/CodeSpace/CLIProxyAPI commit -m "feat: register usage event publisher"
```

## Task 5: yui.web Schema Migration

**Files:**
- Modify: `/Users/wujianxiang/CodeSpace/yui.web/server.js`
- Test: `/Users/wujianxiang/CodeSpace/yui.web/test/shop-flow.test.js`

- [ ] **Step 1: Write failing schema tests**

Add tests that create a temp database, import an API key, then verify `api_keys.api_key_hash` and `usage_events` exist.

- [ ] **Step 2: Run test and verify it fails**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: fail because schema is missing.

- [ ] **Step 3: Implement schema migration**

In `openShopDatabase`, add:

- `api_key_hash TEXT` migration for `api_keys`.
- Backfill hash for existing keys.
- Unique partial index on `api_key_hash`.
- `usage_events` table and indexes from the design document.

- [ ] **Step 4: Run yui.web tests**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: pass.

- [ ] **Step 5: Commit schema migration**

```bash
git -C /Users/wujianxiang/CodeSpace/yui.web add server.js test/shop-flow.test.js
git -C /Users/wujianxiang/CodeSpace/yui.web commit -m "feat: add usage event schema"
```

## Task 6: yui.web Internal Usage Event Endpoint

**Files:**
- Modify: `/Users/wujianxiang/CodeSpace/yui.web/server.js`
- Modify: `/Users/wujianxiang/CodeSpace/yui.web/.env.example`
- Test: `/Users/wujianxiang/CodeSpace/yui.web/test/shop-flow.test.js`

- [ ] **Step 1: Write failing endpoint security tests**

Cover missing token, wrong token, missing signature, expired timestamp, bad HMAC, valid insert, and duplicate request id skip.

- [ ] **Step 2: Run test and verify it fails**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: fail because `/api/internal/usage-events` is missing.

- [ ] **Step 3: Implement endpoint**

Add helpers in `server.js`:

- `hashApiKey(apiKey)`
- `verifyUsageSignature(req, rawBody)`
- `normalizeUsageEvent(body)`
- `insertUsageEvent(event)`

Configure Express JSON parsing with raw body capture for this endpoint so HMAC signs the original body bytes.

- [ ] **Step 4: Run yui.web tests**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: pass.

- [ ] **Step 5: Commit endpoint**

```bash
git -C /Users/wujianxiang/CodeSpace/yui.web add server.js .env.example test/shop-flow.test.js
git -C /Users/wujianxiang/CodeSpace/yui.web commit -m "feat: receive signed usage events"
```

## Task 7: yui.web Admin Usage Summary API

**Files:**
- Modify: `/Users/wujianxiang/CodeSpace/yui.web/server.js`
- Test: `/Users/wujianxiang/CodeSpace/yui.web/test/shop-flow.test.js`

- [ ] **Step 1: Write failing summary tests**

Seed:

- One redeemed Shop order with usage events.
- One unmanaged key with usage events.
- One failed request event without tokens.

Assert summary returns today, month, total, model split, success/failed counts, `last_seen_at`, and group values.

- [ ] **Step 2: Run test and verify it fails**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: fail because `/api/admin/usage-summary` is missing.

- [ ] **Step 3: Implement summary API**

Add `GET /api/admin/usage-summary` with `requireAdmin` and `limitAdminApi`. Query `usage_events`, left join `api_keys` and `orders` by `api_key_hash`, group unmatched rows as `unmanaged`, and compute current-day/current-month ranges using server time.

- [ ] **Step 4: Run yui.web tests**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: pass.

- [ ] **Step 5: Commit summary API**

```bash
git -C /Users/wujianxiang/CodeSpace/yui.web add server.js test/shop-flow.test.js
git -C /Users/wujianxiang/CodeSpace/yui.web commit -m "feat: add admin usage summary"
```

## Task 8: yui.web JSONL Import Endpoint

**Files:**
- Modify: `/Users/wujianxiang/CodeSpace/yui.web/server.js`
- Modify: `/Users/wujianxiang/CodeSpace/yui.web/.env.example`
- Test: `/Users/wujianxiang/CodeSpace/yui.web/test/shop-flow.test.js`

- [ ] **Step 1: Write failing import tests**

Cover valid month import, duplicate import skipping, invalid month rejection, and path traversal rejection.

- [ ] **Step 2: Run test and verify it fails**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: fail because `/api/admin/usage-imports` is missing.

- [ ] **Step 3: Implement import endpoint**

Add `POST /api/admin/usage-imports`:

- Require `x-admin-token`.
- Read `CLIPROXY_USAGE_LOG_DIR`.
- Accept body `{ "month": "YYYY-MM" }`.
- Resolve only `usage-events-YYYY-MM.jsonl` inside configured directory.
- Parse one JSON object per line.
- Insert with same normalization as live endpoint.
- Return inserted/skipped/failed_lines.

- [ ] **Step 4: Run yui.web tests**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: pass.

- [ ] **Step 5: Commit import endpoint**

```bash
git -C /Users/wujianxiang/CodeSpace/yui.web add server.js .env.example test/shop-flow.test.js
git -C /Users/wujianxiang/CodeSpace/yui.web commit -m "feat: import usage jsonl logs"
```

## Task 9: yui.web Admin Page UI

**Files:**
- Modify: `/Users/wujianxiang/CodeSpace/yui.web/shop/admin/index.html`
- Modify: `/Users/wujianxiang/CodeSpace/yui.web/shop/shop.js`
- Test: `/Users/wujianxiang/CodeSpace/yui.web/test/shop-flow.test.js`

- [ ] **Step 1: Write failing static UI tests**

Assert admin HTML contains usage monitor controls, import controls, and still contains invite generation form. Assert JS exports usage admin initialization logic.

- [ ] **Step 2: Run test and verify it fails**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: fail because admin page does not include usage UI.

- [ ] **Step 3: Implement admin UI**

Extend `/shop/admin/` with:

- Admin token input reused for all admin actions.
- Invite generation section.
- Usage monitor section with refresh button, filters, summary cards, table, and model breakdown rows.
- JSONL import section with month input and import button.

In `shop.js`, add:

- `initAdminUsagePage`
- `fetchAdminUsage`
- `renderUsageSummary`
- `renderUsageItems`
- `submitUsageImport`

Keep full API keys out of rendered HTML.

- [ ] **Step 4: Run yui.web tests**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: pass.

- [ ] **Step 5: Commit admin UI**

```bash
git -C /Users/wujianxiang/CodeSpace/yui.web add shop/admin/index.html shop/shop.js test/shop-flow.test.js
git -C /Users/wujianxiang/CodeSpace/yui.web commit -m "feat: show shop usage in admin"
```

## Task 10: End-to-End Local Verification

**Files:**
- Modify only if verification reveals a bug in earlier tasks.

- [ ] **Step 1: Run CLIProxyAPI tests and build**

```bash
cd /Users/wujianxiang/CodeSpace/CLIProxyAPI
go test ./internal/usage -count=1
go build -o test-output ./cmd/server
rm test-output
```

Expected: tests pass and build succeeds.

- [ ] **Step 2: Run yui.web tests**

```bash
cd /Users/wujianxiang/CodeSpace/yui.web
node --test test/shop-flow.test.js
```

Expected: all shop flow tests pass.

- [ ] **Step 3: Manual local check**

Start yui.web and CLIProxyAPI with these environment values:

```env
INTERNAL_TOKEN=local-internal-token
USAGE_EVENT_HMAC_SECRET=local-hmac-secret
CLIPROXY_USAGE_LOG_DIR=/Users/wujianxiang/CodeSpace/CLIProxyAPI/logs/usage
USAGE_EVENTS_ENABLED=true
USAGE_EVENTS_LOG_DIR=logs/usage
USAGE_EVENTS_RETENTION_DAYS=90
YUI_USAGE_EVENT_URL=http://127.0.0.1:4173/api/internal/usage-events
YUI_USAGE_EVENT_TOKEN=local-internal-token
YUI_USAGE_EVENT_HMAC_SECRET=local-hmac-secret
```

Send one model request through CLIProxyAPI using a known client key. Confirm:

- CLIProxyAPI writes `logs/usage/usage-events-YYYY-MM.jsonl`.
- yui.web `usage_events` has one row.
- `/shop/admin/` usage section shows the key in Shop or unmanaged group.
- Re-importing the same month reports skipped rows rather than duplicate totals.

- [ ] **Step 4: Commit verification notes**

Add a new context note if manual verification changes any operational detail.

```bash
git -C /Users/wujianxiang/CodeSpace/yui.web add docs/ai/context
git -C /Users/wujianxiang/CodeSpace/yui.web commit -m "docs: record usage monitoring verification"
```

## Execution Notes

- Keep CLIProxyAPI and yui.web changes in separate commits by repository.
- Do not display full API keys in logs, test failure messages, HTML, or JSON API responses.
- Do not turn on ordinary `request-log` for monitoring.
- Do not make usage sync failure block model requests.
- Prefer tests before implementation for each task.
