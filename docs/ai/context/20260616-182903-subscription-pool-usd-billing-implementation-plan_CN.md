# Subscription Pool USD Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Shop 从人民币按量余额扣费改为订阅池美元额度扣费：29/39/59 元月费分别提供每日 19/29/49 美元额度，东八区 0 点刷新，不结转，三个套餐都可用 `gpt-5.4` 和 `gpt-5.5`。

**Architecture:** 新增独立美元价格模块、订阅/加量包/美元扣费账本表；新 usage 只扣美元额度，不再扣 `account_balances.balance_nanos`。计价规则只有一套：按 usage event 最终上报的 `cache_hit_input_tokens`、`cache_miss_input_tokens`、`output_tokens` 乘以官方美元价格，不区分长短上下文，不引入 Batch / Flex / Priority。

**Tech Stack:** Node.js、Express、better-sqlite3、原生前端模块、`node --test`、Tailwind 构建 CSS。

---

## 文件结构

- Create: `lib/shop-usd-money.js`
  - 负责 USD micros 常量、美元展示、美元金额解析、整数向上取整扣费。
- Create: `lib/shop-official-gpt-pricing.js`
  - 负责 `gpt-5.4` / `gpt-5.5` 官方美元价格和 usage 美元计价。
- Create: `lib/shop-official-gpt-pricing.test.js`
  - 覆盖官方美元价格、缓存命中输入、未命中输入、输出和失败事件。
- Modify: `server.js`
  - 新增订阅池表、查询语句、公开序列化函数、订阅/加量包申请与审核、内部 API key 状态、usage 美元扣费、Account/Admin API。
- Modify: `test/shop-flow.test.js`
  - 覆盖数据库 schema、订阅套餐、加量包、额度刷新、API key 放行、美元扣费、Account/Admin API。
- Modify: `lib/shop-model-overview.js`
  - 模型总览从人民币价格切换为官方美元价格。
- Modify: `lib/shop-model-overview.test.js`
  - 更新模型价格断言。
- Modify: `shop/js/core.js`
  - 新增美元格式化 `formatUsdMicros`。
- Modify: `shop/js/account.js`
  - Account 页展示订阅、今日额度、美元扣费流水、订阅/加量包申请。
- Modify: `shop/account/index.html`
  - 替换充值余额区为订阅池和加量包区。
- Modify: `shop/js/admin.js`
  - Admin 业务办理展示订阅/加量包审核和用户美元额度面板；用量监控展示美元消耗。
- Modify: `shop/admin/index.html`
  - 调整业务办理和用量监控容器。
- Modify: `styles/tailwind.css` 和 `styles/site.css`
  - 为订阅池额度条和 Admin 美元面板补必要组件类。
- Modify: `AGENTS.md`
  - 记录美元订阅池已实施后的长期协作记忆。

---

## 测试 Helper 约定

在 `test/shop-flow.test.js` 顶部现有 helper 附近新增：

```js
async function registerAndLogin(baseUrl, phone, password = 'Abcdefg1') {
    const cookie = await registerUserAndGetCookie(baseUrl, phone, password);
    return { cookie, headers: { cookie } };
}

async function loginAdmin() {
    return { headers: { 'x-admin-token': 'test-token' } };
}

function internalHeaders() {
    return { 'x-internal-token': 'internal-test-token' };
}

async function redeemManagedApiKeyForTest(baseUrl, phone, apiKey = `sk-test-${phone}`) {
    const order = await createRedeemedOrder(baseUrl, phone, apiKey);
    const cookie = await registerUserAndGetCookie(baseUrl, phone);
    return { apiKey: order.apiKey, order, cookie, headers: { cookie } };
}

async function createSubscriptionOrderForTest({ baseUrl, headers, planId }) {
    const result = await jsonFetch(`${baseUrl}/api/account/subscription-orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId, paymentMethod: 'wechat', paymentNote: 'test' })
    });
    assert.equal(result.response.status, 201);
    return result.body.order;
}

