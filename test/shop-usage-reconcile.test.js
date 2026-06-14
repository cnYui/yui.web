const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { openShopDatabase } = require('../server');
const { reconcileUsageBilling } = require('../lib/shop-usage-reconcile');
const { priceUsageTokens } = require('../lib/shop-pricing');

function hashApiKeyForTest(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function createDb() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-reconcile-'));
    const dbPath = path.join(tempDir, 'shop.sqlite');
    const db = openShopDatabase(dbPath);
    return { db, tempDir };
}

test('usage 补账 dry-run 不写数据库，apply 后幂等扣费', () => {
    const { db, tempDir } = createDb();
    try {
        const auditLogDir = path.join(tempDir, 'charge-audit');
        const apiKey = 'sk-reconcile-owned';
        const hash = hashApiKeyForTest(apiKey);
        db.prepare('INSERT INTO users (phone, created_at) VALUES (?, ?)').run('13800138201', '2026-06-11T10:00:00+08:00');
        db.prepare('INSERT INTO account_balances (phone, balance_cents, balance_nanos, pending_topup_cents, pending_topup_nanos, credit_limit_cents, credit_limit_nanos, updated_at) VALUES (?, ?, ?, 0, 0, 1000, 10000000000, ?)').run('13800138201', 100, 1000000000, '2026-06-11T10:00:00+08:00');
        db.prepare('INSERT INTO api_keys (api_key, api_key_preview, api_key_hash, status, created_at, used_at, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(apiKey, 'sk-r...owned', hash, 'used', '2026-06-11T10:00:00+08:00', '2026-06-11T10:00:00+08:00', 'ORDER-REC');
        db.prepare('INSERT INTO orders (id, phone, invite_code, api_key, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('ORDER-REC', '13800138201', 'YUI-REC-000001', apiKey, 'sk-r...owned', 'codex api key', 0, '2026-06-11T10:00:00+08:00', '2026-07-12T10:00:00+08:00', 'rst-rec');
        db.prepare('INSERT INTO usage_events (request_id, api_key_hash, api_key_preview, provider, model, endpoint, source, auth_index, success, failed, input_tokens, output_tokens, reasoning_tokens, cached_tokens, cache_hit_input_tokens, cache_miss_input_tokens, total_tokens, latency_ms, requested_at, received_at, price_amount_micros, price_currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 100, 10, 88, 40, 0, 0, 110, 0, ?, ?, NULL, ?)').run('req-reconcile-owned', hash, 'sk-r...owned', 'codex', 'gpt-5.5', '', '', '', '2026-06-11T10:01:00Z', '2026-06-11T10:01:01+08:00', '');

        const dryRun = reconcileUsageBilling(db, { apply: false, auditLogDir });
        assert.equal(dryRun.updatedUsageBreakdowns, 1);
        assert.equal(dryRun.createdCharges, 1);
        assert.equal(db.prepare('SELECT cache_hit_input_tokens FROM usage_events WHERE request_id = ?').get('req-reconcile-owned').cache_hit_input_tokens, 0);
        assert.equal(fs.existsSync(auditLogDir), false);

        const applied = reconcileUsageBilling(db, { apply: true, auditLogDir, now: () => '2026-06-11T11:00:00+08:00' });
        const expectedPricing = priceUsageTokens({
            model: 'gpt-5.5',
            requestedAt: '2026-06-11T10:01:00Z',
            failed: false,
            cacheHitInputTokens: 40,
            cacheMissInputTokens: 60,
            outputTokens: 10,
            reasoningTokens: 88
        });
        assert.equal(applied.updatedUsageBreakdowns, 1);
        assert.equal(applied.createdCharges, 1);
        assert.equal(applied.totalChargeNanos, expectedPricing.chargeNanos);
        assert.deepEqual(
            db.prepare('SELECT cache_hit_input_tokens, cache_miss_input_tokens FROM usage_events WHERE request_id = ?').get('req-reconcile-owned'),
            { cache_hit_input_tokens: 40, cache_miss_input_tokens: 60 }
        );
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM api_charge_records WHERE usage_event_id = ?').get('req-reconcile-owned').count, 1);
        assert.deepEqual(
            db.prepare('SELECT model, price_version, charge_nanos FROM api_charge_records WHERE usage_event_id = ?').get('req-reconcile-owned'),
            {
                model: 'gpt-5.5',
                price_version: expectedPricing.priceVersion,
                charge_nanos: expectedPricing.chargeNanos
            }
        );
        assert.equal(
            db.prepare('SELECT balance_nanos FROM account_balances WHERE phone = ?').get('13800138201').balance_nanos,
            1000000000 - expectedPricing.chargeNanos
        );
        const logFiles = fs.readdirSync(auditLogDir).filter((file) => file.endsWith('.jsonl'));
        assert.equal(logFiles.length, 1);
        const records = fs.readFileSync(path.join(auditLogDir, logFiles[0]), 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
        assert.equal(records.length, 1);
        assert.equal(records[0].source, 'reconcile');
        assert.equal(records[0].usageEventId, 'req-reconcile-owned');
        assert.equal(records[0].phone, '13800138201');
        assert.equal(records[0].chargeNanos, expectedPricing.chargeNanos);
        assert.equal(records[0].cacheHitInputTokens, 40);
        assert.equal(records[0].cacheMissInputTokens, 60);

        const second = reconcileUsageBilling(db, { apply: true, auditLogDir, now: () => '2026-06-11T11:05:00+08:00' });
        assert.equal(second.createdCharges, 0);
        assert.equal(second.adjustedUnpricedCharges, 0);
        const unchangedRecords = fs.readFileSync(path.join(auditLogDir, logFiles[0]), 'utf8').trim().split(/\r?\n/);
        assert.equal(unchangedRecords.length, 1);
    } finally {
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('usage 补账批量创建扣费记录时不依赖随机 id 唯一性', () => {
    const { db, tempDir } = createDb();
    const originalDateNow = Date.now;
    const originalRandom = Math.random;
    try {
        const apiKey = 'sk-reconcile-batch';
        const hash = hashApiKeyForTest(apiKey);
        db.prepare('INSERT INTO users (phone, created_at) VALUES (?, ?)').run('13800138202', '2026-06-11T10:00:00+08:00');
        db.prepare('INSERT INTO account_balances (phone, balance_cents, balance_nanos, pending_topup_cents, pending_topup_nanos, credit_limit_cents, credit_limit_nanos, updated_at) VALUES (?, ?, ?, 0, 0, 1000, 10000000000, ?)').run('13800138202', 100, 1000000000, '2026-06-11T10:00:00+08:00');
        db.prepare('INSERT INTO api_keys (api_key, api_key_preview, api_key_hash, status, created_at, used_at, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(apiKey, 'sk-r...batch', hash, 'used', '2026-06-11T10:00:00+08:00', '2026-06-11T10:00:00+08:00', 'ORDER-BATCH');
        db.prepare('INSERT INTO orders (id, phone, invite_code, api_key, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('ORDER-BATCH', '13800138202', 'YUI-REC-000002', apiKey, 'sk-r...batch', 'codex api key', 0, '2026-06-11T10:00:00+08:00', '2026-07-12T10:00:00+08:00', 'rst-batch');
        const insertUsage = db.prepare('INSERT INTO usage_events (request_id, api_key_hash, api_key_preview, provider, model, endpoint, source, auth_index, success, failed, input_tokens, output_tokens, reasoning_tokens, cached_tokens, cache_hit_input_tokens, cache_miss_input_tokens, total_tokens, latency_ms, requested_at, received_at, price_amount_micros, price_currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 100, 10, 0, 40, 0, 0, 110, 0, ?, ?, NULL, ?)');
        insertUsage.run('req-reconcile-batch-a', hash, 'sk-r...batch', 'codex', 'gpt-5.4', '', '', '', '2026-06-11T10:01:00Z', '2026-06-11T10:01:01+08:00', '');
        insertUsage.run('req-reconcile-batch-b', hash, 'sk-r...batch', 'codex', 'gpt-5.4', '', '', '', '2026-06-11T10:02:00Z', '2026-06-11T10:02:01+08:00', '');

        Date.now = () => 1234567890000;
        Math.random = () => 0;

        const applied = reconcileUsageBilling(db, {
            apply: true,
            auditLogDir: path.join(tempDir, 'batch-charge-audit'),
            now: () => '2026-06-11T11:00:00+08:00'
        });

        assert.equal(applied.createdCharges, 2);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM api_charge_records').get().count, 2);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM account_ledger_entries WHERE entry_type = ?').get('api_charge').count, 2);
    } finally {
        Date.now = originalDateNow;
        Math.random = originalRandom;
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('补账 apply 前会复制数据库备份', () => {
    const { db, tempDir } = createDb();
    try {
        const dbPath = db.name;
        const backupDir = path.join(tempDir, 'backups');
        const { backupShopDatabase } = require('../scripts/shop-reconcile-usage-billing');
        const backupPath = backupShopDatabase(dbPath, backupDir, '20260611-190000');
        assert.equal(fs.existsSync(backupPath), true);
        assert.match(path.basename(backupPath), /^shop-before-usage-reconcile-20260611-190000\.sqlite$/);
    } finally {
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
