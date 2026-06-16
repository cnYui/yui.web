# Subscription Pool USD Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Shop 从人民币按量余额扣费改为订阅池美元额度扣费：29/39/59 元月费分别提供每日 19/29/49 美元额度，东八区 0 点刷新，不结转，三个套餐都可用 `gpt-5.4` 和 `gpt-5.5`。

**Architecture:** 新增独立美元价格模块、订阅/加量包/美元扣费账本表；新 usage 只扣美元额度，不再扣 `account_balances.balance_nanos`。旧人民币余额、旧 `api_charge_records` 和旧 ledger 保留为历史兼容，不作为订阅池运行态的扣费事实。

**Tech Stack:** Node.js、Express、better-sqlite3、原生前端模块、`node --test`、Tailwind 构建 CSS。

---

## 文件结构

- Create: `lib/shop-usd-money.js`
  - 负责 USD micros 常量、美元展示、美元金额解析、整数向上取整扣费。
- Create: `lib/shop-official-gpt-pricing.js`
  - 负责 `gpt-5.4` / `gpt-5.5` 官方 Standard 美元价格、短/长上下文判定、usage 美元计价。
- Create: `lib/shop-official-gpt-pricing.test.js`
  - 覆盖官方美元价格、缓存命中输入、未命中输入、输出、失败事件、长上下文。
- Modify: `server.js`
  - 新增订阅池表、查询语句、公开序列化函数、订阅/加量包申请与审核、内部 API key 状态、usage 美元扣费、Account/Admin API。
- Modify: `test/shop-flow.test.js`
  - 覆盖数据库 schema、订阅套餐、加量包、额度刷新、API key 放行、美元扣费、Account/Admin API。
- Modify: `lib/shop-model-overview.js`
  - 模型总览从人民币价格切换为官方美元价格。
- Modify: `lib/shop-model-overview.test.js`
  - 更新模型价格断言。
- Modify: `lib/shop-billing-summary.js`
  - 保留旧人民币历史 summary，同时新增订阅池美元 summary helper。
- Modify: `lib/shop-billing-summary.test.js`
  - 覆盖新美元 summary 不污染旧人民币 summary。
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
- Modify: `shop/js/charts.js`
  - 收银图表保留人民币收入；新增美元消耗图表或改名避免把美元消耗叫收银。
- Modify: `styles/tailwind.css` 和生成的 `styles/site.css`
  - 为订阅池额度条和 Admin 美元面板补必要组件类。
- Modify: `AGENTS.md`
  - 记录美元订阅池已实施后的长期协作记忆。

---

## 测试 Helper 约定

在 `test/shop-flow.test.js` 顶部现有 helper 附近新增以下 helper；后续任务测试都使用这些函数。

```js
async function registerAndLogin(baseUrl, phone, password = 'Abcdefg1') {
    const cookie = await registerUserAndGetCookie(baseUrl, phone, password);
    return { cookie, headers: { cookie } };
}

async function loginAdmin(baseUrl, password = 'Abcdefg1') {
    return {
        headers: {
            'x-admin-token': 'test-token'
        },
        password
    };
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

When writing new tests, use existing `withServer(async ({ baseUrl, db }) => { ... }, appOptions)` style. `jsonFetch` returns `{ response, body }`, so assertions must read `result.response.status`.

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
    deriveContextTier,
    formatUsdMicros,
    priceOfficialUsageUsd,
    usdMicrosToUsd
} = require('./shop-official-gpt-pricing');

test('gpt-5.4 短上下文按官方 Standard 美元价格扣费', () => {
    assert.deepEqual(priceOfficialUsageUsd({
        model: 'gpt-5.4',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000,
        inputTokens: 200000
    }), {
        chargeUsdMicros: 17750000,
        status: 'charged',
        officialPriceVersion: 'openai-gpt-5.4-usd-20260616-standard-short',
        contextTier: 'short',
        serviceTier: 'standard'
    });
});

test('gpt-5.5 短上下文按官方 Standard 美元价格扣费', () => {
    assert.deepEqual(priceOfficialUsageUsd({
        model: 'gpt-5.5',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000,
        inputTokens: 200000
    }), {
        chargeUsdMicros: 35500000,
        status: 'charged',
        officialPriceVersion: 'openai-gpt-5.5-usd-20260616-standard-short',
        contextTier: 'short',
        serviceTier: 'standard'
    });
});

test('超过 272K 输入 token 使用长上下文价格', () => {
    assert.equal(deriveContextTier({ inputTokens: 272000 }), 'short');
    assert.equal(deriveContextTier({ inputTokens: 272001 }), 'long');
    assert.deepEqual(priceOfficialUsageUsd({
        model: 'gpt-5.4',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000,
        inputTokens: 272001
    }), {
        chargeUsdMicros: 28000000,
        status: 'charged',
        officialPriceVersion: 'openai-gpt-5.4-usd-20260616-standard-long',
        contextTier: 'long',
        serviceTier: 'standard'
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
        officialPriceVersion: 'failed-no-charge',
        contextTier: 'short',
        serviceTier: 'standard'
    });
});

test('美元 micros 展示为美元金额', () => {
    assert.equal(usdMicrosToUsd(35500000), 35.5);
    assert.equal(formatUsdMicros(35500000), '$35.50');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test lib/shop-official-gpt-pricing.test.js
```

Expected: FAIL，错误为找不到 `./shop-official-gpt-pricing`。

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
    const amount = usdMicrosToUsd(usdMicros);
    return `$${amount.toFixed(2)}`;
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

const contextTierThresholdTokens = 272000;
const defaultServiceTier = 'standard';
const defaultOfficialModel = 'gpt-5.4';

