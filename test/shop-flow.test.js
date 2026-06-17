const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { createShopApp } = require('../server');
const { priceUsageTokens } = require('../lib/shop-pricing');

const nanosPerYuan = 1000000000;
const nanosPerCent = 10000000;
const shopFrontendScriptFiles = [
    'shop/js/core.js',
    'shop/js/charts.js',
    'shop/js/auth.js',
    'shop/js/account.js',
    'shop/js/admin.js',
    'shop/js/legacy-redirects.js',
    'shop/shop.js'
];

function readShopFrontendScript(file) {
    return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

function readShopFrontendSource() {
    return shopFrontendScriptFiles.map(readShopFrontendScript).join('\n');
}

function loadShopFrontendScripts(sandbox) {
    for (const file of shopFrontendScriptFiles) {
        vm.runInNewContext(readShopFrontendScript(file), sandbox, { filename: file });
    }
}

function nanosToCnyForTest(nanos) {
    return Number(nanos || 0) / nanosPerYuan;
}

function nanosToBalanceCentsForTest(nanos) {
    const value = Number(nanos || 0);
    if (value >= 0) return Math.floor(value / nanosPerCent);
    return -Math.ceil(Math.abs(value) / nanosPerCent);
}

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

async function submitSubscriptionOrder(baseUrl, cookie, planId = 'sub_39_daily_29_usd') {
    const created = await jsonFetch(`${baseUrl}/api/account/subscription-orders`, {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({ planId, paymentMethod: 'wechat', paymentNote: 'test-subscription' })
    });
    assert.equal(created.response.status, 201);
    return created.body.order;
}

async function approveSubscriptionOrder(baseUrl, orderId, adminToken = 'test-token') {
    const approved = await jsonFetch(`${baseUrl}/api/admin/subscription-orders/${encodeURIComponent(orderId)}/approve`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({ adminNote: 'approved for test' })
    });
    assert.equal(approved.response.status, 200);
    return approved.body;
}

async function submitAndApproveSubscription(baseUrl, cookie, planId = 'sub_39_daily_29_usd') {
    const order = await submitSubscriptionOrder(baseUrl, cookie, planId);
    const approved = await approveSubscriptionOrder(baseUrl, order.id);
    return approved.subscription;
}

async function submitAddonOrder(baseUrl, cookie, amount = 5) {
    const created = await jsonFetch(`${baseUrl}/api/account/addon-orders`, {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({ amount, paymentMethod: 'alipay', paymentNote: 'test-addon' })
    });
    assert.equal(created.response.status, 201);
    return created.body.order;
}

async function approveAddonOrder(baseUrl, orderId, adminToken = 'test-token') {
    const approved = await jsonFetch(`${baseUrl}/api/admin/addon-orders/${encodeURIComponent(orderId)}/approve`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({ adminNote: 'approved for test' })
    });
    assert.equal(approved.response.status, 200);
    return approved.body;
}

async function submitAndApproveAddon(baseUrl, cookie, amount = 5) {
    const order = await submitAddonOrder(baseUrl, cookie, amount);
    const approved = await approveAddonOrder(baseUrl, order.id);
    return approved.order;
}

async function submitSubscriptionRefundRequest(baseUrl, cookie) {
    const created = await jsonFetch(`${baseUrl}/api/account/subscription-refund-requests`, {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({})
    });
    assert.equal(created.response.status, 201);
    return created.body.refundRequest;
}

async function withServer(run, appOptions = {}) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yui-shop-test-'));
    const dbPath = path.join(tempDir, 'shop.sqlite');
    const { app, db, usageImporter } = createShopApp({
        dbPath,
        adminToken: 'test-token',
        internalToken: 'internal-test-token',
        rootDir: path.join(__dirname, '..'),
        apiKeyEncryptionSecret: '',
        shopChargeAuditLogDir: path.join(tempDir, 'charge-audit'),
        cliproxyConfigPath: '',
        cliproxyConfigBackupDir: '',
        usageAutoImportEnabled: false,
        usageAutoImportStartTimer: false,
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
    const sandbox = {
        document: { cookie },
        fetch: fetchImpl,
        window: { location: { replace() {} } },
        Intl,
        URL
    };
    sandbox.window.document = sandbox.document;
    vm.runInNewContext(readShopFrontendScript('shop/js/core.js'), sandbox, { filename: 'shop/js/core.js' });
    return sandbox.window.YuiShopCore.requestJson;
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
    const script = readShopFrontendSource();
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
        'accountBillingUsageCards',
        'usageFreshness',
        'accountUsageMessage'
    ]) {
        elements.set(id, createElement());
    }
    const requests = [];
    const responses = {
        '/api/account/me': { user: { phone: '13800139999' }, orders: [] },
        '/api/account/subscription-state': {
            plans: [],
            addonPackages: [],
            subscription: null,
            quota: {},
            payment: {
                alipayQrUrl: '/shop/assets/pay/alipay-qr.png',
                wechatQrUrl: '/shop/assets/pay/wechat-qr.png',
                paymentReference: 'YUI-TEST'
            }
        },
        '/api/account/subscription-orders': { orders: [] },
        '/api/account/addon-orders': { orders: [] },
        '/api/account/usd-charges': { charges: [] },
        '/api/account/addon-ledger': { entries: [] },
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

    loadShopFrontendScripts(sandbox);
    await sandbox.window.YuiShopReady;
    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(requests.includes('/api/account/me'));
    assert.equal(elements.get('accountPhone').textContent, '13800139999');
    assert.equal(elements.get('alipayQrImage').src, '/shop/assets/pay/alipay-qr.png');
    assert.equal(elements.get('wechatQrImage').src, '/shop/assets/pay/wechat-qr.png');
});

test('Account 前端读取模型总览并渲染官方美元价格表', async () => {
    const script = readShopFrontendSource();
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
        'accountModelOverview',
        'accountBalanceCards',
        'accountTopups',
        'accountCharges',
        'accountLedger',
        'alipayQrImage',
        'wechatQrImage',
        'accountBillingUsageCards',
        'usageFreshness',
        'accountUsageMessage'
    ]) {
        elements.set(id, createElement());
    }
    const requests = [];
    const responses = {
        '/api/account/me': { user: { phone: '13800139998' }, orders: [] },
        '/api/account/model-overview': {
            source: 'live',
            checkedAt: '2026-06-13T14:00:00+08:00',
            models: [
                {
                    id: 'gpt-5.4',
                    available: true,
                    priceModel: 'gpt-5.4',
                    usesDefaultPrice: false,
                    priceVersion: 'openai-standard-short-usd-20260616',
                    cacheHitInputUsdPerMillion: 0.25,
                    cacheMissInputUsdPerMillion: 2.5,
                    outputUsdPerMillion: 15
                },
                {
                    id: 'gpt-5.4-mini',
                    available: true,
                    priceModel: 'gpt-5.4',
                    usesDefaultPrice: true,
                    priceVersion: 'openai-standard-short-usd-20260616',
                    cacheHitInputUsdPerMillion: 0.25,
                    cacheMissInputUsdPerMillion: 2.5,
                    outputUsdPerMillion: 15
                },
                {
                    id: 'gpt-5.5',
                    available: true,
                    priceModel: 'gpt-5.5',
                    usesDefaultPrice: false,
                    priceVersion: 'openai-standard-short-usd-20260616',
                    cacheHitInputUsdPerMillion: 0.5,
                    cacheMissInputUsdPerMillion: 5,
                    outputUsdPerMillion: 30
                }
            ]
        },
        '/api/account/balance': { balance: {}, payment: {} },
        '/api/account/topups': { topups: [] },
        '/api/account/api-charges': { charges: [] },
        '/api/account/ledger': { entries: [] },
        '/api/account/usage-summary': { summary: {}, billing: {}, hourly: [], daily: [] }
    };
    const sandbox = {
        document: {
            cookie: '',
            readyState: 'loading',
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

    loadShopFrontendScripts(sandbox);
    await sandbox.window.YuiShopReady;
    await sandbox.window.YuiShop.initAccountPage();

    assert.ok(requests.includes('/api/account/model-overview'));
    assert.match(elements.get('accountModelOverview').innerHTML, /gpt-5\.4-mini/);
    assert.match(elements.get('accountModelOverview').innerHTML, /\$0\.25/);
    assert.match(elements.get('accountModelOverview').innerHTML, /\$2\.50/);
    assert.match(elements.get('accountModelOverview').innerHTML, /\$15\.00/);
    assert.match(elements.get('accountModelOverview').innerHTML, /\$30\.00/);
    assert.doesNotMatch(elements.get('accountModelOverview').innerHTML, /计价/);
    assert.doesNotMatch(elements.get('accountModelOverview').innerHTML, /沿用 gpt-5\.4/);
    assert.doesNotMatch(elements.get('accountModelOverview').innerHTML, /价格表回退/);
    assert.doesNotMatch(elements.get('accountModelOverview').innerHTML, /实时模型/);
    assert.doesNotMatch(elements.get('accountModelOverview').innerHTML, /更新时间/);
});

