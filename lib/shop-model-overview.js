const {
    officialUsdPrices,
    priceForModel
} = require('./shop-subscription-billing');

function usdPerMillionTokens(usdMicrosPerMillionTokens) {
    return Number(usdMicrosPerMillionTokens || 0) / 1000000;
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
        cacheHitInputUsdPerMillion: usdPerMillionTokens(price.cachedInputUsdMicrosPerMillionTokens),
        cacheMissInputUsdPerMillion: usdPerMillionTokens(price.inputUsdMicrosPerMillionTokens),
        outputUsdPerMillion: usdPerMillionTokens(price.outputUsdMicrosPerMillionTokens)
    };
}

function pricingFallbackModelOverview() {
    return Object.keys(officialUsdPrices).map((model) => modelPriceOverview(model, false));
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
    modelPriceOverview,
    normalizeModelList,
    pricingFallbackModelOverview
};
