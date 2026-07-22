const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const compression = require('compression');
const express = require('express');
require('dotenv').config();

const {
    cacheControlForStaticPath,
    isAllowedPublicStaticPath,
    isRetiredShopPath
} = require('./lib/static-public-policy');
const {
    encryptApiKeyEnvelope,
    hashApiKey,
    keyPreview,
    readStoredApiKey
} = require('./lib/shop-api-key-crypto');
const {
    chargeNanosToCents,
    deriveInputTokenBreakdown,
    priceUsageTokens
} = require('./lib/shop-pricing');
const {
    addonPackageByAmountCents,
    addonPackages,
    priceOfficialUsageUsd,
    splitUsdChargeByQuota,
    subscriptionPlanById,
    subscriptionPlans
} = require('./lib/shop-subscription-billing');
const { buildBillingSummary, buildWeeklySpending } = require('./lib/shop-billing-summary');
const {
    modelPriceOverview,
    normalizeModelList,
    pricingFallbackModelOverview
} = require('./lib/shop-model-overview');
const { syncApiKeyToCliProxyConfig } = require('./lib/cliproxy-api-key-sync');
const {
    centsToCny,
    centsToNanos,
    nanosToBalanceCents,
    nanosToCny,
    nonNegativeInteger,
    parsePositiveCnyToCents,
    signedCentsToNanos
} = require('./lib/shop-money');
const { appendShopChargeAuditLog } = require('./lib/shop-charge-audit-log');

const durationDays = 31;
const chinaOffsetMs = 8 * 60 * 60 * 1000;
const defaultAdminAccountPhone = '15951875192';
const adminMonitorSubscriptionPlanId = 'sub_59_daily_49_usd';
const defaultCreditLimitCents = 1000;
const supportedPaymentMethods = new Set(['alipay', 'wechat']);

function assertStrongSecret(name, value, { required = true, production = false } = {}) {
    const trimmed = String(value || '').trim();
    const weakValues = new Set(['change-me', 'change-me-internal-token', 'change-me-hmac-secret', 'password', 'admin']);
    if (!trimmed && required) throw new Error(`${name} is required`);
    if (!production && !trimmed) return;
    if (production && (trimmed.length < 32 || weakValues.has(trimmed))) {
        throw new Error(`weak secret: ${name}`);
    }
}

function resolveTrustProxy(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, 'trustProxy')) return options.trustProxy;
    const raw = String(process.env.TRUST_PROXY || '').trim();
    if (!raw) return false;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (/^\d+$/.test(raw)) return Number(raw);
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function toChinaIso(date = new Date()) {
    const value = new Date(date);
    return new Date(value.getTime() + chinaOffsetMs).toISOString().replace('Z', '+08:00');
}

function nowIso(date = new Date()) {
    return toChinaIso(date);
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function isPhone(value) {
    return /^1[3-9]\d{9}$/.test(String(value || '').trim());
}

function createId(prefix) {
    return `${prefix}${Date.now().toString().slice(-8)}${crypto.randomInt(1000, 9999)}`;
}

function createInviteCode() {
    return `YUI-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function createResultToken() {
    return `rst_${crypto.randomBytes(32).toString('base64url')}`;
}

function parseCookies(cookieHeader) {
    return String(cookieHeader || '')
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
        .reduce((cookies, item) => {
            const separatorIndex = item.indexOf('=');
            if (separatorIndex === -1) return cookies;
            const key = decodeURIComponent(item.slice(0, separatorIndex).trim());
            const value = decodeURIComponent(item.slice(separatorIndex + 1).trim());
            return { ...cookies, [key]: value };
        }, {});
}

function safeEqual(a, b) {
    const left = Buffer.from(String(a || ''));
    const right = Buffer.from(String(b || ''));
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

function normalizePaymentMethod(value) {
    const method = String(value || '').trim().toLowerCase();
    if (!supportedPaymentMethods.has(method)) {
        const error = new Error('支付方式必须是支付宝或微信。');
        error.status = 400;
        error.code = 'INVALID_PAYMENT_METHOD';
        throw error;
    }
    return method;
}

function usageTokenValue(body, tokenSource, keys) {
    for (const key of keys) {
        const bodyValue = body?.[key];
        if (bodyValue !== undefined && bodyValue !== null) return bodyValue;
        const tokenValue = tokenSource?.[key];
        if (tokenValue !== undefined && tokenValue !== null) return tokenValue;
    }
    return undefined;
}

function normalizeUsageEvent(body = {}) {
    const tokenSource = body.tokens && typeof body.tokens === 'object' ? body.tokens : {};
    let inputTokens = nonNegativeInteger(usageTokenValue(body, tokenSource, ['input_tokens', 'prompt_tokens']));
    const outputTokens = nonNegativeInteger(usageTokenValue(body, tokenSource, ['output_tokens', 'completion_tokens']));
    const reasoningTokens = nonNegativeInteger(
        usageTokenValue(body, tokenSource, ['reasoning_tokens']) ??
        body.completion_tokens_details?.reasoning_tokens ??
        body.output_tokens_details?.reasoning_tokens ??
        tokenSource.completion_tokens_details?.reasoning_tokens ??
        tokenSource.output_tokens_details?.reasoning_tokens
    );
    let cachedTokens = nonNegativeInteger(
        usageTokenValue(body, tokenSource, ['cached_tokens']) ??
        body.prompt_tokens_details?.cached_tokens ??
        body.input_tokens_details?.cached_tokens ??
        tokenSource.prompt_tokens_details?.cached_tokens ??
        tokenSource.input_tokens_details?.cached_tokens
    );
    let cacheHitInputTokens = nonNegativeInteger(usageTokenValue(body, tokenSource, [
        'cache_hit_input_tokens',
        'prompt_cache_hit_tokens'
    ]));
    let cacheMissInputTokens = nonNegativeInteger(usageTokenValue(body, tokenSource, [
        'cache_miss_input_tokens',
        'prompt_cache_miss_tokens'
    ]));
    const breakdown = deriveInputTokenBreakdown({
        inputTokens,
        cachedTokens,
        cacheHitInputTokens,
        cacheMissInputTokens
    });
    inputTokens = breakdown.inputTokens;
    cachedTokens = breakdown.cachedTokens;
    cacheHitInputTokens = breakdown.cacheHitInputTokens;
    cacheMissInputTokens = breakdown.cacheMissInputTokens;
    let totalTokens = nonNegativeInteger(body.total_tokens);
    if (totalTokens === 0) {
        totalTokens = inputTokens + outputTokens;
    }
    const failed = Boolean(body.failed);
    const requestedAt = String(body.requested_at || '').trim();
    return {
        requestId: String(body.request_id || '').trim(),
        apiKeyHash: String(body.api_key_hash || '').trim(),
        apiKeyPreview: String(body.api_key_preview || '').trim(),
        provider: String(body.provider || '').trim(),
        model: String(body.model || '').trim() || 'unknown',
        endpoint: String(body.endpoint || '').trim(),
        source: String(body.source || '').trim(),
        authIndex: String(body.auth_index || '').trim(),
        success: body.success === undefined ? !failed : Boolean(body.success),
        failed,
        inputTokens,
        outputTokens,
        reasoningTokens,
        cachedTokens,
        cacheHitInputTokens,
        cacheMissInputTokens,
        totalTokens,
        latencyMs: nonNegativeInteger(body.latency_ms),
        requestedAt: requestedAt && !Number.isNaN(new Date(requestedAt).getTime()) ? requestedAt : nowIso(),
        priceAmountMicros: body.price_amount_micros === undefined || body.price_amount_micros === null
            ? null
            : nonNegativeInteger(body.price_amount_micros),
        priceCurrency: String(body.price_currency || '').trim().toUpperCase()
    };
}

function openShopDatabase(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
CREATE TABLE IF NOT EXISTS users (
  phone TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('unused', 'redeemed', 'disabled')),
  created_at TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_by_phone TEXT,
  order_id TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
  api_key TEXT PRIMARY KEY,
  api_key_preview TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unused', 'used', 'disabled')),
  created_at TEXT NOT NULL,
  used_at TEXT,
  order_id TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  api_key_preview TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);
`);
    const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
    if (!userColumns.includes('password_hash')) {
        db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT;`);
    }
    if (!userColumns.includes('password_created_at')) {
        db.exec(`ALTER TABLE users ADD COLUMN password_created_at TEXT;`);
    }
    if (!userColumns.includes('updated_at')) {
        db.exec(`ALTER TABLE users ADD COLUMN updated_at TEXT;`);
    }
    db.exec(`
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_phone
ON user_sessions(phone);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by_phone TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_phone
ON password_reset_codes(phone);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires
ON password_reset_codes(expires_at);
`);
    const sessionColumns = db.prepare('PRAGMA table_info(user_sessions)').all().map((column) => column.name);
    if (!sessionColumns.includes('csrf_token_hash')) {
        db.exec(`ALTER TABLE user_sessions ADD COLUMN csrf_token_hash TEXT;`);
    }
    const inviteColumns = db.prepare('PRAGMA table_info(invite_codes)').all().map((column) => column.name);
    if (inviteColumns.includes('api_key')) {
        db.exec(`
CREATE TABLE IF NOT EXISTS invite_codes_next (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('unused', 'redeemed', 'disabled')),
  created_at TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_by_phone TEXT,
  order_id TEXT
);
INSERT OR IGNORE INTO api_keys (api_key, api_key_preview, status, created_at, used_at, order_id)
SELECT api_key, api_key_preview,
       CASE WHEN status = 'redeemed' THEN 'used' ELSE 'unused' END,
       created_at, redeemed_at, order_id
FROM invite_codes
WHERE api_key IS NOT NULL;
INSERT OR IGNORE INTO invite_codes_next (code, status, created_at, redeemed_at, redeemed_by_phone, order_id)
SELECT code, status, created_at, redeemed_at, redeemed_by_phone, order_id
FROM invite_codes;
DROP TABLE invite_codes;
ALTER TABLE invite_codes_next RENAME TO invite_codes;
`);
    }
    const apiKeyColumns = db.prepare('PRAGMA table_info(api_keys)').all().map((column) => column.name);
    if (!apiKeyColumns.includes('api_key_hash')) {
        db.exec(`ALTER TABLE api_keys ADD COLUMN api_key_hash TEXT;`);
    }
    if (!apiKeyColumns.includes('api_key_ciphertext')) {
        db.exec(`ALTER TABLE api_keys ADD COLUMN api_key_ciphertext TEXT;`);
    }
    if (!apiKeyColumns.includes('api_key_nonce')) {
        db.exec(`ALTER TABLE api_keys ADD COLUMN api_key_nonce TEXT;`);
    }
    const missingHashRows = db.prepare(`
SELECT api_key
FROM api_keys
WHERE api_key_hash IS NULL OR api_key_hash = ''
`).all();
    const updateApiKeyHash = db.prepare(`
UPDATE api_keys
SET api_key_hash = ?
WHERE api_key = ?
`);
    const backfillApiKeyHashes = db.transaction((rows) => {
        for (const row of rows) {
            updateApiKeyHash.run(hashApiKey(row.api_key), row.api_key);
        }
    });
    backfillApiKeyHashes(missingHashRows);
    db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash_unique
ON api_keys(api_key_hash)
WHERE api_key_hash IS NOT NULL;
`);
    const orderColumns = db.prepare('PRAGMA table_info(orders)').all().map((column) => column.name);
    if (!orderColumns.includes('invite_code')) {
        db.exec(`ALTER TABLE orders ADD COLUMN invite_code TEXT;`);
    }
    if (!orderColumns.includes('result_token')) {
        db.exec(`ALTER TABLE orders ADD COLUMN result_token TEXT;`);
    }
    if (!orderColumns.includes('api_key_ciphertext')) {
        db.exec(`ALTER TABLE orders ADD COLUMN api_key_ciphertext TEXT;`);
    }
    if (!orderColumns.includes('api_key_nonce')) {
        db.exec(`ALTER TABLE orders ADD COLUMN api_key_nonce TEXT;`);
    }
    db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_result_token_unique