const officialGptUsdPrices = Object.freeze({
    'gpt-5.4': Object.freeze({
        short: Object.freeze({
            model: 'gpt-5.4',
            serviceTier: 'standard',
            contextTier: 'short',
            version: 'openai-gpt-5.4-usd-20260616-standard-short',
            cacheHitInputUsdMicrosPerMillionTokens: 250000,
            cacheMissInputUsdMicrosPerMillionTokens: 2500000,
            outputUsdMicrosPerMillionTokens: 15000000
        }),
        long: Object.freeze({
            model: 'gpt-5.4',
            serviceTier: 'standard',
            contextTier: 'long',
            version: 'openai-gpt-5.4-usd-20260616-standard-long',
            cacheHitInputUsdMicrosPerMillionTokens: 500000,
            cacheMissInputUsdMicrosPerMillionTokens: 5000000,
            outputUsdMicrosPerMillionTokens: 22500000
        })
    }),
    'gpt-5.5': Object.freeze({
        short: Object.freeze({
            model: 'gpt-5.5',
            serviceTier: 'standard',
            contextTier: 'short',
            version: 'openai-gpt-5.5-usd-20260616-standard-short',
            cacheHitInputUsdMicrosPerMillionTokens: 500000,
            cacheMissInputUsdMicrosPerMillionTokens: 5000000,
            outputUsdMicrosPerMillionTokens: 30000000
        }),
        long: Object.freeze({
            model: 'gpt-5.5',
            serviceTier: 'standard',
            contextTier: 'long',
            version: 'openai-gpt-5.5-usd-20260616-standard-long',
            cacheHitInputUsdMicrosPerMillionTokens: 1000000,
            cacheMissInputUsdMicrosPerMillionTokens: 10000000,
            outputUsdMicrosPerMillionTokens: 45000000
        })
    })
});

function normalizeOfficialModel(model) {
    const normalized = String(model || '').trim().toLowerCase();
    return officialGptUsdPrices[normalized] ? normalized : defaultOfficialModel;
}

function deriveContextTier(event = {}) {
    const explicit = String(event.contextTier || event.context_tier || '').trim().toLowerCase();
    if (explicit === 'long' || explicit === 'short') return explicit;
    return nonNegativeInteger(event.inputTokens ?? event.input_tokens) > contextTierThresholdTokens ? 'long' : 'short';
}

function officialPriceForUsage(event = {}) {
    const model = normalizeOfficialModel(event.model);
    const contextTier = deriveContextTier(event);
    return officialGptUsdPrices[model][contextTier];
}

function priceOfficialUsageUsd(event = {}) {
    const contextTier = deriveContextTier(event);
    if (event.failed) {
        return {
            chargeUsdMicros: 0,
            status: 'failed_no_charge',
            officialPriceVersion: 'failed-no-charge',
            contextTier,
            serviceTier: defaultServiceTier
        };
    }
    const price = officialPriceForUsage(event);
    const chargeUsdMicros =
        priceTokensToUsdMicros(event.cacheHitInputTokens ?? event.cache_hit_input_tokens, price.cacheHitInputUsdMicrosPerMillionTokens) +
        priceTokensToUsdMicros(event.cacheMissInputTokens ?? event.cache_miss_input_tokens, price.cacheMissInputUsdMicrosPerMillionTokens) +
        priceTokensToUsdMicros(event.outputTokens ?? event.output_tokens, price.outputUsdMicrosPerMillionTokens);
    return {
        chargeUsdMicros,
        status: chargeUsdMicros > 0 ? 'charged' : 'unpriced_no_charge',
        officialPriceVersion: price.version,
        contextTier: price.contextTier,
        serviceTier: price.serviceTier
    };
}

