const assert = require('node:assert/strict');
const test = require('node:test');

const {
    modelPriceOverview,
    normalizeModelList,
    pricingFallbackModelOverview
} = require('./shop-model-overview');

test('模型列表归一化支持 data/models 并按 id 去重', () => {
    assert.deepEqual(normalizeModelList({
        data: [
            { id: 'gpt-5.4' },
            { model: 'gpt-5.4-mini' },
            { name: 'gpt-5.4' },
            { id: '' },
            {}
        ]
    }), ['gpt-5.4', 'gpt-5.4-mini']);

    assert.deepEqual(normalizeModelList({
        models: [
            { name: 'gpt-5.5' },
            { id: 'gpt-5.5-mini' }
        ]
    }), ['gpt-5.5', 'gpt-5.5-mini']);
});

test('模型价格总览保留真实模型 id 并用官方美元价格匹配价格', () => {
    assert.deepEqual(modelPriceOverview('GPT-5.5', true), {
        id: 'GPT-5.5',
        available: true,
        priceModel: 'gpt-5.5',
        usesDefaultPrice: false,
        priceVersion: 'openai-standard-short-usd-20260616',
        cacheHitInputUsdPerMillion: 0.5,
        cacheMissInputUsdPerMillion: 5,
        outputUsdPerMillion: 30
    });

    const unknown = modelPriceOverview('gpt-5.4-mini', true);
    assert.equal(unknown.id, 'gpt-5.4-mini');
    assert.equal(unknown.available, true);
    assert.equal(unknown.priceModel, 'gpt-5.4');
    assert.equal(unknown.usesDefaultPrice, true);
    assert.equal(unknown.priceVersion, 'openai-standard-short-usd-20260616');
    assert.equal(unknown.cacheHitInputUsdPerMillion, 0.25);
    assert.equal(unknown.cacheMissInputUsdPerMillion, 2.5);
    assert.equal(unknown.outputUsdPerMillion, 15);
});

test('价格表 fallback 返回所有已知 GPT 模型且标记为不可用', () => {
    const models = pricingFallbackModelOverview();

    assert.deepEqual(models.map((model) => model.id), ['gpt-5.4', 'gpt-5.5']);
    assert.deepEqual(models.map((model) => model.available), [false, false]);
    assert.equal(models[0].usesDefaultPrice, false);
});
