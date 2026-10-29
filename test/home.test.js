const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const readFile = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');
const html = readFile('index.html');
const css = readFile('styles/wabi.css');

// 在假环境里跑 js/site.js：只提供它用到的 navigator / localStorage / location / document / window。
function runSite({ stored = null, languages = ['zh-CN'], hash = '', pathname = '/', nodes = [] } = {}) {
    const replaced = [];
    const listeners = {};
    const windowListeners = {};
    const events = [];
    const attributes = { 'data-title-zh': '悠一 Yui', 'data-title-ja': '悠一 Yui', 'data-title-en': 'Yui · 悠一' };
    const documentElement = { lang: 'zh-CN', getAttribute: (name) => attributes[name] ?? null };
    const storage = { value: stored, writes: 0 };
    const location = { hash, pathname, replace: (url) => replaced.push(url) };
    const document = {
        documentElement,
        title: '',
        querySelectorAll: (selector) => {
            const match = selector.match(/^\[([a-z-]+)\]$/);
            return match ? nodes.filter((node) => node.attrs[match[1]] !== undefined) : [];
        },
        addEventListener: (type, listener) => { listeners[type] = listener; },
    };
    const window = {
        addEventListener: (type, listener) => { windowListeners[type] = listener; },
        dispatchEvent: (event) => events.push(event),
    };
    const context = {
        navigator: { languages, language: languages[0] },
        localStorage: {
            getItem: () => storage.value,
            setItem: (key, value) => { storage.value = value; storage.writes += 1; },
        },
        location,
        document,
        window,
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    };
    vm.runInNewContext(readFile('js/site.js'), context);
    return { replaced, listeners, windowListeners, events, location, document, documentElement, storage, window };
}

function fakeNode(attrs) {
    return {
        attrs,
        textContent: '',
        getAttribute(name) { return this.attrs[name] ?? null; },
        setAttribute(name, value) { this.attrs[name] = value; },
    };
}

test('首页 <head> 里第一个脚本是同步的 site.js，样式只有 wabi.css 和 Google Fonts', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.equal(scripts.length, 1, '首页只应有一个脚本');
    assert.match(scripts[0][1], /^\s*src="\/js\/site\.js\?v=[^"]+"\s*$/, 'site.js 必须是同步的 <script src>，不带 defer / async');
    assert.ok(scripts[0].index < html.indexOf('</head>'), 'site.js 必须在 <head> 里');

    const sheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)]
        .map((match) => match[0].match(/href="([^"?]+)/)[1])
        .sort();
    assert.deepEqual(sheets, ['/styles/wabi.css', 'https://fonts.googleapis.com/css2']);
    assert.match(html, /family=LXGW\+WenKai\+TC/, '首页字体是霞鹜文楷 TC');
    assert.doesNotMatch(html, /clue-|hand3d|\/js\/three\/|home\.css|home\.js/, '首页不再引用线索墙和深色挂轴版的文件');
});

test('挂轴：姓名、四句、入口、作品和联系都是竖排', () => {
    for (const selector of ['.scroll-name', '.scroll-words', '.scroll-nav a', '.scroll-section-label', '.scroll-work', '.scroll-list', '.scroll-date']) {
        const block = css.match(new RegExp(`${selector.replace(/\./g, '\\.').replace(/ /g, '[^{]*')}[^{]*\\{([^}]*)\\}`));
        assert.ok(block, `样式里找不到 ${selector}`);
        assert.match(block[1], /writing-mode:\s*vertical-rl/, `${selector} 不是竖排`);
    }
});