module.exports = {
    contextTierThresholdTokens,
    defaultOfficialModel,
    deriveContextTier,
    formatUsdMicros,
    officialGptUsdPrices,
    priceOfficialUsageUsd,
    usdMicrosToUsd
};
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
node --test lib/shop-official-gpt-pricing.test.js
```

Expected: PASS，5 个测试通过。

- [ ] **Step 6: 提交**

```bash
git add lib/shop-usd-money.js lib/shop-official-gpt-pricing.js lib/shop-official-gpt-pricing.test.js
git commit -m "feat: add official GPT USD pricing"
```

---

### Task 2: 订阅池数据库 schema 与种子套餐

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
AND name IN ('subscription_plans', 'account_subscriptions', 'quota_addon_packages', 'account_quota_addons', 'api_usd_charge_records', 'account_quota_ledger_entries')
ORDER BY name
`).all().map((row) => row.name);
        assert.deepEqual(tables, [
            'account_quota_addons',
            'account_quota_ledger_entries',
            'account_subscriptions',
            'api_usd_charge_records',
            'quota_addon_packages',
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

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池美元额度表"
```

Expected: FAIL，缺少 `subscription_plans` 等表。

- [ ] **Step 3: 在 `initializeShopDatabase` 增加 schema**

Modify `server.js` inside the database initialization block after `api_charge_records`:

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

CREATE TABLE IF NOT EXISTS quota_addon_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  quota_usd_micros INTEGER NOT NULL,
  validity_scope TEXT NOT NULL CHECK (validity_scope IN ('same_day')),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_quota_addons (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  package_id TEXT NOT NULL,
  quota_date TEXT NOT NULL,
  quota_usd_micros INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  confirmed_by_phone TEXT,
  admin_note TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone),
  FOREIGN KEY (package_id) REFERENCES quota_addon_packages(id)
);

CREATE INDEX IF NOT EXISTS idx_account_quota_addons_phone_date
ON account_quota_addons(phone, quota_date);

CREATE TABLE IF NOT EXISTS api_usd_charge_records (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  usage_event_id TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  service_tier TEXT NOT NULL DEFAULT 'standard',
  context_tier TEXT NOT NULL CHECK (context_tier IN ('short', 'long')),
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

CREATE INDEX IF NOT EXISTS idx_account_quota_ledger_phone_date
ON account_quota_ledger_entries(phone, quota_date, created_at);
```

- [ ] **Step 4: 增加默认套餐种子**

Modify `server.js` after schema creation:

```js
const seedSubscriptionPlans = db.prepare(`
INSERT INTO subscription_plans (id, name, monthly_price_cents, daily_quota_usd_micros, period_days, status, created_at, updated_at)
VALUES (@id, @name, @monthlyPriceCents, @dailyQuotaUsdMicros, 30, 'active', @now, @now)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  daily_quota_usd_micros = excluded.daily_quota_usd_micros,
  period_days = excluded.period_days,
  status = excluded.status,
  updated_at = excluded.updated_at
`);

const seedQuotaAddonPackages = db.prepare(`
INSERT INTO quota_addon_packages (id, name, price_cents, quota_usd_micros, validity_scope, status, created_at, updated_at)
VALUES (@id, @name, @priceCents, @quotaUsdMicros, 'same_day', 'active', @now, @now)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  price_cents = excluded.price_cents,
  quota_usd_micros = excluded.quota_usd_micros,
  validity_scope = excluded.validity_scope,
  status = excluded.status,
  updated_at = excluded.updated_at
`);

const seededAt = nowIso();
[
    ['sub_29_daily_19_usd', '29 元订阅池', 2900, 19000000],
    ['sub_39_daily_29_usd', '39 元订阅池', 3900, 29000000],
    ['sub_59_daily_49_usd', '59 元订阅池', 5900, 49000000]
].forEach(([id, name, monthlyPriceCents, dailyQuotaUsdMicros]) => {
    seedSubscriptionPlans.run({ id, name, monthlyPriceCents, dailyQuotaUsdMicros, now: seededAt });
});
[
    ['addon_5_usd_daily', '5 美元当日加量包', 500, 5000000],
    ['addon_10_usd_daily', '10 美元当日加量包', 1000, 10000000],
    ['addon_20_usd_daily', '20 美元当日加量包', 2000, 20000000],
    ['addon_50_usd_daily', '50 美元当日加量包', 5000, 50000000]
].forEach(([id, name, priceCents, quotaUsdMicros]) => {
    seedQuotaAddonPackages.run({ id, name, priceCents, quotaUsdMicros, now: seededAt });
});
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池美元额度表"
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
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
        const admin = await loginAdmin(baseUrl);
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

test('用户可提交当日加量包申请，管理员确认后增加今日额度', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const user = await registerAndLogin(baseUrl, '13800137702');
        const admin = await loginAdmin(baseUrl);
        await createApprovedSubscriptionForTest({ baseUrl, headers: user.headers, adminHeaders: admin.headers, planId: 'sub_29_daily_19_usd' });
        const created = await jsonFetch(`${baseUrl}/api/account/quota-addons`, {
            method: 'POST',
            headers: user.headers,
            body: JSON.stringify({ packageId: 'addon_5_usd_daily', paymentMethod: 'alipay', paymentNote: 'ali-yui' })
        });
        assert.equal(created.response.status, 201);
        const approved = await jsonFetch(`${baseUrl}/api/admin/quota-addons/${created.body.addon.id}/approve`, {
            method: 'POST',
            headers: admin.headers,
            body: JSON.stringify({ adminNote: 'ok' })
        });
        assert.equal(approved.body.addon.quotaUsdMicros, 5000000);
        const row = db.prepare('SELECT status, quota_usd_micros FROM account_quota_addons WHERE id = ?').get(created.body.addon.id);
        assert.deepEqual(row, { status: 'approved', quota_usd_micros: 5000000 });
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅申请|加量包申请"
```

Expected: FAIL，接口返回 404。

- [ ] **Step 3: 增加订单表**

Add table to `server.js` schema:

```js
CREATE TABLE IF NOT EXISTS subscription_orders (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('subscription', 'quota_addon')),
  plan_id TEXT,
  package_id TEXT,
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

CREATE INDEX IF NOT EXISTS idx_subscription_orders_phone_created
ON subscription_orders(phone, created_at);

CREATE INDEX IF NOT EXISTS idx_subscription_orders_status_created
ON subscription_orders(status, created_at);
```

- [ ] **Step 4: 增加服务函数**

Add functions near existing `createTopupRequest`:

```js
function createSubscriptionOrder({ phone, planId, paymentMethod, paymentNote }) {
    const plan = getSubscriptionPlanById.get(planId);
    if (!plan || plan.status !== 'active') {
        const error = new Error('套餐不存在或不可用。');
        error.status = 400;
        error.code = 'INVALID_PLAN';
        throw error;
    }
    return insertSubscriptionOrder.get({
        id: createId('SUBORDER'),
        phone,
        orderType: 'subscription',
        planId: plan.id,
        packageId: '',
        amountCents: plan.monthly_price_cents,
        quotaUsdMicros: plan.daily_quota_usd_micros,
        paymentMethod: normalizePaymentMethod(paymentMethod),
        paymentNote: String(paymentNote || '').trim().slice(0, 500),
        status: 'pending',
        createdAt: nowIso()
    });
}

function createQuotaAddonOrder({ phone, packageId, paymentMethod, paymentNote }) {
    const addonPackage = getQuotaAddonPackageById.get(packageId);
    if (!addonPackage || addonPackage.status !== 'active') {
        const error = new Error('加量包不存在或不可用。');
        error.status = 400;
        error.code = 'INVALID_ADDON_PACKAGE';
        throw error;
    }
    return insertSubscriptionOrder.get({
        id: createId('ADDONORDER'),
        phone,
        orderType: 'quota_addon',
        planId: '',
        packageId: addonPackage.id,
        amountCents: addonPackage.price_cents,
        quotaUsdMicros: addonPackage.quota_usd_micros,
        paymentMethod: normalizePaymentMethod(paymentMethod),
        paymentNote: String(paymentNote || '').trim().slice(0, 500),
        status: 'pending',
        createdAt: nowIso()
    });
}
```

Add approval transactions:

```js
const approveSubscriptionOrder = db.transaction(({ id, adminPhone, adminNote }) => {
    const order = getSubscriptionOrderById.get(id);
    if (!order || order.status !== 'pending' || order.order_type !== 'subscription') {
        const error = new Error('订阅申请不存在或已处理。');
        error.status = 404;
        error.code = 'SUBSCRIPTION_ORDER_NOT_PENDING';
        throw error;
    }
    const now = nowIso();
    cancelActiveSubscriptionsByPhone.run(now, order.phone);
    const subscription = {
        id: createId('SUB'),
        phone: order.phone,
        planId: order.plan_id,
        status: 'active',
        startedAt: now,
        expiresAt: addDaysIso(now, 30),
        createdAt: now,
        updatedAt: now
    };
    insertAccountSubscription.run(subscription);
    approveSubscriptionOrderById.run(now, adminPhone, String(adminNote || '').trim().slice(0, 500), id);
    return { order: getSubscriptionOrderById.get(id), subscription: getActiveSubscriptionByPhone.get(order.phone) };
});

const approveQuotaAddonOrder = db.transaction(({ id, adminPhone, adminNote }) => {
    const order = getSubscriptionOrderById.get(id);
    if (!order || order.status !== 'pending' || order.order_type !== 'quota_addon') {
        const error = new Error('加量包申请不存在或已处理。');
        error.status = 404;
        error.code = 'ADDON_ORDER_NOT_PENDING';
        throw error;
    }
    const now = nowIso();
    const quotaDate = chinaDateKey(new Date(now));
    const addon = {
        id: createId('ADDON'),
        phone: order.phone,
        packageId: order.package_id,
        quotaDate,
        quotaUsdMicros: order.quota_usd_micros,
        priceCents: order.amount_cents,
        status: 'approved',
        createdAt: order.created_at,
        confirmedAt: now,
        confirmedByPhone: adminPhone,
        adminNote: String(adminNote || '').trim().slice(0, 500)
    };
    insertAccountQuotaAddon.run(addon);
    approveSubscriptionOrderById.run(now, adminPhone, addon.adminNote, id);
    return { order: getSubscriptionOrderById.get(id), addon };
});
```

Use existing `chinaDateKey` from `lib/shop-billing-summary.js` if already imported; otherwise export/import it instead of duplicating date math.

- [ ] **Step 5: 增加接口**

Add routes:

```js
app.post('/api/account/subscription-orders', limitQueryApi, requireSameOrigin, requireAccount, requireAccountCsrf, (req, res) => {
    try {
        const order = createSubscriptionOrder({
            phone: req.account.phone,
            planId: req.body.planId,
            paymentMethod: req.body.paymentMethod,
            paymentNote: req.body.paymentNote
        });
        return res.status(201).json({ order: publicSubscriptionOrder(order) });
    } catch (error) {
        return res.status(error.status || 500).json({ code: error.code || 'SUBSCRIPTION_ORDER_FAILED', message: error.message || '订阅申请提交失败。' });
    }
});

app.post('/api/account/quota-addons', limitQueryApi, requireSameOrigin, requireAccount, requireAccountCsrf, (req, res) => {
    try {
        const order = createQuotaAddonOrder({
            phone: req.account.phone,
            packageId: req.body.packageId,
            paymentMethod: req.body.paymentMethod,
            paymentNote: req.body.paymentNote
        });
        return res.status(201).json({ addon: publicSubscriptionOrder(order) });
    } catch (error) {
        return res.status(error.status || 500).json({ code: error.code || 'QUOTA_ADDON_FAILED', message: error.message || '加量包申请提交失败。' });
    }
});

app.post('/api/admin/subscription-orders/:id/approve', limitAdminApi, requireSameOrigin, requireAdminUsageAccess, requireAccountCsrf, (req, res) => {
    try {
        const result = approveSubscriptionOrder({ id: req.params.id, adminPhone: req.account?.phone || defaultAdminAccountPhone, adminNote: req.body.adminNote });
        return res.json({ order: publicSubscriptionOrder(result.order), subscription: publicAccountSubscription(result.subscription) });
    } catch (error) {
        return res.status(error.status || 500).json({ code: error.code || 'SUBSCRIPTION_APPROVE_FAILED', message: error.message || '订阅确认失败。' });
    }
});

app.post('/api/admin/quota-addons/:id/approve', limitAdminApi, requireSameOrigin, requireAdminUsageAccess, requireAccountCsrf, (req, res) => {
    try {
        const result = approveQuotaAddonOrder({ id: req.params.id, adminPhone: req.account?.phone || defaultAdminAccountPhone, adminNote: req.body.adminNote });
        return res.json({ order: publicSubscriptionOrder(result.order), addon: publicAccountQuotaAddon(result.addon) });
    } catch (error) {
        return res.status(error.status || 500).json({ code: error.code || 'ADDON_APPROVE_FAILED', message: error.message || '加量包确认失败。' });
    }
});
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅申请|加量包申请"
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
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
        const admin = await loginAdmin(baseUrl);
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
INSERT INTO api_usd_charge_records (id, phone, usage_event_id, api_key_hash, model, service_tier, context_tier, input_tokens, output_tokens, cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens, official_price_version, charge_usd_micros, quota_before_usd_micros, quota_after_usd_micros, quota_date, status, created_at)
VALUES ('CHARGE-USD-EMPTY', '13800137711', 'req-empty', ?, 'gpt-5.5', 'standard', 'short', 0, 0, 0, 0, 0, 0, 'test', 19000000, 19000000, 0, '2026-06-16', 'charged', '2026-06-16T16:31:00+08:00')
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

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "今日美元额度"
```

Expected: FAIL，状态接口仍使用人民币余额。

- [ ] **Step 3: 增加额度计算函数**

Add to `server.js`:

```js
function accountDailyQuotaStatus(phone, date = new Date(nowIso())) {
    const quotaDate = chinaDateKey(date);
    const subscription = getActiveSubscriptionWithPlanByPhone.get(phone, nowIso());
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

Queries:

```js
const getActiveSubscriptionWithPlanByPhone = db.prepare(`
SELECT s.id, s.phone, s.plan_id, s.status, s.started_at, s.expires_at,
       p.name AS plan_name, p.monthly_price_cents, p.daily_quota_usd_micros
FROM account_subscriptions s
JOIN subscription_plans p ON p.id = s.plan_id
WHERE s.phone = ?
  AND s.status = 'active'
  AND s.started_at <= ?
  AND s.expires_at > ?
LIMIT 1
`);

const getApprovedAddonQuotaByPhoneAndDate = db.prepare(`
SELECT COALESCE(SUM(quota_usd_micros), 0) AS quota_usd_micros
FROM account_quota_addons
WHERE phone = ? AND quota_date = ? AND status = 'approved'
`);

const getUsdChargeTotalByPhoneAndDate = db.prepare(`
SELECT COALESCE(SUM(charge_usd_micros), 0) AS charge_usd_micros
FROM api_usd_charge_records
WHERE phone = ? AND quota_date = ? AND status = 'charged'
`);
```

- [ ] **Step 4: 替换内部 API key 状态逻辑**

Find the internal key status response builder and replace balance check with:

```js
const quota = accountDailyQuotaStatus(order.phone);
if (!quota.active) {
    return {
        active: false,
        status: quota.code,
        code: quota.code,
        message: quota.code === 'subscription_required' ? '账号未开通订阅。' : '今日额度已用完，请明天再试或购买加量包。',
        apiKeyPreview: order.api_key_preview,
        phone: order.phone,
        quota
    };
}
return {
    active: true,
    status: 'active',
    apiKeyPreview: order.api_key_preview,
    phone: order.phone,
    quota,
    dailyQuotaUsdMicros: quota.dailyQuotaUsdMicros,
    addonQuotaUsdMicros: quota.addonQuotaUsdMicros,
    usedUsdMicros: quota.usedUsdMicros,
    remainingUsdMicros: quota.remainingUsdMicros,
    quotaDate: quota.quotaDate
};
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "今日美元额度"
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
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
        const admin = await loginAdmin(baseUrl);
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
            official_price_version: 'openai-gpt-5.5-usd-20260616-standard-short'
        });
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM api_charge_records WHERE usage_event_id = ?').get('req-usd-charge').count, 0);
        assert.equal(db.prepare('SELECT balance_nanos FROM account_balances WHERE phone = ?').get('13800137721').balance_nanos, 0);
    }, { now: () => '2026-06-16T18:00:00+08:00' });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "官方美元价格扣今日额度"
