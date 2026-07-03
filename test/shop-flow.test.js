const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createShopApp } = require('../server');

function cookieHeaderFromSetCookie(setCookie) {
    return String(setCookie || '')
        .split(/,(?=\s*[^;,=]+=[^;,]+)/)
        .map((part) => part.split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
}

async function withServer(run, options = {}) {
    const dbPath = path.join(os.tmpdir(), `yui-shop-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
    const { app, db, usageImporter } = createShopApp({
        adminToken: 'test-admin-token',
        internalToken: 'test-internal-token',
        usageEventHmacSecret: 'test-usage-hmac-secret',
        sub2apiPublicUrl: 'https://sub2api.example.com',
        dbPath,
        ...options
    });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
        await run({ baseUrl, db });
    } finally {
        usageImporter?.stop?.();
        await new Promise((resolve) => server.close(resolve));
        db.close();
    }
}

async function readText(response) {
    return response.text();
}

async function readJson(response) {
    return response.json();
}

test('Shop 首页只保留 Sub2API 跳转入口', async () => {
    await withServer(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/shop/`, { redirect: 'manual' });
        const html = await readText(response);

        assert.equal(response.status, 200);
        assert.match(html, /src="\/images\/optimized\/shop\/code-transit-entry\.webp"/);
        assert.match(html, /href="https:\/\/sub2api\.example\.com"[^>]*data-sub2api-link/);
        assert.doesNotMatch(html, /\/shop\/login/);
        assert.doesNotMatch(html, /\/shop\/account/);
        assert.doesNotMatch(html, /\/shop\/admin/);
    });
});

test('Shop 首页默认跳转到 Sub2API /home', async () => {
    const previousPublicUrl = process.env.SUB2API_PUBLIC_URL;
    delete process.env.SUB2API_PUBLIC_URL;

    try {
        await withServer(async ({ baseUrl }) => {
            const response = await fetch(`${baseUrl}/shop/`, { redirect: 'manual' });
            const html = await readText(response);

            assert.equal(response.status, 200);
            assert.match(html, /href="https:\/\/aaccx\.pw\/home"[^>]*data-sub2api-link/);
        }, { sub2apiPublicUrl: undefined });
    } finally {
        if (previousPublicUrl === undefined) {
            delete process.env.SUB2API_PUBLIC_URL;
        } else {
            process.env.SUB2API_PUBLIC_URL = previousPublicUrl;
        }
    }
});

test('旧 Shop 页面路径跳转到 Sub2API 控制台', async () => {
    await withServer(async ({ baseUrl }) => {
        for (const pathname of [
            '/shop/login/',
            '/shop/register/',
            '/shop/reset-password/',
            '/shop/account/',
            '/shop/admin/',
            '/shop/redeem/',
            '/shop/key/',
            '/shop/query/',
            '/shop/order/',
            '/shop/pay/',
            '/shop/result/',
            '/shop/content/',
            '/shop/guide/',
        ]) {
            const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
            assert.equal(response.status, 302, pathname);
            assert.equal(response.headers.get('location'), 'https://sub2api.example.com', pathname);
        }
    });
});

test('旧 Shop 浏览器 API 返回退役响应', async () => {
    await withServer(async ({ baseUrl }) => {
        for (const { pathname, method } of [
            { pathname: '/api/auth/login', method: 'POST' },
            { pathname: '/api/account/me', method: 'GET' },
            { pathname: '/api/admin/subscription-users', method: 'GET' },
            { pathname: '/api/invites/redeem', method: 'POST' },
            { pathname: '/api/orders/current', method: 'GET' },
        ]) {
            const response = await fetch(`${baseUrl}${pathname}`, { method });
            const body = await readJson(response);
            assert.equal(response.status, 410, pathname);
            assert.equal(body.code, 'SHOP_LEGACY_API_RETIRED', pathname);
        }
    });
});

test('内部 API key 状态接口继续保留内部 token 边界', async () => {
    await withServer(async ({ baseUrl }) => {
        const missingToken = await fetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-test`);
        assert.equal(missingToken.status, 401);

        const invalidRequest = await fetch(`${baseUrl}/api/internal/api-keys/status`, {
            headers: { 'x-internal-token': 'test-internal-token' }
        });
        const body = await readJson(invalidRequest);
        assert.equal(invalidRequest.status, 400);
        assert.equal(body.code, 'INVALID_API_KEY');
    });
});

test('静态服务屏蔽源码并给静态资源设置缓存头', async () => {
    await withServer(async ({ baseUrl }) => {
        const serverSource = await fetch(`${baseUrl}/server.js`);
        assert.equal(serverSource.status, 404);

        const style = await fetch(`${baseUrl}/styles/site.css`, {
            headers: { 'accept-encoding': 'gzip' }
        });
        assert.equal(style.status, 200);
        assert.match(style.headers.get('cache-control') || '', /max-age=604800/);
    });
});

test('注册接口已作为旧浏览器 API 退役，不再创建 yui.web 登录态', async () => {
    await withServer(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                phone: '13800138690',
                password: 'Abcdefg1',
                confirmPassword: 'Abcdefg1'
            })
        });
        const cookie = cookieHeaderFromSetCookie(response.headers.get('set-cookie') || '');
        const body = await readJson(response);

        assert.equal(response.status, 410);
        assert.equal(body.code, 'SHOP_LEGACY_API_RETIRED');
        assert.equal(cookie, '');
    });
});
