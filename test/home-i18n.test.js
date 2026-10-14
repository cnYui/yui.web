const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const readFile = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

const LANGS = ['zh', 'en', 'ja'];

function loadClueData() {
    const context = { window: {} };
    vm.runInNewContext(readFile('js/clue-data.js'), context);
    return context.window.YuiClueData;
}

function loadArticlePack(lang) {
    const context = { window: {} };
    vm.runInNewContext(readFile(`js/blog-articles.${lang}.js`), context);
    return context.window.YuiArticlesI18n[lang];
}

function loadZhArticles() {
    const context = { window: { dispatchEvent() {} }, Event: function Event() {} };
    vm.runInNewContext(readFile('js/blog-articles.js'), context);
    return context.window.YuiArticles;
}

// 在假 DOM 里跑 js/clue-i18n.js：只提供它用到的 document / window / localStorage / CustomEvent。
function loadEngine({ lang = 'zh' } = {}) {
    const events = [];
    const store = {};
    const html = {
        lang: 'zh-CN',
        attrs: new Set(['data-i18n-pending']),
        removeAttribute(name) { this.attrs.delete(name); },
        setAttribute(name) { this.attrs.add(name); }
    };
    const document = {
        documentElement: html,
        title: '',
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener() {}
    };
    const window = {
        YuiClueData: loadClueData(),
        YuiLangInit: { key: 'yui-portfolio-lang', lang, htmlLang: { zh: 'zh-CN', en: 'en', ja: 'ja' } },
        dispatchEvent: (event) => events.push(event),
        addEventListener() {}
    };
    class CustomEvent {
        constructor(type, init) { this.type = type; this.detail = init && init.detail; }
    }
    const context = {
        window,
        document,
        CustomEvent,
        localStorage: { getItem: (key) => (key in store ? store[key] : null), setItem: (key, value) => { store[key] = String(value); } }
    };
    vm.runInNewContext(readFile('js/clue-i18n.js'), context);
    return { i18n: window.YuiClueI18n, window, html, document, events, store };
}

// 跑 js/clue-lang-init.js：按存储 / 浏览器语言得出首屏语言。
function runLangInit({ stored = null, languages = ['zh-CN'], storageThrows = false } = {}) {
    const html = { lang: '', attrs: new Map(), setAttribute(name, value) { this.attrs.set(name, value); } };
    const context = {
        window: {},
        document: { documentElement: html },
        navigator: { languages, language: languages[0] },
        localStorage: {
            getItem() { if (storageThrows) throw new Error('blocked'); return stored; }
        }
    };
    vm.runInNewContext(readFile('js/clue-lang-init.js'), context);
    return { lang: context.window.YuiLangInit.lang, htmlLang: html.lang, pending: html.attrs.has('data-i18n-pending') };
}

// 取出 index.html 里带 data-i18n 的节点：html 型取 innerHTML，文本型取解码后的 textContent。
function extractMarkers(html) {
    const decode = (text) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const texts = new Map();
    const attrs = [];
    const tagRe = /<([a-z0-9]+)\b([^>]*?)>/gi;
    let match;
    while ((match = tagRe.exec(html))) {
        const [full, name, rest] = match;
        const key = /\sdata-i18n="([^"]+)"/.exec(` ${rest}`);
        if (key) {
            const isHtml = /\sdata-i18n-html(?=\s|$)/.test(` ${rest}`);
            const re = new RegExp(`<(/?)${name}\\b[^>]*?(/?)>`, 'gi');
            re.lastIndex = match.index + full.length;
            let depth = 1;
            let close;
            let end = -1;
            while ((close = re.exec(html))) {
                if (close[2] === '/') continue;
                depth += close[1] ? -1 : 1;
                if (depth === 0) { end = close.index; break; }
            }
            const inner = html.slice(match.index + full.length, end);
            assert.ok(!texts.has(key[1]), `data-i18n 键重复：${key[1]}`);
            texts.set(key[1], isHtml ? inner : decode(inner));
        }
        const attrMarker = /\sdata-i18n-attrs="([^"]+)"/.exec(` ${rest}`);
        if (attrMarker) {
            attrMarker[1].split(';').forEach((pair) => {
                const at = pair.indexOf(':');
                const attr = pair.slice(0, at).trim();
                const attrKey = pair.slice(at + 1).trim();
                const value = new RegExp(`\\s${attr}="([^"]*)"`).exec(` ${rest}`);
                assert.ok(value, `${attrKey} 指向的属性 ${attr} 不存在`);
                attrs.push({ key: attrKey, attr, value: decode(value[1]) });
            });
        }
    }
    return { texts, attrs };
}

