#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const { openShopDatabase } = require('../server');

const legacySubscriptionMigrationPhones = [
    '15776812883',
    '17371571728',
    '19814722044',
    '13813756694',
    '18014503779',
    '15062376174',
    '15995436627',
    '18367290091',
    '13052071067',
    '13584052801'
];

const migrationPlan = {
    batchId: 'legacy-subscription-20260617',
    planId: 'sub_29_daily_19_usd',
    amountCents: 2900,
    quotaUsdMicros: 19000000,
    startedAt: '2026-06-17T00:00:00+08:00',
    expiresAt: '2026-07-17T00:00:00+08:00',
    confirmedAt: '2026-06-17T00:00:00+08:00',
    adminNote: '老用户订阅池迁移：旧金额不转美元账本，旧 usage 只保留 token 统计。'
};

function timestamp() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function migrationOrderId(phone) {
    return `LEGACY-SUB-${phone}-20260617`;
}

function migrationSubscriptionId(phone) {
    return `MIGSUB-${phone}-20260617`;
}

function parseArgs(argv = process.argv) {
    const args = {
        apply: false,
        db: path.join(__dirname, '..', 'data', 'shop.sqlite')
    };
    for (let index = 2; index < argv.length; index += 1) {
        const item = argv[index];
        if (item === '--dry-run') args.apply = false;
        if (item === '--apply') args.apply = true;
        if (item === '--db') {
            args.db = argv[index + 1];
            index += 1;
        }
    }
    return args;
}

async function backupShopDatabase(dbPath, backupDir = path.join(path.dirname(dbPath), 'backups'), stamp = timestamp()) {
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `shop-before-subscription-legacy-migration-${stamp}.sqlite`);
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
        await db.backup(backupPath);
    } finally {
        db.close();
    }
    return backupPath;
}

function getLegacyUserPlan(db, phone) {
    const user = db.prepare('SELECT phone FROM users WHERE phone = ?').get(phone);
    const activeSubscription = db.prepare(`
SELECT id, plan_id, status, started_at, expires_at
FROM account_subscriptions
WHERE phone = ? AND status = 'active'
ORDER BY expires_at DESC
LIMIT 1
`).get(phone);
    const orderCount = Number(db.prepare('SELECT COUNT(*) AS count FROM orders WHERE phone = ?').get(phone)?.count || 0);
    const managedKeyCount = Number(db.prepare(`
SELECT COUNT(*) AS count
FROM api_keys ak
JOIN orders o ON o.id = ak.order_id OR o.api_key = ak.api_key
WHERE o.phone = ?
`).get(phone)?.count || 0);
    const oldUsageCount = Number(db.prepare(`
SELECT COUNT(*) AS count
FROM usage_events ue
JOIN api_keys ak ON ak.api_key_hash = ue.api_key_hash
JOIN orders o ON o.id = ak.order_id OR o.api_key = ak.api_key
WHERE o.phone = ?
`).get(phone)?.count || 0);
    return {
        phone,
        exists: Boolean(user),
        hasActiveSubscription: Boolean(activeSubscription),
        activeSubscription: activeSubscription || null,
        orderCount,
        managedKeyCount,
        oldUsageCount,
        subscriptionId: migrationSubscriptionId(phone),
        orderId: migrationOrderId(phone),
        planId: migrationPlan.planId,
        startedAt: migrationPlan.startedAt,
        expiresAt: migrationPlan.expiresAt
    };
}

function buildMigrationSummary(db) {
    const planned = legacySubscriptionMigrationPhones.map((phone) => getLegacyUserPlan(db, phone));
    const placeholders = legacySubscriptionMigrationPhones.map(() => '?').join(', ');
    const activeNonWhitelistSubscriptions = db.prepare(`
SELECT id, phone, plan_id, started_at, expires_at
FROM account_subscriptions
WHERE status = 'active'
  AND phone NOT IN (${placeholders})
ORDER BY phone
`).all(...legacySubscriptionMigrationPhones);
    return {
        batchId: migrationPlan.batchId,
        planId: migrationPlan.planId,
        startedAt: migrationPlan.startedAt,
        expiresAt: migrationPlan.expiresAt,
        planned,
        activeNonWhitelistSubscriptions,
        missingUsers: planned.filter((item) => !item.exists).map((item) => item.phone),
        skippedExistingSubscriptions: planned.filter((item) => item.hasActiveSubscription).length,
        createdSubscriptions: 0,
        createdOrders: 0,
        cancelledNonWhitelistSubscriptions: 0
    };
}

