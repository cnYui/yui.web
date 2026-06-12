const fs = require('node:fs');
const path = require('node:path');

function defaultAuditLogDir() {
    return process.env.SHOP_CHARGE_AUDIT_LOG_DIR || path.join(process.cwd(), 'data', 'logs', 'shop-charge-records');
}

function auditLogMonth(value) {
    const text = String(value || '');
    if (/^\d{4}-\d{2}/.test(text)) return text.slice(0, 7);
    const date = new Date(text || Date.now());
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 7);
    return date.toISOString().slice(0, 7);
}

function normalizeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.trunc(number);
}

function normalizeChargeAuditRecord(record = {}) {
    const createdAt = String(record.createdAt || record.created_at || '');
    return {
        loggedAt: String(record.loggedAt || new Date().toISOString()),
        source: String(record.source || 'realtime'),
        chargeId: String(record.chargeId || record.id || ''),
        phone: String(record.phone || ''),
        usageEventId: String(record.usageEventId || record.usage_event_id || ''),
        apiKeyHash: String(record.apiKeyHash || record.api_key_hash || ''),
        apiKeyPreview: String(record.apiKeyPreview || record.api_key_preview || ''),
        model: String(record.model || 'unknown'),
        inputTokens: normalizeInteger(record.inputTokens ?? record.input_tokens),
        outputTokens: normalizeInteger(record.outputTokens ?? record.output_tokens),
        cacheHitInputTokens: normalizeInteger(record.cacheHitInputTokens ?? record.cache_hit_input_tokens),
        cacheMissInputTokens: normalizeInteger(record.cacheMissInputTokens ?? record.cache_miss_input_tokens),
        reasoningTokens: normalizeInteger(record.reasoningTokens ?? record.reasoning_tokens),
        totalTokens: normalizeInteger(record.totalTokens ?? record.total_tokens),
        priceVersion: String(record.priceVersion || record.price_version || ''),
        chargeCents: normalizeInteger(record.chargeCents ?? record.charge_cents),
        chargeNanos: normalizeInteger(record.chargeNanos ?? record.charge_nanos),
        balanceBeforeCents: normalizeInteger(record.balanceBeforeCents ?? record.balance_before_cents),
        balanceBeforeNanos: normalizeInteger(record.balanceBeforeNanos ?? record.balance_before_nanos),
        balanceAfterCents: normalizeInteger(record.balanceAfterCents ?? record.balance_after_cents),
        balanceAfterNanos: normalizeInteger(record.balanceAfterNanos ?? record.balance_after_nanos),
        status: String(record.status || ''),
        createdAt
    };
}

function chargeAuditLogPath(record = {}, options = {}) {
    const dir = path.resolve(options.auditLogDir || defaultAuditLogDir());
    const month = auditLogMonth(record.createdAt || record.loggedAt);
    return path.join(dir, `api-charge-records-${month}.jsonl`);
}

function appendShopChargeAuditLog(record = {}, options = {}) {
    const normalized = normalizeChargeAuditRecord(record);
    const filePath = chargeAuditLogPath(normalized, options);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(normalized)}\n`, 'utf8');
    return filePath;
}

module.exports = {
    appendShopChargeAuditLog,
    chargeAuditLogPath,
    normalizeChargeAuditRecord
};