```

Expected: FAIL，当前代码写入 `api_charge_records` 并扣人民币余额。

- [ ] **Step 3: 替换扣费事务**

In `server.js`, import:

```js
const { priceOfficialUsageUsd } = require('./lib/shop-official-gpt-pricing');
```

Replace `chargeUsageEventInCurrentTransaction` body with USD flow:

```js
function chargeUsageEventInCurrentTransaction(event) {
    if (getApiUsdChargeByUsageEventId.get(event.requestId)) {
        return { charged: 0, skipped: 1 };
    }
    const owner = getPhoneByUsageApiKeyHash.get(event.apiKeyHash, event.apiKeyHash);
    if (!owner?.phone) {
        return { charged: 0, skipped: 1 };
    }
    const quotaDate = chinaDateKey(new Date(event.requestedAt || nowIso()));
    const quota = accountDailyQuotaStatus(owner.phone, new Date(event.requestedAt || nowIso()));
    const pricing = priceOfficialUsageUsd(event);
    const quotaBeforeUsdMicros = quota.remainingUsdMicros;
    const quotaAfterUsdMicros = quotaBeforeUsdMicros - pricing.chargeUsdMicros;
    const now = nowIso();
    const chargeId = createId('USDCHARGE');

    insertApiUsdChargeRecord.run({
        id: chargeId,
        phone: owner.phone,
        usageEventId: event.requestId,
        apiKeyHash: event.apiKeyHash,
        model: event.model,
        serviceTier: pricing.serviceTier,
        contextTier: pricing.contextTier,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cacheHitInputTokens: event.cacheHitInputTokens,
        cacheMissInputTokens: event.cacheMissInputTokens,
        reasoningTokens: event.reasoningTokens,
        totalTokens: event.totalTokens,
        officialPriceVersion: pricing.officialPriceVersion,
        chargeUsdMicros: pricing.chargeUsdMicros,
        quotaBeforeUsdMicros,
        quotaAfterUsdMicros,
        quotaDate,
        status: pricing.status,
        createdAt: now
    });

    if (pricing.chargeUsdMicros > 0) {
        insertQuotaLedgerEntry.run({
            id: createId('QUOTALEDGER'),
            phone: owner.phone,
            entryType: 'api_usd_charge',
            amountUsdMicros: -pricing.chargeUsdMicros,
            quotaAfterUsdMicros,
            quotaDate,
            relatedId: event.requestId,
            memo: `${event.model || 'unknown'} API 调用扣美元额度`,
            createdAt: now,
            createdByPhone: ''
        });
    }
    appendChargeAuditLog({
        source: 'realtime',
        chargeId,
        phone: owner.phone,
        usageEventId: event.requestId,
        apiKeyHash: event.apiKeyHash,
        apiKeyPreview: event.apiKeyPreview,
        model: event.model,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cacheHitInputTokens: event.cacheHitInputTokens,
        cacheMissInputTokens: event.cacheMissInputTokens,
        reasoningTokens: event.reasoningTokens,
        totalTokens: event.totalTokens,
        priceVersion: pricing.officialPriceVersion,
        chargeUsdMicros: pricing.chargeUsdMicros,
        quotaBeforeUsdMicros,
        quotaAfterUsdMicros,
        quotaDate,
        status: pricing.status,
        createdAt: now
    });
    return { charged: pricing.chargeUsdMicros > 0 ? 1 : 0, skipped: 0 };
}
```

- [ ] **Step 4: 增加 USD 扣费查询和 insert**

Add prepared statements mirroring old charge statements:

```js
const getApiUsdChargeByUsageEventId = db.prepare(`
SELECT id, phone, usage_event_id, api_key_hash, model, service_tier, context_tier,
       input_tokens, output_tokens, cache_hit_input_tokens, cache_miss_input_tokens,
       reasoning_tokens, total_tokens, official_price_version, charge_usd_micros,
       quota_before_usd_micros, quota_after_usd_micros, quota_date, status, created_at
FROM api_usd_charge_records
WHERE usage_event_id = ?
`);