test('Account 页提供登录态邀请码兑换表单且不再引导到独立手机号兑换页', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');

    assert.match(html, /id="accountRedeemForm"/);
    assert.match(html, /id="accountInviteCodeInput"/);
    assert.match(html, /id="accountRedeemMessage"/);
    assert.doesNotMatch(html, /href="\/shop\/redeem\/"/);
});

test('Account 前端兑换调用登录态接口并且不提交手机号', async () => {
    const script = readShopFrontendSource();
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
        'accountBillingUsageCards',
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

    loadShopFrontendScripts(sandbox);
    await sandbox.window.YuiShopReady;
    await sandbox.window.YuiShop.initAccountPage();
    elements.get('accountInviteCodeInput').value = 'yui-abc-def';
    elements.get('accountRedeemForm').dispatchEvent({ type: 'submit' });
    await new Promise((resolve) => setImmediate(resolve));

    const redeemCall = calls.find((call) => call.url === '/api/account/invites/redeem');
    assert.ok(redeemCall);
    assert.deepEqual(JSON.parse(redeemCall.options.body), { code: 'YUI-ABC-DEF' });
});

test('Shop 外部脚本会绑定 Account 和 Admin 页栏目折叠按钮', async () => {
    const script = readShopFrontendSource();

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

        loadShopFrontendScripts(sandbox);
        await sandbox.window.YuiShopReady;

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

test('登录态邀请码兑换成功后同步 API key 到 CLIProxyAPI 入口配置', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cliproxy-redeem-sync-'));
    try {
        const configPath = path.join(tempDir, 'config.yaml');
        fs.writeFileSync(configPath, [
            'host: "127.0.0.1"',
            'api-keys:',
            '  - sk-existing-cliproxy',
            'debug: true',
            ''
        ].join('\n'));

        await withServer(async ({ baseUrl }) => {
            await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
                method: 'POST',
                headers: { 'x-admin-token': 'test-token' },
                body: JSON.stringify({ apiKeys: ['sk-session-sync'] })
            });
            const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
                method: 'POST',
                headers: { 'x-admin-token': 'test-token' },
                body: JSON.stringify({ count: 1 })
            });
            const cookie = await registerUserAndGetCookie(baseUrl, '13800138113');

            const redeemResult = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
                method: 'POST',
                headers: { cookie },
                body: JSON.stringify({ code: inviteResult.body.invites[0].code })
            });

            assert.equal(redeemResult.response.status, 201);
            assert.match(fs.readFileSync(configPath, 'utf8'), /  - "sk-session-sync"/);
            assert.equal(fs.readdirSync(path.join(tempDir, 'backups')).length, 1);
        }, {
            cliproxyConfigPath: configPath,
            cliproxyConfigBackupDir: path.join(tempDir, 'backups')
        });
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('CLIProxyAPI 入口配置同步失败时兑换事务回滚', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cliproxy-redeem-sync-fail-'));
    try {
        const configPath = path.join(tempDir, 'config.yaml');
        fs.writeFileSync(configPath, 'host: "127.0.0.1"\n');

        await withServer(async ({ baseUrl, db }) => {
            await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
                method: 'POST',
                headers: { 'x-admin-token': 'test-token' },
                body: JSON.stringify({ apiKeys: ['sk-session-sync-fail'] })
            });
            const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
                method: 'POST',
                headers: { 'x-admin-token': 'test-token' },
                body: JSON.stringify({ count: 1 })
            });
            const invite = inviteResult.body.invites[0];
            const cookie = await registerUserAndGetCookie(baseUrl, '13800138114');

            const redeemResult = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
                method: 'POST',
                headers: { cookie },
                body: JSON.stringify({ code: invite.code })
            });

            assert.equal(redeemResult.response.status, 500);
            assert.equal(redeemResult.body.code, 'CLIPROXY_SYNC_FAILED');
            assert.deepEqual(
                db.prepare('SELECT status, redeemed_by_phone FROM invite_codes WHERE code = ?').get(invite.code),
                { status: 'unused', redeemed_by_phone: null }
            );
            assert.deepEqual(
                db.prepare('SELECT status, order_id FROM api_keys WHERE api_key = ?').get('sk-session-sync-fail'),
                { status: 'unused', order_id: null }
            );
            assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders WHERE api_key = ?').get('sk-session-sync-fail').count, 0);
        }, {
            cliproxyConfigPath: configPath,
            cliproxyConfigBackupDir: path.join(tempDir, 'backups')
        });
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
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

test('Shop 数据库包含人民币 nanos 扣费字段', async () => {
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

test('管理员余额接口不再暴露', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);

        const result = await fetch(`${baseUrl}/api/admin/account-balances`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        assert.equal(result.status, 404);
    });
});

test('托管 API key 没有有效订阅时返回订阅必需状态', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139009', 'sk-balance-zero');

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent(order.apiKey)}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });

        assert.equal(status.response.status, 200);
        assert.equal(status.body.managed, true);
        assert.equal(status.body.active, false);
        assert.equal(status.body.status, 'subscription_required');
        assert.equal(status.body.quota.addonBalanceUsdMicros, 0);
    });
});

test('托管 API key 订阅确认后恢复可用', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139010', 'sk-balance-positive');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139010');
        await submitAndApproveSubscription(baseUrl, cookie, 'sub_29_daily_19_usd');

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent(order.apiKey)}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });

        assert.equal(status.response.status, 200);
        assert.equal(status.body.managed, true);
        assert.equal(status.body.active, true);
        assert.equal(status.body.status, 'active');
        assert.equal(status.body.quota.remainingUsdMicros, 19000000);
    });
});

test('usage event 写入后未知模型按 gpt-5.4 人民币 nanos 扣余额并生成用户可见扣费记录', async () => {
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
            model: 'gpt-5.unknown',
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
        const pricing = priceUsageTokens({
            model: event.model,
            requestedAt: event.requested_at,
            failed: event.failed,
            cacheHitInputTokens: event.cache_hit_input_tokens,
            cacheMissInputTokens: event.cache_miss_input_tokens,
            outputTokens: event.output_tokens,
            reasoningTokens: event.reasoning_tokens
        });
        const balanceBeforeNanos = 1000000000;
        const balanceAfterNanos = balanceBeforeNanos - pricing.chargeNanos;

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceNanos, balanceAfterNanos);
        assert.equal(balance.body.balance.balanceAmount, nanosToCnyForTest(balanceAfterNanos));

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
            charge_nanos: pricing.chargeNanos,
            balance_before_nanos: balanceBeforeNanos,
            balance_after_nanos: balanceAfterNanos,
            price_version: pricing.priceVersion,
            charge_cents: pricing.chargeCents,
            balance_before_cents: nanosToBalanceCentsForTest(balanceBeforeNanos),
            balance_after_cents: nanosToBalanceCentsForTest(balanceAfterNanos),
            status: 'charged'
        });

        const ledger = db.prepare(`
SELECT entry_type, amount_cents, amount_nanos, balance_after_cents, balance_after_nanos, related_id
FROM account_ledger_entries
WHERE related_id = ?
`).get('req-charge-001');
        assert.deepEqual(ledger, {
            entry_type: 'api_charge',
            amount_cents: -pricing.chargeCents,
            amount_nanos: -pricing.chargeNanos,
            balance_after_cents: nanosToBalanceCentsForTest(balanceAfterNanos),
            balance_after_nanos: balanceAfterNanos,
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
        const pricing = priceUsageTokens({
            model: 'gpt-5.5',
            requestedAt: '2026-06-10T12:10:00+08:00',
            failed: false,
            cacheHitInputTokens: 700,
            cacheMissInputTokens: 300,
            outputTokens: 50,
            reasoningTokens: 20
        });
        assert.deepEqual(charge, {
            cache_hit_input_tokens: 700,
            cache_miss_input_tokens: 300,
            output_tokens: 50,
            reasoning_tokens: 20,
            charge_nanos: pricing.chargeNanos
        });

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceNanos, 1000000000 - pricing.chargeNanos);
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
        const expectedCharge = priceUsageTokens({
            model: 'gpt-5.4',
            requestedAt: '2026-06-10T12:05:00+08:00',
            failed: false,
            cacheHitInputTokens: 0,
            cacheMissInputTokens: 0,
            outputTokens: 33333
        }).chargeNanos;
        const expectedBalanceNanos = 50000000 - expectedCharge;
        const expectedDebtCents = Math.ceil(Math.abs(expectedBalanceNanos) / nanosPerCent);
        assert.equal(balance.body.balance.balanceCents, nanosToBalanceCentsForTest(expectedBalanceNanos));
        assert.equal(balance.body.balance.balanceNanos, expectedBalanceNanos);
        assert.equal(balance.body.balance.debtCents, expectedDebtCents);
        assert.equal(balance.body.balance.status, 'debt');

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent(order.apiKey)}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(status.body.active, false);
        assert.equal(status.body.status, 'subscription_required');
        assert.equal(status.body.quota.remainingUsdMicros, 0);
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
        const expectedCharge = priceUsageTokens({
            model: 'gpt-5.4',
            requestedAt: event.requested_at,
            failed: false,
            cacheHitInputTokens: 0,
            cacheMissInputTokens: 1,
            outputTokens: 1
        }).chargeNanos;
        assert.equal(balance.body.balance.balanceCents, 99);
        assert.equal(balance.body.balance.balanceNanos, 1000000000 - expectedCharge);
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

