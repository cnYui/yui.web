const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const readFile = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

function loadClueData() {
    const context = { window: {} };
    vm.runInNewContext(readFile('js/clue-data.js'), context);
    return context.window.YuiClueData;
}

function loadArticles() {
    const context = { window: { dispatchEvent() {} }, Event: function Event() {} };
    vm.runInNewContext(readFile('js/blog-articles.js'), context);
    return context.window.YuiArticles;
}

const SECTIONS = ['about', 'blog', 'projects', 'resume', 'shop', 'travel'];

test('首页线索墙加载独立样式、档案数据和交互脚本', () => {
    const html = readFile('index.html');

    assert.match(html, /<link href="\/styles\/clue-wall\.css\?v=[^"]+" rel="stylesheet">/);
    assert.match(html, /<script src="\/js\/clue-data\.js\?v=[^"]+" defer><\/script>/);
    assert.match(html, /<script src="\/js\/clue-wall\.js\?v=[^"]+" defer><\/script>/);
    assert.ok(html.indexOf('/js/clue-data.js') < html.indexOf('/js/clue-wall.js'), '档案数据必须先于交互脚本加载');
    // 文章正文有 60+ KB，首屏不该同步加载，由 clue-wall.js 在点开文章时按需插入。
    assert.ok(!/<script src="\/js\/blog-articles\.js/.test(html), 'blog-articles.js 不应在首页同步加载');
    assert.match(readFile('js/clue-wall.js'), /script\.src = '\/js\/blog-articles\.js\?v=[^']+'/);
});

test('墙上每张便签都能打开对应档案，每份档案都有便签入口和标题', () => {
    const html = readFile('index.html');
    const cardSections = new Set([...html.matchAll(/class="cw-card[^"]*" data-section="([^"]+)"/g)].map((match) => match[1]));
    const fileSections = [...html.matchAll(/<section class="cw-file[^"]*" data-file="([^"]+)" aria-labelledby="([^"]+)"/g)];

    assert.deepEqual([...cardSections].sort(), SECTIONS);
    assert.deepEqual(fileSections.map((match) => match[1]).sort(), SECTIONS);
    for (const [, file, titleId] of fileSections) {
        assert.match(html, new RegExp(`<h2 class="cw-file-title" id="${titleId}">`), `${file} 档案缺少标题 ${titleId}`);
    }
});

test('每张便签都标了自己的封面，取件动画才知道举的是哪一张', () => {
    const html = readFile('index.html');
    const cards = [...html.matchAll(/class="cw-card[^"]*" data-section="([^"]+)" data-card="([^"]+)" data-tilt="(-?[\d.]+)"/g)]
        .map(([, section, card, tilt]) => ({ section, card, tilt }));

    assert.equal(cards.length, 8, '墙上应有 8 张可点开的便签');
    assert.equal(new Set(cards.map((card) => card.card)).size, cards.length, 'data-card 不能重复');
    for (const card of cards) {
        assert.ok(Number.isFinite(Number(card.tilt)), `${card.card} 的 data-tilt 不是数字`);
    }

    // 封面按 data-card 找，找不到就退回该档案的封面（行踪图、肖像这类同档案的不同便签）。
    const script = readFile('js/clue-wall.js');
    const covers = new Set([...script.matchAll(/^\s{8}(\w+): \{ file:/gm)].map((match) => match[1]));
    assert.ok(covers.size > 0, '没有解析到 COVERS');
    for (const { card, section } of cards) {
        assert.ok(covers.has(card) || covers.has(section), `${card} 既没有自己的封面，也没有 ${section} 的封面兜底`);
    }
});

test('线索墙档案数据引用的图片与文章都存在', () => {
    const data = loadClueData();

    for (const key of ['timeline', 'projects', 'projectCats', 'posts', 'travel', 'travelCities', 'awards', 'keywords']) {
        assert.ok(Array.isArray(data[key]) && data[key].length > 0, `YuiClueData.${key} 为空`);
    }

    const images = [...data.timeline, ...data.projects, ...data.posts, ...data.travel].map((item) => item.img).filter(Boolean);
    for (const image of images) {
        assert.match(image, /^\/images\/optimized\/clue-wall\/[a-z0-9-]+\.webp$/, `图片应使用 clue-wall 派生图：${image}`);
        assert.ok(fs.existsSync(path.join(rootDir, image)), `缺少图片 ${image}`);
    }

    for (const post of data.posts) {
        assert.match(post.link, /^\/blog\/[a-z0-9-]+$/, `文章链接应为站内路径：${post.link}`);
        assert.ok(fs.existsSync(path.join(rootDir, `${post.link}.html`)), `缺少文章 ${post.link}.html`);
    }

    // 筛选标签的 id 必须能在数据里选出东西，否则点了会是空白。
    const cats = new Set(data.projects.map((item) => item.cat));
    for (const tab of data.projectCats.filter((tab) => tab.id !== 'all')) {
        assert.ok(cats.has(tab.id), `没有项目属于分类 ${tab.id}`);
    }
    const cities = new Set(data.travel.map((item) => item.city));
    for (const tab of data.travelCities.filter((tab) => tab.id !== 'all')) {
        assert.ok(cities.has(tab.id), `没有照片属于城市 ${tab.id}`);
    }
});

test('桌上的文章手稿覆盖每篇博客，图片都在站内', () => {
    const data = loadClueData();
    const articles = loadArticles();

    for (const post of data.posts) {
        const slug = post.link.replace(/\/$/, '').split('/').pop();
        const article = articles[slug];
        assert.ok(article, `缺少 ${slug} 的正文`);
        assert.ok(article.blocks.length > 0, `${slug} 正文为空`);
        assert.ok(article.title && article.date && article.readTime, `${slug} 缺少元信息`);
    }

    for (const article of Object.values(articles)) {
        for (const image of [article.hero, ...article.blocks.filter((block) => block.t === 'img').map((block) => block.src)].filter(Boolean)) {
            assert.match(image, /^\/images\/optimized\//, `文章图片应使用站内派生图：${image}`);
            assert.ok(fs.existsSync(path.join(rootDir, image)), `缺少文章图片 ${image}`);
        }
    }
});

test('3D 手全部自托管，且只在交互后懒加载', () => {
    const html = readFile('index.html');
    const wall = readFile('js/clue-wall.js');
    const hand = readFile('js/hand3d.js');

    // 首屏不能同步引它：整套 three.js 有 1 MB，只有真的要演取件时才值得下载。
    assert.ok(!/<script[^>]+hand3d\.js/.test(html), 'hand3d.js 不应在首页同步加载');
    assert.match(wall, /import\('\/js\/hand3d\.js\?v=[^']+'\)/, 'clue-wall.js 应该动态 import hand3d.js');
    assert.match(html, /id="cwHandCanvas"/);
    assert.match(html, /id="cwPropsCanvas"/);

    // CSP 是 script-src 'self' / connect-src 'self'：模型和库都必须是站内路径。
    assert.match(hand, /const HAND_URL = '\/files\/[^']+\.glb'/);
    const vendored = ['js/vendor/three.module.min.js', 'js/vendor/three.core.min.js', 'js/vendor/GLTFLoader.js', 'js/vendor/BufferGeometryUtils.js', 'js/vendor/SkeletonUtils.js'];
    for (const file of [...vendored, 'js/hand3d.js']) {
        assert.ok(fs.existsSync(path.join(rootDir, file)), `缺少 ${file}`);
        // 先去掉注释：GLTFLoader 的 JSDoc 里有 `@three_import ... from 'three/addons/...'` 这种示例。
        const source = readFile(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        for (const [, spec] of source.matchAll(/(?:^|[\s;}])(?:import|export)[^;]*?from\s*['"]([^'"]+)['"]/g)) {
            assert.ok(!/^https?:/.test(spec), `${file} 还在从 CDN 引 ${spec}`);
            assert.ok(spec.startsWith('.') || spec.startsWith('/'), `${file} 有裸导入 ${spec}，浏览器没有 import map 解析不了`);
        }
    }

    const glb = fs.readFileSync(path.join(rootDir, 'files/webxr-generic-hand-right.glb'));
    assert.equal(glb.subarray(0, 4).toString('ascii'), 'glTF', '手的模型不是有效的 glb');
});

test('首页保留到各个子页面的入口', () => {
    const html = readFile('index.html');

    for (const href of ['/projects/', '/blog/', '/travel/', '/resume/', '/shop/', '/files/WU_JIANXIANG_resume.pdf']) {
        assert.ok(html.includes(`href="${href}"`), `首页缺少 ${href} 入口`);
    }
});
