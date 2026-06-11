const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { createShopApp } = require('../server');

function hashApiKeyForTest(apiKey) {
    return crypto.createHash('sha256').update(String(apiKey || '').trim()).digest('hex');
}

function keyPreviewForTest(apiKey) {
    return `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}`;
}

function tableColumns(db, tableName) {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
}

function hashPasswordForTest(password) {
    const salt = 'test-admin-salt';
    const hash = crypto.scryptSync(String(password || ''), salt, 64, {
        N: 16384,
        r: 8,
        p: 1
    }).toString('base64url');
    return `scrypt$16384$8$1$${salt}$${hash}`;
}

function cookieHeaderFromSetCookie(setCookie) {
    const value = String(setCookie || '');
    if (value.includes(';') && !/;\s*(Max-Age|Path|Expires|HttpOnly|SameSite|Secure)=?/i.test(value)) {
        return value;
    }
    return value
        .split(/,(?=\s*[^;,=]+=[^;,]+)/)
        .map((part) => part.split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
}

function cookieValue(cookieHeader, name) {
    const prefix = `${name}=`;
    return String(cookieHeader || '')
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix))
        ?.slice(prefix.length) || '';
}

function seedAdminUserForTest(db, password = 'Abcdefg1') {
    db.prepare(`
INSERT INTO users (phone, created_at, password_hash, password_created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
`).run(
        '15951875192',
        '2026-06-09T12:00:00+08:00',
        hashPasswordForTest(password),
        '2026-06-09T12:00:00+08:00',
        '2026-06-09T12:00:00+08:00'
    );
}

async function registerUserAndGetCookie(baseUrl, phone = '13800138690', password = 'Abcdefg1') {
    const result = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ phone, password, confirmPassword: password })
    });
    assert.equal(result.response.status, 201);
    const cookie = cookieHeaderFromSetCookie(result.response.headers.get('set-cookie') || '');
    assert.match(cookie, /yui_shop_account_session=/);
    assert.match(cookie, /yui_shop_csrf=/);
    return cookie;
}

function signUsagePayload(secret, timestamp, body) {
    return crypto.createHmac('sha256', secret).update(`${timestamp}\n`).update(body).digest('hex');
}

async function usageEventFetch(baseUrl, event, options = {}) {
    const timestamp = options.timestamp || String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify(event);
    const secret = options.secret ?? 'usage-hmac-secret';
    const headers = { ...(options.headers || {}) };
    if (options.includeToken !== false) {
        headers['x-internal-token'] = options.token || 'internal-test-token';
    }
    if (options.includeTimestamp !== false) {
        headers['x-usage-timestamp'] = timestamp;
    }
    if (options.includeSignature !== false) {
        headers['x-usage-signature'] = options.signature || signUsagePayload(secret, timestamp, body);
    }
    return jsonFetch(`${baseUrl}/api/internal/usage-events`, {
        method: 'POST',
        headers,
        body
    });
}

async function createRedeemedOrder(baseUrl, phone, apiKey = 'sk-balance-gated') {
    await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
        method: 'POST',
        headers: { 'x-admin-token': 'test-token' },
        body: JSON.stringify({ apiKeys: [apiKey] })
    });
    const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
        method: 'POST',
        headers: { 'x-admin-token': 'test-token' },
        body: JSON.stringify({ count: 1 })
    });
    const redeemResult = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
        method: 'POST',
        body: JSON.stringify({ phone, code: inviteResult.body.invites[0].code })
    });
    assert.equal(redeemResult.response.status, 201);
    return redeemResult.body.order;
}

async function submitAndApproveTopup(baseUrl, cookie, amount, adminToken = 'test-token') {
    const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({ amount, paymentMethod: 'alipay' })
    });
    assert.equal(created.response.status, 201);
    const approved = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/approve`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({ confirmedAmount: amount })
    });
    assert.equal(approved.response.status, 200);
    return approved.body;
}

async function withServer(run, appOptions = {}) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yui-shop-test-'));
    const dbPath = path.join(tempDir, 'shop.sqlite');
    const { app, db, usageImporter } = createShopApp({
        dbPath,
        adminToken: 'test-token',
        internalToken: 'internal-test-token',
        rootDir: path.join(__dirname, '..'),
        ...appOptions
    });
    const server = await new Promise((resolve, reject) => {
        const next = app.listen(0, '127.0.0.1', () => resolve(next));
        next.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        await run({ baseUrl, db, dbPath, usageImporter });
    } finally {
        usageImporter?.stop?.();
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

async function jsonFetch(url, options = {}) {
    const { skipCsrfForTest, ...requestOptions } = options;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (headers.cookie) {
        headers.cookie = cookieHeaderFromSetCookie(headers.cookie) || headers.cookie;
    }
    const method = String(options.method || 'GET').toUpperCase();
    if (method !== 'GET' && headers.cookie && !headers['x-csrf-token'] && !skipCsrfForTest) {
        const csrfToken = cookieValue(headers.cookie, 'yui_shop_csrf');
        if (csrfToken) {
            headers['x-csrf-token'] = decodeURIComponent(csrfToken);
            headers.origin = headers.origin || new URL(url).origin;
        }
    }
    const response = await fetch(url, {
        ...requestOptions,
        headers
    });
    const body = await response.json();
    return { response, body };
}

function rawHttpJsonRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const requestUrl = new URL(url);
        const requestBody = options.body || '';
        const request = http.request(requestUrl, {
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (response) => {
            let text = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                text += chunk;
            });
            response.on('end', () => {
                resolve({
                    response,
                    body: text ? JSON.parse(text) : {}
                });
            });
        });
        request.on('error', reject);
        if (requestBody) request.write(requestBody);
        request.end();
    });
}

function loadShopRequestJsonForTest(fetchImpl, cookie = '') {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');
    const instrumented = script.replace(
        '    window.YuiShop = {',
        '    window.__requestJsonForTest = requestJson;\n    window.YuiShop = {'
    );
    const sandbox = {
        document: { cookie },
        fetch: fetchImpl,
        window: { location: { replace() {} } },
        Intl,
        URL
    };
    sandbox.window.document = sandbox.document;
    vm.runInNewContext(instrumented, sandbox);
    return sandbox.window.__requestJsonForTest;
}

test('requestJson 保留自定义 headers 并自动添加 CSRF token', async () => {
    let captured;
    const requestJson = loadShopRequestJsonForTest(async (url, options) => {
        captured = { url, options };
        return {
            ok: true,
            json: async () => ({ ok: true })
        };
    }, 'yui_shop_csrf=csrf%20token');

    const data = await requestJson('/api/account/topups', {
        method: 'POST',
        headers: { 'x-extra': 'yes' },
        body: '{}'
    });

    assert.deepEqual(data, { ok: true });
    assert.equal(captured.url, '/api/account/topups');
    assert.equal(captured.options.headers['Content-Type'], 'application/json');
    assert.equal(captured.options.headers['x-extra'], 'yes');
    assert.equal(captured.options.headers['x-csrf-token'], 'csrf token');
});

test('Shop 外部脚本会在 CSP 禁止 inline script 时自动初始化 Account 页二维码', async () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');
    const elements = new Map();
    const createElement = () => ({
        innerHTML: '',
        textContent: '',
        src: '',
        value: '',
        classList: {
            add() {},
            remove() {},
            toggle() {}
        },
        addEventListener() {},
        querySelectorAll: () => [],
        querySelector: () => null,
        focus() {}
    });
    for (const id of [
        'accountPhone',
        'accountOrders',
        'accountMessage',
        'logoutButton',
        'accountBalanceCards',
        'accountTopups',
        'accountCharges',
        'accountLedger',
        'alipayQrImage',
        'wechatQrImage',
        'paymentReference',
        'accountUsageCards',
        'accountBillingUsageCards',
        'accountTokenBreakdown',
        'accountHourlyChart',
        'accountDailyChart',
        'usageFreshness',
        'accountUsageMessage'
    ]) {
        elements.set(id, createElement());
    }
    const requests = [];
    const responses = {
        '/api/account/me': { user: { phone: '13800139999' }, orders: [] },
        '/api/account/balance': {
            balance: {},
            payment: {
                alipayQrUrl: '/shop/assets/pay/alipay-qr.png',
                wechatQrUrl: '/shop/assets/pay/wechat-qr.png',
                paymentReference: 'YUI-TEST'
            }
        },
        '/api/account/topups': { topups: [] },
        '/api/account/api-charges': { charges: [] },
        '/api/account/ledger': { entries: [] },
        '/api/account/usage-summary': {
            generatedAt: '2026-06-11T10:00:00+08:00',
            summary: { month: {} },
            billing: {},
            hourly: [],
            daily: []
        }
    };
    const sandbox = {
        document: {
            cookie: '',
            readyState: 'complete',
            querySelectorAll: () => [],
            getElementById: (id) => elements.get(id) || null,
            addEventListener() {}
        },
        fetch: async (url) => {
            requests.push(url);
            return {
                ok: true,
                status: 200,
                json: async () => responses[url] || {}
            };
        },
        window: {
            location: {
                pathname: '/shop/account/',
                replace() {}
            }
        },
        Intl,
        URL
    };
    sandbox.window.document = sandbox.document;

    vm.runInNewContext(script, sandbox);
    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(requests.includes('/api/account/me'));
    assert.equal(elements.get('accountPhone').textContent, '13800139999');
    assert.equal(elements.get('alipayQrImage').src, '/shop/assets/pay/alipay-qr.png');
    assert.equal(elements.get('wechatQrImage').src, '/shop/assets/pay/wechat-qr.png');
    assert.equal(elements.get('paymentReference').textContent, 'YUI-TEST');
});

test('Account 页提供登录态邀请码兑换表单且不再引导到独立手机号兑换页', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');

    assert.match(html, /id="accountRedeemForm"/);
    assert.match(html, /id="accountInviteCodeInput"/);
    assert.match(html, /id="accountRedeemMessage"/);
    assert.doesNotMatch(html, /href="\/shop\/redeem\/"/);
});

test('Account 前端兑换调用登录态接口并且不提交手机号', async () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');
    const elements = new Map();
    const createElement = () => {
        const listeners = new Map();
        return {
            innerHTML: '',
            textContent: '',
            value: '',
            src: '',
            classList: {
                add() {},
                remove() {},
                toggle() {}
            },
            addEventListener(type, listener) {
                listeners.set(type, listener);
            },
            dispatchEvent(event) {
                listeners.get(event.type)?.({
                    preventDefault() {},
                    target: this
                });
            },
            querySelectorAll: () => [],
            querySelector: () => null,
            focus() {}
        };
    };
    for (const id of [
        'accountPhone',
        'accountOrders',
        'accountMessage',
        'logoutButton',
        'accountRedeemForm',
        'accountInviteCodeInput',
        'accountRedeemMessage',
        'accountBalanceCards',
        'accountTopups',
        'accountCharges',
        'accountLedger',
        'alipayQrImage',
        'wechatQrImage',
        'paymentReference',
        'accountUsageCards',
        'accountBillingUsageCards',
        'accountTokenBreakdown',
        'accountHourlyChart',
        'accountDailyChart',
        'usageFreshness',
        'accountUsageMessage'
    ]) {
        elements.set(id, createElement());
    }
    const calls = [];
    const responses = {
        '/api/account/me': { user: { phone: '13800138111' }, orders: [] },
        '/api/account/balance': { balance: {}, payment: {} },
        '/api/account/topups': { topups: [] },
        '/api/account/api-charges': { charges: [] },
        '/api/account/ledger': { entries: [] },
        '/api/account/usage-summary': { summary: {}, billing: {}, hourly: [], daily: [] },
        '/api/account/invites/redeem': { order: { id: 'ORDER1', apiKey: 'sk-test' } }
    };
    const sandbox = {
        document: {
            cookie: 'yui_shop_csrf=csrf-token; yui_shop_account_session=session-token',
            readyState: 'loading',
            querySelectorAll: () => [],
            getElementById: (id) => elements.get(id) || null,
            addEventListener() {}
        },
        fetch: async (url, options = {}) => {
            calls.push({ url, options });
            return {
                ok: true,
                status: 200,
                json: async () => responses[url] || {}
            };
        },
        window: {
            location: {
                pathname: '/shop/account/',
                href: '',
                reload() {}
            }
        },
        navigator: {
            clipboard: {
                writeText: async () => {}
            }
        },
        Intl,
        URL
    };
    sandbox.window.document = sandbox.document;

    vm.runInNewContext(script, sandbox);
    await sandbox.window.YuiShop.initAccountPage();
    elements.get('accountInviteCodeInput').value = 'yui-abc-def';
    elements.get('accountRedeemForm').dispatchEvent({ type: 'submit' });
    await new Promise((resolve) => setImmediate(resolve));

    const redeemCall = calls.find((call) => call.url === '/api/account/invites/redeem');
    assert.ok(redeemCall);
    assert.deepEqual(JSON.parse(redeemCall.options.body), { code: 'YUI-ABC-DEF' });
});

test('Shop 外部脚本会绑定 Account 和 Admin 页栏目折叠按钮', async () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    for (const pathname of ['/shop/account/', '/shop/admin/']) {
        const content = {
            hidden: false,
            setAttribute(name, value) { this[name] = value; },
            removeAttribute(name) { delete this[name]; }
        };
        const button = {
            textContent: '',
            attributes: {},
            events: {},
            setAttribute(name, value) { this.attributes[name] = value; },
            addEventListener(name, handler) { this.events[name] = handler; }
        };
        const section = {
            dataset: { collapsibleDefault: 'open' },
            querySelector(selector) {
                if (selector === '[data-collapsible-toggle]') return button;
                if (selector === '[data-collapsible-content]') return content;
                return null;
            }
        };
        const sandbox = {
            document: {
                readyState: 'complete',
                querySelectorAll(selector) {
                    return selector === '[data-collapsible-section]' ? [section] : [];
                },
                getElementById() { return null; },
                addEventListener() {}
            },
            window: {
                location: {
                    pathname,
                    replace() {}
                }
            },
            fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
            Intl,
            URL
        };
        sandbox.window.document = sandbox.document;

        vm.runInNewContext(script, sandbox);

        assert.equal(button.attributes['aria-expanded'], 'true', pathname);
        assert.equal(content.hidden, false, pathname);
        assert.equal(button.textContent, '收起', pathname);

        button.events.click();

        assert.equal(button.attributes['aria-expanded'], 'false', pathname);
        assert.equal(content.hidden, true, pathname);
        assert.equal(button.textContent, '展开', pathname);
    }
});

test('账号 cookie 状态变更拒绝跨站 Origin', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138701');
        const result = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            skipCsrfForTest: true,
            headers: {
                cookie,
                origin: 'https://evil.example'
            },
            body: JSON.stringify({ amount: '10', paymentMethod: 'alipay' })
        });

        assert.equal(result.response.status, 403);
        assert.equal(result.body.code, 'CSRF_ORIGIN_REJECTED');
    });
});

test('同 Host HTTPS Origin 在反代协议缺失时仍允许退出登录', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138705');
        const logout = await rawHttpJsonRequest(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
                Host: 'aaccx.pw',
                Origin: 'https://aaccx.pw',
                'x-csrf-token': decodeURIComponent(cookieValue(cookie, 'yui_shop_csrf'))
            }
        });

        assert.equal(logout.response.statusCode, 200);
        assert.match(String(logout.response.headers['set-cookie'] || ''), /yui_shop_account_session=;/);
    });
});

test('同源校验接受反代转发的公网 Host', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138706');
        const logout = await rawHttpJsonRequest(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
                Host: 'internal.local',
                'X-Forwarded-Host': 'aaccx.pw',
                Origin: 'https://aaccx.pw',
                'x-csrf-token': decodeURIComponent(cookieValue(cookie, 'yui_shop_csrf'))
            }
        });

        assert.equal(logout.response.statusCode, 200);
        assert.match(String(logout.response.headers['set-cookie'] || ''), /yui_shop_account_session=;/);
    }, { trustProxy: true });
});

test('未信任代理时拒绝伪造的 X-Forwarded-Host 来源', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138707');
        const result = await rawHttpJsonRequest(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
                Host: 'internal.local',
                'X-Forwarded-Host': 'aaccx.pw',
                Origin: 'https://aaccx.pw',
                'x-csrf-token': decodeURIComponent(cookieValue(cookie, 'yui_shop_csrf'))
            }
        });

        assert.equal(result.response.statusCode, 403);
        assert.equal(result.body.code, 'CSRF_ORIGIN_REJECTED');
    });
});

test('受限 trust proxy 不接受非可信远端伪造的 X-Forwarded-Host 来源', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138717');
        const result = await rawHttpJsonRequest(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
                Host: 'internal.local',
                'X-Forwarded-Host': 'aaccx.pw',
                Origin: 'https://aaccx.pw',
                'x-csrf-token': decodeURIComponent(cookieValue(cookie, 'yui_shop_csrf'))
            }
        });

        assert.equal(result.response.statusCode, 403);
        assert.equal(result.body.code, 'CSRF_ORIGIN_REJECTED');
    }, { trustProxy: '10.0.0.0/8' });
});

test('账号 cookie 状态变更要求 CSRF token', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138702');
        const result = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            skipCsrfForTest: true,
            headers: {
                cookie,
                origin: baseUrl
            },
            body: JSON.stringify({ amount: '10', paymentMethod: 'alipay' })
        });

        assert.equal(result.response.status, 403);
        assert.equal(result.body.code, 'CSRF_TOKEN_REQUIRED');
    });
});

test('登录失败按手机号维度限流', async () => {
    await withServer(async ({ baseUrl }) => {
        const body = { phone: '13800138703', password: 'Wrong111' };
        for (let index = 0; index < 2; index += 1) {
            const failed = await jsonFetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            assert.equal(failed.response.status, 401);
            assert.equal(failed.body.code, 'INVALID_CREDENTIALS');
        }

        const limited = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        assert.equal(limited.response.status, 429);
        assert.equal(limited.body.code, 'AUTH_PHONE_RATE_LIMITED');
    }, { authPhoneFailureLimit: 2 });
});

test('生产模式拒绝 change-me 默认 secret', () => {
    assert.throws(() => createShopApp({
        dbPath: ':memory:',
        nodeEnv: 'production',
        adminToken: 'change-me',
        internalToken: 'change-me-internal-token',
        usageEventHmacSecret: 'change-me-hmac-secret'
    }), /weak secret/i);
});

test('默认不信任伪造 X-Forwarded-For', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yui-shop-proxy-test-'));
    const dbPath = path.join(tempDir, 'shop.sqlite');
    const { app, db } = createShopApp({
        dbPath,
        rootDir: path.join(__dirname, '..'),
        adminToken: 'test-token',
        internalToken: 'internal-test-token',
        trustProxy: false
    });
    try {
        assert.equal(app.get('trust proxy'), false);
    } finally {
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('auth 请求体超过限制返回 413', async () => {
    await withServer(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '13800138695', password: 'A'.repeat(40000) })
        });

        assert.equal(response.status, 413);
        const body = await response.json();
        assert.equal(body.code, 'BODY_TOO_LARGE');
    }, { jsonBodyLimit: '16kb' });
});

test('HTTPS 响应包含安全响应头', async () => {
    await withServer(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/shop/`, {
            headers: { 'x-forwarded-proto': 'https' }
        });

        assert.equal(response.status, 200);
        const csp = response.headers.get('content-security-policy') || '';
        assert.match(csp, /default-src 'self'/);
        assert.match(csp, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
        assert.match(csp, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
        assert.equal(response.headers.get('x-frame-options'), 'DENY');
        assert.match(response.headers.get('permissions-policy') || '', /camera=\(\)/);
        assert.match(response.headers.get('strict-transport-security') || '', /max-age=/);
    }, { trustProxy: true });
});