function migrateLegacySubscriptionUsers(db, { apply = false } = {}) {
    const summary = buildMigrationSummary(db);
    summary.mode = apply ? 'apply' : 'dry-run';
    if (!apply) return summary;

    const insertOrder = db.prepare(`
INSERT OR IGNORE INTO subscription_orders (
  id, phone, order_type, plan_id, amount_cents, quota_usd_micros, payment_method,
  payment_note, status, created_at, confirmed_at, confirmed_by_phone, admin_note
)
VALUES (
  @id, @phone, 'subscription', @planId, @amountCents, @quotaUsdMicros, 'wechat',
  @paymentNote, 'approved', @createdAt, @confirmedAt, @confirmedByPhone, @adminNote
)
`);
    const insertSubscription = db.prepare(`
INSERT OR IGNORE INTO account_subscriptions (
  id, phone, plan_id, status, started_at, expires_at, created_at, updated_at
)
VALUES (
  @id, @phone, @planId, 'active', @startedAt, @expiresAt, @createdAt, @updatedAt
)
`);
    const placeholders = legacySubscriptionMigrationPhones.map(() => '?').join(', ');
    const cancelNonWhitelistSubscriptions = db.prepare(`
UPDATE account_subscriptions
SET status = 'cancelled',
    updated_at = ?
WHERE status = 'active'
  AND phone NOT IN (${placeholders})
`);

    const run = db.transaction(() => {
        summary.cancelledNonWhitelistSubscriptions = cancelNonWhitelistSubscriptions.run(
            migrationPlan.startedAt,
            ...legacySubscriptionMigrationPhones
        ).changes;
        for (const item of summary.planned) {
            if (!item.exists || item.hasActiveSubscription) continue;
            const orderResult = insertOrder.run({
                id: item.orderId,
                phone: item.phone,
                planId: migrationPlan.planId,
                amountCents: migrationPlan.amountCents,
                quotaUsdMicros: migrationPlan.quotaUsdMicros,
                paymentNote: migrationPlan.batchId,
                createdAt: migrationPlan.startedAt,
                confirmedAt: migrationPlan.confirmedAt,
                confirmedByPhone: 'migration',
                adminNote: migrationPlan.adminNote
            });
            const subscriptionResult = insertSubscription.run({
                id: item.subscriptionId,
                phone: item.phone,
                planId: migrationPlan.planId,
                startedAt: migrationPlan.startedAt,
                expiresAt: migrationPlan.expiresAt,
                createdAt: migrationPlan.startedAt,
                updatedAt: migrationPlan.startedAt
            });
            summary.createdOrders += orderResult.changes;
            summary.createdSubscriptions += subscriptionResult.changes;
        }
    });
    run();
    return summary;
}

async function main(argv = process.argv) {
    const args = parseArgs(argv);
    const dbPath = path.resolve(args.db);
    if (!fs.existsSync(dbPath)) {
        throw new Error(`数据库不存在：${dbPath}`);
    }
    const backupPath = args.apply ? await backupShopDatabase(dbPath) : '';
    const db = openShopDatabase(dbPath);
    try {
        const result = migrateLegacySubscriptionUsers(db, { apply: args.apply });
        console.log(JSON.stringify({ mode: args.apply ? 'apply' : 'dry-run', backupPath, result }, null, 2));
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}

module.exports = {
    backupShopDatabase,
    legacySubscriptionMigrationPhones,
    main,
    migrateLegacySubscriptionUsers,
    migrationPlan,
    migrationOrderId,
    migrationSubscriptionId,
    parseArgs
};
