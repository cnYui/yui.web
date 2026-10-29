const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createShopApp } = require('../server');

const rootDir = path.resolve(__dirname, '..');
const readFile = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const TOKEN = 'test-now-token-0123456789abcdef0123456789';

async function startApp(extra = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yui-travel-now-'));
    const { app, db } = createShopApp({
        adminToken: 'test-admin-token-0123456789abcdef0123456789',
        internalToken: 'test-internal-token-0123456789abcdef01234',
        dbPath: path.join(dir, 'shop.sqlite'),
        nowLocationPath: path.join(dir, 'now-location.json'),
        now: () => new Date('2026-10-29T05:00:00Z'),
        ...extra
    });
    const server = await new Promise((resolve) => {
        const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return {
        base,
        close: () => new Promise((resolve) => server.close(() => { db.close(); resolve(); }))
    };
}

function post(base, body, token = TOKEN) {
    return fetch(`${base}/travel/now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
    });
}

test('此刻：带口令写入城市级位置，公开读只给城市和取整后的坐标', async (t) => {
    const app = await startApp({ nowLocationToken: TOKEN });
    t.after(app.close);

    assert.deepEqual(await (await fetch(`${app.base}/travel/now`)).json(), { city: null });

    const wrong = await post(app.base, { lat: 34.69, lon: 135.5 }, 'wrong-token');
    assert.equal(wrong.status, 401);

    const ok = await post(app.base, { lat: '34.69374', lon: '135.50218', city: '大阪市' });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'no-store');

    const read = await fetch(`${app.base}/travel/now`);
    assert.equal(read.headers.get('cache-control'), 'public, max-age=60');
    assert.deepEqual(await read.json(), { city: '大阪市', lat: 34.7, lon: 135.5, updatedAt: '2026-10-29T05:00:00.000Z' });

    assert.equal((await post(app.base, { city: '没有坐标' })).status, 400);
    assert.equal((await post(app.base, { hidden: true })).status, 200);
    assert.deepEqual(await (await fetch(`${app.base}/travel/now`)).json(), { hidden: true, updatedAt: '2026-10-29T05:00:00.000Z' });
});

test('此刻：没配 NOW_LOCATION_TOKEN 时写入关闭，读照常', async (t) => {
    const app = await startApp({ nowLocationToken: '' });
    t.after(app.close);
    assert.equal((await post(app.base, { lat: 35, lon: 135 })).status, 503);
    assert.equal((await fetch(`${app.base}/travel/now`)).status, 200);
});

test('此刻：口令连续错八次后限流', async (t) => {
    const app = await startApp({ nowLocationToken: TOKEN });
    t.after(app.close);
    for (let i = 0; i < 8; i += 1) assert.equal((await post(app.base, { lat: 35, lon: 135 }, 'wrong')).status, 401);
    assert.equal((await post(app.base, { lat: 35, lon: 135 })).status, 429);
});

// cloudflared 只把固定几个前缀转给 yui.web，/api/ 会落到 Sub2API（2026-09-22 简历下载接口就踩过）。
test('此刻：前端读的路径就是服务端注册的路径，并且在隧道转发的 /travel/ 下', () => {
    assert.match(readFile('server.js'), /app\.get\('\/travel\/now'/);
    assert.match(readFile('server.js'), /app\.post\('\/travel\/now'/);
    assert.match(readFile('js/travel-now.js'), /fetch\('\/travel\/now'/);
    const page = readFile('travel/index.html');
    assert.match(page, /<script src="\/js\/travel-now\.js\?v=[0-9A-Za-z.-]+" defer><\/script>/);
    assert.match(page, /<section class="block now" id="now"[^>]* hidden>/, '没有数据时「此刻」默认藏起来');
    assert.match(page, /images\/optimized\/clue-wall\/travel-map-v4\.webp/);
});
