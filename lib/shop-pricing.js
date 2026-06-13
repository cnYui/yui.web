const {
    chargeNanosToCents,
    nonNegativeInteger
} = require('./shop-money');

const defaultGptModel = 'gpt-5.4';

const gptModelRmbPrices = Object.freeze({
    'gpt-5.4': Object.freeze({
        model: 'gpt-5.4',
        version: 'gpt-5.4-rmb-20260613',
        cacheHitInputNanosPerToken: 250,
        cacheMissInputNanosPerToken: 2500,
        outputNanosPerToken: 15000
    }),
    'gpt-5.5': Object.freeze({
        model: 'gpt-5.5',
        version: 'gpt-5.5-rmb-20260613',
        cacheHitInputNanosPerToken: 500,
        cacheMissInputNanosPerToken: 5000,
        outputNanosPerToken: 30000
    })
});

const currentDefaultRmbPrice = gptModelRmbPrices[defaultGptModel];
// 兼容旧导入名，实际当前默认价格已切到 GPT 5.4。
const deepseekProRmbPrice = currentDefaultRmbPrice;

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

function priceForModel(model) {
    const normalizedModel = String(model || '').trim().toLowerCase();
    return gptModelRmbPrices[normalizedModel] || gptModelRmbPrices[defaultGptModel];
}

function priceForVersion(version) {
    const normalizedVersion = String(version || '').trim();
    if (normalizedVersion === 'deepseek-v4-pro-rmb-20260424') {
        return {
            model: 'deepseek-v4-pro',
            version: normalizedVersion,
            cacheHitInputNanosPerToken: 25,
            cacheMissInputNanosPerToken: 3000,
            outputNanosPerToken: 6000
        };
    }
    if (normalizedVersion === 'deepseek-v4-pro-rmb-20260612-cache-hit-10x') {
        return {
            model: 'deepseek-v4-pro',
            version: normalizedVersion,
            cacheHitInputNanosPerToken: 250,
            cacheMissInputNanosPerToken: 3000,
            outputNanosPerToken: 6000
        };
    }
    if (normalizedVersion === 'deepseek-v4-pro-rmb-20260612-output-20rmb') {
        return {
            model: 'deepseek-v4-pro',
            version: normalizedVersion,
            cacheHitInputNanosPerToken: 250,
            cacheMissInputNanosPerToken: 3000,
            outputNanosPerToken: 20000
        };
    }
    return Object.values(gptModelRmbPrices).find((price) => price.version === normalizedVersion) || currentDefaultRmbPrice;
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

    const price = priceForModel(event.model);
    const chargeNanos =
        nonNegativeInteger(event.cacheHitInputTokens) * price.cacheHitInputNanosPerToken +
        nonNegativeInteger(event.cacheMissInputTokens) * price.cacheMissInputNanosPerToken +
        nonNegativeInteger(event.outputTokens) * price.outputNanosPerToken;

    return {
        chargeNanos,
        chargeCents: chargeNanosToCents(chargeNanos),
        status: chargeNanos > 0 ? 'charged' : 'unpriced_no_charge',
        priceVersion: price.version
    };
}

module.exports = {
    chargeNanosToCents,
    currentDefaultRmbPrice,
    defaultGptModel,
    deepseekProRmbPrice,
    deriveInputTokenBreakdown,
    gptModelRmbPrices,
    priceForModel,
    priceForVersion,
    priceUsageTokens
};