const html = readFile('index.html');
const { i18n: engine } = loadEngine();
const TEXT = engine.text;

test('首页加载语言预处理、词典和切换器，且顺序正确', () => {
    // 预处理必须是 <head> 里第一个同步脚本，且在样式之前执行，首屏绘制前就定下语言。
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    const syncScripts = [...head.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]).filter((tag) => !/\bdefer\b/.test(tag));
    assert.equal(syncScripts.length, 1, 'head 里只该有一个同步脚本');
    assert.match(syncScripts[0], /src="\/js\/clue-lang-init\.js\?v=[^"]+"/);
    assert.ok(head.indexOf('clue-lang-init.js') < head.indexOf('clue-wall.css'));

    // 词典在档案数据之后、交互脚本之前（clue-wall.js 启动时就要用本地化后的数据）。
    const order = ['clue-data.js', 'clue-i18n.js', 'clue-wall.js', 'github-contributions.js'].map((name) => html.indexOf(`/js/${name}`));
    assert.ok(order.every((index) => index > 0), '缺少脚本引用');
    assert.deepEqual([...order].sort((a, b) => a - b), order, '脚本顺序应为 clue-data → clue-i18n → clue-wall → github-contributions');
    assert.match(html, /<script src="\/js\/clue-i18n\.js\?v=[^"]+" defer><\/script>/);

    // 右上角的切换器：三个按钮，中文默认选中。
    const buttons = [...html.matchAll(/<button class="cw-lang-btn[^"]*" type="button" data-lang="(\w+)" lang="([\w-]+)" aria-pressed="(\w+)">([^<]+)<\/button>/g)];
    assert.deepEqual(buttons.map((match) => match[1]), LANGS);
    assert.deepEqual(buttons.map((match) => match[3]), ['true', 'false', 'false']);
    assert.deepEqual(buttons.map((match) => match[4]), ['中文', 'EN', '日本語'], '按钮用各语言自己的名字');
    assert.match(html, /role="group" aria-label="[^"]*Language[^"]*"/);
});

test('每个词典键都有中 / 英 / 日三种文案', () => {
    const keys = Object.keys(TEXT);
    assert.ok(keys.length > 100, '词典键太少，是不是没加载到');
    for (const key of keys) {
        for (const lang of LANGS) {
            assert.equal(typeof TEXT[key][lang], 'string', `${key} 缺少 ${lang}`);
        }
        for (const lang of LANGS) {
            assert.ok(TEXT[key][lang].trim(), `${key} 的 ${lang} 为空`);
        }
    }
    // 占位符三种语言要一致，否则某个语言会漏掉数据。
    for (const key of keys) {
        const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort().join(',');
        const base = placeholders(TEXT[key].zh);
        for (const lang of ['en', 'ja']) assert.equal(placeholders(TEXT[key][lang]), base, `${key} 的 ${lang} 占位符和中文不一致`);
    }
});

test('index.html 里的中文和词典 zh 一致，词典没有多余或缺失的键', () => {
    const { texts, attrs } = extractMarkers(html);
    assert.ok(texts.size > 90, `只解析到 ${texts.size} 个 data-i18n 节点`);

    for (const [key, value] of texts) {
        assert.ok(TEXT[key], `词典缺少 ${key}`);
        assert.equal(TEXT[key].zh, value, `${key}：index.html 和词典 zh 对不上，改一边要改另一边`);
    }
    for (const { key, attr, value } of attrs) {
        assert.ok(TEXT[key], `词典缺少 ${key}`);
        assert.equal(TEXT[key].zh, value, `${key}（${attr}）：index.html 和词典 zh 对不上`);
    }

    const title = /<title>([^<]*)<\/title>/.exec(html)[1];
    const description = /<meta name="description" content="([^"]*)">/.exec(html)[1];
    assert.equal(TEXT['meta.title'].zh, title);
    assert.equal(TEXT['meta.description'].zh, description);

    // 不在 index.html 里的键必须真的被脚本用到，不然就是死键。
    const htmlKeys = new Set([...texts.keys(), ...attrs.map((item) => item.key), 'meta.title', 'meta.description']);
    const scripts = ['js/clue-wall.js', 'js/github-contributions.js', 'js/clue-i18n.js'].map(readFile).join('\n');
    for (const key of Object.keys(TEXT)) {
        if (htmlKeys.has(key)) continue;
        const prefix = key.split('.').slice(0, -1).join('.');
        const used = scripts.includes(`'${key}'`) || scripts.includes(`\`${prefix}.`) || scripts.includes(`'${prefix}.'`);
        assert.ok(used, `词典键 ${key} 没有被 index.html 或脚本引用`);
    }
});

