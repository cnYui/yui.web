const crypto = require('node:crypto');

const { appendShopChargeAuditLog } = require('./shop-charge-audit-log');
const { nanosToBalanceCents } = require('./shop-money');
const { deriveInputTokenBreakdown, priceUsageTokens } = require('./shop-pricing');

function reconcileRecordId(prefix, requestId) {
    return `${prefix}${crypto.createHash('sha256').update(String(requestId || '')).digest('hex').slice(0, 24)}`;
}

function ownerByHash(db, apiKeyHash) {
    return db.prepare(`
SELECT o.phone AS phone
FROM api_keys ak
JOIN orders o ON o.id = ak.order_id OR o.api_key = ak.api_key
WHERE ak.api_key_hash = ?
UNION
SELECT phone
FROM usage_key_profiles
WHERE api_key_hash = ? AND phone != ''
LIMIT 1
`).get(apiKeyHash, apiKeyHash)?.phone || '';
}

function collectCandidates(db) {
    return db.prepare(`
SELECT request_id, api_key_hash, api_key_preview, model, input_tokens, output_tokens,
       reasoning_tokens, cached_tokens, cache_hit_input_tokens, cache_miss_input_tokens,
       total_tokens, failed
FROM usage_events
ORDER BY requested_at ASC, rowid ASC
`).all();
}

function ensureBalanceRow(db, phone, now) {
    db.prepare(`
INSERT INTO account_balances (
  phone, balance_cents, balance_nanos, pending_topup_cents, pending_topup_nanos,
  credit_limit_cents, credit_limit_nanos, updated_at
)
VALUES (?, 0, 0, 0, 0, 1000, 10000000000, ?)
ON CONFLICT(phone) DO NOTHING
`).run(phone, now);
}

function appendChargeAuditLog(record, options = {}) {
    try {
        appendShopChargeAuditLog(record, { auditLogDir: options.auditLogDir });
    } catch (error) {
        console.error('shop reconcile charge audit log write failed', {
            usageEventId: record.usageEventId,
            error: error.message || String(error)
        });
    }
}