test('实时 usage 扣费会追加本地 JSONL 审计日志且不保存完整 API key', async () => {
    const auditLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-charge-audit-'));
    try {
        await withServer(async ({ baseUrl }) => {
            const order = await createRedeemedOrder(baseUrl, '13800139017', 'sk-charge-audit-secret');
            const cookie = await registerUserAndGetCookie(baseUrl, '13800139017');
            await submitAndApproveTopup(baseUrl, cookie, '1');

            const inserted = await usageEventFetch(baseUrl, {
                version: 1,
                request_id: 'req-charge-audit',
                api_key_hash: hashApiKeyForTest(order.apiKey),
                api_key_preview: keyPreviewForTest(order.apiKey),
                provider: 'codex',
                model: 'gpt-5.4',
                endpoint: '/v1/responses',
                success: true,
                failed: false,
                input_tokens: 10,
                cache_hit_input_tokens: 4,
                cache_miss_input_tokens: 6,
                output_tokens: 20,
                total_tokens: 30,
                requested_at: '2026-06-10T12:20:00+08:00'
            });
            assert.equal(inserted.response.status, 201);
        }, { usageEventHmacSecret: 'usage-hmac-secret', shopChargeAuditLogDir: auditLogDir });

        const files = fs.readdirSync(auditLogDir).filter((file) => file.endsWith('.jsonl'));
        assert.equal(files.length, 1);
        assert.match(files[0], /^api-charge-records-\d{4}-\d{2}\.jsonl$/);
        const lines = fs.readFileSync(path.join(auditLogDir, files[0]), 'utf8').trim().split(/\r?\n/);
        assert.equal(lines.length, 1);
        assert.doesNotMatch(lines[0], /sk-charge-audit-secret/);
        const record = JSON.parse(lines[0]);
        assert.equal(record.source, 'realtime');
        assert.equal(record.phone, '13800139017');
        assert.equal(record.usageEventId, 'req-charge-audit');
        assert.equal(record.cacheHitInputTokens, 4);
        assert.equal(record.cacheMissInputTokens, 6);
        assert.equal(record.outputTokens, 20);
        assert.equal(record.chargeNanos, priceUsageTokens({
            model: 'gpt-5.4',
            requestedAt: '2026-06-10T12:20:00+08:00',
            failed: false,
            cacheHitInputTokens: 4,
            cacheMissInputTokens: 6,
            outputTokens: 20
        }).chargeNanos);
    } finally {
        fs.rmSync(auditLogDir, { recursive: true, force: true });
    }
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
        assert.equal(charges.body.charges[0].chargeNanos, priceUsageTokens({
            model: 'gpt-5.4',
            requestedAt: '2026-06-10T12:15:00+08:00',
            failed: false,
            cacheHitInputTokens: 0,
            cacheMissInputTokens: 10,
            outputTokens: 20
        }).chargeNanos);

        const secondLedger = await jsonFetch(`${baseUrl}/api/account/ledger`, {
            headers: { cookie: secondCookie }
        });
        assert.equal(secondLedger.body.entries.length, 0);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('用户 usage summary 返回自己的按周扣费金额和三段构成', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const firstOrder = await createRedeemedOrder(baseUrl, '13800139018', 'sk-weekly-spending-first');
        const secondOrder = await createRedeemedOrder(baseUrl, '13800139019', 'sk-weekly-spending-second');
        const firstCookie = await registerUserAndGetCookie(baseUrl, '13800139018');
        const secondCookie = await registerUserAndGetCookie(baseUrl, '13800139019');
        await submitAndApproveTopup(baseUrl, firstCookie, '10');
        await submitAndApproveTopup(baseUrl, secondCookie, '10');

        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-weekly-current',
            api_key_hash: hashApiKeyForTest(firstOrder.apiKey),
            api_key_preview: keyPreviewForTest(firstOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 1500000,
            cache_hit_input_tokens: 1000000,
            cache_miss_input_tokens: 500000,
            output_tokens: 100000,
            total_tokens: 1600000,
            requested_at: '2026-06-10T12:00:00+08:00'
        });
        db.prepare('UPDATE api_charge_records SET created_at = ? WHERE usage_event_id = ?')
            .run('2026-06-10T12:01:00+08:00', 'req-weekly-current');

        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-weekly-previous',
            api_key_hash: hashApiKeyForTest(firstOrder.apiKey),
            api_key_preview: keyPreviewForTest(firstOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 1000000,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 1000000,
            output_tokens: 0,
            total_tokens: 1000000,
            requested_at: '2026-06-03T12:00:00+08:00'
        });
        db.prepare('UPDATE api_charge_records SET created_at = ? WHERE usage_event_id = ?')
            .run('2026-06-03T12:01:00+08:00', 'req-weekly-previous');

        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-weekly-other-user',
            api_key_hash: hashApiKeyForTest(secondOrder.apiKey),
            api_key_preview: keyPreviewForTest(secondOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 1000000,
            cache_hit_input_tokens: 1000000,
            cache_miss_input_tokens: 0,
            output_tokens: 0,
            total_tokens: 1000000,
            requested_at: '2026-06-10T12:00:00+08:00'
        });
        db.prepare('UPDATE api_charge_records SET created_at = ? WHERE usage_event_id = ?')
            .run('2026-06-10T12:01:00+08:00', 'req-weekly-other-user');

        const result = await jsonFetch(`${baseUrl}/api/account/usage-summary`, {
            headers: { cookie: firstCookie }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.billing.weeklySpending.currentWeekStart, '2026-06-08');
        assert.deepEqual(result.body.billing.weeklySpending.weekStarts, ['2026-06-01', '2026-06-08']);

        const currentWeek = result.body.billing.weeklySpending.weeks['2026-06-08'];
        assert.equal(currentWeek.days.length, 7);
        assert.deepEqual(currentWeek.days.map((day) => day.date), [
            '2026-06-08',
            '2026-06-09',
            '2026-06-10',
            '2026-06-11',
            '2026-06-12',
            '2026-06-13',
            '2026-06-14'
        ]);
        assert.deepEqual(currentWeek.days.map((day) => day.label), ['6/8', '6/9', '6/10', '6/11', '6/12', '6/13', '6/14']);

        const currentDay = currentWeek.days.find((day) => day.date === '2026-06-10');
        assert.equal(currentDay.chargeNanos, 2125000000);
        assert.equal(currentDay.chargeAmount, 2.125);
        assert.deepEqual(currentDay.parts.map((part) => [part.key, part.chargeNanos, part.chargeAmount]), [
            ['cache_hit_input', 25000000, 0.025],
            ['cache_miss_input', 1500000000, 1.5],
            ['output', 600000000, 0.6]
        ]);

        const previousWeek = result.body.billing.weeklySpending.weeks['2026-06-01'];
        assert.equal(previousWeek.days.length, 7);
        assert.equal(previousWeek.days.find((day) => day.date === '2026-06-03').chargeNanos, 3000000000);
    }, { usageEventHmacSecret: 'usage-hmac-secret', now: () => new Date('2026-06-12T12:00:00+08:00') });
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
        const expectedShopPricing = priceUsageTokens({
            model: 'gpt-5.4',
            failed: false,
            cacheHitInputTokens: 0,
            cacheMissInputTokens: 5,
            outputTokens: 10
        });
        assert.equal(result.body.billing.monthChargeNanos, expectedShopPricing.chargeNanos);
        assert.equal(result.body.billing.todayChargeNanos, expectedShopPricing.chargeNanos);
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