test('账号接口默认只返回 API key preview，完整 key 需要 reveal', async () => {
    await withServer(async ({ baseUrl }) => {
        await createRedeemedOrder(baseUrl, '13800138704', 'sk-preview-only');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138704');

        const me = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie }
        });
        assert.equal(me.response.status, 200);
        assert.equal(me.body.orders.length, 1);
        assert.equal(me.body.orders[0].apiKey, undefined);
        assert.equal(me.body.orders[0].apiKeyPreview, keyPreviewForTest('sk-preview-only'));
        assert.equal(JSON.stringify(me.body).includes('sk-preview-only'), false);

        const reveal = await jsonFetch(`${baseUrl}/api/account/orders/${me.body.orders[0].id}/reveal-api-key`, {
            method: 'POST',
            headers: { cookie },
            body: '{}'
        });
        assert.equal(reveal.response.status, 200);
        assert.equal(reveal.body.apiKey, 'sk-preview-only');
    });
});

test('Reveal API key 响应不再声称服务端 60 秒过期', async () => {
    await withServer(async ({ baseUrl }) => {
        await createRedeemedOrder(baseUrl, '13800138261', 'sk-reveal-copy');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138261');

        const me = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie }
        });
        const revealed = await jsonFetch(`${baseUrl}/api/account/orders/${me.body.orders[0].id}/reveal-api-key`, {
            method: 'POST',
            headers: { cookie },
            body: '{}'
        });

        assert.equal(revealed.response.status, 200);
        assert.equal(revealed.body.apiKey, 'sk-reveal-copy');
        assert.equal(Object.hasOwn(revealed.body, 'expiresInSeconds'), false);
        assert.match(revealed.body.message, /本次响应/);
    });
});

test('用户用手机号和邀请码兑换后，从未使用 API key 池分配一个 key 并写入 SQLite 订单', async () => {
    await withServer(async ({ baseUrl, db, dbPath }) => {
        const seedKeys = await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-test-a', 'sk-test-b'] })
        });
        assert.equal(seedKeys.response.status, 201);

        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        assert.equal(inviteResult.response.status, 201);
        const invite = inviteResult.body.invites[0];
        assert.match(invite.code, /^YUI-[A-F0-9]{6}-[A-F0-9]{6}$/);
        assert.equal(invite.apiKey, undefined);

        const redeemResult = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138000', code: invite.code })
        });
        assert.equal(redeemResult.response.status, 201);
        assert.match(redeemResult.response.headers.get('set-cookie') || '', /yui_shop_result_token=/);
        assert.equal(redeemResult.body.order.phone, '13800138000');
        assert.equal(redeemResult.body.order.apiKey, 'sk-test-a');
        assert.equal(redeemResult.body.order.status, 'active');

        assert.ok(fs.existsSync(dbPath));
        assert.deepEqual(
            db.prepare('SELECT phone FROM users WHERE phone = ?').get('13800138000'),
            { phone: '13800138000' }
        );
        assert.deepEqual(
            db.prepare('SELECT status, redeemed_by_phone FROM invite_codes WHERE code = ?').get(invite.code),
            { status: 'redeemed', redeemed_by_phone: '13800138000' }
        );
        assert.deepEqual(
            db.prepare('SELECT api_key, status FROM api_keys WHERE api_key = ?').get('sk-test-a'),
            { api_key: 'sk-test-a', status: 'used' }
        );
        const dbOrder = db.prepare('SELECT phone, invite_code, api_key, expires_at, result_token FROM orders WHERE phone = ?').get('13800138000');
        assert.equal(dbOrder.phone, '13800138000');
        assert.equal(dbOrder.invite_code, invite.code);
        assert.equal(dbOrder.api_key, 'sk-test-a');
        assert.match(dbOrder.result_token, /^rst_[A-Za-z0-9_-]{43}$/);
        assert.equal(
            Math.round((new Date(dbOrder.expires_at) - new Date(redeemResult.body.order.redeemedAt)) / 86400000),
            31
        );

        const publicQuery = await jsonFetch(`${baseUrl}/api/orders?phone=13800138000`);
        assert.equal(publicQuery.response.status, 401);
        assert.equal(publicQuery.body.code, 'ACCOUNT_LOGIN_REQUIRED');
    });
});

test('登录态邀请码兑换只绑定当前 session 手机号，忽略请求体手机号', async () => {
    await withServer(async ({ baseUrl, db }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-session-redeem'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138111');

        const redeemResult = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ phone: '13800138999', code: inviteResult.body.invites[0].code })
        });

        assert.equal(redeemResult.response.status, 201);
        assert.equal(redeemResult.body.order.phone, '13800138111');
        assert.equal(redeemResult.body.order.apiKey, 'sk-session-redeem');
        assert.deepEqual(
            db.prepare('SELECT phone, invite_code FROM orders WHERE api_key = ?').get('sk-session-redeem'),
            { phone: '13800138111', invite_code: inviteResult.body.invites[0].code }
        );
    });
});

test('登录态邀请码兑换要求账号 session、同源和 CSRF', async () => {
    await withServer(async ({ baseUrl }) => {
        const missingSession = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ code: 'YUI-NOPE-NOPE' })
        });
        assert.equal(missingSession.response.status, 401);
        assert.equal(missingSession.body.code, 'ACCOUNT_LOGIN_REQUIRED');

        const cookie = await registerUserAndGetCookie(baseUrl, '13800138112');
        const missingCsrf = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
            method: 'POST',
            headers: { cookie, origin: baseUrl },
            skipCsrfForTest: true,
            body: JSON.stringify({ code: 'YUI-NOPE-NOPE' })
        });
        assert.equal(missingCsrf.response.status, 403);
        assert.equal(missingCsrf.body.code, 'CSRF_TOKEN_REQUIRED');
    });
});

test('Shop 数据库包含 API key hash 和 usage_events 账本表', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const seedKeys = await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-hash-schema'] })
        });
        assert.equal(seedKeys.response.status, 201);

        const apiKeyColumns = db.prepare('PRAGMA table_info(api_keys)').all().map((column) => column.name);
        assert.ok(apiKeyColumns.includes('api_key_hash'));

        const usageEvents = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'usage_events'").get();
        assert.deepEqual(usageEvents, { name: 'usage_events' });

        const row = db.prepare('SELECT api_key_hash FROM api_keys WHERE api_key = ?').get('sk-hash-schema');
        assert.equal(row.api_key_hash, hashApiKeyForTest('sk-hash-schema'));
    });
});

test('配置 API key 加密 secret 后，新导入 key 写入密文且 reveal 可解密', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const imported = await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-encrypted-runtime'] })
        });
        assert.equal(imported.response.status, 201);

        const stored = db.prepare('SELECT api_key, api_key_ciphertext, api_key_nonce, api_key_hash FROM api_keys WHERE api_key_hash = ?').get(hashApiKeyForTest('sk-encrypted-runtime'));
        assert.equal(stored.api_key_hash, hashApiKeyForTest('sk-encrypted-runtime'));
        assert.notEqual(stored.api_key, 'sk-encrypted-runtime');
        assert.ok(stored.api_key_ciphertext);
        assert.ok(stored.api_key_nonce);

        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138231');
        const redeemed = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ code: inviteResult.body.invites[0].code })
        });
        assert.equal(redeemed.response.status, 201);
        assert.equal(redeemed.body.order.apiKey, 'sk-encrypted-runtime');

        const order = db.prepare('SELECT api_key, api_key_ciphertext, api_key_nonce FROM orders WHERE id = ?').get(redeemed.body.order.id);
        assert.notEqual(order.api_key, 'sk-encrypted-runtime');
        assert.ok(order.api_key_ciphertext);
        assert.ok(order.api_key_nonce);

        const revealed = await jsonFetch(`${baseUrl}/api/account/orders/${redeemed.body.order.id}/reveal-api-key`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({})
        });
        assert.equal(revealed.body.apiKey, 'sk-encrypted-runtime');
    }, {
        apiKeyEncryptionSecret: '0123456789abcdef0123456789abcdef'
    });
});