const insertApiUsdChargeRecord = db.prepare(`
INSERT INTO api_usd_charge_records (
  id, phone, usage_event_id, api_key_hash, model, service_tier, context_tier,
  input_tokens, output_tokens, cache_hit_input_tokens, cache_miss_input_tokens,
  reasoning_tokens, total_tokens, official_price_version, charge_usd_micros,
  quota_before_usd_micros, quota_after_usd_micros, quota_date, status, created_at
)
VALUES (
  @id, @phone, @usageEventId, @apiKeyHash, @model, @serviceTier, @contextTier,
  @inputTokens, @outputTokens, @cacheHitInputTokens, @cacheMissInputTokens,
  @reasoningTokens, @totalTokens, @officialPriceVersion, @chargeUsdMicros,
  @quotaBeforeUsdMicros, @quotaAfterUsdMicros, @quotaDate, @status, @createdAt
)
`);

const insertQuotaLedgerEntry = db.prepare(`
INSERT INTO account_quota_ledger_entries (
  id, phone, entry_type, amount_usd_micros, quota_after_usd_micros,
  quota_date, related_id, memo, created_at, created_by_phone
)
VALUES (
  @id, @phone, @entryType, @amountUsdMicros, @quotaAfterUsdMicros,
  @quotaDate, @relatedId, @memo, @createdAt, @createdByPhone
)
`);
```

- [ ] **Step 5: 审计日志兼容美元字段**

Modify `lib/shop-charge-audit-log.js` normalized record:

```js
chargeUsdMicros: normalizeInteger(record.chargeUsdMicros ?? record.charge_usd_micros),
quotaBeforeUsdMicros: normalizeInteger(record.quotaBeforeUsdMicros ?? record.quota_before_usd_micros),
quotaAfterUsdMicros: normalizeInteger(record.quotaAfterUsdMicros ?? record.quota_after_usd_micros),
quotaDate: String(record.quotaDate || record.quota_date || ''),
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "官方美元价格扣今日额度"
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add server.js lib/shop-charge-audit-log.js test/shop-flow.test.js
git commit -m "feat: charge usage against USD quota"
```

---

### Task 6: Account API 与前端展示美元订阅池

**Files:**
- Modify: `server.js`
- Modify: `shop/js/core.js`
- Modify: `shop/js/account.js`
- Modify: `shop/account/index.html`
- Modify: `test/shop-frontend.test.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写后端失败测试**

