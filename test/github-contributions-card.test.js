const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { buildCalendarHtml } = require('./helpers/github-calendar-fixture');
const { parseContributionsHtml } = require('../lib/github-contributions');

const rootDir = path.join(__dirname, '..');
const readFile = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

// ---- 页面标记：这张卡片只展示，不能有任何交互 ----

test('首页带上贡献图脚本，卡片是纯展示的装饰块而不是可点开的便签', () => {
    const html = readFile('index.html');

    assert.match(html, /<script src="\/js\/github-contributions\.js\?v=[^"]+" defer><\/script>/);

    const start = html.indexOf('id="cwGithub"');
    assert.ok(start > 0, '首页缺少 #cwGithub');
    const block = html.slice(html.lastIndexOf('<div', start), html.indexOf('<svg class="cw-strings"', start));

    assert.match(block, /^<div class="cw-github" id="cwGithub"/);
    for (const forbidden of [/<a[\s>]/i, /<button/i, /<input/i, /tabindex/i, /role="button"/i, /data-section/, /data-card/, /\son[a-z]+\s*=/i, /cw-card/]) {
        assert.doesNotMatch(block, forbidden, `贡献图卡片里不该出现 ${forbidden}`);
    }
    // 数据到达之前对读屏隐藏，到达之后才由脚本换成 role="img"。
    assert.match(block, /aria-hidden="true"/);
});

test('数据到达之前卡片不接收指针事件、保持透明；到达之后只能拖动，没有悬停 / 聚焦样式', () => {
    const css = readFile('styles/clue-wall.css');
    const rule = css.match(/\.cw-github\s*\{[^}]*\}/);

    assert.ok(rule, '样式里没有 .cw-github');
    assert.match(rule[0], /pointer-events:\s*none/);
    assert.match(rule[0], /opacity:\s*0/);
    assert.match(css, /\.cw-github\.is-ready\s*\{[^}]*opacity:\s*1/);
    // 到达之后才接收指针：墙上的纸都能拖（js/clue-board.js），但它不是便签，点不开。
    assert.match(css, /\.cw-github\.is-ready\s*\{[^}]*pointer-events:\s*auto/);
    assert.doesNotMatch(css, /\.cw-github[^{]*:(?:hover|focus|active)/, '贡献图卡片不应有悬停 / 聚焦样式');
    assert.doesNotMatch(rule[0], /cursor:\s*pointer/);
});

test('贡献图脚本只请求同源接口，页面没有别的脚本能在首屏之前抢走它的容器', () => {
    const script = readFile('js/github-contributions.js');

    assert.doesNotMatch(script, /https?:\/\//, 'CSP 是 connect-src \'self\'，脚本里不该出现站外地址');
    assert.match(script, /const ENDPOINT = '\/files\/github-contributions'/);
    assert.doesNotMatch(script, /\.innerHTML\s*=/, '数据一律走 textContent，不拼 HTML');
});

// ---- 脚本行为：在一个最小的假 DOM 里跑一遍 ----

class FakeNode {
    constructor(tag) {
        this.tagName = String(tag).toUpperCase();
        this.children = [];
        this.attributes = new Map();
        this.dataset = {};
        this.className = '';
        this.textContent = '';
        this.style = { props: new Map(), setProperty(key, value) { this.props.set(key, value); } };
        const classes = new Set();
        this.classList = { add: (name) => classes.add(name), contains: (name) => classes.has(name) };
    }

    appendChild(node) { this.children.push(node); return node; }

    replaceChildren(...nodes) { this.children = nodes.flatMap((node) => (node.isFragment ? node.children : [node])); }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }

    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }

    removeAttribute(name) { this.attributes.delete(name); }

    querySelector(selector) {
        const match = /^\[data-gh="(\w+)"\]$/.exec(selector);
        return match ? (this.slots[match[1]] || null) : null;
    }
}

