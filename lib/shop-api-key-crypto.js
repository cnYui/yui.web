const crypto = require('node:crypto');

function keyPreview(apiKey) {
    const value = String(apiKey || '');
    if (!value) return '';
    return `${value.slice(0, 12)}...${value.slice(-6)}`;
}

function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(String(apiKey || '').trim()).digest('hex');
}

function secretKey(secret) {
    const value = String(secret || '').trim();
    if (value.length < 32) {
        throw new Error('SHOP_API_KEY_ENCRYPTION_SECRET 至少需要 32 个字符。');
    }
    return crypto.createHash('sha256').update(value).digest();
}

function encryptApiKeyEnvelope(apiKey, secret) {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(secret), nonce);
    const encrypted = Buffer.concat([cipher.update(String(apiKey), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        api_key_ciphertext: `${tag.toString('base64url')}.${encrypted.toString('base64url')}`,
        api_key_nonce: nonce.toString('base64url')
    };
}

function decryptApiKeyEnvelope(row, secret) {
    const [tagText, encryptedText] = String(row?.api_key_ciphertext || '').split('.');
    if (!tagText || !encryptedText || !row?.api_key_nonce) {
        throw new Error('API key 密文格式无效。');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(secret), Buffer.from(row.api_key_nonce, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64url')),
        decipher.final()
    ]).toString('utf8');
}

function readStoredApiKey(row, secret) {
    if (row?.api_key_ciphertext && row?.api_key_nonce) {
        return decryptApiKeyEnvelope(row, secret);
    }
    return String(row?.api_key || '');
}

module.exports = {
    decryptApiKeyEnvelope,
    encryptApiKeyEnvelope,
    hashApiKey,
    keyPreview,
    readStoredApiKey
};
