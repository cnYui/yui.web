const assert = require('node:assert/strict');
const test = require('node:test');

const {
    DEFAULT_LOGIN,
    ContributionsError,
    contributionsUrl,
    createContributionsService,
    parseContributionsHtml,
    resolveLogin,
} = require('./github-contributions');
const { buildCalendarHtml, createFetchStub, okResponse } = require('../test/helpers/github-calendar-fixture');

// ---- 解析 ----

test('解析出全年每天的等级和贡献数，总数取自页面标题', () => {
    const parsed = parseContributionsHtml(buildCalendarHtml({
        year: 2026,
        counts: { '2026-01-05': 3, '2026-03-14': 12, '2026-09-21': 54 },
    }));

    assert.equal(parsed.days.length, 365);
    assert.equal(parsed.from, '2026-01-01');
    assert.equal(parsed.to, '2026-12-31');
    assert.equal(parsed.total, 69);
    assert.deepEqual(parsed.days.find((day) => day.date === '2026-01-05'), { date: '2026-01-05', level: 1, count: 3 });
    assert.deepEqual(parsed.days.find((day) => day.date === '2026-03-14'), { date: '2026-03-14', level: 3, count: 12 });
    assert.deepEqual(parsed.days.find((day) => day.date === '2026-09-21'), { date: '2026-09-21', level: 4, count: 54 });
    assert.deepEqual(parsed.days.find((day) => day.date === '2026-06-01'), { date: '2026-06-01', level: 0, count: 0 });
});

test('页面按星期分行输出，解析后仍按日期升序，且不重复', () => {
    const { days } = parseContributionsHtml(buildCalendarHtml({ year: 2026 }));

    const dates = days.map((day) => day.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.equal(new Set(dates).size, dates.length);
});

test('闰年是 366 天', () => {
    const parsed = parseContributionsHtml(buildCalendarHtml({ year: 2028 }));

    assert.equal(parsed.days.length, 366);
    assert.ok(parsed.days.some((day) => day.date === '2028-02-29'));
});

test('图例里的方块（有 data-level 但没有 data-date）不会被当成某一天', () => {
    const parsed = parseContributionsHtml(buildCalendarHtml({ year: 2026 }));

    assert.equal(parsed.days.length, 365);
    assert.ok(parsed.days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date)));
});

test('解析不依赖属性顺序，也接受单引号', () => {
    const html = buildCalendarHtml({ year: 2026, attributeOrder: 'level-first', counts: { '2026-05-05': 7 } })
        .replace(/="([^"]*)"/g, (match, value) => (/[<>]/.test(value) ? match : `='${value}'`));
    const parsed = parseContributionsHtml(html);

    assert.equal(parsed.days.length, 365);
    assert.deepEqual(parsed.days.find((day) => day.date === '2026-05-05'), { date: '2026-05-05', level: 2, count: 7 });
});

test('贡献数支持单数、千分位和「没有贡献」三种写法', () => {
    const parsed = parseContributionsHtml(buildCalendarHtml({
        year: 2026,
        counts: { '2026-02-01': 1, '2026-02-02': 1234 },
    }));

    assert.equal(parsed.days.find((day) => day.date === '2026-02-01').count, 1);
    assert.equal(parsed.days.find((day) => day.date === '2026-02-02').count, 1234);
    assert.equal(parsed.days.find((day) => day.date === '2026-02-03').count, 0);
});

test('取不到逐日贡献数时只丢掉数字，等级仍然可用，总数取页面标题', () => {
    const parsed = parseContributionsHtml(buildCalendarHtml({ year: 2026, omitTooltips: true, counts: { '2026-04-04': 30 } }));

    assert.equal(parsed.days.length, 365);
    assert.equal(parsed.total, 30);
    assert.deepEqual(parsed.days.find((day) => day.date === '2026-04-04'), { date: '2026-04-04', level: 4, count: null });
});

test('页面标题缺失时总数退回逐日相加', () => {
    const parsed = parseContributionsHtml(buildCalendarHtml({
        year: 2026,
        omitHeading: true,
        counts: { '2026-01-05': 3, '2026-03-14': 12 },
    }));

    assert.equal(parsed.total, 15);
});

