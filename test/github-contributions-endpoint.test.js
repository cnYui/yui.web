const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createShopApp } = require('../server');
const { buildCalendarHtml, createFetchStub, okResponse } = require('./helpers/github-calendar-fixture');

const rootDir = path.resolve(__dirname, '..');
const readFile = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

// aaccx.pw 的 cloudflared ingress 只把下面这些前缀转发给 yui.web(4173)，其余路径（含 /api/）
// 会落到 Sub2API(8080)。接口路径放错前缀时，本机自测全绿但公网必定 404。
const TUNNELED_PREFIXES = [
    'files', 'styles', 'js', 'blog', 'music', 'anime',
    'travel', 'projects', 'resume', 'skill', 'shop',
];

function clientEndpoint() {
    const match = readFile('js/github-contributions.js').match(/const ENDPOINT = '([^']+)'/);
    return match && match[1];
}

test('贡献图接口的前后端路径完全一致', () => {
    const endpoint = clientEndpoint();
    assert.ok(endpoint, '未能在 js/github-contributions.js 中找到 ENDPOINT');
    assert.ok(
        readFile('server.js').includes(`app.get('${endpoint}',`),
        `前端请求 ${endpoint}，但 server.js 里没有注册同一路径的 GET 路由`
    );
});

test('贡献图接口必须落在 cloudflared 会转发给本服务的前缀下', () => {
    const firstSegment = clientEndpoint().split('/').filter(Boolean)[0];
    assert.ok(
        TUNNELED_PREFIXES.includes(firstSegment),
        `接口 ${clientEndpoint()} 的前缀 /${firstSegment} 不在隧道转发白名单内，公网会被路由到 Sub2API 并返回 404`
    );
});

test('接口路径不带静态资源扩展名，否则 check-static-assets 会把它当成缺失的文件', () => {
    assert.doesNotMatch(clientEndpoint(), /\.(?:css|gif|html|jpe?g|js|json|pdf|png|svg|webp)$/i);
});

async function startApp(githubFetch, extraOptions = {}) {
    const dbPath = path.join(os.tmpdir(), `yui-github-contributions-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
    const warnings = [];
    const created = createShopApp({
        adminToken: 'test-admin-token',
        internalToken: 'test-internal-token',
        usageEventHmacSecret: 'test-usage-hmac-secret',
        sub2apiPublicUrl: 'https://sub2api.example.com',
        dbPath,
        githubContributionsFetch: githubFetch,
        githubContributionsWarn: (message) => warnings.push(message),
        ...extraOptions,
    });
    const server = http.createServer(created.app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return {
        warnings,
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        async close() {
            created.usageImporter?.stop?.();
            await new Promise((resolve) => server.close(resolve));
            created.db.close();
            for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
        },
    };
}

test('GET 贡献图接口无需登录，返回 JSON、带安全头，并且 15 分钟内只拉一次 GitHub', async () => {
    const stub = createFetchStub(() => okResponse(buildCalendarHtml({
        year: new Date().getFullYear(),
        counts: { [`${new Date().getFullYear()}-01-05`]: 3 },
    })));
    const app = await startApp(stub);
    try {
        const first = await fetch(`${app.baseUrl}${clientEndpoint()}`);
        const body = await first.json();

        assert.equal(first.status, 200);
        assert.match(first.headers.get('content-type'), /^application\/json/);
        assert.equal(first.headers.get('cache-control'), 'public, max-age=300');
        assert.match(first.headers.get('content-security-policy'), /script-src 'self'/);
        assert.equal(first.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(first.headers.get('set-cookie'), null);
        assert.equal(body.login, 'cnYui');
        assert.equal(body.year, new Date().getFullYear());
        assert.equal(body.total, 3);
        assert.equal(body.stale, false);
        assert.ok(body.days.length >= 365);
        assert.deepEqual(Object.keys(body.days[0]).sort(), ['count', 'date', 'level']);

        const second = await fetch(`${app.baseUrl}${clientEndpoint()}`);
        assert.equal(second.status, 200);
        assert.equal(stub.calls.length, 1);
        assert.deepEqual(app.warnings, []);
    } finally {
        await app.close();
    }
});

test('GitHub 拉不到且没有旧数据时返回 503，不泄漏内部错误，也不允许缓存', async () => {
    const stub = createFetchStub(() => new Error('connect ECONNREFUSED 140.82.112.3:443'));
    const app = await startApp(stub);
    try {
        const response = await fetch(`${app.baseUrl}${clientEndpoint()}`);
        const text = await response.text();

        assert.equal(response.status, 503);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(JSON.parse(text).code, 'GITHUB_CONTRIBUTIONS_UNAVAILABLE');
        assert.doesNotMatch(text, /ECONNREFUSED|140\.82/);
        // 细节只进日志，方便排查。
        assert.equal(app.warnings.length, 1);
        assert.match(app.warnings[0], /ECONNREFUSED/);
    } finally {
        await app.close();
    }
});

test('刷新失败但手里有旧数据时继续返回旧数据，并缩短缓存时间', async () => {
    const year = new Date().getFullYear();
    let failing = false;
    const stub = createFetchStub(() => (failing ? new Error('boom') : okResponse(buildCalendarHtml({ year }))));
    const app = await startApp(stub, { githubContributionsTtlMs: 5 });
    try {
        assert.equal((await fetch(`${app.baseUrl}${clientEndpoint()}`)).status, 200);

        failing = true;
        await new Promise((resolve) => setTimeout(resolve, 30));
        const response = await fetch(`${app.baseUrl}${clientEndpoint()}`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
        assert.equal(body.stale, true);
        assert.ok(body.days.length >= 365);
        assert.equal(app.warnings.length, 1);
    } finally {
        await app.close();
    }
});

test('贡献图接口不会被静态目录抢走：/files/ 下同名文件不存在也不影响它', async () => {
    const app = await startApp(createFetchStub(() => okResponse(buildCalendarHtml({ year: new Date().getFullYear() }))));
    try {
        const response = await fetch(`${app.baseUrl}${clientEndpoint()}`);
        assert.equal(response.status, 200);
        assert.equal(fs.existsSync(path.join(rootDir, clientEndpoint())), false);
    } finally {
        await app.close();
    }
});