async function createApprovedSubscriptionForTest({ baseUrl, headers, adminHeaders, planId }) {
    const order = await createSubscriptionOrderForTest({ baseUrl, headers, planId });
    const approved = await jsonFetch(`${baseUrl}/api/admin/subscription-orders/${order.id}/approve`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ adminNote: 'test approved' })
    });
    assert.equal(approved.response.status, 200);
    return approved.body.subscription;
}
```

测试使用现有 `withServer(async ({ baseUrl, db }) => { ... }, appOptions)` 风格。`jsonFetch` 返回 `{ response, body }`，断言读取 `result.response.status`。

---

### Task 1: USD 金额与官方价格模块

**Files:**
- Create: `lib/shop-usd-money.js`
- Create: `lib/shop-official-gpt-pricing.js`
- Create: `lib/shop-official-gpt-pricing.test.js`

- [ ] **Step 1: 写失败测试**

Create `lib/shop-official-gpt-pricing.test.js`:

```js
const assert = require('node:assert/strict');
const test = require('node:test');

const {
    formatUsdMicros,
    priceOfficialUsageUsd,
    usdMicrosToUsd
} = require('./shop-official-gpt-pricing');

test('gpt-5.4 按官方美元价格扣费', () => {
    assert.deepEqual(priceOfficialUsageUsd({
        model: 'gpt-5.4',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    }), {
        chargeUsdMicros: 17750000,
        status: 'charged',
        officialPriceVersion: 'openai-gpt-5.4-usd-20260616'
    });
});

test('gpt-5.5 按官方美元价格扣费', () => {
    assert.deepEqual(priceOfficialUsageUsd({
        model: 'gpt-5.5',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    }), {
        chargeUsdMicros: 35500000,
        status: 'charged',
        officialPriceVersion: 'openai-gpt-5.5-usd-20260616'
    });
});

test('失败 usage 不扣美元额度', () => {
    assert.deepEqual(priceOfficialUsageUsd({
        model: 'gpt-5.5',
        failed: true,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    }), {
        chargeUsdMicros: 0,
        status: 'failed_no_charge',
        officialPriceVersion: 'failed-no-charge'
    });
});

