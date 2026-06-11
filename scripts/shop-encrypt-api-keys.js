#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const {
    encryptApiKeyEnvelope,
    hashApiKey
} = require('../lib/shop-api-key-crypto');

function timestamp() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function encryptedApiKeyPlaceholder(id) {
    return `enc_${String(id || '').trim()}`;
}

function isEncryptedPlaceholder(value) {
    return /^enc_\S+$/.test(String(value || '').trim());
}

function hasEncryptedEnvelope(row) {
    return Boolean(row?.api_key_ciphertext && row?.api_key_nonce);
}

function hasPlaintextApiKey(row) {
    const apiKey = String(row?.api_key || '').trim();
    return Boolean(apiKey && !isEncryptedPlaceholder(apiKey) && !hasEncryptedEnvelope(row));
}

function planApiKeyEncryptionMigration(rows) {
    return rows.reduce((summary, row) => {
        if (hasPlaintextApiKey(row)) summary.plaintextRows += 1;
        if (hasEncryptedEnvelope(row)) summary.encryptedRows += 1;
        return summary;
    }, { plaintextRows: 0, encryptedRows: 0 });
}

function tableColumns(db, tableName) {
    return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
}

function selectEncryptionRows(db, tableName, idColumn) {
    const columns = tableColumns(db, tableName);
    const ciphertextSelect = columns.has('api_key_ciphertext') ? 'api_key_ciphertext' : 'NULL AS api_key_ciphertext';
    const nonceSelect = columns.has('api_key_nonce') ? 'api_key_nonce' : 'NULL AS api_key_nonce';
    return db.prepare(`
SELECT ${idColumn} AS id, api_key, ${ciphertextSelect}, ${nonceSelect}
FROM ${tableName}
`).all();
}

function ensureEncryptionColumns(db, tableName) {
    const columns = tableColumns(db, tableName);
    if (!columns.has('api_key_ciphertext')) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN api_key_ciphertext TEXT;`);
    }
    if (!columns.has('api_key_nonce')) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN api_key_nonce TEXT;`);
    }
}

function migrateApiKeys(db, secret, { apply = false } = {}) {
    if (apply) {
        ensureEncryptionColumns(db, 'api_keys');
        ensureEncryptionColumns(db, 'orders');
    }
    const apiKeys = selectEncryptionRows(db, 'api_keys', 'api_key_hash');
    const orders = selectEncryptionRows(db, 'orders', 'id');
    const summary = {
        apiKeys: planApiKeyEncryptionMigration(apiKeys),
        orders: planApiKeyEncryptionMigration(orders),
        updatedApiKeys: 0,
        updatedOrders: 0
    };
    if (!apply) return summary;

    const updateApiKey = db.prepare(`
UPDATE api_keys
SET api_key = @apiKey,
    api_key_ciphertext = @apiKeyCiphertext,
    api_key_nonce = @apiKeyNonce
WHERE api_key_hash = @id
`);
    const updateOrder = db.prepare(`
UPDATE orders
SET api_key = @apiKey,
    api_key_ciphertext = @apiKeyCiphertext,
    api_key_nonce = @apiKeyNonce
WHERE id = @id
`);
    const run = db.transaction(() => {
        for (const row of apiKeys) {
            if (!hasPlaintextApiKey(row)) continue;
            const envelope = encryptApiKeyEnvelope(row.api_key, secret);
            updateApiKey.run({
                id: row.id,
                apiKey: encryptedApiKeyPlaceholder(row.id),
                apiKeyCiphertext: envelope.api_key_ciphertext,
                apiKeyNonce: envelope.api_key_nonce
            });
            summary.updatedApiKeys += 1;
        }

        for (const row of orders) {
            if (!hasPlaintextApiKey(row)) continue;
            const envelope = encryptApiKeyEnvelope(row.api_key, secret);
            updateOrder.run({
                id: row.id,
                apiKey: encryptedApiKeyPlaceholder(hashApiKey(row.api_key)),
                apiKeyCiphertext: envelope.api_key_ciphertext,
                apiKeyNonce: envelope.api_key_nonce
            });
            summary.updatedOrders += 1;
        }
    });
    run();
    return summary;
}

function parseArgs(argv = process.argv) {
    const args = { apply: false, db: path.join(__dirname, '..', 'data', 'shop.sqlite') };
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

function backupShopDatabase(dbPath, backupDir = path.join(path.dirname(dbPath), 'backups'), stamp = timestamp()) {
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `shop-before-api-key-encryption-${stamp}.sqlite`);
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
}

function main(argv = process.argv) {
    const args = parseArgs(argv);
    const dbPath = path.resolve(args.db);
    const secret = String(process.env.SHOP_API_KEY_ENCRYPTION_SECRET || '').trim();
    if (secret.length < 32) {
        throw new Error('请先配置至少 32 个字符的 SHOP_API_KEY_ENCRYPTION_SECRET。');
    }
    if (!fs.existsSync(dbPath)) {
        throw new Error(`数据库不存在：${dbPath}`);
    }
    const backupPath = args.apply ? backupShopDatabase(dbPath) : '';
    const db = new Database(dbPath);
    try {
        const result = migrateApiKeys(db, secret, { apply: args.apply });
        console.log(JSON.stringify({ mode: args.apply ? 'apply' : 'dry-run', backupPath, result }, null, 2));
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    backupShopDatabase,
    encryptedApiKeyPlaceholder,
    isEncryptedPlaceholder,
    main,
    migrateApiKeys,
    parseArgs,
    planApiKeyEncryptionMigration
};
