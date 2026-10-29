const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const readFile = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');
const html = readFile('index.html');
const css = readFile('styles/home.css');

// 在假环境里跑 js/home.js：只提供它用到的 navigator / localStorage / location / document。
function runHome({ stored = null, languages = ['zh-CN'], hash = '' } = {}) {
    const replaced = [];
    const listeners = {};
    const windowListeners = {};
    const documentElement = { lang: 'zh-CN' };
    const storage = { value: stored, writes: 0 };
    const location = { hash, replace: (url) => replaced.push(url) };
    const context = {
        navigator: { languages, language: languages[0] },
        localStorage: {
            getItem: () => storage.value,
            setItem: (key, value) => { storage.value = value; storage.writes += 1; },
        },
        location,
        document: {
            documentElement,
            querySelectorAll: () => [],
            addEventListener: (type, listener) => { listeners[type] = listener; },
        },
        window: {
            addEventListener: (type, listener) => { windowListeners[type] = listener; },
        },
    };
    vm.runInNewContext(readFile('js/home.js'), context);
    return { replaced, listeners, windowListeners, location, documentElement, storage };
}

test('首页只在 <head> 里同步加载 home.js，样式只有 home.css 和 Google Fonts', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.equal(scripts.length, 1, '首页只应有一个脚本');
    assert.match(scripts[0][1], /^\s*src="\/js\/home\.js\?v=[^"]+"\s*$/, 'home.js 必须是同步的 <script src>，不带 defer / async');
    assert.equal(scripts[0][2].trim(), '');
    assert.ok(scripts[0].index < html.indexOf('</head>'), 'home.js 必须在 <head> 里');

    const sheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)]
        .map((match) => match[0].match(/href="([^"?]+)/)[1])
        .sort();
    assert.deepEqual(sheets, ['/styles/home.css', 'https://fonts.googleapis.com/css2']);
    assert.doesNotMatch(html, /clue-|hand3d|\/js\/three\//, '首页不再引用线索墙的脚本和样式');
});

test('竖排：姓名、介绍、联系和入口都是 vertical-rl', () => {
    for (const selector of ['.ink-name', '.ink-verse', '.ink-contact', '.ink-nav a']) {
        const block = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
        assert.ok(block, `样式里找不到 ${selector}`);
        assert.match(block[1], /writing-mode:\s*vertical-rl/, `${selector} 不是竖排`);
    }
});

test('配色取金缮：灰釉深底、骨白字，金色只有一种', () => {
    assert.match(css, /--ground:\s*#1e1d1a/i);
    assert.match(css, /--ink:\s*#d2ccc0/i);
    assert.match(css, /--gold:\s*#b0925a/i);
    assert.match(html, /<meta name="theme-color" content="#1e1d1a">/i);
});

test('三种语言的文案一一对应，默认显示中文', () => {
    const count = (lang) => (html.match(new RegExp(`data-l="${lang}"`, 'g')) || []).length;
    assert.ok(count('zh') > 0);
    assert.equal(count('ja'), count('zh'), '日文和中文的文案数量不一致');
    assert.equal(count('en'), count('zh'), '英文和中文的文案数量不一致');
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(css, /\[data-l\]\s*\{\s*display:\s*none;?\s*\}/);
    for (const [htmlLang, lang] of [['zh-CN', 'zh'], ['ja', 'ja'], ['en', 'en']]) {
        assert.ok(css.includes(`html[lang="${htmlLang}"] [data-l="${lang}"]`), `样式里缺少 ${htmlLang} 的显示规则`);
    }
    for (const lang of ['zh', 'ja', 'en']) {
        const verse = html.match(new RegExp(`<div class="ink-verse" data-l="${lang}"[^>]*>([\\s\\S]*?)</div>`));
        assert.ok(verse, `缺少 ${lang} 的介绍`);
        assert.equal((verse[1].match(/<p\b/g) || []).length, 4, `${lang} 的介绍应是四句`);
    }
});

test('只留最基本的信息：子页面入口和联系方式都在，手机号不上首页', () => {
    for (const href of ['/projects/', '/blog/', '/resume/', '/travel/', '/shop/', 'mailto:xiaobianfuai@gmail.com', 'https://github.com/cnYui', 'https://aaccx.pw/SKILL.md']) {
        assert.ok(html.includes(`href="${href}"`), `首页缺少 ${href}`);
    }
    assert.match(html, /<h1>悠一<\/h1>/);
    assert.doesNotMatch(html, /1[3-9]\d{9}/, '首页不应出现手机号');
    assert.doesNotMatch(html, /<img\b/, '首页不放图片');
});

test('首屏语言：存储优先，其次浏览器语言，其余英语；检测结果不写回存储', () => {
    assert.equal(runHome({ stored: 'ja', languages: ['zh-CN'] }).documentElement.lang, 'ja');
    assert.equal(runHome({ languages: ['zh-TW', 'en'] }).documentElement.lang, 'zh-CN');
    assert.equal(runHome({ languages: ['ja-JP'] }).documentElement.lang, 'ja');
    assert.equal(runHome({ languages: ['fr-FR', 'en-GB'] }).documentElement.lang, 'en');
    assert.equal(runHome({ languages: ['ko-KR'] }).documentElement.lang, 'en');
    assert.equal(runHome({ stored: 'xx', languages: ['ja'] }).documentElement.lang, 'ja');
    assert.equal(runHome({ languages: ['zh-CN'] }).storage.writes, 0);
});

test('点切换器才换语言并写回存储', () => {
    const run = runHome({ languages: ['zh-CN'] });
    run.listeners.DOMContentLoaded();
    const button = { getAttribute: () => 'en' };
    run.listeners.click({ target: { closest: () => button } });
    assert.equal(run.documentElement.lang, 'en');
    assert.equal(run.storage.value, 'en');

    run.listeners.click({ target: { closest: () => null } });
    run.listeners.click({ target: { closest: () => ({ getAttribute: () => 'fr' }) } });
    assert.equal(run.documentElement.lang, 'en');
    assert.equal(run.storage.writes, 1);
});

test('旧线索墙的锚点转到对应子页面，#about 留在首页', () => {
    for (const [hash, target] of [['#projects', '/projects/'], ['#blog', '/blog/'], ['#resume', '/resume/'], ['#travel', '/travel/'], ['#photos', '/travel/'], ['#shop', '/shop/']]) {
        assert.deepEqual(runHome({ hash }).replaced, [target], `${hash} 没有转到 ${target}`);
    }
    assert.deepEqual(runHome({ hash: '#about' }).replaced, []);
    assert.deepEqual(runHome({ hash: '' }).replaced, []);

    // 停在首页时手动改锚点：页面不会重新加载，靠 hashchange 转走。
    const run = runHome();
    run.location.hash = '#blog';
    run.windowListeners.hashchange();
    assert.deepEqual(run.replaced, ['/blog/']);
});