// 故意不给 FakeNode 实现 addEventListener：脚本一旦想给卡片挂点击 / 悬停之类的监听就会抛错，测试随之失败。
// options.i18n：假的 window.YuiClueI18n（t 只回显键和参数），脚本挂在 window 上的监听收集在 windowListeners 里。
function runCard(fetchImpl, options = {}) {
    const card = new FakeNode('div');
    card.setAttribute('aria-hidden', 'true');
    card.slots = { total: new FakeNode('span'), unit: new FakeNode('span'), grid: new FakeNode('div') };

    const documentListeners = [];
    const windowListeners = [];
    const intervals = [];
    const document = {
        hidden: false,
        getElementById: (id) => (id === 'cwGithub' ? card : null),
        createElement: (tag) => new FakeNode(tag),
        createDocumentFragment: () => Object.assign(new FakeNode('#fragment'), { isFragment: true }),
        addEventListener: (type, listener) => documentListeners.push({ type, listener }),
    };
    const fetchCalls = [];
    const context = {
        // 用外层的 Date，测试里改 Date.now 才会影响脚本看到的时间。
        Date,
        document,
        fetch: (...args) => { fetchCalls.push(args); return fetchImpl(...args); },
        setInterval: (callback, ms) => { intervals.push({ callback, ms }); return intervals.length; },
    };
    if (options.i18n) {
        context.window = {
            YuiClueI18n: options.i18n,
            addEventListener: (type, listener) => windowListeners.push({ type, listener }),
        };
    }
    vm.runInNewContext(readFile('js/github-contributions.js'), context);
    return { card, document, documentListeners, windowListeners, intervals, fetchCalls, context };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

function payloadFor(year, counts, extra = {}) {
    const parsed = parseContributionsHtml(buildCalendarHtml({ year, counts }));
    return { login: 'cnYui', year, from: parsed.from, to: parsed.to, total: parsed.total, fetchedAt: '2026-09-29T03:20:43.113Z', days: parsed.days, stale: false, ...extra };
}

const okJson = (payload) => () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });

test('拿到数据后画出整张贡献图：总数、单位、方块、无障碍描述', async () => {
    const payload = payloadFor(2026, { '2026-01-05': 3, '2026-09-21': 54, '2026-09-29': 12 });
    const { card, fetchCalls } = runCard(okJson(payload));
    await settle();

    assert.equal(fetchCalls[0][0], '/files/github-contributions');
    assert.equal(card.classList.contains('is-ready'), true);
    assert.equal(card.getAttribute('aria-hidden'), null);
    assert.equal(card.getAttribute('role'), 'img');
    assert.match(card.getAttribute('aria-label'), /cnYui.*2026.*69/);
    // 卡片上只有总数和「单位 · 年份」两段文字（GitHub 字样写在页面里）；月份、星期、图例、同步时间都不画。
    assert.equal(card.slots.total.textContent, '69');
    assert.equal(card.slots.unit.textContent, 'contributions · 2026');
    assert.deepEqual(Object.keys(card.slots).sort(), ['grid', 'total', 'unit']);

    // 2026-01-01 是周四：第一列前面补 4 个空位，其后每天一个方块。
    const cells = card.slots.grid.children;
    assert.equal(cells.length, 4 + 365);
    assert.deepEqual(cells.slice(0, 4).map((cell) => cell.className), Array(4).fill('cw-github-cell is-void'));
    // 53 列：4 个空位 + 365 天 = 369 格，每列 7 格向上取整。
    assert.equal(Math.ceil(cells.length / 7), 53);

    const levelOn = (date) => {
        const offset = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse('2026-01-01T00:00:00Z')) / 86400000);
        return cells[4 + offset].dataset.level;
    };
    assert.equal(levelOn('2026-01-01'), '0');
    assert.equal(levelOn('2026-01-05'), '1');
    assert.equal(levelOn('2026-09-21'), '4');
    assert.equal(levelOn('2026-09-29'), '3');
    assert.equal(levelOn('2026-12-31'), '0');
});

test('周日开头的年份第一列是满的，没有空位', async () => {
    // 2023-01-01 是周日。
    const { card } = runCard(okJson(payloadFor(2023, {})));
    await settle();

    assert.equal(card.slots.grid.children.length, 365);
    assert.equal(card.slots.grid.children.filter((cell) => cell.className.includes('is-void')).length, 0);
});

test('总数为 1 时用单数，千分位按英文格式', async () => {
    const one = runCard(okJson({ ...payloadFor(2026, {}), total: 1 }));
    await settle();
    assert.equal(one.card.slots.total.textContent, '1');
    assert.equal(one.card.slots.unit.textContent, 'contribution · 2026');

    const many = runCard(okJson({ ...payloadFor(2026, {}), total: 1741 }));
    await settle();
    assert.equal(many.card.slots.total.textContent, '1,741');
    assert.equal(many.card.slots.unit.textContent, 'contributions · 2026');
});