test('Shop 数据库包含 DeepSeek 人民币 nanos 扣费字段', async () => {
    await withServer(async ({ db }) => {
        const usageColumns = tableColumns(db, 'usage_events');
        assert.ok(usageColumns.includes('cache_hit_input_tokens'));
        assert.ok(usageColumns.includes('cache_miss_input_tokens'));

        const balanceColumns = tableColumns(db, 'account_balances');
        assert.ok(balanceColumns.includes('balance_nanos'));
        assert.ok(balanceColumns.includes('pending_topup_nanos'));
        assert.ok(balanceColumns.includes('credit_limit_nanos'));

        const ledgerColumns = tableColumns(db, 'account_ledger_entries');
        assert.ok(ledgerColumns.includes('amount_nanos'));
        assert.ok(ledgerColumns.includes('balance_after_nanos'));

        const chargeColumns = tableColumns(db, 'api_charge_records');
        assert.ok(chargeColumns.includes('cache_hit_input_tokens'));
        assert.ok(chargeColumns.includes('cache_miss_input_tokens'));
        assert.ok(chargeColumns.includes('reasoning_tokens'));
        assert.ok(chargeColumns.includes('charge_nanos'));
        assert.ok(chargeColumns.includes('balance_before_nanos'));
        assert.ok(chargeColumns.includes('balance_after_nanos'));
    });
});

test('Shop 数据库包含预充值余额、充值申请、账户流水和扣费记录表', async () => {
    await withServer(async ({ db }) => {
        const tableNames = db.prepare(`
SELECT name FROM sqlite_master
WHERE type = 'table'
  AND name IN ('account_balances', 'topup_requests', 'account_ledger_entries', 'api_charge_records')
ORDER BY name
`).all().map((row) => row.name);

        assert.deepEqual(tableNames, [
            'account_balances',
            'account_ledger_entries',
            'api_charge_records',
            'topup_requests'
        ]);

        const balanceColumns = db.prepare('PRAGMA table_info(account_balances)').all().map((column) => column.name);
        assert.ok(balanceColumns.includes('phone'));
        assert.ok(balanceColumns.includes('balance_cents'));
        assert.ok(balanceColumns.includes('pending_topup_cents'));
        assert.ok(balanceColumns.includes('credit_limit_cents'));
    });
});

test('新注册用户账户余额默认为 0 且默认欠费上限为 10 元', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139001');

        const result = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.balance.balanceCents, 0);
        assert.equal(result.body.balance.pendingTopupCents, 0);
        assert.equal(result.body.balance.debtCents, 0);
        assert.equal(result.body.balance.creditLimitCents, 1000);
        assert.equal(result.body.balance.status, 'empty');
    });
});

test('用户提交充值申请后进入待确认且不会增加可用余额', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139002');

        const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({
                amount: '30',
                paymentMethod: 'alipay',
                paymentTime: '2026-06-10T13:00',
                paymentNote: 'YUI-202606-138****9002'
            })
        });

        assert.equal(created.response.status, 201);
        assert.equal(created.body.topup.status, 'pending');
        assert.equal(created.body.topup.requestedAmountCents, 3000);
        assert.equal(created.body.topup.requestedAmount, 30);

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 0);
        assert.equal(balance.body.balance.pendingTopupCents, 3000);

        const row = db.prepare('SELECT status, requested_amount_cents FROM topup_requests WHERE phone = ?').get('13800139002');
        assert.deepEqual(row, { status: 'pending', requested_amount_cents: 3000 });
    });
});

test('用户只能查看自己的充值申请', async () => {
    await withServer(async ({ baseUrl }) => {
        const firstCookie = await registerUserAndGetCookie(baseUrl, '13800139003');
        const secondCookie = await registerUserAndGetCookie(baseUrl, '13800139004');

        await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie: firstCookie },
            body: JSON.stringify({ amount: '10.50', paymentMethod: 'wechat', paymentNote: 'first user' })
        });

        const firstList = await jsonFetch(`${baseUrl}/api/account/topups`, {
            headers: { cookie: firstCookie }
        });
        assert.equal(firstList.response.status, 200);
        assert.equal(firstList.body.topups.length, 1);
        assert.equal(firstList.body.topups[0].requestedAmountCents, 1050);

        const secondList = await jsonFetch(`${baseUrl}/api/account/topups`, {
            headers: { cookie: secondCookie }
        });
        assert.equal(secondList.response.status, 200);
        assert.equal(secondList.body.topups.length, 0);
    });
});

test('充值申请校验金额和支付方式', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139005');

        const badAmount = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '0', paymentMethod: 'alipay' })
        });
        assert.equal(badAmount.response.status, 400);
        assert.equal(badAmount.body.code, 'INVALID_AMOUNT');

        const badMethod = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '1', paymentMethod: 'bank' })
        });
        assert.equal(badMethod.response.status, 400);
        assert.equal(badMethod.body.code, 'INVALID_PAYMENT_METHOD');
    });
});

test('管理员确认充值后增加余额并写入账户流水', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139006');
        const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '30', paymentMethod: 'alipay', paymentNote: 'paid 30' })
        });

        const approved = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/approve`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ confirmedAmount: '30', adminNote: '到账' })
        });

        assert.equal(approved.response.status, 200);
        assert.equal(approved.body.topup.status, 'approved');
        assert.equal(approved.body.balance.balanceCents, 3000);
        assert.equal(approved.body.balance.pendingTopupCents, 0);

        const ledger = db.prepare(`
SELECT entry_type, amount_cents, balance_after_cents, related_id
FROM account_ledger_entries
WHERE phone = ?
`).get('13800139006');
        assert.deepEqual(ledger, {
            entry_type: 'topup_approved',
            amount_cents: 3000,
            balance_after_cents: 3000,
            related_id: created.body.topup.id
        });

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 3000);
    });
});

test('管理员确认金额以管理员填写为准且不能重复入账', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139007');
        const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '30', paymentMethod: 'wechat' })
        });

        const approved = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/approve`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ confirmedAmount: '20', adminNote: '实际到账 20' })
        });
        assert.equal(approved.response.status, 200);
        assert.equal(approved.body.balance.balanceCents, 2000);

        const duplicate = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/approve`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ confirmedAmount: '20' })
        });
        assert.equal(duplicate.response.status, 409);
        assert.equal(duplicate.body.code, 'TOPUP_NOT_PENDING');

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 2000);
    });
});

test('管理员拒绝充值不会改变余额', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139008');
        const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '50', paymentMethod: 'alipay' })
        });

        const rejected = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/reject`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ adminNote: '未到账' })
        });

        assert.equal(rejected.response.status, 200);
        assert.equal(rejected.body.topup.status, 'rejected');
        assert.equal(rejected.body.balance.balanceCents, 0);
        assert.equal(rejected.body.balance.pendingTopupCents, 0);
    });
});

test('托管 API key 在账户余额为 0 时返回余额不足状态', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139009', 'sk-balance-zero');

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent(order.apiKey)}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });

        assert.equal(status.response.status, 200);
        assert.equal(status.body.managed, true);
        assert.equal(status.body.active, false);
        assert.equal(status.body.status, 'insufficient_balance');
        assert.equal(status.body.billing.balanceCents, 0);
        assert.equal(status.body.billing.debtCents, 0);
    });
});

test('托管 API key 充值确认后恢复可用', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139010', 'sk-balance-positive');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139010');
        await submitAndApproveTopup(baseUrl, cookie, '5');

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent(order.apiKey)}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });

        assert.equal(status.response.status, 200);
        assert.equal(status.body.managed, true);
        assert.equal(status.body.active, true);
        assert.equal(status.body.status, 'active');
        assert.equal(status.body.billing.balanceCents, 500);
    });
});

