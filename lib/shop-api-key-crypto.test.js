const assert = require('node:assert/strict');
const test = require('node:test');

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
