const nanosPerCent = 10000000;

const deepseekProRmbPrice = Object.freeze({
    version: 'deepseek-v4-pro-rmb-20260424',
    cacheHitInputNanosPerToken: 25,
    cacheMissInputNanosPerToken: 3000,
    outputNanosPerToken: 6000
});

function nonNegativeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.floor(number);
}

function chargeNanosToCents(nanos) {
    const value = nonNegativeInteger(nanos);
    return value <= 0 ? 0 : Math.ceil(value / nanosPerCent);
}

function deriveInputTokenBreakdown(tokens = {}) {
    let inputTokens = nonNegativeInteger(tokens.inputTokens ?? tokens.input_tokens);
    let cachedTokens = nonNegativeInteger(tokens.cachedTokens ?? tokens.cached_tokens);
    let cacheHitInputTokens = nonNegativeInteger(tokens.cacheHitInputTokens ?? tokens.cache_hit_input_tokens);
    let cacheMissInputTokens = nonNegativeInteger(tokens.cacheMissInputTokens ?? tokens.cache_miss_input_tokens);

    if (cacheHitInputTokens === 0 && cachedTokens > 0) {
        cacheHitInputTokens = cachedTokens;
    }
    if (cachedTokens === 0 && cacheHitInputTokens > 0) {
        cachedTokens = cacheHitInputTokens;
    }
    if (inputTokens === 0 && (cacheHitInputTokens > 0 || cacheMissInputTokens > 0)) {
        inputTokens = cacheHitInputTokens + cacheMissInputTokens;
    }
    if (cacheMissInputTokens === 0 && inputTokens > cacheHitInputTokens) {
        cacheMissInputTokens = inputTokens - cacheHitInputTokens;
    }

    return { cacheHitInputTokens, cacheMissInputTokens, cachedTokens, inputTokens };
}

function priceUsageTokens(event = {}) {
    if (event.failed) {
        return {
            chargeNanos: 0,
            chargeCents: 0,
            status: 'failed_no_charge',
            priceVersion: 'failed-no-charge'
        };
    }

    const chargeNanos =
        nonNegativeInteger(event.cacheHitInputTokens) * deepseekProRmbPrice.cacheHitInputNanosPerToken +
        nonNegativeInteger(event.cacheMissInputTokens) * deepseekProRmbPrice.cacheMissInputNanosPerToken +
        nonNegativeInteger(event.outputTokens) * deepseekProRmbPrice.outputNanosPerToken;

    return {
        chargeNanos,
        chargeCents: chargeNanosToCents(chargeNanos),
        status: chargeNanos > 0 ? 'charged' : 'unpriced_no_charge',
        priceVersion: deepseekProRmbPrice.version
    };
}

module.exports = {
    chargeNanosToCents,
    deepseekProRmbPrice,
    deriveInputTokenBreakdown,
    priceUsageTokens
};
