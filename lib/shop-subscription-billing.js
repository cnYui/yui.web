const { nonNegativeInteger } = require('./shop-money');

const usdMicrosPerUsd = 1000000;
const usdPricingVersion = 'openai-standard-short-usd-20260616';

const subscriptionPlans = Object.freeze([
    Object.freeze({
        id: 'sub_29_daily_19_usd',
        name: '29 元订阅池',
        monthlyPriceCents: 2900,
        dailyQuotaUsdMicros: 19000000,
        periodDays: 30
    }),
    Object.freeze({
        id: 'sub_39_daily_29_usd',
        name: '39 元订阅池',
        monthlyPriceCents: 3900,
        dailyQuotaUsdMicros: 29000000,
        periodDays: 30
    }),
    Object.freeze({
        id: 'sub_59_daily_49_usd',
        name: '59 元订阅池',
        monthlyPriceCents: 5900,
        dailyQuotaUsdMicros: 49000000,
        periodDays: 30
    })
]);

const addonPackages = Object.freeze([
    Object.freeze({ amountCents: 500, quotaUsdMicros: 5000000 }),
    Object.freeze({ amountCents: 1000, quotaUsdMicros: 10000000 }),
    Object.freeze({ amountCents: 2000, quotaUsdMicros: 20000000 }),
    Object.freeze({ amountCents: 5000, quotaUsdMicros: 50000000 })
]);

const officialUsdPrices = Object.freeze({
    'gpt-5.4': Object.freeze({
        model: 'gpt-5.4',
        version: usdPricingVersion,
        inputUsdMicrosPerMillionTokens: 2500000,
        cachedInputUsdMicrosPerMillionTokens: 250000,
        outputUsdMicrosPerMillionTokens: 15000000
    }),
    'gpt-5.5': Object.freeze({
        model: 'gpt-5.5',
        version: usdPricingVersion,
        inputUsdMicrosPerMillionTokens: 5000000,
        cachedInputUsdMicrosPerMillionTokens: 500000,
        outputUsdMicrosPerMillionTokens: 30000000
    })
});

function formatUsdMicros(value) {
    return `$${(Number(value || 0) / usdMicrosPerUsd).toFixed(2)}`;
}

function priceTokensUsdMicros(tokens, usdMicrosPerMillionTokens) {
    const safeTokens = nonNegativeInteger(tokens);
    const safePrice = nonNegativeInteger(usdMicrosPerMillionTokens);
    if (!safeTokens || !safePrice) return 0;
    return Math.ceil((safeTokens * safePrice) / 1000000);
}

function priceForModel(model) {
    const normalized = String(model || '').trim().toLowerCase();
    return officialUsdPrices[normalized] || officialUsdPrices['gpt-5.4'];
}

function priceOfficialUsageUsd(event = {}) {
    if (event.failed) {
        return {
            chargeUsdMicros: 0,
            officialPriceVersion: 'failed-no-charge',
            status: 'failed_no_charge'
        };
    }
    const price = priceForModel(event.model);
    const chargeUsdMicros =
        priceTokensUsdMicros(event.cacheHitInputTokens ?? event.cache_hit_input_tokens, price.cachedInputUsdMicrosPerMillionTokens) +
        priceTokensUsdMicros(event.cacheMissInputTokens ?? event.cache_miss_input_tokens, price.inputUsdMicrosPerMillionTokens) +
        priceTokensUsdMicros(event.outputTokens ?? event.output_tokens, price.outputUsdMicrosPerMillionTokens);
    return {
        chargeUsdMicros,
        officialPriceVersion: usdPricingVersion,
        status: chargeUsdMicros > 0 ? 'charged' : 'unpriced_no_charge'
    };
}

function splitUsdChargeByQuota({ chargeUsdMicros, dailyRemainingUsdMicros, addonBalanceUsdMicros } = {}) {
    const charge = nonNegativeInteger(chargeUsdMicros);
    const dailyBefore = nonNegativeInteger(dailyRemainingUsdMicros);
    const addonBefore = nonNegativeInteger(addonBalanceUsdMicros);
    const dailyDeducted = Math.min(charge, dailyBefore);
    const remainingAfterDaily = charge - dailyDeducted;
    const addonDeducted = Math.min(remainingAfterDaily, addonBefore);
    const overrun = Math.max(0, remainingAfterDaily - addonDeducted);
    return {
        dailyQuotaBeforeUsdMicros: dailyBefore,
        dailyQuotaDeductedUsdMicros: dailyDeducted,
        dailyQuotaAfterUsdMicros: dailyBefore - dailyDeducted,
        addonBalanceBeforeUsdMicros: addonBefore,
        addonDeductedUsdMicros: addonDeducted,
        addonBalanceAfterUsdMicros: addonBefore - addonDeducted,
        overrunUsdMicros: overrun
    };
}

function subscriptionPlanById(planId) {
    const normalized = String(planId || '').trim();
    return subscriptionPlans.find((plan) => plan.id === normalized) || null;
}

function addonPackageByAmountCents(amountCents) {
    const normalized = nonNegativeInteger(amountCents);
    return addonPackages.find((item) => item.amountCents === normalized) || null;
}

module.exports = {
    addonPackageByAmountCents,
    addonPackages,
    formatUsdMicros,
    officialUsdPrices,
    priceForModel,
    priceOfficialUsageUsd,
    splitUsdChargeByQuota,
    subscriptionPlanById,
    subscriptionPlans,
    usdPricingVersion
};