// 手里举着的封面只有一个大标题，且和墙上那张便签的大标签是同一个词：封面直接按便签标签的键取词，
// 脚本里写死的中文只是词典没加载上时的兜底，要和词典 zh 一致。
test('封面标题取自便签标签的词典键，兜底文案和词典 zh 一致，覆盖每张可点开的便签', () => {
    const script = readFile('js/clue-wall.js');
    const covers = [...script.matchAll(/^\s{8}(\w+): \{ key: '([^']*)', title: '([^']*)'/gm)];
    assert.equal(covers.length, 6);
    const labelKeys = new Set([...html.matchAll(/data-i18n="(wall\.[a-z]+\.(?:title|caption))"/g)].map((match) => match[1]));
    for (const [, name, key, title] of covers) {
        assert.ok(labelKeys.has(key), `${name} 的封面键 ${key} 不是墙上某张便签的大标签`);
        assert.equal(TEXT[key].zh, title, `${name} 的封面兜底文案和词典 zh 不一致`);
    }
    for (const category of ['award', 'hackathon', 'meetup', 'project']) {
        assert.ok(TEXT[`cat.${category}`], `缺少分类 ${category} 的标签`);
    }
});

// 点开前后叫法一致：便签上叫「项目」，打开的档案标题也是「项目」，而不是另起一个侦探味的名字。
test('档案标题和墙上便签的大标签是同一个词，三种语言都一致', () => {
    const pairs = [
        ['wall.about.title', 'about.title'],
        ['wall.projects.title', 'projects.title'],
        ['wall.blog.title', 'blog.title'],
        ['wall.resume.title', 'resume.title'],
        ['wall.map.title', 'travel.title'],
        ['wall.shop.title', 'shop.title']
    ];
    for (const [card, file] of pairs) {
        for (const lang of LANGS) assert.equal(TEXT[file][lang], TEXT[card][lang], `${file} 和 ${card} 的 ${lang} 叫法不一致`);
    }
});

// 墙上和档案页头的文案只用当前语言写一遍：不能再有「FILE 01 · 关于我」「机密 CONFIDENTIAL」这种中英混排。
// 中文 / 日文里不许出现 4 个以上连续大写字母的英文词（品牌和证书名在这里登记），英文里不许夹汉字假名。
test('墙上和档案页头的文案是单一语言，不再中英混排', () => {
    const prefixes = ['wall.', 'ui.'];
    const extra = ['about.title', 'about.stamp', 'projects.title', 'projects.count', 'blog.title', 'blog.sub', 'resume.title', 'travel.title', 'shop.title', 'shop.sub', 'shop.stamp', 'github.unit', 'github.unit.one'];
    const keys = Object.keys(TEXT).filter((key) => prefixes.some((prefix) => key.startsWith(prefix)) || extra.includes(key));
    assert.ok(keys.length > 40, '没筛到要检查的键');

    const ALLOWED = ['TOEIC', 'TOEFL'];
    const strip = (text) => ALLOWED.reduce((out, word) => out.split(word).join(''), text);
    for (const key of keys) {
        for (const lang of ['zh', 'ja']) {
            const value = strip(TEXT[key][lang]);
            const shouting = value.match(/[A-Z]{4,}/g);
            assert.equal(shouting, null, `${key} 的 ${lang} 里还有英文大写标签 ${shouting}：${TEXT[key][lang]}`);
        }
        assert.doesNotMatch(TEXT[key].en, /[ぁ-ヿ一-鿿]/, `${key} 的英文里夹着汉字 / 假名：${TEXT[key].en}`);
    }
});

// 墙上便签里的数字（项目数、奖项数、文章数）数的是档案数据，而不是写死的：新增一条数据后会自己变。
// index.html 里写着数字的静态版本是脚本没跑起来时看到的，不能和数据脱节。
test('墙上的统计数字来自档案数据，静态版本和词典模板都对得上', () => {
    const data = loadClueData();
    const awards = data.projects.filter((item) => item.cat === 'award').length;
    const numbersIn = (text) => (text.match(/\d+/g) || []).map(Number);
    const staticStat = (name) => {
        const match = new RegExp(`data-stat="${name}">(.*?)</div>`).exec(html);
        assert.ok(match, `index.html 里没有 data-stat="${name}"`);
        assert.equal((match[1].match(/<b>\d+<\/b>/g) || []).length, numbersIn(match[1]).length, '数字都要用 <b> 包起来');
        return numbersIn(match[1]);
    };
    assert.deepEqual(staticStat('projects'), [data.projects.length, awards], '项目卡片的静态数字和 clue-data.js 对不上');
    assert.deepEqual(staticStat('blog'), [data.posts.length], '博客卡片的静态数字和 clue-data.js 对不上');
    assert.deepEqual(numbersIn(/id="cwProjectCount">([^<]*)</.exec(html)[1]), [data.projects.length, data.projects.length], '项目档案的计数章和 clue-data.js 对不上');
    assert.ok(awards > 0 && data.posts.length > 0);

    // 三种语言的模板都要带齐占位符，填进去之后数字原样出现。
    const { i18n } = loadEngine();
    for (const lang of LANGS) {
        i18n.setLang(lang, false);
        const projects = i18n.t('wall.projects.stat', { n: '<b>25</b>', a: '<b>6</b>' });
        assert.ok(projects.includes('<b>25</b>') && projects.includes('<b>6</b>'), `${lang} 的 wall.projects.stat 缺占位符：${projects}`);
        assert.ok(i18n.t('wall.blog.stat', { n: '<b>7</b>' }).includes('<b>7</b>'), `${lang} 的 wall.blog.stat 缺占位符`);
        const count = i18n.t('projects.count', { n: 6, all: 25 });
        assert.ok(/\b6\b/.test(count) && /\b25\b/.test(count), `${lang} 的 projects.count 缺占位符：${count}`);
    }
});

test('英 / 日档案数据按下标对齐 clue-data.js，字段齐全', () => {
    const base = loadClueData();
    const fields = {
        projects: ['title', 'desc', 'city'],
        projectCats: ['label'],
        posts: ['title', 'excerpt', 'read'],
        travel: ['title', 'en', 'desc'],
        travelCities: ['label'],
        awards: ['t'],
        keywords: ['t']
    };
    for (const lang of ['en', 'ja']) {
        const pack = engine.packs[lang];
        assert.deepEqual(Object.keys(pack).sort(), Object.keys(fields).sort(), `${lang} 覆盖的数据集不对`);
        for (const [key, names] of Object.entries(fields)) {
            assert.equal(pack[key].length, base[key].length, `${lang}.${key} 条数和 clue-data.js 不一致（新增了数据没补译文？）`);
            pack[key].forEach((item, index) => {
                for (const name of names) {
                    assert.ok(typeof item[name] === 'string' && item[name].trim(), `${lang}.${key}[${index}].${name} 为空`);
                }
            });
        }
    }
    // 筛选标签的 id 不翻译：翻译只覆盖 label，所以 id 仍能选出东西。
    assert.ok(!('id' in engine.packs.en.projectCats[0]));
});

test('引擎：切换语言后文案、数据、文章按语言取，没有译文时退回中文', () => {
    const { i18n, window, html: htmlEl, events, store } = loadEngine({ lang: 'zh' });
    const zhData = window.YuiClueData;

    assert.equal(i18n.lang, 'zh');
    assert.equal(i18n.data(), zhData, '中文直接用原始数据，不复制');
    assert.equal(i18n.t('link.read'), TEXT['link.read'].zh);
    assert.equal(i18n.t('post.kicker', { date: '2026.06.16' }), 'AI · 2026.06.16');
    assert.equal(i18n.t('no.such.key'), 'no.such.key', '没有的键原样返回，便于一眼看出');
    assert.ok(!htmlEl.attrs.has('data-i18n-pending'), '启动后要摘掉首屏隐藏标记');

    i18n.setLang('ja', true);
    assert.equal(i18n.lang, 'ja');
    assert.equal(htmlEl.lang, 'ja');
    assert.equal(store['yui-portfolio-lang'], 'ja', '点切换器才写存储，且和子页面共用同一个 key');
    assert.equal(events.at(-1).type, 'yui-clue-lang');
    assert.equal(events.at(-1).detail.lang, 'ja');
    assert.equal(i18n.t('link.read'), '読む · READ →');
    assert.equal(i18n.data().projects[0].city, '大阪 Osaka');
    assert.equal(i18n.data().projects[0].img, zhData.projects[0].img, '图片、链接这类字段不翻译，沿用原数据');
    assert.equal(i18n.data().projectCats[1].id, 'award', '筛选 id 不变');
    assert.equal(i18n.data(), i18n.data(), '同一语言重复取要走缓存');

    i18n.setLang('en', false);
    // 新文章会插在最前面，所以按链接定位，不写死下标。
    const codex = zhData.posts.findIndex((post) => post.link === '/blog/codex-token-low-cost');
    assert.ok(codex >= 0);
    assert.equal(i18n.data().posts[codex].read, '7 min');
    assert.ok(i18n.data().posts.every((post) => /^\d+ min$/.test(post.read)), '英文的阅读时长都应是 "N min"');
    assert.equal(i18n.data().travel[0].title, 'Eiheiji Temple');
    assert.equal(htmlEl.lang, 'en');
    const before = events.length;
    i18n.setLang('en', false);
    assert.equal(events.length, before, '切到当前语言不应重复触发重绘');
    i18n.setLang('fr', true);
    assert.equal(i18n.lang, 'en', '不支持的语言忽略');
    assert.equal(store['yui-portfolio-lang'], 'ja', '忽略的语言也不能写进存储');

    // 文章：有译文包用译文，blocks 为 null 的退回中文正文并标记 translated: false。
    window.YuiArticles = { a: { title: '中', blocks: [{ t: 'p', s: '中文' }], tags: ['t'] }, b: { title: '乙', blocks: [{ t: 'p', s: '乙文' }], tags: ['t'] } };
    assert.equal(i18n.articlePackReady(), false, '还没加载译文包');
    window.YuiArticlesI18n = { en: { a: { title: 'EN', blocks: [{ t: 'p', s: 'english' }], tags: ['e'] }, b: { title: 'EN-B', blocks: null, tags: ['e'] } } };
    assert.equal(i18n.articlePackReady(), true);
    assert.equal(i18n.article('a').title, 'EN');
    assert.equal(i18n.article('a').translated, true);
    assert.equal(i18n.article('b').title, 'EN-B');
    assert.deepEqual(i18n.article('b').blocks, [{ t: 'p', s: '乙文' }]);
    assert.equal(i18n.article('b').translated, false);
    assert.equal(i18n.article('missing'), null);
    i18n.setLang('zh', false);
    assert.equal(i18n.article('a').title, '中');
    assert.equal(i18n.articlePackReady(), true, '中文不需要译文包');
});

test('首屏语言：存储优先，其次浏览器语言，其余英语；只有非中文才藏墙', () => {
    assert.deepEqual(runLangInit({ stored: 'ja', languages: ['zh-CN'] }), { lang: 'ja', htmlLang: 'ja', pending: true });
    assert.deepEqual(runLangInit({ stored: 'zh', languages: ['ja'] }), { lang: 'zh', htmlLang: 'zh-CN', pending: false });
    assert.equal(runLangInit({ languages: ['zh-Hans-CN', 'en-US'] }).lang, 'zh');
    assert.equal(runLangInit({ languages: ['ja-JP'] }).lang, 'ja');
    assert.equal(runLangInit({ languages: ['en-GB', 'ja'] }).lang, 'en', '按浏览器偏好顺序，第一个能识别的为准');
    assert.equal(runLangInit({ languages: ['fr-FR', 'ja'] }).lang, 'ja', '不认识的语言跳过，看下一个');
    assert.equal(runLangInit({ languages: ['fr-FR'] }).lang, 'en', '都不认识就用英语');
    assert.equal(runLangInit({ stored: 'xx', languages: ['ja'] }).lang, 'ja', '存储里是脏值就当没存');
    assert.equal(runLangInit({ storageThrows: true, languages: ['ja'] }).lang, 'ja', '读存储抛错（隐私模式）时退回浏览器语言');
});

test('文章译文包：每篇都有元信息，译文正文的图片都在站内', () => {
    const zh = loadZhArticles();
    for (const lang of ['en', 'ja']) {
        const pack = loadArticlePack(lang);
        assert.deepEqual(Object.keys(pack).sort(), Object.keys(zh).sort(), `${lang} 译文包的文章和中文不一致，重新跑 node scripts/build-blog-articles.js`);
        for (const [slug, article] of Object.entries(pack)) {
            for (const field of ['title', 'date', 'readTime', 'excerpt']) {
                assert.ok(article[field] && article[field].trim(), `${lang}/${slug} 缺少 ${field}`);
            }
            assert.ok(Array.isArray(article.tags), `${lang}/${slug} 的 tags 不是数组`);
            assert.ok(article.blocks === null || (Array.isArray(article.blocks) && article.blocks.length > 0), `${lang}/${slug} 的 blocks 要么为 null 要么非空`);
            for (const block of article.blocks || []) {
                if (block.t !== 'img') continue;
                assert.match(block.src, /^\/images\/optimized\//, `${lang}/${slug} 的图片应使用站内派生图：${block.src}`);
                assert.ok(fs.existsSync(path.join(rootDir, block.src)), `${lang}/${slug} 缺少图片 ${block.src}`);
            }
        }
    }
    // 至少有几篇真的有译文，否则等于没做。
    assert.ok(Object.values(loadArticlePack('en')).filter((article) => article.blocks).length >= 3);
    assert.ok(Object.values(loadArticlePack('ja')).filter((article) => article.blocks).length >= 4);
    // 译文包必须按需加载，不能在首屏同步引。
    assert.ok(!/blog-articles\.(?:en|ja)\.js/.test(html), '译文包不应在首页同步加载');
    assert.match(readFile('js/clue-wall.js'), /blog-articles\.\$\{lang\.lang\}\.js\?v=\$\{ARTICLES_VERSION\}/);
});

test('样式：切换器压在档案上面，首屏隐藏有兜底，日文字体走变量', () => {
    const css = readFile('styles/clue-wall.css');
    const toolbar = /\.cw-toolbar \{[^}]*z-index: (\d+)/.exec(css);
    const desk = /\.cw-desk-layer \{[^}]*z-index: (\d+)/.exec(css);
    assert.ok(toolbar && desk && Number(toolbar[1]) > Number(desk[1]), '工具栏层级要高于桌上的档案，读档案时才能切语言');

    // 脚本没加载上也不能一直黑屏：隐藏样式必须带延时显示的动画。
    assert.match(css, /html\[data-i18n-pending\] \.cw-root \{[^}]*visibility: hidden;[^}]*animation: cw-i18n-reveal 0s linear 1\.5s forwards/);
    assert.match(css, /@keyframes cw-i18n-reveal \{[^}]*visibility: visible/);

    // 衬线体只在变量里写一次，日文时换成日文明朝体，避免汉字用到简体字形。
    assert.equal((css.match(/'Noto Serif SC'/g) || []).length, 1, '衬线体字面量只该出现在 --cw-serif 的定义里');
    assert.match(css, /:lang\(ja\) \.cw-root \{\s*--cw-serif:[^;]*'Yu Mincho'/);
});

test('简历下载对话框的文案三种语言键一致，占位符齐全', () => {
    const source = readFile('js/resume-download.js');
    const block = /var TEXT = (\{[\s\S]*?\n    \});/.exec(source);
    assert.ok(block, '没找到对话框词典');
    const dictionary = vm.runInNewContext(`(${block[1]})`);
    assert.deepEqual(Object.keys(dictionary).sort(), LANGS.slice().sort());
    const keys = Object.keys(dictionary.zh).sort();
    for (const lang of ['en', 'ja']) assert.deepEqual(Object.keys(dictionary[lang]).sort(), keys, `${lang} 的键和中文不一致`);
    for (const key of keys) {
        for (const lang of LANGS) assert.ok(dictionary[lang][key].trim(), `${lang}.${key} 为空`);
        const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort().join(',');
        for (const lang of ['en', 'ja']) assert.equal(placeholders(dictionary[lang][key]), placeholders(dictionary.zh[key]), `${key} 的 ${lang} 占位符不一致`);
    }
    // 对话框里不能再有写死的中文（除了词典）。
    const withoutDictionary = source.replace(block[0], '');
    assert.ok(!/[一-鿿]/.test(withoutDictionary.replace(/\/\/.*$/gm, '')), '词典之外还有写死的中文文案');
});