test('管理员 usage summary 的 token 今日统计使用 UTC+8 日期边界', async () => {
    await withServer(async ({ baseUrl }) => {
        const previousChinaDayHash = hashApiKeyForTest('sk-summary-china-previous-day');
        const currentChinaDayHash = hashApiKeyForTest('sk-summary-china-current-day');
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-china-previous-day',
            api_key_hash: previousChinaDayHash,
            api_key_preview: 'sk-c...prev',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            total_tokens: 10,
            requested_at: '2026-06-12T23:30:00+08:00'
        });
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-china-current-day',
            api_key_hash: currentChinaDayHash,
            api_key_preview: 'sk-c...today',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            total_tokens: 20,
            requested_at: '2026-06-13T00:10:00+08:00'
        });

        const result = await jsonFetch(`${baseUrl}/api/admin/usage-summary`, {
            headers: { 'x-admin-token': 'test-token' }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.summary.today_tokens, 20);
        assert.equal(result.body.summary.month_tokens, 30);
        assert.equal(result.body.items.find((item) => item.api_key_preview === 'sk-c...prev').today_tokens, 0);
        assert.equal(result.body.items.find((item) => item.api_key_preview === 'sk-c...today').today_tokens, 20);
    }, { usageEventHmacSecret: 'usage-hmac-secret', now: () => new Date('2026-06-13T00:30:00+08:00') });
});

test('管理员 usage summary 收银只统计 Shop 扣费并使用当前命中 token 价格', async () => {
    await withServer(async ({ baseUrl }) => {
        const shopOrder = await createRedeemedOrder(baseUrl, '13800138501', 'sk-summary-shop-revenue');
        const localHash = hashApiKeyForTest('sk-local-revenue');
        await jsonFetch(`${baseUrl}/api/admin/usage-key-profiles`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({
                apiKeyHash: localHash,
                apiKeyPreview: 'sk-l...enue',
                group: 'local',
                phone: '15951875192'
            })
        });

        const requestedAt = new Date().toISOString();
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-shop-revenue',
            api_key_hash: hashApiKeyForTest(shopOrder.apiKey),
            api_key_preview: keyPreviewForTest(shopOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 1000000,
            cached_tokens: 1000000,
            cache_hit_input_tokens: 1000000,
            cache_miss_input_tokens: 0,
            output_tokens: 0,
            total_tokens: 1000000,
            requested_at: requestedAt
        });
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-local-revenue',
            api_key_hash: localHash,
            api_key_preview: 'sk-l...enue',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 0,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 1000000,
            output_tokens: 0,
            total_tokens: 1000000,
            requested_at: requestedAt
        });

        const expectedShopPricing = priceUsageTokens({
            model: 'gpt-5.4',
            failed: false,
            cacheHitInputTokens: 1000000,
            cacheMissInputTokens: 0,
            outputTokens: 0
        });
        assert.equal(expectedShopPricing.chargeNanos, 125000000);

        const result = await jsonFetch(`${baseUrl}/api/admin/usage-summary`, {
            headers: { 'x-admin-token': 'test-token' }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.summary.month_tokens, 2000000);
        assert.equal(result.body.billing.monthChargeNanos, expectedShopPricing.chargeNanos);
        assert.equal(result.body.billing.todayChargeNanos, expectedShopPricing.chargeNanos);
        assert.equal(result.body.billing.cacheHitInputTokens, 1000000);
        assert.equal(result.body.billing.cacheMissInputTokens, 0);
        assert.equal(result.body.billing.outputTokens, 0);
        assert.equal(result.body.billing.recentCharges.length, 1);
        assert.equal(result.body.billing.recentCharges[0].usageEventId, 'req-summary-shop-revenue');
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('管理员 usage summary 返回 Shop 收银构成和用户消费排行且排除 Local', async () => {
    await withServer(async ({ baseUrl }) => {
        const firstOrder = await createRedeemedOrder(baseUrl, '13800138511', 'sk-summary-chart-first');
        const secondOrder = await createRedeemedOrder(baseUrl, '13800138512', 'sk-summary-chart-second');
        const localHash = hashApiKeyForTest('sk-local-chart-revenue');
        await jsonFetch(`${baseUrl}/api/admin/usage-key-profiles`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({
                apiKeyHash: localHash,
                apiKeyPreview: 'sk-l...hart',
                group: 'local',
                phone: '15951875192'
            })
        });

        const requestedAt = new Date().toISOString();
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-chart-first',
            api_key_hash: hashApiKeyForTest(firstOrder.apiKey),
            api_key_preview: keyPreviewForTest(firstOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 1000000,
            cache_hit_input_tokens: 1000000,
            cache_miss_input_tokens: 0,
            output_tokens: 0,
            total_tokens: 1000000,
            requested_at: requestedAt
        });
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-chart-second',
            api_key_hash: hashApiKeyForTest(secondOrder.apiKey),
            api_key_preview: keyPreviewForTest(secondOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.5',
            success: true,
            failed: false,
            input_tokens: 500000,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 500000,
            output_tokens: 100000,
            total_tokens: 600000,
            requested_at: requestedAt
        });
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-chart-local',
            api_key_hash: localHash,
            api_key_preview: 'sk-l...hart',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 1000000,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 1000000,
            output_tokens: 0,
            total_tokens: 1000000,
            requested_at: requestedAt
        });

        const result = await jsonFetch(`${baseUrl}/api/admin/usage-summary`, {
            headers: { 'x-admin-token': 'test-token' }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.billing.todayChargeNanos, 4125000000);
        assert.equal(result.body.billing.monthChargeNanos, 4125000000);
        assert.deepEqual(result.body.billing.todayRevenueParts, [
            { key: 'cache_hit_input', label: '缓存命中输入', tokens: 1000000, chargeNanos: 125000000, chargeAmount: 0.125 },
            { key: 'cache_miss_input', label: '缓存未命中输入', tokens: 500000, chargeNanos: 2500000000, chargeAmount: 2.5 },
            { key: 'output', label: '输出 token', tokens: 100000, chargeNanos: 1500000000, chargeAmount: 1.5 }
        ]);
        assert.deepEqual(result.body.billing.monthRevenueParts, result.body.billing.todayRevenueParts);
        assert.deepEqual(result.body.billing.customerSpendingRankings.today.map((item) => [item.phone, item.chargeNanos, item.chargeAmount]), [
            ['13800138512', 4000000000, 4],
            ['13800138511', 125000000, 0.125]
        ]);
        assert.deepEqual(result.body.billing.customerSpendingRankings.today[0].parts.map((part) => [part.key, part.chargeNanos, part.chargeAmount]), [
            ['cache_hit_input', 0, 0],
            ['cache_miss_input', 2500000000, 2.5],
            ['output', 1500000000, 1.5]
        ]);
        assert.deepEqual(result.body.billing.customerSpendingRankings.today[1].parts.map((part) => [part.key, part.chargeNanos, part.chargeAmount]), [
            ['cache_hit_input', 125000000, 0.125],
            ['cache_miss_input', 0, 0],
            ['output', 0, 0]
        ]);
        assert.deepEqual(result.body.billing.customerSpendingRankings.month.map((item) => [item.phone, item.chargeNanos, item.chargeAmount]), [
            ['13800138512', 4000000000, 4],
            ['13800138511', 125000000, 0.125]
        ]);
        assert.equal(
            result.body.billing.customerSpendingRankings.month.some((item) => item.phone === '15951875192'),
            false
        );
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('管理员 usage summary 今日收银按 usage 发生时间统计而不是补扣时间', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const delayedOrder = await createRedeemedOrder(baseUrl, '13800138516', 'sk-summary-delayed-charge');
        const todayOrder = await createRedeemedOrder(baseUrl, '13800138517', 'sk-summary-today-charge');

        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-delayed-charge',
            api_key_hash: hashApiKeyForTest(delayedOrder.apiKey),
            api_key_preview: keyPreviewForTest(delayedOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 1000000,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 1000000,
            output_tokens: 0,
            total_tokens: 1000000,
            requested_at: '2026-06-12T12:00:00+08:00'
        });
        db.prepare('UPDATE api_charge_records SET created_at = ? WHERE usage_event_id = ?')
            .run('2026-06-13T16:05:00+08:00', 'req-summary-delayed-charge');

        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-summary-today-charge',
            api_key_hash: hashApiKeyForTest(todayOrder.apiKey),
            api_key_preview: keyPreviewForTest(todayOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 0,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 100000,
            total_tokens: 100000,
            requested_at: '2026-06-13T10:00:00+08:00'
        });
        db.prepare('UPDATE api_charge_records SET created_at = ? WHERE usage_event_id = ?')
            .run('2026-06-13T16:10:00+08:00', 'req-summary-today-charge');

        const result = await jsonFetch(`${baseUrl}/api/admin/usage-summary`, {
            headers: { 'x-admin-token': 'test-token' }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.billing.todayChargeNanos, 1500000000);
        assert.equal(result.body.billing.monthChargeNanos, 4500000000);
        assert.deepEqual(result.body.billing.customerSpendingRankings.today.map((item) => item.phone), ['13800138517']);
        assert.deepEqual(result.body.billing.customerSpendingRankings.month.map((item) => item.phone), ['13800138516', '13800138517']);
    }, { usageEventHmacSecret: 'usage-hmac-secret', now: () => new Date('2026-06-13T18:00:00+08:00') });
});

