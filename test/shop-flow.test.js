const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createShopApp } = require('../server');

async function withServer(run, appOptions = {}) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yui-shop-test-'));
    const dbPath = path.join(tempDir, 'shop.sqlite');
    const { app, db } = createShopApp({
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
        await run({ baseUrl, db, dbPath });
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

async function jsonFetch(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const body = await response.json();
    return { response, body };
}

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

        const queryResult = await jsonFetch(`${baseUrl}/api/orders?phone=13800138000`);
        assert.equal(queryResult.response.status, 200);
        assert.equal(queryResult.body.orders.length, 1);
        assert.equal(queryResult.body.orders[0].apiKey, 'sk-test-a');
    });
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

test('API key 结果页需要有效订单 token 才能访问', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const blocked = await fetch(`${baseUrl}/shop/key/`, { redirect: 'manual' });
        assert.equal(blocked.status, 302);
        assert.equal(blocked.headers.get('location'), '/shop/redeem/');

        const invalid = await fetch(`${baseUrl}/shop/key/`, {
            redirect: 'manual',
            headers: { cookie: 'yui_shop_result_token=rst_invalid' }
        });
        assert.equal(invalid.status, 302);
        assert.equal(invalid.headers.get('location'), '/shop/redeem/');

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
        const token = db.prepare('SELECT result_token FROM orders WHERE phone = ?').get('13800138004').result_token;
        assert.match(redeemResult.response.headers.get('set-cookie') || '', new RegExp(`yui_shop_result_token=${token}`));

        const allowed = await fetch(`${baseUrl}/shop/key/`, {
            headers: { cookie: `yui_shop_result_token=${token}` }
        });
        assert.equal(allowed.status, 200);
        assert.match(await allowed.text(), /API key 已生成/);
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

test('API 响应使用 no-store 且频繁查询会触发限流', async () => {
    await withServer(async ({ baseUrl }) => {
        const first = await jsonFetch(`${baseUrl}/api/orders?phone=13800138999`);
        assert.equal(first.response.status, 200);
        assert.equal(first.response.headers.get('cache-control'), 'no-store');

        let limited = null;
        for (let index = 0; index < 70; index += 1) {
            const result = await jsonFetch(`${baseUrl}/api/orders?phone=13800138999`);
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

test('手机号查询会持久展示已过期订单', async () => {
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
            'Codex 每月额度',
            30,
            '2000-01-01T00:00:00.000Z',
            '2000-02-01T00:00:00.000Z',
            'rst_expired_keep_visible'
        );

        const result = await jsonFetch(`${baseUrl}/api/orders?phone=13800138200`);
        assert.equal(result.response.status, 200);
        assert.equal(result.body.orders.length, 1);
        assert.equal(result.body.orders[0].id, 'ORDER-EXPIRED-KEEP');
        assert.equal(result.body.orders[0].apiKey, 'sk-expired-keep-visible');
        assert.equal(result.body.orders[0].status, 'expired');
    });
});

test('进入兑换页会清理当前兑换 cookie，避免继续访问上一条结果页', async () => {
    await withServer(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/shop/redeem/`, {
            headers: { cookie: 'yui_shop_result_token=rst_anything' }
        });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('set-cookie') || '', /yui_shop_result_token=;/);
    });
});

test('手机号包含字母或位数不对时，兑换和查询接口都会拒绝', async () => {
    await withServer(async ({ baseUrl }) => {
        const invalidRedeem = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138abc', code: 'YUI-ABCDEF-123456' })
        });
        assert.equal(invalidRedeem.response.status, 400);
        assert.equal(invalidRedeem.body.code, 'INVALID_PHONE');

        const shortQuery = await jsonFetch(`${baseUrl}/api/orders?phone=1380013800`);
        assert.equal(shortQuery.response.status, 400);
        assert.equal(shortQuery.body.code, 'INVALID_PHONE');
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

test('兑换页手机号输入框限制数字手机号格式', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/redeem/index.html'), 'utf8');
    assert.match(html, /id="phoneInput"[^>]+inputmode="numeric"/);
    assert.match(html, /id="phoneInput"[^>]+maxlength="11"/);
    assert.match(html, /id="phoneInput"[^>]+pattern="\^1\[3-9\]\\d\{9\}\$"/);
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
    assert.match(guide, /data-ui-ready','true/);
    assert.doesNotMatch(guide, /sk-dummy/);
    assert.doesNotMatch(guide, /环境变量文件/);
    assert.doesNotMatch(guide, /sk-[a-f0-9]{32}/);
});

test('手机号查询页说明过期订单仍会保留展示', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/query/index.html'), 'utf8');
    assert.match(html, /过期订单会显示为已失效/);
    assert.match(html, /仍会保留在查询结果里/);
});

test('API key 结果页只展示订单，不再渲染使用方法', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');
    assert.match(script, /api\/orders\/current/);
    assert.doesNotMatch(script, /yui-shop-latest-order/);
    assert.doesNotMatch(script, /Codex CLI 使用公网 API 配置说明/);
    assert.doesNotMatch(script, /Codex 配置使用方法/);
    assert.doesNotMatch(script, /renderUsageGuide/);
});

test('后台生成邀请码页面不渲染已经拆分的 API key 字段', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.match(html, /生成邀请码/);
    assert.match(html, /未使用的 API key 库存/);
    assert.doesNotMatch(html, /对应 API key/);
    assert.doesNotMatch(script, /invite\.apiKey/);
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

test('内部 API key 状态接口对未过期订单返回 active', async () => {
    await withServer(async ({ baseUrl }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-active-status'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138301', code: inviteResult.body.invites[0].code })
        });

        const active = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=sk-active-status`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(active.response.status, 200);
        assert.equal(active.body.managed, true);
        assert.equal(active.body.active, true);
        assert.equal(active.body.status, 'active');
        assert.match(active.body.expiresAt, /^\d{4}-\d{2}-\d{2}T/);
    });
});
