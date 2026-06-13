const assert = require('node:assert/strict');
const test = require('node:test');

const {
    chargeNanosToCents,
    deriveInputTokenBreakdown,
    priceForVersion,
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

test('gpt-5.4 人民币价格只计算 hit、miss 和 output，reasoning 只展示', () => {
    const result = priceUsageTokens({
        model: 'gpt-5.4',
        failed: false,
        cacheHitInputTokens: 400,
        cacheMissInputTokens: 600,
        outputTokens: 50,
        reasoningTokens: 999
    });

    assert.deepEqual(result, {
        chargeNanos: 2350000,
        chargeCents: 1,
        status: 'charged',
        priceVersion: 'gpt-5.4-rmb-20260613'
    });
});

test('gpt-5.4 和 gpt-5.5 按模型使用不同人民币价格', () => {
    const tokens = {
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    };

    assert.deepEqual(priceUsageTokens({ ...tokens, model: 'gpt-5.4' }), {
        chargeNanos: 17750000000,
        chargeCents: 1775,
        status: 'charged',
        priceVersion: 'gpt-5.4-rmb-20260613'
    });
    assert.deepEqual(priceUsageTokens({ ...tokens, model: 'gpt-5.5' }), {
        chargeNanos: 35500000000,
        chargeCents: 3550,
        status: 'charged',
        priceVersion: 'gpt-5.5-rmb-20260613'
    });
});

test('未知模型沿用 gpt-5.4 人民币价格扣费', () => {
    assert.deepEqual(priceUsageTokens({
        model: 'gpt-5.unknown',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    }), {
        chargeNanos: 17750000000,
        chargeCents: 1775,
        status: 'charged',
        priceVersion: 'gpt-5.4-rmb-20260613'
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

test('历史价格版本由 pricing 模块统一回放', () => {
    assert.equal(priceForVersion('deepseek-v4-pro-rmb-20260424').cacheHitInputNanosPerToken, 25);
    assert.equal(priceForVersion('deepseek-v4-pro-rmb-20260612-cache-hit-10x').outputNanosPerToken, 6000);
    assert.equal(priceForVersion('deepseek-v4-pro-rmb-20260612-output-20rmb').outputNanosPerToken, 20000);
    assert.equal(priceForVersion('gpt-5.4-rmb-20260613').cacheMissInputNanosPerToken, 2500);
    assert.equal(priceForVersion('gpt-5.5-rmb-20260613').outputNanosPerToken, 30000);
    assert.equal(priceForVersion('unknown-version').model, 'gpt-5.4');
});