test('usage event 写入后按 DeepSeek Pro 人民币 nanos 扣余额并生成用户可见扣费记录', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139011', 'sk-charge-positive');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139011');
        await submitAndApproveTopup(baseUrl, cookie, '1');

        const event = {
            version: 1,
            request_id: 'req-charge-001',
            api_key_hash: hashApiKeyForTest(order.apiKey),
            api_key_preview: keyPreviewForTest(order.apiKey),
            provider: 'deepseek',
            model: 'deepseek-v4-pro',
            endpoint: '/v1/chat/completions',
            success: true,
            failed: false,
            input_tokens: 1222504,
            output_tokens: 12287,
            reasoning_tokens: 3544,
            cached_tokens: 1056256,
            cache_hit_input_tokens: 1056256,
            cache_miss_input_tokens: 166248,
            total_tokens: 1234791,
            price_amount_micros: 1,
            price_currency: 'USD',
            requested_at: '2026-06-10T12:00:00+08:00'
        };

        const inserted = await usageEventFetch(baseUrl, event);
        assert.equal(inserted.response.status, 201);

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceNanos, 401127600);
        assert.equal(balance.body.balance.balanceAmount, 0.4011276);

        const charge = db.prepare(`
SELECT phone, usage_event_id, cache_hit_input_tokens, cache_miss_input_tokens, output_tokens,
       reasoning_tokens, charge_nanos, balance_before_nanos, balance_after_nanos, price_version,
       charge_cents, balance_before_cents, balance_after_cents, status
FROM api_charge_records
WHERE usage_event_id = ?
`).get('req-charge-001');
        assert.deepEqual(charge, {
            phone: '13800139011',
            usage_event_id: 'req-charge-001',
            cache_hit_input_tokens: 1056256,
            cache_miss_input_tokens: 166248,
            output_tokens: 12287,
            reasoning_tokens: 3544,
            charge_nanos: 598872400,
            balance_before_nanos: 1000000000,
            balance_after_nanos: 401127600,
            price_version: 'deepseek-v4-pro-rmb-20260424',
            charge_cents: 60,
            balance_before_cents: 100,
            balance_after_cents: 40,
            status: 'charged'
        });

        const ledger = db.prepare(`
SELECT entry_type, amount_cents, amount_nanos, balance_after_cents, balance_after_nanos, related_id
FROM account_ledger_entries
WHERE related_id = ?
`).get('req-charge-001');
        assert.deepEqual(ledger, {
            entry_type: 'api_charge',
            amount_cents: -60,
            amount_nanos: -598872400,
            balance_after_cents: 40,
            balance_after_nanos: 401127600,
            related_id: 'req-charge-001'
        });
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('旧 usage event 只有 cached_tokens 时可推导未命中输入并按 nanos 扣费', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139015', 'sk-charge-legacy-cache');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139015');
        await submitAndApproveTopup(baseUrl, cookie, '1');

        const inserted = await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-charge-legacy-cache',
            api_key_hash: hashApiKeyForTest(order.apiKey),
            api_key_preview: keyPreviewForTest(order.apiKey),
            provider: 'codex',
            model: 'gpt-5.5',
            success: true,
            failed: false,
            input_tokens: 1000,
            cached_tokens: 700,
            output_tokens: 50,
            reasoning_tokens: 20,
            total_tokens: 1050,
            requested_at: '2026-06-10T12:10:00+08:00'
        });
        assert.equal(inserted.response.status, 201);

        const charge = db.prepare(`
SELECT cache_hit_input_tokens, cache_miss_input_tokens, output_tokens, reasoning_tokens, charge_nanos
FROM api_charge_records
WHERE usage_event_id = ?
`).get('req-charge-legacy-cache');
        assert.deepEqual(charge, {
            cache_hit_input_tokens: 700,
            cache_miss_input_tokens: 300,
            output_tokens: 50,
            reasoning_tokens: 20,
            charge_nanos: 1217500
        });

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceNanos, 998782500);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('余额很少时本次调用可扣成负数且下一次状态检查拒绝', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139012', 'sk-charge-negative');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139012');
        await submitAndApproveTopup(baseUrl, cookie, '0.05');

        const inserted = await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-charge-negative',
            api_key_hash: hashApiKeyForTest(order.apiKey),
            api_key_preview: keyPreviewForTest(order.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            endpoint: '/v1/responses',
            success: true,
            failed: false,
            input_tokens: 0,
            output_tokens: 33333,
            total_tokens: 33333,
            requested_at: '2026-06-10T12:05:00+08:00'
        });
        assert.equal(inserted.response.status, 201);

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, -15);
        assert.equal(balance.body.balance.balanceNanos, -149998000);
        assert.equal(balance.body.balance.debtCents, 15);
        assert.equal(balance.body.balance.status, 'debt');

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent(order.apiKey)}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(status.body.active, false);
        assert.equal(status.body.status, 'insufficient_balance');
        assert.equal(status.body.billing.debtCents, 15);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('重复 usage event 不会重复扣费', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139013', 'sk-charge-idempotent');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139013');
        await submitAndApproveTopup(baseUrl, cookie, '1');

        const event = {
            version: 1,
            request_id: 'req-charge-idempotent',
            api_key_hash: hashApiKeyForTest(order.apiKey),
            api_key_preview: keyPreviewForTest(order.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            endpoint: '/v1/responses',
            success: true,
            failed: false,
            input_tokens: 1,
            output_tokens: 1,
            total_tokens: 2,
            price_amount_micros: 100000,
            price_currency: 'CNY',
            requested_at: '2026-06-10T12:10:00+08:00'
        };

        const first = await usageEventFetch(baseUrl, event);
        assert.equal(first.response.status, 201);
        const duplicate = await usageEventFetch(baseUrl, event);
        assert.equal(duplicate.response.status, 200);

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 99);
        assert.equal(balance.body.balance.balanceNanos, 999991000);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('失败 usage event 会保留审计记录但不会扣费', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139016', 'sk-charge-rollback');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139016');
        await submitAndApproveTopup(baseUrl, cookie, '1');

        const rejected = await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-charge-rollback',
            api_key_hash: hashApiKeyForTest(order.apiKey),
            api_key_preview: keyPreviewForTest(order.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            endpoint: '/v1/responses',
            success: false,
            failed: true,
            input_tokens: 1,
            output_tokens: 1,
            total_tokens: 2,
            requested_at: '2026-06-10T12:12:00+08:00'
        });

        assert.equal(rejected.response.status, 201);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM usage_events WHERE request_id = ?').get('req-charge-rollback').count, 1);
        assert.deepEqual(
            db.prepare(`
SELECT charge_cents, charge_nanos, status
FROM api_charge_records
WHERE usage_event_id = ?
`).get('req-charge-rollback'),
            { charge_cents: 0, charge_nanos: 0, status: 'failed_no_charge' }
        );
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM account_ledger_entries WHERE related_id = ?').get('req-charge-rollback').count, 0);

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 100);
        assert.equal(balance.body.balance.balanceNanos, 1000000000);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('用户账户页 API 返回自己的账户流水和扣费记录', async () => {
    await withServer(async ({ baseUrl }) => {
        const firstOrder = await createRedeemedOrder(baseUrl, '13800139014', 'sk-ledger-first');
        await createRedeemedOrder(baseUrl, '13800139015', 'sk-ledger-second');
        const firstCookie = await registerUserAndGetCookie(baseUrl, '13800139014');
        const secondCookie = await registerUserAndGetCookie(baseUrl, '13800139015');
        await submitAndApproveTopup(baseUrl, firstCookie, '1');

        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-ledger-first',
            api_key_hash: hashApiKeyForTest(firstOrder.apiKey),
            api_key_preview: keyPreviewForTest(firstOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            endpoint: '/v1/responses',
            success: true,
            failed: false,
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
            price_amount_micros: 100000,
            price_currency: 'CNY',
            requested_at: '2026-06-10T12:15:00+08:00'
        });

        const ledger = await jsonFetch(`${baseUrl}/api/account/ledger`, {
            headers: { cookie: firstCookie }
        });
        assert.equal(ledger.response.status, 200);
        assert.equal(ledger.body.entries.length, 2);
        assert.deepEqual(ledger.body.entries.map((entry) => entry.entryType), ['api_charge', 'topup_approved']);

        const charges = await jsonFetch(`${baseUrl}/api/account/api-charges`, {
            headers: { cookie: firstCookie }
        });
        assert.equal(charges.response.status, 200);
        assert.equal(charges.body.charges.length, 1);
        assert.equal(charges.body.charges[0].usageEventId, 'req-ledger-first');
        assert.equal(charges.body.charges[0].chargeCents, 1);
        assert.equal(charges.body.charges[0].chargeNanos, 150000);

        const secondLedger = await jsonFetch(`${baseUrl}/api/account/ledger`, {
            headers: { cookie: secondCookie }
        });
        assert.equal(secondLedger.body.entries.length, 0);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('内部 usage event 接口校验 token、HMAC、timestamp 并幂等写入', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const event = {
            version: 1,
            request_id: 'req-usage-internal',
            api_key_hash: hashApiKeyForTest('sk-usage-internal'),
            api_key_preview: 'sk-u...rnal',
            provider: 'codex',
            model: 'gpt-5.4',
            endpoint: '/v1/responses',
            source: 'account@example.com',
            auth_index: '0',
            success: true,
            failed: false,
            input_tokens: 10,
            output_tokens: 20,
            reasoning_tokens: 3,
            cached_tokens: 4,
            total_tokens: 33,
            latency_ms: 1200,
            requested_at: '2026-06-09T12:00:00Z'
        };

        const missingToken = await usageEventFetch(baseUrl, event, { includeToken: false });
        assert.equal(missingToken.response.status, 401);

        const missingSignature = await usageEventFetch(baseUrl, event, { includeSignature: false });
        assert.equal(missingSignature.response.status, 401);

        const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
        const expired = await usageEventFetch(baseUrl, event, { timestamp: oldTimestamp });
        assert.equal(expired.response.status, 401);

        const badSignature = await usageEventFetch(baseUrl, event, { signature: 'bad-signature' });
        assert.equal(badSignature.response.status, 401);

        const inserted = await usageEventFetch(baseUrl, event);
        assert.equal(inserted.response.status, 201);
        assert.deepEqual(inserted.body, { inserted: 1, skipped: 0 });

        const duplicate = await usageEventFetch(baseUrl, event);
        assert.equal(duplicate.response.status, 200);
        assert.deepEqual(duplicate.body, { inserted: 0, skipped: 1 });

        const row = db.prepare('SELECT request_id, api_key_hash, total_tokens, failed FROM usage_events WHERE request_id = ?').get(event.request_id);
        assert.deepEqual(row, {
            request_id: 'req-usage-internal',
            api_key_hash: event.api_key_hash,
            total_tokens: 33,
            failed: 0
        });
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('管理员 usage summary 返回 Shop 和未托管 key 的聚合用量', async () => {
    await withServer(async ({ baseUrl }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-summary-shop'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138500', code: inviteResult.body.invites[0].code })
        });

        const requestedAt = new Date().toISOString();
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-shop',
            api_key_hash: hashApiKeyForTest('sk-summary-shop'),
            api_key_preview: 'sk-s...shop',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 5,
            output_tokens: 10,
            total_tokens: 15,
            requested_at: requestedAt
        });
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-unmanaged',
            api_key_hash: hashApiKeyForTest('sk-LOCAL-summary'),
            api_key_preview: 'sk-L...mary',
            provider: 'codex',
            model: 'gpt-5.4',
            success: false,
            failed: true,
            total_tokens: 7,
            requested_at: requestedAt
        });

        const missingToken = await jsonFetch(`${baseUrl}/api/admin/usage-summary`);
        assert.equal(missingToken.response.status, 401);

        const result = await jsonFetch(`${baseUrl}/api/admin/usage-summary`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        assert.equal(result.response.status, 200);
        assert.equal(result.body.summary.total_tokens, 22);
        assert.equal(result.body.summary.month_tokens, 22);
        assert.equal(result.body.summary.failed_requests, 1);
        assert.equal(result.body.billing.monthChargeNanos, 75000);
        assert.equal(result.body.billing.todayChargeNanos, 75000);
        assert.equal(result.body.billing.cacheHitInputTokens, 0);
        assert.equal(result.body.billing.cacheMissInputTokens, 5);
        assert.equal(result.body.billing.outputTokens, 10);
        assert.equal(result.body.billing.recentCharges.length, 1);
        assert.equal(result.body.billing.recentCharges[0].usageEventId, 'req-summary-shop');

        const shopItem = result.body.items.find((item) => item.group === 'shop' && item.phone === '13800138500');
        assert.ok(shopItem);
        assert.equal(shopItem.api_key_preview, 'sk-summary-s...y-shop');
        assert.equal(shopItem.status, 'active');
        assert.equal(shopItem.total_tokens, 15);
        assert.equal(shopItem.success_requests, 1);
        assert.equal(shopItem.failed_requests, 0);
        assert.equal(shopItem.models[0].model, 'gpt-5.4');
        assert.equal(shopItem.models[0].total_tokens, 15);

        const unmanaged = result.body.items.find((item) => item.group === 'unmanaged');
        assert.ok(unmanaged);
        assert.equal(unmanaged.phone, '');
        assert.equal(unmanaged.api_key_preview, 'sk-L...mary');
        assert.equal(unmanaged.total_tokens, 7);
        assert.equal(unmanaged.failed_requests, 1);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('管理员可以把未托管 usage key 绑定为 local 分组和手机号', async () => {
    await withServer(async ({ baseUrl }) => {
        const requestedAt = new Date().toISOString();
        const apiKeyHash = hashApiKeyForTest('sk-LOCAL-profile');
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-local-profile',
            api_key_hash: apiKeyHash,
            api_key_preview: 'sk-L...file',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            total_tokens: 42,
            requested_at: requestedAt
        });

        const profileResponse = await fetch(`${baseUrl}/api/admin/usage-key-profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': 'test-token'
            },
            body: JSON.stringify({
                apiKeyHash,
                apiKeyPreview: 'sk-L...file',
                group: 'local',
                phone: '15951875192'
            })
        });
        const profileBody = await profileResponse.json().catch(() => ({}));
        assert.equal(profileResponse.status, 201);
        assert.deepEqual(profileBody.profile, {
            apiKeyHash,
            apiKeyPreview: 'sk-L...file',
            group: 'local',
            phone: '15951875192'
        });

        const result = await jsonFetch(`${baseUrl}/api/admin/usage-summary?group=local`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        assert.equal(result.response.status, 200);
        assert.equal(result.body.items.length, 1);
        assert.equal(result.body.items[0].group, 'local');
        assert.equal(result.body.items[0].phone, '15951875192');
        assert.equal(result.body.items[0].api_key_preview, 'sk-L...file');
        assert.equal(result.body.items[0].status, 'local');
        assert.equal(result.body.items[0].total_tokens, 42);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('管理员可以从 CLIProxyAPI 月度 JSONL 手动导入 usage events', async () => {
    const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cliproxy-usage-log-'));
    try {
        const month = '2026-06';
        const event = {
            version: 1,
            request_id: 'req-import-jsonl',
            api_key_hash: hashApiKeyForTest('sk-import-jsonl'),
            api_key_preview: 'sk-i...jsonl',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 2,
            output_tokens: 3,
            total_tokens: 5,
            requested_at: '2026-06-09T12:00:00Z'
        };
        fs.writeFileSync(
            path.join(logDir, 'usage-events-2026-06.jsonl'),
            `${JSON.stringify(event)}\n{bad json\n`
        );

        await withServer(async ({ baseUrl, db }) => {
            const invalidMonth = await jsonFetch(`${baseUrl}/api/admin/usage-imports`, {
                method: 'POST',
                headers: { 'x-admin-token': 'test-token' },
                body: JSON.stringify({ month: '../2026-06' })
            });
            assert.equal(invalidMonth.response.status, 400);

            const first = await jsonFetch(`${baseUrl}/api/admin/usage-imports`, {
                method: 'POST',
                headers: { 'x-admin-token': 'test-token' },
                body: JSON.stringify({ month })
            });
            assert.equal(first.response.status, 200);
            assert.deepEqual(first.body, { month, inserted: 1, skipped: 0, failed_lines: 1 });

            const second = await jsonFetch(`${baseUrl}/api/admin/usage-imports`, {
                method: 'POST',
                headers: { 'x-admin-token': 'test-token' },
                body: JSON.stringify({ month })
            });
            assert.equal(second.response.status, 200);
            assert.deepEqual(second.body, { month, inserted: 0, skipped: 1, failed_lines: 1 });

            const row = db.prepare('SELECT request_id, total_tokens FROM usage_events WHERE request_id = ?').get(event.request_id);
            assert.deepEqual(row, { request_id: event.request_id, total_tokens: 5 });
        }, { cliproxyUsageLogDir: logDir });
    } finally {
        fs.rmSync(logDir, { recursive: true, force: true });
    }
});

test('usage 自动导入可手动触发一次并保持幂等状态', async () => {
    const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cliproxy-auto-usage-log-'));
    try {
        fs.writeFileSync(path.join(logDir, 'usage-events-2026-06.jsonl'), `${JSON.stringify({
            request_id: 'req-auto-import',
            api_key_hash: hashApiKeyForTest('sk-auto-import'),
            api_key_preview: keyPreviewForTest('sk-auto-import'),
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 10,
            cached_tokens: 4,
            output_tokens: 2,
            total_tokens: 12,
            requested_at: '2026-06-11T10:00:00Z'
        })}\n`);

        await withServer(async ({ baseUrl, db, usageImporter }) => {
            assert.ok(usageImporter);
            const first = usageImporter.runOnce('2026-06');
            assert.equal(first.inserted, 1);
            const second = usageImporter.runOnce('2026-06');
            assert.equal(second.skipped, 1);

            const status = await jsonFetch(`${baseUrl}/api/admin/usage-import-status`, {
                headers: { 'x-admin-token': 'test-token' }
            });
            assert.equal(status.response.status, 200);
            assert.equal(status.body.enabled, true);
            assert.equal(status.body.lastMonth, '2026-06');
            assert.equal(status.body.lastInserted, 0);
            assert.equal(status.body.lastSkipped, 1);

            assert.equal(db.prepare('SELECT COUNT(*) AS count FROM usage_events WHERE request_id = ?').get('req-auto-import').count, 1);
        }, {
            cliproxyUsageLogDir: logDir,
            usageAutoImportEnabled: true,
            usageAutoImportStartTimer: false
        });
    } finally {
        fs.rmSync(logDir, { recursive: true, force: true });
    }
});

test('新兑换订单的兑换时间和到期时间使用中国东八区格式存储', async () => {
    await withServer(async ({ baseUrl, db }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-china-time'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });

        const redeemResult = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138400', code: inviteResult.body.invites[0].code })
        });

        assert.equal(redeemResult.response.status, 201);
        assert.match(redeemResult.body.order.redeemedAt, /\+08:00$/);
        assert.match(redeemResult.body.order.expiresAt, /\+08:00$/);

        const dbOrder = db.prepare('SELECT redeemed_at, expires_at FROM orders WHERE phone = ?').get('13800138400');
        assert.match(dbOrder.redeemed_at, /\+08:00$/);
        assert.match(dbOrder.expires_at, /\+08:00$/);
        assert.equal(
            Math.round((new Date(dbOrder.expires_at) - new Date(dbOrder.redeemed_at)) / 86400000),
            31
        );
    });
});

test('API key 结果页需要账户登录才能访问', async () => {
    await withServer(async ({ baseUrl }) => {
        const blocked = await fetch(`${baseUrl}/shop/key/`, { redirect: 'manual' });
        assert.equal(blocked.status, 302);
        assert.equal(blocked.headers.get('location'), '/shop/login/');

        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-page-token'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        const redeemResult = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138004', code: inviteResult.body.invites[0].code })
        });
        assert.match(redeemResult.response.headers.get('set-cookie') || '', /yui_shop_result_token=/);

        const cookie = await registerUserAndGetCookie(baseUrl, '13800138004');

        const allowed = await fetch(`${baseUrl}/shop/key/`, {
            headers: { cookie }
        });
        assert.equal(allowed.status, 200);
        assert.match(await allowed.text(), /API key 已激活/);
    });
});

test('公网静态服务不能下载 SQLite 数据库或 AI 上下文', async () => {
    await withServer(async ({ baseUrl }) => {
        const dbDownload = await fetch(`${baseUrl}/data/shop.sqlite`);
        assert.equal(dbDownload.status, 404);

        const contextDownload = await fetch(`${baseUrl}/docs/ai/context/20260531-082335-shop-result-token-session-design.md`);
        assert.equal(contextDownload.status, 404);
    });
});

test('管理员 token 只能通过请求头提交，不能放在 URL 查询参数里', async () => {
    await withServer(async ({ baseUrl }) => {
        const queryToken = await jsonFetch(`${baseUrl}/api/admin/invites?adminToken=test-token`);
        assert.equal(queryToken.response.status, 401);

        const headerToken = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        assert.equal(headerToken.response.status, 200);
    });
});

test('旧邀请码和 API key 管理接口仍只接受后端管理员 token', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        const adminCookie = adminLogin.response.headers.get('set-cookie') || '';

        const sessionInvite = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ count: 1 })
        });
        assert.equal(sessionInvite.response.status, 401);
        assert.equal(sessionInvite.body.code, 'UNAUTHORIZED');

        const tokenInvite = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        assert.equal(tokenInvite.response.status, 201);

        const sessionApiKeyImport = await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ apiKeys: ['sk-session-import-blocked'] })
        });
        assert.equal(sessionApiKeyImport.response.status, 401);
        assert.equal(sessionApiKeyImport.body.code, 'UNAUTHORIZED');
    });
});

test('管理员 session 可访问 invite console、生成邀请码和导入 API key 池', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        const adminCookie = adminLogin.response.headers.get('set-cookie') || '';

        const createdInvites = await jsonFetch(`${baseUrl}/api/admin/session-invites`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ count: 2 })
        });
        assert.equal(createdInvites.response.status, 201);
        assert.equal(createdInvites.body.invites.length, 2);

        const importedKeys = await jsonFetch(`${baseUrl}/api/admin/session-api-keys`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ apiKeysText: 'sk-admin-session-a\nsk-admin-session-b' })
        });
        assert.equal(importedKeys.response.status, 201);
        assert.deepEqual(importedKeys.body.apiKeys.map((item) => item.apiKeyPreview), [
            keyPreviewForTest('sk-admin-session-a'),
            keyPreviewForTest('sk-admin-session-b')
        ]);
        assert.doesNotMatch(JSON.stringify(importedKeys.body), /sk-admin-session-a/);

        const consoleResult = await jsonFetch(`${baseUrl}/api/admin/invite-console`, {
            headers: { cookie: adminCookie }
        });
        assert.equal(consoleResult.response.status, 200);
        assert.equal(consoleResult.body.summary.unusedInvites, 2);
        assert.equal(consoleResult.body.summary.unusedApiKeys, 2);
    });
});

test('普通用户不能访问 Admin invite console', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138121');
        const result = await jsonFetch(`${baseUrl}/api/admin/invite-console`, {
            headers: { cookie }
        });
        assert.equal(result.response.status, 403);
        assert.equal(result.body.code, 'ADMIN_ACCOUNT_REQUIRED');
    });
});

test('API 响应使用 no-store 且频繁账户查询会触发限流', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138696');
        const first = await jsonFetch(`${baseUrl}/api/orders?phone=13800138999`, {
            headers: { cookie }
        });
        assert.equal(first.response.status, 200);
        assert.equal(first.response.headers.get('cache-control'), 'no-store');

        let limited = null;
        for (let index = 0; index < 70; index += 1) {
            const result = await jsonFetch(`${baseUrl}/api/orders?phone=13800138999`, {
                headers: { cookie }
            });
            if (result.response.status === 429) {
                limited = result;
                break;
            }
        }

        assert.ok(limited);
        assert.equal(limited.body.code, 'QUERY_RATE_LIMITED');
    });
});

test('当前订单接口只返回 result token 绑定的订单', async () => {
    await withServer(async ({ baseUrl, db }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-token-a', 'sk-token-b'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 2 })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138101', code: inviteResult.body.invites[0].code })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138102', code: inviteResult.body.invites[1].code })
        });

        const firstToken = db.prepare('SELECT result_token FROM orders WHERE phone = ?').get('13800138101').result_token;
        const secondToken = db.prepare('SELECT result_token FROM orders WHERE phone = ?').get('13800138102').result_token;
        assert.notEqual(firstToken, secondToken);

        const missing = await jsonFetch(`${baseUrl}/api/orders/current`);
        assert.equal(missing.response.status, 401);
        assert.equal(missing.body.code, 'CURRENT_ORDER_NOT_FOUND');

        const first = await jsonFetch(`${baseUrl}/api/orders/current`, {
            headers: { cookie: `yui_shop_result_token=${firstToken}` }
        });
        assert.equal(first.response.status, 200);
        assert.equal(first.body.order.phone, '13800138101');
        assert.equal(first.body.order.apiKey, 'sk-token-a');

        const second = await jsonFetch(`${baseUrl}/api/orders/current`, {
            headers: { cookie: `yui_shop_result_token=${secondToken}` }
        });
        assert.equal(second.response.status, 200);
        assert.equal(second.body.order.phone, '13800138102');
        assert.equal(second.body.order.apiKey, 'sk-token-b');
    });
});

test('Account 页面数据会持久展示已过期订单和 API key preview', async () => {
    await withServer(async ({ baseUrl, db }) => {
        db.prepare('INSERT INTO users (phone, created_at) VALUES (?, ?)').run('13800138200', '2000-01-01T00:00:00.000Z');
        db.prepare(`
INSERT INTO orders (id, phone, invite_code, api_key, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
            'ORDER-EXPIRED-KEEP',
            '13800138200',
            'YUI-EXPIRED-KEEP',
            'sk-expired-keep-visible',
            'sk-expired...visible',
            'Codex 按量计费',
            30,
            '2000-01-01T00:00:00.000Z',
            '2000-02-01T00:00:00.000Z',
            'rst_expired_keep_visible'
        );

        const cookie = await registerUserAndGetCookie(baseUrl, '13800138200');
        const result = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.orders.length, 1);
        assert.equal(result.body.orders[0].id, 'ORDER-EXPIRED-KEEP');
        assert.equal(result.body.orders[0].apiKey, undefined);
        assert.equal(result.body.orders[0].apiKeyPreview, 'sk-expired...visible');
        assert.equal(result.body.orders[0].status, 'expired');
    });
});

