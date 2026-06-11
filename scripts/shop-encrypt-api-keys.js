#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const {
    encryptApiKeyEnvelope,
    hashApiKey
} = require('../lib/shop-api-key-crypto');
const { backupShopDatabase } = require('./shop-reconcile-usage-billing');

function encryptedApiKeyPlaceholder(apiKeyHash) {
    return `enc_${String(apiKeyHash || '').trim()}`;
}

function isEncryptedPlaceholder(value) {
    return /^enc_[a-f0-9]{64}$/.test(String(value || ''));
}

function planApiKeyEncryptionMigration(rows) {
    return rows.reduce((summary, row) => {
        if (row.api_key && !row.api_key_ciphertext && !isEncryptedPlaceholder(row.api_key)) {
            summary.plaintextRows += 1;
        }
        if (row.api_key_ciphertext && row.api_key_nonce) {
            summary.encryptedRows += 1;
        }
        return summary;
    }, { plaintextRows: 0, encryptedRows: 0 });
}

function migrateApiKeys(db, secret, { apply = false } = {}) {
    const apiKeys = db.prepare('SELECT api_key AS id, api_key, api_key_hash, api_key_ciphertext, api_key_nonce FROM api_keys').all();
    const orders = db.prepare('SELECT id, api_key, api_key_ciphertext, api_key_nonce FROM orders').all();
    const summary = {
        apiKeys: planApiKeyEncryptionMigration(apiKeys),
        orders: planApiKeyEncryptionMigration(orders),
        updatedApiKeys: 0,
        updatedOrders: 0
    };
    if (!apply) return summary;

    const run = db.transaction(() => {
        for (const row of apiKeys) {
            if (!row.api_key || row.api_key_ciphertext || isEncryptedPlaceholder(row.api_key)) continue;
            const apiKeyHash = row.api_key_hash || hashApiKey(row.api_key);
            const envelope = encryptApiKeyEnvelope(row.api_key, secret);
            db.prepare(`
UPDATE api_keys
SET api_key = ?, api_key_hash = ?, api_key_ciphertext = ?, api_key_nonce = ?
WHERE api_key = ?
`).run(encryptedApiKeyPlaceholder(apiKeyHash), apiKeyHash, envelope.api_key_ciphertext, envelope.api_key_nonce, row.api_key);
            summary.updatedApiKeys += 1;
        }

        for (const row of orders) {
            if (!row.api_key || row.api_key_ciphertext || isEncryptedPlaceholder(row.api_key)) continue;
            const apiKeyHash = hashApiKey(row.api_key);
            const envelope = encryptApiKeyEnvelope(row.api_key, secret);
            db.prepare(`
UPDATE orders
SET api_key = ?, api_key_ciphertext = ?, api_key_nonce = ?
WHERE id = ?
`).run(encryptedApiKeyPlaceholder(apiKeyHash), envelope.api_key_ciphertext, envelope.api_key_nonce, row.id);
            summary.updatedOrders += 1;
        }
    });
    run();
    return summary;
}

function main(argv = process.argv) {
    const apply = argv.includes('--apply');
    const dbIndex = argv.indexOf('--db');
    const dbPath = path.resolve(dbIndex >= 0 ? argv[dbIndex + 1] : path.join(__dirname, '..', 'data', 'shop.sqlite'));
    const secret = String(process.env.SHOP_API_KEY_ENCRYPTION_SECRET || '').trim();
    if (secret.length < 32) throw new Error('请先配置 SHOP_API_KEY_ENCRYPTION_SECRET，长度至少 32 个字符。');
    if (!fs.existsSync(dbPath)) throw new Error(`数据库不存在：${dbPath}`);

    const backupPath = apply ? backupShopDatabase(dbPath, path.join(path.dirname(dbPath), 'backups')) : '';
    const db = new Database(dbPath);
    try {
        const result = migrateApiKeys(db, secret, { apply });
        console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', backupPath, result }, null, 2));
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    encryptedApiKeyPlaceholder,
    migrateApiKeys,
    planApiKeyEncryptionMigration
};
