const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');

const {
    decryptApiKeyEnvelope,
    encryptApiKeyEnvelope,
    hashApiKey,
    keyPreview,
    readStoredApiKey
} = require('./shop-api-key-crypto');

test('API key hash 和 preview 与现有语义一致', () => {
    assert.equal(hashApiKey(' sk-test-value '), '928d882b42396230e7dd937a6a2245ec9401f6a078fe5b8d0cab98e88c8ed74d');
    assert.equal(keyPreview('sk-1234567890abcdef'), 'sk-123456789...abcdef');
});

test('AES-GCM envelope 可解密且密文不包含原文', () => {
    const secret = '0123456789abcdef0123456789abcdef';
    const encrypted = encryptApiKeyEnvelope('sk-secret-value', secret);
    assert.notEqual(encrypted.api_key_ciphertext.includes('sk-secret-value'), true);
    assert.equal(decryptApiKeyEnvelope(encrypted, secret), 'sk-secret-value');
});

test('secret 错误时不能解密', () => {
    const encrypted = encryptApiKeyEnvelope('sk-secret-value', '0123456789abcdef0123456789abcdef');
    assert.throws(() => decryptApiKeyEnvelope(encrypted, 'abcdef0123456789abcdef0123456789'));
});

test('readStoredApiKey 优先读密文，旧记录回退明文', () => {
    const secret = '0123456789abcdef0123456789abcdef';
    const encrypted = encryptApiKeyEnvelope('sk-encrypted', secret);
    assert.equal(readStoredApiKey({ ...encrypted, api_key: 'sk-plain' }, secret), 'sk-encrypted');
    assert.equal(readStoredApiKey({ api_key: 'sk-plain' }, secret), 'sk-plain');
});

test('加密迁移 dry-run 统计旧明文记录和已加密记录', () => {
    const { encryptedApiKeyPlaceholder, planApiKeyEncryptionMigration } = require('../scripts/shop-encrypt-api-keys');
    const rows = [
        { id: 'A', api_key: 'sk-a', api_key_ciphertext: null, api_key_nonce: null },
        { id: 'B', api_key: encryptedApiKeyPlaceholder('hash-b'), api_key_ciphertext: 'cipher', api_key_nonce: 'nonce' }
    ];
    assert.deepEqual(planApiKeyEncryptionMigration(rows), { plaintextRows: 1, encryptedRows: 1 });
    assert.equal(encryptedApiKeyPlaceholder('hash-a'), 'enc_hash-a');
});

test('加密迁移 dry-run 兼容尚未添加密文字段的旧数据库', () => {
    const { migrateApiKeys } = require('../scripts/shop-encrypt-api-keys');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-key-migration-'));
    const db = new Database(path.join(tempDir, 'shop.sqlite'));
    try {
        db.exec(`
CREATE TABLE api_keys (
  api_key TEXT PRIMARY KEY,
  api_key_hash TEXT NOT NULL
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  api_key TEXT NOT NULL
);
INSERT INTO api_keys (api_key, api_key_hash) VALUES ('sk-old-api-key', 'hash-old-api-key');
INSERT INTO orders (id, api_key) VALUES ('ORDER1', 'sk-old-api-key');
`);
        assert.deepEqual(migrateApiKeys(db, '0123456789abcdef0123456789abcdef', { apply: false }), {
            apiKeys: { plaintextRows: 1, encryptedRows: 0 },
            orders: { plaintextRows: 1, encryptedRows: 0 },
            updatedApiKeys: 0,
            updatedOrders: 0
        });
    } finally {
        db.close();
        fs.rmSync(tempDir, { force: true, recursive: true });
    }
});
