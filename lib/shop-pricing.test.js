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
        chargeNanos: 1925000,
        chargeCents: 1,
        status: 'charged',
        priceVersion: 'gpt-5.4-rmb-20260614-half-cache-hit-output'
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
        chargeNanos: 10125000000,
        chargeCents: 1013,
        status: 'charged',
        priceVersion: 'gpt-5.4-rmb-20260614-half-cache-hit-output'
    });
    assert.deepEqual(priceUsageTokens({ ...tokens, model: 'gpt-5.5' }), {
        chargeNanos: 20250000000,
        chargeCents: 2025,
        status: 'charged',
        priceVersion: 'gpt-5.5-rmb-20260614-half-cache-hit-output'
    });
});

test('2026-06-14 后缓存命中输入和输出按当前价格砍半，未命中输入保持原价', () => {
    const tokens = {
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    };

    assert.deepEqual(priceUsageTokens({
        ...tokens,
        model: 'gpt-5.4',
        requestedAt: '2026-06-14T13:01:06+09:00'
    }), {
        chargeNanos: 10125000000,
        chargeCents: 1013,
        status: 'charged',
        priceVersion: 'gpt-5.4-rmb-20260614-half-cache-hit-output'
    });
    assert.deepEqual(priceUsageTokens({
        ...tokens,
        model: 'gpt-5.5',
        requestedAt: '2026-06-14T13:01:06+09:00'
    }), {
        chargeNanos: 20250000000,
        chargeCents: 2025,
        status: 'charged',
        priceVersion: 'gpt-5.5-rmb-20260614-half-cache-hit-output'
    });
});

test('2026-06-14 新价格生效前的 GPT usage 继续按旧版本回放', () => {
    assert.deepEqual(priceUsageTokens({
        model: 'gpt-5.5',
        requestedAt: '2026-06-14T13:01:05+09:00',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    }), {
        chargeNanos: 35500000000,
        chargeCents: 3550,
        status: 'charged',
        priceVersion: 'gpt-5.5-rmb-20260613'
    });
});

test('GPT 价格上线前发生的历史 usage 继续使用当时旧价格', () => {
    assert.deepEqual(priceUsageTokens({
        model: 'gpt-5.5',
        requestedAt: '2026-06-12T15:41:25+09:00',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    }), {
        chargeNanos: 9025000000,
        chargeCents: 903,
        status: 'charged',
        priceVersion: 'deepseek-v4-pro-rmb-20260424'
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
        chargeNanos: 10125000000,
        chargeCents: 1013,
        status: 'charged',
        priceVersion: 'gpt-5.4-rmb-20260614-half-cache-hit-output'
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
    assert.equal(priceForVersion('gpt-5.4-rmb-20260614-half-cache-hit-output').cacheHitInputNanosPerToken, 125);
    assert.equal(priceForVersion('gpt-5.5-rmb-20260614-half-cache-hit-output').outputNanosPerToken, 15000);
    assert.equal(priceForVersion('unknown-version').model, 'gpt-5.4');
});
