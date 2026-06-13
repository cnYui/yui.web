const {
    gptModelRmbPrices,
    priceForModel
} = require('./shop-pricing');
const { nanosPerYuan } = require('./shop-money');

function cnyPerMillionTokens(nanosPerToken) {
    return Number(nanosPerToken || 0) * 1000000 / nanosPerYuan;
}

function modelPriceOverview(modelId, available) {
    const id = String(modelId || '').trim();
    const normalizedId = id.toLowerCase();
    const price = priceForModel(normalizedId);
    return {
        id,
        available: Boolean(available),
        priceModel: price.model,
        usesDefaultPrice: normalizedId !== price.model,
        priceVersion: price.version,
        cacheHitInputCnyPerMillion: cnyPerMillionTokens(price.cacheHitInputNanosPerToken),
        cacheMissInputCnyPerMillion: cnyPerMillionTokens(price.cacheMissInputNanosPerToken),
        outputCnyPerMillion: cnyPerMillionTokens(price.outputNanosPerToken)
    };
}

function pricingFallbackModelOverview() {
    return Object.keys(gptModelRmbPrices).map((model) => modelPriceOverview(model, false));
}

function normalizeModelList(body = {}) {
    const source = Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.models)
            ? body.models
            : [];
    const seen = new Set();
    const models = [];
    for (const item of source) {
        const id = String(item?.id || item?.model || item?.name || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        models.push(id);
    }
    return models;
}

module.exports = {
    cnyPerMillionTokens,
    modelPriceOverview,
    normalizeModelList,
    pricingFallbackModelOverview
};
