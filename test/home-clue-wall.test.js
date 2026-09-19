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

test('首页线索墙加载独立样式、档案数据和交互脚本', () => {
    const html = readFile('index.html');

    assert.match(html, /<link href="\/styles\/clue-wall\.css\?v=[^"]+" rel="stylesheet">/);
    assert.match(html, /<script src="\/js\/clue-data\.js\?v=[^"]+" defer><\/script>/);
    assert.match(html, /<script src="\/js\/clue-wall\.js\?v=[^"]+" defer><\/script>/);
    assert.ok(html.indexOf('/js/clue-data.js') < html.indexOf('/js/clue-wall.js'), '档案数据必须先于交互脚本加载');
});

test('墙上每张便签都能打开对应档案，每份档案都有便签入口和标题', () => {
    const html = readFile('index.html');
    const cardSections = new Set([...html.matchAll(/class="cw-card[^"]*" data-section="([^"]+)"/g)].map((match) => match[1]));
    const fileSections = [...html.matchAll(/<section class="cw-file[^"]*" data-file="([^"]+)" aria-labelledby="([^"]+)"/g)];

    assert.deepEqual([...cardSections].sort(), ['about', 'blog', 'photos', 'projects', 'resume']);
    assert.deepEqual(fileSections.map((match) => match[1]).sort(), [...cardSections].sort());
    for (const [, file, titleId] of fileSections) {
        assert.match(html, new RegExp(`<h2 class="cw-file-title" id="${titleId}">`), `${file} 档案缺少标题 ${titleId}`);
    }
});

test('首页保留到各个子页面的入口', () => {
    const html = readFile('index.html');

    for (const href of ['/projects/', '/blog/', '/travel/', '/resume/', '/shop/', '/files/WU_JIANXIANG_resume.pdf']) {
        assert.ok(html.includes(`href="${href}"`), `首页缺少 ${href} 入口`);
    }
});

test('线索墙档案数据引用的图片与文章都存在', () => {
    const data = loadClueData();

    for (const key of ['timeline', 'posts', 'photos', 'awards', 'keywords']) {
        assert.ok(Array.isArray(data[key]) && data[key].length > 0, `YuiClueData.${key} 为空`);
    }

    const images = [...data.timeline, ...data.posts, ...data.photos].map((item) => item.img).filter(Boolean);
    for (const image of images) {
        assert.match(image, /^\/images\/optimized\/clue-wall\/[a-z0-9-]+\.webp$/, `图片应使用 clue-wall 派生图：${image}`);
        assert.ok(fs.existsSync(path.join(rootDir, image)), `缺少图片 ${image}`);
    }

    for (const post of data.posts) {
        assert.match(post.link, /^\/blog\/[a-z0-9-]+$/, `文章链接应为站内路径：${post.link}`);
        assert.ok(fs.existsSync(path.join(rootDir, `${post.link}.html`)), `缺少文章 ${post.link}.html`);
    }
});