test('进入兑换页会清理当前兑换 cookie，避免继续访问上一条结果页', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138697');
        const response = await fetch(`${baseUrl}/shop/redeem/`, {
            headers: { cookie: `${cookie}; yui_shop_result_token=rst_anything` }
        });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('set-cookie') || '', /yui_shop_result_token=;/);
    });
});

test('手机号包含字母或位数不对时，兑换接口会拒绝', async () => {
    await withServer(async ({ baseUrl }) => {
        const invalidRedeem = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138abc', code: 'YUI-ABCDEF-123456' })
        });
        assert.equal(invalidRedeem.response.status, 400);
        assert.equal(invalidRedeem.body.code, 'INVALID_PHONE');
    });
});

test('登录后的订单查询接口只返回当前 session 手机号的数据', async () => {
    await withServer(async ({ baseUrl }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-account-aaa-own', 'sk-account-zzz-other'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 2 })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138691', code: inviteResult.body.invites[0].code })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138692', code: inviteResult.body.invites[1].code })
        });

        const cookie = await registerUserAndGetCookie(baseUrl, '13800138691');
        const result = await jsonFetch(`${baseUrl}/api/orders?phone=13800138692`, {
            headers: { cookie }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.orders.length, 1);
        assert.equal(result.body.orders[0].phone, '13800138691');
        assert.equal(result.body.orders[0].apiKey, undefined);
        assert.equal(result.body.orders[0].apiKeyPreview, keyPreviewForTest('sk-account-aaa-own'));
    });
});

test('Shop 页面除登录、注册和重置密码外未登录都会跳转登录页', async () => {
    await withServer(async ({ baseUrl }) => {
        const protectedPaths = [
            '/shop/',
            '/shop/redeem/',
            '/shop/query/',
            '/shop/guide/',
            '/shop/key/',
            '/shop/order/',
            '/shop/pay/',
            '/shop/result/',
            '/shop/content/',
            '/shop/account/',
            '/shop/admin/'
        ];

        for (const pathname of protectedPaths) {
            const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
            assert.equal(response.status, 302, pathname);
            assert.equal(response.headers.get('location'), '/shop/login/', pathname);
        }

        const login = await fetch(`${baseUrl}/shop/login/`, { redirect: 'manual' });
        assert.equal(login.status, 200);
        assert.match(await login.text(), /id="loginForm"/);

        const register = await fetch(`${baseUrl}/shop/register/`, { redirect: 'manual' });
        assert.equal(register.status, 200);
        assert.match(await register.text(), /id="registerForm"/);

        const resetPassword = await fetch(`${baseUrl}/shop/reset-password/`, { redirect: 'manual' });
        assert.equal(resetPassword.status, 200);
        assert.match(await resetPassword.text(), /id="passwordResetForm"/);
    });
});

test('已登录普通用户访问 Shop 首页和查询页会进入 Account', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138693');

        const home = await fetch(`${baseUrl}/shop/`, {
            redirect: 'manual',
            headers: { cookie }
        });
        assert.equal(home.status, 302);
        assert.equal(home.headers.get('location'), '/shop/account/');

        const query = await fetch(`${baseUrl}/shop/query/`, {
            redirect: 'manual',
            headers: { cookie }
        });
        assert.equal(query.status, 302);
        assert.equal(query.headers.get('location'), '/shop/account/');
    });
});

test('Account usage summary 只聚合当前登录手机号关联的 token 用量', async () => {
    await withServer(async ({ baseUrl }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-usage-aaa-own', 'sk-usage-zzz-other'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 2 })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138694', code: inviteResult.body.invites[0].code })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138695', code: inviteResult.body.invites[1].code })
        });

        const requestedAt = new Date().toISOString();
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-account-own',
            api_key_hash: hashApiKeyForTest('sk-usage-aaa-own'),
            api_key_preview: 'sk-u...-own',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 10,
            output_tokens: 20,
            reasoning_tokens: 3,
            cached_tokens: 4,
            total_tokens: 33,
            requested_at: requestedAt
        });
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-account-other',
            api_key_hash: hashApiKeyForTest('sk-usage-zzz-other'),
            api_key_preview: 'sk-u...ther',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 100,
            output_tokens: 200,
            total_tokens: 300,
            requested_at: requestedAt
        });

        const unauthorized = await jsonFetch(`${baseUrl}/api/account/usage-summary`);
        assert.equal(unauthorized.response.status, 401);
        assert.equal(unauthorized.body.code, 'ACCOUNT_LOGIN_REQUIRED');

        const cookie = await registerUserAndGetCookie(baseUrl, '13800138694');
        const result = await jsonFetch(`${baseUrl}/api/account/usage-summary`, {
            headers: { cookie }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.summary.month.totalTokens, 33);
        assert.equal(result.body.summary.month.inputTokens, 10);
        assert.equal(result.body.summary.month.outputTokens, 20);
        assert.equal(result.body.summary.month.reasoningTokens, 3);
        assert.equal(result.body.summary.month.cachedTokens, 4);
        assert.equal(result.body.billing.monthChargeNanos, 138100);
        assert.equal(result.body.billing.todayChargeNanos, 138100);
        assert.equal(result.body.billing.cacheHitInputTokens, 4);
        assert.equal(result.body.billing.cacheMissInputTokens, 6);
        assert.equal(result.body.billing.outputTokens, 20);
        assert.equal(result.body.billing.recentCharges.length, 1);
        assert.equal(result.body.billing.recentCharges[0].usageEventId, 'req-account-own');
        assert.equal(result.body.byApiKey.length, 1);
        assert.equal(result.body.byApiKey[0].apiKeyPreview, keyPreviewForTest('sk-usage-aaa-own'));
        assert.ok(Array.isArray(result.body.hourly));
        assert.ok(Array.isArray(result.body.daily));
        assert.equal(result.body.dataFreshness.maxDelayMinutes, 60);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('邀请码使用 SQLite 主键精确匹配，大小写归一后只能兑换一次', async () => {
    await withServer(async ({ baseUrl, db }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-once'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        const invite = inviteResult.body.invites[0];
        const indexList = db.prepare('PRAGMA index_list(invite_codes)').all();
        assert.ok(indexList.some((item) => item.origin === 'pk' || item.origin === 'u'));

        const lowerCaseRedeem = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138001', code: invite.code.toLowerCase() })
        });
        assert.equal(lowerCaseRedeem.response.status, 201);

        const secondRedeem = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138002', code: invite.code })
        });
        assert.equal(secondRedeem.response.status, 409);
        assert.equal(secondRedeem.body.code, 'INVITE_USED');
    });
});

