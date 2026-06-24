const assert = require('node:assert/strict');
const test = require('node:test');

const {
    cacheControlForStaticPath,
    isAllowedPublicStaticPath,
    isRetiredShopPath,
} = require('./static-public-policy');

test('公网静态白名单允许用户页面和资源', () => {
    assert.equal(isAllowedPublicStaticPath('/'), true);
    assert.equal(isAllowedPublicStaticPath('/index.html'), true);
    assert.equal(isAllowedPublicStaticPath('/shop/'), true);
    assert.equal(isAllowedPublicStaticPath('/images/shop/code-transit-entry.webp'), true);
    assert.equal(isAllowedPublicStaticPath('/styles/site.css'), true);
    assert.equal(isAllowedPublicStaticPath('/js/theme.js'), true);
});

test('公网静态白名单屏蔽源码、脚本、测试和协作文档', () => {
    assert.equal(isAllowedPublicStaticPath('/server.js'), false);
    assert.equal(isAllowedPublicStaticPath('/lib/shop-money.js'), false);
    assert.equal(isAllowedPublicStaticPath('/scripts/check-static-assets.js'), false);
    assert.equal(isAllowedPublicStaticPath('/test/shop-flow.test.js'), false);
    assert.equal(isAllowedPublicStaticPath('/docs/ai/context/a.md'), false);
    assert.equal(isAllowedPublicStaticPath('/package.json'), false);
    assert.equal(isAllowedPublicStaticPath('/AGENTS.md'), false);
});

test('旧 Shop 控制台路径退役', () => {
    assert.equal(isRetiredShopPath('/shop/login/'), true);
    assert.equal(isRetiredShopPath('/shop/account/index.html'), true);
    assert.equal(isRetiredShopPath('/shop/js/account.js'), true);
    assert.equal(isRetiredShopPath('/shop/assets/pay/alipay-qr.png'), true);
    assert.equal(isRetiredShopPath('/shop/'), false);
});

test('缓存策略区分 HTML 和可缓存静态资源', () => {
    assert.match(cacheControlForStaticPath('/shop/'), /max-age=60/);
    assert.match(cacheControlForStaticPath('/styles/site.css'), /max-age=604800/);
    assert.match(cacheControlForStaticPath('/images/a.webp'), /max-age=604800/);
});
