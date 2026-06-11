const assert = require('node:assert/strict');
const test = require('node:test');

const {
    chargeNanosToCents,
    deriveInputTokenBreakdown,
    priceUsageTokens
} = require('./shop-pricing');

test('旧 JSONL cached_tokens 可推导命中和未命中输入 token', () => {
    assert.deepEqual(
        deriveInputTokenBreakdown({ inputTokens: 1000, cachedTokens: 400 }),
        { cacheHitInputTokens: 400, cacheMissInputTokens: 600, cachedTokens: 400, inputTokens: 1000 }
    );
});

test('显式 hit/miss 优先并回填 input_tokens', () => {
    assert.deepEqual(
        deriveInputTokenBreakdown({ inputTokens: 0, cachedTokens: 0, cacheHitInputTokens: 12, cacheMissInputTokens: 8 }),
        { cacheHitInputTokens: 12, cacheMissInputTokens: 8, cachedTokens: 12, inputTokens: 20 }
    );
});

test('DeepSeek Pro RMB 固定价格只计算 hit、miss 和 output，reasoning 只展示', () => {
    const result = priceUsageTokens({
        failed: false,
        cacheHitInputTokens: 400,
        cacheMissInputTokens: 600,
        outputTokens: 50,
        reasoningTokens: 999
    });

    assert.deepEqual(result, {
        chargeNanos: 2110000,
        chargeCents: 1,
        status: 'charged',
        priceVersion: 'deepseek-v4-pro-rmb-20260424'
    });
});

test('失败事件不扣费', () => {
    assert.deepEqual(
        priceUsageTokens({ failed: true, cacheHitInputTokens: 1, cacheMissInputTokens: 1, outputTokens: 1 }),
        { chargeNanos: 0, chargeCents: 0, status: 'failed_no_charge', priceVersion: 'failed-no-charge' }
    );
});

test('nanos 转 cents 对正数向上取整，对 0 保持 0', () => {
    assert.equal(chargeNanosToCents(0), 0);
    assert.equal(chargeNanosToCents(1), 1);
    assert.equal(chargeNanosToCents(10000000), 1);
    assert.equal(chargeNanosToCents(10000001), 2);
});
