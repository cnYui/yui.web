const assert = require('node:assert/strict');
const test = require('node:test');

const {
    priceOfficialUsageUsd,
    splitUsdChargeByQuota
} = require('./shop-subscription-billing');

test('gpt-5.4 按官方美元价格计算 usage 扣费', () => {
    assert.deepEqual(priceOfficialUsageUsd({
        model: 'gpt-5.4',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    }), {
        chargeUsdMicros: 17750000,
        officialPriceVersion: 'openai-standard-short-usd-20260616',
        status: 'charged'
    });
});

test('gpt-5.5 按官方美元价格计算 usage 扣费', () => {
    assert.deepEqual(priceOfficialUsageUsd({
        model: 'gpt-5.5',
        failed: false,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    }), {
        chargeUsdMicros: 35500000,
        officialPriceVersion: 'openai-standard-short-usd-20260616',
        status: 'charged'
    });
});

test('失败 usage 不扣美元额度', () => {
    assert.deepEqual(priceOfficialUsageUsd({
        model: 'gpt-5.5',
        failed: true,
        cacheHitInputTokens: 1000000,
        cacheMissInputTokens: 1000000,
        outputTokens: 1000000
    }), {
        chargeUsdMicros: 0,
        officialPriceVersion: 'failed-no-charge',
        status: 'failed_no_charge'
    });
});

test('美元扣费先扣每日套餐额度，再扣长期加量包余额', () => {
    assert.deepEqual(splitUsdChargeByQuota({
        chargeUsdMicros: 7000000,
        dailyRemainingUsdMicros: 3000000,
        addonBalanceUsdMicros: 5000000
    }), {
        dailyQuotaBeforeUsdMicros: 3000000,
        dailyQuotaDeductedUsdMicros: 3000000,
        dailyQuotaAfterUsdMicros: 0,
        addonBalanceBeforeUsdMicros: 5000000,
        addonDeductedUsdMicros: 4000000,
        addonBalanceAfterUsdMicros: 1000000,
        overrunUsdMicros: 0
    });
});

test('套餐额度足够时不消耗加量包余额', () => {
    assert.deepEqual(splitUsdChargeByQuota({
        chargeUsdMicros: 1000000,
        dailyRemainingUsdMicros: 2000000,
        addonBalanceUsdMicros: 5000000
    }), {
        dailyQuotaBeforeUsdMicros: 2000000,
        dailyQuotaDeductedUsdMicros: 1000000,
        dailyQuotaAfterUsdMicros: 1000000,
        addonBalanceBeforeUsdMicros: 5000000,
        addonDeductedUsdMicros: 0,
        addonBalanceAfterUsdMicros: 5000000,
        overrunUsdMicros: 0
    });
});