test('管理员 usage summary 收银构成按扣费记录价格版本拆分历史金额', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const order = await createRedeemedOrder(baseUrl, '13800138513', 'sk-summary-chart-old-price');
        const cacheHit10xOrder = await createRedeemedOrder(baseUrl, '13800138514', 'sk-summary-chart-cache-hit-10x-price');
        const gpt55Order = await createRedeemedOrder(baseUrl, '13800138515', 'sk-summary-chart-gpt-55-price');
        const createdAt = new Date().toISOString();
        db.prepare(`
INSERT INTO api_charge_records (
  id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
  cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
  price_version, charge_cents, charge_nanos, balance_before_cents, balance_before_nanos,
  balance_after_cents, balance_after_nanos, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
            'CHARGE-OLD-PRICE',
            '13800138513',
            'req-summary-chart-old-price',
            hashApiKeyForTest(order.apiKey),
            'gpt-5.4',
            1000000,
            0,
            1000000,
            0,
            0,
            1000000,
            'deepseek-v4-pro-rmb-20260424',
            3,
            25000000,
            100,
            1000000000,
            97,
            975000000,
            'charged',
            createdAt
        );
        db.prepare(`
INSERT INTO api_charge_records (
  id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
  cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
  price_version, charge_cents, charge_nanos, balance_before_cents, balance_before_nanos,
  balance_after_cents, balance_after_nanos, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
            'CHARGE-CACHE-HIT-10X-OUTPUT',
            '13800138514',
            'req-summary-chart-cache-hit-10x-output',
            hashApiKeyForTest(cacheHit10xOrder.apiKey),
            'gpt-5.4',
            0,
            100000,
            0,
            0,
            0,
            100000,
            'deepseek-v4-pro-rmb-20260612-cache-hit-10x',
            60,
            600000000,
            100,
            1000000000,
            40,
            400000000,
            'charged',
            createdAt
        );
        db.prepare(`
INSERT INTO api_charge_records (
  id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
  cache_hit_input_tokens, cache_miss_input_tokens, reasoning_tokens, total_tokens,
  price_version, charge_cents, charge_nanos, balance_before_cents, balance_before_nanos,
  balance_after_cents, balance_after_nanos, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
            'CHARGE-GPT-55-PRICE',
            '13800138515',
            'req-summary-chart-gpt-55-price',
            hashApiKeyForTest(gpt55Order.apiKey),
            'gpt-5.5',
            1000000,
            100000,
            0,
            1000000,
            0,
            1100000,
            'gpt-5.5-rmb-20260613',
            800,
            8000000000,
            1000,
            10000000000,
            200,
            2000000000,
            'charged',
            createdAt
        );

        const result = await jsonFetch(`${baseUrl}/api/admin/usage-summary`, {
            headers: { 'x-admin-token': 'test-token' }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.billing.monthChargeNanos, 8625000000);
        assert.deepEqual(result.body.billing.monthRevenueParts, [
            { key: 'cache_hit_input', label: '缓存命中输入', tokens: 1000000, chargeNanos: 25000000, chargeAmount: 0.025 },
            { key: 'cache_miss_input', label: '缓存未命中输入', tokens: 1000000, chargeNanos: 5000000000, chargeAmount: 5 },
            { key: 'output', label: '输出 token', tokens: 200000, chargeNanos: 3600000000, chargeAmount: 3.6 }
        ]);
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

test('Sub2API migration disables legacy invite and API key issuance endpoints', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        const adminCookie = adminLogin.response.headers.get('set-cookie') || '';
        const accountCookie = await registerUserAndGetCookie(baseUrl, '13800138777');

        const cases = [
            {
                name: 'account invite redeem',
                path: '/api/account/invites/redeem',
                headers: { cookie: accountCookie },
                body: { code: 'YUI-111111-222222' }
            },
            {
                name: 'token invite create',
                path: '/api/admin/invites',
                headers: { 'x-admin-token': 'test-token' },
                body: { count: 1 }
            },
            {
                name: 'token api key import',
                path: '/api/admin/api-keys',
                headers: { 'x-admin-token': 'test-token' },
                body: { apiKeys: ['sk-disabled-token-import'] }
            },
            {
                name: 'session invite create',
                path: '/api/admin/session-invites',
                headers: { cookie: adminCookie },
                body: { count: 1 }
            },
            {
                name: 'session api key import',
                path: '/api/admin/session-api-keys',
                headers: { cookie: adminCookie },
                body: { apiKeysText: 'sk-disabled-session-import' }
            },
            {
                name: 'legacy public invite redeem',
                path: '/api/invites/redeem',
                headers: {},
                body: { phone: '13800138778', code: 'YUI-111111-222222' }
            }
        ];

        for (const item of cases) {
            const result = await jsonFetch(`${baseUrl}${item.path}`, {
                method: 'POST',
                headers: item.headers,
                body: JSON.stringify(item.body)
            });
            assert.equal(result.response.status, 410, item.name);
            assert.equal(result.body.code, 'SHOP_LEGACY_KEY_ISSUANCE_DISABLED', item.name);
        }
    }, {
        legacyKeyIssuanceDisabled: true
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

test('Shop 入口和指南公开可访问，账户相关页面未登录仍跳转登录页', async () => {
    await withServer(async ({ baseUrl }) => {
        const protectedPaths = [
            '/shop/redeem/',
            '/shop/query/',
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

        const home = await fetch(`${baseUrl}/shop/`, { redirect: 'manual' });
        assert.equal(home.status, 200);
        assert.match(await home.text(), /Sub2API gateway/);

        const guide = await fetch(`${baseUrl}/shop/guide/`, { redirect: 'manual' });
        assert.equal(guide.status, 200);
        assert.match(await guide.text(), /Sub2API 配置使用方法/);
    });
});

test('Shop 首页使用配置的 Sub2API 公网入口链接', async () => {
    await withServer(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/shop/`, { redirect: 'manual' });
        assert.equal(response.status, 200);
        assert.match(await response.text(), /href="https:\/\/sub2api\.example\.com"/);
    }, {
        sub2apiPublicUrl: 'https://sub2api.example.com/'
    });
});

