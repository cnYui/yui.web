const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');
const readFile = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8').replace(/\r\n/g, '\n');

const html = readFile('index.html');
const css = readFile('styles/clue-wall.css');
const script = readFile('js/clue-wall.js');

// 桌面上的档案（点开便签后摊在桌上的那张纸）的标记和样式。
const sheetHtml = html.slice(html.indexOf('<div class="cw-sheet"'), html.indexOf('<canvas class="cw-canvas cw-canvas--props"'));
const sheetCss = css.slice(css.indexOf('/* ---- 桌面上的档案'), css.indexOf('/* ---- 降低动效'));
const desktopCss = sheetCss.slice(0, sheetCss.indexOf('/* ---- 窄屏'));
const narrowCss = sheetCss.slice(sheetCss.indexOf('/* ---- 窄屏'));

function rule(source, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(source);
    assert.ok(match, `样式里找不到 ${selector}`);
    return match[1];
}

const px = (declarations, property) => {
    // font-size 也接受 font 简写里的那个 px（font: 400 22px/1.65 serif）。
    const pattern = property === 'font-size'
        ? /(?:font-size:\s*|font:\s*[^;]*?)(\d+(?:\.\d+)?)px/
        : new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)px`);
    const match = pattern.exec(declarations);
    assert.ok(match, `没有 ${property}`);
    return Number(match[1]);
};

test('档案里没有印章、胶带、图钉、分类标签这些装饰，只剩返回键和大标题', () => {
    assert.ok(sheetHtml.length > 1000 && sheetCss.length > 1000, '没截到档案的标记或样式');

    for (const leftover of ['cw-stamp', 'cw-tabs', 'cw-tab"', 'cw-pin', 'cw-file-strings', 'data-filter', 'cw-post-tape', 'cw-case', 'cw-sighting']) {
        assert.ok(!sheetHtml.includes(leftover), `档案标记里还有 ${leftover}`);
    }
    for (const leftover of ['.cw-stamp', '.cw-tab', '.cw-case', '.cw-sighting', '.cw-dossier', '.cw-file-strings', '.cw-post-tape', '.cw-blk-img-tape']) {
        assert.ok(!css.includes(leftover), `样式里还有 ${leftover}`);
    }
    // 纸上不再有倾斜的小纸片：没有 rotate，也没有靠 --rot 倾斜。
    assert.doesNotMatch(desktopCss, /rotate\(/, '档案里的纸不该再倾斜');
    assert.doesNotMatch(desktopCss, /--rot/);

    // 六份档案共用同一个骨架：一个大标题 + 一个返回键（返回键全局只有一个）。
    const files = [...sheetHtml.matchAll(/<section class="cw-file cw-file--(\w+)"[^>]*>/g)].map((match) => match[1]);
    assert.deepEqual(files.sort(), ['about', 'blog', 'projects', 'resume', 'shop', 'travel']);
    assert.equal((sheetHtml.match(/<h2 class="cw-file-title"/g) || []).length, 6);
    assert.equal((sheetHtml.match(/id="cwBack"/g) || []).length, 1);
});

test('档案里的字不再小：设计尺寸下的字号都不小于 17px（代码块的小标签除外）', () => {
    const small = [];
    for (const [, selector, body] of desktopCss.matchAll(/\n([^\n{}@/][^{}]*?)\s*\{([^}]*)\}/g)) {
        for (const declaration of body.split(';')) {
            const match = /^\s*(?:font-size:\s*|font:\s*[^;]*?)(\d+(?:\.\d+)?)px/.exec(declaration);
            if (match && Number(match[1]) < 17 && !/\.cw-blk-code-kicker/.test(selector)) small.push(`${selector.trim()} → ${match[1]}px`);
        }
    }
    assert.deepEqual(small, [], '这些规则的字号太小，纸缩小之后读不清');
});

test('档案的内容区是一整块可滚动的区域，键盘和滚轮都能用', () => {
    const pane = rule(desktopCss, '.cw-pane');
    assert.match(pane, /overflow-y:\s*auto/);
    assert.equal(px(pane, 'height'), 616);
    assert.equal(px(pane, 'width'), 1168);

    // 关于我、项目、旅行、履历、博客的内容区都是 .cw-pane，能聚焦（键盘上下键翻页）并说明自己是什么区域。
    for (const name of ['cw-about-pane', 'cw-timeline-pane', 'cw-gallery-pane', 'cw-resume-pane', 'cw-blog-scroll']) {
        const tag = new RegExp(`<div class="cw-pane ${name}"[^>]*>`).exec(sheetHtml);
        assert.ok(tag, `缺少 ${name}`);
        assert.match(tag[0], /tabindex="0"/, `${name} 不能用键盘滚动`);
        assert.match(tag[0], /role="region"/);
    }
});

test('履历是两张 A4（210 : 297）比例的纸，字号放大，可以用滚轮上下看', () => {
    assert.equal((sheetHtml.match(/<article class="cw-a4">/g) || []).length, 2);

    const a4 = rule(desktopCss, '.cw-a4');
    const width = px(a4, 'width');
    const height = px(a4, 'min-height');
    assert.ok(Math.abs(height / width - 297 / 210) < 0.003, `纸的比例不是 A4：${width} × ${height}`);

    // 正文 22px 左右，章节标题和姓名更大；以前整页只有 13–15px。
    assert.ok(px(rule(desktopCss, '.cw-a4-desc'), 'font-size') >= 20, '履历正文不到 20px');
    assert.ok(px(rule(desktopCss, '.cw-a4-name'), 'font-size') >= 70, '履历姓名不到 70px');

    // 履历的内容都还在：教育、经历、技能、证书、奖项，下载按钮保留。
    for (const key of ['resume.h.edu', 'resume.h.exp', 'resume.h.skills', 'resume.h.cert', 'resume.h.awards']) assert.ok(sheetHtml.includes(`data-i18n="${key}"`), `履历缺少 ${key}`);
    assert.match(sheetHtml, /<button class="cw-resume-download" type="button" data-resume-download/);
    // 手机和电话不进公开页（见 AGENTS.md「Resume 公开页隐私规则」）。
    const resume = /<section class="cw-file cw-file--resume"[\s\S]*?<\/section>\s*<section class="cw-file cw-file--travel"/.exec(sheetHtml)[0];
    assert.doesNotMatch(resume, /\d{11}/);
});

test('项目是一条时间线：没有分类，一个节点一场比赛，每个节点占满一屏，滚轮一格一格翻', () => {
    assert.doesNotMatch(sheetHtml, /projectTabs|cwProjectCount/);
    assert.doesNotMatch(script, /renderTabs|categoryLabel|state\.pf|state\.tf/);

    const pane = rule(desktopCss, '.cw-pane');
    const event = rule(desktopCss, '.cw-event');
    assert.match(rule(desktopCss, '.cw-timeline-pane'), /scroll-snap-type:\s*y mandatory/);
    assert.match(event, /scroll-snap-align:\s*start/);
    assert.match(event, /scroll-snap-stop:\s*always/, '快速滚动也不能一下翻过好几个节点');
    assert.equal(px(event, 'height'), px(pane, 'height'), '一个节点的高度必须等于内容区的高度，才是「一屏一个」');

    // 窄屏上纸自己滚动，不再吸附，节点按内容长高。
    assert.match(rule(narrowCss, '.cw-timeline-pane'), /scroll-snap-type:\s*none/);
    assert.match(rule(narrowCss, '.cw-event'), /height:\s*auto/);

    // 渲染函数：每个项目一个节点，获奖用 cat === 'award' 判断，标记文字走词典。
    assert.match(script, /item\.cat === 'award'/);
    assert.match(script, /t\('projects\.award'\)/);
});

test('旅行是一本相册：先是路线图，后面是两列大照片，没有城市分类和「最近目击」', () => {
    assert.doesNotMatch(sheetHtml, /travelTabs|cw-travel-recent|cw-travel-map/);
    const gallery = rule(desktopCss, '.cw-gallery');
    assert.match(gallery, /grid-template-columns:\s*repeat\(2,/);
    // 照片至少 300px 高；以前是 124px，缩小之后只剩一个小点。
    assert.ok(px(rule(desktopCss, '.cw-shot-photo'), 'height') >= 300);
    assert.ok(sheetHtml.indexOf('cw-gallery-map') < sheetHtml.indexOf('data-list="travel"'), '路线图应在照片前面');
});

test('纸摊开后按窗口宽高各算一个缩放取小的，不再是只占一半的 k × 0.9', () => {
    assert.match(script, /function sheetScale\(\)/);
    assert.match(script, /W \/ SHEET_WIDTH \* 0\.96, H \/ SHEET_HEIGHT \* 0\.92/);
    assert.doesNotMatch(script, /const ks = k \* 0\.9/);
    // 「减少动态效果」在桌面宽度下也要照常缩放居中：只有窄屏才清掉 transform。
    assert.match(script, /if \(stackedQuery\.matches\) \{ sheet\.style\.transform = ''; return; \}/);
    // 右上角（语言切换和环境音）会盖住纸的右上角，履历的下载按钮不能放在那里。
    assert.ok(px(rule(desktopCss, '.cw-resume-download'), 'left') < 800);
});