test('没有未使用 API key 时，邀请码不能被兑换且不会被标记为已使用', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        const invite = inviteResult.body.invites[0];

        const redeemResult = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138003', code: invite.code })
        });
        assert.equal(redeemResult.response.status, 409);
        assert.equal(redeemResult.body.code, 'NO_AVAILABLE_API_KEY');
        assert.deepEqual(
            db.prepare('SELECT status, redeemed_by_phone FROM invite_codes WHERE code = ?').get(invite.code),
            { status: 'unused', redeemed_by_phone: null }
        );
    });
});

test('API key 具有唯一性，重复导入会被拒绝', async () => {
    await withServer(async ({ baseUrl }) => {
        const first = await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-duplicate'] })
        });
        assert.equal(first.response.status, 201);

        const second = await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-duplicate'] })
        });
        assert.equal(second.response.status, 409);
        assert.equal(second.body.code, 'API_KEY_EXISTS');
    });
});

test('兑换页不再要求输入手机号，只绑定当前登录账号', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/redeem/index.html'), 'utf8');

    assert.doesNotMatch(html, /id="phoneInput"/);
    assert.match(html, /id="redeemAccountPhone"/);
    assert.match(html, /id="inviteCodeInput"/);
    assert.match(html, /会绑定到当前登录账号/);
});

test('兑换页展示按量计费 API key 文案并移除固定价格和手机号语义', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/redeem/index.html'), 'utf8');

    assert.match(html, /私下付款后，你会收到一个邀请码。输入邀请码后，系统会生成 API key。/);
    assert.match(html, /<h2 class="mt-2 text-2xl font-display">codex api key<\/h2>/);
    assert.doesNotMatch(html, /Codex 月额度/);
    assert.doesNotMatch(html, /Codex 每月额度/);
    assert.doesNotMatch(html, /31 天/);
    assert.doesNotMatch(html, /¥30\.00/);
});

test('兑换页前端调用登录态兑换接口', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.match(script, /requestJson\('\/api\/account\/me'\)/);
    assert.match(script, /redeemAccountPhone/);
    assert.match(script, /api\/account\/invites\/redeem/);
    assert.doesNotMatch(script, /api\/invites\/redeem',\s*\{/);
});

test('商店首页提供使用方法入口，公开说明页只使用占位 API key', () => {
    const home = fs.readFileSync(path.join(__dirname, '..', 'shop/index.html'), 'utf8');
    const guide = fs.readFileSync(path.join(__dirname, '..', 'shop/guide/index.html'), 'utf8');

    assert.match(home, /href="\/shop\/guide\/"[^>]*>使用方法<\/a>/);
    assert.match(home, /bg-gray-100/);
    assert.match(guide, /Codex 配置使用方法/);
    assert.match(guide, /https:\/\/api\.aaccx\.pw\/v1/);
    assert.match(guide, /OPENAI_API_KEY/);
    assert.match(guide, /Authorization: Bearer/);
    assert.match(guide, /不要使用 x-api-key/);
    assert.match(guide, /sk-xx/);
    assert.doesNotMatch(guide, /data-ui-ready','true/);
    assert.doesNotMatch(guide, /sk-dummy/);
    assert.doesNotMatch(guide, /环境变量文件/);
    assert.doesNotMatch(guide, /sk-[a-f0-9]{32}/);
});

test('Shop 首页按量计费文案和按钮布局不再暴露手机号查询入口', () => {
    const home = fs.readFileSync(path.join(__dirname, '..', 'shop/index.html'), 'utf8');

    assert.match(home, /Codex[\s\S]*按量计费/);
    assert.match(home, /按实际 token 记录/);
    assert.match(home, /登录账户/);
    assert.match(home, /兑换 API key/);
    assert.match(home, /使用方法/);
    assert.match(home, /私下开通/);
    assert.match(home, /按量记录/);
    assert.doesNotMatch(home, /href="\/shop\/query\/"/);
    assert.doesNotMatch(home, /手机号查询/);
    assert.doesNotMatch(home, /每月 30 元人民币/);
    assert.doesNotMatch(home, /额度兑换/);
    assert.doesNotMatch(home, /31 天有效/);
});

test('手机号查询页只作为 Account 跳转兜底，不再渲染查询表单', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/query/index.html'), 'utf8');
    assert.match(html, /正在进入账户页/);
    assert.doesNotMatch(html, /id="queryForm"/);
    assert.doesNotMatch(html, /id="queryPhone"/);
    assert.doesNotMatch(html, /过期订单会显示为已失效/);
});

test('API key 结果页只展示订单，不再渲染使用方法', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');
    assert.match(script, /api\/orders\/current/);
    assert.doesNotMatch(script, /yui-shop-latest-order/);
    assert.doesNotMatch(script, /Codex CLI 使用公网 API 配置说明/);
    assert.doesNotMatch(script, /Codex 配置使用方法/);
    assert.doesNotMatch(script, /renderUsageGuide/);
});

test('旧购买支付页面不再展示购买、支付、31 天和演示交付语义', () => {
    const files = [
        'shop/key/index.html',
        'shop/order/index.html',
        'shop/pay/index.html',
        'shop/result/index.html',
        'shop/content/index.html'
    ];
    const combined = files.map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.doesNotMatch(combined, /31 天/);
    assert.doesNotMatch(combined, /重新购买/);
    assert.doesNotMatch(combined, /¥199\.00/);
    assert.doesNotMatch(combined, /Yui Personal Digital Pack/);
    assert.doesNotMatch(combined, /生成订单并支付/);
    assert.doesNotMatch(combined, /选择支付方式/);
    assert.doesNotMatch(combined, /等待支付确认/);
    assert.doesNotMatch(combined, /演示支付成功/);
    assert.doesNotMatch(combined, /购买内容/);
    assert.doesNotMatch(combined, /交付文件/);
    assert.doesNotMatch(combined, /去购买/);
    assert.doesNotMatch(combined, /id="orderForm"/);
    assert.doesNotMatch(combined, /id="phoneInput"/);
    assert.doesNotMatch(combined, /data-pay-method/);
    assert.doesNotMatch(combined, /id="qrBox"/);
    assert.doesNotMatch(combined, /id="paymentAction"/);
    assert.doesNotMatch(combined, /id="orderSummary"/);
    assert.doesNotMatch(combined, /id="paidContent"/);
    assert.doesNotMatch(combined, /id="contentGuard"/);

    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/key/index.html'), 'utf8'), /API key 已激活/);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/order/index.html'), 'utf8'), /url=\/shop\/account\//);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/pay/index.html'), 'utf8'), /url=\/shop\/account\//);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/result/index.html'), 'utf8'), /url=\/shop\/account\//);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/content/index.html'), 'utf8'), /url=\/shop\/account\//);

    assert.match(script, /'\/shop\/order\/': \(\) => \{ window\.location\.replace\('\/shop\/account\/'\); \}/);
    assert.match(script, /'\/shop\/pay\/': \(\) => \{ window\.location\.replace\('\/shop\/account\/'\); \}/);
    assert.match(script, /'\/shop\/result\/': \(\) => \{ window\.location\.replace\('\/shop\/account\/'\); \}/);
    assert.match(script, /'\/shop\/content\/': \(\) => \{ window\.location\.replace\('\/shop\/account\/'\); \}/);
});

test('后台页面使用管理员 session，不渲染管理员 token 输入', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.match(html, /管理员控制台/);
    assert.match(html, /管理员账号/);
    assert.match(html, /shop\.js\?v=20260609-admin-session/);
    assert.doesNotMatch(html, /管理员口令/);
    assert.doesNotMatch(html, /解锁用量监控/);
    assert.doesNotMatch(html, /id="adminAccessForm"/);
    assert.doesNotMatch(html, /id="adminTokenInput"/);
    assert.doesNotMatch(html, /id="adminInviteForm"/);
    assert.doesNotMatch(html, /id="inviteCountInput"/);
    assert.doesNotMatch(html, /id="adminResult"/);
    assert.doesNotMatch(script, /invite\.apiKey/);
    assert.doesNotMatch(script, /api\/admin\/invites/);
    assert.doesNotMatch(script, /x-admin-token/);
});

test('Admin 页面包含兑换码管理栏目', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');

    assert.match(html, /id="adminInviteSection"/);
    assert.match(html, /id="adminInviteCreateForm"/);
    assert.match(html, /id="adminApiKeyImportForm"/);
    assert.match(html, /id="adminInviteConsoleSummary"/);
    assert.match(html, /id="adminInviteTable"/);
    assert.match(html, /id="adminApiKeyPoolTable"/);
    assert.match(html, /data-collapsible-section/);
});

test('Admin 前端兑换码管理不使用 x-admin-token', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.match(script, /api\/admin\/invite-console/);
    assert.match(script, /api\/admin\/session-invites/);
    assert.match(script, /api\/admin\/session-api-keys/);
    assert.match(script, /function initAdminInvitePage/);
    assert.doesNotMatch(script, /x-admin-token/);
});

test('后台页面包含 usage 监控和 JSONL 导入控件', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.match(html, /id="adminPasswordResetSection"/);
    assert.match(html, /id="adminInviteSection"/);
    assert.match(html, /id="adminTopupSection"/);
    assert.match(html, /id="adminUsageSection"/);
    assert.match(html, /id="adminUsageImportSection"/);
    assert.match(html, /id="usageRefreshButton"/);
    assert.match(html, /id="usageGroupFilter"/);
    assert.match(html, /<option value="local">Local<\/option>/);
    assert.match(html, /id="usageImportForm"/);
    assert.match(html, /CLIProxyAPI\/logs\/usage/);
    assert.match(html, /usage-events-YYYY-MM\.jsonl/);
    assert.match(html, /id="adminBillingUsageCards"/);
    assert.match(html, /id="adminRecentCharges"/);
    assert.match(script, /function initAdminUsagePage/);
    assert.match(script, /function renderBillingUsageCards/);
    assert.match(script, /function renderAdminRecentCharges/);
    assert.match(script, /api\/admin\/usage-summary/);
    assert.match(script, /api\/admin\/usage-imports/);
    assert.doesNotMatch(html, /完整 API key/);
    assert.equal((html.match(/data-collapsible-section/g) || []).length, 5);
    assert.equal((html.match(/data-collapsible-toggle/g) || []).length, 5);
    assert.equal((html.match(/data-collapsible-content/g) || []).length, 5);
    assert.match(html, /id="adminPasswordResetSection"[\s\S]*?data-collapsible-default="open"/);
    assert.match(html, /id="adminInviteSection"[\s\S]*?data-collapsible-default="open"/);
    assert.match(html, /id="adminTopupSection"[\s\S]*?data-collapsible-default="open"/);
    assert.match(html, /id="adminUsageSection"[\s\S]*?data-collapsible-default="open"/);
    assert.match(html, /id="adminUsageImportSection"[\s\S]*?data-collapsible-default="open"/);
});

test('Admin 日志导入栏目展示自动导入状态容器', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    assert.match(html, /id="usageImportStatus"/);
});

test('Admin 前端读取 usage 自动导入状态接口', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');
    assert.match(script, /api\/admin\/usage-import-status/);
});

test('Account 页面包含预充值余额、充值申请和扣费流水容器', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');

    assert.match(html, /id="accountBalanceCards"/);
    assert.match(html, /id="accountBillingUsageCards"/);
    assert.match(html, /id="topupForm"/);
    assert.match(html, /id="topupAmount"/);
    assert.match(html, /id="accountTopups"/);
    assert.match(html, /id="accountCharges"/);
    assert.match(html, /id="accountLedger"/);
    assert.match(html, /id="accountGuideSection"/);
    assert.match(html, /Codex 配置使用方法/);
    assert.match(html, /https:\/\/api\.aaccx\.pw\/v1/);
    assert.match(html, /OPENAI_API_KEY/);
    assert.match(html, /Authorization: Bearer/);
    assert.match(html, /不要使用 x-api-key/);
    assert.match(html, /sk-xx/);
    assert.equal((html.match(/data-collapsible-section/g) || []).length, 5);
    assert.equal((html.match(/data-collapsible-toggle/g) || []).length, 5);
    assert.equal((html.match(/data-collapsible-content/g) || []).length, 5);
    assert.match(html, /id="accountGuideSection"[\s\S]*?data-collapsible-default="closed"/);
});

test('Account 页把余额和 API key 前置，并默认收起说明和流水', () => {
    const accountHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');

    const billingIndex = accountHtml.indexOf('id="accountBillingSection"');
    const keysIndex = accountHtml.indexOf('id="accountKeysSection"');
    const guideIndex = accountHtml.indexOf('id="accountGuideSection"');
    const usageIndex = accountHtml.indexOf('id="accountUsageSection"');
    const historyIndex = accountHtml.indexOf('id="accountBillingHistorySection"');

    assert.ok(billingIndex >= 0);
    assert.ok(keysIndex > billingIndex);
    assert.ok(guideIndex > keysIndex);
    assert.ok(usageIndex > guideIndex);
    assert.ok(historyIndex > usageIndex);

    assert.match(accountHtml, /id="accountBillingSection"[^>]*data-collapsible-default="open"/);
    assert.match(accountHtml, /id="accountKeysSection"[^>]*data-collapsible-default="open"/);
    assert.match(accountHtml, /id="accountGuideSection"[^>]*data-collapsible-default="closed"/);
    assert.match(accountHtml, /id="accountUsageSection"[^>]*data-collapsible-default="open"/);
    assert.match(accountHtml, /id="accountBillingHistorySection"[^>]*data-collapsible-default="closed"/);
});

test('Account API key 卡片只展示 key、兑换时间和复制按钮', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');
    const compactBranch = script.match(/if \(options\.compactAccountOrder\) \{([\s\S]*?)\n\s{8}\}/)?.[1] || '';

    assert.match(script, /renderOrderCard\(order, \{ revealKey: true, compactAccountOrder: true \}\)/);
    assert.match(compactBranch, /API key/);
    assert.match(compactBranch, /兑换时间/);
    assert.match(compactBranch, /copyButton/);
    assert.doesNotMatch(compactBranch, /金额/);
    assert.doesNotMatch(compactBranch, /手机号/);
    assert.doesNotMatch(compactBranch, /失效时间/);
    assert.doesNotMatch(compactBranch, /31 天/);
    assert.doesNotMatch(compactBranch, /productName/);
    assert.doesNotMatch(compactBranch, /statusText/);
});