test('已登录普通用户访问 Shop 首页保持入口页，查询页进入 Account', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138693');

        const home = await fetch(`${baseUrl}/shop/`, {
            redirect: 'manual',
            headers: { cookie }
        });
        assert.equal(home.status, 200);
        assert.match(await home.text(), /Sub2API gateway/);

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
        const ownPricing = priceUsageTokens({
            model: 'gpt-5.4',
            failed: false,
            cacheHitInputTokens: 4,
            cacheMissInputTokens: 6,
            outputTokens: 20,
            reasoningTokens: 3
        });
        assert.equal(result.body.billing.monthChargeNanos, ownPricing.chargeNanos);
        assert.equal(result.body.billing.todayChargeNanos, ownPricing.chargeNanos);
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

test('Account 模型总览接口使用托管 API key 探测模型并按官方美元价格返回', async () => {
    let capturedModelRequest = null;
    await withServer(async ({ baseUrl }) => {
        const unauthorized = await fetch(`${baseUrl}/api/account/model-overview`);
        assert.equal(unauthorized.status, 401);
        assert.deepEqual(await unauthorized.json(), {
            code: 'ACCOUNT_LOGIN_REQUIRED',
            message: '请先登录。'
        });

        const cookie = await registerUserAndGetCookie(baseUrl, '13800138696');
        const apiKeyResult = await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-model-overview-test'] })
        });
        assert.equal(apiKeyResult.response.status, 201);
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        const redeemResult = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ code: inviteResult.body.invites[0].code })
        });
        assert.equal(redeemResult.response.status, 201);

        const result = await fetch(`${baseUrl}/api/account/model-overview`, {
            headers: { cookie }
        });
        assert.equal(result.status, 200);
        const body = await result.json();

        assert.equal(body.source, 'live');
        assert.ok(body.checkedAt);
        assert.equal(capturedModelRequest.url, 'http://cliproxy.test/v1/models');
        assert.equal(capturedModelRequest.authorization, 'Bearer sk-model-overview-test');

        const mini = body.models.find((model) => model.id === 'gpt-5.4-mini');
        assert.equal(mini.available, true);
        assert.equal(mini.priceModel, 'gpt-5.4');
        assert.equal(mini.usesDefaultPrice, true);
        assert.equal(mini.cacheHitInputUsdPerMillion, 0.25);
        assert.equal(mini.cacheMissInputUsdPerMillion, 2.5);
        assert.equal(mini.outputUsdPerMillion, 15);

        const gpt55 = body.models.find((model) => model.id === 'gpt-5.5');
        assert.equal(gpt55.available, true);
        assert.equal(gpt55.priceModel, 'gpt-5.5');
        assert.equal(gpt55.usesDefaultPrice, false);
        assert.equal(gpt55.cacheHitInputUsdPerMillion, 0.5);
        assert.equal(gpt55.cacheMissInputUsdPerMillion, 5);
        assert.equal(gpt55.outputUsdPerMillion, 30);
    }, {
        modelListBaseUrl: 'http://cliproxy.test/v1',
        modelListFetch: async (url, requestOptions = {}) => {
            capturedModelRequest = {
                url,
                authorization: requestOptions.headers?.Authorization
            };
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    data: [
                        { id: 'gpt-5.4-mini' },
                        { id: 'gpt-5.5' }
                    ]
                })
            };
        }
    });
});

test('Account 模型总览接口会跳过不可用托管 API key 继续探测同账号其他 key', async () => {
    const requestedAuthorizations = [];
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138697');
        const apiKeyResult = await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-model-overview-good', 'sk-model-overview-bad'] })
        });
        assert.equal(apiKeyResult.response.status, 201);
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 2 })
        });
        const goodRedeem = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ code: inviteResult.body.invites[0].code })
        });
        assert.equal(goodRedeem.response.status, 201);
        const badRedeem = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ code: inviteResult.body.invites[1].code })
        });
        assert.equal(badRedeem.response.status, 201);

        const result = await fetch(`${baseUrl}/api/account/model-overview`, {
            headers: { cookie }
        });
        assert.equal(result.status, 200);
        const body = await result.json();

        assert.equal(requestedAuthorizations.length, 2);
        assert.equal(body.source, 'live');
        assert.ok(body.models.some((model) => model.id === 'gpt-5.5'));
    }, {
        modelListBaseUrl: 'http://cliproxy.test/v1',
        modelListFetch: async (url, requestOptions = {}) => {
            requestedAuthorizations.push(requestOptions.headers?.Authorization);
            if (requestedAuthorizations.length === 2) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: [{ id: 'gpt-5.5' }] })
                };
            }
            return {
                ok: false,
                status: 401,
                json: async () => ({ error: 'Invalid API key' })
            };
        }
    });
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
        await submitAndApproveSubscription(baseUrl, cookie, 'sub_29_daily_19_usd');

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
        await submitAndApproveSubscription(baseUrl, cookie, 'sub_29_daily_19_usd');

        const active = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-active-status`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(active.response.status, 200);
        assert.equal(active.body.managed, true);
        assert.equal(active.body.active, true);
        assert.equal(active.body.status, 'active');
        assert.equal(active.body.quota.remainingUsdMicros, 19000000);
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

test('订阅池 MVP 数据表和默认套餐存在', async () => {
    await withServer(async ({ db }) => {
        const tables = [
            'subscription_plans',
            'account_subscriptions',
            'subscription_orders',
            'subscription_refund_requests',
            'account_addon_balances',
            'account_addon_ledger_entries',
            'api_usd_charge_records'
        ].filter((tableName) => db.prepare(`
SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?
`).get(tableName));
        assert.deepEqual(tables, [
            'subscription_plans',
            'account_subscriptions',
            'subscription_orders',
            'subscription_refund_requests',
            'account_addon_balances',
            'account_addon_ledger_entries',
            'api_usd_charge_records'
        ]);

        const plans = db.prepare(`
SELECT id, monthly_price_cents, daily_quota_usd_micros
FROM subscription_plans
ORDER BY monthly_price_cents ASC
`).all();
        assert.deepEqual(plans, [
            { id: 'sub_29_daily_19_usd', monthly_price_cents: 2900, daily_quota_usd_micros: 19000000 },
            { id: 'sub_39_daily_29_usd', monthly_price_cents: 3900, daily_quota_usd_micros: 29000000 },
            { id: 'sub_59_daily_49_usd', monthly_price_cents: 5900, daily_quota_usd_micros: 49000000 }
        ]);
    });
});

test('用户选择套餐提交订单，管理员审批后 Account 展示会员额度', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138901');
        const order = await submitSubscriptionOrder(baseUrl, cookie, 'sub_39_daily_29_usd');
        assert.equal(order.status, 'pending');
        assert.equal(order.planId, 'sub_39_daily_29_usd');
        assert.equal(order.amountCents, 3900);

        const approved = await approveSubscriptionOrder(baseUrl, order.id);
        assert.equal(approved.subscription.planId, 'sub_39_daily_29_usd');
        assert.equal(approved.subscription.dailyQuotaUsdMicros, 29000000);

        const state = await jsonFetch(`${baseUrl}/api/account/subscription-state`, {
            headers: { cookie }
        });
        assert.equal(state.response.status, 200);
        assert.equal(state.body.subscription.planId, 'sub_39_daily_29_usd');
        assert.equal(state.body.quota.dailyQuotaUsdMicros, 29000000);
        assert.equal(state.body.quota.dailyRemainingUsdMicros, 29000000);
        assert.equal(state.body.quota.addonBalanceUsdMicros, 0);
        assert.equal(state.body.quota.remainingUsdMicros, 29000000);

        const row = db.prepare('SELECT phone, plan_id, status FROM account_subscriptions WHERE phone = ?').get('13800138901');
        assert.deepEqual(row, { phone: '13800138901', plan_id: 'sub_39_daily_29_usd', status: 'active' });
    }, { now: () => new Date('2026-06-16T10:00:00+08:00') });
});

test('已有有效套餐时不能再次提交或审批套餐订单覆盖当前套餐', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138906');
        const firstOrder = await submitSubscriptionOrder(baseUrl, cookie, 'sub_59_daily_49_usd');
        const secondOrder = await submitSubscriptionOrder(baseUrl, cookie, 'sub_29_daily_19_usd');

        await approveSubscriptionOrder(baseUrl, firstOrder.id);

        const duplicateSubmit = await jsonFetch(`${baseUrl}/api/account/subscription-orders`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({
                planId: 'sub_29_daily_19_usd',
                paymentMethod: 'wechat',
                paymentNote: 'duplicate subscription'
            })
        });
        assert.equal(duplicateSubmit.response.status, 409);
        assert.equal(duplicateSubmit.body.code, 'ACTIVE_SUBSCRIPTION_EXISTS');
        assert.match(duplicateSubmit.body.message, /当前已经有套餐/);

        const duplicateApprove = await jsonFetch(`${baseUrl}/api/admin/subscription-orders/${encodeURIComponent(secondOrder.id)}/approve`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ adminNote: 'should not override' })
        });
        assert.equal(duplicateApprove.response.status, 409);
        assert.equal(duplicateApprove.body.code, 'ACTIVE_SUBSCRIPTION_EXISTS');

        const state = await jsonFetch(`${baseUrl}/api/account/subscription-state`, {
            headers: { cookie }
        });
        assert.equal(state.body.subscription.planId, 'sub_59_daily_49_usd');
        assert.equal(state.body.quota.dailyQuotaUsdMicros, 49000000);
    }, { now: () => new Date('2026-06-16T10:30:00+08:00') });
});

test('用户购买加量包后长期余额进入 Account 状态并且套餐过期后续费不清零', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138902');
        await submitAndApproveSubscription(baseUrl, cookie, 'sub_29_daily_19_usd');
        const addonOrder = await submitAndApproveAddon(baseUrl, cookie, 5);
        assert.equal(addonOrder.quotaUsdMicros, 5000000);

        let state = await jsonFetch(`${baseUrl}/api/account/subscription-state`, {
            headers: { cookie }
        });
        assert.equal(state.body.quota.addonBalanceUsdMicros, 5000000);
        assert.equal(state.body.quota.remainingUsdMicros, 24000000);

        db.prepare(`