test('美元 micros 展示为美元金额', () => {
    assert.equal(usdMicrosToUsd(35500000), 35.5);
    assert.equal(formatUsdMicros(35500000), '$35.50');
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test lib/shop-official-gpt-pricing.test.js
```

Expected: FAIL，找不到 `./shop-official-gpt-pricing`。

- [ ] **Step 3: 实现金额工具**

Create `lib/shop-usd-money.js`:

```js
const usdMicrosPerUsd = 1000000;

function nonNegativeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.floor(number);
}

function usdMicrosToUsd(usdMicros) {
    return Number(usdMicros || 0) / usdMicrosPerUsd;
}

function formatUsdMicros(usdMicros) {
    return `$${usdMicrosToUsd(usdMicros).toFixed(2)}`;
}

function priceTokensToUsdMicros(tokens, usdMicrosPerMillionTokens) {
    const safeTokens = nonNegativeInteger(tokens);
    const safePrice = nonNegativeInteger(usdMicrosPerMillionTokens);
    if (safeTokens <= 0 || safePrice <= 0) return 0;
    return Math.ceil((safeTokens * safePrice) / 1000000);
}

module.exports = {
    formatUsdMicros,
    nonNegativeInteger,
    priceTokensToUsdMicros,
    usdMicrosPerUsd,
    usdMicrosToUsd
};
```

- [ ] **Step 4: 实现官方价格模块**

Create `lib/shop-official-gpt-pricing.js`:

```js
const {
    formatUsdMicros,
    nonNegativeInteger,
    priceTokensToUsdMicros,
    usdMicrosToUsd
} = require('./shop-usd-money');

const defaultOfficialModel = 'gpt-5.4';

const officialGptUsdPrices = Object.freeze({
    'gpt-5.4': Object.freeze({
        model: 'gpt-5.4',
        version: 'openai-gpt-5.4-usd-20260616',
        cacheHitInputUsdMicrosPerMillionTokens: 250000,
        cacheMissInputUsdMicrosPerMillionTokens: 2500000,
        outputUsdMicrosPerMillionTokens: 15000000
    }),
    'gpt-5.5': Object.freeze({
        model: 'gpt-5.5',
        version: 'openai-gpt-5.5-usd-20260616',
        cacheHitInputUsdMicrosPerMillionTokens: 500000,
        cacheMissInputUsdMicrosPerMillionTokens: 5000000,
        outputUsdMicrosPerMillionTokens: 30000000
    })
});

function normalizeOfficialModel(model) {
    const normalized = String(model || '').trim().toLowerCase();
    return officialGptUsdPrices[normalized] ? normalized : defaultOfficialModel;
}

function priceOfficialUsageUsd(event = {}) {
    if (event.failed) {
        return {
            chargeUsdMicros: 0,
            status: 'failed_no_charge',
            officialPriceVersion: 'failed-no-charge'
        };
    }
    const price = officialGptUsdPrices[normalizeOfficialModel(event.model)];
    const chargeUsdMicros =
        priceTokensToUsdMicros(event.cacheHitInputTokens ?? event.cache_hit_input_tokens, price.cacheHitInputUsdMicrosPerMillionTokens) +
        priceTokensToUsdMicros(event.cacheMissInputTokens ?? event.cache_miss_input_tokens, price.cacheMissInputUsdMicrosPerMillionTokens) +
        priceTokensToUsdMicros(event.outputTokens ?? event.output_tokens, price.outputUsdMicrosPerMillionTokens);
    return {
        chargeUsdMicros,
        status: chargeUsdMicros > 0 ? 'charged' : 'unpriced_no_charge',
        officialPriceVersion: price.version
    };
}

function priceForOfficialVersion(version) {
    const normalized = String(version || '').trim();
    return Object.values(officialGptUsdPrices).find((price) => price.version === normalized) || officialGptUsdPrices[defaultOfficialModel];
}

module.exports = {
    defaultOfficialModel,
    formatUsdMicros,
    nonNegativeInteger,
    officialGptUsdPrices,
    priceForOfficialVersion,
    priceOfficialUsageUsd,
    usdMicrosToUsd
};
```

- [ ] **Step 5: 运行测试确认通过并提交**

```bash
node --test lib/shop-official-gpt-pricing.test.js
git add lib/shop-usd-money.js lib/shop-official-gpt-pricing.js lib/shop-official-gpt-pricing.test.js
git commit -m "feat: add official GPT USD pricing"
```

Expected: PASS，4 个测试通过。

---

### Task 2: 订阅池 schema 与默认套餐

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试**

Append to `test/shop-flow.test.js`:

```js
test('Shop 数据库包含订阅池美元额度表和默认套餐', async () => {
    await withServer(async ({ db }) => {
        const tables = db.prepare(`
SELECT name FROM sqlite_master
WHERE type = 'table'
AND name IN ('subscription_plans', 'account_subscriptions', 'subscription_orders', 'api_usd_charge_records', 'account_quota_ledger_entries')
ORDER BY name
`).all().map((row) => row.name);
        assert.deepEqual(tables, [
            'account_quota_ledger_entries',
            'account_subscriptions',
            'api_usd_charge_records',
            'subscription_orders',
            'subscription_plans'
        ]);
        const plans = db.prepare('SELECT id, monthly_price_cents, daily_quota_usd_micros FROM subscription_plans ORDER BY monthly_price_cents').all();
        assert.deepEqual(plans, [
            { id: 'sub_29_daily_19_usd', monthly_price_cents: 2900, daily_quota_usd_micros: 19000000 },
            { id: 'sub_39_daily_29_usd', monthly_price_cents: 3900, daily_quota_usd_micros: 29000000 },
            { id: 'sub_59_daily_49_usd', monthly_price_cents: 5900, daily_quota_usd_micros: 49000000 }
        ]);
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池美元额度表"
```

Expected: FAIL，缺少订阅池表。

- [ ] **Step 3: 增加 schema**

Add to `server.js` database initialization:

```js
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL,
  daily_quota_usd_micros INTEGER NOT NULL,
  period_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_subscriptions (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone),
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_subscriptions_one_active
ON account_subscriptions(phone)
WHERE status = 'active';

CREATE TABLE IF NOT EXISTS subscription_orders (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('subscription', 'quota_addon')),
  plan_id TEXT,
  amount_cents INTEGER NOT NULL,
  quota_usd_micros INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('alipay', 'wechat')),
  payment_note TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  confirmed_by_phone TEXT,
  admin_note TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE TABLE IF NOT EXISTS api_usd_charge_records (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  usage_event_id TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_hit_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_miss_input_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  official_price_version TEXT NOT NULL,
  charge_usd_micros INTEGER NOT NULL,
  quota_before_usd_micros INTEGER NOT NULL,
  quota_after_usd_micros INTEGER NOT NULL,
  quota_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('charged', 'failed_no_charge', 'unpriced_no_charge', 'adjusted')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_api_usd_charge_records_phone_date
ON api_usd_charge_records(phone, quota_date, created_at);

CREATE TABLE IF NOT EXISTS account_quota_ledger_entries (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('subscription_daily_grant', 'addon_grant', 'api_usd_charge', 'admin_adjustment', 'refund')),
  amount_usd_micros INTEGER NOT NULL,
  quota_after_usd_micros INTEGER NOT NULL,
  quota_date TEXT NOT NULL,
  related_id TEXT,
  memo TEXT,
  created_at TEXT NOT NULL,
  created_by_phone TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);
```

- [ ] **Step 4: 增加默认套餐和加量包定义**

Seed `subscription_plans`:

```js
[
    ['sub_29_daily_19_usd', '29 元订阅池', 2900, 19000000],
    ['sub_39_daily_29_usd', '39 元订阅池', 3900, 29000000],
    ['sub_59_daily_49_usd', '59 元订阅池', 5900, 49000000]
].forEach(([id, name, monthlyPriceCents, dailyQuotaUsdMicros]) => {
    seedSubscriptionPlan.run({ id, name, monthlyPriceCents, dailyQuotaUsdMicros, now: nowIso() });
});
```

加量包不需要单独包表，第一版用订单类型 `quota_addon`，允许固定 `5/10/20/50` 元分别增加 `5/10/20/50` 美元当日额度。

- [ ] **Step 5: 运行测试确认通过并提交**

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池美元额度表"
git add server.js test/shop-flow.test.js
git commit -m "feat: add subscription pool schema"
```

---

### Task 3: 订阅与加量包申请 / 审核 API

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试**

Append to `test/shop-flow.test.js`:

```js
test('用户可提交订阅申请，管理员确认后开通 30 天订阅', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const user = await registerAndLogin(baseUrl, '13800137701');
        const admin = await loginAdmin();
        const created = await jsonFetch(`${baseUrl}/api/account/subscription-orders`, {
            method: 'POST',
            headers: user.headers,
            body: JSON.stringify({ planId: 'sub_39_daily_29_usd', paymentMethod: 'wechat', paymentNote: 'wx-yui' })
        });
        assert.equal(created.response.status, 201);
        assert.equal(created.body.order.status, 'pending');
        assert.equal(created.body.order.amountCents, 3900);

        const approved = await jsonFetch(`${baseUrl}/api/admin/subscription-orders/${created.body.order.id}/approve`, {
            method: 'POST',
            headers: admin.headers,
            body: JSON.stringify({ adminNote: 'ok' })
        });
        assert.equal(approved.response.status, 200);
        assert.equal(approved.body.subscription.planId, 'sub_39_daily_29_usd');
        assert.equal(approved.body.subscription.dailyQuotaUsdMicros, 29000000);

        const row = db.prepare('SELECT phone, plan_id, status FROM account_subscriptions WHERE phone = ?').get('13800137701');
        assert.deepEqual(row, { phone: '13800137701', plan_id: 'sub_39_daily_29_usd', status: 'active' });
    });
});

test('用户可购买 5 元当日加量包，管理员确认后增加 5 美元今日额度', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const user = await registerAndLogin(baseUrl, '13800137702');
        const admin = await loginAdmin();
        await createApprovedSubscriptionForTest({ baseUrl, headers: user.headers, adminHeaders: admin.headers, planId: 'sub_29_daily_19_usd' });
        const created = await jsonFetch(`${baseUrl}/api/account/quota-addons`, {
            method: 'POST',
            headers: user.headers,
            body: JSON.stringify({ amount: 5, paymentMethod: 'alipay', paymentNote: 'ali-yui' })
        });
        assert.equal(created.response.status, 201);
        assert.equal(created.body.addon.quotaUsdMicros, 5000000);
        const approved = await jsonFetch(`${baseUrl}/api/admin/quota-addons/${created.body.addon.id}/approve`, {
            method: 'POST',
            headers: admin.headers,
            body: JSON.stringify({ adminNote: 'ok' })
        });
        assert.equal(approved.body.addon.status, 'approved');
        const row = db.prepare('SELECT status, quota_usd_micros FROM subscription_orders WHERE id = ?').get(created.body.addon.id);
        assert.deepEqual(row, { status: 'approved', quota_usd_micros: 5000000 });
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅申请|加量包"
```

Expected: FAIL，接口 404。

- [ ] **Step 3: 实现申请和审核**

Implement in `server.js`:

- `createSubscriptionOrder({ phone, planId, paymentMethod, paymentNote })`
- `createQuotaAddonOrder({ phone, amount, paymentMethod, paymentNote })`
- `approveSubscriptionOrder({ id, adminPhone, adminNote })`
- `approveQuotaAddonOrder({ id, adminPhone, adminNote })`
- `publicSubscriptionOrder(row)`
- `publicAccountSubscription(row)`

Add routes:

```js
app.post('/api/account/subscription-orders', limitQueryApi, requireSameOrigin, requireAccount, requireAccountCsrf, ...);
app.post('/api/account/quota-addons', limitQueryApi, requireSameOrigin, requireAccount, requireAccountCsrf, ...);
app.post('/api/admin/subscription-orders/:id/approve', limitAdminApi, requireSameOrigin, requireAdminUsageAccess, requireAccountCsrf, ...);
app.post('/api/admin/quota-addons/:id/approve', limitAdminApi, requireSameOrigin, requireAdminUsageAccess, requireAccountCsrf, ...);
```

加量包金额只允许 `5`、`10`、`20`、`50`，对应美元额度也分别是 `5_000_000`、`10_000_000`、`20_000_000`、`50_000_000` micros。

- [ ] **Step 4: 运行测试确认通过并提交**

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅申请|加量包"
git add server.js test/shop-flow.test.js
git commit -m "feat: add subscription and addon orders"
```

---

### Task 4: 今日额度计算与内部 API key 放行

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试**

Append to `test/shop-flow.test.js`:

```js
test('内部 API key 状态按东八区今日美元额度放行和拒绝', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const { apiKey, headers } = await redeemManagedApiKeyForTest(baseUrl, '13800137711');
        const admin = await loginAdmin();
        await createApprovedSubscriptionForTest({ baseUrl, headers, adminHeaders: admin.headers, planId: 'sub_29_daily_19_usd' });
        const active = await jsonFetch(`${baseUrl}/api/internal/api-keys/status`, {
            method: 'POST',
            headers: internalHeaders(),
            body: JSON.stringify({ api_key_hash: hashApiKeyForTest(apiKey) })
        });
        assert.equal(active.body.active, true);
        assert.equal(active.body.dailyQuotaUsdMicros, 19000000);
        assert.equal(active.body.remainingUsdMicros, 19000000);

        db.prepare(`
INSERT INTO api_usd_charge_records (id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens, cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens, official_price_version, charge_usd_micros, quota_before_usd_micros, quota_after_usd_micros, quota_date, status, created_at)
VALUES ('CHARGE-USD-EMPTY', '13800137711', 'req-empty', ?, 'gpt-5.5', 0, 0, 0, 0, 0, 0, 'test', 19000000, 19000000, 0, '2026-06-16', 'charged', '2026-06-16T16:31:00+08:00')
`).run(hashApiKeyForTest(apiKey));
        const empty = await jsonFetch(`${baseUrl}/api/internal/api-keys/status`, {
            method: 'POST',
            headers: internalHeaders(),
            body: JSON.stringify({ api_key_hash: hashApiKeyForTest(apiKey) })
        });
        assert.equal(empty.response.status, 401);
        assert.equal(empty.body.code, 'daily_quota_exhausted');
    }, { now: () => '2026-06-16T16:30:00+08:00' });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test test/shop-flow.test.js --test-name-pattern "今日美元额度"
```

Expected: FAIL，状态接口仍使用人民币余额。

- [ ] **Step 3: 实现额度函数和状态替换**

In `server.js`, implement `accountDailyQuotaStatus(phone, date = new Date(nowIso()))`:

```js
function accountDailyQuotaStatus(phone, date = new Date(nowIso())) {
    const quotaDate = chinaDateKey(date);
    const subscription = getActiveSubscriptionWithPlanByPhone.get(phone, nowIso(), nowIso());
    if (!subscription) {
        return { active: false, code: 'subscription_required', quotaDate, dailyQuotaUsdMicros: 0, addonQuotaUsdMicros: 0, usedUsdMicros: 0, remainingUsdMicros: 0 };
    }
    const addon = getApprovedAddonQuotaByPhoneAndDate.get(phone, quotaDate);
    const used = getUsdChargeTotalByPhoneAndDate.get(phone, quotaDate);
    const dailyQuotaUsdMicros = Number(subscription.daily_quota_usd_micros || 0);
    const addonQuotaUsdMicros = Number(addon?.quota_usd_micros || 0);
    const usedUsdMicros = Number(used?.charge_usd_micros || 0);
    const remainingUsdMicros = dailyQuotaUsdMicros + addonQuotaUsdMicros - usedUsdMicros;
    return {
        active: remainingUsdMicros > 0,
        code: remainingUsdMicros > 0 ? 'active' : 'daily_quota_exhausted',
        phone,
        planId: subscription.plan_id,
        planName: subscription.plan_name,
        quotaDate,
        dailyQuotaUsdMicros,
        addonQuotaUsdMicros,
        usedUsdMicros,
        remainingUsdMicros,
        expiresAt: subscription.expires_at
    };
}
```

Replace internal API key status balance check with quota check. If no subscription, return `subscription_required`; if `remainingUsdMicros <= 0`, return `daily_quota_exhausted`.

- [ ] **Step 4: 运行测试确认通过并提交**

```bash
node --test test/shop-flow.test.js --test-name-pattern "今日美元额度"
git add server.js test/shop-flow.test.js
git commit -m "feat: gate api keys by daily USD quota"
```

---

### Task 5: usage 入库后扣美元额度

**Files:**
- Modify: `server.js`
- Modify: `lib/shop-charge-audit-log.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试**

Append to `test/shop-flow.test.js`:

```js
test('usage event 按官方美元价格扣今日额度且不扣人民币余额', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const { apiKey, headers } = await redeemManagedApiKeyForTest(baseUrl, '13800137721');
        const admin = await loginAdmin();
        await createApprovedSubscriptionForTest({ baseUrl, headers, adminHeaders: admin.headers, planId: 'sub_29_daily_19_usd' });
        const event = {
            request_id: 'req-usd-charge',
            api_key_hash: hashApiKeyForTest(apiKey),
            api_key_preview: 'sk-yui...usd',
            provider: 'codex',
            model: 'gpt-5.5',
            success: true,
            failed: false,
            input_tokens: 200000,
            cached_tokens: 100000,
            cache_hit_input_tokens: 100000,
            cache_miss_input_tokens: 100000,
            output_tokens: 10000,
            reasoning_tokens: 0,
            total_tokens: 210000,
            requested_at: '2026-06-16T18:00:00+08:00'
        };
        const received = await usageEventFetch(baseUrl, event);
        assert.equal(received.response.status, 201);
        const usdCharge = db.prepare('SELECT charge_usd_micros, quota_before_usd_micros, quota_after_usd_micros, official_price_version FROM api_usd_charge_records WHERE usage_event_id = ?').get('req-usd-charge');
        assert.deepEqual(usdCharge, {
            charge_usd_micros: 850000,
            quota_before_usd_micros: 19000000,
            quota_after_usd_micros: 18150000,
            official_price_version: 'openai-gpt-5.5-usd-20260616'
        });
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM api_charge_records WHERE usage_event_id = ?').get('req-usd-charge').count, 0);
        assert.equal(db.prepare('SELECT balance_nanos FROM account_balances WHERE phone = ?').get('13800137721').balance_nanos, 0);
    }, { now: () => '2026-06-16T18:00:00+08:00' });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test test/shop-flow.test.js --test-name-pattern "官方美元价格扣今日额度"
```

Expected: FAIL，当前代码写入人民币扣费记录。

- [ ] **Step 3: 替换扣费事务**

In `server.js`, import `priceOfficialUsageUsd` and update `chargeUsageEventInCurrentTransaction(event)`:

- 幂等查询改为 `api_usd_charge_records`。
- owner 仍通过 `getPhoneByUsageApiKeyHash` 查手机号。
- `quotaBeforeUsdMicros` 使用 `accountDailyQuotaStatus(owner.phone, new Date(event.requestedAt || nowIso())).remainingUsdMicros`。
- `pricing` 使用 `priceOfficialUsageUsd(event)`。
- 插入 `api_usd_charge_records`。
- 正数扣费时插入 `account_quota_ledger_entries`，不更新 `account_balances`。
- 审计日志写 `chargeUsdMicros`、`quotaBeforeUsdMicros`、`quotaAfterUsdMicros`、`quotaDate`。

- [ ] **Step 4: 审计日志兼容美元字段**

Modify `lib/shop-charge-audit-log.js` normalized record:

```js
chargeUsdMicros: normalizeInteger(record.chargeUsdMicros ?? record.charge_usd_micros),
quotaBeforeUsdMicros: normalizeInteger(record.quotaBeforeUsdMicros ?? record.quota_before_usd_micros),
quotaAfterUsdMicros: normalizeInteger(record.quotaAfterUsdMicros ?? record.quota_after_usd_micros),
quotaDate: String(record.quotaDate || record.quota_date || ''),
```

- [ ] **Step 5: 运行测试确认通过并提交**

```bash
node --test test/shop-flow.test.js --test-name-pattern "官方美元价格扣今日额度"
git add server.js lib/shop-charge-audit-log.js test/shop-flow.test.js
git commit -m "feat: charge usage against USD quota"
```

---

### Task 6: Account 和 Admin 展示订阅池

**Files:**
- Modify: `server.js`
- Modify: `shop/js/core.js`
- Modify: `shop/js/account.js`
- Modify: `shop/account/index.html`
- Modify: `shop/js/admin.js`
- Modify: `shop/admin/index.html`
- Modify: `test/shop-flow.test.js`
- Modify: `test/shop-frontend.test.js`

- [ ] **Step 1: 写接口失败测试**

Append to `test/shop-flow.test.js`:

```js
test('Account 和 Admin 返回订阅池状态', async () => {
    await withServer(async ({ baseUrl }) => {
        const user = await registerAndLogin(baseUrl, '13800137731');
        const admin = await loginAdmin();
        await createApprovedSubscriptionForTest({ baseUrl, headers: user.headers, adminHeaders: admin.headers, planId: 'sub_59_daily_49_usd' });

        const quota = await jsonFetch(`${baseUrl}/api/account/quota`, { headers: user.headers });
        assert.equal(quota.body.subscription.planId, 'sub_59_daily_49_usd');
        assert.equal(quota.body.quota.dailyQuotaUsdMicros, 49000000);

        const adminSummary = await jsonFetch(`${baseUrl}/api/admin/subscription-pool-summary`, { headers: admin.headers });
        assert.equal(adminSummary.body.summary.activeSubscriptionCount, 1);
        assert.equal(adminSummary.body.summary.todayQuotaUsdMicros, 49000000);
    }, { now: () => '2026-06-16T20:00:00+08:00' });
});
```

- [ ] **Step 2: 写前端失败测试**

Append to `test/shop-frontend.test.js`:

```js
test('Account 和 Admin 页面包含订阅池容器', () => {
    const accountHtml = fs.readFileSync(path.join(projectRoot, 'shop/account/index.html'), 'utf8');
    assert.match(accountHtml, /id="accountQuotaCards"/);
    assert.match(accountHtml, /id="subscriptionOrderForm"/);
    assert.match(accountHtml, /id="quotaAddonForm"/);
    assert.doesNotMatch(accountHtml, />充值</);

    const adminHtml = fs.readFileSync(path.join(projectRoot, 'shop/admin/index.html'), 'utf8');
    assert.match(adminHtml, /id="adminSubscriptionOrders"/);
    assert.match(adminHtml, /id="adminQuotaAddons"/);
    assert.match(adminHtml, /id="adminSubscriptionPoolSummary"/);
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池状态"
node --test test/shop-frontend.test.js --test-name-pattern "订阅池容器"
```

Expected: FAIL，缺少接口和容器。

- [ ] **Step 4: 增加 API**

Add routes:

```js
app.get('/api/account/quota', limitQueryApi, requireAccount, ...);
app.get('/api/account/subscription-plans', limitQueryApi, requireAccount, ...);
app.get('/api/admin/subscription-pool-summary', limitAdminApi, requireAdminUsageAccess, ...);
app.get('/api/admin/subscription-orders', limitAdminApi, requireAdminUsageAccess, ...);
```

Account quota 返回当前订阅、今日额度、最近美元扣费、美元额度流水。Admin summary 返回有效订阅用户数、今日总额度、今日已用美元额度、额度用尽用户数和用户列表。

- [ ] **Step 5: 更新前端**

In `shop/js/core.js`, export:

```js
function formatUsdMicros(value) {
    const amount = Number(value || 0) / 1000000;
    if (!Number.isFinite(amount)) return '$0.00';
    return `$${amount.toFixed(2)}`;
}
```

Update Account:

- `accountQuotaCards` 展示套餐、今日剩余额度、基础/加量额度。
- `subscriptionOrderForm` 提交 `/api/account/subscription-orders`。
- `quotaAddonForm` 提交 `/api/account/quota-addons`。
- API 扣费流水金额用美元展示。

Update Admin:

- `adminSubscriptionOrders` 展示订阅申请。
- `adminQuotaAddons` 展示加量包申请。
- `adminSubscriptionPoolSummary` 展示订阅用户、今日额度、今日已用、额度用尽。
- 审核按钮调用 `/api/admin/subscription-orders/:id/approve` 和 `/api/admin/quota-addons/:id/approve`。

- [ ] **Step 6: 运行测试确认通过并提交**

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池状态"
node --test test/shop-frontend.test.js --test-name-pattern "订阅池容器"
git add server.js shop/js/core.js shop/js/account.js shop/account/index.html shop/js/admin.js shop/admin/index.html test/shop-flow.test.js test/shop-frontend.test.js
git commit -m "feat: show subscription pool billing"
```

---

### Task 7: 模型总览、CSS 和全量验证

**Files:**
- Modify: `lib/shop-model-overview.js`
- Modify: `lib/shop-model-overview.test.js`
- Modify: `styles/tailwind.css`
- Modify: `styles/site.css`
- Modify: `AGENTS.md`

- [ ] **Step 1: 写模型总览失败测试**

Modify `lib/shop-model-overview.test.js`:

```js
test('模型价格总览展示官方美元价格', () => {
    assert.deepEqual(modelPriceOverview('GPT-5.5', true), {
        id: 'GPT-5.5',
        available: true,
        priceModel: 'gpt-5.5',
        usesDefaultPrice: false,
        priceVersion: 'openai-gpt-5.5-usd-20260616',
        cacheHitInputUsdPerMillion: 0.5,
        cacheMissInputUsdPerMillion: 5,
        outputUsdPerMillion: 30
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test lib/shop-model-overview.test.js
```

Expected: FAIL，当前返回人民币字段。

- [ ] **Step 3: 修改模型总览**

In `lib/shop-model-overview.js`, use `officialGptUsdPrices` and return `cacheHitInputUsdPerMillion`、`cacheMissInputUsdPerMillion`、`outputUsdPerMillion`。

- [ ] **Step 4: 更新 CSS 并构建**

Add to `styles/tailwind.css`:

```css
.quota-progress-track {
  @apply h-2 w-full overflow-hidden rounded-sm bg-background-soft dark:bg-dark-surface;
}

.quota-progress-bar {
  @apply h-full bg-primary dark:bg-dark-text;
}
```

Run:

```bash
npm run build:css
```

Expected: `styles/site.css` 更新成功。

- [ ] **Step 5: 全量验证并提交**

```bash
npm test
git add lib/shop-model-overview.js lib/shop-model-overview.test.js styles/tailwind.css styles/site.css AGENTS.md
git commit -m "feat: switch model overview to USD billing"
```

Expected: PASS，所有测试通过。

---

## Self-Review

- Spec coverage：方案 B、独立美元额度账本、东八区 0 点刷新、不结转、三档套餐、三档均可使用 `gpt-5.4` 和 `gpt-5.5`、官方价格快照、加量包、Account/Admin 展示、内部 key 放行、usage 美元扣费均有任务覆盖。
- Simplicity check：实现只保留用户截图中的单一计价表，不区分长短上下文，不引入 Batch / Flex / Priority。
- Placeholder scan：本文未使用占位语句，任务均包含具体文件、命令和目标代码片段。
- Type consistency：美元金额统一使用 `usd_micros` / camelCase `UsdMicros`；官方价格版本统一使用 `official_price_version` / `officialPriceVersion`；日期统一使用 `quota_date` / `quotaDate`。