test('标题里的总数带千分位时也能读出来', () => {
    const parsed = parseContributionsHtml(buildCalendarHtml({ year: 2026, headerTotal: 1741 }));

    assert.equal(parsed.total, 1741);
});

test('拿到的不是贡献日历（错误页、改版）就报解析失败，而不是画出一张空图', () => {
    for (const html of ['', '<html><body>Not Found</body></html>', undefined, null]) {
        assert.throws(
            () => parseContributionsHtml(html),
            (error) => error instanceof ContributionsError && error.code === 'GITHUB_PARSE_FAILED'
        );
    }
});

// ---- 配置 ----

test('用户名只接受合法的 GitHub 登录名，非法值退回默认并给出警告', () => {
    const warnings = [];
    const warn = (message) => warnings.push(message);

    assert.equal(resolveLogin('cnYui', warn), 'cnYui');
    assert.equal(resolveLogin('  octo-cat  ', warn), 'octo-cat');
    assert.equal(resolveLogin('', warn), DEFAULT_LOGIN);
    assert.equal(resolveLogin(undefined, warn), DEFAULT_LOGIN);
    assert.deepEqual(warnings, []);

    for (const bad of ['../etc/passwd', 'a b', 'foo/bar', '-leading', 'x'.repeat(40), 'a?from=1']) {
        assert.equal(resolveLogin(bad, warn), DEFAULT_LOGIN, bad);
    }
    assert.equal(warnings.length, 6);
});

test('请求地址固定指向 github.com 的公开贡献页，年份取整年', () => {
    assert.equal(
        contributionsUrl('cnYui', 2026),
        'https://github.com/users/cnYui/contributions?from=2026-01-01&to=2026-12-31'
    );
});

// ---- 缓存与失败处理 ----

function harness(overrides = {}) {
    let clock = new Date(2026, 8, 29, 12, 0, 0);
    const html = buildCalendarHtml({ year: 2026 });
    const fetchStub = overrides.fetchStub || createFetchStub(() => okResponse(html));
    const warnings = [];
    const service = createContributionsService({
        login: 'cnYui',
        ttlMs: 15 * 60 * 1000,
        retryMs: 60 * 1000,
        fetchImpl: fetchStub,
        now: () => clock,
        warn: (message) => warnings.push(message),
        ...overrides.options,
    });
    return {
        service,
        fetchStub,
        warnings,
        advance(ms) { clock = new Date(clock.getTime() + ms); },
        setClock(date) { clock = date; },
    };
}

test('缓存期内只拉一次 GitHub，并带上 UA 与超时信号', async () => {
    const { service, fetchStub, advance } = harness();

    const first = await service.get();
    advance(14 * 60 * 1000);
    const second = await service.get();

    assert.equal(fetchStub.calls.length, 1);
    assert.equal(fetchStub.calls[0].url, 'https://github.com/users/cnYui/contributions?from=2026-01-01&to=2026-12-31');
    assert.match(fetchStub.calls[0].init.headers['User-Agent'], /yui-web/);
    assert.ok(fetchStub.calls[0].init.signal instanceof AbortSignal);
    assert.equal(first.stale, false);
    assert.deepEqual(second, first);
    assert.equal(first.login, 'cnYui');
    assert.equal(first.year, 2026);
    assert.equal(first.days.length, 365);
    assert.ok(Number.isFinite(Date.parse(first.fetchedAt)));
});

test('缓存过期后由下一个请求重新拉取', async () => {
    const { service, fetchStub, advance } = harness();

    await service.get();
    advance(15 * 60 * 1000 + 1);
    const refreshed = await service.get();

    assert.equal(fetchStub.calls.length, 2);
    assert.equal(refreshed.stale, false);
});

test('同时到达的请求共用同一次拉取', async () => {
    const { service, fetchStub } = harness({
        fetchStub: createFetchStub(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return okResponse(buildCalendarHtml({ year: 2026 }));
        }),
    });

    const results = await Promise.all([service.get(), service.get(), service.get()]);

    assert.equal(fetchStub.calls.length, 1);
    assert.equal(new Set(results.map((result) => result.fetchedAt)).size, 1);
});