UPDATE account_subscriptions
SET expires_at = ?, updated_at = ?
WHERE phone = ?
`).run('2026-06-16T10:30:00+08:00', '2026-06-16T10:30:00+08:00', '13800138902');

        await submitAndApproveSubscription(baseUrl, cookie, 'sub_59_daily_49_usd');
        state = await jsonFetch(`${baseUrl}/api/account/subscription-state`, {
            headers: { cookie }
        });
        assert.equal(state.body.subscription.planId, 'sub_59_daily_49_usd');
        assert.equal(state.body.quota.dailyQuotaUsdMicros, 49000000);
        assert.equal(state.body.quota.addonBalanceUsdMicros, 5000000);
    }, { now: () => new Date('2026-06-16T11:00:00+08:00') });
});

test('未开通套餐时不能提交加量包订单', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138905');

        const result = await jsonFetch(`${baseUrl}/api/account/addon-orders`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: 5, paymentMethod: 'alipay', paymentNote: 'no subscription' })
        });

        assert.equal(result.response.status, 409);
        assert.equal(result.body.code, 'SUBSCRIPTION_REQUIRED_FOR_ADDON');
        assert.match(result.body.message, /先开通套餐/);
    }, { now: () => new Date('2026-06-16T11:30:00+08:00') });
});

test('用户申请退款后管理员批准会立即取消套餐并让 API key 不可用', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const order = await createRedeemedOrder(baseUrl, '13800138907', 'sk-subscription-refund-38907');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138907');
        const apiKeyHash = hashApiKeyForTest(order.apiKey);
        await submitAndApproveSubscription(baseUrl, cookie, 'sub_59_daily_49_usd');
        db.prepare(`
UPDATE account_subscriptions
SET started_at = ?, expires_at = ?, updated_at = ?
WHERE phone = ? AND status = 'active'
`).run(
            '2026-06-16T10:00:00+08:00',
            '2026-07-16T10:00:00+08:00',
            '2026-06-16T10:00:00+08:00',
            '13800138907'
        );

        const refund = await submitSubscriptionRefundRequest(baseUrl, cookie);
        assert.equal(refund.status, 'pending');
        assert.equal(refund.planId, 'sub_59_daily_49_usd');
        assert.equal(refund.planAmountCents, 5900);
        assert.equal(refund.periodDays, 30);
        assert.equal(refund.remainingDays, 20);
        assert.equal(refund.refundAmountCents, 3933);

        const duplicate = await jsonFetch(`${baseUrl}/api/account/subscription-refund-requests`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({})
        });
        assert.equal(duplicate.response.status, 409);
        assert.equal(duplicate.body.code, 'REFUND_REQUEST_PENDING');

        const adminList = await jsonFetch(`${baseUrl}/api/admin/subscription-refund-requests`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        assert.equal(adminList.response.status, 200);
        assert.equal(adminList.body.refundRequests[0].id, refund.id);
        assert.equal(adminList.body.refundRequests[0].refundAmountCents, 3933);

        const approved = await jsonFetch(`${baseUrl}/api/admin/subscription-refund-requests/${encodeURIComponent(refund.id)}/approve`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ adminNote: 'refund approved' })
        });
        assert.equal(approved.response.status, 200);
        assert.equal(approved.body.refundRequest.status, 'approved');
        assert.equal(approved.body.subscription.status, 'cancelled');

        const subscriptionRow = db.prepare('SELECT status FROM account_subscriptions WHERE phone = ?').get('13800138907');
        assert.equal(subscriptionRow.status, 'cancelled');

        const state = await jsonFetch(`${baseUrl}/api/account/subscription-state`, {
            headers: { cookie }
        });
        assert.equal(state.body.subscription, null);
        assert.equal(state.body.quota.code, 'subscription_required');

        const keyStatus = await jsonFetch(`${baseUrl}/api/internal/api-keys/status`, {
            method: 'POST',
            headers: { 'x-internal-token': 'internal-test-token' },
            body: JSON.stringify({ apiKeyHash })
        });
        assert.equal(keyStatus.body.active, false);
        assert.equal(keyStatus.body.status, 'subscription_required');
    }, { now: () => new Date('2026-06-26T10:00:00+08:00') });
});

test('管理员拒绝退款后套餐继续有效', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138908');
        await submitAndApproveSubscription(baseUrl, cookie, 'sub_29_daily_19_usd');
        const refund = await submitSubscriptionRefundRequest(baseUrl, cookie);

        const rejected = await jsonFetch(`${baseUrl}/api/admin/subscription-refund-requests/${encodeURIComponent(refund.id)}/reject`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ adminNote: 'refund rejected' })
        });
        assert.equal(rejected.response.status, 200);
        assert.equal(rejected.body.refundRequest.status, 'rejected');
        assert.equal(rejected.body.subscription.status, 'active');

        const subscriptionRow = db.prepare('SELECT status FROM account_subscriptions WHERE phone = ?').get('13800138908');
        assert.equal(subscriptionRow.status, 'active');

        const state = await jsonFetch(`${baseUrl}/api/account/subscription-state`, {
            headers: { cookie }
        });
        assert.equal(state.body.subscription.planId, 'sub_29_daily_19_usd');
        assert.equal(state.body.quota.code, 'active');
    }, { now: () => new Date('2026-06-20T09:00:00+08:00') });
});

test('API key 状态和 usage 扣费按订阅池美元额度执行', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const order = await createRedeemedOrder(baseUrl, '13800138903', 'sk-subscription-mvp-38903');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138903');
        const apiKeyHash = hashApiKeyForTest(order.apiKey);

        const beforeSubscription = await jsonFetch(`${baseUrl}/api/internal/api-keys/status`, {
            method: 'POST',
            headers: { 'x-internal-token': 'internal-test-token' },
            body: JSON.stringify({ apiKeyHash })
        });
        assert.equal(beforeSubscription.body.active, false);
        assert.equal(beforeSubscription.body.status, 'subscription_required');

        await submitAndApproveSubscription(baseUrl, cookie, 'sub_29_daily_19_usd');
        await submitAndApproveAddon(baseUrl, cookie, 5);

        const active = await jsonFetch(`${baseUrl}/api/internal/api-keys/status`, {
            method: 'POST',
            headers: { 'x-internal-token': 'internal-test-token' },
            body: JSON.stringify({ apiKeyHash })
        });
        assert.equal(active.body.active, true);
        assert.equal(active.body.quota.remainingUsdMicros, 24000000);

        await usageEventFetch(baseUrl, {
            request_id: 'req-usd-daily-first',
            api_key_hash: apiKeyHash,
            api_key_preview: order.apiKeyPreview,
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 0,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 1200000,
            total_tokens: 1200000,
            requested_at: '2026-06-16T18:03:00+08:00'
        });
        await usageEventFetch(baseUrl, {
            request_id: 'req-usd-addon-second',
            api_key_hash: apiKeyHash,
            api_key_preview: order.apiKeyPreview,
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 0,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 200000,
            total_tokens: 200000,
            requested_at: '2026-06-16T18:04:00+08:00'
        });

        const records = db.prepare(`
