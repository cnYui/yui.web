const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { openShopDatabase } = require('../server');
const {
    legacySubscriptionMigrationPhones,
    migrateLegacySubscriptionUsers
} = require('../scripts/shop-migrate-subscription-legacy-users');

function hashApiKeyForTest(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function createDb() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-subscription-migration-'));
    const dbPath = path.join(tempDir, 'shop.sqlite');
    const db = openShopDatabase(dbPath);
    return { db, tempDir };
}

function seedLegacyUser(db, phone, { withOrder = true } = {}) {
    const createdAt = '2026-06-15T10:00:00+08:00';
    db.prepare('INSERT INTO users (phone, created_at) VALUES (?, ?)').run(phone, createdAt);
    db.prepare(`
INSERT INTO account_balances (
  phone, balance_cents, balance_nanos, pending_topup_cents, pending_topup_nanos,
  credit_limit_cents, credit_limit_nanos, updated_at
)
VALUES (?, 1200, 12000000000, 0, 0, 1000, 10000000000, ?)
`).run(phone, createdAt);
    if (!withOrder) return;

    const apiKey = `sk-legacy-migration-${phone}`;
    const apiKeyHash = hashApiKeyForTest(apiKey);
    const orderId = `ORDER-${phone}`;
    db.prepare(`
INSERT INTO api_keys (api_key, api_key_preview, api_key_hash, status, created_at, used_at, order_id)
VALUES (?, ?, ?, 'used', ?, ?, ?)
`).run(apiKey, `sk-legacy...${phone.slice(-4)}`, apiKeyHash, createdAt, createdAt, orderId);
    db.prepare(`
INSERT INTO orders (
  id, phone, invite_code, api_key, api_key_preview, product_name, amount,
  redeemed_at, expires_at, result_token
)
VALUES (?, ?, ?, ?, ?, 'codex api key', 0, ?, ?, ?)
`).run(
        orderId,
        phone,
        `YUI-${phone.slice(-6)}`,
        apiKey,
        `sk-legacy...${phone.slice(-4)}`,
        createdAt,
        '2026-07-15T10:00:00+08:00',
        `rst-${phone}`
    );
    db.prepare(`
INSERT INTO usage_events (
  request_id, api_key_hash, api_key_preview, provider, model, endpoint, source, auth_index,
  success, failed, input_tokens, output_tokens, reasoning_tokens, cached_tokens,
  cache_hit_input_tokens, cache_miss_input_tokens, total_tokens, latency_ms,
  requested_at, received_at, price_amount_micros, price_currency
)
VALUES (?, ?, ?, 'codex', 'gpt-5.4', '', '', '', 1, 0, 100, 20, 0, 40, 40, 60, 120, 0, ?, ?, NULL, '')
`).run(`req-old-${phone}`, apiKeyHash, `sk-legacy...${phone.slice(-4)}`, '2026-06-16T10:00:00+08:00', '2026-06-16T10:00:01+08:00');
}

test('订阅池老用户迁移 dry-run 不写库，apply 只给白名单 29 元套餐', () => {
    const { db, tempDir } = createDb();
    try {
        for (const phone of legacySubscriptionMigrationPhones) {
            seedLegacyUser(db, phone);
        }
        seedLegacyUser(db, '19900001000');

        const dryRun = migrateLegacySubscriptionUsers(db, { apply: false });
        assert.equal(dryRun.mode, 'dry-run');
        assert.equal(dryRun.planned.length, legacySubscriptionMigrationPhones.length);
        assert.equal(dryRun.createdSubscriptions, 0);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM account_subscriptions').get().count, 0);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM subscription_orders WHERE order_type = ?').get('subscription').count, 0);

        const applied = migrateLegacySubscriptionUsers(db, { apply: true });
        assert.equal(applied.mode, 'apply');
        assert.equal(applied.createdSubscriptions, legacySubscriptionMigrationPhones.length);
        assert.equal(applied.createdOrders, legacySubscriptionMigrationPhones.length);
        assert.equal(applied.skippedExistingSubscriptions, 0);
        assert.equal(applied.missingUsers.length, 0);

        const activeRows = db.prepare(`
SELECT phone, plan_id, status, started_at, expires_at
FROM account_subscriptions
ORDER BY phone
`).all();
        assert.deepEqual(activeRows, legacySubscriptionMigrationPhones.slice().sort().map((phone) => ({
            phone,
            plan_id: 'sub_29_daily_19_usd',
            status: 'active',
            started_at: '2026-06-17T00:00:00+08:00',
            expires_at: '2026-07-17T00:00:00+08:00'
        })));
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM account_subscriptions WHERE phone = ?').get('19900001000').count, 0);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM api_usd_charge_records').get().count, 0);

        const second = migrateLegacySubscriptionUsers(db, { apply: true });
        assert.equal(second.createdSubscriptions, 0);
        assert.equal(second.createdOrders, 0);
        assert.equal(second.skippedExistingSubscriptions, legacySubscriptionMigrationPhones.length);
    } finally {
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('订阅池老用户迁移报告缺失用户且不自动创建手机号', () => {
    const { db, tempDir } = createDb();
    try {
        seedLegacyUser(db, legacySubscriptionMigrationPhones[0]);

        const result = migrateLegacySubscriptionUsers(db, { apply: true });
        assert.equal(result.createdSubscriptions, 1);
        assert.equal(result.missingUsers.length, legacySubscriptionMigrationPhones.length - 1);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get().count, 1);
    } finally {
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('订阅池老用户迁移会取消非白名单 active 套餐', () => {
    const { db, tempDir } = createDb();
    try {
        seedLegacyUser(db, legacySubscriptionMigrationPhones[0]);
        seedLegacyUser(db, '19900002000');
        db.prepare(`
INSERT INTO account_subscriptions (
  id, phone, plan_id, status, started_at, expires_at, created_at, updated_at
)
VALUES (
  'MIGSUB-extra-active', '19900002000', 'sub_59_daily_49_usd', 'active',
  '2026-06-16T00:00:00+08:00', '2026-07-16T00:00:00+08:00',
  '2026-06-16T00:00:00+08:00', '2026-06-16T00:00:00+08:00'
)
`).run();

        const result = migrateLegacySubscriptionUsers(db, { apply: true });
        assert.equal(result.cancelledNonWhitelistSubscriptions, 1);
        assert.equal(
            db.prepare('SELECT COUNT(*) AS count FROM account_subscriptions WHERE phone = ? AND status = ?').get('19900002000', 'active').count,
            0
        );
        assert.equal(
            db.prepare('SELECT status FROM account_subscriptions WHERE id = ?').get('MIGSUB-extra-active').status,
            'cancelled'
        );
    } finally {
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