ON orders(result_token)
WHERE result_token IS NOT NULL;

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
  cache_hit_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_miss_input_tokens INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS usage_key_profiles (
  api_key_hash TEXT PRIMARY KEY,
  api_key_preview TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_key_profiles_group
ON usage_key_profiles(group_name);

CREATE TABLE IF NOT EXISTS account_balances (
  phone TEXT PRIMARY KEY,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  balance_nanos INTEGER NOT NULL DEFAULT 0,
  pending_topup_cents INTEGER NOT NULL DEFAULT 0,
  pending_topup_nanos INTEGER NOT NULL DEFAULT 0,
  credit_limit_cents INTEGER NOT NULL DEFAULT 1000,
  credit_limit_nanos INTEGER NOT NULL DEFAULT 10000000000,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE TABLE IF NOT EXISTS topup_requests (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  requested_amount_cents INTEGER NOT NULL,
  confirmed_amount_cents INTEGER,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('alipay', 'wechat')),
  payment_time TEXT,
  payment_note TEXT,
  screenshot_path TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note TEXT,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  confirmed_by_phone TEXT,
  rejected_at TEXT,
  rejected_by_phone TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_topup_requests_phone_created
ON topup_requests(phone, created_at);

CREATE INDEX IF NOT EXISTS idx_topup_requests_status_created
ON topup_requests(status, created_at);

CREATE TABLE IF NOT EXISTS account_ledger_entries (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('topup_approved', 'api_charge', 'admin_adjustment', 'refund')),
  amount_cents INTEGER NOT NULL,
  amount_nanos INTEGER NOT NULL DEFAULT 0,
  balance_after_cents INTEGER NOT NULL,
  balance_after_nanos INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CNY',
  related_id TEXT,
  memo TEXT,
  created_at TEXT NOT NULL,
  created_by_phone TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_account_ledger_phone_created
ON account_ledger_entries(phone, created_at);

CREATE TABLE IF NOT EXISTS api_charge_records (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  usage_event_id TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_hit_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_miss_input_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  price_version TEXT NOT NULL,
  charge_cents INTEGER NOT NULL,
  charge_nanos INTEGER NOT NULL DEFAULT 0,
  balance_before_cents INTEGER NOT NULL,
  balance_before_nanos INTEGER NOT NULL DEFAULT 0,
  balance_after_cents INTEGER NOT NULL,
  balance_after_nanos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('charged', 'failed_no_charge', 'unpriced_no_charge', 'adjusted')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_api_charge_records_phone_created
ON api_charge_records(phone, created_at);

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
  order_type TEXT NOT NULL CHECK (order_type IN ('subscription', 'addon')),
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

CREATE INDEX IF NOT EXISTS idx_subscription_orders_phone_created
ON subscription_orders(phone, created_at);

CREATE INDEX IF NOT EXISTS idx_subscription_orders_type_status_created
ON subscription_orders(order_type, status, created_at);

CREATE TABLE IF NOT EXISTS subscription_refund_requests (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_amount_cents INTEGER NOT NULL,
  period_days INTEGER NOT NULL,
  remaining_days INTEGER NOT NULL,
  refund_amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  confirmed_by_phone TEXT,
  admin_note TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone),
  FOREIGN KEY (subscription_id) REFERENCES account_subscriptions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_refund_one_pending
ON subscription_refund_requests(subscription_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_subscription_refund_phone_created
ON subscription_refund_requests(phone, created_at);

CREATE INDEX IF NOT EXISTS idx_subscription_refund_status_created
ON subscription_refund_requests(status, created_at);

CREATE TABLE IF NOT EXISTS account_addon_balances (
  phone TEXT PRIMARY KEY,
  balance_usd_micros INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE TABLE IF NOT EXISTS account_addon_ledger_entries (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('addon_purchase', 'api_charge', 'admin_adjustment', 'refund')),
  amount_usd_micros INTEGER NOT NULL,
  balance_after_usd_micros INTEGER NOT NULL,
  related_id TEXT,
  memo TEXT,
  created_at TEXT NOT NULL,
  created_by_phone TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_account_addon_ledger_phone_created
ON account_addon_ledger_entries(phone, created_at);

CREATE TABLE IF NOT EXISTS api_usd_charge_records (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  usage_event_id TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_hit_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_miss_input_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  official_price_version TEXT NOT NULL,
  charge_usd_micros INTEGER NOT NULL,
  daily_quota_before_usd_micros INTEGER NOT NULL DEFAULT 0,
  daily_quota_deducted_usd_micros INTEGER NOT NULL DEFAULT 0,
  daily_quota_after_usd_micros INTEGER NOT NULL DEFAULT 0,
  addon_balance_before_usd_micros INTEGER NOT NULL DEFAULT 0,
  addon_deducted_usd_micros INTEGER NOT NULL DEFAULT 0,
  addon_balance_after_usd_micros INTEGER NOT NULL DEFAULT 0,
  overrun_usd_micros INTEGER NOT NULL DEFAULT 0,
  quota_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('charged', 'failed_no_charge', 'unpriced_no_charge', 'adjusted')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_api_usd_charge_records_phone_date_created
ON api_usd_charge_records(phone, quota_date, created_at);
`);
    const seedSubscriptionPlan = db.prepare(`
INSERT INTO subscription_plans (
  id, name, monthly_price_cents, daily_quota_usd_micros, period_days, status, created_at, updated_at
)
VALUES (
  @id, @name, @monthlyPriceCents, @dailyQuotaUsdMicros, @periodDays, 'active', @now, @now
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  daily_quota_usd_micros = excluded.daily_quota_usd_micros,
  period_days = excluded.period_days,
  status = 'active',
  updated_at = excluded.updated_at
`);
    for (const plan of subscriptionPlans) {
        seedSubscriptionPlan.run({
            ...plan,
            now: nowIso()
        });
    }
    const usageEventColumns = db.prepare('PRAGMA table_info(usage_events)').all().map((column) => column.name);
    if (!usageEventColumns.includes('cache_hit_input_tokens')) {
        db.exec(`ALTER TABLE usage_events ADD COLUMN cache_hit_input_tokens INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!usageEventColumns.includes('cache_miss_input_tokens')) {
        db.exec(`ALTER TABLE usage_events ADD COLUMN cache_miss_input_tokens INTEGER NOT NULL DEFAULT 0;`);
    }
    const balanceColumns = db.prepare('PRAGMA table_info(account_balances)').all().map((column) => column.name);
    if (!balanceColumns.includes('balance_nanos')) {
        db.exec(`ALTER TABLE account_balances ADD COLUMN balance_nanos INTEGER NOT NULL DEFAULT 0;`);
        db.exec(`UPDATE account_balances SET balance_nanos = balance_cents * 10000000 WHERE balance_nanos = 0;`);
    }
    if (!balanceColumns.includes('pending_topup_nanos')) {
        db.exec(`ALTER TABLE account_balances ADD COLUMN pending_topup_nanos INTEGER NOT NULL DEFAULT 0;`);
        db.exec(`UPDATE account_balances SET pending_topup_nanos = pending_topup_cents * 10000000 WHERE pending_topup_nanos = 0;`);
    }
    if (!balanceColumns.includes('credit_limit_nanos')) {
        db.exec(`ALTER TABLE account_balances ADD COLUMN credit_limit_nanos INTEGER NOT NULL DEFAULT 10000000000;`);
        db.exec(`UPDATE account_balances SET credit_limit_nanos = credit_limit_cents * 10000000 WHERE credit_limit_nanos = 10000000000;`);
    }
    const ledgerColumns = db.prepare('PRAGMA table_info(account_ledger_entries)').all().map((column) => column.name);
    if (!ledgerColumns.includes('amount_nanos')) {
        db.exec(`ALTER TABLE account_ledger_entries ADD COLUMN amount_nanos INTEGER NOT NULL DEFAULT 0;`);
        db.exec(`UPDATE account_ledger_entries SET amount_nanos = amount_cents * 10000000 WHERE amount_nanos = 0;`);
    }
    if (!ledgerColumns.includes('balance_after_nanos')) {
        db.exec(`ALTER TABLE account_ledger_entries ADD COLUMN balance_after_nanos INTEGER NOT NULL DEFAULT 0;`);
        db.exec(`UPDATE account_ledger_entries SET balance_after_nanos = balance_after_cents * 10000000 WHERE balance_after_nanos = 0;`);
    }
    const chargeColumns = db.prepare('PRAGMA table_info(api_charge_records)').all().map((column) => column.name);
    if (!chargeColumns.includes('cache_hit_input_tokens')) {
        db.exec(`ALTER TABLE api_charge_records ADD COLUMN cache_hit_input_tokens INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!chargeColumns.includes('cache_miss_input_tokens')) {
        db.exec(`ALTER TABLE api_charge_records ADD COLUMN cache_miss_input_tokens INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!chargeColumns.includes('reasoning_tokens')) {
        db.exec(`ALTER TABLE api_charge_records ADD COLUMN reasoning_tokens INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!chargeColumns.includes('charge_nanos')) {
        db.exec(`ALTER TABLE api_charge_records ADD COLUMN charge_nanos INTEGER NOT NULL DEFAULT 0;`);
        db.exec(`UPDATE api_charge_records SET charge_nanos = charge_cents * 10000000 WHERE charge_nanos = 0;`);
    }
    if (!chargeColumns.includes('balance_before_nanos')) {
        db.exec(`ALTER TABLE api_charge_records ADD COLUMN balance_before_nanos INTEGER NOT NULL DEFAULT 0;`);
        db.exec(`UPDATE api_charge_records SET balance_before_nanos = balance_before_cents * 10000000 WHERE balance_before_nanos = 0;`);
    }
    if (!chargeColumns.includes('balance_after_nanos')) {
        db.exec(`ALTER TABLE api_charge_records ADD COLUMN balance_after_nanos INTEGER NOT NULL DEFAULT 0;`);
        db.exec(`UPDATE api_charge_records SET balance_after_nanos = balance_after_cents * 10000000 WHERE balance_after_nanos = 0;`);
    }
    return db;
}

function escapeHtmlAttribute(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function normalizePublicHttpUrl(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    try {
        const url = new URL(raw);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
        return url.toString().replace(/\/+$/, '');
    } catch {
        return fallback;
    }
}

function createShopApp(options = {}) {
    const rootDir = options.rootDir || __dirname;
    const dbPath = options.dbPath || path.join(rootDir, 'data', 'shop.sqlite');
    const nodeEnv = String(options.nodeEnv || process.env.NODE_ENV || '').trim();
    const production = nodeEnv === 'production';
    assertStrongSecret('ADMIN_TOKEN', options.adminToken ?? process.env.ADMIN_TOKEN, { production });
    assertStrongSecret('INTERNAL_TOKEN', options.internalToken ?? process.env.INTERNAL_TOKEN, { production });
    assertStrongSecret('USAGE_EVENT_HMAC_SECRET', options.usageEventHmacSecret ?? process.env.USAGE_EVENT_HMAC_SECRET, { production, required: false });
    const db = options.db || openShopDatabase(dbPath);
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', resolveTrustProxy(options));
    const product = {
        name: options.productName || process.env.PRODUCT_NAME || 'Codex 每月额度',
        amount: Number(options.productAmount || process.env.PRODUCT_AMOUNT_CNY || 30)
    };
    function appNow() {
        const value = typeof options.now === 'function' ? options.now() : new Date();
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? date : new Date();
    }
    const adminAccountPhone = String(options.adminAccountPhone ?? process.env.SHOP_ADMIN_PHONE ?? defaultAdminAccountPhone).trim();
    const configuredCreditLimitCents = Number(options.defaultCreditLimitCents ?? process.env.SHOP_DEFAULT_CREDIT_LIMIT_CENTS ?? defaultCreditLimitCents);
    const creditLimitCents = Number.isSafeInteger(configuredCreditLimitCents) && configuredCreditLimitCents >= 0
        ? configuredCreditLimitCents
        : defaultCreditLimitCents;
    const creditLimitNanos = centsToNanos(creditLimitCents);
    const apiKeyEncryptionSecret = String(options.apiKeyEncryptionSecret ?? process.env.SHOP_API_KEY_ENCRYPTION_SECRET ?? '').trim();
    const shopChargeAuditLogDir = options.shopChargeAuditLogDir
        || process.env.SHOP_CHARGE_AUDIT_LOG_DIR
        || path.join(rootDir, 'data', 'logs', 'shop-charge-records');
    const modelListBaseUrl = String(
        options.modelListBaseUrl
        || process.env.CLIPROXY_BASE_URL
        || 'http://127.0.0.1:8317/v1'
    ).trim().replace(/\/+$/, '');
    const modelListFetch = options.modelListFetch || globalThis.fetch;
    const cliproxyConfigPath = String(options.cliproxyConfigPath ?? process.env.CLIPROXY_CONFIG_PATH ?? '').trim();
    const cliproxyConfigBackupDir = String(options.cliproxyConfigBackupDir ?? process.env.CLIPROXY_CONFIG_BACKUP_DIR ?? '').trim();
    const legacyKeyIssuanceDisabled = String(
        options.legacyKeyIssuanceDisabled ?? process.env.SHOP_LEGACY_KEY_ISSUANCE_DISABLED ?? ''
    ).trim().toLowerCase() === 'true';
    const sub2apiPublicUrl = normalizePublicHttpUrl(
        options.sub2apiPublicUrl ?? process.env.SUB2API_PUBLIC_URL,
        'https://aaccx.pw/login'
    );
    if (apiKeyEncryptionSecret) {
        assertStrongSecret('SHOP_API_KEY_ENCRYPTION_SECRET', apiKeyEncryptionSecret, { production });
    }

    function apiKeyStorage(apiKey) {
        const apiKeyHash = hashApiKey(apiKey);
        if (!apiKeyEncryptionSecret) {
            return {
                apiKey: String(apiKey || ''),
                apiKeyHash,
                apiKeyCiphertext: null,
                apiKeyNonce: null
            };
        }
        const envelope = encryptApiKeyEnvelope(apiKey, apiKeyEncryptionSecret);
        return {
            apiKey: `enc_${apiKeyHash}`,
            apiKeyHash,
            apiKeyCiphertext: envelope.api_key_ciphertext,
            apiKeyNonce: envelope.api_key_nonce
        };
    }

    function plainApiKey(row) {
        return readStoredApiKey(row, apiKeyEncryptionSecret);
    }

    function syncRedeemedApiKeyToCliProxy(apiKey) {
        try {
            return syncApiKeyToCliProxyConfig({
                apiKey,
                configPath: cliproxyConfigPath,
                backupDir: cliproxyConfigBackupDir,
                now: appNow
            });
        } catch (cause) {
            const error = new Error(`CLIProxyAPI 入口配置同步失败：${cause.message}`);
            error.status = 500;
            error.code = 'CLIPROXY_SYNC_FAILED';
            throw error;
        }
    }

    function toOrder(row) {
        return {
            id: row.id,
            phone: row.phone,
            productName: row.product_name,
            amount: row.amount,
            apiKey: plainApiKey(row),
            apiKeyPreview: row.api_key_preview,
            redeemedAt: row.redeemed_at,
            expiresAt: row.expires_at,
            resultToken: row.result_token || ''
        };
    }

    function toInvite(row) {
        return {
            code: row.code,
            status: row.status,
            createdAt: row.created_at,
            redeemedAt: row.redeemed_at || '',
            phone: row.redeemed_by_phone || '',
            orderId: row.order_id || ''
        };
    }

    function getOrderStatus(order) {
        return new Date(order.expiresAt).getTime() > Date.now() ? 'active' : 'expired';
    }

    function publicOrder(order, opts = {}) {
        const payload = {
            id: order.id,
            phone: order.phone,
            productName: order.productName,
            amount: order.amount,
            apiKeyPreview: order.apiKeyPreview,
            status: getOrderStatus(order),
            redeemedAt: order.redeemedAt,
            expiresAt: order.expiresAt
        };
        if (opts.includeApiKey) {
            payload.apiKey = order.apiKey;
        }
        return payload;
    }

    function publicInvite(invite) {
        return {
            code: invite.code,
            status: invite.status,
            apiKeyPreview: invite.apiKeyPreview,
            phone: invite.phone,
            orderId: invite.orderId,
            createdAt: invite.createdAt,
            redeemedAt: invite.redeemedAt
        };
    }

    async function fetchModelIds(apiKey) {
        if (!apiKey || typeof modelListFetch !== 'function') return [];
        const response = await modelListFetch(`${modelListBaseUrl}/models`, {
            headers: {
                Authorization: `Bearer ${apiKey}`
            }
        });
        if (!response?.ok) return [];
        return normalizeModelList(await response.json().catch(() => ({})));
    }

    async function accountModelOverview(phone) {
        const checkedAt = nowIso(appNow());
        let source = 'pricing_fallback';
        let models = pricingFallbackModelOverview();
        const orders = listOrdersByPhone.all(phone)
            .map(toOrder)
            .filter((order) => order.apiKey);
        if (!orders.length) {
            return { source, checkedAt, models };
        }

        for (const order of orders) {
            try {
                const modelIds = await fetchModelIds(order.apiKey);
                if (modelIds.length) {
                    source = 'live';
                    models = modelIds.map((model) => modelPriceOverview(model, true));
                    break;
                }
            } catch (error) {
                source = 'pricing_fallback';
                models = pricingFallbackModelOverview();
            }
        }
        return { source, checkedAt, models };
    }

    function publicApiKeyPoolItem(row) {
        return {
            apiKeyPreview: row.api_key_preview || '',
            status: row.status || '',
            createdAt: row.created_at || '',
            usedAt: row.used_at || '',
            orderId: row.order_id || ''
        };
    }

    function publicUsageKeyProfile(profile) {
        return {
            apiKeyHash: profile.api_key_hash,
            apiKeyPreview: profile.api_key_preview || '',
            group: profile.group_name,
            phone: profile.phone || ''
        };
    }

    function isAdminAccountPhone(phone) {
        return Boolean(adminAccountPhone && String(phone || '').trim() === adminAccountPhone);
    }

    function publicUser(phone) {
        return {
            phone,
            isAdmin: isAdminAccountPhone(phone)
        };
    }

    function ensureAccountBalance(phone) {
        ensureUser.run(phone, nowIso());
        ensureAccountBalanceRow.run(phone, creditLimitCents, creditLimitNanos, nowIso());
        return getAccountBalanceRow.get(phone);
    }

    function ensureAddonBalance(phone) {
        ensureUser.run(phone, nowIso());
        ensureAddonBalanceRow.run(phone, nowIso());
        return getAddonBalanceRow.get(phone);
    }

    function publicSubscriptionPlan(row) {
        return {
            id: row.id,
            name: row.name,
            monthlyPriceCents: row.monthly_price_cents ?? row.monthlyPriceCents,
            dailyQuotaUsdMicros: row.daily_quota_usd_micros ?? row.dailyQuotaUsdMicros,
            periodDays: row.period_days ?? row.periodDays,
            status: row.status || 'active'
        };
    }

    function publicSubscriptionOrder(row) {
        const plan = row.plan_id ? getSubscriptionPlanById.get(row.plan_id) : null;
        return {
            id: row.id,
            phone: row.phone,
            orderType: row.order_type,
            planId: row.plan_id || '',
            planName: plan?.name || '',
            amountCents: row.amount_cents,
            quotaUsdMicros: row.quota_usd_micros,
            paymentMethod: row.payment_method,
            paymentNote: row.payment_note || '',
            status: row.status,
            createdAt: row.created_at,
            confirmedAt: row.confirmed_at || '',
            confirmedByPhone: row.confirmed_by_phone || '',
            adminNote: row.admin_note || ''
        };
    }

    function publicSubscriptionRefundRequest(row) {
        if (!row) return null;
        const plan = row.plan_id ? getSubscriptionPlanById.get(row.plan_id) : null;
        return {
            id: row.id,
            phone: row.phone,
            subscriptionId: row.subscription_id,
            planId: row.plan_id,
            planName: row.plan_name || plan?.name || '',
            planAmountCents: row.plan_amount_cents,
            periodDays: row.period_days,
            remainingDays: row.remaining_days,
            refundAmountCents: row.refund_amount_cents,
            status: row.status,
            startedAt: row.started_at || '',
            expiresAt: row.expires_at || '',
            createdAt: row.created_at,
            confirmedAt: row.confirmed_at || '',
            confirmedByPhone: row.confirmed_by_phone || '',
            adminNote: row.admin_note || ''
        };
    }

    function publicAccountSubscription(row) {
        if (!row) return null;
        return {
            id: row.id,
            phone: row.phone,
            planId: row.plan_id,
            planName: row.plan_name,
            monthlyPriceCents: row.monthly_price_cents,
            dailyQuotaUsdMicros: row.daily_quota_usd_micros,
            periodDays: row.period_days,
            status: row.status,
            startedAt: row.started_at,
            expiresAt: row.expires_at
        };
    }

    function publicAddonLedgerEntry(row) {
        return {
            id: row.id,
            phone: row.phone,
            entryType: row.entry_type,
            amountUsdMicros: row.amount_usd_micros,
            balanceAfterUsdMicros: row.balance_after_usd_micros,
            relatedId: row.related_id || '',
            memo: row.memo || '',
            createdAt: row.created_at,
            createdByPhone: row.created_by_phone || ''
        };
    }

    function publicUsdChargeRecord(row) {
        return {
            id: row.id,
            phone: row.phone,
            usageEventId: row.usage_event_id,
            apiKeyHash: row.api_key_hash,
            model: row.model || 'unknown',
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            cacheHitInputTokens: row.cache_hit_input_tokens,
            cacheMissInputTokens: row.cache_miss_input_tokens,
            reasoningTokens: row.reasoning_tokens,
            totalTokens: row.total_tokens,
            officialPriceVersion: row.official_price_version,
            chargeUsdMicros: row.charge_usd_micros,
            dailyQuotaBeforeUsdMicros: row.daily_quota_before_usd_micros,
            dailyQuotaDeductedUsdMicros: row.daily_quota_deducted_usd_micros,
            dailyQuotaAfterUsdMicros: row.daily_quota_after_usd_micros,
            addonBalanceBeforeUsdMicros: row.addon_balance_before_usd_micros,
            addonDeductedUsdMicros: row.addon_deducted_usd_micros,
            addonBalanceAfterUsdMicros: row.addon_balance_after_usd_micros,
            overrunUsdMicros: row.overrun_usd_micros,
            quotaDate: row.quota_date,
            status: row.status,
            createdAt: row.created_at
        };
    }

    function accountSubscriptionQuotaStatus(phone, date = appNow()) {
        const quotaDate = chinaDateKey(date);
        const addonBalance = ensureAddonBalance(phone);
        const checkedAt = nowIso(date);
        const subscription = getActiveSubscriptionWithPlanByPhone.get(phone, checkedAt, checkedAt);
        const addonBalanceUsdMicros = Number(addonBalance?.balance_usd_micros || 0);
        if (!subscription) {
            return {
                active: false,
                code: 'subscription_required',
                quotaDate,
                dailyQuotaUsdMicros: 0,
                dailyUsedUsdMicros: 0,
                dailyRemainingUsdMicros: 0,
                addonBalanceUsdMicros,
                remainingUsdMicros: 0
            };
        }
        const dailyQuotaUsdMicros = Number(subscription.daily_quota_usd_micros || 0);
        const dailyUsedUsdMicros = Number(sumDailyQuotaDeductedByPhoneAndDate.get(phone, quotaDate)?.amount || 0);
        const dailyRemainingUsdMicros = Math.max(0, dailyQuotaUsdMicros - dailyUsedUsdMicros);
        const remainingUsdMicros = dailyRemainingUsdMicros + addonBalanceUsdMicros;
        return {
            active: remainingUsdMicros > 0,
            code: remainingUsdMicros > 0 ? 'active' : 'daily_quota_exhausted',
            quotaDate,
            dailyQuotaUsdMicros,
            dailyUsedUsdMicros,
            dailyRemainingUsdMicros,
            addonBalanceUsdMicros,
            remainingUsdMicros,
            subscription: publicAccountSubscription(subscription)
        };
    }

    function adminSubscriptionMonitorQuotaStatus(phone, date = appNow()) {
        const quotaDate = chinaDateKey(date);
        const plan = subscriptionPlanById(adminMonitorSubscriptionPlanId);
        const dailyQuotaUsdMicros = Number(plan?.dailyQuotaUsdMicros || 0);
        const dailyUsedUsdMicros = Number(sumDailyQuotaDeductedByPhoneAndDate.get(phone, quotaDate)?.amount || 0);
        const dailyRemainingUsdMicros = Math.max(0, dailyQuotaUsdMicros - dailyUsedUsdMicros);
        const addonBalanceUsdMicros = Number(ensureAddonBalance(phone)?.balance_usd_micros || 0);
        const remainingUsdMicros = dailyRemainingUsdMicros + addonBalanceUsdMicros;
        return {
            active: true,
            code: 'active',
            quotaDate,
            dailyQuotaUsdMicros,
            dailyUsedUsdMicros,
            dailyRemainingUsdMicros,
            addonBalanceUsdMicros,
            remainingUsdMicros,
            subscription: {
                planId: plan?.id || adminMonitorSubscriptionPlanId,
                planName: plan?.name || '59 元订阅池',
                expiresAt: ''
            }
        };
    }

    function subscriptionQuotaStatusForPhone(phone, date = appNow()) {
        return isAdminAccountPhone(phone)
            ? adminSubscriptionMonitorQuotaStatus(phone, date)
            : accountSubscriptionQuotaStatus(phone, date);
    }

    function buildAccountSubscriptionState(phone) {
        const quota = accountSubscriptionQuotaStatus(phone);
        const subscription = quota.subscription || null;
        return {
            plans: listSubscriptionPlans.all().map(publicSubscriptionPlan),
            addonPackages: addonPackages.map((item) => ({
                amountCents: item.amountCents,
                quotaUsdMicros: item.quotaUsdMicros
            })),
            subscription,
            quota: {
                quotaDate: quota.quotaDate,
                dailyQuotaUsdMicros: quota.dailyQuotaUsdMicros,
                dailyUsedUsdMicros: quota.dailyUsedUsdMicros,
                dailyRemainingUsdMicros: quota.dailyRemainingUsdMicros,
                addonBalanceUsdMicros: quota.addonBalanceUsdMicros,
                remainingUsdMicros: quota.remainingUsdMicros,
                active: quota.active,
                code: quota.code
            },
            payment: accountPaymentConfig(phone)
        };
    }

    function publicAccountBalance(row) {
        const balanceNanos = Number(row?.balance_nanos ?? signedCentsToNanos(row?.balance_cents || 0));
        const pendingTopupNanos = Number(row?.pending_topup_nanos ?? centsToNanos(row?.pending_topup_cents || 0));
        const creditLimit = Number(row?.credit_limit_cents || creditLimitCents);
        const creditLimitBalanceNanos = Number(row?.credit_limit_nanos ?? centsToNanos(creditLimit));
        const balanceCents = nanosToBalanceCents(balanceNanos);
        const pendingTopupCents = nanosToBalanceCents(pendingTopupNanos);
        const debtNanos = balanceNanos < 0 ? Math.abs(balanceNanos) : 0;
        const debtCents = chargeNanosToCents(debtNanos);
        const status = balanceNanos < 0 ? 'debt' : balanceNanos === 0 ? 'empty' : 'available';
        return {
            phone: row.phone,
            balanceCents,
            balanceNanos,
            balanceAmount: nanosToCny(balanceNanos),
            pendingTopupCents,
            pendingTopupNanos,
            pendingTopupAmount: nanosToCny(pendingTopupNanos),
            debtCents,
            debtNanos,
            debtAmount: nanosToCny(debtNanos),
            creditLimitCents: creditLimit,
            creditLimitNanos: creditLimitBalanceNanos,
            creditLimitAmount: nanosToCny(creditLimitBalanceNanos),
            creditExceeded: balanceNanos < -creditLimitBalanceNanos,
            status,
            updatedAt: row.updated_at
        };
    }

    function billingStatusForPhone(phone) {
        return publicAccountBalance(ensureAccountBalance(phone));
    }

    function billingBlockedStatus(phone) {
        const billing = billingStatusForPhone(phone);
        if (billing.balanceNanos >= 0) {
            return { blocked: false, billing };
        }
        return { blocked: true, billing };
    }

    function paymentReferenceForPhone(phone) {
        const parts = chinaParts(new Date());
        const maskedPhone = `${phone.slice(0, 3)}****${phone.slice(-4)}`;
        return `YUI-${parts.year}${pad2(parts.month)}-${maskedPhone}`;
    }

    function accountPaymentConfig(phone) {
        return {
            alipayQrUrl: options.alipayQrUrl ?? process.env.SHOP_ALIPAY_QR_URL ?? '/shop/assets/pay/alipay-qr.png',
            wechatQrUrl: options.wechatQrUrl ?? process.env.SHOP_WECHAT_QR_URL ?? '/shop/assets/pay/wechat-qr.png',
            paymentReference: paymentReferenceForPhone(phone)
        };
    }

    function publicTopupRequest(row) {
        return {
            id: row.id,
            phone: row.phone,
            requestedAmountCents: row.requested_amount_cents,
            requestedAmount: centsToCny(row.requested_amount_cents),
            confirmedAmountCents: row.confirmed_amount_cents ?? null,
            confirmedAmount: row.confirmed_amount_cents === null || row.confirmed_amount_cents === undefined
                ? null
                : centsToCny(row.confirmed_amount_cents),
            paymentMethod: row.payment_method,
            paymentTime: row.payment_time || '',
            paymentNote: row.payment_note || '',
            screenshotPath: row.screenshot_path || '',
            status: row.status,
            adminNote: row.admin_note || '',
            createdAt: row.created_at,
            confirmedAt: row.confirmed_at || '',
            confirmedByPhone: row.confirmed_by_phone || '',
            rejectedAt: row.rejected_at || '',
            rejectedByPhone: row.rejected_by_phone || ''
        };
    }

    function refreshPendingTopupCents(phone) {
        ensureAccountBalance(phone);
        const row = sumPendingTopupsByPhone.get(phone);
        const pendingTopupCents = Number(row?.pending_topup_cents || 0);
        updatePendingTopupCents.run(pendingTopupCents, centsToNanos(pendingTopupCents), nowIso(), phone);
        return pendingTopupCents;
    }

    function normalizeTopupRequestBody(body = {}) {
        return {
            requestedAmountCents: parsePositiveCnyToCents(body.amount ?? body.requestedAmount),
            paymentMethod: normalizePaymentMethod(body.paymentMethod ?? body.payment_method),
            paymentTime: String(body.paymentTime || body.payment_time || '').trim(),
            paymentNote: String(body.paymentNote || body.payment_note || '').trim().slice(0, 500),
            screenshotPath: String(body.screenshotPath || body.screenshot_path || '').trim().slice(0, 500)
        };
    }

    function publicLedgerEntry(row) {
        return {
            id: row.id,
            phone: row.phone,
            entryType: row.entry_type,
            amountCents: row.amount_cents,
            amountNanos: row.amount_nanos,
            amount: nanosToCny(row.amount_nanos ?? signedCentsToNanos(row.amount_cents)),
            balanceAfterCents: row.balance_after_cents,
            balanceAfterNanos: row.balance_after_nanos,
            balanceAfter: nanosToCny(row.balance_after_nanos ?? signedCentsToNanos(row.balance_after_cents)),
            currency: row.currency,
            relatedId: row.related_id || '',
            memo: row.memo || '',
            createdAt: row.created_at,
            createdByPhone: row.created_by_phone || ''
        };
    }

    function publicApiChargeRecord(row) {
        return {
            id: row.id,
            phone: row.phone,
            usageEventId: row.usage_event_id,
            apiKeyHash: row.api_key_hash,
            model: row.model || 'unknown',
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            cacheHitInputTokens: row.cache_hit_input_tokens,
            cacheMissInputTokens: row.cache_miss_input_tokens,
            reasoningTokens: row.reasoning_tokens,
            totalTokens: row.total_tokens,
            priceVersion: row.price_version,
            chargeCents: row.charge_cents,
            chargeNanos: row.charge_nanos,
            chargeAmount: nanosToCny(row.charge_nanos ?? centsToNanos(row.charge_cents)),
            balanceBeforeCents: row.balance_before_cents,
            balanceBeforeNanos: row.balance_before_nanos,
            balanceBefore: nanosToCny(row.balance_before_nanos ?? signedCentsToNanos(row.balance_before_cents)),
            balanceAfterCents: row.balance_after_cents,
            balanceAfterNanos: row.balance_after_nanos,
            balanceAfter: nanosToCny(row.balance_after_nanos ?? signedCentsToNanos(row.balance_after_cents)),
            status: row.status,
            createdAt: row.created_at,
            usageRequestedAt: row.usage_requested_at || ''
        };
    }


    function requireInternal(req, res, next) {
        const expected = options.internalToken ?? process.env.INTERNAL_TOKEN;
        const actual = req.header('x-internal-token');
        if (!expected) {
            return res.status(503).json({
                code: 'INTERNAL_TOKEN_NOT_CONFIGURED',
                message: '请先在 .env 中配置 INTERNAL_TOKEN。'
            });
        }
        if (!actual || !safeEqual(actual, expected)) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: '内部 token 无效。' });
        }
        return next();
    }

    function blockSensitiveStaticPaths(req, res, next) {
        if (req.path.startsWith('/api/')) return next();
        if (isRetiredShopPath(req.path)) {
            return next();
        }
        if (!isAllowedPublicStaticPath(req.path)) {
            return res.status(404).sendFile(path.join(rootDir, '404.html'));
        }
        return next();
    }

    function setSecurityHeaders(req, res, next) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        if (req.secure || req.header('x-forwarded-proto') === 'https') {
            res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
        }
        if (req.path.startsWith('/api/')) {
            res.setHeader('Cache-Control', 'no-store');
        }
        return next();
    }


    const insertInvite = db.prepare(`
INSERT INTO invite_codes (code, status, created_at)
VALUES (@code, 'unused', @createdAt)
`);

    const listInvites = db.prepare(`
SELECT code, status, created_at, redeemed_at, redeemed_by_phone, order_id
FROM invite_codes
ORDER BY created_at DESC
`);

    const getInvite = db.prepare(`
SELECT code, status, created_at, redeemed_at, redeemed_by_phone, order_id
FROM invite_codes
WHERE code = ?
`);

    const insertApiKey = db.prepare(`
INSERT INTO api_keys (api_key, api_key_preview, api_key_hash, api_key_ciphertext, api_key_nonce, status, created_at)
VALUES (?, ?, ?, ?, ?, 'unused', ?)
`);

    const getApiKey = db.prepare(`
SELECT api_key, api_key_preview, api_key_hash, api_key_ciphertext, api_key_nonce, status, created_at, used_at, order_id
FROM api_keys
WHERE api_key = ?
`);

    const getApiKeyByHash = db.prepare(`
SELECT api_key, api_key_preview, api_key_hash, api_key_ciphertext, api_key_nonce, status, created_at, used_at, order_id
FROM api_keys
WHERE api_key_hash = ?
`);

    const getNextUnusedApiKey = db.prepare(`
SELECT api_key, api_key_preview, api_key_hash, api_key_ciphertext, api_key_nonce, status, created_at, used_at, order_id
FROM api_keys
WHERE status = 'unused'
ORDER BY created_at ASC, api_key ASC
LIMIT 1
`);

    const listApiKeysForAdmin = db.prepare(`
SELECT api_key_preview, status, created_at, used_at, order_id
FROM api_keys
ORDER BY created_at DESC, api_key_preview ASC
`);

    const markApiKeyUsed = db.prepare(`
UPDATE api_keys
SET status = 'used',
    used_at = @usedAt,
    order_id = @orderId
WHERE api_key_hash = @apiKeyHash AND status = 'unused'
`);

    const ensureUser = db.prepare(`
INSERT INTO users (phone, created_at)
VALUES (?, ?)
ON CONFLICT(phone) DO NOTHING
`);

    const ensureAccountBalanceRow = db.prepare(`
INSERT INTO account_balances (
  phone, balance_cents, balance_nanos, pending_topup_cents, pending_topup_nanos,
  credit_limit_cents, credit_limit_nanos, updated_at
)
VALUES (?, 0, 0, 0, 0, ?, ?, ?)
ON CONFLICT(phone) DO NOTHING
`);

    const getAccountBalanceRow = db.prepare(`
SELECT phone, balance_cents, balance_nanos, pending_topup_cents, pending_topup_nanos,
       credit_limit_cents, credit_limit_nanos, updated_at
FROM account_balances
WHERE phone = ?
`);

    const getSubscriptionPlanById = db.prepare(`
SELECT id, name, monthly_price_cents, daily_quota_usd_micros, period_days, status, created_at, updated_at
FROM subscription_plans
WHERE id = ? AND status = 'active'
`);

    const listSubscriptionPlans = db.prepare(`
SELECT id, name, monthly_price_cents, daily_quota_usd_micros, period_days, status, created_at, updated_at
FROM subscription_plans
WHERE status = 'active'
ORDER BY monthly_price_cents ASC
`);

    const insertSubscriptionOrder = db.prepare(`
INSERT INTO subscription_orders (
  id, phone, order_type, plan_id, amount_cents, quota_usd_micros, payment_method,
  payment_note, status, created_at
)
VALUES (
  @id, @phone, @orderType, @planId, @amountCents, @quotaUsdMicros, @paymentMethod,
  @paymentNote, 'pending', @createdAt
)
`);

    const getSubscriptionOrderById = db.prepare(`
SELECT id, phone, order_type, plan_id, amount_cents, quota_usd_micros, payment_method,
       payment_note, status, created_at, confirmed_at, confirmed_by_phone, admin_note
FROM subscription_orders
WHERE id = ?
`);

    const listSubscriptionOrdersByPhoneAndType = db.prepare(`
SELECT id, phone, order_type, plan_id, amount_cents, quota_usd_micros, payment_method,
       payment_note, status, created_at, confirmed_at, confirmed_by_phone, admin_note
FROM subscription_orders
WHERE phone = ? AND order_type = ?
ORDER BY created_at DESC
LIMIT ?
`);

    const listSubscriptionOrdersForAdmin = db.prepare(`
SELECT id, phone, order_type, plan_id, amount_cents, quota_usd_micros, payment_method,
       payment_note, status, created_at, confirmed_at, confirmed_by_phone, admin_note
FROM subscription_orders
WHERE order_type = ? AND (? = 'all' OR status = ?)
ORDER BY created_at DESC
LIMIT ?
`);

    const approveSubscriptionOrderById = db.prepare(`
UPDATE subscription_orders
SET status = 'approved',
    confirmed_at = ?,
    confirmed_by_phone = ?,
    admin_note = ?
WHERE id = ? AND status = 'pending'
`);

    const rejectSubscriptionOrderById = db.prepare(`
UPDATE subscription_orders
SET status = 'rejected',
    confirmed_at = ?,
    confirmed_by_phone = ?,
    admin_note = ?
WHERE id = ? AND status = 'pending'
`);

    const getActiveSubscriptionWithPlanByPhone = db.prepare(`
SELECT s.id, s.phone, s.plan_id, s.status, s.started_at, s.expires_at, s.created_at, s.updated_at,
       p.name AS plan_name, p.monthly_price_cents, p.daily_quota_usd_micros, p.period_days
FROM account_subscriptions s
JOIN subscription_plans p ON p.id = s.plan_id
WHERE s.phone = ?
  AND s.status = 'active'
  AND datetime(s.started_at) <= datetime(?)
  AND datetime(s.expires_at) > datetime(?)
ORDER BY s.expires_at DESC
LIMIT 1
`);

    const getAnyActiveSubscriptionByPhone = db.prepare(`
SELECT id, phone, plan_id, status, started_at, expires_at, created_at, updated_at
FROM account_subscriptions
WHERE phone = ? AND status = 'active'
ORDER BY expires_at DESC
LIMIT 1
`);

    const insertAccountSubscription = db.prepare(`
INSERT INTO account_subscriptions (
  id, phone, plan_id, status, started_at, expires_at, created_at, updated_at
)
VALUES (
  @id, @phone, @planId, 'active', @startedAt, @expiresAt, @createdAt, @updatedAt
)
`);

    const updateAccountSubscriptionPlan = db.prepare(`
UPDATE account_subscriptions
SET plan_id = @planId,
    expires_at = @expiresAt,
    updated_at = @updatedAt
WHERE id = @id
`);

    const getAccountSubscriptionWithPlanById = db.prepare(`
SELECT s.id, s.phone, s.plan_id, s.status, s.started_at, s.expires_at, s.created_at, s.updated_at,
       p.name AS plan_name, p.monthly_price_cents, p.daily_quota_usd_micros, p.period_days
FROM account_subscriptions s
JOIN subscription_plans p ON p.id = s.plan_id
WHERE s.id = ?
`);

    const cancelAccountSubscriptionById = db.prepare(`
UPDATE account_subscriptions
SET status = 'cancelled',
    updated_at = ?
WHERE id = ? AND status = 'active'
`);

    const insertSubscriptionRefundRequest = db.prepare(`
INSERT INTO subscription_refund_requests (
  id, phone, subscription_id, plan_id, plan_amount_cents, period_days,
  remaining_days, refund_amount_cents, status, created_at
)
VALUES (
  @id, @phone, @subscriptionId, @planId, @planAmountCents, @periodDays,
  @remainingDays, @refundAmountCents, 'pending', @createdAt
)
`);

    const getSubscriptionRefundRequestById = db.prepare(`
SELECT r.id, r.phone, r.subscription_id, r.plan_id, r.plan_amount_cents, r.period_days,
       r.remaining_days, r.refund_amount_cents, r.status, r.created_at,
       r.confirmed_at, r.confirmed_by_phone, r.admin_note,
       s.started_at, s.expires_at, p.name AS plan_name
FROM subscription_refund_requests r
LEFT JOIN account_subscriptions s ON s.id = r.subscription_id
LEFT JOIN subscription_plans p ON p.id = r.plan_id
WHERE r.id = ?
`);

    const getPendingSubscriptionRefundBySubscriptionId = db.prepare(`
SELECT r.id, r.phone, r.subscription_id, r.plan_id, r.plan_amount_cents, r.period_days,
       r.remaining_days, r.refund_amount_cents, r.status, r.created_at,
       r.confirmed_at, r.confirmed_by_phone, r.admin_note,
       s.started_at, s.expires_at, p.name AS plan_name
FROM subscription_refund_requests r
LEFT JOIN account_subscriptions s ON s.id = r.subscription_id
LEFT JOIN subscription_plans p ON p.id = r.plan_id
WHERE r.subscription_id = ? AND r.status = 'pending'
LIMIT 1
`);

    const listSubscriptionRefundRequestsByPhone = db.prepare(`
SELECT r.id, r.phone, r.subscription_id, r.plan_id, r.plan_amount_cents, r.period_days,
       r.remaining_days, r.refund_amount_cents, r.status, r.created_at,
       r.confirmed_at, r.confirmed_by_phone, r.admin_note,
       s.started_at, s.expires_at, p.name AS plan_name
FROM subscription_refund_requests r
LEFT JOIN account_subscriptions s ON s.id = r.subscription_id
LEFT JOIN subscription_plans p ON p.id = r.plan_id
WHERE r.phone = ?
ORDER BY r.created_at DESC, r.rowid DESC
LIMIT ?
`);

    const listSubscriptionRefundRequestsForAdmin = db.prepare(`
SELECT r.id, r.phone, r.subscription_id, r.plan_id, r.plan_amount_cents, r.period_days,
       r.remaining_days, r.refund_amount_cents, r.status, r.created_at,
       r.confirmed_at, r.confirmed_by_phone, r.admin_note,
       s.started_at, s.expires_at, p.name AS plan_name
FROM subscription_refund_requests r
LEFT JOIN account_subscriptions s ON s.id = r.subscription_id
LEFT JOIN subscription_plans p ON p.id = r.plan_id
WHERE (? = 'all' OR r.status = ?)
ORDER BY r.created_at DESC, r.rowid DESC
LIMIT ?
`);

    const approveSubscriptionRefundById = db.prepare(`
UPDATE subscription_refund_requests
SET status = 'approved',
    confirmed_at = ?,
    confirmed_by_phone = ?,
    admin_note = ?
WHERE id = ? AND status = 'pending'
`);

    const rejectSubscriptionRefundById = db.prepare(`
UPDATE subscription_refund_requests
SET status = 'rejected',
    confirmed_at = ?,
    confirmed_by_phone = ?,
    admin_note = ?
WHERE id = ? AND status = 'pending'
`);

    const ensureAddonBalanceRow = db.prepare(`
INSERT INTO account_addon_balances (phone, balance_usd_micros, updated_at)
VALUES (?, 0, ?)
ON CONFLICT(phone) DO NOTHING
`);

    const getAddonBalanceRow = db.prepare(`
SELECT phone, balance_usd_micros, updated_at
FROM account_addon_balances
WHERE phone = ?
`);

    const updateAddonBalance = db.prepare(`
UPDATE account_addon_balances
SET balance_usd_micros = ?,
    updated_at = ?
WHERE phone = ?
`);

    const insertAddonLedgerEntry = db.prepare(`
INSERT INTO account_addon_ledger_entries (
  id, phone, entry_type, amount_usd_micros, balance_after_usd_micros,
  related_id, memo, created_at, created_by_phone
)
VALUES (
  @id, @phone, @entryType, @amountUsdMicros, @balanceAfterUsdMicros,
  @relatedId, @memo, @createdAt, @createdByPhone
)
`);

    const listAddonLedgerByPhone = db.prepare(`
SELECT id, phone, entry_type, amount_usd_micros, balance_after_usd_micros,
       related_id, memo, created_at, created_by_phone
FROM account_addon_ledger_entries
WHERE phone = ?
ORDER BY created_at DESC, rowid DESC
LIMIT ?
`);

    const sumDailyQuotaDeductedByPhoneAndDate = db.prepare(`
SELECT COALESCE(SUM(daily_quota_deducted_usd_micros), 0) AS amount
FROM api_usd_charge_records
WHERE phone = ? AND quota_date = ? AND status = 'charged'
`);

    const getUsdChargeByUsageEventId = db.prepare(`
SELECT id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
       cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
       official_price_version, charge_usd_micros, daily_quota_before_usd_micros,
       daily_quota_deducted_usd_micros, daily_quota_after_usd_micros,
       addon_balance_before_usd_micros, addon_deducted_usd_micros,
       addon_balance_after_usd_micros, overrun_usd_micros, quota_date, status, created_at
FROM api_usd_charge_records
WHERE usage_event_id = ?
`);

    const insertUsdChargeRecord = db.prepare(`
INSERT INTO api_usd_charge_records (
  id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
  cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
  official_price_version, charge_usd_micros, daily_quota_before_usd_micros,
  daily_quota_deducted_usd_micros, daily_quota_after_usd_micros,
  addon_balance_before_usd_micros, addon_deducted_usd_micros,
  addon_balance_after_usd_micros, overrun_usd_micros, quota_date, status, created_at
)
VALUES (
  @id, @phone, @usageEventId, @apiKeyHash, @model, @inputTokens, @outputTokens,
  @cacheHitInputTokens, @cacheMissInputTokens, @reasoningTokens, @totalTokens,
  @officialPriceVersion, @chargeUsdMicros, @dailyQuotaBeforeUsdMicros,
  @dailyQuotaDeductedUsdMicros, @dailyQuotaAfterUsdMicros,
  @addonBalanceBeforeUsdMicros, @addonDeductedUsdMicros,
  @addonBalanceAfterUsdMicros, @overrunUsdMicros, @quotaDate, @status, @createdAt
)
`);

    const listUsdChargesByPhone = db.prepare(`
SELECT id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
       cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
       official_price_version, charge_usd_micros, daily_quota_before_usd_micros,
       daily_quota_deducted_usd_micros, daily_quota_after_usd_micros,
       addon_balance_before_usd_micros, addon_deducted_usd_micros,
       addon_balance_after_usd_micros, overrun_usd_micros, quota_date, status, created_at
FROM api_usd_charge_records
WHERE phone = ?
ORDER BY created_at DESC, rowid DESC
LIMIT ?
`);

    const listUsdChargesForAdmin = db.prepare(`
SELECT id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
       cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
       official_price_version, charge_usd_micros, daily_quota_before_usd_micros,
       daily_quota_deducted_usd_micros, daily_quota_after_usd_micros,
       addon_balance_before_usd_micros, addon_deducted_usd_micros,
       addon_balance_after_usd_micros, overrun_usd_micros, quota_date, status, created_at
FROM api_usd_charge_records
ORDER BY created_at DESC, rowid DESC
LIMIT ?
`);

    const listUsersForAdminBalances = db.prepare(`
SELECT phone
FROM users
WHERE phone != ?
ORDER BY created_at DESC, phone ASC
`);

    const insertTopupRequest = db.prepare(`
INSERT INTO topup_requests (
  id, phone, requested_amount_cents, payment_method, payment_time, payment_note,
  screenshot_path, status, created_at
)
VALUES (
  @id, @phone, @requestedAmountCents, @paymentMethod, @paymentTime, @paymentNote,
  @screenshotPath, 'pending', @createdAt
)
`);

    const listTopupRequestsByPhone = db.prepare(`
SELECT id, phone, requested_amount_cents, confirmed_amount_cents, payment_method,
       payment_time, payment_note, screenshot_path, status, admin_note, created_at,
       confirmed_at, confirmed_by_phone, rejected_at, rejected_by_phone
FROM topup_requests
WHERE phone = ?
ORDER BY created_at DESC
LIMIT ?
`);

    const sumPendingTopupsByPhone = db.prepare(`
SELECT COALESCE(SUM(requested_amount_cents), 0) AS pending_topup_cents
FROM topup_requests
WHERE phone = ? AND status = 'pending'
`);

    const updatePendingTopupCents = db.prepare(`
UPDATE account_balances
SET pending_topup_cents = ?,
    pending_topup_nanos = ?,
    updated_at = ?
WHERE phone = ?
`);

    const listTopupRequestsForAdmin = db.prepare(`
SELECT id, phone, requested_amount_cents, confirmed_amount_cents, payment_method,
       payment_time, payment_note, screenshot_path, status, admin_note, created_at,
       confirmed_at, confirmed_by_phone, rejected_at, rejected_by_phone
FROM topup_requests
WHERE (? = 'all' OR status = ?)
ORDER BY created_at DESC
LIMIT ?
`);

    const getTopupRequestById = db.prepare(`
SELECT id, phone, requested_amount_cents, confirmed_amount_cents, payment_method,
       payment_time, payment_note, screenshot_path, status, admin_note, created_at,
       confirmed_at, confirmed_by_phone, rejected_at, rejected_by_phone
FROM topup_requests
WHERE id = ?
`);

    const approveTopupRequestById = db.prepare(`
UPDATE topup_requests
SET status = 'approved',
    confirmed_amount_cents = ?,
    admin_note = ?,
    confirmed_at = ?,
    confirmed_by_phone = ?
WHERE id = ? AND status = 'pending'
`);

    const rejectTopupRequestById = db.prepare(`
UPDATE topup_requests
SET status = 'rejected',
    admin_note = ?,
    rejected_at = ?,
    rejected_by_phone = ?
WHERE id = ? AND status = 'pending'
`);

    const updateBalanceCents = db.prepare(`
UPDATE account_balances
SET balance_cents = ?,
    balance_nanos = ?,
    updated_at = ?
WHERE phone = ?
`);

    const insertLedgerEntry = db.prepare(`
INSERT INTO account_ledger_entries (
  id, phone, entry_type, amount_cents, amount_nanos, balance_after_cents, balance_after_nanos, currency,
  related_id, memo, created_at, created_by_phone
)
VALUES (
  @id, @phone, @entryType, @amountCents, @amountNanos, @balanceAfterCents, @balanceAfterNanos, 'CNY',
  @relatedId, @memo, @createdAt, @createdByPhone
)
`);

    const getPhoneByUsageApiKeyHash = db.prepare(`
SELECT o.phone AS phone
FROM api_keys ak
JOIN orders o ON o.api_key = ak.api_key
WHERE ak.api_key_hash = ?
UNION
SELECT phone
FROM usage_key_profiles
WHERE api_key_hash = ? AND phone != ''
LIMIT 1
`);

    const getApiChargeByUsageEventId = db.prepare(`
SELECT id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
       cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
       price_version, charge_cents, charge_nanos, balance_before_cents,
       balance_before_nanos, balance_after_cents, balance_after_nanos, status, created_at
FROM api_charge_records
WHERE usage_event_id = ?
`);

    const insertApiChargeRecord = db.prepare(`
INSERT INTO api_charge_records (
  id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
  cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
  price_version, charge_cents, charge_nanos, balance_before_cents, balance_before_nanos,
  balance_after_cents, balance_after_nanos, status, created_at
)
VALUES (
  @id, @phone, @usageEventId, @apiKeyHash, @model, @inputTokens, @outputTokens,
  @cacheHitInputTokens, @cacheMissInputTokens, @reasoningTokens, @totalTokens,
  @priceVersion, @chargeCents, @chargeNanos, @balanceBeforeCents, @balanceBeforeNanos,
  @balanceAfterCents, @balanceAfterNanos, @status, @createdAt
)
`);

    const listLedgerEntriesByPhone = db.prepare(`
SELECT id, phone, entry_type, amount_cents, amount_nanos, balance_after_cents,
       balance_after_nanos, currency, related_id, memo, created_at, created_by_phone
FROM account_ledger_entries
WHERE phone = ?
ORDER BY created_at DESC, rowid DESC
LIMIT ?
`);

    const listApiChargeRecordsByPhone = db.prepare(`
SELECT acr.id, acr.phone, acr.usage_event_id, acr.api_key_hash, acr.model, acr.input_tokens, acr.output_tokens,
       acr.cache_hit_input_tokens, acr.cache_miss_input_tokens, acr.reasoning_tokens, acr.total_tokens,
       acr.price_version, acr.charge_cents, acr.charge_nanos, acr.balance_before_cents,
       acr.balance_before_nanos, acr.balance_after_cents, acr.balance_after_nanos, acr.status, acr.created_at,
       ue.requested_at AS usage_requested_at
FROM api_charge_records acr
LEFT JOIN usage_events ue ON ue.request_id = acr.usage_event_id
WHERE acr.phone = ?
ORDER BY acr.created_at DESC, acr.rowid DESC
LIMIT ?
`);

    const listApiChargeRecordsForBillingByPhone = db.prepare(`
SELECT acr.id, acr.phone, acr.usage_event_id, acr.api_key_hash, acr.model, acr.input_tokens, acr.output_tokens,
       acr.cache_hit_input_tokens, acr.cache_miss_input_tokens, acr.reasoning_tokens, acr.total_tokens,
       acr.price_version, acr.charge_cents, acr.charge_nanos, acr.balance_before_cents,
       acr.balance_before_nanos, acr.balance_after_cents, acr.balance_after_nanos, acr.status, acr.created_at,
       ue.requested_at AS usage_requested_at
FROM api_charge_records acr
LEFT JOIN usage_events ue ON ue.request_id = acr.usage_event_id
WHERE acr.phone = ?
ORDER BY acr.created_at DESC, acr.rowid DESC
`);

    const listApiChargeRecordsForBilling = db.prepare(`
SELECT acr.id, acr.phone, acr.usage_event_id, acr.api_key_hash, acr.model, acr.input_tokens, acr.output_tokens,
       acr.cache_hit_input_tokens, acr.cache_miss_input_tokens, acr.reasoning_tokens, acr.total_tokens,
       acr.price_version, acr.charge_cents, acr.charge_nanos, acr.balance_before_cents,
       acr.balance_before_nanos, acr.balance_after_cents, acr.balance_after_nanos, acr.status, acr.created_at,
       ue.requested_at AS usage_requested_at
FROM api_charge_records acr
LEFT JOIN usage_events ue ON ue.request_id = acr.usage_event_id
ORDER BY acr.created_at DESC, acr.rowid DESC
`);

    const listApiChargeRecordsForShopBilling = db.prepare(`
SELECT acr.id, acr.phone, acr.usage_event_id, acr.api_key_hash, acr.model, acr.input_tokens, acr.output_tokens,
       acr.cache_hit_input_tokens, acr.cache_miss_input_tokens, acr.reasoning_tokens, acr.total_tokens,
       acr.price_version, acr.charge_cents, acr.charge_nanos, acr.balance_before_cents,
       acr.balance_before_nanos, acr.balance_after_cents, acr.balance_after_nanos, acr.status, acr.created_at,
       ue.requested_at AS usage_requested_at
FROM api_charge_records acr
LEFT JOIN usage_events ue ON ue.request_id = acr.usage_event_id
WHERE EXISTS (
  SELECT 1
  FROM api_keys ak
  JOIN orders o ON o.id = ak.order_id OR o.api_key = ak.api_key
  WHERE ak.api_key_hash = acr.api_key_hash
)
ORDER BY acr.created_at DESC, acr.rowid DESC
`);

    const getUserByPhone = db.prepare(`
SELECT phone, created_at, password_hash, password_created_at, updated_at
FROM users
WHERE phone = ?
`);

    const insertUserWithPassword = db.prepare(`
INSERT INTO users (phone, created_at, password_hash, password_created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
`);

    const setUserPassword = db.prepare(`
UPDATE users
SET password_hash = ?,
    password_created_at = ?,
    updated_at = ?
WHERE phone = ?
`);

    const insertAccountSession = db.prepare(`
INSERT INTO user_sessions (token_hash, phone, csrf_token_hash, created_at, expires_at)
VALUES (?, ?, ?, ?, ?)
`);

    const getAccountSessionByHash = db.prepare(`
SELECT token_hash, phone, csrf_token_hash, created_at, expires_at, revoked_at
FROM user_sessions
WHERE token_hash = ?
`);

    const revokeAccountSession = db.prepare(`
UPDATE user_sessions
SET revoked_at = ?
WHERE token_hash = ? AND revoked_at IS NULL
`);

    const revokeAccountSessionsByPhone = db.prepare(`
UPDATE user_sessions
SET revoked_at = ?
WHERE phone = ? AND revoked_at IS NULL
`);

    const insertPasswordResetCode = db.prepare(`
INSERT INTO password_reset_codes (id, phone, code_hash, created_at, expires_at, created_by_phone)
VALUES (?, ?, ?, ?, ?, ?)
`);

    const getPasswordResetCodeByHash = db.prepare(`
SELECT id, phone, code_hash, created_at, expires_at, used_at, created_by_phone
FROM password_reset_codes
WHERE code_hash = ?
`);

    const markPasswordResetCodeUsed = db.prepare(`
UPDATE password_reset_codes
SET used_at = ?
WHERE id = ? AND used_at IS NULL
`);

    const insertOrder = db.prepare(`
INSERT INTO orders (
  id, phone, invite_code, api_key, api_key_ciphertext, api_key_nonce,
  api_key_preview, product_name, amount, redeemed_at, expires_at, result_token
)
VALUES (
  @id, @phone, @inviteCode, @apiKey, @apiKeyCiphertext, @apiKeyNonce,
  @apiKeyPreview, @productName, @amount, @redeemedAt, @expiresAt, @resultToken
)
`);

    const markInviteRedeemed = db.prepare(`
UPDATE invite_codes
SET status = 'redeemed',
    redeemed_at = @redeemedAt,
    redeemed_by_phone = @phone,
    order_id = @orderId
WHERE code = @code
`);

    const listOrdersByPhone = db.prepare(`
SELECT id, phone, api_key, api_key_ciphertext, api_key_nonce, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token
FROM orders
WHERE phone = ?
ORDER BY redeemed_at DESC
`);

    const getOrderByResultToken = db.prepare(`
SELECT id, phone, api_key, api_key_ciphertext, api_key_nonce, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token
FROM orders
WHERE result_token = ?
`);

    const getOrderByApiKey = db.prepare(`
SELECT id, phone, api_key, api_key_ciphertext, api_key_nonce, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token
FROM orders
WHERE api_key = ?
`);

    const getOrderById = db.prepare(`
SELECT id, phone, api_key, api_key_ciphertext, api_key_nonce, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token
FROM orders
WHERE id = ?
`);

    const getOrderByIdAndPhone = db.prepare(`
SELECT id, phone, api_key, api_key_ciphertext, api_key_nonce, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token
FROM orders
WHERE id = ? AND phone = ?
`);

    const insertUsageEvent = db.prepare(`
INSERT OR IGNORE INTO usage_events (
  request_id, api_key_hash, api_key_preview, provider, model, endpoint, source, auth_index,
  success, failed, input_tokens, output_tokens, reasoning_tokens, cached_tokens,
  cache_hit_input_tokens, cache_miss_input_tokens, total_tokens, latency_ms,
  requested_at, received_at, price_amount_micros, price_currency
)
VALUES (
  @requestId, @apiKeyHash, @apiKeyPreview, @provider, @model, @endpoint, @source, @authIndex,
  @success, @failed, @inputTokens, @outputTokens, @reasoningTokens, @cachedTokens,
  @cacheHitInputTokens, @cacheMissInputTokens, @totalTokens, @latencyMs,
  @requestedAt, @receivedAt, @priceAmountMicros, @priceCurrency
)
`);

    const listUsageEvents = db.prepare(`
SELECT request_id, api_key_hash, api_key_preview, provider, model, endpoint, source, auth_index,
       success, failed, input_tokens, output_tokens, reasoning_tokens, cached_tokens,
       cache_hit_input_tokens, cache_miss_input_tokens, total_tokens, latency_ms,
       requested_at, received_at, price_amount_micros, price_currency
FROM usage_events
ORDER BY requested_at DESC
`);

    const listUsageKeyProfiles = db.prepare(`
SELECT api_key_hash, api_key_preview, group_name, phone, created_at, updated_at
FROM usage_key_profiles
`);

    const upsertUsageKeyProfile = db.prepare(`
INSERT INTO usage_key_profiles (api_key_hash, api_key_preview, group_name, phone, created_at, updated_at)
VALUES (@apiKeyHash, @apiKeyPreview, @groupName, @phone, @now, @now)
ON CONFLICT(api_key_hash) DO UPDATE SET
  api_key_preview = excluded.api_key_preview,
  group_name = excluded.group_name,
  phone = excluded.phone,
  updated_at = excluded.updated_at
`);

    const listApiKeysForUsage = db.prepare(`
SELECT ak.api_key_hash, ak.api_key_preview, ak.status AS key_status, ak.created_at, ak.used_at,
       o.phone, o.redeemed_at, o.expires_at
FROM api_keys ak
LEFT JOIN orders o ON o.id = ak.order_id OR o.api_key = ak.api_key
WHERE ak.api_key_hash IS NOT NULL AND ak.api_key_hash != ''
ORDER BY ak.created_at DESC, ak.api_key_preview ASC
`);

    const createInvites = db.transaction((count) => {
        const created = [];
        for (let index = 0; index < count; index += 1) {
            let code = createInviteCode();
            while (getInvite.get(code)) {
                code = createInviteCode();
            }
            const invite = {
                code,
                createdAt: nowIso()
            };
            insertInvite.run(invite);
            created.push({
                code: invite.code
            });
        }
        return created;
    });

    const importApiKeys = db.transaction((apiKeys) => {
        const imported = [];
        for (const apiKey of apiKeys) {
            const storage = apiKeyStorage(apiKey);
            if (getApiKeyByHash.get(storage.apiKeyHash)) {
                const error = new Error('API key 已存在。');
                error.status = 409;
                error.code = 'API_KEY_EXISTS';
                throw error;
            }
            const apiKeyPreview = keyPreview(apiKey);
            insertApiKey.run(
                storage.apiKey,
                apiKeyPreview,
                storage.apiKeyHash,
                storage.apiKeyCiphertext,
                storage.apiKeyNonce,
                nowIso()
            );
            imported.push({ apiKeyPreview, status: 'unused' });
        }
        return imported;
    });

    function buildInviteConsole() {
        const invites = listInvites.all().map((row) => publicInvite(toInvite(row)));
        const apiKeyPool = listApiKeysForAdmin.all().map(publicApiKeyPoolItem);
        return {
            summary: {
                unusedInvites: invites.filter((invite) => invite.status === 'unused').length,
                redeemedInvites: invites.filter((invite) => invite.status === 'redeemed').length,
                unusedApiKeys: apiKeyPool.filter((apiKey) => apiKey.status === 'unused').length,
                usedApiKeys: apiKeyPool.filter((apiKey) => apiKey.status === 'used').length,
                disabledApiKeys: apiKeyPool.filter((apiKey) => apiKey.status === 'disabled').length
            },
            invites,
            apiKeyPool
        };
    }

    const redeemInvite = db.transaction(({ phone, code }) => {
        const row = getInvite.get(code);
        const invite = row ? toInvite(row) : null;
        if (!invite) {
            const error = new Error('邀请码不存在。');
            error.status = 404;
            error.code = 'INVITE_NOT_FOUND';
            throw error;
        }
        if (invite.status !== 'unused') {
            const error = new Error('该邀请码已经被兑换。');
            error.status = 409;
            error.code = 'INVITE_USED';
            throw error;
        }

        const apiKeyRow = getNextUnusedApiKey.get();
        if (!apiKeyRow) {
            const error = new Error('当前没有可用的 API key。');
            error.status = 409;
            error.code = 'NO_AVAILABLE_API_KEY';
            throw error;
        }

        const redeemedAt = new Date();
        let resultToken = createResultToken();
        while (getOrderByResultToken.get(resultToken)) {
            resultToken = createResultToken();
        }
        const apiKey = plainApiKey(apiKeyRow);
        syncRedeemedApiKeyToCliProxy(apiKey);
        const orderStorage = apiKeyStorage(apiKey);
        const order = {
            id: createId('ORDER'),
            phone,
            inviteCode: invite.code,
            productName: product.name,
            amount: product.amount,
            apiKey: orderStorage.apiKey,
            apiKeyCiphertext: orderStorage.apiKeyCiphertext,
            apiKeyNonce: orderStorage.apiKeyNonce,
            apiKeyPreview: apiKeyRow.api_key_preview,
            redeemedAt: nowIso(redeemedAt),
            expiresAt: nowIso(addDays(redeemedAt, durationDays)),
            resultToken
        };

        ensureUser.run(phone, nowIso());
        insertOrder.run(order);
        markApiKeyUsed.run({
            apiKeyHash: apiKeyRow.api_key_hash,
            usedAt: order.redeemedAt,
            orderId: order.id
        });
        markInviteRedeemed.run({
            code,
            phone,
            orderId: order.id,
            redeemedAt: order.redeemedAt
        });

        return { ...order, apiKey };
    });


    const createTopupRequest = db.transaction(({ phone, body }) => {
        ensureAccountBalance(phone);
        const normalized = normalizeTopupRequestBody(body);
        const topup = {
            id: createId('TOPUP'),
            phone,
            ...normalized,
            createdAt: nowIso()
        };
        insertTopupRequest.run(topup);
        refreshPendingTopupCents(phone);
        return topup;
    });

    const approveTopupRequest = db.transaction(({ id, confirmedAmountCents, adminNote, adminPhone }) => {
        const row = getTopupRequestById.get(id);
        if (!row || row.status !== 'pending') {
            const error = new Error('充值申请不是待确认状态。');
            error.status = 409;
            error.code = 'TOPUP_NOT_PENDING';
            throw error;
        }
        const phone = row.phone;
        const balanceRow = ensureAccountBalance(phone);
        const confirmedAmountNanos = centsToNanos(confirmedAmountCents);
        const nextBalanceNanos = Number(balanceRow.balance_nanos || 0) + confirmedAmountNanos;
        const nextBalanceCents = nanosToBalanceCents(nextBalanceNanos);
        const now = nowIso();
        const result = approveTopupRequestById.run(confirmedAmountCents, adminNote, now, adminPhone, id);
        if (result.changes !== 1) {
            const error = new Error('充值申请确认失败。');
            error.status = 409;
            error.code = 'TOPUP_NOT_PENDING';
            throw error;
        }
        updateBalanceCents.run(nextBalanceCents, nextBalanceNanos, now, phone);
        refreshPendingTopupCents(phone);
        insertLedgerEntry.run({
            id: createId('LEDGER'),
            phone,
            entryType: 'topup_approved',
            amountCents: confirmedAmountCents,
            amountNanos: confirmedAmountNanos,
            balanceAfterCents: nextBalanceCents,
            balanceAfterNanos: nextBalanceNanos,
            relatedId: id,
            memo: adminNote,
            createdAt: now,
            createdByPhone: adminPhone
        });
        return {
            topup: getTopupRequestById.get(id),
            balance: getAccountBalanceRow.get(phone)
        };
    });

    const rejectTopupRequest = db.transaction(({ id, adminNote, adminPhone }) => {
        const row = getTopupRequestById.get(id);
        if (!row || row.status !== 'pending') {
            const error = new Error('充值申请不是待确认状态。');
            error.status = 409;
            error.code = 'TOPUP_NOT_PENDING';
            throw error;
        }
        const now = nowIso();
        const result = rejectTopupRequestById.run(adminNote, now, adminPhone, id);
        if (result.changes !== 1) {
            const error = new Error('充值申请拒绝失败。');
            error.status = 409;
            error.code = 'TOPUP_NOT_PENDING';
            throw error;
        }
        refreshPendingTopupCents(row.phone);
        return {
            topup: getTopupRequestById.get(id),
            balance: getAccountBalanceRow.get(row.phone)
        };
    });

    function createSubscriptionOrder({ phone, planId, paymentMethod, paymentNote }) {
        const plan = subscriptionPlanById(planId) || getSubscriptionPlanById.get(planId);
        if (!plan) {
            const error = new Error('请选择有效套餐。');
            error.status = 400;
            error.code = 'INVALID_SUBSCRIPTION_PLAN';
            throw error;
        }
        ensureUser.run(phone, nowIso());
        const checkedAt = nowIso(appNow());
        const subscription = getActiveSubscriptionWithPlanByPhone.get(phone, checkedAt, checkedAt);
        if (subscription) {
            const error = new Error('您当前已经有套餐了。');
            error.status = 409;
            error.code = 'ACTIVE_SUBSCRIPTION_EXISTS';
            throw error;
        }
        const order = {
            id: createId('SUB'),
            phone,
            orderType: 'subscription',
            planId: plan.id,
            amountCents: plan.monthlyPriceCents ?? plan.monthly_price_cents,
            quotaUsdMicros: plan.dailyQuotaUsdMicros ?? plan.daily_quota_usd_micros,
            paymentMethod: normalizePaymentMethod(paymentMethod),
            paymentNote: String(paymentNote || '').trim().slice(0, 500),
            createdAt: nowIso()
        };
        insertSubscriptionOrder.run(order);
        return getSubscriptionOrderById.get(order.id);
    }

    function createAddonOrder({ phone, amount, paymentMethod, paymentNote }) {
        const amountCents = parsePositiveCnyToCents(amount);
        const addon = addonPackageByAmountCents(amountCents);
        if (!addon) {
            const error = new Error('请选择有效加量包。');
            error.status = 400;
            error.code = 'INVALID_ADDON_PACKAGE';
            throw error;
        }
        ensureUser.run(phone, nowIso());
        const checkedAt = nowIso(appNow());
        const subscription = getActiveSubscriptionWithPlanByPhone.get(phone, checkedAt, checkedAt);
        if (!subscription) {
            const error = new Error('请先开通套餐，再购买加量包。');
            error.status = 409;
            error.code = 'SUBSCRIPTION_REQUIRED_FOR_ADDON';
            throw error;
        }
        ensureAddonBalance(phone);
        const order = {
            id: createId('ADDON'),
            phone,
            orderType: 'addon',
            planId: '',
            amountCents: addon.amountCents,
            quotaUsdMicros: addon.quotaUsdMicros,
            paymentMethod: normalizePaymentMethod(paymentMethod),
            paymentNote: String(paymentNote || '').trim().slice(0, 500),
            createdAt: nowIso()
        };
        insertSubscriptionOrder.run(order);
        return getSubscriptionOrderById.get(order.id);
    }

    function calculateSubscriptionRefundSnapshot(subscription, date = appNow()) {
        const periodDays = Math.max(1, Number(subscription.period_days || 30));
        const planAmountCents = Math.max(0, Number(subscription.monthly_price_cents || 0));
        const expiresAt = new Date(subscription.expires_at);
        const now = new Date(date);
        const remainingMs = Number.isFinite(expiresAt.getTime()) && Number.isFinite(now.getTime())
            ? Math.max(0, expiresAt.getTime() - now.getTime())
            : 0;
        const remainingDays = Math.min(periodDays, Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))));
        return {
            planAmountCents,
            periodDays,
            remainingDays,
            refundAmountCents: Math.floor((planAmountCents * remainingDays) / periodDays)
        };
    }

    function createSubscriptionRefundRequest({ phone }) {
        const checkedAt = nowIso(appNow());
        const subscription = getActiveSubscriptionWithPlanByPhone.get(phone, checkedAt, checkedAt);
        if (!subscription) {
            const error = new Error('当前没有可退款的有效套餐。');
            error.status = 409;
            error.code = 'ACTIVE_SUBSCRIPTION_REQUIRED_FOR_REFUND';
            throw error;
        }
        const pending = getPendingSubscriptionRefundBySubscriptionId.get(subscription.id);
        if (pending) {
            const error = new Error('您已有待审核退款申请。');
            error.status = 409;
            error.code = 'REFUND_REQUEST_PENDING';
            throw error;
        }
        const snapshot = calculateSubscriptionRefundSnapshot(subscription, appNow());
        const request = {
            id: createId('REFUND'),
            phone,
            subscriptionId: subscription.id,
            planId: subscription.plan_id,
            planAmountCents: snapshot.planAmountCents,
            periodDays: snapshot.periodDays,
            remainingDays: snapshot.remainingDays,
            refundAmountCents: snapshot.refundAmountCents,
            createdAt: nowIso(appNow())
        };
        try {
            insertSubscriptionRefundRequest.run(request);
        } catch (error) {
            if (String(error?.message || '').includes('UNIQUE')) {
                const conflict = new Error('您已有待审核退款申请。');
                conflict.status = 409;
                conflict.code = 'REFUND_REQUEST_PENDING';
                throw conflict;
            }
            throw error;
        }
        return getSubscriptionRefundRequestById.get(request.id);
    }

    const approveSubscriptionOrder = db.transaction(({ id, adminNote, adminPhone }) => {
        const row = getSubscriptionOrderById.get(id);
        if (!row || row.order_type !== 'subscription' || row.status !== 'pending') {
            const error = new Error('订阅订单不是待确认状态。');
            error.status = 409;
            error.code = 'SUBSCRIPTION_ORDER_NOT_PENDING';
            throw error;
        }
        const plan = getSubscriptionPlanById.get(row.plan_id);
        if (!plan) {
            const error = new Error('套餐不存在。');
            error.status = 400;
            error.code = 'SUBSCRIPTION_PLAN_NOT_FOUND';
            throw error;
        }
        const now = appNow();
        const nowText = nowIso(now);
        const activeSubscription = getActiveSubscriptionWithPlanByPhone.get(row.phone, nowText, nowText);
        if (activeSubscription) {
            const error = new Error('您当前已经有套餐了。');
            error.status = 409;
            error.code = 'ACTIVE_SUBSCRIPTION_EXISTS';
            throw error;
        }
        const current = getAnyActiveSubscriptionByPhone.get(row.phone);
        const currentExpires = current ? new Date(current.expires_at) : null;
        const base = currentExpires && currentExpires > now ? currentExpires : now;
        const expiresAt = nowIso(addDays(base, Number(plan.period_days || 30)));
        const result = approveSubscriptionOrderById.run(nowText, adminPhone, adminNote, id);
        if (result.changes !== 1) {
            const error = new Error('订阅订单确认失败。');
            error.status = 409;
            error.code = 'SUBSCRIPTION_ORDER_NOT_PENDING';
            throw error;
        }
        if (current) {
            updateAccountSubscriptionPlan.run({
                id: current.id,
                planId: plan.id,
                expiresAt,
                updatedAt: nowText
            });
        } else {
            insertAccountSubscription.run({
                id: createId('SUBSCRIPTION'),
                phone: row.phone,
                planId: plan.id,
                startedAt: nowText,
                expiresAt,
                createdAt: nowText,
                updatedAt: nowText
            });
        }
        return {
            order: getSubscriptionOrderById.get(id),
            subscription: getActiveSubscriptionWithPlanByPhone.get(row.phone, nowText, nowText)
        };
    });

    const approveAddonOrder = db.transaction(({ id, adminNote, adminPhone }) => {
        const row = getSubscriptionOrderById.get(id);
        if (!row || row.order_type !== 'addon' || row.status !== 'pending') {
            const error = new Error('加量包订单不是待确认状态。');
            error.status = 409;
            error.code = 'ADDON_ORDER_NOT_PENDING';
            throw error;
        }
        const now = nowIso(appNow());
        const balance = ensureAddonBalance(row.phone);
        const nextBalanceUsdMicros = Number(balance.balance_usd_micros || 0) + Number(row.quota_usd_micros || 0);
        const result = approveSubscriptionOrderById.run(now, adminPhone, adminNote, id);
        if (result.changes !== 1) {
            const error = new Error('加量包订单确认失败。');
            error.status = 409;
            error.code = 'ADDON_ORDER_NOT_PENDING';
            throw error;
        }
        updateAddonBalance.run(nextBalanceUsdMicros, now, row.phone);
        insertAddonLedgerEntry.run({
            id: createId('ADDLEDGER'),
            phone: row.phone,
            entryType: 'addon_purchase',
            amountUsdMicros: row.quota_usd_micros,
            balanceAfterUsdMicros: nextBalanceUsdMicros,
            relatedId: id,
            memo: adminNote,
            createdAt: now,
            createdByPhone: adminPhone
        });
        return {
            order: getSubscriptionOrderById.get(id),
            addonBalance: getAddonBalanceRow.get(row.phone)
        };
    });

    const approveSubscriptionRefundRequest = db.transaction(({ id, adminNote, adminPhone }) => {
        const row = getSubscriptionRefundRequestById.get(id);
        if (!row || row.status !== 'pending') {
            const error = new Error('退款申请不是待确认状态。');
            error.status = 409;
            error.code = 'REFUND_REQUEST_NOT_PENDING';
            throw error;
        }
        const subscription = getAccountSubscriptionWithPlanById.get(row.subscription_id);
        if (!subscription || subscription.status !== 'active') {
            const error = new Error('当前套餐已经不可退款。');
            error.status = 409;
            error.code = 'SUBSCRIPTION_NOT_ACTIVE_FOR_REFUND';
            throw error;
        }
        const now = nowIso(appNow());
        const cancelResult = cancelAccountSubscriptionById.run(now, row.subscription_id);
        if (cancelResult.changes !== 1) {
            const error = new Error('套餐取消失败。');
            error.status = 409;
            error.code = 'SUBSCRIPTION_CANCEL_FAILED';
            throw error;
        }
        const approveResult = approveSubscriptionRefundById.run(now, adminPhone, adminNote, id);
        if (approveResult.changes !== 1) {
            const error = new Error('退款申请确认失败。');
            error.status = 409;
            error.code = 'REFUND_REQUEST_NOT_PENDING';
            throw error;
        }
        return {
            refundRequest: getSubscriptionRefundRequestById.get(id),
            subscription: getAccountSubscriptionWithPlanById.get(row.subscription_id)
        };
    });

    const rejectSubscriptionRefundRequest = db.transaction(({ id, adminNote, adminPhone }) => {
        const row = getSubscriptionRefundRequestById.get(id);
        if (!row || row.status !== 'pending') {
            const error = new Error('退款申请不是待确认状态。');
            error.status = 409;
            error.code = 'REFUND_REQUEST_NOT_PENDING';
            throw error;
        }
        const now = nowIso(appNow());
        const result = rejectSubscriptionRefundById.run(now, adminPhone, adminNote, id);
        if (result.changes !== 1) {
            const error = new Error('退款申请拒绝失败。');
            error.status = 409;
            error.code = 'REFUND_REQUEST_NOT_PENDING';
            throw error;
        }
        return {
            refundRequest: getSubscriptionRefundRequestById.get(id),
            subscription: getAccountSubscriptionWithPlanById.get(row.subscription_id)
        };
    });

    const rejectSubscriptionOrder = db.transaction(({ id, orderType, adminNote, adminPhone }) => {
        const row = getSubscriptionOrderById.get(id);
        if (!row || row.order_type !== orderType || row.status !== 'pending') {
            const error = new Error('订单不是待确认状态。');
            error.status = 409;
            error.code = 'SUBSCRIPTION_ORDER_NOT_PENDING';
            throw error;
        }
        const now = nowIso(appNow());
        const result = rejectSubscriptionOrderById.run(now, adminPhone, adminNote, id);
        if (result.changes !== 1) {
            const error = new Error('订单拒绝失败。');
            error.status = 409;
            error.code = 'SUBSCRIPTION_ORDER_NOT_PENDING';
            throw error;
        }
        return getSubscriptionOrderById.get(id);
    });

    function chargeNanosFromUsageEvent(event) {
        return priceUsageTokens(event);
    }

    function appendChargeAuditLog(record) {
        try {
            appendShopChargeAuditLog(record, { auditLogDir: shopChargeAuditLogDir });
        } catch (error) {
            console.error('shop charge audit log write failed', {
                usageEventId: record.usageEventId,
                error: error.message || String(error)
            });
        }
    }

    function chargeUsageEventInCurrentTransaction(event) {
        if (getApiChargeByUsageEventId.get(event.requestId)) {
            return { charged: 0, skipped: 1 };
        }
        const owner = getPhoneByUsageApiKeyHash.get(event.apiKeyHash, event.apiKeyHash);
        if (!owner?.phone) {
            return { charged: 0, skipped: 1 };
        }
        const balanceRow = ensureAccountBalance(owner.phone);
        const pricing = chargeNanosFromUsageEvent(event);
        const usdPricing = priceOfficialUsageUsd(event);
        const balanceBeforeNanos = Number(balanceRow.balance_nanos || 0);
        const balanceAfterNanos = balanceBeforeNanos - pricing.chargeNanos;
        const balanceBeforeCents = nanosToBalanceCents(balanceBeforeNanos);
        const balanceAfterCents = nanosToBalanceCents(balanceAfterNanos);
        const now = nowIso();
        const chargeId = createId('CHARGE');

        insertApiChargeRecord.run({
            id: chargeId,
            phone: owner.phone,
            usageEventId: event.requestId,
            apiKeyHash: event.apiKeyHash,
            model: event.model,
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            cacheHitInputTokens: event.cacheHitInputTokens,
            cacheMissInputTokens: event.cacheMissInputTokens,
            reasoningTokens: event.reasoningTokens,
            totalTokens: event.totalTokens,
            priceVersion: pricing.priceVersion,
            chargeCents: pricing.chargeCents,
            chargeNanos: pricing.chargeNanos,
            balanceBeforeCents,
            balanceBeforeNanos,
            balanceAfterCents,
            balanceAfterNanos,
            status: pricing.status,
            createdAt: now
        });

        if (pricing.chargeNanos > 0) {
            updateBalanceCents.run(balanceAfterCents, balanceAfterNanos, now, owner.phone);
            insertLedgerEntry.run({
                id: createId('LEDGER'),
                phone: owner.phone,
                entryType: 'api_charge',
                amountCents: -pricing.chargeCents,
                amountNanos: -pricing.chargeNanos,
                balanceAfterCents,
                balanceAfterNanos,
                relatedId: event.requestId,
                memo: `${event.model || 'unknown'} API 调用扣费`,
                createdAt: now,
            createdByPhone: ''
            });
        }
        if (!getUsdChargeByUsageEventId.get(event.requestId)) {
            const usageDate = new Date(event.requestedAt || now);
            const quotaDate = chinaDateKey(usageDate);
            const quota = subscriptionQuotaStatusForPhone(owner.phone, usageDate);
            if (quota.subscription) {
                const split = splitUsdChargeByQuota({
                    chargeUsdMicros: usdPricing.chargeUsdMicros,
                    dailyRemainingUsdMicros: quota.dailyRemainingUsdMicros,
                    addonBalanceUsdMicros: quota.addonBalanceUsdMicros
                });
                insertUsdChargeRecord.run({
                    id: createId('USDCHARGE'),
                    phone: owner.phone,
                    usageEventId: event.requestId,
                    apiKeyHash: event.apiKeyHash,
                    model: event.model,
                    inputTokens: event.inputTokens,
                    outputTokens: event.outputTokens,
                    cacheHitInputTokens: event.cacheHitInputTokens,
                    cacheMissInputTokens: event.cacheMissInputTokens,
                    reasoningTokens: event.reasoningTokens,
                    totalTokens: event.totalTokens,
                    officialPriceVersion: usdPricing.officialPriceVersion,
                    chargeUsdMicros: usdPricing.chargeUsdMicros,
                    ...split,
                    quotaDate,
                    status: usdPricing.status,
                    createdAt: now
                });
                if (split.addonDeductedUsdMicros > 0) {
                    updateAddonBalance.run(split.addonBalanceAfterUsdMicros, now, owner.phone);
                    insertAddonLedgerEntry.run({
                        id: createId('ADDLEDGER'),
                        phone: owner.phone,
                        entryType: 'api_charge',
                        amountUsdMicros: -split.addonDeductedUsdMicros,
                        balanceAfterUsdMicros: split.addonBalanceAfterUsdMicros,
                        relatedId: event.requestId,
                        memo: `${event.model || 'unknown'} API 调用消耗加量包`,
                        createdAt: now,
                        createdByPhone: ''
                    });
                }
            }
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
            priceVersion: pricing.priceVersion,
            chargeCents: pricing.chargeCents,
            chargeNanos: pricing.chargeNanos,
            balanceBeforeCents,
            balanceBeforeNanos,
            balanceAfterCents,
            balanceAfterNanos,
            status: pricing.status,
            createdAt: now
        });

        return { charged: pricing.chargeNanos > 0 ? 1 : 0, skipped: 0 };
    }

    const chargeUsageEvent = db.transaction((event) => {
        return chargeUsageEventInCurrentTransaction(event);
    });

    const storeUsageEventWithCharge = db.transaction((event) => {
        const result = insertUsageEvent.run(event);
        if (result.changes <= 0) {
            return { inserted: 0, skipped: 1 };
        }
        chargeUsageEventInCurrentTransaction(event);
        return { inserted: 1, skipped: 0 };
    });


    function renderShopHomePage(req, res) {
        const htmlPath = path.join(rootDir, 'shop/index.html');
        const html = fs.readFileSync(htmlPath, 'utf8').replace(
            /href="[^"]*"([^>]*\sdata-sub2api-link)/,
            `href="${escapeHtmlAttribute(sub2apiPublicUrl)}"$1`
        );
        res.type('html').send(html);
    }

    function verifyUsageSignature(req) {
        const secret = options.usageEventHmacSecret ?? process.env.USAGE_EVENT_HMAC_SECRET;
        if (!secret) {
            return { ok: false, status: 503, code: 'USAGE_EVENT_HMAC_NOT_CONFIGURED', message: '请先配置 USAGE_EVENT_HMAC_SECRET。' };
        }
        const timestamp = String(req.header('x-usage-timestamp') || '').trim();
        const signature = String(req.header('x-usage-signature') || '').trim();
        if (!timestamp || !signature) {
            return { ok: false, status: 401, code: 'USAGE_EVENT_SIGNATURE_REQUIRED', message: '缺少 usage event 签名。' };
        }
        const timestampSeconds = Number(timestamp);
        if (!Number.isFinite(timestampSeconds)) {
            return { ok: false, status: 401, code: 'USAGE_EVENT_TIMESTAMP_INVALID', message: 'usage event timestamp 无效。' };
        }
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - timestampSeconds) > 300) {
            return { ok: false, status: 401, code: 'USAGE_EVENT_TIMESTAMP_EXPIRED', message: 'usage event timestamp 已过期。' };
        }
        const rawBody = req.rawBody || Buffer.from('');
        const expected = crypto.createHmac('sha256', secret).update(`${timestamp}\n`).update(rawBody).digest('hex');
        if (!safeEqual(signature, expected)) {
            return { ok: false, status: 401, code: 'USAGE_EVENT_SIGNATURE_INVALID', message: 'usage event 签名无效。' };
        }
        return { ok: true };
    }

    function storeUsageEvent(body) {
        const event = normalizeUsageEvent(body);
        if (!event.requestId) {
            const error = new Error('缺少 request_id。');
            error.status = 400;
            error.code = 'INVALID_USAGE_EVENT';
            throw error;
        }
        if (!event.apiKeyHash) {
            const error = new Error('缺少 api_key_hash。');
            error.status = 400;
            error.code = 'INVALID_USAGE_EVENT';
            throw error;
        }
        event.receivedAt = nowIso();
        event.success = event.success ? 1 : 0;
        event.failed = event.failed ? 1 : 0;
        return storeUsageEventWithCharge(event);
    }

    function emptyUsageStats() {
        return {
            today_tokens: 0,
            month_tokens: 0,
            total_tokens: 0,
            today_requests: 0,
            month_requests: 0,
            success_requests: 0,
            failed_requests: 0,
            total_requests: 0,
            last_seen_at: '',
            modelsByName: new Map()
        };
    }

    function emptyAccountTokenStats() {
        return {
            inputTokens: 0,
            outputTokens: 0,
            reasoningTokens: 0,
            cachedTokens: 0,
            totalTokens: 0,
            requests: 0,
            failedRequests: 0
        };
    }

    function addUsageStats(stats, row, ranges) {
        const requestedAt = new Date(row.requested_at);
        const isToday = requestedAt >= ranges.todayStart;
        const isMonth = requestedAt >= ranges.monthStart;
        const totalTokens = nonNegativeInteger(row.total_tokens);
        stats.total_tokens += totalTokens;
        stats.total_requests += 1;
        if (isToday) {
            stats.today_tokens += totalTokens;
            stats.today_requests += 1;
        }
        if (isMonth) {
            stats.month_tokens += totalTokens;
            stats.month_requests += 1;
        }
        if (row.failed) {
            stats.failed_requests += 1;
        } else {
            stats.success_requests += 1;
        }
        if (!stats.last_seen_at || new Date(stats.last_seen_at) < requestedAt) {
            stats.last_seen_at = row.requested_at;
        }

        const model = row.model || 'unknown';
        const modelStats = stats.modelsByName.get(model) || {
            model,
            month_tokens: 0,
            total_tokens: 0,
            total_requests: 0
        };
        modelStats.total_tokens += totalTokens;
        modelStats.total_requests += 1;
        if (isMonth) {
            modelStats.month_tokens += totalTokens;
        }
        stats.modelsByName.set(model, modelStats);
    }

    function usageStatsToPublic(stats) {
        return {
            today_tokens: stats.today_tokens,
            month_tokens: stats.month_tokens,
            total_tokens: stats.total_tokens,
            today_requests: stats.today_requests,
            month_requests: stats.month_requests,
            success_requests: stats.success_requests,
            failed_requests: stats.failed_requests,
            total_requests: stats.total_requests,
            last_seen_at: stats.last_seen_at,
            models: Array.from(stats.modelsByName.values()).sort((left, right) => right.total_tokens - left.total_tokens)
        };
    }

    function getUsageStatus(row) {
        if (!row) return 'unmanaged';
        if (row.key_status === 'disabled') return 'disabled';
        if (!row.phone) return row.key_status || 'unused';
        return new Date(row.expires_at).getTime() > Date.now() ? 'active' : 'expired';
    }

    function normalizeUsageKeyProfile(body = {}) {
        const apiKeyHash = String(body.apiKeyHash || body.api_key_hash || '').trim().toLowerCase();
        const apiKeyPreview = String(body.apiKeyPreview || body.api_key_preview || '').trim();
        const groupName = String(body.group || body.groupName || body.group_name || '').trim().toLowerCase();
        const phone = String(body.phone || '').trim();
        if (!/^[a-f0-9]{64}$/.test(apiKeyHash)) {
            const error = new Error('API key hash 无效。');
            error.status = 400;
            error.code = 'INVALID_API_KEY_HASH';
            throw error;
        }
        if (groupName !== 'local') {
            const error = new Error('usage key 分组无效。');
            error.status = 400;
            error.code = 'INVALID_USAGE_KEY_GROUP';
            throw error;
        }
        if (!isPhone(phone)) {
            const error = new Error('请输入有效的中国大陆手机号。');
            error.status = 400;
            error.code = 'INVALID_PHONE';
            throw error;
        }
        return { apiKeyHash, apiKeyPreview, groupName, phone };
    }

    function saveUsageKeyProfile(body) {
        const profile = normalizeUsageKeyProfile(body);
        upsertUsageKeyProfile.run({ ...profile, now: nowIso() });
        return {
            api_key_hash: profile.apiKeyHash,
            api_key_preview: profile.apiKeyPreview,
            group_name: profile.groupName,
            phone: profile.phone
        };
    }

    function accountUsageKeys(phone) {
        const keysByHash = new Map();
        for (const orderRow of listOrdersByPhone.all(phone)) {
            const order = toOrder(orderRow);
            const apiKeyHash = hashApiKey(order.apiKey);
            if (!apiKeyHash) continue;
            keysByHash.set(apiKeyHash, {
                apiKeyHash,
                apiKeyPreview: order.apiKeyPreview || keyPreview(order.apiKey),
                group: 'shop'
            });
        }
        for (const profile of listUsageKeyProfiles.all()) {
            if (profile.phone !== phone) continue;
            keysByHash.set(profile.api_key_hash, {
                apiKeyHash: profile.api_key_hash,
                apiKeyPreview: profile.api_key_preview || '',
                group: profile.group_name || 'local'
            });
        }
        return keysByHash;
    }

    function chinaParts(date) {
        const value = new Date(date);
        const shifted = new Date(value.getTime() + chinaOffsetMs);
        return {
            year: shifted.getUTCFullYear(),
            month: shifted.getUTCMonth() + 1,
            day: shifted.getUTCDate(),
            hour: shifted.getUTCHours()
        };
    }

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function chinaDateKey(date) {
        const parts = chinaParts(date);
        return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
    }

    function currentChinaMonth(date = new Date()) {
        const parts = chinaParts(date);
        return `${parts.year}-${pad2(parts.month)}`;
    }

    function chinaHourKey(date) {
        const parts = chinaParts(date);
        return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:00:00+08:00`;
    }

    function startOfChinaDay(date) {
        const parts = chinaParts(date);
        return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - chinaOffsetMs);
    }

    function startOfChinaMonth(date) {
        const parts = chinaParts(date);
        return new Date(Date.UTC(parts.year, parts.month - 1, 1) - chinaOffsetMs);
    }

    function startOfChinaWeek(date) {
        const dayStart = startOfChinaDay(date);
        const chinaDay = new Date(dayStart.getTime() + chinaOffsetMs).getUTCDay();
        const mondayOffset = chinaDay === 0 ? 6 : chinaDay - 1;
        return new Date(dayStart.getTime() - mondayOffset * 24 * 60 * 60 * 1000);
    }

    function addAccountTokenStats(stats, row) {
        stats.inputTokens += nonNegativeInteger(row.input_tokens);
        stats.outputTokens += nonNegativeInteger(row.output_tokens);
        stats.reasoningTokens += nonNegativeInteger(row.reasoning_tokens);
        stats.cachedTokens += nonNegativeInteger(row.cached_tokens);
        stats.totalTokens += nonNegativeInteger(row.total_tokens);
        stats.requests += 1;
        if (row.failed) {
            stats.failedRequests += 1;
        }
    }

    function accountUsageSummary(phone) {
        const now = appNow();
        const todayStart = startOfChinaDay(now);
        const weekStart = startOfChinaWeek(now);
        const monthStart = startOfChinaMonth(now);
        const ranges = { todayStart, monthStart };
        const visibleKeys = accountUsageKeys(phone);
        const visibleHashes = new Set(visibleKeys.keys());
        const summary = {
            today: emptyAccountTokenStats(),
            week: emptyAccountTokenStats(),
            month: emptyAccountTokenStats()
        };
        const hourlyByBucket = new Map();
        const dailyByBucket = new Map();
        const byModel = new Map();
        const byApiKey = new Map();
        let lastEventAt = '';

        for (const row of listUsageEvents.all()) {
            if (!visibleHashes.has(row.api_key_hash)) continue;
            const requestedAt = new Date(row.requested_at);
            if (!Number.isFinite(requestedAt.getTime())) continue;
            if (!lastEventAt || new Date(lastEventAt) < requestedAt) {
                lastEventAt = row.requested_at;
            }
            if (requestedAt >= todayStart) addAccountTokenStats(summary.today, row);
            if (requestedAt >= weekStart) addAccountTokenStats(summary.week, row);
            if (requestedAt >= monthStart) addAccountTokenStats(summary.month, row);

            const hourKey = chinaHourKey(requestedAt);
            if (!hourlyByBucket.has(hourKey)) {
                hourlyByBucket.set(hourKey, { bucket: hourKey, ...emptyAccountTokenStats() });
            }
            addAccountTokenStats(hourlyByBucket.get(hourKey), row);

            const dayKey = chinaDateKey(requestedAt);
            if (!dailyByBucket.has(dayKey)) {
                dailyByBucket.set(dayKey, { bucket: dayKey, ...emptyAccountTokenStats() });
            }
            addAccountTokenStats(dailyByBucket.get(dayKey), row);

            const modelName = row.model || 'unknown';
            if (!byModel.has(modelName)) {
                byModel.set(modelName, { model: modelName, totalTokens: 0, requests: 0 });
            }
            byModel.get(modelName).totalTokens += nonNegativeInteger(row.total_tokens);
            byModel.get(modelName).requests += 1;

            const keyMeta = visibleKeys.get(row.api_key_hash) || {};
            const keyLabel = keyMeta.apiKeyPreview || row.api_key_preview || row.api_key_hash;
            if (!byApiKey.has(row.api_key_hash)) {
                byApiKey.set(row.api_key_hash, {
                    apiKeyPreview: keyLabel,
                    group: keyMeta.group || 'shop',
                    totalTokens: 0,
                    requests: 0
                });
            }
            byApiKey.get(row.api_key_hash).totalTokens += nonNegativeInteger(row.total_tokens);
            byApiKey.get(row.api_key_hash).requests += 1;
        }
        const chargeRows = listApiChargeRecordsForBillingByPhone.all(phone);
        const billing = buildBillingSummary(chargeRows, ranges, { publicChargeRecord: publicApiChargeRecord });
        billing.weeklySpending = buildWeeklySpending(chargeRows, now);

        return {
            generatedAt: nowIso(now),
            dataFreshness: {
                mode: 'delayed',
                maxDelayMinutes: 60,
                lastEventAt
            },
            summary,
            billing,
            hourly: Array.from(hourlyByBucket.values()).sort((left, right) => left.bucket.localeCompare(right.bucket)).slice(-24),
            daily: Array.from(dailyByBucket.values()).sort((left, right) => left.bucket.localeCompare(right.bucket)),
            byModel: Array.from(byModel.values()).sort((left, right) => right.totalTokens - left.totalTokens),
            byApiKey: Array.from(byApiKey.values()).sort((left, right) => right.totalTokens - left.totalTokens)
        };
    }

    function buildAdminSubscriptionUsers(filters = {}) {
        const q = String(filters.q || '').trim().toLowerCase();
        const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 500);
        const usersByPhone = new Map(listUsersForAdminBalances.all(adminAccountPhone).map((user) => [user.phone, user]));
        if (adminAccountPhone) {
            usersByPhone.set(adminAccountPhone, { phone: adminAccountPhone });
        }
        const items = Array.from(usersByPhone.values())
            .map((user) => {
                const quota = isAdminAccountPhone(user.phone)
                    ? adminSubscriptionMonitorQuotaStatus(user.phone)
                    : accountSubscriptionQuotaStatus(user.phone);
                const subscription = quota.subscription || null;
                return {
                    phone: user.phone,
                    planId: subscription?.planId || '',
                    planName: subscription?.planName || '',
                    expiresAt: subscription?.expiresAt || '',
                    active: quota.active,
                    status: quota.code,
                    quotaDate: quota.quotaDate,
                    dailyQuotaUsdMicros: quota.dailyQuotaUsdMicros,
                    dailyUsedUsdMicros: quota.dailyUsedUsdMicros,
                    dailyRemainingUsdMicros: quota.dailyRemainingUsdMicros,
                    addonBalanceUsdMicros: quota.addonBalanceUsdMicros,
                    remainingUsdMicros: quota.remainingUsdMicros
                };
            })
            .filter((item) => {
                if (!q) return true;
                return [item.phone, item.planId, item.planName, item.status].some((value) => String(value || '').toLowerCase().includes(q));
            })
            .sort((left, right) => {
                if (right.remainingUsdMicros !== left.remainingUsdMicros) return right.remainingUsdMicros - left.remainingUsdMicros;
                return left.phone.localeCompare(right.phone);
            })
            .slice(0, limit);
        return {
            summary: {
                userCount: items.length,
                activeUserCount: items.filter((item) => item.active).length,
                exhaustedUserCount: items.filter((item) => item.status === 'daily_quota_exhausted').length,
                addonBalanceUsdMicros: items.reduce((sum, item) => sum + Number(item.addonBalanceUsdMicros || 0), 0)
            },
            items
        };
    }

    function buildUsageSummary(filters = {}) {
        const now = appNow();
        const todayStart = startOfChinaDay(now);
        const monthStart = startOfChinaMonth(now);
        const ranges = { todayStart, monthStart };
        const statsByHash = new Map();
        const summaryStats = emptyUsageStats();
        const profilesByHash = new Map(listUsageKeyProfiles.all().map((profile) => [profile.api_key_hash, profile]));

        for (const row of listUsageEvents.all()) {
            const hash = row.api_key_hash;
            if (!statsByHash.has(hash)) {
                statsByHash.set(hash, emptyUsageStats());
            }
            addUsageStats(statsByHash.get(hash), row, ranges);
            addUsageStats(summaryStats, row, ranges);
        }

        const items = [];
        const seenHashes = new Set();
        for (const row of listApiKeysForUsage.all()) {
            seenHashes.add(row.api_key_hash);
            const stats = statsByHash.get(row.api_key_hash) || emptyUsageStats();
            const status = getUsageStatus(row);
            items.push({
                group: 'shop',
                phone: row.phone || '',
                api_key_preview: row.api_key_preview || '',
                status,
                redeemed_at: row.redeemed_at || '',
                expires_at: row.expires_at || '',
                ...usageStatsToPublic(stats)
            });
        }
        for (const row of listUsageEvents.all()) {
            if (seenHashes.has(row.api_key_hash)) continue;
            seenHashes.add(row.api_key_hash);
            const stats = statsByHash.get(row.api_key_hash) || emptyUsageStats();
            const profile = profilesByHash.get(row.api_key_hash);
            const groupName = profile?.group_name || 'unmanaged';
            items.push({
                group: groupName,
                phone: profile?.phone || '',
                api_key_preview: profile?.api_key_preview || row.api_key_preview || '',
                status: groupName === 'local' ? 'local' : 'unmanaged',
                redeemed_at: '',
                expires_at: '',
                ...usageStatsToPublic(stats)
            });
        }

        const group = String(filters.group || 'all');
        const status = String(filters.status || 'all');
        const q = String(filters.q || '').trim().toLowerCase();
        const filteredItems = items
            .filter((item) => group === 'all' || item.group === group)
            .filter((item) => status === 'all' || item.status === status)
            .filter((item) => {
                if (!q) return true;
                return [item.phone, item.api_key_preview, item.status, item.group].some((value) => String(value || '').toLowerCase().includes(q));
            })
            .sort((left, right) => {
                if (right.total_tokens !== left.total_tokens) return right.total_tokens - left.total_tokens;
                return String(right.last_seen_at || '').localeCompare(String(left.last_seen_at || ''));
            });

        return {
            summary: {
                today_tokens: summaryStats.today_tokens,
                month_tokens: summaryStats.month_tokens,
                total_tokens: summaryStats.total_tokens,
                today_requests: summaryStats.today_requests,
                month_requests: summaryStats.month_requests,
                total_requests: summaryStats.total_requests,
                failed_requests: summaryStats.failed_requests
            },
            billing: buildBillingSummary(listApiChargeRecordsForShopBilling.all(), {
                todayStart,
                monthStart
            }, { publicChargeRecord: publicApiChargeRecord }),
            items: filteredItems
        };
    }

    function importUsageEvents(month) {
        const normalizedMonth = String(month || '').trim();
        if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) {
            const error = new Error('月份格式必须是 YYYY-MM。');
            error.status = 400;
            error.code = 'INVALID_USAGE_IMPORT_MONTH';
            throw error;
        }
        const configuredDir = options.cliproxyUsageLogDir ?? process.env.CLIPROXY_USAGE_LOG_DIR;
        if (!configuredDir) {
            const error = new Error('请先配置 CLIPROXY_USAGE_LOG_DIR。');
            error.status = 503;
            error.code = 'USAGE_LOG_DIR_NOT_CONFIGURED';
            throw error;
        }
        const baseDir = path.resolve(configuredDir);
        const filePath = path.resolve(baseDir, `usage-events-${normalizedMonth}.jsonl`);
        const relativePath = path.relative(baseDir, filePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            const error = new Error('usage log 路径无效。');
            error.status = 400;
            error.code = 'INVALID_USAGE_IMPORT_PATH';
            throw error;
        }
        if (!fs.existsSync(filePath)) {
            const error = new Error('没有找到该月份的 usage JSONL。');
            error.status = 404;
            error.code = 'USAGE_IMPORT_FILE_NOT_FOUND';
            throw error;
        }

        const result = { month: normalizedMonth, inserted: 0, skipped: 0, failed_lines: 0 };
        const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const parsed = JSON.parse(trimmed);
                const stored = storeUsageEvent(parsed);
                result.inserted += stored.inserted;
                result.skipped += stored.skipped;
            } catch (error) {
                result.failed_lines += 1;
            }
        }
        return result;
    }

    const usageImportStatus = {
        enabled: Boolean(options.usageAutoImportEnabled ?? process.env.SHOP_USAGE_AUTO_IMPORT_ENABLED === 'true'),
        lastRunAt: '',
        lastMonth: '',
        lastInserted: 0,
        lastSkipped: 0,
        lastFailedLines: 0,
        lastError: ''
    };

    function runUsageAutoImport(month = currentChinaMonth()) {
        usageImportStatus.lastRunAt = nowIso();
        usageImportStatus.lastMonth = month;
        usageImportStatus.lastError = '';
        try {
            const result = importUsageEvents(month);
            usageImportStatus.lastInserted = result.inserted;
            usageImportStatus.lastSkipped = result.skipped;
            usageImportStatus.lastFailedLines = result.failed_lines;
            return result;
        } catch (error) {
            usageImportStatus.lastInserted = 0;
            usageImportStatus.lastSkipped = 0;
            usageImportStatus.lastFailedLines = 0;
            usageImportStatus.lastError = error.message || 'usage 自动导入失败。';
            return {
                month,
                inserted: 0,
                skipped: 0,
                failed_lines: 0,
                error: usageImportStatus.lastError
            };
        }
    }

    function createUsageImporter() {
        const rawIntervalMs = Number(options.usageAutoImportIntervalMs ?? process.env.SHOP_USAGE_AUTO_IMPORT_INTERVAL_MS ?? 60000);
        const intervalMs = Number.isFinite(rawIntervalMs) ? Math.max(rawIntervalMs, 5000) : 60000;
        let timer = null;
        if (usageImportStatus.enabled && options.usageAutoImportStartTimer !== false) {
            runUsageAutoImport();
            timer = setInterval(() => runUsageAutoImport(), intervalMs);
            timer.unref?.();
        }
        return {
            runOnce: runUsageAutoImport,
            status: () => ({ ...usageImportStatus }),
            stop: () => {
                if (timer) clearInterval(timer);
                timer = null;
            }
        };
    }

    const usageImporter = createUsageImporter();

    function jsonLimitForPath(pathname) {
        if (pathname === '/api/internal/usage-events') {
            return options.usageJsonBodyLimit || process.env.USAGE_JSON_BODY_LIMIT || '256kb';
        }
        return options.jsonBodyLimit || process.env.JSON_BODY_LIMIT || '32kb';
    }

    app.use((req, res, next) => {
        return express.json({
            limit: jsonLimitForPath(req.path),
            verify: (request, response, buffer) => {
                request.rawBody = Buffer.from(buffer);
            }
        })(req, res, next);
    });
    app.use(express.urlencoded({ extended: false, limit: options.urlencodedBodyLimit || process.env.URLENCODED_BODY_LIMIT || '16kb' }));
    app.use((error, req, res, next) => {
        if (error && error.type === 'entity.too.large') {
            return res.status(413).json({ code: 'BODY_TOO_LARGE', message: '请求体过大。' });
        }
        return next(error);
    });
    app.use(setSecurityHeaders);
    app.use(compression());

    function retiredShopApi(req, res) {
        return res.status(410).json({
            code: 'SHOP_LEGACY_API_RETIRED',
            message: 'yui.web 旧 Shop 计费接口已退役，请使用 Sub2API 控制台。'
        });
    }

    app.use([
        '/api/auth',
        '/api/account',
        '/api/admin',
        '/api/invites',
        '/api/orders'
    ], retiredShopApi);


    function respondApiKeyStatus(res, apiKeyRow) {
        if (!apiKeyRow) {
            return res.json({
                managed: false,
                active: false,
                status: 'not_found',
                expiresAt: ''
            });
        }
        if (apiKeyRow.status === 'disabled') {
            return res.json({
                managed: true,
                active: false,
                status: 'disabled',
                expiresAt: ''
            });
        }

        const orderRow = apiKeyRow.order_id ? getOrderById.get(apiKeyRow.order_id) : getOrderByApiKey.get(apiKeyRow.api_key);
        if (!orderRow) {
            return res.json({
                managed: true,
                active: false,
                status: apiKeyRow.status,
                expiresAt: ''
            });
        }

        const order = toOrder(orderRow);
        const active = getOrderStatus(order) === 'active';
        if (!active) {
            return res.json({
                managed: true,
                active: false,
                status: 'expired',
                expiresAt: order.expiresAt,
                billing: billingStatusForPhone(order.phone)
            });
        }

        const quotaStatus = subscriptionQuotaStatusForPhone(order.phone);
        if (!quotaStatus.subscription) {
            return res.json({
                managed: true,
                active: false,
                status: 'subscription_required',
                expiresAt: order.expiresAt,
                quota: quotaStatus
            });
        }
        if (!quotaStatus.active) {
            return res.json({
                managed: true,
                active: false,
                status: quotaStatus.code,
                expiresAt: order.expiresAt,
                subscription: quotaStatus.subscription,
                quota: quotaStatus
            });
        }

        return res.json({
            managed: true,
            active: true,
            status: 'active',
            expiresAt: order.expiresAt,
            subscription: quotaStatus.subscription,
            quota: quotaStatus
        });
    }

    app.get('/api/internal/api-keys/status', requireInternal, (req, res) => {
        const apiKey = String(req.query.apiKey || '').trim();
        if (!apiKey) {
            return res.status(400).json({
                code: 'INVALID_API_KEY',
                message: '请提供 API key。'
            });
        }

        return respondApiKeyStatus(res, getApiKeyByHash.get(hashApiKey(apiKey)));
    });

    app.post('/api/internal/api-keys/status', requireInternal, (req, res) => {
        const apiKeyHash = String(req.body.apiKeyHash || req.body.api_key_hash || '').trim().toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(apiKeyHash)) {
            return res.status(400).json({
                code: 'INVALID_API_KEY_HASH',
                message: 'api key hash 无效。'
            });
        }
        return respondApiKeyStatus(res, getApiKeyByHash.get(apiKeyHash));
    });

    app.post('/api/internal/usage-events', requireInternal, (req, res) => {
        const signatureResult = verifyUsageSignature(req);
        if (!signatureResult.ok) {
            return res.status(signatureResult.status).json({
                code: signatureResult.code,
                message: signatureResult.message
            });
        }
        try {
            const result = storeUsageEvent(req.body);
            return res.status(result.inserted ? 201 : 200).json(result);
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'USAGE_EVENT_STORE_FAILED',
                message: error.message || 'usage event 写入失败。'
            });
        }
    });

    app.get(['/shop', '/shop/', '/shop/index.html'], renderShopHomePage);
    app.get(/^\/shop\/.+$/, (req, res) => res.redirect(302, sub2apiPublicUrl));

    app.use(blockSensitiveStaticPaths);
    app.use(express.static(rootDir, {
        extensions: ['html'],
        dotfiles: 'ignore',
        setHeaders(res, filePath) {
            const requestPath = `/${path.relative(rootDir, filePath).split(path.sep).join('/')}`;
            res.setHeader('Cache-Control', cacheControlForStaticPath(requestPath));
        }
    }));

    app.use((req, res) => {
        if (req.method === 'GET' && !req.path.includes('.') && !req.path.endsWith('/')) {
            const htmlPath = path.join(rootDir, `${req.path}.html`);
            if (htmlPath.startsWith(rootDir) && fs.existsSync(htmlPath)) {
                return res.sendFile(htmlPath);
            }
        }
        res.status(404).sendFile(path.join(rootDir, '404.html'));
    });

    return { app, db, dbPath, usageImporter };
}

if (require.main === module) {
    const { app } = createShopApp();
    const port = Number(process.env.PORT || 4173);
    app.listen(port, () => {
        console.log(`Yui web shop server listening on http://localhost:${port}`);
    });
}

module.exports = {
    createShopApp,
    openShopDatabase,
    isPhone,
    parseCookies
};