// 卡片上看得见的字（单位 + 年份）和读屏描述一样，都跟着页面语言走；切换语言时不用重新取数据。
test('单位跟着页面语言走，切换语言时就地重写，不再请求', async () => {
    let lang = 'zh';
    const i18n = { t: (key, params) => `${lang}:${key}:${params.year}` };
    const { card, windowListeners, fetchCalls } = runCard(okJson({ ...payloadFor(2026, {}), total: 1385 }), { i18n });
    await settle();

    assert.equal(card.slots.unit.textContent, 'zh:github.unit:2026');
    assert.match(card.getAttribute('aria-label'), /^zh:github\.aria:/);
    assert.deepEqual(windowListeners.map((entry) => entry.type), ['yui-clue-lang']);

    lang = 'ja';
    windowListeners[0].listener();
    assert.equal(card.slots.unit.textContent, 'ja:github.unit:2026');
    assert.match(card.getAttribute('aria-label'), /^ja:github\.aria:/);
    assert.equal(fetchCalls.length, 1, '切换语言只重写文字，不该再去取数据');

    // 单数用单独的词条（英文是 contribution）。
    const single = runCard(okJson({ ...payloadFor(2026, {}), total: 1 }), { i18n });
    await settle();
    assert.equal(single.card.slots.unit.textContent, 'ja:github.unit.one:2026');
});

test('词典没加载上时退回英文，不把键名露在卡片上', async () => {
    // 拿不到词典（脚本没加载上）时退回英文，不能把 github.unit 这样的键名露在卡片上。
    const { card } = runCard(okJson({ ...payloadFor(2026, {}), total: 1385 }));
    await settle();
    assert.doesNotMatch(card.slots.unit.textContent, /github\./);
    assert.equal(card.slots.unit.textContent, 'contributions · 2026');
});

test('接口失败、返回非 200 或数据残缺时，卡片一直保持隐藏，页面不报错', async () => {
    const failures = [
        () => Promise.reject(new Error('network down')),
        () => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({ code: 'GITHUB_CONTRIBUTIONS_UNAVAILABLE' }) }),
        okJson({ login: 'cnYui', year: 2026, total: 5, days: [] }),
        okJson({ days: 'nope' }),
        okJson(null),
    ];
    for (const fetchImpl of failures) {
        const { card } = runCard(fetchImpl);
        await settle();

        assert.equal(card.classList.contains('is-ready'), false);
        assert.equal(card.getAttribute('aria-hidden'), 'true');
        assert.equal(card.getAttribute('role'), null);
        assert.equal(card.slots.grid.children.length, 0);
    }
});

test('没有容器的页面上脚本什么都不做', () => {
    const fetchCalls = [];
    vm.runInNewContext(readFile('js/github-contributions.js'), {
        document: { getElementById: () => null },
        fetch: (...args) => { fetchCalls.push(args); },
        setInterval: () => { throw new Error('不该起定时器'); },
    });

    assert.equal(fetchCalls.length, 0);
});

test('只做定时刷新：没有点击 / 悬停 / 键盘监听，页面在后台时不请求', async () => {
    const { documentListeners, intervals, fetchCalls, document } = runCard(okJson(payloadFor(2026, {})));
    await settle();

    assert.deepEqual(documentListeners.map((entry) => entry.type), ['visibilitychange']);
    assert.equal(intervals.length, 1);
    assert.equal(intervals[0].ms, 30 * 60 * 1000);

    assert.equal(fetchCalls.length, 1);
    document.hidden = true;
    intervals[0].callback();
    assert.equal(fetchCalls.length, 1, '标签页在后台时不该去取数据');

    document.hidden = false;
    intervals[0].callback();
    await settle();
    assert.equal(fetchCalls.length, 2);
});

test('后台放久了切回来，会立刻补一次，刚取过则不重复', async () => {
    const { documentListeners, fetchCalls, document, context } = runCard(okJson(payloadFor(2026, {})));
    await settle();
    const onVisible = documentListeners[0].listener;

    // 刚加载完，切回来不需要再取。
    onVisible();
    assert.equal(fetchCalls.length, 1);

    // 时钟走过半小时后再切回来：补一次。
    const realNow = Date.now;
    Date.now = () => realNow() + 31 * 60 * 1000;
    try {
        onVisible();
        await settle();
        assert.equal(fetchCalls.length, 2);
        document.hidden = true;
        onVisible();
        assert.equal(fetchCalls.length, 2, '页面还在后台就别取');
    } finally {
        Date.now = realNow;
    }
    assert.ok(context);
});