SELECT usage_event_id, charge_usd_micros, daily_quota_deducted_usd_micros, addon_deducted_usd_micros, addon_balance_after_usd_micros
FROM api_usd_charge_records
ORDER BY created_at ASC, rowid ASC
`).all();
        assert.deepEqual(records, [
            {
                usage_event_id: 'req-usd-daily-first',
                charge_usd_micros: 18000000,
                daily_quota_deducted_usd_micros: 18000000,
                addon_deducted_usd_micros: 0,
                addon_balance_after_usd_micros: 5000000
            },
            {
                usage_event_id: 'req-usd-addon-second',
                charge_usd_micros: 3000000,
                daily_quota_deducted_usd_micros: 1000000,
                addon_deducted_usd_micros: 2000000,
                addon_balance_after_usd_micros: 3000000
            }
        ]);

        const state = await jsonFetch(`${baseUrl}/api/account/subscription-state`, {
            headers: { cookie }
        });
        assert.equal(state.body.quota.dailyRemainingUsdMicros, 0);
        assert.equal(state.body.quota.addonBalanceUsdMicros, 3000000);
        assert.equal(state.body.quota.remainingUsdMicros, 3000000);

        const users = await jsonFetch(`${baseUrl}/api/admin/subscription-users`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        assert.equal(users.response.status, 200);
        const userItem = users.body.items.find((item) => item.phone === '13800138903');
        assert.ok(userItem);
        assert.equal(userItem.planId, 'sub_29_daily_19_usd');
        assert.equal(userItem.dailyRemainingUsdMicros, 0);
        assert.equal(userItem.addonBalanceUsdMicros, 3000000);

        const logs = await jsonFetch(`${baseUrl}/api/admin/usd-charges`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        assert.equal(logs.response.status, 200);
        assert.equal(logs.charges?.length ?? logs.body.charges.length, logs.body.charges.length);
        assert.equal(logs.body.charges[0].usageEventId, 'req-usd-addon-second');
        assert.equal(logs.body.charges[0].addonDeductedUsdMicros, 2000000);
    }, {
        usageEventHmacSecret: 'usage-hmac-secret',
        now: () => new Date('2026-06-16T18:02:00+08:00')
    });
});

test('订阅开通前发生的 usage 不消耗订阅池美元额度', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const order = await createRedeemedOrder(baseUrl, '13800138904', 'sk-subscription-mvp-38904');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138904');
        const apiKeyHash = hashApiKeyForTest(order.apiKey);

        await submitAndApproveSubscription(baseUrl, cookie, 'sub_29_daily_19_usd');
        await usageEventFetch(baseUrl, {
            request_id: 'req-usd-before-subscription',
            api_key_hash: apiKeyHash,
            api_key_preview: order.apiKeyPreview,
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 0,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 100000,
            total_tokens: 100000,
            requested_at: '2026-06-15T23:59:00+08:00'
        });

        assert.equal(
            db.prepare('SELECT COUNT(*) AS count FROM api_usd_charge_records WHERE usage_event_id = ?')
                .get('req-usd-before-subscription').count,
            0
        );

        const state = await jsonFetch(`${baseUrl}/api/account/subscription-state`, {
            headers: { cookie }
        });
        assert.equal(state.body.quota.dailyRemainingUsdMicros, 19000000);
        assert.equal(state.body.quota.addonBalanceUsdMicros, 0);
    }, {
        usageEventHmacSecret: 'usage-hmac-secret',
        now: () => new Date('2026-06-16T10:00:00+08:00')
    });
});

test('管理员账号进入用户额度监控并固定使用 59 元套餐额度', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);

        const users = await jsonFetch(`${baseUrl}/api/admin/subscription-users`, {
            headers: { 'x-admin-token': 'test-token' }
        });

        assert.equal(users.response.status, 200);
        const adminItem = users.body.items.find((item) => item.phone === '15951875192');
        assert.ok(adminItem);
        assert.equal(adminItem.planId, 'sub_59_daily_49_usd');
        assert.equal(adminItem.planName, '59 元订阅池');
        assert.equal(adminItem.active, true);
        assert.equal(adminItem.status, 'active');
        assert.equal(adminItem.dailyQuotaUsdMicros, 49000000);
        assert.equal(adminItem.dailyUsedUsdMicros, 0);
        assert.equal(adminItem.dailyRemainingUsdMicros, 49000000);
        assert.equal(adminItem.remainingUsdMicros, 49000000);
        assert.equal(users.body.summary.userCount, 1);
        assert.equal(users.body.summary.activeUserCount, 1);
    }, { now: () => new Date('2026-06-17T10:00:00+08:00') });
});

test('管理员 local usage key 消耗固定 59 元套餐的每日美元额度', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const apiKeyHash = hashApiKeyForTest('sk-admin-local-subscription-quota');

        const profile = await jsonFetch(`${baseUrl}/api/admin/usage-key-profiles`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({
                apiKeyHash,
                apiKeyPreview: 'sk-a...uota',
                group: 'local',
                phone: '15951875192'
            })
        });
        assert.equal(profile.response.status, 201);

        await usageEventFetch(baseUrl, {
            request_id: 'req-admin-local-usd-quota',
            api_key_hash: apiKeyHash,
            api_key_preview: 'sk-a...uota',
            provider: 'codex',
            model: 'gpt-5.5',
            success: true,
            failed: false,
            input_tokens: 0,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 100000,
            total_tokens: 100000,
            requested_at: '2026-06-17T10:05:00+08:00'
        });

        const record = db.prepare(`
SELECT phone, usage_event_id, charge_usd_micros, daily_quota_deducted_usd_micros, addon_deducted_usd_micros, quota_date
FROM api_usd_charge_records
WHERE usage_event_id = ?
`).get('req-admin-local-usd-quota');
        assert.deepEqual(record, {
            phone: '15951875192',
            usage_event_id: 'req-admin-local-usd-quota',
            charge_usd_micros: 3000000,
            daily_quota_deducted_usd_micros: 3000000,
            addon_deducted_usd_micros: 0,
            quota_date: '2026-06-17'
        });

        const users = await jsonFetch(`${baseUrl}/api/admin/subscription-users`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        const adminItem = users.body.items.find((item) => item.phone === '15951875192');
        assert.ok(adminItem);
        assert.equal(adminItem.dailyUsedUsdMicros, 3000000);
        assert.equal(adminItem.dailyRemainingUsdMicros, 46000000);
    }, {
        usageEventHmacSecret: 'usage-hmac-secret',
        now: () => new Date('2026-06-17T10:00:00+08:00')
    });
});

test('管理员超过 59 元套餐每日美元额度后仍保持可用', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const order = await createRedeemedOrder(baseUrl, '15951875192', 'sk-admin-managed-unlimited');
        const apiKeyHash = hashApiKeyForTest(order.apiKey);

        await usageEventFetch(baseUrl, {
            request_id: 'req-admin-over-daily-quota',
            api_key_hash: apiKeyHash,
            api_key_preview: order.apiKeyPreview,
            provider: 'codex',
            model: 'gpt-5.5',
            success: true,
            failed: false,
            input_tokens: 0,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 2000000,
            total_tokens: 2000000,
            requested_at: '2026-06-17T10:10:00+08:00'
        });

        const record = db.prepare(`
SELECT phone, charge_usd_micros, daily_quota_deducted_usd_micros, overrun_usd_micros
FROM api_usd_charge_records
WHERE usage_event_id = ?
`).get('req-admin-over-daily-quota');
        assert.deepEqual(record, {
            phone: '15951875192',
            charge_usd_micros: 60000000,
            daily_quota_deducted_usd_micros: 49000000,
            overrun_usd_micros: 11000000
        });

        const users = await jsonFetch(`${baseUrl}/api/admin/subscription-users`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        const adminItem = users.body.items.find((item) => item.phone === '15951875192');
        assert.ok(adminItem);
        assert.equal(adminItem.active, true);
        assert.equal(adminItem.status, 'active');
        assert.equal(adminItem.dailyUsedUsdMicros, 49000000);
        assert.equal(adminItem.dailyRemainingUsdMicros, 0);
        assert.equal(adminItem.remainingUsdMicros, 0);

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status`, {
            method: 'POST',
            headers: { 'x-internal-token': 'internal-test-token' },
            body: JSON.stringify({ apiKeyHash })
        });
        assert.equal(status.response.status, 200);
        assert.equal(status.body.active, true);
        assert.equal(status.body.status, 'active');
        assert.equal(status.body.quota.dailyRemainingUsdMicros, 0);
    }, {
        usageEventHmacSecret: 'usage-hmac-secret',
        now: () => new Date('2026-06-17T10:00:00+08:00')
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