Append to `test/shop-flow.test.js`:

```js
test('Account 返回订阅池状态、加量包和美元扣费记录', async () => {
    await withServer(async ({ baseUrl }) => {
        const user = await registerAndLogin(baseUrl, '13800137731');
        const admin = await loginAdmin(baseUrl);
        await createApprovedSubscriptionForTest({ baseUrl, headers: user.headers, adminHeaders: admin.headers, planId: 'sub_59_daily_49_usd' });
        const quota = await jsonFetch(`${baseUrl}/api/account/quota`, { headers: user.headers });
        assert.equal(quota.body.subscription.planId, 'sub_59_daily_49_usd');
        assert.equal(quota.body.quota.dailyQuotaUsdMicros, 49000000);
        assert.equal(quota.body.quota.remainingUsdMicros, 49000000);
        const plans = await jsonFetch(`${baseUrl}/api/account/subscription-plans`, { headers: user.headers });
        assert.equal(plans.body.plans.length, 3);
        assert.equal(plans.body.addonPackages.find((item) => item.id === 'addon_5_usd_daily').quotaUsdMicros, 5000000);
    }, { now: () => '2026-06-16T20:00:00+08:00' });
});
```

- [ ] **Step 2: 写前端失败测试**

Append to `test/shop-frontend.test.js`:

```js
test('Account 页面展示订阅池容器并移除人民币余额标题', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'shop/account/index.html'), 'utf8');
    assert.match(html, /id="accountQuotaCards"/);
    assert.match(html, /id="subscriptionOrderForm"/);
    assert.match(html, /id="quotaAddonForm"/);
    assert.doesNotMatch(html, />充值</);
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池状态"
node --test test/shop-frontend.test.js --test-name-pattern "订阅池容器"
```

Expected: FAIL，缺少接口和容器。

- [ ] **Step 4: 增加 Account API**

Add to `server.js`:

```js
app.get('/api/account/quota', limitQueryApi, requireAccount, (req, res) => {
    return res.json({
        subscription: publicAccountSubscription(getActiveSubscriptionWithPlanByPhone.get(req.account.phone, nowIso(), nowIso())),
        quota: publicQuotaStatus(accountDailyQuotaStatus(req.account.phone)),
        charges: listApiUsdChargeRecordsByPhone.all(req.account.phone, 50).map(publicApiUsdChargeRecord),
        ledger: listQuotaLedgerEntriesByPhone.all(req.account.phone, 50).map(publicQuotaLedgerEntry)
    });
});

app.get('/api/account/subscription-plans', limitQueryApi, requireAccount, (req, res) => {
    return res.json({
        plans: listActiveSubscriptionPlans.all().map(publicSubscriptionPlan),
        addonPackages: listActiveQuotaAddonPackages.all().map(publicQuotaAddonPackage)
    });
});
```

- [ ] **Step 5: 增加美元格式化**

Modify `shop/js/core.js`:

```js
function formatUsdMicros(value) {
    const amount = Number(value || 0) / 1000000;
    if (!Number.isFinite(amount)) return '$0.00';
    return `$${amount.toFixed(2)}`;
}
```

Export it from `window.YuiShopCore`.

- [ ] **Step 6: 更新 Account 页面 HTML**

Replace balance/topup area in `shop/account/index.html` with:

```html
<section class="space-y-4">
    <div class="flex items-center justify-between gap-4">
        <h3 class="font-display text-2xl text-primary dark:text-dark-text">订阅池</h3>
        <p id="accountQuotaMessage" class="text-sm text-text-muted dark:text-dark-text-muted"></p>
    </div>
    <div id="accountQuotaCards" class="grid gap-4 md:grid-cols-3"></div>
    <form id="subscriptionOrderForm" class="grid gap-3 md:grid-cols-[1fr_auto]">
        <select id="subscriptionPlanSelect" class="h-11 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text"></select>
        <button class="btn-primary" type="submit">提交订阅申请</button>
    </form>
    <form id="quotaAddonForm" class="grid gap-3 md:grid-cols-[1fr_auto]">
        <select id="quotaAddonSelect" class="h-11 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text"></select>
        <button class="btn-secondary" type="submit">购买加量包</button>
    </form>
</section>
```

- [ ] **Step 7: 更新 Account 前端渲染**

In `shop/js/account.js`, import `formatUsdMicros` and add:

```js
function renderQuotaCards(quota = {}, subscription = {}) {
    const cards = [
        ['当前套餐', subscription.planName || '未开通', subscription.expiresAt ? `到期 ${formatDate(subscription.expiresAt)}` : '需要开通订阅'],
        ['今日剩余额度', formatUsdMicros(quota.remainingUsdMicros), `已用 ${formatUsdMicros(quota.usedUsdMicros)}`],
        ['今日基础 / 加量', `${formatUsdMicros(quota.dailyQuotaUsdMicros)} / ${formatUsdMicros(quota.addonQuotaUsdMicros)}`, `刷新日 ${quota.quotaDate || '-'}`]
    ];
    return cards.map(([label, value, hint]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
            <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
        </article>
    `).join('');
}
```

Replace `refreshBilling()` calls with `refreshQuota()` that requests `/api/account/quota` and `/api/account/subscription-plans`.

- [ ] **Step 8: 运行测试确认通过**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池状态"
node --test test/shop-frontend.test.js --test-name-pattern "订阅池容器"
```

Expected: PASS。

- [ ] **Step 9: 提交**

```bash
git add server.js shop/js/core.js shop/js/account.js shop/account/index.html test/shop-flow.test.js test/shop-frontend.test.js
git commit -m "feat: show subscription pool in account"
```

---

### Task 7: Admin 业务办理与用量监控切到美元额度

**Files:**
- Modify: `server.js`
- Modify: `shop/js/admin.js`
- Modify: `shop/admin/index.html`
- Modify: `shop/js/charts.js`
- Modify: `test/shop-flow.test.js`
- Modify: `test/shop-frontend.test.js`

- [ ] **Step 1: 写失败测试**

Append to `test/shop-flow.test.js`:

```js
test('Admin 返回订阅池用户额度汇总和美元消耗', async () => {
    await withServer(async ({ baseUrl }) => {
        const user = await registerAndLogin(baseUrl, '13800137741');
        const admin = await loginAdmin(baseUrl);
        await createApprovedSubscriptionForTest({ baseUrl, headers: user.headers, adminHeaders: admin.headers, planId: 'sub_39_daily_29_usd' });
        const result = await jsonFetch(`${baseUrl}/api/admin/subscription-pool-summary`, { headers: admin.headers });
        assert.equal(result.body.summary.activeSubscriptionCount, 1);
        assert.equal(result.body.summary.todayQuotaUsdMicros, 29000000);
        assert.equal(result.body.items[0].phone, '13800137741');
    }, { now: () => '2026-06-16T22:00:00+08:00' });
});
```

Append to `test/shop-frontend.test.js`:

```js
test('Admin 页面包含订阅池业务办理和美元用量容器', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'shop/admin/index.html'), 'utf8');
    assert.match(html, /id="adminSubscriptionOrders"/);
    assert.match(html, /id="adminQuotaAddons"/);
    assert.match(html, /id="adminSubscriptionPoolSummary"/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池用户额度汇总"
node --test test/shop-frontend.test.js --test-name-pattern "订阅池业务办理"
```

Expected: FAIL，缺少接口和容器。

- [ ] **Step 3: 增加 Admin summary API**

Add to `server.js`:

```js
app.get('/api/admin/subscription-pool-summary', limitAdminApi, requireAdminUsageAccess, (req, res) => {
    const quotaDate = chinaDateKey(new Date(nowIso()));
    const items = listSubscriptionPoolAccounts.all(quotaDate, quotaDate).map((row) => {
        const quota = accountDailyQuotaStatus(row.phone);
        return {
            phone: row.phone,
            planId: row.plan_id,
            planName: row.plan_name,
            expiresAt: row.expires_at,
            dailyQuotaUsdMicros: quota.dailyQuotaUsdMicros,
            addonQuotaUsdMicros: quota.addonQuotaUsdMicros,
            usedUsdMicros: quota.usedUsdMicros,
            remainingUsdMicros: quota.remainingUsdMicros,
            quotaDate
        };
    });
    return res.json({
        summary: {
            activeSubscriptionCount: items.length,
            todayQuotaUsdMicros: items.reduce((sum, item) => sum + item.dailyQuotaUsdMicros + item.addonQuotaUsdMicros, 0),
            todayUsedUsdMicros: items.reduce((sum, item) => sum + item.usedUsdMicros, 0),
            exhaustedUserCount: items.filter((item) => item.remainingUsdMicros <= 0).length
        },
        items
    });
});
```

- [ ] **Step 4: 更新 Admin HTML**

In `shop/admin/index.html`, add containers inside business section:

```html
<div id="adminSubscriptionOrders" class="overflow-x-auto rounded-lg border border-border-subtle dark:border-dark-border"></div>
<div id="adminQuotaAddons" class="overflow-x-auto rounded-lg border border-border-subtle dark:border-dark-border"></div>
<div id="adminSubscriptionPoolSummary" class="grid gap-4 md:grid-cols-4"></div>
<div id="adminSubscriptionPoolTable" class="overflow-x-auto rounded-lg border border-border-subtle dark:border-dark-border"></div>
```