function reconcileUsageBilling(db, options = {}) {
    const apply = Boolean(options.apply);
    const now = options.now || (() => new Date().toISOString());
    const summary = {
        updatedUsageBreakdowns: 0,
        createdCharges: 0,
        adjustedUnpricedCharges: 0,
        skippedFailed: 0,
        skippedUnowned: 0,
        totalChargeNanos: 0,
        byPhone: {}
    };

    const run = () => {
        for (const row of collectCandidates(db)) {
            const breakdown = deriveInputTokenBreakdown({
                inputTokens: row.input_tokens,
                cachedTokens: row.cached_tokens,
                cacheHitInputTokens: row.cache_hit_input_tokens,
                cacheMissInputTokens: row.cache_miss_input_tokens
            });
            const needsBreakdownUpdate =
                row.input_tokens !== breakdown.inputTokens ||
                row.cached_tokens !== breakdown.cachedTokens ||
                row.cache_hit_input_tokens !== breakdown.cacheHitInputTokens ||
                row.cache_miss_input_tokens !== breakdown.cacheMissInputTokens;

            if (needsBreakdownUpdate) {
                summary.updatedUsageBreakdowns += 1;
                if (apply) {
                    db.prepare(`
UPDATE usage_events
SET input_tokens = ?, cached_tokens = ?, cache_hit_input_tokens = ?, cache_miss_input_tokens = ?
WHERE request_id = ?
`).run(breakdown.inputTokens, breakdown.cachedTokens, breakdown.cacheHitInputTokens, breakdown.cacheMissInputTokens, row.request_id);
                }
            }

            if (row.failed) {
                summary.skippedFailed += 1;
                continue;
            }

            const phone = ownerByHash(db, row.api_key_hash);
            if (!phone) {
                summary.skippedUnowned += 1;
                continue;
            }

            const pricing = priceUsageTokens({
                model: row.model || 'unknown',
                failed: false,
                cacheHitInputTokens: breakdown.cacheHitInputTokens,
                cacheMissInputTokens: breakdown.cacheMissInputTokens,
                outputTokens: row.output_tokens,
                reasoningTokens: row.reasoning_tokens
            });
            if (pricing.chargeNanos <= 0) continue;

            const existing = db.prepare('SELECT id, status, charge_nanos FROM api_charge_records WHERE usage_event_id = ?').get(row.request_id);
            const ledgerExists = db.prepare('SELECT 1 AS found FROM account_ledger_entries WHERE related_id = ? AND entry_type = ?').get(row.request_id, 'api_charge');
            if (!existing) {
                summary.createdCharges += 1;
            } else if (existing.status === 'unpriced_no_charge' && Number(existing.charge_nanos || 0) === 0 && !ledgerExists) {
                summary.adjustedUnpricedCharges += 1;
            } else {
                continue;
            }

            summary.totalChargeNanos += pricing.chargeNanos;
            summary.byPhone[phone] = (summary.byPhone[phone] || 0) + pricing.chargeNanos;
            if (!apply) continue;

            const timestamp = now();
            ensureBalanceRow(db, phone, timestamp);
            const balance = db.prepare('SELECT balance_nanos FROM account_balances WHERE phone = ?').get(phone);
            const beforeNanos = Number(balance?.balance_nanos || 0);
            const afterNanos = beforeNanos - pricing.chargeNanos;
            const beforeCents = nanosToBalanceCents(beforeNanos);
            const afterCents = nanosToBalanceCents(afterNanos);
            const chargeId = existing ? existing.id || reconcileRecordId('CHARGE_RECON_', row.request_id) : reconcileRecordId('CHARGE_RECON_', row.request_id);

            if (!existing) {
                db.prepare(`
INSERT INTO api_charge_records (
  id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
  cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
  price_version, charge_cents, charge_nanos, balance_before_cents, balance_before_nanos,
  balance_after_cents, balance_after_nanos, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
                    chargeId,
                    phone,
                    row.request_id,
                    row.api_key_hash,
                    row.model || 'unknown',
                    breakdown.inputTokens,
                    row.output_tokens,
                    breakdown.cacheHitInputTokens,
                    breakdown.cacheMissInputTokens,
                    row.reasoning_tokens,
                    row.total_tokens,
                    pricing.priceVersion,
                    pricing.chargeCents,
                    pricing.chargeNanos,
                    beforeCents,
                    beforeNanos,
                    afterCents,
                    afterNanos,
                    pricing.status,
                    timestamp
                );
            } else {
                db.prepare(`
UPDATE api_charge_records
SET price_version = ?, charge_cents = ?, charge_nanos = ?, balance_before_cents = ?,
    balance_before_nanos = ?, balance_after_cents = ?, balance_after_nanos = ?,
    cache_hit_input_tokens = ?, cache_miss_input_tokens = ?, status = ?
WHERE usage_event_id = ?
`).run(
                    pricing.priceVersion,
                    pricing.chargeCents,
                    pricing.chargeNanos,
                    beforeCents,
                    beforeNanos,
                    afterCents,
                    afterNanos,
                    breakdown.cacheHitInputTokens,
                    breakdown.cacheMissInputTokens,
                    pricing.status,
                    row.request_id
                );
            }

            db.prepare('UPDATE account_balances SET balance_cents = ?, balance_nanos = ?, updated_at = ? WHERE phone = ?').run(afterCents, afterNanos, timestamp, phone);
            db.prepare(`
INSERT INTO account_ledger_entries (
  id, phone, entry_type, amount_cents, amount_nanos, balance_after_cents, balance_after_nanos,
  currency, related_id, memo, created_at, created_by_phone
) VALUES (?, ?, 'api_charge', ?, ?, ?, ?, 'CNY', ?, ?, ?, '')
`).run(
                reconcileRecordId('LEDGER_RECON_', row.request_id),
                phone,
                -pricing.chargeCents,
                -pricing.chargeNanos,
                afterCents,
                afterNanos,
                row.request_id,
                `${row.model || 'unknown'} API 调用历史补账`,
                timestamp
            );
            appendChargeAuditLog({
                source: 'reconcile',
                chargeId,
                phone,
                usageEventId: row.request_id,
                apiKeyHash: row.api_key_hash,
                apiKeyPreview: row.api_key_preview,
                model: row.model || 'unknown',
                inputTokens: breakdown.inputTokens,
                outputTokens: row.output_tokens,
                cacheHitInputTokens: breakdown.cacheHitInputTokens,
                cacheMissInputTokens: breakdown.cacheMissInputTokens,
                reasoningTokens: row.reasoning_tokens,
                totalTokens: row.total_tokens,
                priceVersion: pricing.priceVersion,
                chargeCents: pricing.chargeCents,
                chargeNanos: pricing.chargeNanos,
                balanceBeforeCents: beforeCents,
                balanceBeforeNanos: beforeNanos,
                balanceAfterCents: afterCents,
                balanceAfterNanos: afterNanos,
                status: pricing.status,
                createdAt: timestamp
            }, options);
        }
        return summary;
    };

    if (!apply) return run();
    return db.transaction(run)();
}

module.exports = { reconcileUsageBilling };