test('Admin 页面包含充值审核容器', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');

    assert.match(html, /id="adminTopupRefreshButton"/);
    assert.match(html, /id="adminTopupStatusFilter"/);
    assert.match(html, /id="adminTopupTable"/);
    assert.match(html, /id="adminTopupMessage"/);
});

test('管理员页和独立重置密码页包含密码重置入口，登录页只保留跳转链接', () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');
    const resetHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/reset-password/index.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.match(adminHtml, /id="passwordResetCodeForm"/);
    assert.match(adminHtml, /id="passwordResetPhone"/);
    assert.match(adminHtml, /id="passwordResetCodeResult"/);

    assert.match(loginHtml, /href="\/shop\/reset-password\/"/);
    assert.doesNotMatch(loginHtml, /id="showPasswordResetButton"/);
    assert.doesNotMatch(loginHtml, /id="passwordResetForm"/);
    assert.doesNotMatch(loginHtml, /id="resetPasswordCode"/);
    assert.doesNotMatch(loginHtml, /id="resetNewPassword"/);
    assert.doesNotMatch(loginHtml, /id="resetConfirmPassword"/);

    assert.match(resetHtml, /<title>重置密码<\/title>/);
    assert.match(resetHtml, /class="shop-auth-main[^"]*"/);
    assert.match(resetHtml, /class="shop-auth-background-figure"/);
    assert.match(resetHtml, /id="passwordResetForm"/);
    assert.match(resetHtml, /id="resetPhone"/);
    assert.match(resetHtml, /id="resetPasswordCode"/);
    assert.match(resetHtml, /id="resetNewPassword"/);
    assert.match(resetHtml, /id="resetConfirmPassword"/);
    assert.match(resetHtml, /href="\/shop\/login\/"/);

    assert.match(script, /function initResetPasswordPage/);
    assert.match(script, /'\/shop\/reset-password\/': initResetPasswordPage/);
    assert.doesNotMatch(script, /function initPasswordResetForm/);
    assert.doesNotMatch(script, /initPasswordResetForm\(\)/);
    assert.match(script, /initResetPasswordPage/);
    assert.match(script, /function initAdminPasswordResetPage/);
});

test('重置密码页使用紧凑 Auth 表单，避免桌面首屏溢出', () => {
    const resetHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/reset-password/index.html'), 'utf8');

    assert.match(resetHtml, /class="shop-auth-panel[^"]*md:p-10/);
    assert.match(resetHtml, /id="passwordResetForm" class="space-y-4"/);
    assert.equal((resetHtml.match(/h-11 rounded-md/g) || []).length, 4);
    assert.doesNotMatch(resetHtml, /id="passwordResetForm" class="space-y-5"/);
    assert.doesNotMatch(resetHtml, /class="shop-auth-panel[^"]*md:p-16/);
});

test('重置密码页允许未登录访问，账户页仍要求登录', async () => {
    await withServer(async ({ baseUrl }) => {
        const resetPage = await fetch(`${baseUrl}/shop/reset-password/`, { redirect: 'manual' });
        assert.equal(resetPage.status, 200);
        assert.match(await resetPage.text(), /id="passwordResetForm"/);

        const accountPage = await fetch(`${baseUrl}/shop/account/`, { redirect: 'manual' });
        assert.equal(accountPage.status, 302);
        assert.equal(accountPage.headers.get('location'), '/shop/login/');
    });
});

test('注册页使用登录页同款 Auth 外壳并移除左侧说明区块', () => {
    const registerHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/register/index.html'), 'utf8');

    assert.match(registerHtml, /<title>注册<\/title>/);
    assert.match(registerHtml, /class="shop-auth-main[^"]*"/);
    assert.match(registerHtml, /class="shop-auth-background-figure"/);
    assert.match(registerHtml, /src="\/shop\/assets\/login\/yui-login-bg\.png"/);
    assert.match(registerHtml, /class="shop-auth-content[^"]*"/);
    assert.match(registerHtml, /class="shop-auth-panel[^"]*"/);
    assert.match(registerHtml, /id="registerForm"/);
    assert.match(registerHtml, /id="registerPhone"/);
    assert.match(registerHtml, /id="registerPassword"/);
    assert.match(registerHtml, /id="registerConfirmPassword"/);
    assert.match(registerHtml, /href="\/shop\/login\/"/);
    assert.doesNotMatch(registerHtml, /Create account/);
    assert.doesNotMatch(registerHtml, /手机号会作为你的账户身份/);
    assert.doesNotMatch(registerHtml, /历史兑换过的手机号/);
    assert.doesNotMatch(registerHtml, /grid lg:grid-cols-\[0\.9fr_1\.1fr\]/);
});

test('登录页移除左侧标题并保留轻量登录入口', () => {
    const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');

    assert.doesNotMatch(loginHtml, /这里是登录页面/);
    assert.match(loginHtml, /<title>登录<\/title>/);
    assert.doesNotMatch(loginHtml, /<h1[\s\S]*?<\/h1>/);
    assert.doesNotMatch(loginHtml, /登录 Shop/);
    assert.doesNotMatch(loginHtml, /登录 悠一 的小店/);
    assert.doesNotMatch(loginHtml, /使用手机号和密码进入个人中心/);
    assert.doesNotMatch(loginHtml, /管理员账号登录后进入控制台/);
});

test('Auth 外壳样式由 Tailwind 输入文件统一维护，登录页使用中途版人物背景', () => {
    const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');
    const tailwindCss = fs.readFileSync(path.join(__dirname, '..', 'styles/tailwind.css'), 'utf8');
    const siteCss = fs.readFileSync(path.join(__dirname, '..', 'styles/site.css'), 'utf8');
    const assetPath = path.join(__dirname, '..', 'shop/assets/login/yui-login-bg.png');
    const png = fs.readFileSync(assetPath);

    assert.match(loginHtml, /class="shop-auth-main[^"]*"/);
    assert.match(loginHtml, /class="shop-auth-background-figure"/);
    assert.match(loginHtml, /class="shop-auth-content[^"]*"/);
    assert.match(loginHtml, /class="shop-auth-panel[^"]*"/);
    assert.match(loginHtml, /src="\/shop\/assets\/login\/yui-login-bg\.png"/);
    assert.doesNotMatch(loginHtml, /\.login-main/);
    assert.doesNotMatch(loginHtml, /\.login-background-figure/);
    assert.doesNotMatch(loginHtml, /\.login-content/);
    assert.doesNotMatch(loginHtml, /\.login-panel/);

    assert.match(tailwindCss, /\.shop-auth-background-figure/);
    assert.match(tailwindCss, /left:\s*clamp\(-380px,\s*-22vw,\s*-260px\)/);
    assert.match(tailwindCss, /bottom:\s*0/);
    assert.match(tailwindCss, /width:\s*min\(86vw,\s*1120px\)/);
    assert.match(tailwindCss, /opacity:\s*0\.42/);
    assert.match(siteCss, /\.shop-auth-background-figure/);

    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png[25], 6);
});

test('内部 API key 状态接口必须使用请求头 token', async () => {
    await withServer(async ({ baseUrl }) => {
        const missing = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-any`);
        assert.equal(missing.response.status, 401);
        assert.equal(missing.body.code, 'UNAUTHORIZED');

        const wrong = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-any`, {
            headers: { 'x-internal-token': 'wrong-token' }
        });
        assert.equal(wrong.response.status, 401);
        assert.equal(wrong.body.code, 'UNAUTHORIZED');

        const queryToken = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-any&internalToken=internal-test-token`);
        assert.equal(queryToken.response.status, 401);
        assert.equal(queryToken.body.code, 'UNAUTHORIZED');
    });
});

test('内部 API key 状态接口返回未托管、未兑换、有效和过期状态', async () => {
    await withServer(async ({ baseUrl, db }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-active-status', 'sk-unused-status'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138300', code: inviteResult.body.invites[0].code })
        });

        db.prepare(`
UPDATE orders
SET expires_at = ?
WHERE api_key = ?
`).run('2000-01-01T00:00:00.000Z', 'sk-active-status');

        const notFound = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-not-imported`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(notFound.response.status, 200);
        assert.deepEqual(notFound.body, {
            managed: false,
            active: false,
            status: 'not_found',
            expiresAt: ''
        });

        const unused = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-unused-status`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(unused.response.status, 200);
        assert.equal(unused.body.managed, true);
        assert.equal(unused.body.active, false);
        assert.equal(unused.body.status, 'unused');
        assert.equal(unused.body.expiresAt, '');

        const expired = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-active-status`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(expired.response.status, 200);
        assert.equal(expired.body.managed, true);
        assert.equal(expired.body.active, false);
        assert.equal(expired.body.status, 'expired');
        assert.equal(expired.body.expiresAt, '2000-01-01T00:00:00.000Z');
    });
});

test('内部 API key 状态接口支持 POST api_key_hash 且不需要 raw key', async () => {
    await withServer(async ({ baseUrl }) => {
        await createRedeemedOrder(baseUrl, '13800138302', 'sk-status-v2');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138302');
        await submitAndApproveTopup(baseUrl, cookie, '1');

        const active = await jsonFetch(`${baseUrl}/api/internal/api-keys/status`, {
            method: 'POST',
            headers: { 'x-internal-token': 'internal-test-token' },
            body: JSON.stringify({ api_key_hash: hashApiKeyForTest('sk-status-v2') })
        });

        assert.equal(active.response.status, 200);
        assert.equal(active.body.managed, true);
        assert.equal(active.body.active, true);
        assert.equal(active.body.status, 'active');
    });
});

test('内部 API key 状态查询使用 hash 查找，不依赖明文列', async () => {
    await withServer(async ({ baseUrl, db }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-status-encrypted'] })
        });
        db.prepare('UPDATE api_keys SET api_key = ? WHERE api_key_hash = ?').run('', hashApiKeyForTest('sk-status-encrypted'));

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent('sk-status-encrypted')}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(status.response.status, 200);
        assert.equal(status.body.managed, true);
    }, {
        apiKeyEncryptionSecret: '0123456789abcdef0123456789abcdef'
    });
});