test('配色是纸色、墨色和一种金色', () => {
    assert.match(css, /--paper:\s*#f0eee8/i);
    assert.match(css, /--ink:\s*#25231f/i);
    assert.match(css, /--gold:\s*#917347/i);
    assert.match(html, /<meta name="theme-color" content="#f0eee8">/i);
});

test('三种语言的文案一一对应，默认显示中文', () => {
    const count = (lang) => (html.match(new RegExp(`data-l="${lang}"`, 'g')) || []).length;
    assert.ok(count('zh') > 0);
    assert.equal(count('ja'), count('zh'), '日文和中文的文案数量不一致');
    assert.equal(count('en'), count('zh'), '英文和中文的文案数量不一致');
    assert.match(html, /<html lang="zh-CN"/);
    for (const [htmlLang, lang] of [['zh-CN', 'zh'], ['ja', 'ja'], ['en', 'en']]) {
        assert.ok(css.includes(`html[lang="${htmlLang}"] [data-l]:not([data-l="${lang}"])`), `样式里缺少 ${htmlLang} 的隐藏规则`);
    }
    const lines = (lang) => {
        const verse = html.match(new RegExp(`<div class="scroll-verse" data-l="${lang}"[^>]*>([\\s\\S]*?)</div>`));
        assert.ok(verse, `缺少 ${lang} 的介绍`);
        return (verse[1].match(/<p\b/g) || []).length;
    };
    assert.equal(lines('zh'), 5, '中文介绍是五列');
    assert.equal(lines('ja'), lines('zh'), '日文介绍和中文列数不一致');
    assert.equal(lines('en'), lines('zh'), '英文介绍和中文列数不一致');
    assert.match(html, /做有人类温度的产品/);
    assert.match(html, /极度克制的审美/);
    assert.doesNotMatch(html, /住在日本/, '首页不再写住在日本');
});

test('入口和联系方式都在，手机号与图片不上首页', () => {
    for (const href of ['/projects/', '/blog/', '/travel/', '/resume/', '/shop/', '/skill/', 'mailto:xiaobianfuai@gmail.com', 'https://github.com/cnYui']) {
        assert.ok(html.includes(`href="${href}"`), `首页缺少 ${href}`);
    }
    assert.match(html, /<h1>悠一<\/h1>/);
    assert.doesNotMatch(html, /1[3-9]\d{9}/, '首页不应出现手机号');
    assert.doesNotMatch(html, /<img\b/, '首页不放图片');
    assert.match(html, /data-season="mark"/, '落款要写当天的节气与候');
    assert.match(html, /data-season="line"/, '落款年份与节气');
});

test('茶叙：嵌飞书预约页，新窗口链接和嵌入页是同一个预约，server.js 的 CSP 允许它', () => {
    const embed = html.match(/<iframe src="https:\/\/([a-z0-9-]+\.feishu\.cn)\/scheduler\/embed\/([0-9a-f]+)"/);
    assert.ok(embed, '茶叙缺少飞书预约 iframe');
    assert.ok(html.includes(`href="https://${embed[1]}/scheduler/${embed[2]}"`), '「新窗口打开」要指向同一个预约页');
    assert.match(readFile('server.js'), /frame-src https:\/\/\*\.feishu\.cn;/, 'CSP 要放行飞书 iframe');
});

test('首屏语言：存储优先，其次浏览器语言，其余英语；检测结果不写回存储', () => {
    assert.equal(runSite({ stored: 'ja', languages: ['zh-CN'] }).documentElement.lang, 'ja');
    assert.equal(runSite({ languages: ['zh-TW', 'en'] }).documentElement.lang, 'zh-CN');
    assert.equal(runSite({ languages: ['ja-JP'] }).documentElement.lang, 'ja');
    assert.equal(runSite({ languages: ['fr-FR', 'en-GB'] }).documentElement.lang, 'en');
    assert.equal(runSite({ languages: ['ko-KR'] }).documentElement.lang, 'en');
    assert.equal(runSite({ stored: 'xx', languages: ['ja'] }).documentElement.lang, 'ja');
    assert.equal(runSite({ languages: ['zh-CN'] }).storage.writes, 0);
    assert.equal(runSite({ languages: ['ja'] }).document.title, '悠一 Yui');
    assert.equal(runSite({ languages: ['en'] }).document.title, 'Yui · 悠一');
});

test('点切换器才换语言、写回存储，并广播 languageChanged', () => {
    const run = runSite({ languages: ['zh-CN'] });
    run.listeners.DOMContentLoaded();
    const button = { getAttribute: () => 'en' };
    run.listeners.click({ target: { closest: () => button } });
    assert.equal(run.documentElement.lang, 'en');
    assert.equal(run.storage.value, 'en');
    assert.equal(run.events.length, 1);
    assert.equal(run.events[0].type, 'languageChanged');
    assert.equal(run.events[0].detail.lang, 'en');

    run.listeners.click({ target: { closest: () => null } });
    run.listeners.click({ target: { closest: () => ({ getAttribute: () => 'fr' }) } });
    run.listeners.click({ target: { closest: () => button } });
    assert.equal(run.documentElement.lang, 'en');
    assert.equal(run.storage.writes, 1);
    assert.equal(run.events.length, 1, '点当前语言不再广播');
    assert.equal(run.window.YuiLang.getCurrentLang(), 'en');
    assert.equal(run.window.YuiLang.getText('blog', 'tags'), 'Tags');
});

test('旧线索墙的锚点只在首页转到对应子页面', () => {
    for (const [hash, target] of [['#projects', '/projects/'], ['#blog', '/blog/'], ['#resume', '/resume/'], ['#travel', '/travel/'], ['#photos', '/travel/'], ['#shop', '/shop/']]) {
        assert.deepEqual(runSite({ hash }).replaced, [target], `${hash} 没有转到 ${target}`);
    }
    assert.deepEqual(runSite({ hash: '#blog', pathname: '/index.html' }).replaced, ['/blog/']);
    assert.deepEqual(runSite({ hash: '#about' }).replaced, []);
    assert.deepEqual(runSite({ hash: '#projects', pathname: '/blog/' }).replaced, [], '子页面的锚点不转');

    const run = runSite();
    run.location.hash = '#blog';
    run.windowListeners.hashchange();
    assert.deepEqual(run.replaced, ['/blog/']);
});

test('节气按北京时间推算：二〇二六年的二十四节气都落在正确的日子', () => {
    const { YuiSite } = runSite().window;
    const expected = [
        ['01-05', '小寒'], ['01-20', '大寒'], ['02-04', '立春'], ['02-18', '雨水'], ['03-05', '惊蛰'], ['03-20', '春分'],
        ['04-05', '清明'], ['04-20', '谷雨'], ['05-05', '立夏'], ['05-21', '小满'], ['06-05', '芒种'], ['06-21', '夏至'],
        ['07-07', '小暑'], ['07-23', '大暑'], ['08-07', '立秋'], ['08-23', '处暑'], ['09-07', '白露'], ['09-23', '秋分'],
        ['10-08', '寒露'], ['10-23', '霜降'], ['11-07', '立冬'], ['11-22', '小雪'], ['12-07', '大雪'], ['12-22', '冬至'],
    ];
    const noonInBeijing = (iso) => Date.parse(`2026-${iso}T12:00:00+08:00`);
    const dayBefore = (iso) => noonInBeijing(iso) - 86400000;
    for (const [day, term] of expected) {
        assert.equal(YuiSite.season(noonInBeijing(day), 'zh').term, term, `2026-${day} 应是${term}`);
        assert.notEqual(YuiSite.season(dayBefore(day), 'zh').term, term, `2026-${day} 前一天还不是${term}`);
    }
});

test('节气与七十二候按语言给字，年份用汉字数字', () => {
    const { YuiSite } = runSite().window;
    const now = Date.parse('2026-10-29T12:00:00+08:00');
    const zh = YuiSite.season(now, 'zh');
    assert.equal(zh.year, '二〇二六年');
    assert.equal(zh.term, '霜降');
    assert.equal(zh.pentad, '草木黄落');
    assert.equal(YuiSite.seasonText('mark', zh, 'zh'), '霜降　草木黄落');
    assert.equal(YuiSite.seasonText('line', zh, 'zh'), '二〇二六年　霜降');

    const ja = YuiSite.season(now, 'ja');
    assert.equal(ja.term, '霜降');
    assert.equal(ja.pentad, '霎時施');
    assert.equal(YuiSite.seasonText('line', ja, 'ja'), '二〇二六年　霜降');

    const en = YuiSite.season(now, 'en');
    assert.equal(YuiSite.seasonText('mark', en, 'en'), "Frost's Descent");
    assert.equal(YuiSite.seasonText('line', en, 'en'), "2026 · Frost's Descent");

    // 七十二候每 5° 一个、共 72 个，两套都排满。
    for (let k = 0; k < 72; k += 1) {
        const time = Date.parse('2026-03-20T12:00:00+08:00') + k * 5.07 * 86400000;
        assert.ok(YuiSite.season(time, 'zh').pentad, `第 ${k} 候中文缺字`);
        assert.ok(YuiSite.season(time, 'ja').pentad, `第 ${k} 候日文缺字`);
    }
});

test('墨洇：汉字、假名、标点逐个拆开，拉丁文按词，空白原样保留', () => {
    const { YuiSite } = runSite().window;
    assert.deepEqual([...YuiSite.inkTokens('讲一点 AI，也写代码。')], ['讲', '一', '点', ' ', 'AI', '，', '也', '写', '代', '码', '。']);
    assert.deepEqual([...YuiSite.inkTokens('とことん抑えた')], ['と', 'こ', 'と', 'ん', '抑', 'え', 'た']);
    assert.deepEqual([...YuiSite.inkTokens('talk a little')], ['talk', ' ', 'a', ' ', 'little']);
    assert.equal(YuiSite.inkTokens('LangGraph 1.0 同理').join(''), 'LangGraph 1.0 同理', '拆完拼回去要和原文一样');
});

test('墨洇的样式：拆出来的字从淡而模糊到清楚，减少动态效果时直接显示', () => {
    assert.match(css, /\.ink-ch\s*\{[^}]*opacity:\s*0;[^}]*filter:\s*blur\(4px\)/);
    assert.match(css, /\[data-ink="in"\] \.ink-ch\s*\{[^}]*opacity:\s*1/);
    assert.match(css, /html\.ink-on:not\(\.ink-ready\) main\s*\{\s*visibility:\s*hidden;\s*\}/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.ink-ch\s*\{[^}]*opacity:\s*1/);
    // 假环境里没有 IntersectionObserver：不应加上 ink-on，正文保持可见。
    assert.doesNotThrow(() => runSite());
});

test('页面上的 [data-season] 由 site.js 填字，切语言后跟着换', () => {
    const mark = fakeNode({ 'data-season': 'mark' });
    const line = fakeNode({ 'data-season': 'line' });
    const run = runSite({ languages: ['zh-CN'], nodes: [mark, line] });
    assert.ok(/^\S{2}　\S+$/.test(mark.textContent), `落款不是「节气　候」：${mark.textContent}`);
    assert.match(line.textContent, /^二〇[〇一二三四五六七八九]{2}年　\S{2}$/);

    run.listeners.DOMContentLoaded();
    run.listeners.click({ target: { closest: () => ({ getAttribute: () => 'en' }) } });
    assert.match(line.textContent, /^\d{4} · [A-Z]/);
});