- [ ] **Step 5: 更新 Admin JS**

In `shop/js/admin.js`, import `formatUsdMicros` and add:

```js
function renderSubscriptionPoolSummary(summary = {}) {
    const cards = [
        ['订阅用户', formatNumber(summary.activeSubscriptionCount || 0), '当前有效'],
        ['今日额度', formatUsdMicros(summary.todayQuotaUsdMicros), '基础 + 加量'],
        ['今日已用', formatUsdMicros(summary.todayUsedUsdMicros), '官方美元成本'],
        ['额度用尽', formatNumber(summary.exhaustedUserCount || 0), '剩余 <= 0']
    ];
    return cards.map(([label, value, hint]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
            <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
        </article>
    `).join('');
}
```

Add fetch function:

```js
async function fetchSubscriptionPoolSummary() {
    const summaryRoot = document.getElementById('adminSubscriptionPoolSummary');
    const tableRoot = document.getElementById('adminSubscriptionPoolTable');
    if (!summaryRoot || !tableRoot) return;
    const data = await requestJson('/api/admin/subscription-pool-summary');
    summaryRoot.innerHTML = renderSubscriptionPoolSummary(data.summary || {});
    tableRoot.innerHTML = renderSubscriptionPoolTable(data.items || []);
}
```

Call it from `initAdminPage()` and after subscription/addon approvals.

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
node --test test/shop-flow.test.js --test-name-pattern "订阅池用户额度汇总"
node --test test/shop-frontend.test.js --test-name-pattern "订阅池业务办理"
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add server.js shop/js/admin.js shop/admin/index.html shop/js/charts.js test/shop-flow.test.js test/shop-frontend.test.js
git commit -m "feat: add admin subscription pool dashboard"
```

---

### Task 8: 模型总览、历史兼容和全量验证

**Files:**
- Modify: `lib/shop-model-overview.js`
- Modify: `lib/shop-model-overview.test.js`
- Modify: `lib/shop-billing-summary.js`
- Modify: `lib/shop-billing-summary.test.js`
- Modify: `styles/tailwind.css`
- Modify: `styles/site.css`
- Modify: `AGENTS.md`

- [ ] **Step 1: 写模型总览失败测试**

Modify `lib/shop-model-overview.test.js` expected fields:

```js
test('模型价格总览展示官方美元价格', () => {
    assert.deepEqual(modelPriceOverview('GPT-5.5', true), {
        id: 'GPT-5.5',
        available: true,
        priceModel: 'gpt-5.5',
        usesDefaultPrice: false,
        priceVersion: 'openai-gpt-5.5-usd-20260616-standard-short',
        cacheHitInputUsdPerMillion: 0.5,
        cacheMissInputUsdPerMillion: 5,
        outputUsdPerMillion: 30
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test lib/shop-model-overview.test.js
```

Expected: FAIL，当前返回人民币价格字段。

- [ ] **Step 3: 修改模型总览**

In `lib/shop-model-overview.js`, import `officialGptUsdPrices` and return:

```js
function usdPerMillion(usdMicrosPerMillionTokens) {
    return Number(usdMicrosPerMillionTokens || 0) / 1000000;
}

function modelPriceOverview(modelId, available) {
    const id = String(modelId || '').trim();
    const normalizedId = id.toLowerCase();
    const model = officialGptUsdPrices[normalizedId] ? normalizedId : defaultOfficialModel;
    const price = officialGptUsdPrices[model].short;
    return {
        id,
        available: Boolean(available),
        priceModel: price.model,
        usesDefaultPrice: normalizedId !== price.model,
        priceVersion: price.version,
        cacheHitInputUsdPerMillion: usdPerMillion(price.cacheHitInputUsdMicrosPerMillionTokens),
        cacheMissInputUsdPerMillion: usdPerMillion(price.cacheMissInputUsdMicrosPerMillionTokens),
        outputUsdPerMillion: usdPerMillion(price.outputUsdMicrosPerMillionTokens)
    };
}
```

- [ ] **Step 4: 更新 CSS 并构建**

Add stable classes to `styles/tailwind.css`:

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

Expected: `styles/site.css` 更新成功，无 Tailwind 错误。

- [ ] **Step 5: 更新 AGENTS**

Append to top of `AGENTS.md`:

```md
## 2026-06-16 订阅池美元计费实施

- 本分支目标运行态已从人民币按量余额扣费切到订阅池美元额度扣费。
- 新 usage 写入 `api_usd_charge_records` 和 `account_quota_ledger_entries`，不再扣 `account_balances.balance_nanos`。
- 每日额度按东八区 0 点刷新，不结转；加量包当日有效。
- 三个套餐均允许 `gpt-5.4` 和 `gpt-5.5`，套餐差异只体现在每日美元额度。
- 旧 `api_charge_records` 和人民币 ledger 只作为历史兼容，不作为新扣费事实。
```

- [ ] **Step 6: 全量验证**

Run:

```bash
npm test
```

Expected: PASS，所有测试通过。

- [ ] **Step 7: 提交**

```bash
git add lib/shop-model-overview.js lib/shop-model-overview.test.js lib/shop-billing-summary.js lib/shop-billing-summary.test.js styles/tailwind.css styles/site.css AGENTS.md
git commit -m "feat: switch model overview to USD billing"
```

---

## Self-Review

- Spec coverage：方案 B、独立美元额度账本、东八区 0 点刷新、不结转、三档套餐、三档均可使用 `gpt-5.4` 和 `gpt-5.5`、官方价格快照、短/长上下文、加量包、Account/Admin 展示、内部 key 放行、usage 美元扣费均有任务覆盖。
- Placeholder scan：本文未使用占位语句，所有任务均包含具体文件、命令和目标代码片段。
- Type consistency：美元金额统一使用 `usd_micros` / camelCase `UsdMicros`；官方价格版本统一使用 `official_price_version` / `officialPriceVersion`；日期统一使用 `quota_date` / `quotaDate`。