test('内部 API key 状态接口对未过期且余额充足的订单返回 active', async () => {
    await withServer(async ({ baseUrl }) => {
        await createRedeemedOrder(baseUrl, '13800138301', 'sk-active-status');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138301');
        await submitAndApproveTopup(baseUrl, cookie, '1');

        const active = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-active-status`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(active.response.status, 200);
        assert.equal(active.body.managed, true);
        assert.equal(active.body.active, true);
        assert.equal(active.body.status, 'active');
        assert.equal(active.body.billing.balanceCents, 100);
        assert.match(active.body.expiresAt, /^\d{4}-\d{2}-\d{2}T/);
    });
});

test('Shop 用户表支持密码字段并创建 user_sessions 会话表', async () => {
    await withServer(async ({ db }) => {
        const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
        assert.ok(userColumns.includes('password_hash'));
        assert.ok(userColumns.includes('password_created_at'));
        assert.ok(userColumns.includes('updated_at'));

        const sessionTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_sessions'").get();
        assert.deepEqual(sessionTable, { name: 'user_sessions' });
    });
});

test('Shop 数据库包含 password_reset_codes 一次性密码重置码表', async () => {
    await withServer(async ({ db }) => {
        const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'password_reset_codes'").get();
        assert.deepEqual(table, { name: 'password_reset_codes' });

        const columns = db.prepare('PRAGMA table_info(password_reset_codes)').all().map((column) => column.name);
        assert.deepEqual(columns, [
            'id',
            'phone',
            'code_hash',
            'created_at',
            'expires_at',
            'used_at',
            'created_by_phone'
        ]);
    });
});

test('用户注册校验手机号、密码规则和确认密码', async () => {
    await withServer(async ({ baseUrl }) => {
        const invalidPhone = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138abc', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(invalidPhone.response.status, 400);
        assert.equal(invalidPhone.body.code, 'INVALID_PHONE');

        const weakPassword = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138600', password: 'abcdefg1', confirmPassword: 'abcdefg1' })
        });
        assert.equal(weakPassword.response.status, 400);
        assert.equal(weakPassword.body.code, 'WEAK_PASSWORD');

        const mismatch = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138600', password: 'Abcdefg1', confirmPassword: 'Abcdefg2' })
        });
        assert.equal(mismatch.response.status, 400);
        assert.equal(mismatch.body.code, 'PASSWORD_MISMATCH');
    });
});

test('历史兑换手机号可以补密码注册并通过 account session 只查看自己的订单', async () => {
    await withServer(async ({ baseUrl, db }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-account-a', 'sk-account-b'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 2 })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138601', code: inviteResult.body.invites[0].code })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138602', code: inviteResult.body.invites[1].code })
        });

        const register = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138601', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(register.response.status, 201);
        assert.equal(register.body.user.phone, '13800138601');
        const cookie = register.response.headers.get('set-cookie') || '';
        assert.match(cookie, /yui_shop_account_session=/);
        assert.match(cookie.toLowerCase(), /httponly/);
        assert.doesNotMatch(db.prepare('SELECT password_hash FROM users WHERE phone = ?').get('13800138601').password_hash, /Abcdefg1/);

        const me = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie }
        });
        assert.equal(me.response.status, 200);
        assert.equal(me.body.user.phone, '13800138601');
        assert.equal(me.body.orders.length, 1);
        assert.equal(me.body.orders[0].phone, '13800138601');
        assert.equal(me.body.orders[0].apiKey, undefined);
        assert.equal(me.body.orders[0].apiKeyPreview, 'sk-account-a...ount-a');
    });
});

test('只有管理员账号可以为已注册用户生成一次性密码重置码', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const userRegister = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138620', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(userRegister.response.status, 201);
        const userCookie = userRegister.response.headers.get('set-cookie') || '';

        const forbidden = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: userCookie },
            body: JSON.stringify({ phone: '13800138620' })
        });
        assert.equal(forbidden.response.status, 403);
        assert.equal(forbidden.body.code, 'ADMIN_ACCOUNT_REQUIRED');

        const tokenOnly = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ phone: '13800138620' })
        });
        assert.equal(tokenOnly.response.status, 401);
        assert.equal(tokenOnly.body.code, 'UNAUTHORIZED');

        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        const adminCookie = adminLogin.response.headers.get('set-cookie') || '';

        const invalidPhone = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ phone: '13800138abc' })
        });
        assert.equal(invalidPhone.response.status, 400);
        assert.equal(invalidPhone.body.code, 'INVALID_PHONE');

        const missingUser = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ phone: '13800138621' })
        });
        assert.equal(missingUser.response.status, 404);
        assert.equal(missingUser.body.code, 'USER_NOT_FOUND');

        const created = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ phone: '13800138620' })
        });
        assert.equal(created.response.status, 201);
        assert.equal(created.body.phone, '13800138620');
        assert.match(created.body.code, /^RST-[A-Z0-9]{6}-[A-Z0-9]{6}$/);
        assert.match(created.body.expiresAt, /^\d{4}-\d{2}-\d{2}T/);

        const row = db.prepare('SELECT phone, code_hash, used_at, created_by_phone FROM password_reset_codes WHERE phone = ?').get('13800138620');
        assert.equal(row.phone, '13800138620');
        assert.equal(row.created_by_phone, '15951875192');
        assert.equal(row.used_at, null);
        assert.doesNotMatch(row.code_hash, /RST-/);
        assert.notEqual(row.code_hash, created.body.code);
    });
});

test('用户凭一次性重置码设置新密码后旧 session 失效并创建新 session', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const userRegister = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(userRegister.response.status, 201);
        const oldCookie = userRegister.response.headers.get('set-cookie') || '';

        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        const adminCookie = adminLogin.response.headers.get('set-cookie') || '';
        const resetCodeResult = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ phone: '13800138622' })
        });
        assert.equal(resetCodeResult.response.status, 201);
        const resetCode = resetCodeResult.body.code;

        const weakPassword = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: resetCode, password: 'abcdefg1', confirmPassword: 'abcdefg1' })
        });
        assert.equal(weakPassword.response.status, 400);
        assert.equal(weakPassword.body.code, 'WEAK_PASSWORD');

        const mismatch = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: resetCode, password: 'Abcdefg2', confirmPassword: 'Abcdefg3' })
        });
        assert.equal(mismatch.response.status, 400);
        assert.equal(mismatch.body.code, 'PASSWORD_MISMATCH');

        const invalidCode = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: 'RST-XXXXXX-XXXXXX', password: 'Abcdefg2', confirmPassword: 'Abcdefg2' })
        });
        assert.equal(invalidCode.response.status, 400);
        assert.equal(invalidCode.body.code, 'INVALID_RESET_CODE');

        const reset = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: resetCode.toLowerCase(), password: 'Abcdefg2', confirmPassword: 'Abcdefg2' })
        });
        assert.equal(reset.response.status, 200);
        assert.equal(reset.body.user.phone, '13800138622');
        const newCookie = reset.response.headers.get('set-cookie') || '';
        assert.match(newCookie, /yui_shop_account_session=/);

        const oldSession = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie: oldCookie }
        });
        assert.equal(oldSession.response.status, 401);
        assert.equal(oldSession.body.code, 'ACCOUNT_LOGIN_REQUIRED');

        const newSession = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie: newCookie }
        });
        assert.equal(newSession.response.status, 200);
        assert.equal(newSession.body.user.phone, '13800138622');

        const oldPasswordLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', password: 'Abcdefg1' })
        });
        assert.equal(oldPasswordLogin.response.status, 401);

        const newPasswordLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', password: 'Abcdefg2' })
        });
        assert.equal(newPasswordLogin.response.status, 200);

        const usedAgain = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: resetCode, password: 'Abcdefg3', confirmPassword: 'Abcdefg3' })
        });
        assert.equal(usedAgain.response.status, 400);
        assert.equal(usedAgain.body.code, 'INVALID_RESET_CODE');
    });
});

test('过期的一次性密码重置码不能用于重置密码', async () => {
    await withServer(async ({ baseUrl, db }) => {
        await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138623', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });

        const code = 'RST-EXPIRE-000001';
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        db.prepare(`
INSERT INTO password_reset_codes (id, phone, code_hash, created_at, expires_at, created_by_phone)
VALUES (?, ?, ?, ?, ?, ?)
`).run(
            'PRC_EXPIRED_TEST',
            '13800138623',
            codeHash,
            '2026-06-09T12:00:00+08:00',
            '2026-06-09T12:01:00+08:00',
            '15951875192'
        );

        const result = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138623', code, password: 'Abcdefg2', confirmPassword: 'Abcdefg2' })
        });
        assert.equal(result.response.status, 400);
        assert.equal(result.body.code, 'INVALID_RESET_CODE');
    });
});

test('登录失败、重复注册、退出登录和 account 页面保护都按 session 生效', async () => {
    await withServer(async ({ baseUrl }) => {
        const loggedOutPage = await fetch(`${baseUrl}/shop/account/`, { redirect: 'manual' });
        assert.equal(loggedOutPage.status, 302);
        assert.equal(loggedOutPage.headers.get('location'), '/shop/login/');

        const register = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138603', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(register.response.status, 201);

        const duplicate = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138603', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(duplicate.response.status, 409);
        assert.equal(duplicate.body.code, 'USER_EXISTS');

        const wrongPassword = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138603', password: 'Wrongabc1' })
        });
        assert.equal(wrongPassword.response.status, 401);
        assert.equal(wrongPassword.body.code, 'INVALID_CREDENTIALS');

        const login = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138603', password: 'Abcdefg1' })
        });
        assert.equal(login.response.status, 200);
        const cookie = login.response.headers.get('set-cookie') || '';

        const accountPage = await fetch(`${baseUrl}/shop/account/`, { headers: { cookie } });
        assert.equal(accountPage.status, 200);
        assert.match(await accountPage.text(), /我的账户/);

        const logout = await jsonFetch(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: { cookie }
        });
        assert.equal(logout.response.status, 200);
        assert.match(logout.response.headers.get('set-cookie') || '', /yui_shop_account_session=;/);

        const afterLogout = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie }
        });
        assert.equal(afterLogout.response.status, 401);
        assert.equal(afterLogout.body.code, 'ACCOUNT_LOGIN_REQUIRED');
    });
});

test('历史登录态缺少 CSRF token 时仍可退出登录', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const register = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138604', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(register.response.status, 201);

        db.prepare('UPDATE user_sessions SET csrf_token_hash = NULL WHERE phone = ?').run('13800138604');

        const cookie = cookieHeaderFromSetCookie(register.response.headers.get('set-cookie') || '');
        const sessionCookie = cookie
            .split('; ')
            .filter((part) => part.startsWith('yui_shop_account_session='))
            .join('; ');

        const accountPage = await fetch(`${baseUrl}/shop/account/`, { headers: { cookie: sessionCookie } });
        assert.equal(accountPage.status, 200);

        const logout = await jsonFetch(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: {
                cookie: sessionCookie,
                origin: baseUrl
            }
        });
        assert.equal(logout.response.status, 200);
        assert.match(logout.response.headers.get('set-cookie') || '', /yui_shop_account_session=;/);

        const afterLogout = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie: sessionCookie }
        });
        assert.equal(afterLogout.response.status, 401);
        assert.equal(afterLogout.body.code, 'ACCOUNT_LOGIN_REQUIRED');
    });
});

test('公开注册接口不能创建唯一管理员手机号', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const register = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(register.response.status, 403);
        assert.equal(register.body.code, 'ADMIN_ACCOUNT_REGISTRATION_DISABLED');

        seedAdminUserForTest(db);
        const login = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(login.response.status, 200);
        assert.equal(login.body.user.isAdmin, true);
    });
});

test('只有唯一管理员手机号登录后才能访问 Shop 管理员控制台', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const loggedOutPage = await fetch(`${baseUrl}/shop/admin/`, { redirect: 'manual' });
        assert.equal(loggedOutPage.status, 302);
        assert.equal(loggedOutPage.headers.get('location'), '/shop/login/');

        const userRegister = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138605', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(userRegister.response.status, 201);
        const userCookie = userRegister.response.headers.get('set-cookie') || '';

        const userPage = await fetch(`${baseUrl}/shop/admin/`, {
            redirect: 'manual',
            headers: { cookie: userCookie }
        });
        assert.equal(userPage.status, 403);

        const userUsage = await jsonFetch(`${baseUrl}/api/admin/usage-summary`, {
            headers: { cookie: userCookie }
        });
        assert.equal(userUsage.response.status, 403);
        assert.equal(userUsage.body.code, 'ADMIN_ACCOUNT_REQUIRED');

        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        assert.equal(adminLogin.body.user.isAdmin, true);
        const adminCookie = adminLogin.response.headers.get('set-cookie') || '';

        const adminPage = await fetch(`${baseUrl}/shop/admin/`, {
            headers: { cookie: adminCookie }
        });
        assert.equal(adminPage.status, 200);
        assert.match(await adminPage.text(), /管理员控制台/);

        const adminUsage = await jsonFetch(`${baseUrl}/api/admin/usage-summary`, {
            headers: { cookie: adminCookie }
        });
        assert.equal(adminUsage.response.status, 200);
        assert.deepEqual(adminUsage.body.summary, {
            today_tokens: 0,
            month_tokens: 0,
            total_tokens: 0,
            today_requests: 0,
            month_requests: 0,
            total_requests: 0,
            failed_requests: 0
        });
    });
});

test('管理员手机号登录接口返回管理员身份，普通用户登录接口返回普通身份', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        assert.equal(adminLogin.body.user.isAdmin, true);

        const userRegister = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138606', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(userRegister.response.status, 201);
        await jsonFetch(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: { cookie: userRegister.response.headers.get('set-cookie') || '' }
        });

        const userLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138606', password: 'Abcdefg1' })
        });
        assert.equal(userLogin.response.status, 200);
        assert.equal(userLogin.body.user.isAdmin, false);
    });
});

test('已登录管理员访问登录页仍看到登录表单', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        const cookie = adminLogin.response.headers.get('set-cookie') || '';

        const loginPage = await fetch(`${baseUrl}/shop/login/`, {
            redirect: 'manual',
            headers: { cookie }
        });
        assert.equal(loginPage.status, 200);
        assert.match(await loginPage.text(), /id="loginForm"/);
    });
});

test('已登录管理员访问注册页仍看到注册表单', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        const cookie = adminLogin.response.headers.get('set-cookie') || '';

        const registerPage = await fetch(`${baseUrl}/shop/register/`, {
            redirect: 'manual',
            headers: { cookie }
        });
        assert.equal(registerPage.status, 200);
        assert.match(await registerPage.text(), /id="registerForm"/);
    });
});

test('无效过期时间的账号 session 会被拒绝', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const token = 'usr_invalid_expiry';
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        db.prepare('INSERT INTO users (phone, created_at) VALUES (?, ?)').run('13800138604', '2026-06-09T12:00:00+08:00');
        db.prepare(`
            INSERT INTO user_sessions (token_hash, phone, created_at, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(tokenHash, '13800138604', '2026-06-09T12:00:00+08:00', 'not-a-date');

        const result = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie: `yui_shop_account_session=${token}` }
        });

        assert.equal(result.response.status, 401);
        assert.equal(result.body.code, 'ACCOUNT_LOGIN_REQUIRED');
    });
});

test('Shop 首页顶部不显示账号入口且正文只保留固定登录入口', () => {
    const home = fs.readFileSync(path.join(__dirname, '..', 'shop/index.html'), 'utf8');
    const login = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');
    const register = fs.readFileSync(path.join(__dirname, '..', 'shop/register/index.html'), 'utf8');
    const account = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');
    const header = home.match(/<header[\s\S]*?<\/header>/)?.[0] || '';
    const accountLinkCount = (home.match(/data-account-link/g) || []).length;

    assert.match(home, /href="\/shop\/login\/"/);
    assert.equal(accountLinkCount, 0);
    assert.doesNotMatch(header, /data-account-link/);
    assert.match(home, /<main[\s\S]*href="\/shop\/login\/"[\s\S]*>登录账户<\/a>/);
    assert.doesNotMatch(home, /管理控制台/);
    assert.match(login, /id="loginForm"/);
    assert.match(login, /id="loginForm"/);
    assert.doesNotMatch(login, /这里是登录页面/);
    assert.match(register, /id="registerForm"/);
    assert.match(register, /至少 8 位/);
    assert.match(account, /id="logoutButton"/);
    assert.doesNotMatch(account, /window\.YuiShop\.initAccountPage/);
    assert.match(script, /'\/shop\/account\/': initAccountPage/);
});


test('公共顶部导航支持 Shop 的中英日翻译', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'js/lang.js'), 'utf8');

    assert.match(script, /shop:\s*'商店'/);
    assert.match(script, /shop:\s*'Shop'/);
    assert.match(script, /shop:\s*'ショップ'/);
    assert.match(script, /href\.includes\('\/shop'\)[\s\S]*data\.nav\.shop/);
    assert.match(script, /path === '\/shop' \|\| path\.startsWith\('\/shop\/'\)[\s\S]*return null/);
});