test('GitHub 拉不到时继续给旧数据并标记 stale，冷却期内不再重试', async () => {
    let failing = false;
    const html = buildCalendarHtml({ year: 2026 });
    const { service, fetchStub, warnings, advance } = harness({
        fetchStub: createFetchStub(() => (failing ? new Error('connect ETIMEDOUT') : okResponse(html))),
    });

    const fresh = await service.get();
    failing = true;
    advance(15 * 60 * 1000 + 1);
    const stale = await service.get();

    assert.equal(stale.stale, true);
    assert.deepEqual({ ...stale, stale: false }, fresh);
    assert.equal(fetchStub.calls.length, 2);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /ETIMEDOUT/);

    advance(30 * 1000);
    assert.equal((await service.get()).stale, true);
    assert.equal(fetchStub.calls.length, 2, '冷却期内不该再敲 GitHub');

    failing = false;
    advance(31 * 1000);
    const recovered = await service.get();
    assert.equal(recovered.stale, false);
    assert.equal(fetchStub.calls.length, 3);
});

test('从没成功过就直接报错，冷却期内同样不重试', async () => {
    const { service, fetchStub, advance } = harness({
        fetchStub: createFetchStub(() => ({ ok: false, status: 429, text: async () => '' })),
    });

    await assert.rejects(service.get(), (error) => error instanceof ContributionsError && error.code === 'GITHUB_BAD_STATUS');
    await assert.rejects(service.get(), (error) => error.code === 'GITHUB_BAD_STATUS');
    assert.equal(fetchStub.calls.length, 1);

    advance(61 * 1000);
    await assert.rejects(service.get());
    assert.equal(fetchStub.calls.length, 2);
});

test('网络异常与响应体读取失败都归为无法连接 GitHub', async () => {
    const network = harness({ fetchStub: createFetchStub(() => new Error('getaddrinfo ENOTFOUND github.com')) });
    await assert.rejects(network.service.get(), (error) => error.code === 'GITHUB_UNREACHABLE' && /ENOTFOUND/.test(error.message));

    const body = harness({
        fetchStub: createFetchStub(() => ({ ok: true, status: 200, text: async () => { throw new Error('terminated'); } })),
    });
    await assert.rejects(body.service.get(), (error) => error.code === 'GITHUB_UNREACHABLE');
});

test('GitHub 改版导致解析失败时同样保留旧数据', async () => {
    let broken = false;
    const html = buildCalendarHtml({ year: 2026 });
    const { service, advance } = harness({
        fetchStub: createFetchStub(() => okResponse(broken ? '<html>redesigned</html>' : html)),
    });

    await service.get();
    broken = true;
    advance(16 * 60 * 1000);
    const result = await service.get();

    assert.equal(result.stale, true);
    assert.equal(result.days.length, 365);
});

test('跨年后即使还在缓存期内也会重新拉取新一年的数据', async () => {
    const { service, fetchStub, setClock } = harness({
        fetchStub: createFetchStub((url) => okResponse(buildCalendarHtml({ year: Number(/from=(\d{4})/.exec(url)[1]) }))),
    });

    setClock(new Date(2026, 11, 31, 23, 55, 0));
    assert.equal((await service.get()).year, 2026);
    setClock(new Date(2027, 0, 1, 0, 1, 0));
    const next = await service.get();

    assert.equal(next.year, 2027);
    assert.equal(fetchStub.calls.length, 2);
    assert.match(fetchStub.calls[1].url, /from=2027-01-01&to=2027-12-31/);
});

test('缓存时间与冷却时间用非法值时退回默认，不会变成 0 而每次都去拉', async () => {
    const { service, fetchStub } = harness({ options: { ttlMs: 'abc', retryMs: -5, timeoutMs: 0 } });

    await service.get();
    await service.get();

    assert.equal(fetchStub.calls.length, 1);
});
